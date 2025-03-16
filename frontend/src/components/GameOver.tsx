import React from 'react';
import '../styles/gameOver.css';

interface GameOverProps {
  winner: 'player' | 'opponent';
  playerInfo: { name: string; avatar: string };
  opponentInfo: { name: string; avatar: string };
  killCount: { player: number; opponent: number };
  onPlayAgain: () => void;
}

const GameOver: React.FC<GameOverProps> = ({ winner, playerInfo, opponentInfo, killCount, onPlayAgain }) => {
  const isVictory = winner === 'player';
  
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
            <img src={playerInfo.avatar} alt="Player" className="profile-picture" />
            <div className="stat-details">
              <span className="stat-label">{playerInfo.name}</span>
              <span className="stat-value">Kills: {killCount.player}</span>
            </div>
          </div>
          <div className="stat-item">
            <img src={opponentInfo.avatar} alt="Opponent" className="profile-picture" />
            <div className="stat-details">
              <span className="stat-label">{opponentInfo.name}</span>
              <span className="stat-value">Kills: {killCount.opponent}</span>
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