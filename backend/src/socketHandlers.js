import { updatePlayerStats, getPlayer, getPlayerStats } from '../database/players.js';
import { saveGame, getGame, updateGame, createGame } from '../database/games.js';
import db from '../database/sqlite.js';

// Store active game rooms
const activeRooms = new Map();

export default (io) => {
  io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Handle room creation
    socket.on('createRoom', async (playerData) => {
      try {
        if (!playerData || !playerData.playerId || !playerData.playerName) {
          console.error('Invalid player data:', playerData);
          socket.emit('roomError', 'Invalid player data: Player ID and name are required');
          return;
        }

        // Verify player exists in database
        const player = await getPlayer(playerData.playerId);
        if (!player) {
          console.error('Player not found in database:', playerData.playerId);
          socket.emit('roomError', 'Player not found. Please try logging in again');
          return;
        }

        const roomId = `room_${Date.now()}`;
        const existingOrNewPlayer = (await getPlayer(playerData.playerId)) || (await db.createPlayer(playerData));

        activeRooms.set(roomId, {
          player1: {
            id: player.playerId,
            name: player.playerName,
            socket: socket.id,
          },
          player2: null,
          gameState: null,
        });

        socket.join(roomId);
        socket.emit('roomCreated', { roomId, player });
      } catch (error) {
        console.error('Error creating room:', error);
        socket.emit('roomError', 'Failed to create room');
      }
    });

    // Handle joining room
    socket.on('joinRoom', async (data) => {
      try {
        if (!data || !data.roomId || !data.playerData) {
          socket.emit('roomError', 'Invalid join room data');
          return;
        }

        const { roomId, playerData } = data;
        const room = activeRooms.get(roomId);

        if (!room) {
          socket.emit('roomError', 'Room not found');
          return;
        }

        if (room.player2) {
          socket.emit('roomError', 'Room is full');
          return;
        }

        const player = (await getPlayer(playerData.playerId)) || (await db.createPlayer(playerData));

        room.player2 = {
          id: player.playerId,
          name: player.playerName,
          socket: socket.id,
        };

        socket.join(roomId);

        // Notify player1 that player2 has joined
        console.log(`Notifying Player 1 (${room.player1.socket}) that Player 2 (${player.playerName}) has joined`);
        io.to(room.player1.socket).emit('playerJoined', {
          player2: {
            id: player.playerId,
            name: player.playerName,
          },
        });

        // Notify player2 of successful join
        console.log(`Notifying Player 2 (${socket.id}) of successful join to room ${roomId}`);
        socket.emit('joinSuccess', roomId);

        const { getInitialHand } = await import('../data/monsters.js');

        // Generate initial hands for both players
        const player1Hand = getInitialHand(4);
        const player2Hand = getInitialHand(4);

        // Create the shared game state
        const sharedGameState = {
          currentTurn: 'player',
          gameStatus: 'playing',
          playerMaxHealth: 700,
          opponentMaxHealth: 700,
          combatLog: [],
          killCount: { player: 0, opponent: 0 },
          battlefield: { player: [], opponent: [] },
        };

        // Create perspective-based states for each player
        const player1GameState = {
          ...sharedGameState,
          players: {
            player: {
              id: room.player1.id,
              energy: 700,
              deck: [],
              hand: player1Hand.map((card) => ({
                ...card,
                hp: card.maxHp,
                id: `${card.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                imageUrl: `/monsters/${card.id}.png`,
              })),
            },
            opponent: {
              id: room.player2.id,
              energy: 700,
              deck: [],
              hand: player2Hand.map((_, index) => ({
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
        };

        const player2GameState = {
          ...sharedGameState,
          players: {
            player: {
              id: room.player2.id,
              energy: 700,
              deck: [],
              hand: player2Hand.map((card) => ({
                ...card,
                hp: card.maxHp,
                id: `${card.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                imageUrl: `/monsters/${card.id}.png`,
              })),
            },
            opponent: {
              id: room.player1.id,
              energy: 700,
              deck: [],
              hand: player1Hand.map((_, index) => ({
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
          currentTurn: 'opponent', // Player 2's perspective
        };

        // Store both perspectives in the room
        room.gameState = {
          shared: sharedGameState,
          player1: player1GameState,
          player2: player2GameState,
          hands: { player1: player1Hand, player2: player2Hand },
        };

        // Emit game state updates to both players using the correct event
        console.log(`Emitting gameStateUpdated to Player 1 (${room.player1.socket})`);
        io.to(room.player1.socket).emit('gameStateUpdated', {
          gameState: player1GameState,
          playerRole: 'player1',
          players: {
            player1: { id: room.player1.id, name: room.player1.name },
            player2: { id: room.player2.id, name: room.player2.name },
          },
        });

        console.log(`Emitting gameStateUpdated to Player 2 (${room.player2.socket})`);
        io.to(room.player2.socket).emit('gameStateUpdated', {
          gameState: player2GameState,
          playerRole: 'player2',
          players: {
            player1: { id: room.player1.id, name: room.player1.name },
            player2: { id: room.player2.id, name: room.player2.name },
          },
        });

        // Save the initial game state
        await createGame({
          gameId: roomId,
          player1Id: room.player1.id,
          player2Id: room.player2.id,
          gameState: JSON.stringify(room.gameState.shared),
          startTime: Date.now(),
        });
      } catch (error) {
        console.error('Error joining room:', error);
        socket.emit('roomError', 'Failed to join room');
      }
    });

    // Handle updateGame event (from gameboard.tsx)
    socket.on('updateGame', async ({ roomId, gameState, playerRole }) => {
      try {
        console.log(`\n=== Updating Game State for Room ${roomId} ===`);
        console.log(`Player ${socket.id} (Role: ${playerRole}) is updating game state`);

        const room = activeRooms.get(roomId);
        if (!room) {
          console.error(`Room ${roomId} not found`);
          socket.emit('roomError', 'Room not found');
          return;
        }

        // Update the shared game state
        room.gameState.shared = {
          ...room.gameState.shared,
          currentTurn: gameState.currentTurn,
          gameStatus: gameState.gameStatus,
          battlefield: gameState.battlefield,
          combatLog: gameState.combatLog,
          killCount: gameState.killCount,
          players: {
            player: gameState.players.player,
            opponent: gameState.players.opponent,
          },
        };

        // Update player-specific states with correct perspective
        const player1Turn = gameState.currentTurn === 'player' ? 'player' : 'opponent';
        const player2Turn = gameState.currentTurn === 'opponent' ? 'player' : 'opponent';

        room.gameState.player1 = {
          ...room.gameState.player1,
          currentTurn: player1Turn,
          battlefield: gameState.battlefield,
          combatLog: gameState.combatLog,
          killCount: gameState.killCount,
          players: {
            player: gameState.players.player,
            opponent: {
              ...gameState.players.opponent,
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
        };

        room.gameState.player2 = {
          ...room.gameState.player2,
          currentTurn: player2Turn,
          battlefield: gameState.battlefield,
          combatLog: gameState.combatLog,
          killCount: gameState.killCount,
          players: {
            player: gameState.players.opponent,
            opponent: {
              ...gameState.players.player,
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
        };

        // Update hands if necessary
        if (playerRole === 'player1') {
          room.gameState.hands.player1 = gameState.players.player.hand;
        } else {
          room.gameState.hands.player2 = gameState.players.player.hand;
        }

        // Send updated game states to both players
        console.log(`Emitting updated gameState to Player 1 (${room.player1.socket})`);
        io.to(room.player1.socket).emit('gameStateUpdated', room.gameState.player1);
        console.log(`Emitting updated gameState to Player 2 (${room.player2.socket})`);
        io.to(room.player2.socket).emit('gameStateUpdated', room.gameState.player2);

        // Save the game state to database
        await updateGame(roomId, {
          ...room.gameState.shared,
          hands: room.gameState.hands,
        });

        // Check for game end conditions
        if (gameState.gameStatus === 'finished') {
          console.log(`Game ${roomId} has finished`);
          const winner = gameState.players.player.energy <= 0 ? 'opponent' : 'player';
          const winnerId = winner === 'player' ? room.player1.id : room.player2.id;
          const winnerName = winner === 'player' ? room.player1.name : room.player2.name;

          io.to(roomId).emit('gameEnded', {
            winner,
            finalState: room.gameState.shared,
          });

          // Update player stats
          const player1Wins = winner === 'player' ? 1 : 0;
          const player2Wins = winner === 'opponent' ? 1 : 0;
          await updatePlayerStats(room.player1.id, player1Wins, 1 - player1Wins);
          await updatePlayerStats(room.player2.id, player2Wins, 1 - player2Wins);

          // Update game winner in the database
          await db.updateGameWinner(roomId, winnerId, winnerName);

          // Clean up the room
          activeRooms.delete(roomId);
        }
      } catch (error) {
        console.error('Error updating game:', error);
        socket.emit('gameUpdateError', 'Failed to update game state');
      }
    });

    // Handle cardPlayed event (from gameboard.tsx)
    socket.on('cardPlayed', async ({ roomId, card, playerRole }) => {
      try {
        console.log(`\n=== Card Played in Room ${roomId} ===`);
        console.log(`Player ${socket.id} (Role: ${playerRole}) played card: ${card.id}`);

        const room = activeRooms.get(roomId);
        if (!room || !room.gameState) {
          console.error(`Room ${roomId} not found or game state missing`);
          socket.emit('roomError', 'Room not found');
          return;
        }

        const isPlayer1 = playerRole === 'player1';
        const currentPlayerKey = isPlayer1 ? 'player' : 'opponent';
        const opponentPlayerKey = isPlayer1 ? 'opponent' : 'player';

        // Validate turn
        const expectedTurn = isPlayer1 ? 'player' : 'opponent';
        if (room.gameState.shared.currentTurn !== expectedTurn) {
          console.error(
            `Invalid turn: Player ${socket.id} tried to play during ${room.gameState.shared.currentTurn}'s turn`
          );
          socket.emit('error', 'Not your turn');
          return;
        }

        // Update battlefield
        room.gameState.shared.battlefield[currentPlayerKey] = [card];

        // Remove card from player's hand
        if (isPlayer1) {
          room.gameState.hands.player1 = room.gameState.hands.player1.filter((c) => c.id !== card.id);
          room.gameState.player1.players.player.hand = room.gameState.hands.player1;
        } else {
          room.gameState.hands.player2 = room.gameState.hands.player2.filter((c) => c.id !== card.id);
          room.gameState.player2.players.player.hand = room.gameState.hands.player2;
        }

        // Update shared game state
        room.gameState.shared.currentTurn = room.gameState.shared.currentTurn === 'player' ? 'opponent' : 'player';
        console.log(`Turn switched to ${room.gameState.shared.currentTurn}`);

        // Update player-specific states with correct perspective
        const player1Turn = room.gameState.shared.currentTurn === 'player' ? 'player' : 'opponent';
        const player2Turn = room.gameState.shared.currentTurn === 'opponent' ? 'player' : 'opponent';

        room.gameState.player1.currentTurn = player1Turn;
        room.gameState.player1.battlefield = room.gameState.shared.battlefield;
        room.gameState.player1.players.player.hand = room.gameState.hands.player1;
        room.gameState.player1.players.opponent.hand = room.gameState.hands.player2.map((_, index) => ({
          id: `placeholder-p2-${index}-${Date.now()}`,
          name: 'Hidden Card',
          attack: 0,
          defense: 0,
          hp: 0,
          maxHp: 0,
          imageUrl: '/monsters/card-back.png',
        }));

        room.gameState.player2.currentTurn = player2Turn;
        room.gameState.player2.battlefield = room.gameState.shared.battlefield;
        room.gameState.player2.players.player.hand = room.gameState.hands.player2;
        room.gameState.player2.players.opponent.hand = room.gameState.hands.player1.map((_, index) => ({
          id: `placeholder-p1-${index}-${Date.now()}`,
          name: 'Hidden Card',
          attack: 0,
          defense: 0,
          hp: 0,
          maxHp: 0,
          imageUrl: '/monsters/card-back.png',
        }));

        // Send updated game states to both players
        console.log(`Emitting updated gameState to Player 1 (${room.player1.socket}) after card play`);
        io.to(room.player1.socket).emit('gameStateUpdated', room.gameState.player1);
        console.log(`Emitting updated gameState to Player 2 (${room.player2.socket}) after card play`);
        io.to(room.player2.socket).emit('gameStateUpdated', room.gameState.player2);

        // Save the game state to database
        await updateGame(roomId, {
          ...room.gameState.shared,
          hands: room.gameState.hands,
        });

        // Broadcast the updated battlefield state
        io.to(roomId).emit('cardPlayed', {
          playerRole,
          card,
          battlefield: room.gameState.shared.battlefield,
        });
      } catch (error) {
        console.error('Error handling card play:', error);
        socket.emit('playCardError', 'Failed to process card play');
      }
    });

    // Handle playCard event (legacy, redirect to cardPlayed)
    socket.on('playCard', (data) => {
      socket.emit('cardPlayed', data);
    });

    socket.on('gameEnded', async (data) => {
      try {
        const { roomId, player1Id, player2Id, player1Wins, player1Losses, player2Wins, player2Losses, gameState } = data;
        await updatePlayerStats(player1Id, player1Wins, player1Losses);
        await updatePlayerStats(player2Id, player2Wins, player2Losses);
        await saveGame(gameState);

        // Update the winner in the database
        const room = activeRooms.get(roomId);
        if (room) {
          const winner = gameState.players.player.energy <= 0 ? 'opponent' : 'player';
          const winnerId = winner === 'player' ? room.player1.id : room.player2.id;
          const winnerName = winner === 'player' ? room.player1.name : room.player2.name;
          await db.updateGameWinner(roomId, winnerId, winnerName);
        }

        io.emit('updateStats', { player1Id, player2Id });
      } catch (error) {
        console.error('Error saving game data:', error);
        socket.emit('gameSaveError', 'Failed to save game data');
      }
    });

    socket.on('getGame', async (gameId) => {
      try {
        const game = await getGame(gameId);
        socket.emit('gameData', game);
      } catch (error) {
        console.error('Error fetching game:', error);
        socket.emit('gameFetchError', 'Failed to fetch game data');
      }
    });

    socket.on('getPlayer', async (playerId) => {
      try {
        let player = await getPlayer(playerId);
        const playerStats = await getPlayerStats(playerId);

        if (player) {
          socket.emit('playerData', {
            ...player,
            stats: playerStats || { totalGames: 0, wins: 0, losses: 0, winRate: '0.00' },
          });
        } else {
          socket.emit('playerFetchError', 'Player not found');
        }
      } catch (error) {
        console.error('Error fetching player:', error);
        socket.emit('playerFetchError', 'Failed to fetch player data');
      }
    });

    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);

      // Clean up disconnected player's room
      for (const [roomId, room] of activeRooms.entries()) {
        if (room.player1?.socket === socket.id || room.player2?.socket === socket.id) {
          io.to(roomId).emit('playerDisconnected', {
            message: 'Opponent disconnected',
            disconnectedPlayer: room.player1?.socket === socket.id ? 'player1' : 'player2',
          });
          activeRooms.delete(roomId);
          break;
        }
      }
    });
  });
};