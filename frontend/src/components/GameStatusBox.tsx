import React from 'react';

interface GameStatusBoxProps {
  currentTurn: string;
  combatLog: Array<{ message: string; type: string }>;
}

const GameStatusBox: React.FC<GameStatusBoxProps> = ({ currentTurn, combatLog }) => {
  return (
    <div className="game-status-box">
      <h3>Current Turn: {currentTurn}</h3>
      <div className="combat-log">
        {combatLog.map((entry, index) => (
          <div key={index} className={`combat-log-entry ${entry.type}`}>
            {entry.message}
          </div>
        ))}
      </div>
    </div>
  );
};

export default GameStatusBox;