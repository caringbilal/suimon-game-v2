import db from './sqlite.js'; // Updated to ESM

export const createPlayer = async (playerData) => {
  const { playerId, playerName } = playerData;
  return new Promise((resolve, reject) => {
    db.db.run(
      'INSERT INTO players (playerId, playerName, createdAt, updatedAt) VALUES (?, ?, ?, ?)',
      [playerId, playerName, Date.now(), Date.now()],
      function (err) {
        if (err) {
          reject(err);
        } else {
          resolve({ playerId, playerName, createdAt: Date.now(), updatedAt: Date.now() });
        }
      }
    );
  });
};

export const getPlayer = async (playerId) => {
  return new Promise((resolve, reject) => {
    db.db.get('SELECT * FROM players WHERE playerId = ?', [playerId], (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
};

export const getPlayerStats = async (playerId) => {
  try {
    const gamesAsPlayer1 = await new Promise((resolve, reject) => {
      db.db.all('SELECT * FROM games WHERE player1Id = ?', [playerId], (err, rows) => {
        if (err) reject(err);
        resolve(rows);
      });
    });

    const gamesAsPlayer2 = await new Promise((resolve, reject) => {
      db.db.all('SELECT * FROM games WHERE player2Id = ?', [playerId], (err, rows) => {
        if (err) reject(err);
        resolve(rows);
      });
    });

    const allGames = [...gamesAsPlayer1, ...gamesAsPlayer2];
    const totalGames = allGames.length;

    let wins = 0;
    allGames.forEach(game => {
      if (game.winner === 'player' && game.player1Id === playerId) {
        wins++;
      } else if (game.winner === 'opponent' && game.player2Id === playerId) {
        wins++;
      }
    });

    const losses = totalGames - wins;
    const winRate = totalGames > 0 ? ((wins / totalGames) * 100).toFixed(2) : '0.00';

    return { totalGames, wins, losses, winRate };
  } catch (error) {
    console.error('Error fetching player stats:', error);
    throw error;
  }
};

export const updatePlayerStats = async (playerId, wins, losses) => {
  // Since stats are calculated dynamically in getPlayerStats, this can be a no-op
  // If you want to store stats in the database, you can add a stats table and update it here
  return Promise.resolve();
};