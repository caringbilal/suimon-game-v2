const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const db = require('./database/sqlite');
const cors = require('cors');

// Initialize SQLite database
db.initializeDatabase().catch(console.error);

const app = express();
app.use(cors());
app.use(express.json());
const server = http.createServer(app);

// Player registration endpoint

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
    // Use the db.db.all method to query the database
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

// Player registration endpoint

// Player registration endpoint
app.post('/players', async (req, res) => {
  try {
    const { playerId, playerName } = req.body;
    if (!playerId || !playerName) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const existingPlayer = await db.getPlayer(playerId);
    if (existingPlayer) {
      // Update existing player
      await db.logoutPlayer(playerId);
      res.json(existingPlayer);
    } else {
      // Create new player
      const newPlayer = await db.createPlayer({ playerId, playerName });
      res.json(newPlayer);
    }
    
    // Store the player ID in any active socket connections for this player
    // This will be used to associate socket IDs with player IDs
    io.sockets.sockets.forEach(socket => {
      if (socket.handshake.query && socket.handshake.query.playerId === playerId) {
        socket.playerId = playerId;
      }
    });
  } catch (error) {
    console.error('Error registering player:', error);
    res.status(500).json({ error: 'Failed to register player' });
  }
});

// Define PORT constant once - using a different port to avoid conflicts
const PORT = process.env.PORT || 3002;

const io = socketIo(server, {
  cors: {
    origin: '*',
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

const gameStates = {};

function generateUniqueRoomId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

io.on('connection', (socket) => {
  console.log('A player connected:', socket.id);
  console.log('Current game states on connection:', JSON.stringify(gameStates, null, 2));

  // Store player ID in socket if provided in handshake query
  if (socket.handshake.query && socket.handshake.query.playerId) {
    socket.playerId = socket.handshake.query.playerId;
    console.log(`Associated socket ${socket.id} with player ${socket.playerId}`);
  }

  // Send initial connection success event
  socket.emit('connected', { id: socket.id });

  // Handle player disconnection
  socket.on('disconnect', async (reason) => {
    console.log(`Player ${socket.id} disconnected. Reason: ${reason}`);
    for (const roomId in gameStates) {
      const room = gameStates[roomId];
      if (room.player1 === socket.id || room.player2 === socket.id) {
        console.log(`Cleaning up room ${roomId} due to player ${socket.id} disconnection`);
        io.to(roomId).emit('playerDisconnected', { reason });
        // Update game state in SQLite
        try {
          await db.updateGameState(roomId, 'ended');
        } catch (error) {
          console.error('Error updating game state on disconnect:', error);
        }
        delete gameStates[roomId];
        break;
      }
    }
  });

  // Create a new game room
  socket.on('createRoom', async () => {
    try {
      const roomId = generateUniqueRoomId();
      socket.join(roomId);
      gameStates[roomId] = { player1: socket.id, player2: null, gameState: null };
      console.log(`Room ${roomId} created by player ${socket.id}`);
      socket.emit('roomCreated', roomId);
    } catch (error) {
      console.error('Error creating room:', error);
      socket.emit('error', 'Failed to create room. Please try again.');
    }
  });

  // Join an existing game room
  socket.on('joinRoom', async (roomId) => {
    console.log(`Player ${socket.id} attempting to join room: ${roomId}`);

    try {
      if (!roomId || typeof roomId !== 'string') {
        throw new Error('Invalid room ID');
      }

      if (!gameStates[roomId]) {
        throw new Error('Room does not exist');
      }

      const room = gameStates[roomId];

      if (room.player1 === socket.id) {
        throw new Error('Cannot join your own room');
      }

      if (room.player2) {
        throw new Error('Room is full');
      }

      // Join the room
      await socket.join(roomId);
      room.player2 = socket.id;
      console.log(`Player 2 (${socket.id}) successfully joined room ${roomId}`);

      // Create game record in SQLite
      try {
        // Get player information from socket IDs to store player names
        const player1Socket = io.sockets.sockets.get(room.player1);
        const player2Socket = io.sockets.sockets.get(room.player2);
        
        // Create the game with player IDs
        await db.createGame({
          gameId: roomId,
          player1Id: player1Socket?.playerId || room.player1,
          player2Id: player2Socket?.playerId || room.player2,
          gameState: 'active'
        });
      } catch (error) {
        console.error('Error creating game record:', error);
      }

      // Notify both players about the successful join
      io.to(roomId).emit('joinSuccess', roomId);
      
      // Ensure both players have the latest game state
      if (room.gameState) {
        io.to(roomId).emit('gameStateUpdate', room.gameState);
      }

      // Wait briefly to ensure both clients are ready, then start the game
      setTimeout(() => {
        io.to(roomId).emit('startGame', roomId);
        console.log(`Game started in room ${roomId} with players: ${room.player1}, ${room.player2}`);
      }, 1000);

    } catch (error) {
      console.error(`Error joining room: ${error.message}`);
      socket.emit('error', error.message);
    }
  });

  // Handle game state updates from Player 1
  socket.on('updateGameState', async (roomId, newGameState) => {
    try {
      if (!gameStates[roomId]) {
        throw new Error('Room not found');
      }

      // Update the server-side game state
      gameStates[roomId].gameState = newGameState;

      // Update game state in SQLite
      try {
        await db.updateGameState(roomId, JSON.stringify(newGameState));
      } catch (error) {
        console.error('Error updating game state in SQLite:', error);
      }

      // Broadcast to all players in the room
      io.to(roomId).emit('gameStateUpdate', newGameState);
      console.log(`Game state updated for room ${roomId}`);

      // Check for game end condition
      if (newGameState.gameStatus === 'finished') {
        const winner = newGameState.players.player.energy <= 0 ? 'opponent' : 'player';
        const winnerSocketId = winner === 'player' ? gameStates[roomId].player1 : gameStates[roomId].player2;
        
        try {
          // Get the winner's socket to access their player ID
          const winnerSocket = io.sockets.sockets.get(winnerSocketId);
          const winnerId = winnerSocket?.playerId || winnerSocketId;
          
          await db.updateGameState(roomId, 'finished');
          await db.updateGameWinner(roomId, winnerId);
          console.log(`Game ${roomId} finished. Winner: ${winnerId}`);
        } catch (error) {
          console.error('Error updating game end state:', error);
        }
      }

    } catch (error) {
      console.error(`Error updating game state: ${error.message}`);
      socket.emit('error', 'Failed to update game state');
    }
  });

  // Handle socket errors
  socket.on('error', (error) => {
    console.error(`Socket ${socket.id} error:`, error);
    socket.emit('error', 'An unexpected error occurred. Please try again.');
  });

  // Heartbeat mechanism to maintain connection health
  const heartbeat = setInterval(() => {
    socket.emit('ping');
  }, 25000);

  socket.on('pong', () => {
    console.log(`Received pong from ${socket.id}`);
  });

  // Clean up heartbeat on disconnect
  socket.on('disconnect', () => {
    clearInterval(heartbeat);
  });
});

// Log server errors
server.on('error', (error) => {
  console.error('Server error:', error);
});

// Start the server (only once at the end of the file)
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
});