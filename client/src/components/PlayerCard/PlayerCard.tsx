import './PlayerCard.css';

interface PlayerCardProps {
  name: string;
  wpm: number;
  health: number;
  rank: number;
  isYou: boolean;
}

export const PlayerCard = ({ name, wpm, health, rank, isYou }: PlayerCardProps) => {
  const healthSegments = Math.ceil(health / 10); // 10 segments
  
  return (
    <div className={`player-card ${isYou ? 'player-card-you' : ''}`}>
      <div className="player-card-rank">#{rank}</div>
      <div className="player-card-name">{isYou ? 'YOU' : name}</div>
      <div className="player-card-health">
        {Array.from({ length: 10 }).map((_, i) => (
          <span key={i} className={`health-segment ${i < healthSegments ? 'filled' : ''}`} />
        ))}
      </div>
      <div className="player-card-wpm">{wpm} WPM</div>
    </div>
  );
};