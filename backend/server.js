import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import socketHandlers from './src/socketHandlers.js';
import { getAllPlayers, getPlayer, createPlayer, logoutPlayer } from './database/sqlite.js';
import { getAllGames } from './database/games.js';
import { getAllPlayerStats } from './database/players.js';

// Define Constants from Environment
const PORT = process.env.PORT || 3002;
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS || "https://d2m7rldqkz1v8b.cloudfront.net,http://localhost:3005,http://52.42.119.120:3002";

// Validate CORS origins
const allowedOrigins = ALLOWED_ORIGINS.split(',')
  .map(origin => origin.trim())
  .filter(origin => origin && /^https?:\/\//.test(origin));

if (allowedOrigins.length === 0) {
  console.error("No valid URLs passed as origins, CORS will fail. Using default origin: http://localhost:3005");
  allowedOrigins.push('http://localhost:3005'); // Fallback to localhost
}

console.log('Allowed Origins:', allowedOrigins);

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`CORS rejected origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization'],
  credentials: true,
};

const app = express();
app.use(cors(corsOptions));
app.use(express.json());

const server = createServer(app);

// Initialize Socket.IO
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  pingTimeout: 60000,
  pingInterval: 25000,
  connectTimeout: 10000,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  transports: ['websocket', 'polling'],
});

// Delegate all socket handling to socketHandlers.js
socketHandlers(io);

// API endpoints
app.get('/players', async (req, res) => {
  try {
    const players = await getAllPlayerStats(); // Use getAllPlayerStats to include statistics
    res.json(players);
  } catch (error) {
    console.error('Error fetching players:', error);
    res.status(500).json({ error: 'Failed to fetch players' });
  }
});

app.get('/games', async (req, res) => {
  try {
    const games = await getAllGames();
    res.json(games);
  } catch (error) {
    console.error('Error fetching games:', error);
    res.status(500).json({ error: 'Failed to fetch games' });
  }
});

app.post('/players', async (req, res) => {
  try {
    const { playerId, playerName, avatar } = req.body;
    if (!playerId || !playerName) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    let player = await getPlayer(playerId);
    if (player) {
      await logoutPlayer(playerId);
      res.json(player);
    } else {
      player = await createPlayer({ playerId, playerName, avatar });
      res.json(player);
    }

    // Notify connected sockets of the player update
    io.sockets.sockets.forEach(socket => {
      if (socket.playerId === playerId) {
        socket.playerId = playerId;
      }
    });
  } catch (error) {
    console.error('Error registering player:', error);
    res.status(500).json({ error: 'Failed to register player' });
  }
});

server.on('error', (error) => {
  console.error('Server error:', error);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
});