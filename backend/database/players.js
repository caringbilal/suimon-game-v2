const db = require('./sqlite');

// Get a player by ID
const getPlayerById = async (playerId) => {
  return await db.getPlayer(playerId);
};

// Create a new player
const createPlayer = async (playerData) => {
  return await db.createPlayer(playerData);
};

// Get player statistics
const getPlayerStats = async (playerId) => {
  return new Promise((resolve, reject) => {
    db.db.all(
      `SELECT 
        COUNT(*) as totalGames,
        SUM(CASE WHEN winner = ? THEN 1 ELSE 0 END) as wins,
        SUM(CASE WHEN (player1Id = ? OR player2Id = ?) AND winner != ? THEN 1 ELSE 0 END) as losses
      FROM games 
      WHERE player1Id = ? OR player2Id = ?`,
      [playerId, playerId, playerId, playerId, playerId, playerId],
      (err, rows) => {
        if (err) reject(err);
        const stats = rows[0];
        resolve({
          totalGames: stats.totalGames || 0,
          wins: stats.wins || 0,
          losses: stats.losses || 0,
          winRate: stats.totalGames > 0 ? (stats.wins / stats.totalGames * 100).toFixed(2) : '0.00'
        });
      }
    );
  });
};

// Update player information
const updatePlayer = async (playerId, updateData) => {
  const now = Date.now();
  return new Promise((resolve, reject) => {
    db.db.run(
      'UPDATE players SET playerName = ?, updatedAt = ? WHERE playerId = ?',
      [updateData.playerName, now, playerId],
      (err) => {
        if (err) reject(err);
        resolve({ playerId, ...updateData, updatedAt: now });
      }
    );
  });
};

// Get recent games for a player
const getPlayerRecentGames = async (playerId, limit = 10) => {
  return new Promise((resolve, reject) => {
    db.db.all(
      `SELECT * FROM games 
      WHERE player1Id = ? OR player2Id = ? 
      ORDER BY startTime DESC LIMIT ?`,
      [playerId, playerId, limit],
      (err, rows) => {
        if (err) reject(err);
        resolve(rows);
      }
    );
  });
};

// Get all players
const getAllPlayers = async () => {
  return await db.getAllPlayers();
};

module.exports = {
  getPlayerById,
  createPlayer,
  getPlayerStats,
  updatePlayer,
  getPlayerRecentGames,
  getAllPlayers
};