const { updatePlayerStats, getPlayer, getPlayerStats, createPlayer } = require('../database/players');
const { saveGame, getGame, updateGame, createGame } = require('../database/games');

// Store active game rooms
const activeRooms = new Map();

module.exports = (io) => {
    io.on('connection', (socket) => {
        console.log('a user connected:', socket.id);

        // Handle room creation
        socket.on('createRoom', async (playerData) => {
            try {
                const roomId = `room_${Date.now()}`;
                const player = await getPlayer(playerData.playerId) || await createPlayer(playerData);
                
                activeRooms.set(roomId, {
                    player1: {
                        id: player.playerId,
                        name: player.playerName,
                        socket: socket.id
                    },
                    player2: null,
                    gameState: null
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

                const player = await getPlayer(playerData.playerId) || await createPlayer(playerData);
                
                room.player2 = {
                    id: player.playerId,
                    name: player.playerName,
                    socket: socket.id
                };

                socket.join(roomId);

                // Notify player1 that player2 has joined
                io.to(room.player1.socket).emit('playerJoined', {
                    player2: {
                        id: player.playerId,
                        name: player.playerName
                    }
                });

                // Initialize game state
                const initialGameState = await createGame({
                    player1Id: room.player1.id,
                    player2Id: player.playerId,
                    startTime: Date.now()
                });

                room.gameState = initialGameState;
                
                // Start the game for both players
                io.to(roomId).emit('gameStart', {
                    gameState: initialGameState,
                    players: {
                        player1: room.player1,
                        player2: room.player2
                    }
                });
            } catch (error) {
                console.error('Error joining room:', error);
                socket.emit('roomError', 'Failed to join room');
            }
        });

        socket.on('gameEnded', async (data) => {
            // Assuming data contains player IDs, wins, losses, and game state
            try {
                await updatePlayerStats(data.player1Id, data.player1Wins, data.player1Losses);
                await updatePlayerStats(data.player2Id, data.player2Wins, data.player2Losses);
                await saveGame(data.gameState);  // gameState needs GameID, PlayerIDs, etc.
                io.emit('updateStats', {player1Id: data.player1Id, player2Id: data.player2Id});

            } catch (error) {
                console.error("Error saving game data:", error);
                // Consider emitting an error event to the client
                socket.emit('gameSaveError', 'Failed to save game data.');
            }
        });

        socket.on('getGame', async (gameId) => {
          try {
            const game = await getGame(gameId);
            socket.emit('gameData', game);
          } catch (error) {
            console.error("Error fetching game:", error);
            socket.emit('gameFetchError', 'Failed to fetch game data.');
          }
        });

        socket.on('updateGame', async (data) => {
          try {
            const { roomId, gameState } = data;
            const room = activeRooms.get(roomId);
            
            if (room) {
              room.gameState = gameState;
              await updateGame(gameState.gameId, gameState);
              
              // Broadcast the updated state to all players in the room
              io.to(roomId).emit('gameStateUpdated', gameState);
              
              // Check for game end conditions
              if (gameState.gameStatus === 'finished') {
                const winner = gameState.players.player.energy <= 0 ? 'opponent' : 'player';
                io.to(roomId).emit('gameEnded', {
                  winner,
                  finalState: gameState
                });
                
                // Update player stats
                const player1Wins = winner === 'player' ? 1 : 0;
                const player2Wins = winner === 'opponent' ? 1 : 0;
                await updatePlayerStats(room.player1.id, player1Wins, 1 - player1Wins);
                await updatePlayerStats(room.player2.id, player2Wins, 1 - player2Wins);
                
                // Clean up the room
                activeRooms.delete(roomId);
              }
            }
          } catch (error) {
            console.error("Error updating game:", error);
            socket.emit('gameUpdateError', 'Failed to update game state.');
          }
        });
        
        // Handle card play events
        socket.on('playCard', async (data) => {
          try {
            const { roomId, card, playerRole } = data;
            const room = activeRooms.get(roomId);
            
            if (room && room.gameState) {
              // Update game state with the played card
              const battlefield = room.gameState.battlefield;
              if (playerRole === 'player1') {
                battlefield.player = [card];
              } else {
                battlefield.opponent = [card];
              }
              
              // Broadcast the updated battlefield state
              io.to(roomId).emit('cardPlayed', {
                playerRole,
                card,
                battlefield
              });
            }
          } catch (error) {
            console.error("Error handling card play:", error);
            socket.emit('playCardError', 'Failed to process card play.');
          }
        });

        socket.on('getPlayer', async (playerId) => {
          try {
            let player = await getPlayer(playerId);
            const playerStats = await getPlayerStats(playerId);
            
            if (player) {
              socket.emit('playerData', { 
                ...player,
                stats: playerStats || { totalGames: 0, wins: 0, losses: 0, winRate: '0.00' }
              });
            } else {
              socket.emit('playerFetchError', 'Player not found');
            }
          } catch (error) {
            console.error("Error fetching player:", error);
            socket.emit('playerFetchError', 'Failed to fetch player data.');
          }
        });

        socket.on('disconnect', () => {
            console.log('user disconnected:', socket.id);
            
            // Clean up disconnected player's room
            for (const [roomId, room] of activeRooms.entries()) {
                if (room.player1?.socket === socket.id || room.player2?.socket === socket.id) {
                    io.to(roomId).emit('playerDisconnected', {
                        message: 'Opponent disconnected',
                        disconnectedPlayer: room.player1?.socket === socket.id ? 'player1' : 'player2'
                    });
                    activeRooms.delete(roomId);
                    break;
                }
            }
        });
    });
};