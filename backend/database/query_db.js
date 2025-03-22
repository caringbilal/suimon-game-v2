const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Create a new database instance
const dbPath = path.join(__dirname, 'suimon.sqlite');
const db = new sqlite3.Database(dbPath);

// Query and display players table
console.log('\nPlayers Table:\n');
db.all('SELECT * FROM players', [], (err, rows) => {
  if (err) {
    console.error('Error querying players:', err);
  } else {
    console.log(rows);
  }

  // Query and display games table
  console.log('\nGames Table:\n');
  db.all('SELECT * FROM games', [], (err, rows) => {
    if (err) {
      console.error('Error querying games:', err);
    } else {
      console.log(rows);
    }

    // Close the database connection
    db.close();
  });
});