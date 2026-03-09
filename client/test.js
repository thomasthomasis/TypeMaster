import { Client, WebSocketAdapterText } from "@heroiclabs/nakama-js";
import { WebSocket } from "ws";

// 1. Polyfill the global WebSocket for the Nakama SDK
global.WebSocket = WebSocket;

async function testMatchmaking() {
    const client = new Client("defaultkey", "127.0.0.1", "7350");
    
    // 2. Standard adapter setup
    const adapter = new WebSocketAdapterText();
    const socket = client.createSocket(false, false, adapter);

    let typingTimeout = null;
    let currentMatchId = null;
    let myId = null;
    let myParagraph = "";
    let latestState = null;
    let myOffset = 0;

    try {
        const session = await client.authenticateCustom(`test_user_${Math.random()}`);
        myId = session.user_id;
        await socket.connect(session, true);
        console.log("✅ Connected to Nakama!");

        // 3. Start Matchmaking
        await socket.addMatchmaker("*", 2, 2);
        console.log("⏳ Searching for 2 players (Open another terminal and run this again!)...");

        socket.onmatchmakermatched = async (matched) => {
            console.log("🔥 Match Found! ID:", matched.match_id);
            currentMatchId = matched.match_id;
            await socket.joinMatch(matched.match_id);
        };

        socket.onmatchdata = (result) => {
            const dataString = new TextDecoder().decode(result.data);
            const state = JSON.parse(dataString);

            // OpCode 2: Game Update
            if (result.op_code === 2) {
                latestState = state;
                console.log(`📡 Time: ${state.match_time.toFixed(1)}s | Status: ${state.status}`);

                const me = state.players ? state.players[myId] : null;
                if (!me || !myParagraph) {
                    console.log("Waiting for player data and text buffer...");
                    return;
                }

                const localIndex = me.caret_position - myOffset;

                const start = Math.max(0, localIndex - 10);
                const end = Math.min(myParagraph.length, localIndex + 30);
                const slice = myParagraph.substring(start, end);

                const relativePosInSlice = localIndex - start;
                const highlighted = 
                    slice.substring(0, relativePosInSlice) + 
                    "[" + (myParagraph[localIndex] || " ") + "]" + 
                    slice.substring(relativePosInSlice + 1);

                const gap = me.caret_position - latestState.storm_caret_position;

                console.clear();
                console.log(`--- ⚡ SPEED CLASH: ${session.username} ---`);
                console.log(`Current Paragraph: ${myParagraph}`)
                console.log(`Time:  ${latestState.match_time.toFixed(1)}s | HP: ${me.health}`);
                console.log(`Storm: ${latestState.storm_caret_position.toFixed(2)} | Gap: ${gap.toFixed(2)}`);
                console.log(`\nTEXT VIEW (Offset: ${myOffset}):`);
                console.log(`...${highlighted}...`);
                console.log(`   ${" ".repeat(relativePosInSlice + 3)} ^ (Global Pos: ${me.caret_position})`);
                console.log(`\n------------------------------------------`);
                

                if(latestState.status === 2 && !typingTimeout && me.is_alive) {

                    const typeNextChar = () => {

                        const currentMe = latestState.players[myId];
                        if (!currentMe || !currentMe.is_alive) return;

                        const currentIndex = currentMe.caret_position - myOffset;

                        if(currentIndex < myParagraph.length) {
                            const char = myParagraph[currentIndex];

                            socket.sendMatchState(currentMatchId, 1, JSON.stringify({
                                character: char,
                                position: currentMe.caret_position
                            }));

                            const delay = Math.floor(Math.random() * 300) + 150;
                            typingTimeout = setTimeout(typeNextChar, delay);
                        }
                        else {
                            typingTimeout = setTimeout(typeNextChar, 100);
                        }
                    };

                    typeNextChar();
                }
            }
            
            // OpCode 3: Countdown
            if (result.op_code === 3) {
                // Note: The payload for countdown was map[string]int{"seconds": seconds}
                console.log(`⏰ Countdown: ${state.seconds}...`);
                return;
            }

            if(result.op_code === 4) {
                console.log(`🏆 GAME OVER! The winner is: ${state.winner}`);
                clearInterval(typingTimeout);
                typingTimeout = null;
                return;
            }

            if(result.op_code === 5) {
                myParagraph = state.paragraph;
                myOffset = state.offset;
                console.log("Received new text chunk from server!");
                return;
            }
        };

    } catch (err) {
        console.error("❌ Error:", err.message);
        if (typingTimeout) clearInterval(typingTimeout);
    }
}

testMatchmaking();