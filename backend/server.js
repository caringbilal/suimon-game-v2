const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const db = require('./database/sqlite');
const cors = require('cors');

// Initialize SQLite database
db.initializeDatabase().catch(console.error);

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
app.use(express.json());
const server = http.createServer(app);

// Initialize Socket.IO
const io = socketIo(server, {
  cors: {
    origin: allowedOrigins, // Allow multiple origins from env vars
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

// In-memory game states
const gameStates = {};

// Load active games from database on server start
(async () => { // Using an immediately invoked async function expression
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
                // Consider marking this game as ended in the database to prevent further issues
                db.updateGameState(game.gameId, 'ended').catch(console.error);
            }
        });
        console.log('Loaded active games:', Object.keys(gameStates));
    } catch (error) {
        console.error('Error loading active games:', error);
    }
})();

// Helper function to generate unique room IDs
function generateUniqueRoomId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Socket.IO Connection Handling
io.on('connection', (socket) => {
  console.log('\n=== New Player Connection ===');
  console.log('Socket ID:', socket.id);
  console.log('Query Parameters:', socket.handshake.query);  // Log query parameters

  // Store player ID in socket if provided in handshake query
  socket.playerId = socket.handshake.query.playerId; // Directly assign
  if (socket.playerId) {
    console.log('Player ID:', socket.playerId);
  } else {
    console.log('No Player ID provided in handshake query.');
  }

    // Handle Google authentication (From File 2)
  socket.on('googleAuth', async (googleData) => {
    try {
      const { googleId, displayName } = googleData;

      // Check if user exists
      let player = await db.getPlayerByGoogleId(googleId);

      if (!player) {
        // Create new player if doesn't exist
        player = await db.createPlayer({
          playerId: googleId,
          playerName: displayName
        });
        console.log(`New player registered: ${displayName} (${googleId})`);
      } else {
        // Update existing player's last login
        await db.logoutPlayer(googleId); // This actually updates the updatedAt timestamp
        console.log(`Existing player logged in: ${displayName} (${googleId})`);
      }

      // Store the player ID in the socket for future reference
      socket.playerId = googleId;

      socket.emit('authSuccess', { player });
    } catch (error) {
      console.error('Authentication error:', error);
      socket.emit('error', 'Authentication failed');
    }
  });

  // Handle logout (From File 2)
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

  // Log active rooms and players
  const activeRooms = Object.entries(gameStates).map(([roomId, state]) => ({
    roomId,
    player1: state.player1,
    player2: state.player2
  }));
  console.log('\nActive Rooms:', JSON.stringify(activeRooms, null, 2));
  console.log('=== Connection Setup Complete ===\n');

  // Send initial connection success event
  socket.emit('connected', { id: socket.id });

  // Handle player disconnection
  socket.on('disconnect', async (reason) => {
    console.log(`Player ${socket.id} disconnected. Reason: ${reason}`);

    for (const roomId in gameStates) {
      if (gameStates.hasOwnProperty(roomId)) { // Safe check
        const room = gameStates[roomId];
        if (room.player1 === socket.id || room.player2 === socket.id) {
          console.log(`Cleaning up room ${roomId} due to player ${socket.id} disconnection`);
          io.to(roomId).emit('playerDisconnected', { reason });

          try {
            await db.updateGameState(roomId, 'ended'); // Mark game as ended
          } catch (error) {
            console.error('Error updating game state on disconnect:', error);
          }

          delete gameStates[roomId]; // Remove from memory
          console.log(`Room ${roomId} deleted.`);
          break;
        }
      }
    }
  });

  // Create a new game room
  socket.on('createRoom', async (playerData) => {
    let roomId;
    try {
      console.log('\n=== Creating New Room ===');
      console.log('Player Data:', JSON.stringify(playerData));

      if (!playerData || typeof playerData !== 'object') {
        throw new Error('Invalid player data');
      }

      roomId = generateUniqueRoomId();
      console.log('Generated Room ID:', roomId);

      const createdAt = Date.now();
      const initialGameState = {
        currentTurn: 'player',
        gameStatus: 'waiting',
        players: {
          player: { energy: 700 },
          opponent: { energy: 700 }
        },
        lastUpdate: createdAt
      };

      const gameData = {
        gameId: roomId,
        player1Id: socket.id,
        player2Id: null,
        player1Data: JSON.stringify(playerData), // Store playerData as JSON string
        gameState: JSON.stringify(initialGameState),
        startTime: createdAt //Added start time
      };

      try {
        // 1. Check if room already exists
        const existingGame = await db.getGame(roomId);
        if (existingGame) {
          throw new Error('Room ID collision detected');
        }

        // 2. Store in database first
        await db.createGame(gameData);
        console.log('Game successfully stored in database');

        // 3. Join socket room
        await socket.join(roomId);

        // 4. Store in memory only after database success
        gameStates[roomId] = {
          player1: socket.id,
          player2: null,
          gameState: initialGameState,
          createdAt: createdAt,
          player1Data: playerData
        };

        console.log(`Room ${roomId} created successfully`);
        console.log('Active Rooms:', Object.keys(gameStates));

        // 5. Notify client only after all operations succeed
        socket.emit('roomCreated', roomId);

      } catch (innerError) {
        // Cleanup on failure
        console.error('Error during room creation:', innerError);
        if (gameStates[roomId]) {
          delete gameStates[roomId];
        }
        try {
          await socket.leave(roomId);
          // If database entry was created, mark it as ended
          const existingGame = await db.getGame(roomId);
          if (existingGame) {
            await db.updateGameState(roomId, 'ended');
          }
        } catch (cleanupError) {
          console.error('Error during cleanup:', cleanupError);
        }
        socket.emit('error', 'Failed to create room due to an error.'); // Inform client
        return; // Important: Exit the function after emitting the error
      }
    } catch (error) {
      console.error('Error creating room:', error);
      socket.emit('error', 'Failed to create room. Please try again.');
    }
  });

  // Join an existing game room
  socket.on('joinRoom', async (roomId) => {
    console.log('\n=== Player Joining Room ===');
    console.log(`Player ${socket.id} attempting to join room: ${roomId}`);

    try {
      if (!roomId || typeof roomId !== 'string') {
        throw new Error('Invalid room ID');
      }

      let room = gameStates[roomId];
      let dbGame = null;

      // Check both in-memory state and database for room existence
      try {
        dbGame = await db.getGame(roomId);
      } catch (dbError) {
        console.error('Database error while fetching game:', dbError);
        throw new Error('Failed to verify room status');
      }

      // If room not in memory but exists in database and is not ended
      if (!room && dbGame && dbGame.gameState !== 'ended') {
        try {
            const gameState = JSON.parse(dbGame.gameState);
            const player1Data = JSON.parse(dbGame.player1Data); // Parse player1Data from DB
            room = {
                player1: dbGame.player1Id,
                player2: dbGame.player2Id,
                gameState: gameState,
                createdAt: dbGame.startTime,
                player1Data: player1Data // Use parsed player1Data
            };
            gameStates[roomId] = room;
            console.log(`Restored room ${roomId} from database`);
        } catch (parseError) {
            console.error(`Error parsing game state for room ${roomId}:`, parseError);
            throw new Error('Invalid game state');
        }
      }

      if (!room || !dbGame) {
        console.log(`Room ${roomId} not found in memory or database`);
        throw new Error('Room does not exist');
      }

      if (room.player1 === socket.id) {
        throw new Error('Cannot join your own room');
      }

      if (room.player2) {
        throw new Error('Room is full');
      }

      console.log('Room available for joining, adding player2...');
      await socket.join(roomId);
      room.player2 = socket.id;

      const updatedGameState = {
        ...room.gameState,
        gameStatus: 'active'
      };

      gameStates[roomId].gameState = updatedGameState; // Update in memory
      console.log('Updated room state:', JSON.stringify(gameStates[roomId], null, 2));

      // Update the database with player2Id and the updated game state
      try {
        await db.db.run(
            'UPDATE games SET player2Id = ?, gameState = ? WHERE gameId = ?',
            [socket.id, JSON.stringify(updatedGameState), roomId]
        );
        console.log(`Updated game state and player2 for room ${roomId} with player2 (${socket.id})`);
      } catch (dbUpdateError) {
          console.error('Database error updating game state:', dbUpdateError);
          socket.emit('error', 'Failed to update game state in the database.');
          return;
      }

      io.to(roomId).emit('joinSuccess', roomId); // Notify clients
      io.to(roomId).emit('gameStateUpdate', updatedGameState); // Send the updated game state

      setTimeout(() => {
        io.to(roomId).emit('startGame', roomId); // Start game after a delay
        console.log(`Game started in room ${roomId} with players: ${room.player1}, ${room.player2}`);
      }, 1000);

    } catch (error) {
      console.error(`Error joining room: ${error.message}`);
      socket.emit('error', error.message);
    }
  });

  // Handle game state updates
  socket.on('updateGameState', async (roomId, newGameState) => {
    try {
      if (!gameStates[roomId]) {
        throw new Error('Room not found');
      }

      gameStates[roomId].gameState = newGameState; // Update in-memory state

            // Validate and ensure proper turn switching (From File 2 - enhanced)
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

      try {
        await db.updateGameState(roomId, JSON.stringify(newGameState)); // Update database
      } catch (error) {
        console.error('Error updating game state in SQLite:', error);
      }

      io.to(roomId).emit('gameStateUpdate', newGameState); // Broadcast update
      console.log(`Game state updated for room ${roomId}`);

            // Check for game end condition (From File 2 - enhanced)
      if (newGameState.gameStatus === 'finished') {
        const winner = newGameState.players.player.energy <= 0 ? 'opponent' : 'player';
        const winnerId = winner === 'player' ? gameStates[roomId].player1 : gameStates[roomId].player2;

        try {
          await db.updateGameState(roomId, 'finished');
          await db.updateGameWinner(roomId, winnerId);
          console.log(`Game ${roomId} finished. Winner: ${winnerId}`);

          // Send personalized game result to each player
          io.to(gameStates[roomId].player1).emit('gameStateUpdate', {
            ...newGameState,
            winner: winner === 'player' ? 'player' : 'opponent'
          });
          io.to(gameStates[roomId].player2).emit('gameStateUpdate', {
            ...newGameState,
            winner: winner === 'player' ? 'opponent' : 'player'
          });
          return; // Skip the general broadcast
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

  // Heartbeat mechanism
  const heartbeat = setInterval(() => {
    socket.emit('ping');
  }, 25000);

  socket.on('pong', () => {
    console.log(`Received pong from ${socket.id}`);
  });

  socket.on('disconnect', () => {
    clearInterval(heartbeat);
  });
});

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

// Player registration endpoint
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

        //Find and update sockets associated with this player id
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

// Log server errors
server.on('error', (error) => {
  console.error('Server error:', error);
});

// Start the server
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
});