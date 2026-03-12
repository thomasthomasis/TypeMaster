import { Client, WebSocketAdapterText } from "@heroiclabs/nakama-js";
import { WebSocket } from "ws";
import readline from "readline"

// 1. Polyfill the global WebSocket for the Nakama SDK
global.WebSocket = WebSocket;

readline.emitKeypressEvents(process.stdin);
if(process.stdin.isTTY) process.stdin.setRawMode(true);

async function testMatchmaking() {
    const client = new Client("defaultkey", "127.0.0.1", "7350");
    
    // 2. Standard adapter setup
    const adapter = new WebSocketAdapterText();
    const socket = client.createSocket(false, false, adapter);

    let typingTimeout = null;
    let currentMatchId = null;
    let myId = null;
    let latestState = null;

    let streams = {
        main: { text: "", offset: 0, caret: 0 },
        attack: { text: "", caret: 0 },
        shield: { text: "", caret: 0 }
    };

    let activeStream = "main"; // "main", "attack", "shield"
    let targetMode = "Leader"; // "Random", "Leader", "Attacker"

    try {
        const session = await client.authenticateCustom(`test_user_${Math.random()}`);
        myId = session.user_id;
        await socket.connect(session, true);
        console.log("✅ Connected! Use keys: [T] Main, [A] Attack, [S] Shield | [1-3] Targeting");

        // Select Lobby Size (Example: Brawl)
        const lobbyMode = "brawl";
        await socket.addMatchmaker(`+properties.mode:${lobbyMode}`, 2, 8, { mode: lobbyMode });

        process.stdin.on("keypress", (str, key) => {
            if(key.ctrl && key.name === "c") process.exit();

            // Switch Streams
            if (key.name === "t") switchStream("main");
            if (key.name === "a") switchStream("attack");
            if (key.name === "s") switchStream("shield");

            // Switch Targeting Modes
            if (key.name === "1") switchTargetMode("Random");
            if (key.name === "2") switchTargetMode("Leader");
            if (key.name === "3") switchTargetMode("Attacker");
        });

        const switchStream = (stream) => {
            activeStream = stream;
            socket.sendMatchState(currentMatchId, 7, JSON.stringify({ stream }));
        }

        const switchTargetMode = (mode) => {
            targetMode = mode;
            socket.sendMatchState(currentMatchId, 6, JSON.stringify({ mode }));
        };

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
                if (!me || !streams.main.text) {
                    console.log("Waiting for player data and text buffer...");
                    return;
                }

                decideAIAction(me);

                renderUI(me);

                if(state.status == 2 && !typingTimeout && me.is_alive) {
                    startTyping();
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
                streams.main.text = state.main_paragraph;
                streams.main.offset = state.main_offset;
                streams.attack.text = state.attack_paragraph;
                streams.attack.caret = state.attack_caret;
                streams.shield.text = state.shield_paragraph;
                streams.shield.caret = state.shield_caret;
        
                return;
            }
        };

        function decideAIAction(me) {
            const stormCps = latestState.storm_speed;
            const myCps = me.current_cps;
            const gap = me.caret_position - latestState.storm_caret_position;

            const botMaxCps = 12;

            // 1. PANIC: Storm is too close OR outpacing us
            if (stormCps > (botMaxCps - 2)) {
                if (activeStream !== "main") switchStream("main");
                return;
            }

            // 2. STANDARD PRESSURE: Storm is close
            if (gap < 20 || (stormCps > myCps - 1)) {
                if (activeStream !== "main") switchStream("main");
            }


            // 2. OPPORTUNITY: We have a huge lead (Gap > 50) and are typing faster than the storm
            else if (gap > 60 && stormCps < (myCps * 0.7)) {
                if (activeStream === "main") {
                    Math.random() < 0.8 ? switchStream("attack") : switchStream("shield");
                }
            }
        }
        

        function renderUI(me) {
            console.clear();
            const gap = me.caret_position - latestState.storm_caret_position;
            const stormCps = latestState.storm_speed;
            const myCps = me.current_cps;

            console.log(`--- ⚡ SPEED CLASH | AI: ${myId.substring(0, 5)} | MODE: ${latestState.mode} ---`);
            console.log(`HP: ${me.health.toFixed(0)} | SHIELD: [${"█".repeat(me.shield_stacks)}${"░".repeat(3-me.shield_stacks)}]`);
            console.log(`MY SPEED: ${myCps.toFixed(1)} CPS | STORM SPEED: ${stormCps.toFixed(1)} CPS`);
            console.log(`STORM GAP: ${gap.toFixed(1)} | ACTIVE: ${activeStream.toUpperCase()}`);
            console.log(`--------------------------------------------------------------------------------`);

            // 1. MAIN STREAM (50 chars window)
            const mainIdx = me.caret_position - streams.main.offset;
            console.log(`MAIN: ${formatStream(streams.main.text, mainIdx, 40)}`);

            // 2. SIDEBARS
            console.log(`\nATTACK: [${"█".repeat(me.attack_power)}${"░".repeat(15-me.attack_power)}] ${formatStream(streams.attack.text, me.attack_caret, 10)}`);
            console.log(`SHIELD: [${"█".repeat(Math.floor(me.shield_power/3))}${"░".repeat(10-Math.floor(me.shield_power/3))}] ${formatStream(streams.shield.text, me.shield_caret, 10)}`);
            console.log(`--------------------------------------------------------------------------------`);
        }

        function formatStream(text, idx, range) {
            if (!text) return "...";
            const start = Math.max(0, idx - 5); // Show a little bit of history
            const end = Math.min(text.length, idx + range);
            const slice = text.substring(start, end);
            const relativePos = idx - start;
            return `...${slice.substring(0, relativePos)}[${slice[relativePos] || " "}]${slice.substring(relativePos+1)}...`;
        }

        function startTyping() {
            const typeNextChar = () => {
                const me = latestState.players[myId];
                if (!me || !me.is_alive) return;

                let charToSend;
                let isError = Math.random() < 0.05;

                if(isError) {
                    charToSend = "§";
                } else {
                    // Get correct char from current active stream
                    if (activeStream === "main") {
                        const localIdx = me.caret_position - streams.main.offset;
                        charToSend = streams.main.text[localIdx];
                    } else if (activeStream === "attack") {
                        charToSend = streams.attack.text[me.attack_caret];
                    } else {
                        charToSend = streams.shield.text[me.shield_caret];
                    }
                }

                socket.sendMatchState(currentMatchId, 1, JSON.stringify({
                    stream: activeStream,
                    character: charToSend || " "
                }));

                // Variable typing speed (Human-like)
                const delay = Math.floor(Math.random() * 70) + 80; 
                typingTimeout = setTimeout(typeNextChar, delay);
            };

            typeNextChar();
        }

    } catch (err) {
        console.error("❌ Error:", err.message);
        if (typingTimeout) clearInterval(typingTimeout);
    }
}





testMatchmaking();