import React from 'react';
import '../styles/gameOver.css';

interface GameOverProps {
  winner: 'player1' | 'player2';
  playerRole: 'player1' | 'player2'; // Add playerRole to determine victory
  playerInfo: { name: string; avatar: string };
  opponentInfo: { name: string; avatar: string };
  killCount: { player1: number; player2: number };
  onPlayAgain: () => void;
  playerEnergy?: number;
  opponentEnergy?: number;
}

const GameOver: React.FC<GameOverProps> = ({
  winner,
  playerRole,
  playerInfo,
  opponentInfo,
  killCount,
  onPlayAgain,
  playerEnergy = 0,
  opponentEnergy = 0,
}) => {
  // Determine if the current player (based on playerRole) is the winner
  const isVictory = winner === playerRole;

  return (
    <div className="game-over-overlay">
      <div className="game-over-content">
        <h1 className={`game-over-title ${isVictory ? 'victory' : 'defeat'}`}>
          {isVictory ? 'VICTORY!' : 'DEFEAT!'}
        </h1>
        <p className="game-over-message">
          {isVictory
            ? 'Congratulations! You have won the battle!'
            : 'Better luck next time! The opponent was stronger this time.'}
        </p>
        <div className="game-over-stats">
          <div className="stat-item">
            <img src={playerInfo.avatar} alt="Player" className="profile-picture" crossOrigin="anonymous" />
            <div className="stat-details">
              <span className="stat-label">{playerInfo.name}</span>
              <span className="stat-value">Kills: {playerRole === 'player1' ? killCount.player1 : killCount.player2}</span>
              <span className="stat-value">Final Energy: {playerEnergy}</span>
            </div>
          </div>
          <div className="stat-item">
            <img src={opponentInfo.avatar} alt="Opponent" className="profile-picture" crossOrigin="anonymous" />
            <div className="stat-details">
              <span className="stat-label">{opponentInfo.name}</span>
              <span className="stat-value">Kills: {playerRole === 'player1' ? killCount.player2 : killCount.player1}</span>
              <span className="stat-value">Final Energy: {opponentEnergy}</span>
            </div>
          </div>
        </div>
        <button className="play-again-btn" onClick={onPlayAgain}>
          PLAY AGAIN
        </button>
      </div>
    </div>
  );
};

export default GameOver;