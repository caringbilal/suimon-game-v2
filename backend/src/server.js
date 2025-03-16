const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

// Import DynamoDB operations
const { playerOperations, gameOperations } = require('../database/dynamodb');

// Define Constants from Environment
const PORT = process.env.PORT || 3002;
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS || "https://d2m7rldqkz1v8b.cloudfront.net,http://localhost:3005,http://52.42.119.120:3002"; // Set a default

// Validate CORS
const allowedOrigins = ALLOWED_ORIGINS.split(',').map(origin => origin.trim());
if (ALLOWED_ORIGINS === "")
{
    console.log("no URLs passed as origins, CORS will fail and this needs to be fixed");
}

const corsOptions = {
  origin: (origin, callback) => { // Dynamic origin check
      if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
      } else {
          callback(new Error('Not allowed by CORS'));
      }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization'],
  credentials: true,
};

const app = express();
app.use(cors(corsOptions)); // Use the configured corsOptions

const server = http.createServer(app);

// Setup Sockets to work from these requests, also add some config
const io = socketIo(server, {
    cors: {
      origin: allowedOrigins, // Allow multiple origins from env vars
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

const gameStates = {};

function generateUniqueRoomId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

io.on('connection', (socket) => {
  console.log('A player connected:', socket.id);
  console.log('Current game states on connection:', JSON.stringify(gameStates, null, 2));

  socket.emit('connected', { id: socket.id }); // Initial connect success event

  socket.on('disconnect', async (reason) => { // Handle player disconnection
    console.log(`Player ${socket.id} disconnected. Reason: ${reason}`);
    try {
      for (const roomId in gameStates) {
        const room = gameStates[roomId];
        if (room.player1 === socket.id || room.player2 === socket.id) {
          console.log(`Cleaning up room ${roomId} due to player ${socket.id} disconnection`);
          io.to(roomId).emit('playerDisconnected', { reason });
          await gameOperations.endGame(roomId, null); // DynamoDB update
          delete gameStates[roomId];
          break;
        }
      }
    } catch (error) {
      console.error('Error cleaning up on disconnect:', error);
    }
  });

  socket.on('createRoom', async () => {  // Create a new game room
    try {
      const roomId = generateUniqueRoomId();
      await socket.join(roomId);
      gameStates[roomId] = { player1: socket.id, player2: null, gameState: null };
      console.log(`Room ${roomId} created by player ${socket.id}`);
      socket.emit('roomCreated', roomId);
    } catch (error) {
      console.error('Error creating room:', error);
      socket.emit('error', 'Failed to create room. Please try again.');
    }
  });

  socket.on('joinRoom', async (roomId) => {  // Join an existing game room
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

      socket.join(roomId);  // Join the room
      room.player2 = socket.id;
      console.log(`Player 2 (${socket.id}) successfully joined room ${roomId}`);

      // Initialize game state with turn information
      const initialGameState = {
        currentTurn: 'player',  // Player 1 starts first
        gameStatus: 'playing',
        players: {
          player: { energy: 700 },
          opponent: { energy: 700 }
        }
      };
      room.gameState = initialGameState;

      await gameOperations.createGame({ // DynamoDB update
        roomId,
        player1Id: room.player1,
        player2Id: room.player2,
        gameState: initialGameState
      });

      io.to(roomId).emit('joinSuccess', roomId);  // Notify players
      if (room.gameState) { // Ensure both players have the latest game state
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

  socket.on('updateGameState', async (roomId, newGameState) => {  // Handle game state updates
    try {
      if (!gameStates[roomId]) {
        throw new Error('Room not found');
      }

      gameStates[roomId].gameState = newGameState;  // Update server-side state

      await gameOperations.updateGame(roomId, newGameState);

      // Validate and ensure proper turn switching
      if (newGameState.currentTurn === 'player' || newGameState.currentTurn === 'opponent') {
        // Update game status to ensure it's playable
        newGameState.gameStatus = 'playing';
        
        // Determine if the current socket is the active player
        const isPlayer1 = socket.id === gameStates[roomId].player1;
        const isPlayer2 = socket.id === gameStates[roomId].player2;
        const isValidTurn = (isPlayer1 && newGameState.currentTurn === 'player') || (isPlayer2 && newGameState.currentTurn === 'opponent');
        
        if (!isValidTurn) {
          socket.emit('error', 'Not your turn');
          return;
        }
        
        // Switch turns after valid move
        newGameState.currentTurn = newGameState.currentTurn === 'player' ? 'opponent' : 'player';
        
        // Broadcast updated state to all players
        io.to(roomId).emit('gameStateUpdate', newGameState);
        console.log(`Game state updated for room ${roomId}, current turn: ${newGameState.currentTurn}`);
        console.log(`Turn switched from ${socket.id} to ${newGameState.currentTurn === 'player' ? gameStates[roomId].player1 : gameStates[roomId].player2}`);
      } else {
        console.error(`Invalid turn state received: ${newGameState.currentTurn}`);
        socket.emit('error', 'Invalid game state update');
      }

      // Check for game end condition
      if (newGameState.gameStatus === 'finished') {
        const winner = newGameState.players.player.energy <= 0 ? 'opponent' : 'player';
        const winnerId = winner === 'player' ? gameStates[roomId].player1 : gameStates[roomId].player2;
        
        try {
          // Update winner's game, and get player ids from players or game stats
        } catch (error) {
          console.error('Error updating game end state:', error);
        }
      }

    } catch (error) {
      console.error(`Error updating game state: ${error.message}`);
      socket.emit('error', 'Failed to update game state');
    }
  });

  socket.on('error', (error) => {  // Handle socket errors
    console.error(`Socket ${socket.id} error:`, error);
    socket.emit('error', 'An unexpected error occurred. Please try again.');
  });

  const heartbeat = setInterval(() => {  // Heartbeat mechanism
    socket.emit('ping');
  }, 25000);

  socket.on('pong', () => {
    console.log(`Received pong from ${socket.id}`);
  });

  socket.on('disconnect', () => { // Clean up heartbeat on disconnect
    clearInterval(heartbeat);
  });
});

server.on('error', (error) => { // Log server errors
  console.error('Server error:', error);
});

// Start the server with correct variable set
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
});