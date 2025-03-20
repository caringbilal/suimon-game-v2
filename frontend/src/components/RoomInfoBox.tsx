import React from 'react';

interface RoomInfoBoxProps {
  roomId: string;
  playerRole: 'player1' | 'player2' | null;
  gameState: any;
  onCopyRoomId: () => void;
}

const RoomInfoBox: React.FC<RoomInfoBoxProps> = ({ roomId, playerRole, gameState, onCopyRoomId }) => {
  const getStatusClass = () => {
    if (playerRole === 'player1') return 'host';
    if (!gameState) return 'waiting';
    return 'playing';
  };

  const getStatusText = () => {
    if (playerRole === 'player1') return 'Hosting';
    if (!gameState) return 'Waiting';
    return 'Playing';
  };

  return (
    <div className="room-info-box">
      <h3>Room Information</h3>
      <div className="room-info-content">
        <p>
          Room ID: <span>{roomId}</span>
        </p>
        <p>
          Role: <span className={getStatusClass()}>
            {playerRole === 'player1' ? 'Host (Player 1)' : 'Guest (Player 2)'}
            <span className={`status-dot ${getStatusClass()}`}></span>
          </span>
        </p>
        <p>
          Status: <span className={getStatusClass()}>
            {getStatusText()}
            <span className={`status-dot ${getStatusClass()}`}></span>
          </span>
        </p>
        {gameState && (
          <p>
            Turn: <span className={gameState.currentTurn === 'player' ? 'host' : 'playing'}>
              {gameState.currentTurn === 'player' ? 'Player 1' : 'Player 2'}
            </span>
          </p>
        )}
        <button className="copy-room-id" onClick={onCopyRoomId}>
          Copy Room ID
        </button>
      </div>
    </div>
  );
};

export default RoomInfoBox;