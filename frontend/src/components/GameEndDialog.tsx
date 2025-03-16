import React from 'react';
import '../styles/gameEndDialog.css';

interface GameEndDialogProps {
  winner: 'player' | 'opponent';
  onRestart: () => void;
}

const GameEndDialog: React.FC<GameEndDialogProps> = ({ winner, onRestart }) => {
  return (
    <div className={`game-end-dialog ${winner}`}>
      <div className="dialog-content">
        <h2>{winner === 'player' ? 'Congratulations! You Won!' : 'Game Over! Opponent Won!'}</h2>
        <button onClick={onRestart}>Start New Game</button>
      </div>
    </div>
  );
};

export default GameEndDialog;