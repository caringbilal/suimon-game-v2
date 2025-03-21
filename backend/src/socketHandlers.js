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
                const existingOrNewPlayer = await getPlayer(playerData.playerId) || await createPlayer(playerData);
                
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

                const { getInitialHand } = require('../data/monsters');

                // Generate initial hands for both players
                const player1Hand = getInitialHand(4);
                const player2Hand = getInitialHand(4);

                // Create the shared game state
                const sharedGameState = {
                    currentTurn: 'player1',
                    gameStatus: 'playing',
                    playerMaxHealth: 700,
                    opponentMaxHealth: 700,
                    combatLog: [],
                    killCount: { player: 0, opponent: 0 },
                    battlefield: { player: [], opponent: [] }
                };

                // Create perspective-based states for each player
                const player1GameState = {
                    ...sharedGameState,
                    players: {
                        player: { 
                            id: room.player1.id, 
                            energy: 700, 
                            deck: [], 
                            hand: player1Hand.map(card => ({
                                ...card,
                                hp: card.maxHp,
                                id: `${card.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
                            }))
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
                                imageUrl: '/monsters/card-back.png'
                            }))
                        }
                    }
                };

                const player2GameState = {
                    ...sharedGameState,
                    players: {
                        player: { 
                            id: room.player2.id, 
                            energy: 700, 
                            deck: [], 
                            hand: player2Hand.map(card => ({
                                ...card,
                                hp: card.maxHp,
                                id: `${card.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
                            }))
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
                                imageUrl: '/monsters/card-back.png'
                            }))
                        }
                    }
                };

                // Store both perspectives in the room
                room.gameState = {
                    shared: sharedGameState,
                    player1: player1GameState,
                    player2: player2GameState,
                    hands: { player1: player1Hand, player2: player2Hand }
                };
                
                // Emit game start event to both players with their respective views
                io.to(room.player1.socket).emit('gameStart', {
                    gameState: player1GameState,
                    playerRole: 'player1',
                    players: {
                        player1: { id: room.player1.id, name: room.player1.name },
                        player2: { id: room.player2.id, name: room.player2.name }
                    }
                });
                
                io.to(room.player2.socket).emit('gameStart', {
                    gameState: player2GameState,
                    playerRole: 'player2',
                    players: {
                        player1: { id: room.player1.id, name: room.player1.name },
                        player2: { id: room.player2.id, name: room.player2.name }
                    }
                });
                
                // Save the initial game state
                await createGame({
                    gameId: roomId,
                    player1Id: room.player1.id,
                    player2Id: room.player2.id,
                    gameState: JSON.stringify(room.gameState.shared),
                    startTime: Date.now()
                });
            }
             catch (error) {
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
            const { roomId, gameState, playerRole } = data;
            const room = activeRooms.get(roomId);
            
            if (room) {
              // Update the shared game state
              room.gameState.shared = {
                ...room.gameState.shared,
                currentTurn: gameState.currentTurn,
                battlefield: gameState.battlefield,
                gameStatus: gameState.gameStatus,
                killCount: gameState.killCount
              };
              
              // Update player-specific states
              const player1Turn = gameState.currentTurn === 'player' ? 'player' : 'opponent';
              const player2Turn = gameState.currentTurn === 'opponent' ? 'player' : 'opponent';
              
              room.gameState.player1 = {
                ...room.gameState.player1,
                currentTurn: player1Turn,
                battlefield: room.gameState.shared.battlefield
              };
              
              room.gameState.player2 = {
                ...room.gameState.player2,
                currentTurn: player2Turn,
                battlefield: room.gameState.shared.battlefield
              };
              
              // Send updated states to both players
              io.to(room.player1.socket).emit('gameStateUpdated', room.gameState.player1);
              io.to(room.player2.socket).emit('gameStateUpdated', room.gameState.player2);
              let nextTurn;
              if (playerRole === 'player1' && gameState.currentTurn === 'player') {
                nextTurn = 'player2';
              } else if (playerRole === 'player2' && gameState.currentTurn === 'player') {
                nextTurn = 'player1';
              }
              
              // Update the shared state
              room.gameState.shared = {
                ...room.gameState.shared,
                currentTurn: nextTurn,
                gameStatus: gameState.gameStatus,
                battlefield: gameState.battlefield,
                combatLog: gameState.combatLog,
                killCount: gameState.killCount
              };

              // Update the specific player's state
              if (playerRole === 'player1') {
                room.gameState.player1 = gameState;
                room.gameState.hands.player1 = gameState.players.player.hand;
              } else {
                room.gameState.player2 = gameState;
                room.gameState.hands.player2 = gameState.players.player.hand;
              }

              // Create perspective-based states for both players
              // Create placeholder cards for opponent's hand
              const player2HandPlaceholders = room.gameState.hands.player2.map((_, index) => ({
                id: `placeholder-p2-${index}-${Date.now()}`,
                name: 'Hidden Card',
                attack: 0,
                defense: 0,
                hp: 0,
                maxHp: 0,
                imageUrl: '/monsters/card-back.png'
              }));
              
              const player1HandPlaceholders = room.gameState.hands.player1.map((_, index) => ({
                id: `placeholder-p1-${index}-${Date.now()}`,
                name: 'Hidden Card',
                attack: 0,
                defense: 0,
                hp: 0,
                maxHp: 0,
                imageUrl: '/monsters/card-back.png'
              }));
              
              const player1View = {
                ...room.gameState.player1,
                players: {
                  ...room.gameState.player1.players,
                  opponent: {
                    ...room.gameState.player1.players.opponent,
                    hand: player2HandPlaceholders // Use placeholders instead of empty array
                  }
                }
              };

              const player2View = {
                ...room.gameState.player2,
                players: {
                  ...room.gameState.player2.players,
                  opponent: {
                    ...room.gameState.player2.players.opponent,
                    hand: player1HandPlaceholders // Use placeholders instead of empty array
                  }
                }
              };

              // Save the game state to database
              await updateGame(roomId, {
                ...room.gameState.shared,
                hands: room.gameState.hands
              });
              
              // Send perspective-based states to each player
              io.to(room.player1.socket).emit('gameStateUpdated', player1View);
              io.to(room.player2.socket).emit('gameStateUpdated', player2View);
              
              // Check for game end conditions
              if (gameState.gameStatus === 'finished') {
                const winner = gameState.players.player.energy <= 0 ? 'opponent' : 'player';
                io.to(roomId).emit('gameEnded', {
                  winner,
                  finalState: room.gameState.shared
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
              const battlefield = room.gameState.shared.battlefield;
              const playerKey = playerRole === 'player1' ? 'player' : 'opponent';
              battlefield[playerKey] = [card];
              
              // Update the turn in the shared state
              const nextTurn = playerRole === 'player1' ? 'player2' : 'player1';
              room.gameState.shared.currentTurn = nextTurn;
              
              // Update player-specific states with correct perspective
              const player1Turn = nextTurn === 'player1' ? 'player' : 'opponent';
              const player2Turn = nextTurn === 'player2' ? 'player' : 'opponent';
              
              room.gameState.player1.battlefield = battlefield;
              room.gameState.player1.currentTurn = player1Turn;
              room.gameState.player2.battlefield = battlefield;
              room.gameState.player2.currentTurn = player2Turn;
              
              // Create perspective-based states for both players
              // Create placeholder cards for opponent's hand
              const player2HandPlaceholders = room.gameState.hands.player2.map((_, index) => ({
                id: `placeholder-p2-${index}-${Date.now()}`,
                name: 'Hidden Card',
                attack: 0,
                defense: 0,
                hp: 0,
                maxHp: 0,
                imageUrl: '/monsters/card-back.png'
              }));
              
              const player1HandPlaceholders = room.gameState.hands.player1.map((_, index) => ({
                id: `placeholder-p1-${index}-${Date.now()}`,
                name: 'Hidden Card',
                attack: 0,
                defense: 0,
                hp: 0,
                maxHp: 0,
                imageUrl: '/monsters/card-back.png'
              }));
              
              const player1View = {
                ...room.gameState.player1,
                players: {
                  ...room.gameState.player1.players,
                  opponent: {
                    ...room.gameState.player1.players.opponent,
                    hand: player2HandPlaceholders // Use placeholders instead of empty array
                  }
                }
              };

              const player2View = {
                ...room.gameState.player2,
                players: {
                  ...room.gameState.player2.players,
                  opponent: {
                    ...room.gameState.player2.players.opponent,
                    hand: player1HandPlaceholders // Use placeholders instead of empty array
                  }
                }
              };
              
              // Send updated game states to both players
              io.to(room.player1.socket).emit('gameStateUpdated', player1View);
              io.to(room.player2.socket).emit('gameStateUpdated', player2View);
              
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