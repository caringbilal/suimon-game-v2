import React from 'react';
import './TransactionStatus.css';

export type TransactionStage = 'idle' | 'preparing' | 'signing' | 'executing' | 'confirming' | 'success' | 'error';

interface TransactionStatusProps {
  stage: TransactionStage;
  error?: string;
  onCreateGame: (tokenType: 'SUI' | 'SUIMON', amount: string) => void;
  tokenType: 'SUI' | 'SUIMON';
  amount: string;
  transactionHash?: string;
}

const TransactionStatus: React.FC<TransactionStatusProps> = ({ 
  stage, 
  error, 
  onCreateGame,
  tokenType,
  amount,
  transactionHash
 }) => {
  const getStatusText = () => {
    switch (stage) {
      case 'idle':
        return 'Ready to stake';
      case 'preparing':
        return 'Preparing transaction...';
      case 'signing':
        return 'Please approve the transaction in your wallet...';
      case 'executing':
        return 'Executing transaction on blockchain...';
      case 'confirming':
        return 'Waiting for blockchain confirmation...';
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
      {stage === 'success' as TransactionStage ? (
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
          {transactionHash && ((stage === 'executing') || (stage === 'confirming') || (stage === 'success')) && (
            <div className="transaction-hash">
              <a 
                href={`https://explorer.sui.io/txblock/${transactionHash}?network=testnet`} 
                target="_blank" 
                rel="noopener noreferrer"
                className="hash-link"
              >
                View on Explorer
              </a>
            </div>
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