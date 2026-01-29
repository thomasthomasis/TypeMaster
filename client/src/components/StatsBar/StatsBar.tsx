import { HealthBar } from '../HealthBar/HealthBar';
import './StatsBar.css';

interface StatsBarProps {
  health: number;
  wpm: number;
  stormSpeed: number;
  matchTime: number;
}

export const StatsBar = ({ health, wpm, stormSpeed, matchTime }: StatsBarProps) => {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="stats-bar">
      <div className="health">
        <HealthBar health={health}/>
      </div>
      
      <div className="stats">
        <div className="stat-group">
            <span className="stat-label">CPM</span>
            <span className="stat-value cyan-text">{wpm}</span>
        </div>
        
        <div className="stat-group">
            <span className="stat-label">STORM CPM</span>
            <span className="stat-value red-text">{Math.round(stormSpeed)} CPM</span>
        </div>
        
        <div className="stat-group">
            <span className="stat-label">TIME</span>
            <span className="stat-value">{formatTime(matchTime)}</span>
        </div>
      </div>
      
    </div>
  );
};