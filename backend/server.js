const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const AWS = require('aws-sdk');
const { playerOperations, gameOperations } = require('./database/dynamodb');

// Configure AWS
AWS.config.update({
  region: process.env.AWS_REGION || 'us-west-2',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});

const app = express();
const server = http.createServer(app);

// Enable CORS for all routes
app.use((req, res, next) => {
  const allowedOrigins = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['*'];
  const origin = req.headers.origin;
  
  if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
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
        // Update game state in DynamoDB
        try {
          await gameOperations.endGame(roomId, null);
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

      // Create game record in DynamoDB
      try {
        await gameOperations.createGame({
          roomId,
          player1Id: room.player1,
          player2Id: room.player2,
          gameState: room.gameState
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

      // Update game state in DynamoDB
      try {
        await gameOperations.updateGame(roomId, newGameState);
      } catch (error) {
        console.error('Error updating game state in DynamoDB:', error);
      }

      // Broadcast to all players in the room
      io.to(roomId).emit('gameStateUpdate', newGameState);
      console.log(`Game state updated for room ${roomId}`);

      // Check for game end condition
      if (newGameState.gameStatus === 'finished') {
        const winner = newGameState.players.player.energy <= 0 ? 'opponent' : 'player';
        const winnerId = winner === 'player' ? gameStates[roomId].player1 : gameStates[roomId].player2;
        
        try {
          await gameOperations.endGame(roomId, winnerId);
          // Update player statistics
          const loserId = winner === 'player' ? gameStates[roomId].player2 : gameStates[roomId].player1;
          await playerOperations.updatePlayer(winnerId, { $inc: { wins: 1 } });
          await playerOperations.updatePlayer(loserId, { $inc: { losses: 1 } });
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