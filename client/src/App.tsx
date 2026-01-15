import { useState, useEffect, useRef, useDebugValue } from "react";
import nakamaService from './services/nakama'

// Constants matching the Go backend OpCodes
const OP_TYPING = 1;
const OP_UPDATE = 2;
const OP_COUNTDOWN = 3;

function App() {

  const [status, setStatus] = useState<'disconnected' | 'connected' | 'matchmaking' | 'in-game'>('disconnected');
  const [matchId, setMatchId] = useState<string | null>(null);
  const [matchState, setMatchState] = useState<any>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [myUserId, setMyUserId] = useState<string>("");
  const [predictedPos, setPredictedPos] = useState(0);
  
  // Using a ref for the input to keep focus and handle typing efficiently
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsubscribe = nakamaService.subscribe(({ opCode, payload }) => {
      switch(opCode) {
        case OP_COUNTDOWN:
          setCountdown(payload.seconds);
          break;

        case OP_UPDATE:
          setMatchState(payload);
          // Auto-transition to in-game view when the first update arrives
          if (status !== 'in-game') {
            setStatus('in-game');
          }

          // Hide countdown once game status is "Playing" (Status 2 in Go)
          if (payload.status === 2) {
            setCountdown(null);
          }

          break;
      }
    });

    return () => {
      unsubscribe();
    }
  }, [status]);

  useEffect(() => {
    if(status === 'in-game' && inputRef.current) {
      inputRef.current.focus();
    }
  }, [status])

  useEffect(() => {
    if(matchState) {
      const serverPos = matchState.players[myUserId]?.caret_position || 0;

      // If the server is behind us, that's normal (latency).
      // But if the server says we are at a different position than we thought,
      // we must snap to the server's authoritative truth.
      if(serverPos > predictedPos) {
        setPredictedPos(serverPos);
      }
    }
  }, [matchState, myUserId]);

  const handleConnect = async () => {
    try {
      const deviceId = "user_" + Math.random().toString(36).substring(7);
      const session = await nakamaService.authenticate(deviceId);
      await nakamaService.createSocket();

      if(session.user_id) {
        setMyUserId(session.user_id);
      }

      setStatus('connected');
      
    }
    catch(e) {
      alert("Connection failed. Is Nakama running?");
    }
  };

  const startQueue = async (size: number) => {
    setStatus('matchmaking');
    const socket = nakamaService.getSocket();

    // Set up the "Match Found" trigger
    socket!.onmatchmakermatched = async (matched) => {
      setMatchId(matched.match_id);
      await nakamaService.joinMatch(matched.match_id);
    };

    const query = `+properties.mode:${size}player`;
    await socket!.addMatchmaker(query, size, size, { mode: `${size}player` });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if(!val || !matchState) return;

    const char = val.slice(-1);
    const targetChar = matchState.paragraph[predictedPos];

    // 1. Predict: Move the cursor locally immediately if the key is correct
    if(char === targetChar) {
      const nextPost = predictedPos + 1;
      setPredictedPos(nextPost);

      // 2. Send: Tell the server what we did
      const socket = nakamaService.getSocket();
      socket?.sendMatchState(matchId!, OP_TYPING, JSON.stringify({
        character: char,
        position: predictedPos // Send the position we just typed
      }));
    }

    e.target.value = "";
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '40px', fontFamily: 'sans-serif' }}>
      <h1>Typing 99 🏁</h1>

      {/* --- SECTION 1: PRE-GAME --- */}
      {status === 'disconnected' && (
        <button onClick={handleConnect} style={btnStyle}>Connect to Server</button>
      )}

      {status === 'connected' && (
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => startQueue(2)} style={btnStyle}>Test 1v1 (Open 2 Tabs)</button>
        </div>
      )}

      {status === 'matchmaking' && (
        <div style={{ textAlign: 'center', padding: '20px', background: '#f0f0f0' }}>
          <div className="spinner">🔄</div>
          <p>Waiting for opponents...</p>
        </div>
      )}

      {/* --- SECTION 2: THE BATTLE (IN-GAME) --- */}
      {status === 'in-game' && matchState && (
        <div style={gameWrapperStyle}>
          {/* Header Info */}
          <div style={headerStyle}>
            <span>HP: {matchState.players[myUserId]?.health}%</span>
            <span>Opponents Alive: {Object.values(matchState.players).filter((p: any) => p.is_alive).length}</span>
          </div>

          {/* Hidden Input Layer */}
          <input 
            ref={inputRef}
            autoFocus
            style={hiddenInputStyle}
            onChange={handleInputChange}
            disabled={!matchState.players[myUserId]?.is_alive}
          />

          <div style={textViewport}>
            <p style={paragraphStyle}>
              {matchState.paragraph.split('').map((char: string, i: number) => {
                const isTyped = i < predictedPos;
                return (
                  <span key={i} style={{ color: isTyped ? '#4caf50' : '#444' }}>
                    {char}
                  </span>
                );
              })}
            </p>

            {/* PLAYER CARET (Predicted) */}
            <div style={{
              ...caretBase,
              left: `${predictedPos}ch`,
              backgroundColor: '#4caf50',
              animation: 'blink 1s infinite'
            }} />

            {/* DANGER CARET (Authoritative) */}
            <div style={{
              ...caretBase,
              left: `${matchState.danger_position || 0}ch`,
              backgroundColor: 'red',
              width: '4px',
              zIndex: 10,
              boxShadow: '0 0 10px red',
              transition: 'left 0.1s linear'
            }} />
          </div>

          {countdown !== null && <div style={overlayStyle}><h1>{countdown === 0 ? "GO!" : countdown}</h1></div>}
          {!matchState.players[myUserId]?.is_alive && <div style={overlayStyle}><h1 style={{color: 'red'}}>ELIMINATED</h1></div>}
        </div>
      )}
    </div>
  );
}

// --- Styles ---
const btnStyle = { padding: '12px 24px', fontSize: '18px', cursor: 'pointer', background: '#000', color: '#fff', border: 'none' };

// --- Arcade Styling ---
const containerStyle = { maxWidth: '1000px', margin: '0 auto', padding: '40px', fontFamily: '"Courier New", Courier, monospace' };
const gameWrapperStyle = { position: 'relative' as 'relative', background: '#1a1a1a', padding: '30px', borderRadius: '12px' };
const textViewport = { position: 'relative' as 'relative', fontSize: '28px', lineHeight: '1.6', whiteSpace: 'pre-wrap' as 'pre-wrap' };
const paragraphStyle = { margin: 0, padding: 0, letterSpacing: '0px' };
const headerStyle = { display: 'flex', justifyContent: 'space-between', color: '#eee', marginBottom: '20px', fontSize: '18px' };

const hiddenInputStyle = {
  position: 'absolute' as 'absolute',
  opacity: 0,
  left: 0, top: 0, width: '100%', height: '100%',
  cursor: 'default',
  zIndex: 5
};

const caretBase = {
  position: 'absolute' as 'absolute',
  top: '0.2em',
  height: '1.2em',
  width: '2px',
  pointerEvents: 'none' as 'none'
};

const overlayStyle = { position: 'absolute' as 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, color: 'white' };



export default App;