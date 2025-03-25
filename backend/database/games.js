import db from './sqlite.js'; // Default import for the database instance

// Create games table if it doesn't exist
export const initializeGamesTable = () => {
  return new Promise((resolve, reject) => {
    db.run(
      `CREATE TABLE IF NOT EXISTS games (
        gameId TEXT PRIMARY KEY,
        startTime INTEGER,
        player1Id TEXT,
        player2Id TEXT,
        gameState TEXT,
        winner TEXT,
        winnerName TEXT,
        player1Data TEXT,
        player2Data TEXT,
        status TEXT,
        hands TEXT,
        FOREIGN KEY(player1Id) REFERENCES players(playerId),
        FOREIGN KEY(player2Id) REFERENCES players(playerId)
      )`,
      (err) => {
        if (err) {
          console.error('Error creating games table:', err);
          reject(err);
        } else {
          console.log('Games table initialized');
          resolve();
        }
      }
    );
  });
};

// Create a new game
export const createGame = (game) => {
  return new Promise((resolve, reject) => {
    const { gameId, player1Id, player2Id, gameState, startTime, status } = game;
    db.run(
      `INSERT INTO games (gameId, startTime, player1Id, player2Id, gameState, status, winnerName)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [gameId, startTime, player1Id, player2Id, gameState, status, null],
      function (err) {
        if (err) {
          console.error('Error creating game:', err);
          reject(err);
        } else {
          console.log(`Game ${gameId} created successfully`);
          resolve(this.lastID);
        }
      }
    );
  });
};

// Get a game by ID
export const getGame = (gameId) => {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT * FROM games WHERE gameId = ?`,
      [gameId],
      (err, row) => {
        if (err) {
          console.error('Error fetching game:', err);
          reject(err);
        } else {
          resolve(row);
        }
      }
    );
  });
};

// Get all games
export const getAllGames = () => {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT * FROM games`,
      [],
      (err, rows) => {
        if (err) {
          console.error('Error fetching all games:', err);
          reject(err);
        } else {
          resolve(rows);
        }
      }
    );
  });
};

// Update a game
export const updateGame = (gameId, data) => {
  return new Promise((resolve, reject) => {
    const fields = [];
    const values = [];

    for (const [key, value] of Object.entries(data)) {
      fields.push(`${key} = ?`);
      values.push(typeof value === 'object' ? JSON.stringify(value) : value);
    }

    values.push(gameId);

    const query = `UPDATE games SET ${fields.join(', ')} WHERE gameId = ?`;
    db.run(query, values, function (err) {
      if (err) {
        console.error('Error updating game:', err);
        reject(err);
      } else {
        console.log(`Game ${gameId} updated successfully`);
        resolve();
      }
    });
  });
};

// Save game (used at the end of the game)
export const saveGame = (gameState) => {
  return new Promise((resolve, reject) => {
    const gameId = `game_${Date.now()}`;
    const startTime = Date.now();
    const player1Id = gameState.players.player.id;
    const player2Id = gameState.players.opponent.id;
    const status = 'finished';
    const winnerName = gameState.winner?.name || null;

    db.run(
      `INSERT INTO games (gameId, startTime, player1Id, player2Id, gameState, status, winnerName)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [gameId, startTime, player1Id, player2Id, JSON.stringify(gameState), status, winnerName],
      function (err) {
        if (err) {
          console.error('Error saving game:', err);
          reject(err);
        } else {
          console.log(`Game ${gameId} saved successfully`);
          resolve(this.lastID);
        }
      }
    );
  });
};

// Update game winner
export const updateGameWinner = (gameId, winnerId, winnerName) => {
  return new Promise((resolve, reject) => {
    db.run(
      `UPDATE games SET winner = ?, winnerName = ? WHERE gameId = ?`,
      [winnerId, winnerName, gameId],
      function (err) {
        if (err) {
          console.error('Error updating game winner:', err);
          reject(err);
        } else {
          console.log(`Game ${gameId} winner updated to ${winnerName}`);
          resolve();
        }
      }
    );
  });
};