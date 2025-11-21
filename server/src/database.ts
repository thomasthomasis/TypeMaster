import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

export const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || 'reaction_game',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
});

export async function initDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS players (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      username VARCHAR(50) UNIQUE NOT NULL,
      elo INTEGER DEFAULT 1200,
      games_played INTEGER DEFAULT 0,
      wins INTEGER DEFAULT 0,
      losses INTEGER DEFAULT 0,
      avg_reaction_time INTEGER,
      created_at TIMESTAMP DEFAULT NOW(),
      last_played TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS matches (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      player1_id UUID REFERENCES players(id),
      player2_id UUID REFERENCES players(id),
      winner_id UUID REFERENCES players(id),
      player1_elo_before INTEGER,
      player2_elo_before INTEGER,
      player1_elo_after INTEGER,
      player2_elo_after INTEGER,
      game_mode VARCHAR(20) DEFAULT 'raw',
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_players_elo ON players(elo DESC);
    CREATE INDEX IF NOT EXISTS idx_players_username ON players(username);
  `);
  
  console.log('✅ Database initialized');
}