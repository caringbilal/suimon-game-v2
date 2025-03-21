import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import db from './database/sqlite.js';
import cors from 'cors';
import socketHandlers from './src/socketHandlers.js'; // Updated path

// Initialize SQLite database
await db.initializeDatabase();

// Define Constants from Environment
const PORT = process.env.PORT || 3002;
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS || "https://d2m7rldqkz1v8b.cloudfront.net,http://localhost:3005,http://52.42.119.120:3002";

// Validate CORS
const allowedOrigins = ALLOWED_ORIGINS.split(',')
  .map(origin => origin.trim())
  .filter(origin => origin && /^https?:\/\//.test(origin)); // Ensure origins are non-empty and start with http:// or https://

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
const server = http.createServer(app);

// Initialize Socket.IO
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true
  },
  pingTimeout: 60000,
  pingInterval: 25000,
  connectTimeout: 10000,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  transports: ['websocket', 'polling']
});

// In-memory game states (may be unused since socketHandlers.js manages activeRooms)
const gameStates = {};

// Load active games from database on server start
(async () => {
  try {
    const games = await new Promise((resolve, reject) => {
      db.db.all('SELECT * FROM games WHERE gameState != "ended"', [], (err, rows) => {
        if (err) reject(err);
        resolve(rows);
      });
    });

    games.forEach(game => {
      try {
        const gameState = JSON.parse(game.gameState);
        gameStates[game.gameId] = {
          player1: game.player1Id,
          player2: game.player2Id,
          gameState: gameState,
          createdAt: game.startTime,
        };
      } catch (error) {
        console.error(`Error parsing game state for game ${game.gameId}:`, error);
        db.updateGameState(game.gameId, 'ended').catch(console.error);
      }
    });
    console.log('Loaded active games:', Object.keys(gameStates));
  } catch (error) {
    console.error('Error loading active games:', error);
  }
})();

// Delegate socket handling to socketHandlers.js
io.on('connection', (socket) => {
  console.log('\n=== New Player Connection ===');
  console.log('Socket ID:', socket.id);
  console.log('Query Parameters:', socket.handshake.query);

  socket.playerId = socket.handshake.query.playerId;
  if (socket.playerId) {
    console.log('Player ID:', socket.playerId);
  } else {
    console.log('No Player ID provided in handshake query.');
  }

  socket.on('googleAuth', async (googleData) => {
    try {
      const { googleId, displayName } = googleData;
      let player = await db.getPlayerByGoogleId(googleId);

      if (!player) {
        player = await db.createPlayer({
          playerId: googleId,
          playerName: displayName
        });
        console.log(`New player registered: ${displayName} (${googleId})`);
      } else {
        await db.logoutPlayer(googleId);
        console.log(`Existing player logged in: ${displayName} (${googleId})`);
      }

      socket.playerId = googleId;
      socket.emit('authSuccess', { player });
    } catch (error) {
      console.error('Authentication error:', error);
      socket.emit('error', 'Authentication failed');
    }
  });

  socket.on('logout', async (playerId) => {
    try {
      await db.logoutPlayer(playerId);
      socket.emit('logoutSuccess');
      console.log(`Player ${playerId} logged out`);
    } catch (error) {
      console.error('Logout error:', error);
      socket.emit('error', 'Logout failed');
    }
  });

  const activeRooms = Object.entries(gameStates).map(([roomId, state]) => ({
    roomId,
    player1: state.player1,
    player2: state.player2
  }));
  console.log('\nActive Rooms:', JSON.stringify(activeRooms, null, 2));
  console.log('=== Connection Setup Complete ===\n');

  socket.emit('connected', { id: socket.id });

  const heartbeat = setInterval(() => {
    socket.emit('ping');
  }, 25000);

  socket.on('pong', () => {
    console.log(`Received pong from ${socket.id}`);
  });

  socket.on('disconnect', () => {
    clearInterval(heartbeat);
    console.log(`Player ${socket.id} disconnected`);
  });
});

// Initialize socket handlers
socketHandlers(io);

// API endpoints
app.get('/players', async (req, res) => {
  try {
    const players = await db.getAllPlayers();
    res.json(players);
  } catch (error) {
    console.error('Error fetching players:', error);
    res.status(500).json({ error: 'Failed to fetch players' });
  }
});

app.get('/games', async (req, res) => {
  try {
    const games = await new Promise((resolve, reject) => {
      db.db.all('SELECT * FROM games', [], (err, rows) => {
        if (err) reject(err);
        resolve(rows);
      });
    });
    res.json(games);
  } catch (error) {
    console.error('Error fetching games:', error);
    res.status(500).json({ error: 'Failed to fetch games' });
  }
});

app.post('/players', async (req, res) => {
  try {
    const { playerId, playerName } = req.body;
    if (!playerId || !playerName) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const existingPlayer = await db.getPlayer(playerId);
    if (existingPlayer) {
      await db.logoutPlayer(playerId);
      res.json(existingPlayer);
    } else {
      const newPlayer = await db.createPlayer({ playerId, playerName });
      res.json(newPlayer);
    }

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