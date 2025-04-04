import React, { useState } from 'react';
import { useSuiClient, useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { useSuiWallet } from '../context/SuiWalletContext';
import TransactionStatus, { TransactionStage } from './TransactionStatus';
import { createStakedGame } from '../utils/suiTransactions';
import { socketService } from '../services/socketService';
import './GameOptions.css';

interface GameOptionsProps {
  onCreateGame: (tokenType: 'SUI' | 'SUIMON', amount: string) => void;
}

const GameOptions: React.FC<GameOptionsProps> = ({ onCreateGame }) => {
  const { walletAddress, suiBalance, suimonBalance, isConnected } = useSuiWallet();
  const suiClient = useSuiClient();
  const { mutate: signAndExecuteTransactionBlock } = useSignAndExecuteTransaction();
  const [selectedToken, setSelectedToken] = useState<'SUI' | 'SUIMON'>('SUI');
  const [transactionStage, setTransactionStage] = useState<TransactionStage>('idle');
  const [transactionError, setTransactionError] = useState<string | undefined>();
  const [stakeAmount, setStakeAmount] = useState<string>('');
  const [transactionHash, setTransactionHash] = useState<string | undefined>();

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
    if (!isConnected || !walletAddress) {
      console.log('Please connect wallet first');
      return;
    }
    
    // Set the stake amount and prepare for transaction
    setStakeAmount(value);
    setTransactionStage('preparing');
    
    try {
      // Start transaction flow and log it to backend
      socketService.emitWalletEvent('transactionStarted', {
        tokenType,
        amount: value,
        playerAddress: walletAddress,
        playerName: 'Player', // Default name
        stage: 'preparing',
        action: 'stakeTransaction'
      });
      
      // Move to signing stage - this will trigger the wallet popup
      setTransactionStage('signing');
      socketService.emitWalletEvent('transactionSigning', {
        tokenType,
        amount: value,
        playerAddress: walletAddress
      });
      
      // Call the actual blockchain transaction function
      const response = await createStakedGame(
        suiClient,
        signAndExecuteTransactionBlock,
        walletAddress,
        tokenType,
        value,
        'Player' // Default player name
      );
      
      // Transaction is being executed
      setTransactionStage('executing');
      setTransactionHash(response.digest);
      socketService.emitWalletEvent('transactionExecuting', {
        transactionHash: response.digest,
        playerAddress: walletAddress,
        tokenType,
        amount: value
      });

      // Wait for confirmation
      setTransactionStage('confirming');
      socketService.emitWalletEvent('transactionConfirming', {
        transactionHash: response.digest,
        playerAddress: walletAddress
      });
      
      // Transaction successful
      setTransactionStage('success');
      socketService.emitWalletEvent('transactionSuccess', {
        transactionHash: response.digest,
        playerAddress: walletAddress,
        action: 'stakeTransaction'
      });
    } catch (error: any) {
      console.error('Transaction error:', error);
      setTransactionError(error.message || 'Transaction failed. Please try again.');
      setTransactionStage('error');
      
      // Emit detailed error event
      socketService.emitWalletEvent('transactionError', {
        error: error.message,
        errorObject: JSON.stringify(error),
        stage: 'staking',
        tokenType,
        amount: value,
        playerAddress: walletAddress
      });
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
          transactionHash={transactionHash}
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