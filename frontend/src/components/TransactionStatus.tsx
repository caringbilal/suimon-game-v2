import React from 'react';
import './TransactionStatus.css';

export type TransactionStage = 'idle' | 'preparing' | 'signing' | 'executing' | 'confirming' | 'success' | 'error';

interface TransactionStatusProps {
  stage: TransactionStage;
  error?: string;
  onCreateGame: (tokenType: 'SUI' | 'SUIMON', amount: string) => void;
  tokenType: 'SUI' | 'SUIMON';
  amount: string;
}

const TransactionStatus: React.FC<TransactionStatusProps> = ({ 
  stage, 
  error, 
  onCreateGame,
  tokenType,
  amount
 }) => {
  const getStatusText = () => {
    switch (stage) {
      case 'idle':
        return 'Ready to stake';
      case 'preparing':
        return 'Preparing transaction...';
      case 'signing':
        return 'Waiting for signature...';
      case 'executing':
        return 'Executing transaction...';
      case 'confirming':
        return 'Confirming on blockchain...';
      case 'success':
        return 'Transaction successful!';
      case 'error':
        return `Transaction failed: ${error || 'Unknown error'}`;
      default:
        return 'Unknown status';
    }
  };

  return (
    <div className={`transaction-status ${stage}`}>
      {stage === 'success' ? (
        <button 
          className="create-paid-game-button"
          onClick={() => onCreateGame(tokenType, amount)}
        >
          Create Paid On-Chain Game
        </button>
      ) : (
        <div className="status-container">
          <div className="status-text">{getStatusText()}</div>
          {stage !== 'idle' && stage !== 'error' && (
            <div className="loading-spinner"></div>
          )}
          {stage === 'error' && (
            <div className="error-details">{error}</div>
          )}
        </div>
      )}
    </div>
  );
};

export default TransactionStatus;