// SocketHandlers.js
import { updatePlayerStats, getPlayer } from '../database/players.js';
import { saveGame, updateGame, createGame, getGame, getAllGames } from '../database/games.js';
import db, { updateGameWinner } from '../database/sqlite.js';

// Store active game rooms (in-memory for quick access)
const activeRooms = new Map();

// On server startup, mark all existing games as abandoned
const initializeServer = async () => {
  try {
    console.log('=== Server Startup: Cleaning Up Stale Games ===');
    const games = await getAllGames();
    for (const game of games) {
      if (game.status === 'waiting' || game.status === 'playing') {
        console.log(`Marking game ${game.gameId} as abandoned`);
        await updateGame(game.gameId, { status: 'abandoned' });
      }
    }
    console.log('=== Server Startup Complete ===');
  } catch (error) {
    console.error('Error during server startup cleanup:', error);
  }
};

// Run the initialization
initializeServer();

export default (io) => {
  io.on('connection', (socket) => {
    console.log('=== New Player Connection ===');
    console.log('Socket ID:', socket.id);
    console.log('Query Parameters:', socket.handshake.query);
    console.log('Player ID:', socket.handshake.query.playerId);

    // Handle room creation
    socket.on('createRoom', async (playerData) => {
      try {
        console.log('=== Create Room Request ===');
        console.log('Player Data:', playerData);
        console.log('Socket ID:', socket.id);

        if (!playerData || !playerData.playerId || !playerData.playerName) {
          console.error('Invalid player data:', playerData);
          socket.emit('error', 'Invalid player data: Player ID and name are required');
          return;
        }

        // Verify player exists in database
        const player = await getPlayer(playerData.playerId);
        if (!player) {
          console.error('Player not found in database:', playerData.playerId);
          socket.emit('error', 'Player not found. Please try logging in again');
          return;
        }

        const roomId = `room_${Date.now()}`;
        const roomData = {
          player1: {
            id: player.playerId,
            name: player.playerName,
            socket: socket.id,
            avatar: playerData.avatar || player.avatar,
          },
          player2: null,
          gameState: null,
          active: true,
          lastActivity: Date.now(),
        };

        // Store in memory
        activeRooms.set(roomId, roomData);

        // Persist to database
        await createGame({
          gameId: roomId,
          player1Id: player.playerId,
          player2Id: null,
          gameState: JSON.stringify({}),
          startTime: Date.now(),
          status: 'waiting',
        });

        socket.join(roomId);
        console.log(`Room ${roomId} created by Player 1 (${player.playerName}) with socket ID: ${socket.id}`);
        socket.emit('roomCreated', { roomId, player });
      } catch (error) {
        console.error('Error creating room:', error);
        socket.emit('error', 'Failed to create room');
      }
    });

    // Handle joining room
    socket.on('joinRoom', async (data) => {
      try {
        console.log('=== Join Room Request ===');
        console.log('Data:', data);
        console.log('Socket ID:', socket.id);

        if (!data || !data.roomId || !data.playerData) {
          console.error('Invalid join room data:', data);
          socket.emit('error', 'Invalid join room data');
          return;
        }

        const { roomId, playerData } = data;

        // Check if room exists in database
        const game = await getGame(roomId);
        if (!game) {
          console.error(`Room ${roomId} not found in database`);
          socket.emit('error', 'Room does not exist');
          return;
        }

        // Check if room exists in memory
        let room = activeRooms.get(roomId);
        if (!room) {
          console.log(`Room ${roomId} not found in memory`);
          socket.emit('error', 'Room is no longer active. Please ask Player 1 to create a new room.');
          return;
        }

        if (room.player2) {
          console.error(`Room ${roomId} is full`);
          socket.emit('error', 'Room is full');
          return;
        }

        const player = await getPlayer(playerData.playerId);
        if (!player) {
          console.error('Player not found in database:', playerData.playerId);
          socket.emit('error', 'Player not found. Please try logging in again');
          return;
        }

        // Check if Player 1 is disconnected
        if (!room.player1.socket) {
          console.warn(`Player 1 is disconnected for room ${roomId}. Attempting to reconnect.`);
          const player1 = await getPlayer(room.player1.id);
          if (player1) {
            console.log(`Updating Player 1 socket for room ${roomId}`);
            room.player1.socket = socket.id;
          } else {
            console.warn(`Player 1 not found in database for room ${roomId}. Ending game.`);
            socket.emit('error', 'Player 1 is disconnected. The game has ended.');
            activeRooms.delete(roomId);
            await updateGame(roomId, { status: 'abandoned' });
            return;
          }
        }

        room.player2 = {
          id: player.playerId,
          name: playerData.playerName || player.playerName,
          socket: socket.id,
          avatar: playerData.avatar || player.avatar,
        };
        room.lastActivity = Date.now();

        socket.join(roomId);
        console.log(`Player 2 (${player.playerName}) joined room ${roomId} with socket ID: ${socket.id}`);

        // Update database with Player 2's ID
        await updateGame(roomId, {
          player2Id: player.playerId,
          status: 'playing',
        });

        // Notify Player 1 that Player 2 has joined
        io.to(room.player1.socket).emit('playerJoined', {
          player2: {
            id: player.playerId,
            name: playerData.playerName || player.playerName,
            avatar: player.avatar || '',
          },
        });

        // Notify Player 2 of successful join
        socket.emit('joinSuccess', {
          roomId,
          player1: {
            id: room.player1.id,
            name: room.player1.name,
            avatar: room.player1.avatar || '',
          },
        });

        // Emit updated opponent info to each player (send opponent's info to each player)
        console.log(`Emitting updateOpponentInfo to Player 1 (socket: ${room.player1.socket}) with Player 2's info:`, {
          name: room.player2.name,
          avatar: room.player2.avatar,
        });
        io.to(room.player1.socket).emit('updateOpponentInfo', {
          name: room.player2.name,
          avatar: room.player2.avatar || playerData.avatar || '',
        });

        console.log(`Emitting updateOpponentInfo to Player 2 (socket: ${room.player2.socket}) with Player 1's info:`, {
          name: room.player1.name,
          avatar: room.player1.avatar,
        });
        io.to(room.player2.socket).emit('updateOpponentInfo', {
          name: room.player1.name,
          avatar: room.player1.avatar || '',
        });

        // Initialize game state
        const { getInitialHand } = await import('../data/monsters.js');
        const player1Hand = getInitialHand(4);
        const player2Hand = getInitialHand(4);

        console.log('Player 1 Hand:', player1Hand);
        console.log('Player 2 Hand:', player2Hand);

        // Calculate total HP for each player
        const player1TotalHP = player1Hand.reduce((total, card) => total + card.hp, 0);
        const player2TotalHP = player2Hand.reduce((total, card) => total + card.hp, 0);

        // New game state structure with player1 and player2 objects
        const gameState = {
          gameStatus: 'playing',
          currentTurn: 'player1', // Start with Player 1's turn
          battlefield: {
            player1: [],
            player2: [],
          },
          combatLog: [],
          killCount: {
            player1: 0,
            player2: 0,
          },
          player1: {
            id: room.player1.id,
            name: room.player1.name,
            energy: 700,
            deck: [],
            hand: player1Hand.map((card) => ({
              ...card,
              hp: card.maxHp,
              id: `${card.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              imageUrl: `/monsters/${card.id}.png`,
              name: card.id,
            })),
            totalHP: player1TotalHP,
            maxHealth: 700,
          },
          player2: {
            id: room.player2.id,
            name: room.player2.name,
            energy: 700,
            deck: [],
            hand: player2Hand.map((card) => ({
              ...card,
              hp: card.maxHp,
              id: `${card.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              imageUrl: `/monsters/${card.id}.png`,
              name: card.id,
            })),
            totalHP: player2TotalHP,
            maxHealth: 700,
          },
        };

        // Store game state in the room
        room.gameState = {
          shared: gameState,
          hands: { player1: player1Hand, player2: player2Hand }, // Preserve actual hands
        };

        // Emit game state updates to both players
        if (room.player1.socket) {
          console.log(`Emitting gameStateUpdated to Player 1 (socket: ${room.player1.socket})`);
          io.to(room.player1.socket).emit('gameStateUpdated', {
            gameState: {
              ...gameState,
              player2: {
                ...gameState.player2,
                hand: gameState.player2.hand.map((_, index) => ({
                  id: `placeholder-p2-${index}-${Date.now()}`,
                  name: 'Hidden Card',
                  attack: 0,
                  defense: 0,
                  hp: 0,
                  maxHp: 0,
                  imageUrl: '/monsters/card-back.png',
                })),
              },
            },
            playerRole: 'player1',
          });
        } else {
          console.warn(`Player 1 socket is null for room ${roomId}. Cannot emit gameStateUpdated to Player 1.`);
        }

        if (room.player2.socket) {
          console.log(`Emitting gameStateUpdated to Player 2 (socket: ${room.player2.socket})`);
          io.to(room.player2.socket).emit('gameStateUpdated', {
            gameState: {
              ...gameState,
              player1: {
                ...gameState.player1,
                hand: gameState.player1.hand.map((_, index) => ({
                  id: `placeholder-p1-${index}-${Date.now()}`,
                  name: 'Hidden Card',
                  attack: 0,
                  defense: 0,
                  hp: 0,
                  maxHp: 0,
                  imageUrl: '/monsters/card-back.png',
                })),
              },
            },
            playerRole: 'player2',
          });
        } else {
          console.warn(`Player 2 socket is null for room ${roomId}. Cannot emit gameStateUpdated to Player 2.`);
        }

        // Update game state in database
        await updateGame(roomId, {
          gameState: JSON.stringify(gameState),
          status: 'playing',
          hands: { player1: player1Hand, player2: player2Hand },
        });

        // Broadcast to room that game has started
        io.to(roomId).emit('gameStarted', {
          player1: {
            name: room.player1.name,
            avatar: room.player1.avatar || '',
          },
          player2: {
            name: room.player2.name,
            avatar: room.player2.avatar || '',
          },
        });

        await updateGame(roomId, {
          gameState: JSON.stringify(gameState),
          hands: { player1: player1Hand, player2: player2Hand },
          status: 'playing',
        });
      } catch (error) {
        console.error('Error joining room:', error);
        socket.emit('error', 'Failed to join room');
      }
    });

    // Handle reconnection
    socket.on('reconnect', ({ playerId, roomId }) => {
      console.log(`Player ${playerId} is attempting to reconnect to room ${roomId}`);
      const room = activeRooms.get(roomId);
      if (!room) {
        socket.emit('error', 'Room no longer exists');
        return;
      }

      if (room.player1.id === playerId) {
        room.player1.socket = socket.id;
        socket.join(roomId);
        if (room.player2) {
          console.log(`Re-emitting updateOpponentInfo to Player 1 (socket: ${room.player1.socket}) with Player 2's info:`, {
            name: room.player2.name,
            avatar: room.player2.avatar || '',
          });
          io.to(room.player1.socket).emit('updateOpponentInfo', {
            name: room.player2.name,
            avatar: room.player2.avatar || '',
          });
        }
      } else if (room.player2?.id === playerId) {
        room.player2.socket = socket.id;
        socket.join(roomId);
        console.log(`Re-emitting updateOpponentInfo to Player 2 (socket: ${room.player2.socket}) with Player 1's info:`, {
          name: room.player1.name,
          avatar: room.player1.avatar || '',
        });
        io.to(room.player2.socket).emit('updateOpponentInfo', {
          name: room.player1.name,
          avatar: room.player1.avatar || '',
        });
      }

      if (room.gameState) {
        const playerRole = room.player1.id === playerId ? 'player1' : 'player2';
        io.to(socket.id).emit('gameStateUpdated', {
          gameState: {
            ...room.gameState.shared,
            [playerRole === 'player1' ? 'player2' : 'player1']: {
              ...room.gameState.shared[playerRole === 'player1' ? 'player2' : 'player1'],
              hand: room.gameState.hands[playerRole === 'player1' ? 'player2' : 'player1'].map((_, index) => ({
                id: `placeholder-${playerRole === 'player1' ? 'p2' : 'p1'}-${index}-${Date.now()}`,
                name: 'Hidden Card',
                attack: 0,
                defense: 0,
                hp: 0,
                maxHp: 0,
                imageUrl: '/monsters/card-back.png',
              })),
            },
          },
          playerRole,
        });
      }
    });

    // Handle updateGame event (from GameBoard.tsx)
    socket.on('updateGame', async ({ roomId, gameState, playerRole }) => {
      try {
        console.log(`\n=== Updating Game State for Room ${roomId} ===`);
        console.log(`Player ${socket.id} (Role: ${playerRole}) is updating game state`);

        const room = activeRooms.get(roomId);
        if (!room) {
          console.error(`Room ${roomId} not found`);
          socket.emit('error', 'Room not found');
          return;
        }

        room.lastActivity = Date.now();

        // Update the shared game state
        room.gameState.shared = {
          ...room.gameState.shared,
          gameStatus: gameState.gameStatus || 'playing',
          currentTurn: gameState.currentTurn,
          battlefield: gameState.battlefield,
          combatLog: gameState.combatLog,
          killCount: gameState.killCount,
          player1: {
            ...room.gameState.shared.player1,
            energy: gameState.player1.energy,
            totalHP: gameState.player1.totalHP,
            hand: room.gameState.hands.player1, // Preserve Player 1's actual hand
          },
          player2: {
            ...room.gameState.shared.player2,
            energy: gameState.player2.energy,
            totalHP: gameState.player2.totalHP,
            hand: room.gameState.hands.player2, // Preserve Player 2's actual hand
          },
        };

        // Emit updated game states to both players
        if (room.player1.socket) {
          console.log(`Emitting gameStateUpdated to Player 1 (socket: ${room.player1.socket})`);
          io.to(room.player1.socket).emit('gameStateUpdated', {
            gameState: {
              ...room.gameState.shared,
              player2: {
                ...room.gameState.shared.player2,
                hand: room.gameState.hands.player2.map((_, index) => ({
                  id: `placeholder-p2-${index}-${Date.now()}`,
                  name: 'Hidden Card',
                  attack: 0,
                  defense: 0,
                  hp: 0,
                  maxHp: 0,
                  imageUrl: '/monsters/card-back.png',
                })),
              },
            },
            playerRole: 'player1',
          });
        }

        if (room.player2.socket) {
          console.log(`Emitting gameStateUpdated to Player 2 (socket: ${room.player2.socket})`);
          io.to(room.player2.socket).emit('gameStateUpdated', {
            gameState: {
              ...room.gameState.shared,
              player1: {
                ...room.gameState.shared.player1,
                hand: room.gameState.hands.player1.map((_, index) => ({
                  id: `placeholder-p1-${index}-${Date.now()}`,
                  name: 'Hidden Card',
                  attack: 0,
                  defense: 0,
                  hp: 0,
                  maxHp: 0,
                  imageUrl: '/monsters/card-back.png',
                })),
              },
            },
            playerRole: 'player2',
          });
        }

        // Save the game state to database
        await updateGame(roomId, {
          gameState: JSON.stringify(room.gameState.shared),
          hands: room.gameState.hands,
          status: gameState.gameStatus || 'playing',
        });

        // Check for game end conditions
        if (gameState.gameStatus === 'finished') {
          console.log(`Game ${roomId} has finished`);
          const winner = gameState.player1.energy <= 0 ? 'player2' : 'player1';
          const winnerId = winner === 'player1' ? room.player1.id : room.player2.id;
          const winnerName = winner === 'player1' ? room.player1.name : room.player2.name;

          io.to(roomId).emit('gameEnded', {
            winner,
            finalState: room.gameState.shared,
          });

          // Update player stats
          const player1Wins = winner === 'player1' ? 1 : 0;
          const player2Wins = winner === 'player2' ? 1 : 0;
          await updatePlayerStats(room.player1.id, player1Wins, 1 - player1Wins);
          await updatePlayerStats(room.player2.id, player2Wins, 1 - player2Wins);

          // Update game winner in the database
          await updateGameWinner(roomId, winnerId, winnerName);

          // Clean up the room
          activeRooms.delete(roomId);
          await updateGame(roomId, { status: 'finished' });
        }
      } catch (error) {
        console.error('Error updating game:', error);
        socket.emit('error', 'Failed to update game state');
      }
    });

    // Handle cardPlayed event (from GameBoard.tsx)
    socket.on('cardPlayed', async ({ roomId, card, playerRole }) => {
      try {
        console.log(`\n=== Card Played in Room ${roomId} ===`);
        console.log(`Player ${socket.id} (Role: ${playerRole}) played card:`, card);

        const room = activeRooms.get(roomId);
        if (!room || !room.gameState) {
          console.error(`Room ${roomId} not found or game state missing`);
          socket.emit('error', 'Room not found');
          return;
        }

        room.lastActivity = Date.now();

        // Validate turn
        if (room.gameState.shared.currentTurn !== playerRole) {
          console.error(
            `Invalid turn: Player ${socket.id} tried to play during ${room.gameState.shared.currentTurn}'s turn`
          );
          socket.emit('error', 'Not your turn');
          return;
        }

        // Ensure the card has a valid imageUrl and name
        const updatedCard = {
          ...card,
          imageUrl: card.imageUrl || `/monsters/${card.id}.png`,
          name: card.name || card.id,
        };

        // Update battlefield
        if (playerRole === 'player1') {
          room.gameState.shared.battlefield.player1 = [updatedCard];
          room.gameState.hands.player1 = room.gameState.hands.player1.filter((c) => c.id !== card.id);
          room.gameState.shared.player1.hand = room.gameState.hands.player1;
          room.gameState.shared.player1.totalHP = room.gameState.hands.player1.reduce((total, card) => total + card.hp, 0);
        } else {
          room.gameState.shared.battlefield.player2 = [updatedCard];
          room.gameState.hands.player2 = room.gameState.hands.player2.filter((c) => c.id !== card.id);
          room.gameState.shared.player2.hand = room.gameState.hands.player2;
          room.gameState.shared.player2.totalHP = room.gameState.hands.player2.reduce((total, card) => total + card.hp, 0);
        }

        console.log(`Updated battlefield for ${playerRole}:`, room.gameState.shared.battlefield);

        // Check if player's hand is empty and they have energy left
        const { getInitialHand } = await import('../data/monsters.js');
        if (playerRole === 'player1' && room.gameState.hands.player1.length === 0 && room.gameState.shared.player1.energy > 0) {
          const newHand = getInitialHand(4);
          room.gameState.hands.player1 = newHand.map((card) => ({
            ...card,
            hp: card.maxHp,
            id: `${card.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            imageUrl: `/monsters/${card.id}.png`,
            name: card.id,
          }));
          room.gameState.shared.player1.hand = room.gameState.hands.player1;
          room.gameState.shared.player1.totalHP = room.gameState.hands.player1.reduce((total, card) => total + card.hp, 0);
        } else if (playerRole === 'player2' && room.gameState.hands.player2.length === 0 && room.gameState.shared.player2.energy > 0) {
          const newHand = getInitialHand(4);
          room.gameState.hands.player2 = newHand.map((card) => ({
            ...card,
            hp: card.maxHp,
            id: `${card.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            imageUrl: `/monsters/${card.id}.png`,
            name: card.id,
          }));
          room.gameState.shared.player2.hand = room.gameState.hands.player2;
          room.gameState.shared.player2.totalHP = room.gameState.hands.player2.reduce((total, card) => total + card.hp, 0);
        }

        // Update shared game state with turn switch
        room.gameState.shared.currentTurn = room.gameState.shared.currentTurn === 'player1' ? 'player2' : 'player1';
        console.log(`Turn switched to ${room.gameState.shared.currentTurn}`);

        // Emit updated game states to both players
        if (room.player1.socket) {
          console.log(`Emitting gameStateUpdated to Player 1 (socket: ${room.player1.socket})`);
          io.to(room.player1.socket).emit('gameStateUpdated', {
            gameState: {
              ...room.gameState.shared,
              player2: {
                ...room.gameState.shared.player2,
                hand: room.gameState.hands.player2.map((_, index) => ({
                  id: `placeholder-p2-${index}-${Date.now()}`,
                  name: 'Hidden Card',
                  attack: 0,
                  defense: 0,
                  hp: 0,
                  maxHp: 0,
                  imageUrl: '/monsters/card-back.png',
                })),
              },
            },
            playerRole: 'player1',
          });
        }

        if (room.player2.socket) {
          console.log(`Emitting gameStateUpdated to Player 2 (socket: ${room.player2.socket})`);
          io.to(room.player2.socket).emit('gameStateUpdated', {
            gameState: {
              ...room.gameState.shared,
              player1: {
                ...room.gameState.shared.player1,
                hand: room.gameState.hands.player1.map((_, index) => ({
                  id: `placeholder-p1-${index}-${Date.now()}`,
                  name: 'Hidden Card',
                  attack: 0,
                  defense: 0,
                  hp: 0,
                  maxHp: 0,
                  imageUrl: '/monsters/card-back.png',
                })),
              },
            },
            playerRole: 'player2',
          });
        }

        // Save the game state to database
        await updateGame(roomId, {
          gameState: JSON.stringify(room.gameState.shared),
          hands: room.gameState.hands,
        });

        // Broadcast the updated battlefield state
        io.to(roomId).emit('cardPlayed', {
          playerRole,
          card: updatedCard,
          battlefield: room.gameState.shared.battlefield,
        });
      } catch (error) {
        console.error('Error handling card play:', error);
        socket.emit('error', 'Failed to process card play');
      }
    });

    // Handle restartGame event (from GameBoard.tsx)
    socket.on('restartGame', async ({ roomId, playerRole }) => {
      try {
        console.log(`\n=== Restarting Game for Room ${roomId} ===`);
        console.log(`Player ${socket.id} (Role: ${playerRole}) requested a game restart`);

        const room = activeRooms.get(roomId);
        if (!room) {
          console.error(`Room ${roomId} not found`);
          socket.emit('error', 'Room not found');
          return;
        }

        room.lastActivity = Date.now();

        // Generate new hands for both players
        const { getInitialHand } = await import('../data/monsters.js');
        const player1Hand = getInitialHand(4);
        const player2Hand = getInitialHand(4);

        // Calculate total HP for each player
        const player1TotalHP = player1Hand.reduce((total, card) => total + card.hp, 0);
        const player2TotalHP = player2Hand.reduce((total, card) => total + card.hp, 0);

        // Reset the shared game state
        const gameState = {
          gameStatus: 'playing',
          currentTurn: 'player1',
          battlefield: { player1: [], player2: [] },
          combatLog: [],
          killCount: { player1: 0, player2: 0 },
          player1: {
            id: room.player1.id,
            name: room.player1.name,
            energy: 700,
            deck: [],
            hand: player1Hand.map((card) => ({
              ...card,
              hp: card.maxHp,
              id: `${card.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              imageUrl: `/monsters/${card.id}.png`,
              name: card.id,
            })),
            totalHP: player1TotalHP,
            maxHealth: 700,
          },
          player2: {
            id: room.player2.id,
            name: room.player2.name,
            energy: 700,
            deck: [],
            hand: player2Hand.map((card) => ({
              ...card,
              hp: card.maxHp,
              id: `${card.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              imageUrl: `/monsters/${card.id}.png`,
              name: card.id,
            })),
            totalHP: player2TotalHP,
            maxHealth: 700,
          },
        };

        // Update room game state
        room.gameState = {
          shared: gameState,
          hands: { player1: player1Hand, player2: player2Hand },
        };

        // Emit game state updates to both players
        if (room.player1.socket) {
          io.to(room.player1.socket).emit('gameStateUpdated', {
            gameState: {
              ...gameState,
              player2: {
                ...gameState.player2,
                hand: gameState.player2.hand.map((_, index) => ({
                  id: `placeholder-p2-${index}-${Date.now()}`,
                  name: 'Hidden Card',
                  attack: 0,
                  defense: 0,
                  hp: 0,
                  maxHp: 0,
                  imageUrl: '/monsters/card-back.png',
                })),
              },
            },
            playerRole: 'player1',
          });
        }

        if (room.player2.socket) {
          io.to(room.player2.socket).emit('gameStateUpdated', {
            gameState: {
              ...gameState,
              player1: {
                ...gameState.player1,
                hand: gameState.player1.hand.map((_, index) => ({
                  id: `placeholder-p1-${index}-${Date.now()}`,
                  name: 'Hidden Card',
                  attack: 0,
                  defense: 0,
                  hp: 0,
                  maxHp: 0,
                  imageUrl: '/monsters/card-back.png',
                })),
              },
            },
            playerRole: 'player2',
          });
        }

        // Save the updated game state to the database
        await updateGame(roomId, {
          gameState: JSON.stringify(room.gameState.shared),
          hands: room.gameState.hands,
          status: 'playing',
        });
      } catch (error) {
        console.error('Error restarting game:', error);
        socket.emit('error', 'Failed to restart game');
      }
    });

    // Handle gameEnded event
    socket.on('gameEnded', async (data) => {
      try {
        const { roomId, player1Id, player2Id, player1Wins, player1Losses, player2Wins, player2Losses, gameState } = data;
        await updatePlayerStats(player1Id, player1Wins, player1Losses);
        await updatePlayerStats(player2Id, player2Wins, player2Losses);
        await saveGame(gameState);

        // Update the winner in the database
        const room = activeRooms.get(roomId);
        if (room) {
          const winner = gameState.player1.energy <= 0 ? 'player2' : 'player1';
          const winnerId = winner === 'player1' ? room.player1.id : room.player2.id;
          const winnerName = winner === 'player1' ? room.player1.name : room.player2.name;
          await updateGameWinner(roomId, winnerId, winnerName);
          activeRooms.delete(roomId);
          await updateGame(roomId, { status: 'finished' });
        }
      } catch (error) {
        console.error('Error saving game data:', error);
        socket.emit('error', 'Failed to save game data');
      }
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);

      // Find the room the disconnected player was in
      for (const [roomId, room] of activeRooms.entries()) {
        if (room.player1?.socket === socket.id) {
          console.log(`Player 1 disconnected from room ${roomId}. Ending game.`);
          if (room.player2?.socket) {
            io.to(room.player2.socket).emit('playerDisconnected', {
              message: 'Player 1 disconnected. Game ended.',
              disconnectedPlayer: 'player1',
            });
          }
          activeRooms.delete(roomId);
          updateGame(roomId, { status: 'abandoned' });
        } else if (room.player2?.socket === socket.id) {
          console.log(`Player 2 disconnected from room ${roomId}. Ending game.`);
          if (room.player1?.socket) {
            io.to(room.player1.socket).emit('playerDisconnected', {
              message: 'Player 2 disconnected. Game ended.',
              disconnectedPlayer: 'player2',
            });
          }
          activeRooms.delete(roomId);
          updateGame(roomId, { status: 'abandoned' });
        }
      }
    });
  });
};