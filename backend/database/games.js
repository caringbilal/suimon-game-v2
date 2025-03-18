const db = require('./sqlite');

// Create a new game
const createGame = async (gameData) => {
  return await db.createGame(gameData);
};

// Get a game by ID
const getGameById = async (gameId) => {
  return await db.getGame(gameId);
};

// Update game state
const updateGameState = async (gameId, gameState) => {
  return await db.updateGameState(gameId, gameState);
};

// Get all games for a player
const getPlayerGames = async (playerId) => {
  return new Promise((resolve, reject) => {
    db.db.all(
      'SELECT * FROM games WHERE player1Id = ? OR player2Id = ? ORDER BY startTime DESC',
      [playerId, playerId],
      (err, rows) => {
        if (err) reject(err);
        resolve(rows);
      }
    );
  });
};

// Update game winner
const updateGameWinner = async (gameId, winnerId) => {
  return new Promise((resolve, reject) => {
    db.db.run(
      'UPDATE games SET winner = ? WHERE gameId = ?',
      [winnerId, gameId],
      (err) => {
        if (err) reject(err);
        resolve({ gameId, winner: winnerId });
      }
    );
  });
};

// Get recent games with limit
const getRecentGames = async (limit = 10) => {
  return new Promise((resolve, reject) => {
    db.db.all(
      'SELECT * FROM games ORDER BY startTime DESC LIMIT ?',
      [limit],
      (err, rows) => {
        if (err) reject(err);
        resolve(rows);
      }
    );
  });
};

module.exports = {
  createGame,
  getGameById,
  updateGameState,
  getPlayerGames,
  updateGameWinner,
  getRecentGames
};