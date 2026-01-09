import { useState, useEffect } from 'react';
import nakamaService from './services/nakama';

function App() {
  const [status, setStatus] = useState<string>('disconnected');
  const [matchId, setMatchId] = useState<string | null>(null);

  useEffect(() => {
    // Subscribe to match updates once
    const unsubscribe = nakamaService.subscribe(({ opCode, payload }) => {
      console.log("📨 Received match data:", { opCode, payload });
      
      if (opCode === 2) {
        console.log("✅ MATCH STATE:", JSON.stringify(payload, null, 2));
        console.log("Players:", payload.players);
        console.log("Paragraph:", payload.paragraph);
        console.log("Match time:", payload.match_time);
      }
    });

    return () => unsubscribe();
  }, []);

  const handleConnect = async () => {
    try {
      setStatus('connecting');
      console.log("🔌 Connecting...");
      
      // 1. Authenticate
      const deviceId = "test_user_" + Math.random().toString(36).substring(5);
      console.log("🔑 Authenticating with:", deviceId);
      const session = await nakamaService.authenticate(deviceId);
      console.log("✅ Authenticated! User ID:", session.user_id);
      
      // 2. Create socket
      console.log("🔌 Creating socket...");
      await nakamaService.createSocket();
      console.log("✅ Socket connected!");
      
      setStatus('connected');
      
    } catch (error) {
      console.error("❌ Connection failed:", error);
      setStatus('error');
    }
  };

  const handleStartMatch = async () => {
    try {
      setStatus('starting match');
      console.log("🎮 Starting match...");
      
      // 1. Create match
      console.log("🎮 Creating match...");
      const matchId = await nakamaService.createMatch();
      console.log("✅ Match created:", matchId);
      
      // 2. Join match
      console.log("🎮 Joining match...");
      await nakamaService.joinMatch(matchId);
      console.log("✅ Joined match!");
      
      setMatchId(matchId);
      setStatus('in match');
      
      // Now just wait - match state will be logged via subscription
      console.log("⏳ Waiting for match data...");
      
    } catch (error) {
      console.error("❌ Failed to start match:", error);
      setStatus('error');
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace' }}>
      <h1>Test</h1>
      
      <div style={{ marginBottom: '20px' }}>
        <strong>Status:</strong> {status}
      </div>
      
      {matchId && (
        <div style={{ marginBottom: '20px' }}>
          <strong>Match ID:</strong> {matchId}
        </div>
      )}
      
      {status === 'disconnected' && (
        <button onClick={handleConnect} style={{ padding: '10px 20px', fontSize: '16px' }}>
          Connect to Server
        </button>
      )}
      
      {status === 'connected' && (
        <button onClick={handleStartMatch} style={{ padding: '10px 20px', fontSize: '16px' }}>
          Start Match
        </button>
      )}
      
      {status === 'in match' && (
        <div style={{ padding: '20px', background: '#e8f5e9', borderRadius: '8px' }}>
          <h2>✅ In Match!</h2>
          <p>Check the browser console (F12) to see match data.</p>
          <p>Match data is being logged every 100ms.</p>
        </div>
      )}
      
      {status === 'error' && (
        <div style={{ padding: '20px', background: '#ffebee', borderRadius: '8px', color: 'red' }}>
          <h2>❌ Error!</h2>
          <p>Check the console for details.</p>
          <button onClick={() => setStatus('disconnected')} style={{ marginTop: '10px' }}>
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}

export default App;