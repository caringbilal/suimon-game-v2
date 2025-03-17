// Import local SQLite database functions
const {
    getPlayer,
    createPlayer,
    createGame,
    getGame,
    updateGameState,
    initializeDatabase
} = require('../database/sqlite');

// Initialize the database
initializeDatabase()
    .then(() => console.log('Local SQLite database initialized'))
    .catch(err => console.error('Error initializing database:', err));

module.exports = {
    getPlayer,
    createPlayer,
    createGame,
    getGame,
    updateGameState
};