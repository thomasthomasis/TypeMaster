import React, { useState, useEffect, useCallback, useRef } from 'react';
import * as Colyseus from 'colyseus.js';
import './styles/App.css';

type GameState = 'menu' | 'queue' | 'game' | 'result';

interface PlayerData {
  id: string;
  username: string;
  reactionTime: number;
  wins: number;
  elo: number;
  ready: boolean;
}

interface RoomState {
  players: Map<string, PlayerData>;
  gameActive: boolean;
  stimulusTime: number;
  roundNumber: number;
  countdown: string;
}

interface MatchResults {
  winner: string;
  finalScores: Array<{
    username: string;
    wins: string;
  }>;
}

function App() {
  const [gameState, setGameState] = useState<GameState>('menu');
  const [username, setUsername] = useState('');
  const [room, setRoom] = useState<Colyseus.Room | null>(null);
  const [roomState, setRoomState] = useState<any>(null);
  const [showStimulus, setShowStimulus] = useState(false);
  const [countdown, setCountdown] = useState('');
  const [matchResults, setMatchResults] = useState<MatchResults | null>(null);
  const [opponentName, setOpponentName] = useState('');
  
  const clientRef = useRef<Colyseus.Client | null>(null);

  useEffect(() => {
    // Initialize Colyseus client
    clientRef.current = new Colyseus.Client('ws://localhost:2567');
    
    return () => {
      room?.leave();
    };
  }, []);

  const joinQueue = async () => {
    if (!username.trim()) {
      alert('Please enter a username');
      return;
    }

    setGameState('queue');

    try {
      const newRoom = await clientRef.current!.joinOrCreate<RoomState>('reaction_room', {
        username: username.trim()
      });

      setRoom(newRoom);
      console.log('Joined room:', newRoom.roomId);

      // Autor
      newRoom.send('ready');

      // Listen to state changes
      newRoom.onStateChange((state) => {
        setRoomState({...state});
        setCountdown(state.countdown || '');
      })

      // Match found
      newRoom.onMessage('matchFound', (data) => {
        console.log('Match found!', data);
        const opponent = data.players.find((p: any) => p.username !== username);
        setOpponentName(opponent?.username || 'Opponent');
        setGameState('game');
      });

      // Stimulus shown
      newRoom.onMessage('stimulus', () => {
        console.log('Stimulus!');
        setShowStimulus(true);
      });

      // Round ended
      newRoom.onMessage('roundEnd', (data) => {
        console.log('Round ended:', data);
        setShowStimulus(false);
      });

      // Match ended
      newRoom.onMessage('matchEnd', (data) => {
        console.log('Match ended:', data);
        setMatchResults(data);
        setGameState('result');
      });

      // Player left
      newRoom.onMessage('playerLeft', (data) => {
        alert(`${data.username} left the game`);
        newRoom.leave();
        setGameState('menu');
      });

    } catch (error) {
      console.error('Failed to join room:', error);
      alert('Failed to join game. Make sure the server is running!');
      setGameState('menu');
    }
  };

  const handleReady = () => {
    if (room) {
      room.send('ready');
      console.log('Sent ready signal');
    }
  };

  const handleClick = useCallback(() => {
    if (showStimulus && room) {

      const timestamp = (room as any).clock?.currentTime || Date.now();
      room.send('reaction', { timestamp });
      console.log('Sent reaction at:', timestamp);
    }
  }, [showStimulus, room]);

  const backToMenu = () => {
    if (room) {
      room.leave();
      setRoom(null);
    }
    setGameState('menu');
    setShowStimulus(false);
    setCountdown('');
    setMatchResults(null);
    setRoomState(null);
  };

  const getMyPlayer = () : PlayerData | undefined => {
    if (!roomState || !room) return undefined;
    return roomState.players?.get(room.sessionId);
  };

  const getOpponentPlayer = () : PlayerData | undefined => {
    if (!roomState || !room) return undefined;
    const players = Array.from(roomState.players?.values() || []);
    const opponent = players.find((p: any) => p.id !== room.sessionId);

    return opponent as PlayerData | undefined;
  };

  return (
    <div className="App">
      <div className="container">
        {/* MENU */}
        {gameState === 'menu' && (
          <div className="menu">
            <h1>⚡ Reaction Game</h1>
            <p>Test your reflexes against players worldwide!</p>
            <input
              type="text"
              placeholder="Enter your username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && joinQueue()}
              maxLength={20}
            />
            <br />
            <button onClick={joinQueue}>Find Match</button>
          </div>
        )}

        {/* QUEUE */}
        {gameState === 'queue' && (
          <div className="queue">
            <h2>Finding opponent...</h2>
            <div className="spinner"></div>
            <p>Searching for a worthy challenger...</p>
            <button onClick={backToMenu} style={{ marginTop: '20px' }}>Cancel</button>
          </div>
        )}

        {/* GAME */}
        {gameState === 'game' && (
          <div className="game-container">
            <div className="game-info">
              <div className="player-info">
                <div>{getMyPlayer()?.username} (You)</div>
                <div>Wins: {getMyPlayer()?.wins || 0}</div>
              </div>
              <div className="player-info">
                <div>{opponentName}</div>
                <div>Wins: {getOpponentPlayer()?.wins || 0}</div>
              </div>
            </div>

            {countdown && (
              <div className="countdown">{countdown}</div>
            )}

            {!countdown && (
              <>
                <div
                  className={`game-area ${
                    showStimulus ? 'active' : roomState?.gameActive === false ? 'disabled' : 'waiting'
                  }`}
                  onClick={handleClick}
                >
                  {showStimulus ? '🎯 CLICK NOW!' : '⏳ Wait for green...'}
                </div>

                <div className="round-info">
                  <p>Round {roomState?.roundNumber || 0} of 5</p>
                  {roomState?.gameActive === false && !countdown && (
                    <p>Get ready for next round...</p>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* RESULT */}
        {gameState === 'result' && matchResults && (
          <div className="result">
            <h2>Match Complete!</h2>
            <h1>{matchResults.winner === username ? '🏆 You Won!' : '😔 You Lost'}</h1>
            
            <div className="results-table">
              <h3>Final Scores</h3>
              {matchResults.finalScores?.map((score: any, idx: number) => (
                <div key={idx} className="result-row">
                  <span>{score.username}</span>
                  <span>{score.wins} wins</span>
                </div>
              ))}
            </div>

            <button className="primary" onClick={() => {
              backToMenu();
              setTimeout(joinQueue, 100);
            }}>
              Play Again
            </button>
            <button className="secondary" onClick={backToMenu}>
              Main Menu
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;