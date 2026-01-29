import { TypingArea } from "../TypingArea/TypingArea";
import { StatsBar } from '../StatsBar/StatsBar';
import { PlayerCard } from '../PlayerCard/PlayerCard';
import { Leaderboard } from '../Leaderboard/Leaderboard';
import { DangerZone } from '../DangerZone/DangerZone';
import { useGameStore } from "../../store/useGameStore";
import './GameLayout.css'

// Mock data for now - will come from Nakam later
const mockPlayers = [
    { id: '1', name: 'SpeedDemon', wpm: 85, health: 100, position: 1 },
    { id: '2', name: 'TypeMaster', wpm: 78, health: 90, position: 2 },
    { id: '3', name: 'QuickKeys', wpm: 72, health: 85, position: 3 },
    { id: '4', name: 'FastFingers', wpm: 68, health: 75, position: 4 },
    { id: '5', name: 'RapidType', wpm: 65, health: 60, position: 5 },
    { id: '6', name: 'Player123', wpm: 55, health: 50, position: 6 },
    { id: '7', name: 'Player123', wpm: 55, health: 50, position: 6 },
    { id: '8', name: 'Player123', wpm: 55, health: 50, position: 6 },
    { id: '9', name: 'Player123', wpm: 55, health: 50, position: 6 },
    { id: '10', name: 'Player123', wpm: 55, health: 50, position: 6 },
    { id: '11', name: 'Player123', wpm: 55, health: 50, position: 6 },
    { id: '12', name: 'Player123', wpm: 55, health: 50, position: 6 },
    { id: '13', name: 'Player123', wpm: 55, health: 50, position: 6 },
    { id: '14', name: 'Player123', wpm: 55, health: 50, position: 6 },
    { id: '15', name: 'Player123', wpm: 55, health: 50, position: 6 },
    { id: '16', name: 'Player123', wpm: 55, health: 50, position: 6 },
    { id: '17', name: 'Player123', wpm: 55, health: 50, position: 6 },
    { id: '18', name: 'Player123', wpm: 55, health: 50, position: 6 },
    { id: '19', name: 'Player123', wpm: 55, health: 50, position: 6 },
    { id: '20', name: 'Player123', wpm: 55, health: 50, position: 6 },
    { id: '21', name: 'Player123', wpm: 55, health: 50, position: 6 },
    { id: '22', name: 'Player123', wpm: 55, health: 50, position: 6 },
    { id: '23', name: 'Player123', wpm: 55, health: 50, position: 6 },
    { id: '24', name: 'Player123', wpm: 55, health: 50, position: 6 },
    { id: '25', name: 'Player123', wpm: 55, health: 50, position: 6 },
    { id: '26', name: 'Player123', wpm: 55, health: 50, position: 6 },
    { id: '27', name: 'Player123', wpm: 55, health: 50, position: 6 },
    { id: '28', name: 'Player123', wpm: 55, health: 50, position: 6 },
    { id: '29', name: 'Player123', wpm: 55, health: 50, position: 6 },
    { id: '30', name: 'Player123', wpm: 55, health: 50, position: 6 },
    { id: '31', name: 'Player123', wpm: 55, health: 50, position: 6 },
    { id: '32', name: 'Player123', wpm: 55, health: 50, position: 6 },
    { id: '33', name: 'Player123', wpm: 55, health: 50, position: 6 },
    { id: '34', name: 'Player123', wpm: 55, health: 50, position: 6 },
    { id: '35', name: 'Player123', wpm: 55, health: 50, position: 6 },
    { id: '36', name: 'Player123', wpm: 55, health: 50, position: 6 },
    { id: '37', name: 'Player123', wpm: 55, health: 50, position: 6 },
    { id: '38', name: 'Player123', wpm: 55, health: 50, position: 6 },
    { id: '39', name: 'Player123', wpm: 55, health: 50, position: 6 },
    { id: '40', name: 'Player123', wpm: 55, health: 50, position: 6 },
    { id: '41', name: 'Player123', wpm: 55, health: 50, position: 6 },

];

export const GameLayout = () => {
  const health = useGameStore((state) => state.health);
  const wpm = useGameStore((state) => state.wpm);
  const stormSpeed = useGameStore((state) => state.stormSpeed);
  const matchTime = useGameStore((state) => state.matchTime);
  const stormPosition = useGameStore((state) => state.stormPosition);

  // Mock values - replace with real data later
  const yourPosition = 3; // Your rank
  const playerProgress = 450; // Characters typed
  const textLength = 1000; // Total text length

  return (
    <div className="game-layout">
      {/* Top Stats Bar */}
      <StatsBar 
        health={health}
        wpm={wpm}
        stormSpeed={stormSpeed}
        matchTime={matchTime}
      />

      {/* Main Game Area */}
      <div className="game-main">
        {/* Left Column - Player Cards */}
        <div className="player-cards-column">
          {mockPlayers.slice(0, 6).map((player) => (
            <PlayerCard
              key={player.id}
              name={player.name}
              wpm={player.wpm}
              health={player.health}
              rank={player.position}
              isYou={player.position === yourPosition}
            />
          ))}
        </div>

        {/* Center - Typing Area */}
        <div className="typing-area-container">
          <TypingArea />
        </div>

        {/* Right Column - Leaderboard */}
        <div className="leaderboard-column">
          <Leaderboard 
            players={mockPlayers}
            yourPosition={yourPosition}
          />
        </div>
      </div>

      {/* Bottom Danger Zone */}
      <DangerZone
        playerPosition={playerProgress}
        stormPosition={stormPosition}
        textLength={textLength}
      />
    </div>
  );
};