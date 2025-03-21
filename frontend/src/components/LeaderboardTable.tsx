import React, { useState } from 'react';
import '../styles/leaderboard.css';

interface Player {
  playerId: string;
  playerName: string;
  createdAt: number;
  updatedAt: number;
}

interface Game {
  gameId: string;
  startTime: number;
  player1Id: string;
  player2Id: string;
  gameState: string;
  winner: string;
}

interface LeaderboardTableProps {
  players: Player[];
  games: Game[];
}

const LeaderboardTable: React.FC<LeaderboardTableProps> = ({ players, games }) => {
  // Pagination state
  const [currentGamePage, setCurrentGamePage] = useState(1);
  const [currentPlayerPage, setCurrentPlayerPage] = useState(1);
  const rowsPerPage = 7;
  
  // Calculate total pages
  const totalGamePages = Math.ceil(games.length / rowsPerPage);
  const totalPlayerPages = Math.ceil(players.length / rowsPerPage);
  
  // Get current page data
  const indexOfLastGame = currentGamePage * rowsPerPage;
  const indexOfFirstGame = indexOfLastGame - rowsPerPage;
  const currentGames = games.slice(indexOfFirstGame, indexOfLastGame);
  
  const indexOfLastPlayer = currentPlayerPage * rowsPerPage;
  const indexOfFirstPlayer = indexOfLastPlayer - rowsPerPage;
  const currentPlayers = players.slice(indexOfFirstPlayer, indexOfLastPlayer);
  
  // Change page handlers
  const nextGamePage = () => {
    if (currentGamePage < totalGamePages) {
      setCurrentGamePage(currentGamePage + 1);
    }
  };
  
  const prevGamePage = () => {
    if (currentGamePage > 1) {
      setCurrentGamePage(currentGamePage - 1);
    }
  };
  
  const nextPlayerPage = () => {
    if (currentPlayerPage < totalPlayerPages) {
      setCurrentPlayerPage(currentPlayerPage + 1);
    }
  };
  
  const prevPlayerPage = () => {
    if (currentPlayerPage > 1) {
      setCurrentPlayerPage(currentPlayerPage - 1);
    }
  };

  const calculatePlayerStats = (playerId: string) => {
    return games.reduce(
      (stats, game) => {
        if (game.player1Id === playerId || game.player2Id === playerId) {
          stats.totalGames++;
          if (game.winner === playerId) stats.wins++;
        }
        return stats;
      },
      { totalGames: 0, wins: 0 }
    );
  };

  const playerStats = new Map(players.map(player => {
    const stats = calculatePlayerStats(player.playerId);
    const winRate = stats.totalGames > 0 ? ((stats.wins / stats.totalGames) * 100).toFixed(1) : '0.0';
    return [player.playerId, { ...stats, winRate }];
  }));
  return (
    <div className="leaderboard-container">
      <div className="table-section">
        <h2>Game Leaderboard</h2>
        <table className="leaderboard-table">
          <thead>
            <tr>
              <th>Game ID</th>
              <th>Player 1</th>
              <th>Player 2</th>
              <th>Winner</th>
              <th>Start Time</th>
            </tr>
          </thead>
          <tbody>
            {currentGames.length > 0 ? currentGames.map((game) => {
              const player1 = players.find(p => p.playerId === game.player1Id);
              const player2 = players.find(p => p.playerId === game.player2Id);
              const winner = players.find(p => p.playerId === game.winner);
              
              return (
                <tr key={game.gameId}>
                  <td>{game.gameId}</td>
                  <td>{player1?.playerName || 'Unknown'}</td>
                  <td>{player2?.playerName || 'Unknown'}</td>
                  <td>{winner?.playerName || 'In Progress'}</td>
                  <td>{new Date(game.startTime).toLocaleString()}</td>
                </tr>
              );
            }) : (
              <tr>
                <td colSpan={5} className="no-data-message">No game data available</td>
              </tr>
            )}
          </tbody>
        </table>
        {games.length > 0 && (
          <div className="pagination-controls">
            <button 
              onClick={prevGamePage} 
              disabled={currentGamePage === 1}
              className="pagination-button"
            >
              Previous
            </button>
            <span className="page-indicator">
              Page {currentGamePage} of {totalGamePages}
            </span>
            <button 
              onClick={nextGamePage} 
              disabled={currentGamePage === totalGamePages}
              className="pagination-button"
            >
              Next
            </button>
          </div>
        )}
      </div>

      <div className="table-section">
        <h2>Player Statistics</h2>
        <table className="leaderboard-table">
          <thead>
            <tr>
              <th>Player Name</th>
              <th>Total Games</th>
              <th>Wins</th>
              <th>Win Rate</th>
              <th>Join Date</th>
            </tr>
          </thead>
          <tbody>
            {currentPlayers.length > 0 ? currentPlayers.map((player) => {
              const stats = playerStats.get(player.playerId) || { totalGames: 0, wins: 0, winRate: '0.0' };
              return (
                <tr key={player.playerId}>
                  <td>{player.playerName || 'Unknown'}</td>
                  <td>{stats.totalGames}</td>
                  <td>{stats.wins}</td>
                  <td>{stats.winRate}%</td>
                  <td>{player.createdAt ? new Date(player.createdAt).toLocaleDateString() : 'N/A'}</td>
                </tr>
              );
            }) : (
              <tr>
                <td colSpan={5} className="no-data-message">No player data available</td>
              </tr>
            )}
          </tbody>
        </table>
        {players.length > 0 && (
          <div className="pagination-controls">
            <button 
              onClick={prevPlayerPage} 
              disabled={currentPlayerPage === 1}
              className="pagination-button"
            >
              Previous
            </button>
            <span className="page-indicator">
              Page {currentPlayerPage} of {totalPlayerPages}
            </span>
            <button 
              onClick={nextPlayerPage} 
              disabled={currentPlayerPage === totalPlayerPages}
              className="pagination-button"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default LeaderboardTable;