import './Leaderboard.css';

interface LeaderboardProps {
  players: Array<{
    id: string;
    name: string;
    wpm: number;
    health: number;
    position: number;
  }>;
  yourPosition: number;
}

export const Leaderboard = ({ players, yourPosition }: LeaderboardProps) => {
  // Get top 10 players
  const top10 = players.slice(0, 10);
  
  // Find your entry
  const youPlayer = players.find((p) => p.position === yourPosition);
  
  // Determine what to show: if you're in top 10, show top 10, otherwise show top 10 + you
  const displayPlayers = yourPosition <= 10 
    ? top10 
    : [...top10, youPlayer!].filter(Boolean);
  
  return (
    <div className="leaderboard">
      {displayPlayers.map((player) => (
        <div 
          key={player.id} 
          className={`leaderboard-item ${player.position === yourPosition ? 'leaderboard-you' : ''}`}
        >
          <span className="leaderboard-rank">#{player.position}</span>
          <span className="leaderboard-name">
            {player.position === yourPosition ? 'YOU' : player.name}
          </span>
          <span className="leaderboard-wpm">{player.wpm}</span>
        </div>
      ))}
    </div>
  );
};