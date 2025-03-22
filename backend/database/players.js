import db, { getPlayer } from './sqlite.js';

// Update player stats (wins and losses)
export const updatePlayerStats = async (playerId, winsToAdd, lossesToAdd) => {
  return new Promise((resolve, reject) => {
    db.run(
      'UPDATE players SET wins = wins + ?, losses = losses + ?, updatedAt = ? WHERE playerId = ?',
      [winsToAdd, lossesToAdd, Date.now(), playerId],
      function (err) {
        if (err) {
          console.error('Error updating player stats:', err);
          reject(err);
        } else {
          console.log(`Updated stats for player ${playerId}: +${winsToAdd} wins, +${lossesToAdd} losses`);
          resolve();
        }
      }
    );
  });
};

// Get player statistics
export const getPlayerStats = async (playerId) => {
  return new Promise((resolve, reject) => {
    db.get(
      'SELECT playerId, playerName, createdAt, wins, losses FROM players WHERE playerId = ?',
      [playerId],
      (err, row) => {
        if (err) {
          console.error('Error fetching player stats:', err);
          reject(err);
        } else if (!row) {
          reject(new Error(`Player ${playerId} not found`));
        } else {
          const totalGames = row.wins + row.losses;
          const winRate = totalGames > 0 ? (row.wins / totalGames) * 100 : 0;
          resolve({
            playerId: row.playerId,
            playerName: row.playerName,
            createdAt: row.createdAt,
            totalGames,
            wins: row.wins,
            losses: row.losses,
            winRate: winRate.toFixed(1),
          });
        }
      }
    );
  });
};

// Get all players with their statistics
export const getAllPlayerStats = async () => {
  return new Promise((resolve, reject) => {
    db.all('SELECT playerId, playerName, createdAt, wins, losses FROM players', [], (err, rows) => {
      if (err) {
        console.error('Error fetching all player stats:', err);
        reject(err);
      } else {
        const stats = rows.map((row) => {
          const totalGames = row.wins + row.losses;
          const winRate = totalGames > 0 ? (row.wins / totalGames) * 100 : 0;
          return {
            playerId: row.playerId,
            playerName: row.playerName,
            createdAt: row.createdAt,
            totalGames,
            wins: row.wins,
            losses: row.losses,
            winRate: winRate.toFixed(1),
          };
        });
        resolve(stats);
      }
    });
  });
};

// Re-export getPlayer from sqlite.js
export { getPlayer };