import { Server } from "colyseus";
import { createServer } from "http";
import express from "express";
import cors from "cors";
import { ReactionRoom } from "./rooms/ReactionRoom";
import { initDatabase, pool } from "./database";

const port = Number(process.env.PORT) || 2567;
const app = express();

app.use(cors());
app.use(express.json());

const gameServer = createServer(app);
const colyseusServer = new Server({
    server: gameServer,
});

// Register room handlers
colyseusServer.define("reaction_room", ReactionRoom);

// Health check endpoint
app.get("/", (req, res) => {
    res.send("Reaction Game Server is running!");
});

initDatabase().catch(console.error);

gameServer.listen(port, () => {
  console.log(`🚀 Server is listening on port ${port}`);
  console.log(`WebSocket: ws://localhost:${port}`);
});

app.get('/api/leaderboard', async (req, res) => {
    try {
        const result = await pool.query(
            `
            SELECT username, elo, games_played, wins, losses, avg_reaction_time
            FROM players
            WHERE games_played >= 10
            ORDER BY elo DESC
            LIMI 100
            `
        );

        res.json(result.rows);
    }
    catch(error) {
        res.status(500).json({ error: 'Feaild to fetch leaderboard' });
    }
});

app.get('/api/player/:username', async (req, res) => {
  try {
    const { username } = req.params;
    const result = await pool.query(
      'SELECT * FROM players WHERE username = $1',
      [username]
    );
    res.json(result.rows[0] || null);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch player' });
  }
});