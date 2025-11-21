import { Room, Client } from "colyseus";
import { ReactionRoomState, Player } from "./schema/ReactionRoomState";

export class ReactionRoom extends Room<ReactionRoomState> {
    
    maxClients: number = 2;
    private roundInProgress = false;

    onCreate(options: any) {
        this.state = new ReactionRoomState();
        console.log("Reaction Room created!", options);

        // Handle player ready signal
        this.onMessage("ready", (client) => {
            
            const player = this.state.players.get(client.sessionId);

            if(player) {
                player.ready = true;
                console.log(`${player.username} is ready`);
            }

            this.checkIfCanStart();
        });

        this.onMessage("reaction", (client, data: { timestamp: number }) => {
            if(!this.state.gameActive || this.roundInProgress === false) {
                console.log("Reaction received but game not active");
                return;
            }

            const player = this.state.players.get(client.sessionId);
            if(!player || player.reactionTime > 0) {
                return;
            }

            const reactionTime = data.timestamp - this.state.stimulusTime;
            player.reactionTime = reactionTime;

            console.log(`${player.username} reacted in ${reactionTime}ms`);

            this.checkRoundEnd();
        });
    }

    onJoin(client: Client, options: any) {
        console.log(client.sessionId, "joined!");

        const player = new Player();
        player.id = client.sessionId;
        player.username = options.username || `Player${this.clients.length}`;
        this.state.players.set(client.sessionId, player);

        if(this.state.players.size === 2) {
            this.broadcast("matchFound", {
                players: Array.from(this.state.players.values()).map(p => ({
                    username: p.username,
                    elo: p.elo
                }))
            });
        }
    }

    onLeave(client: Client, consented: boolean) {
        console.log(client.sessionId, "left!");

        const player = this.state.players.get(client.sessionId);
        if(player) {
            this.broadcast("playerLeft", { username: player.username });
        }

        this.state.players.delete(client.sessionId);

        if(this.state.players.size === 1 && this.state.gameActive) {
            const remainingPlayer = Array.from(this.state.players.values())[0];
            remainingPlayer!.wins = 3;

            this.endMatch();
        }
    }

    onDispose() {
        console.log("room", this.roomId, " disposing...");
    }

    private checkIfCanStart() {
        const players = Array.from(this.state.players.values());

        if(players.length == 2 && players.every(p => p.ready)) {
            this.startCountdown();
        }
    }

    private startCountdown() {
        let count = 3;

        const countdownInterval = setInterval(() => {
            if(count > 0) {
                this.state.countdown = count.toString();
                count--;
            }
            else {
                this.state.countdown = "GO!";
                clearInterval(countdownInterval);

                this.clock.setTimeout(() => {
                    this.state.countdown = "";
                    this.startRound();
                }, 500)
            }
        }, 1000);
    }

    private startRound() {
        this.state.roundNumber++;
        this.roundInProgress = true;

        // Reset reaction times
        this.state.players.forEach(player => {
            player.reactionTime = 0;
            player.ready = false;
        });

        const delay = 1500 + Math.random() * 2500;

        console.log(`Starting round ${this.state.roundNumber} with ${delay}ms delay`);

        this.clock.setTimeout(() => {
            this.state.gameActive = true;
            this.state.stimulusTime = this.clock.currentTime;

            this.broadcast("stimulus", {
                time: this.state.stimulusTime
            });

            console.log("Stimulus shown!");

            this.clock.setTimeout(() => {
                if(this.roundInProgress) {
                    console.log("Round timeout!");
                    this.checkRoundEnd();
                }
            }, 5000);
        }, delay);
    }

    private checkRoundEnd() {
        const players = Array.from(this.state.players.values());

        const bothReacted = players.every(p => p.reactionTime > 0);

        if(bothReacted || !this.state.gameActive) {
            this.endRound();
        }
    }

    private endRound() {
        this.state.gameActive = false;
        this.roundInProgress = false;

        const players = Array.from(this.state.players.values());

        let winner: Player | null | undefined = null;

        const player1 = players[0];
        const player2 = players[1];

        if(!player1 || !player2) return;
        

        if(player1.reactionTime > 0 && player2.reactionTime > 0) {
            winner = player1.reactionTime < player2.reactionTime ? player1: player2;
        }
        else if (player1.reactionTime > 0) {
            winner = player1;
        }
        else if(player2.reactionTime > 0) {
            winner = player2;
        }

        if(!winner) return;

        winner.wins++;
        console.log(`Round ${this.state.roundNumber} winner: ${winner.username}`);

        this.broadcast("roundEnd", {
            roundNumber: this.state.roundNumber,
            winner: winner.username || "No winner",
            results: players.map(p => ({
                username: p.username,
                reactionTime: p.reactionTime,
                wins: p.wins
            }))
        });

        if(winner.wins >= 3) {
            this.clock.setTimeout(() => {
                this.endMatch();
            }, 3000);
        }

        else {
            this.clock.setTimeout(() => {
                this.startCountdown();
            }, 3000);
        }
    }

    private endMatch() {
        const players = Array.from(this.state.players.values());
        const winner = players.find(p => p.wins >= 3) || players[0];

        this.broadcast("matchEnd", {
            winner: winner?.username,
            finalScores: players.map(p => ({
                username: p.username,
                wins: p.wins
            }))
        });

        this.clock.setTimeout(() => {
            this.disconnect();
        }, 5000);
    }
}