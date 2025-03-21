import sqlite3 from 'sqlite3'; // Updated to ESM
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.resolve(__dirname, 'suimon.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
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

    await new Promise((resolve, reject) => {
      db.run(
        `CREATE TABLE IF NOT EXISTS players (
          playerId TEXT PRIMARY KEY,
          playerName TEXT NOT NULL,
          createdAt INTEGER NOT NULL,
          updatedAt INTEGER NOT NULL
        )`,
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    await new Promise((resolve, reject) => {
      db.run(
        `CREATE TABLE IF NOT EXISTS games (
          gameId TEXT PRIMARY KEY,
          player1Id TEXT NOT NULL,
          player2Id TEXT NOT NULL,
          gameState TEXT NOT NULL,
          startTime INTEGER NOT NULL,
          winner TEXT,
          winnerName TEXT,
          FOREIGN KEY (player1Id) REFERENCES players(playerId),
          FOREIGN KEY (player2Id) REFERENCES players(playerId)
        )`,
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

export default {
  db,
  initializeDatabase,
  getPlayerByGoogleId,
  createPlayer,
  getPlayer,
  getAllPlayers,
  getAllGames,
  updateGameState,
  updateGameWinner,
  logoutPlayer
};