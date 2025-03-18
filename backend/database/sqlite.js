const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Create a new database instance, store it in a local file
const dbPath = path.join(__dirname, 'suimon.sqlite');
const db = new sqlite3.Database(dbPath);

// Create tables if they don't exist
const initializeDatabase = () => {
  return new Promise((resolve, reject) => {
    // Players table
    db.run(`
      CREATE TABLE IF NOT EXISTS players (
        playerId TEXT PRIMARY KEY,
        playerName TEXT,
        createdAt INTEGER,
        updatedAt INTEGER
      )
    `);

    // Games table
    db.run(`
      CREATE TABLE IF NOT EXISTS games (
        gameId TEXT PRIMARY KEY,
        startTime INTEGER,
        player1Id TEXT,
        player2Id TEXT,
        gameState TEXT,
        winner TEXT,
        FOREIGN KEY (player1Id) REFERENCES players(playerId),
        FOREIGN KEY (player2Id) REFERENCES players(playerId)
      )
    `, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
};

// Player operations
const getPlayer = async (playerId) => {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM players WHERE playerId = ?', [playerId], (err, row) => {
      if (err) reject(err);
      resolve(row);
    });
  });
};

const getPlayerByGoogleId = async (googleId) => {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM players WHERE playerId = ?', [googleId], (err, row) => {
      if (err) reject(err);
      resolve(row);
    });
  });
};

const logoutPlayer = async (playerId) => {
  return new Promise((resolve, reject) => {
    db.run(
      'UPDATE players SET updatedAt = ? WHERE playerId = ?',
      [Date.now(), playerId],
      (err) => {
        if (err) reject(err);
        resolve({ success: true });
      }
    );
  });
};

const createPlayer = async (playerData) => {
  const { playerId, playerName } = playerData;
  const now = Date.now();
  
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO players (playerId, playerName, createdAt, updatedAt) VALUES (?, ?, ?, ?)',
      [playerId, playerName, now, now],
      (err) => {
        if (err) reject(err);
        resolve({ playerId, playerName, createdAt: now, updatedAt: now });
      }
    );
  });
};

// Game operations
const createGame = async (gameData) => {
  const { gameId, player1Id, player2Id, gameState } = gameData;
  const startTime = Date.now();

  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO games (gameId, startTime, player1Id, player2Id, gameState) VALUES (?, ?, ?, ?, ?)',
      [gameId, startTime, player1Id, player2Id, gameState],
      (err) => {
        if (err) reject(err);
        resolve({ gameId, startTime, player1Id, player2Id, gameState });
      }
    );
  });
};

const getGame = async (gameId) => {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM games WHERE gameId = ?', [gameId], (err, row) => {
      if (err) reject(err);
      resolve(row);
    });
  });
};

const updateGameState = async (gameId, gameState) => {
  return new Promise((resolve, reject) => {
    db.run(
      'UPDATE games SET gameState = ? WHERE gameId = ?',
      [gameState, gameId],
      (err) => {
        if (err) reject(err);
        resolve({ gameId, gameState });
      }
    );
  });
};

const updateGameWinner = async (gameId, winner) => {
  return new Promise((resolve, reject) => {
    db.run(
      'UPDATE games SET winner = ? WHERE gameId = ?',
      [winner, gameId],
      (err) => {
        if (err) reject(err);
        resolve({ gameId, winner });
      }
    );
  });
};

// Get all players
const getAllPlayers = async () => {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM players', [], (err, rows) => {
      if (err) reject(err);
      resolve(rows);
    });
  });
};

module.exports = {
  initializeDatabase,
  getPlayer,
  getPlayerByGoogleId,
  createPlayer,
  logoutPlayer,
  createGame,
  getGame,
  updateGameState,
  updateGameWinner,
  getAllPlayers,
  db
};