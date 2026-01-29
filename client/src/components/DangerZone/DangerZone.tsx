import './DangerZone.css';

interface DangerZoneProps {
  playerPosition: number; // characters typed
  stormPosition: number;   // storm position in characters
  textLength: number;      // total text length
}

export const DangerZone = ({ playerPosition, stormPosition, textLength }: DangerZoneProps) => {
  // Calculate percentages for positioning
  const playerPercent = Math.min(100, (playerPosition / textLength) * 100);
  const stormPercent = Math.min(100, (stormPosition / textLength) * 100);
  const distance = playerPosition - stormPosition;
  
  return (
    <div className="danger-zone">
      <div className="danger-zone-label">DANGER ZONE</div>
      <div className="danger-zone-track">
        <div 
          className="danger-zone-storm" 
          style={{ width: `${stormPercent}%` }}
        >
          <span className="danger-zone-marker storm-marker">STORM</span>
        </div>
        <div 
          className="danger-zone-player" 
          style={{ left: `${playerPercent}%` }}
        >
          <span className="danger-zone-marker player-marker">YOU</span>
        </div>
      </div>
      <div className="danger-zone-distance">
        Distance: <span className={distance < 50 ? 'red-text' : 'cyan-text'}>
          {Math.floor(distance)} chars
        </span>
      </div>
    </div>
  );
};