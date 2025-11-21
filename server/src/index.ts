import { Server } from "colyseus";
import { createServer } from "http";
import express from "express";
import cors from "cors";
import { ReactionRoom } from "./rooms/ReactionRoom";

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

gameServer.listen(port, () => {
  console.log(`🚀 Server is listening on port ${port}`);
  console.log(`WebSocket: ws://localhost:${port}`);
});