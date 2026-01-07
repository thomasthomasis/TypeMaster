import { useState } from 'react';
import nakamaService from './services/nakama.ts';

function App() {
  const [connected, setConnected] = useState(false);

  const handleConnect = async () => {
    try {
      // Use a random device ID for testing
      const deviceId = Math.random().toString(36).substring(7);
      await nakamaService.authenticate(deviceId);
      setConnected(true);
      console.log("Connected to Nakama!");
    } catch (error) {
      console.error("Failed to connect:", error);
    }
  };

  return (
    <div style={{ padding: '20px' }}>
      <h1>Battle Royale Game</h1>
      {!connected ? (
        <button onClick={handleConnect}>Connect to Server</button>
      ) : (
        <p>✅ Connected to Nakama!</p>
      )}
    </div>
  );
}

export default App;