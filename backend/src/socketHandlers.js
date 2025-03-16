const { updatePlayerStats, getPlayer } = require('./players');
const { saveGame, getGame, updateGame } = require('./games');

module.exports = (io) => {
    io.on('connection', (socket) => {
        console.log('a user connected:', socket.id);

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

        socket.on('updateGame', async (gameId, gameState) => {
          try {
            await updateGame(gameId, gameState);
            io.emit('gameUpdated', {gameId: gameId, gameState: gameState});  // Notify other player
          } catch (error) {
            console.error("Error updating game:", error);
            socket.emit('gameUpdateError', 'Failed to update game data.');
          }
        });

        socket.on('getPlayer', async (playerId) => {
          try {
            const player = await getPlayer(playerId);
            socket.emit('playerData', player);
          } catch (error) {
            console.error("Error fetching player:", error);
            socket.emit('playerFetchError', 'Failed to fetch player data.');
          }
        });

        socket.on('disconnect', () => {
            console.log('user disconnected:', socket.id);
        });
    });
};