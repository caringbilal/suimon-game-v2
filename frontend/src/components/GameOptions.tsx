import React, { useState } from 'react';
import { useSuiWallet } from '../context/SuiWalletContext';
import TransactionStatus, { TransactionStage } from './TransactionStatus';
import './GameOptions.css';

interface GameOptionsProps {
  onCreateGame: (tokenType: 'SUI' | 'SUIMON', amount: string) => void;
}

const GameOptions: React.FC<GameOptionsProps> = ({ onCreateGame }) => {
  const { suiBalance, suimonBalance, isConnected } = useSuiWallet();
  const [selectedToken, setSelectedToken] = useState<'SUI' | 'SUIMON'>('SUI');
  const [transactionStage, setTransactionStage] = useState<TransactionStage>('idle');
  const [transactionError, setTransactionError] = useState<string | undefined>();
  const [stakeAmount, setStakeAmount] = useState<string>('');

  const suiOptions = [
    { label: '0.0005 SUI', value: '0.0005' },
    { label: '0.005 SUI', value: '0.005' },
    { label: '0.05 SUI', value: '0.05' }
  ];

  const suimonOptions = [
    { label: '1,000 SUIMON', value: '1000' },
    { label: '10,000 SUIMON', value: '10000' },
    { label: '100,000 SUIMON', value: '100000' }
  ];

  const formatBalance = (balance: string, tokenType: string = 'SUI') => {
    // SUI uses 9 decimal places (1 SUI = 10^9 MIST)
    const num = tokenType === 'SUI' ? parseFloat(balance) / 1_000_000_000 : parseFloat(balance); // Divide by 10^9 only for SUI tokens
    if (num === 0) return '0';
    if (num < 0.0001) return '< 0.0001';
    
    // Format with appropriate precision based on the value
    if (num >= 1000) {
      return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
    } else if (num >= 1) {
      return num.toLocaleString(undefined, { maximumFractionDigits: 3 });
    } else {
      return num.toLocaleString(undefined, { maximumFractionDigits: 4 });
    }
  };

  const handleStakeButtonClick = async (tokenType: 'SUI' | 'SUIMON', value: string) => {
    if (isConnected) {
      // Set the stake amount and prepare for transaction
      setStakeAmount(value);
      setTransactionStage('preparing');
      
      try {
        // In a real implementation, we would call the blockchain here
        // For now, we'll use the same flow but prepare for real transactions
        // The actual blockchain interaction will happen in the GameRoom component
        
        // Simulate wallet approval request
        setTransactionStage('signing');
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Simulate transaction execution
        setTransactionStage('executing');
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Simulate transaction confirmation
        setTransactionStage('confirming');
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Simulate success
        setTransactionStage('success');
      } catch (error) {
        console.error('Transaction error:', error);
        setTransactionError('Transaction failed. Please try again.');
        setTransactionStage('error');
      }
    } else {
      // If wallet is not connected, we don't proceed but the button is still clickable
      console.log('Please connect wallet first');
    }
  }
  
  const handleCreateGame = (tokenType: 'SUI' | 'SUIMON', amount: string) => {
    // Reset transaction state
    setTransactionStage('idle');
    setTransactionError(undefined);
    
    // Call the parent component's onCreateGame function
    onCreateGame(tokenType, amount);
  };

  return (
    <div className="game-options">
      <div className="token-selector">
        <button
          className={`token-button ${selectedToken === 'SUI' ? 'active' : ''}`}
          onClick={() => setSelectedToken('SUI')}
        >
          SUI Token
          <span className="balance">{formatBalance(suiBalance, 'SUI')} SUI</span>
        </button>
        <button
          className={`token-button ${selectedToken === 'SUIMON' ? 'active' : ''}`}
          onClick={() => setSelectedToken('SUIMON')}
        >
          SUIMON Token
          <span className="balance">{formatBalance(suimonBalance, 'SUIMON')} SUIMON</span>
        </button>
      </div>

      {transactionStage === 'idle' ? (
        <div className="stake-options">
          <h3>Select Stake Amount</h3>
          <div className="options-grid">
            {(selectedToken === 'SUI' ? suiOptions : suimonOptions).map((option) => (
              <button
                key={option.value}
                className="stake-button"
                onClick={() => handleStakeButtonClick(selectedToken, option.value)}
                disabled={!isConnected}
              >
                {option.label}
                <span className="gas-fee">+ Gas Fee</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <TransactionStatus 
          stage={transactionStage}
          error={transactionError}
          onCreateGame={handleCreateGame}
          tokenType={selectedToken}
          amount={stakeAmount}
        />
      )}

      {!isConnected && (
        <div className="connect-wallet-prompt">
          Please connect your wallet to create a game
        </div>
      )}
    </div>
  );
};

export default GameOptions;