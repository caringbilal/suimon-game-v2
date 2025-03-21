import db from './sqlite.js'; // Updated to ESM

export const createGame = async (gameData) => {
  const { gameId, player1Id, player2Id, gameState, startTime } = gameData;
  return new Promise((resolve, reject) => {
    db.db.run(
      'INSERT INTO games (gameId, player1Id, player2Id, gameState, startTime) VALUES (?, ?, ?, ?, ?)',
      [gameId, player1Id, player2Id, gameState, startTime],
      function (err) {
        if (err) {
          reject(err);
        } else {
          resolve({ gameId, player1Id, player2Id, gameState, startTime });
        }
      }
    );
  });
};

export const getGame = async (gameId) => {
  return new Promise((resolve, reject) => {
    db.db.get('SELECT * FROM games WHERE gameId = ?', [gameId], (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
};

export const updateGame = async (gameId, gameState) => {
  return new Promise((resolve, reject) => {
    db.db.run(
      'UPDATE games SET gameState = ? WHERE gameId = ?',
      [JSON.stringify(gameState), gameId],
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

export const saveGame = async (gameState) => {
  // This can be a wrapper around updateGame or a no-op if updateGame is sufficient
  return updateGame(gameState.gameId, gameState);
};