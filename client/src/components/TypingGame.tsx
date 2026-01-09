import { useEffect, useState, useRef } from 'react';
import type { Socket } from '@heroiclabs/nakama-js';
import type { MatchState, PlayerState } from '../types/match';
import nakamaService from '../services/nakama';

interface TypingGameProps {
  socket: Socket;
  matchId: string;
  userId: string;
}

export default function TypingGame({ socket, matchId, userId }: TypingGameProps) {
  
    console.log("🎮 TypingGame render:", { matchId, userId, hasSocket: !!socket });
  
    const [matchState, setMatchState] = useState<MatchState | null>(null);
    const [currentPlayer, setCurrentPlayer] = useState<PlayerState | null>(null);
    const [inputValue, setInputValue] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {

    console.log("🔧 useEffect RUNNING with:", { matchId, userId });
    console.log("📡 Subscribing to NakamaService updates...");

    console.log("Subscribing to NakamaService updates...");

    // Subscribe to the service instead of setting socket.onmatchdata directly
    const unsubscribe = nakamaService.subscribe(({ opCode, payload }) => {
      console.log("📨 RECEIVED match data:", { opCode, payload });

      if(opCode === 1 || opCode === 2) {
        console.log("✅ Setting matchState with payload:", payload);
        setMatchState(payload);

        if(payload.players && payload.players[userId]) {
          console.log("✅ Setting currentPlayer:", payload.players[userId]);
          setCurrentPlayer(payload.players[userId]);
        } else {
          console.warn("⚠️ userId not found in players:", { userId, players: payload.players });
        }
      }
    });

    console.log("📤 Requesting initial state (opCode 3)...");
    // Immediately request the initial state from the server after subscribing
    nakamaService.sendMatchData(matchId, 3, { request: "sync" });

    inputRef.current?.focus();

    // Set a timeout to check if we ever receive data
    const timeout = setTimeout(() => {
      console.error("❌ TIMEOUT: No match data received after 5 seconds!");
      console.error("Debug info:", {
        matchId,
        userId,
        hasSocket: !!socket,
        socketConnected: socket ? "unknown" : "no socket"
      });
    }, 5000);

    // Cleanup
    return () => {
        console.log("Unsubscribing from NakamaService...");
        clearTimeout(timeout);
        unsubscribe();
    }
    

  }, [matchId, userId]);

  console.log("🎨 Render state:", { 
    hasMatchState: !!matchState, 
    hasCurrentPlayer: !!currentPlayer 
  });

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!matchState || !currentPlayer) return;

    const char = e.key;
    
    // Ignore special keys
    if (char.length > 1) return;

    const position = currentPlayer.caret_position;

    // User service to send data to keep binary encoding consistent
    nakamaService.sendMatchData(matchId, 1, {
        character: char,
        position: position
    });
    
    // Clear input after each character
    setInputValue('');
  };

  if (!matchState || !currentPlayer) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <h2>Loading match...</h2>
        <p>Match ID: {matchId}</p>
        <p>User ID: {userId}</p>
        <p>Waiting for match state...</p>
      </div>
    );
  }

  // Calculate gap between player and danger zone
  const gap = currentPlayer.caret_position - currentPlayer.danger_caret_position;
  const isDanger = gap < 0;

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace' }}>
      {/* Header Stats */}
      <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between' }}>
        <div>
          <strong>Health:</strong> 
          <div style={{ 
            width: '200px', 
            height: '20px', 
            border: '2px solid black', 
            marginTop: '5px',
            background: '#ddd'
          }}>
            <div style={{
              width: `${currentPlayer.health}%`,
              height: '100%',
              background: currentPlayer.health > 50 ? 'green' : currentPlayer.health > 25 ? 'orange' : 'red',
              transition: 'width 0.3s'
            }} />
          </div>
        </div>
        <div>
          <strong>Score:</strong> {currentPlayer.score}
        </div>
        <div>
          <strong>Position:</strong> {currentPlayer.caret_position} / {matchState.paragraph.length}
        </div>
        <div>
          <strong>Gap:</strong> 
          <span style={{ 
            color: isDanger ? 'red' : 'green',
            fontWeight: 'bold'
          }}>
            {gap.toFixed(1)} chars
          </span>
        </div>
      </div>

      {/* Paragraph Display */}
      <div style={{ 
        fontSize: '24px', 
        lineHeight: '1.8',
        marginBottom: '20px',
        padding: '20px',
        background: '#f5f5f5',
        borderRadius: '8px',
        position: 'relative'
      }}>
        {matchState.paragraph.split('').map((char, index) => {
          const typed = index < currentPlayer.caret_position;
          const current = index === currentPlayer.caret_position;
          const inDangerZone = index <= currentPlayer.danger_caret_position;

          return (
            <span
              key={index}
              style={{
                color: typed ? '#888' : '#000',
                background: current ? 'yellow' : inDangerZone ? '#ffcccc' : 'transparent',
                fontWeight: current ? 'bold' : 'normal',
                padding: '2px'
              }}
            >
              {char}
            </span>
          );
        })}
      </div>

      {/* Typing Input */}
      <div>
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyPress={handleKeyPress}
          style={{
            width: '100%',
            padding: '10px',
            fontSize: '18px',
            border: '2px solid ' + (isDanger ? 'red' : '#ccc')
          }}
          placeholder="Type here..."
          autoFocus
        />
        <p style={{ marginTop: '10px', color: '#666' }}>
          Next character: <strong>{matchState.paragraph[currentPlayer.caret_position]}</strong>
        </p>
      </div>

      {/* Other Players (for multiplayer later) */}
      {Object.keys(matchState.players).length > 1 && (
        <div style={{ marginTop: '30px' }}>
          <h3>Other Players:</h3>
          {Object.values(matchState.players)
            .filter(p => p.user_id !== userId)
            .map(player => (
              <div key={player.user_id} style={{ 
                padding: '10px', 
                margin: '5px 0',
                background: player.is_alive ? '#e8f5e9' : '#ffebee',
                borderRadius: '4px'
              }}>
                <strong>{player.username}</strong> - 
                Health: {player.health}% - 
                Position: {player.caret_position} - 
                Score: {player.score}
                {!player.is_alive && <span style={{ color: 'red' }}> [ELIMINATED]</span>}
              </div>
            ))}
        </div>
      )}

      {/* Game Over */}
      {!currentPlayer.is_alive && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontSize: '48px',
          fontWeight: 'bold'
        }}>
          <div style={{ textAlign: 'center' }}>
            <div>ELIMINATED</div>
            <div style={{ fontSize: '24px', marginTop: '20px' }}>
              Final Score: {currentPlayer.score}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}