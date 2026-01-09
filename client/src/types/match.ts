export interface PlayerState {
  user_id: string;
  username: string;
  caret_position: number;
  danger_caret_position: number;
  danger_speed: number;
  health: number;
  is_alive: boolean;
  score: number;
}

export interface MatchState {
  paragraph: string;
  players: Record<string, PlayerState>;
  match_time: number;
  tick_rate: number;
  base_danger_speed: number;
}