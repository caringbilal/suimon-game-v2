import React, { useState } from 'react';
import { useSuiWallet } from '../context/SuiWalletContext';
import './GameOptions.css';

interface GameOptionsProps {
  onCreateGame: (tokenType: 'SUI' | 'SUIMON', amount: string) => void;
}

const GameOptions: React.FC<GameOptionsProps> = ({ onCreateGame }) => {
  const { suiBalance, suimonBalance, isConnected } = useSuiWallet();
  const [selectedToken, setSelectedToken] = useState<'SUI' | 'SUIMON'>('SUI');

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

  const handleStakeButtonClick = (tokenType: 'SUI' | 'SUIMON', value: string) => {
    if (isConnected) {
      onCreateGame(tokenType, value);
    } else {
      // If wallet is not connected, we don't proceed but the button is still clickable
      console.log('Please connect wallet first');
    }
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

      {!isConnected && (
        <div className="connect-wallet-prompt">
          Please connect your wallet to create a game
        </div>
      )}
    </div>
  );
};

export default GameOptions;