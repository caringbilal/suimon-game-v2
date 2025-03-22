import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.resolve(__dirname, 'suimon.sqlite');

const sqlite = sqlite3.verbose();

const db = new sqlite.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to SQLite database');
  }
});

const initializeDatabase = async () => {
  try {
    await new Promise((resolve, reject) => {
      db.run('PRAGMA foreign_keys = ON', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // Create players table with wins and losses columns
    await new Promise((resolve, reject) => {
      db.run(
        `CREATE TABLE IF NOT EXISTS players (
          playerId TEXT PRIMARY KEY,
          playerName TEXT NOT NULL,
          createdAt INTEGER NOT NULL,
          updatedAt INTEGER NOT NULL,
          wins INTEGER DEFAULT 0,
          losses INTEGER DEFAULT 0
        )`,
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    // Add wins column if it doesn't exist
    await new Promise((resolve, reject) => {
      db.run(
        `ALTER TABLE players ADD COLUMN wins INTEGER DEFAULT 0`,
        (err) => {
          if (err && !err.message.includes('duplicate column name')) {
            reject(err);
          } else {
            resolve();
          }
        }
      );
    });

    // Add losses column if it doesn't exist
    await new Promise((resolve, reject) => {
      db.run(
        `ALTER TABLE players ADD COLUMN losses INTEGER DEFAULT 0`,
        (err) => {
          if (err && !err.message.includes('duplicate column name')) {
            reject(err);
          } else {
            resolve();
          }
        }
      );
    });

    // Create games table
    await new Promise((resolve, reject) => {
      db.run(
        `CREATE TABLE IF NOT EXISTS games (
          gameId TEXT PRIMARY KEY,
          player1Id TEXT NOT NULL,
          player2Id TEXT,
          gameState TEXT NOT NULL,
          startTime INTEGER NOT NULL,
          winner TEXT,
          winnerName TEXT,
          status TEXT,
          hands TEXT,
          FOREIGN KEY (player1Id) REFERENCES players(playerId),
          FOREIGN KEY (player2Id) REFERENCES players(playerId)
        )`,
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    await new Promise((resolve, reject) => {
      db.run(
        `ALTER TABLE games ADD COLUMN status TEXT`,
        (err) => {
          if (err && !err.message.includes('duplicate column name')) {
            reject(err);
          } else {
            resolve();
          }
        }
      );
    });

    await new Promise((resolve, reject) => {
      db.run(
        `ALTER TABLE games ADD COLUMN hands TEXT`,
        (err) => {
          if (err && !err.message.includes('duplicate column name')) {
            reject(err);
          } else {
            resolve();
          }
        }
      );
    });

    await new Promise((resolve, reject) => {
      db.run(
        `UPDATE games SET status = 'finished' WHERE status IS NULL AND winner IS NOT NULL`,
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    await new Promise((resolve, reject) => {
      db.run(
        `UPDATE games SET status = 'abandoned' WHERE status IS NULL AND winner IS NULL`,
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
};

initializeDatabase().catch((err) => {
  console.error('Failed to initialize database on startup:', err);
  process.exit(1);
});

const getPlayerByGoogleId = async (googleId) => {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM players WHERE playerId = ?', [googleId], (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
};

const createPlayer = async (playerData) => {
  const { playerId, playerName } = playerData;
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO players (playerId, playerName, createdAt, updatedAt, wins, losses) VALUES (?, ?, ?, ?, ?, ?)',
      [playerId, playerName, Date.now(), Date.now(), 0, 0],
      function (err) {
        if (err) {
          reject(err);
        } else {
          resolve({ playerId, playerName, createdAt: Date.now(), updatedAt: Date.now(), wins: 0, losses: 0 });
        }
      }
    );
  });
};

const getPlayer = async (playerId) => {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM players WHERE playerId = ?', [playerId], (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
};

const getAllPlayers = async () => {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM players', [], (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
};

const getAllGames = async () => {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM games', [], (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
};

const updateGameState = async (gameId, gameState) => {
  let query, params;
  if (typeof gameState === 'string') {
    query = 'UPDATE games SET gameState = ? WHERE gameId = ?';
    params = [gameState, gameId];
  } else {
    query = 'UPDATE games SET gameState = ? WHERE gameId = ?';
    params = [JSON.stringify(gameState), gameId];
  }

  return new Promise((resolve, reject) => {
    db.run(query, params, function (err) {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
};

const updateGameWinner = async (gameId, winnerId, winnerName) => {
  return new Promise((resolve, reject) => {
    db.run(
      'UPDATE games SET winner = ?, winnerName = ? WHERE gameId = ?',
      [winnerId, winnerName, gameId],
      function (err) {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      }
    );
  });
};

const logoutPlayer = async (playerId) => {
  return new Promise((resolve, reject) => {
    db.run(
      'UPDATE players SET updatedAt = ? WHERE playerId = ?',
      [Date.now(), playerId],
      function (err) {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      }
    );
  });
};

export default db;

export {
  initializeDatabase,
  getPlayerByGoogleId,
  createPlayer,
  getPlayer,
  getAllPlayers,
  getAllGames,
  updateGameState,
  updateGameWinner,
  logoutPlayer,
};