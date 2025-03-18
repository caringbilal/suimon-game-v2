import React from 'react';
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
            {games.length > 0 ? games.map((game) => {
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
            {players.length > 0 ? players.map((player) => {
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
      </div>
    </div>
  );
};

export default LeaderboardTable;