import React, { useState } from 'react';
import { useSuiClient, useCurrentAccount } from '@mysten/dapp-kit';
import { TransactionBlock } from '@mysten/sui.js/transactions';
import { useSuiWallet } from '../context/SuiWalletContext';
import TransactionStatus, { TransactionStage } from './TransactionStatus';
import { socketService } from '../services/socketService';
import './GameOptions.css';

// Define a custom type for the wallet account
interface CustomWalletAccount {
  signTransactionBlock: (args: { transactionBlock: TransactionBlock }) => Promise<{
    transactionBlockBytes: Uint8Array;
    signature: string;
  }>;
}

interface GameOptionsProps {
  onCreateGame: (tokenType: 'SUI' | 'SUIMON', amount: string) => void;
}

const GameOptions: React.FC<GameOptionsProps> = ({ onCreateGame }) => {
  const { walletAddress, suiBalance, suimonBalance, isConnected } = useSuiWallet();
  const suiClient = useSuiClient();
  const currentAccount = useCurrentAccount() as CustomWalletAccount | null; // Use the custom type
  const [selectedToken, setSelectedToken] = useState<'SUI' | 'SUIMON'>('SUI');
  const [transactionStage, setTransactionStage] = useState<TransactionStage>('idle');
  const [transactionError, setTransactionError] = useState<string | undefined>();
  const [stakeAmount, setStakeAmount] = useState<string>('');
  const [transactionHash, setTransactionHash] = useState<string | undefined>();

  const suiOptions = [
    { label: '0.0005 SUI', value: '0.0005' },
    { label: '0.005 SUI', value: '0.005' },
    { label: '0.05 SUI', value: '0.05' },
  ];

  const suimonOptions = [
    { label: '1,000 SUIMON', value: '1000' },
    { label: '10,000 SUIMON', value: '10000' },
    { label: '100,000 SUIMON', value: '100000' },
  ];

  const formatBalance = (balance: string, tokenType: string = 'SUI') => {
    const num = tokenType === 'SUI' ? parseFloat(balance) / 1_000_000_000 : parseFloat(balance);
    if (num === 0) return '0';
    if (num < 0.0001) return '< 0.0001';

    if (num >= 1000) {
      return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
    } else if (num >= 1) {
      return num.toLocaleString(undefined, { maximumFractionDigits: 3 });
    } else {
      return num.toLocaleString(undefined, { maximumFractionDigits: 4 });
    }
  };

  const handleStakeButtonClick = async (tokenType: 'SUI' | 'SUIMON', value: string) => {
    if (!isConnected || !walletAddress || !currentAccount) {
      console.log('Please connect wallet first');
      setTransactionError('Please connect your wallet first');
      setTransactionStage('error');
      return;
    }

    setStakeAmount(value);
    setTransactionStage('preparing');

    try {
      socketService.emitWalletEvent('transactionStarted', {
        tokenType,
        amount: value,
        playerAddress: walletAddress,
        playerName: 'Player',
        stage: 'preparing',
        action: 'stakeTransaction',
      });

      setTransactionStage('signing');
      await new Promise((resolve) => setTimeout(resolve, 500));

      const tx = new TransactionBlock();
      const amountInMist = Math.floor(parseFloat(value) * 1_000_000_000);

      const coinType =
        tokenType === 'SUI'
          ? '0x2::sui::SUI'
          : '0xc0ba93a810adb498900c82bb6f7c16ca3046dfa7b6f364ec985595fdeb1ee9ad::suimon::SUIMON';

      const coins = await suiClient.getCoins({
        owner: walletAddress,
        coinType: coinType,
      });

      if (!coins.data || coins.data.length === 0) {
        throw new Error(`No ${tokenType} coins found in wallet`);
      }

      const coinObjectId = coins.data[0].coinObjectId;
      const [coin] = tx.splitCoins(tx.object(coinObjectId), [tx.pure(amountInMist)]);

      tx.moveCall({
        target: `0xa4e6822e7212ab15edc1243ff1cf33bf45346b35c08acacf4c7bf5204fdc3353::game::create_game`,
        arguments: [coin, tx.pure(tokenType === 'SUIMON')],
      });

      // Ensure currentAccount supports signTransactionBlock
      if (!currentAccount || !('signTransactionBlock' in currentAccount)) {
        throw new Error('Wallet account is not properly connected or does not support signing transactions');
      }

      // Sign the transaction block
      const signedTx = await currentAccount.signTransactionBlock({
        transactionBlock: tx,
      });

      // Execute the signed transaction
      const response = await suiClient.executeTransactionBlock({
        transactionBlock: signedTx.transactionBlockBytes,
        signature: signedTx.signature,
        requestType: 'WaitForLocalExecution',
        options: {
          showInput: true,
          showEffects: true,
          showEvents: true,
          showObjectChanges: true,
        },
      });

      if (!response.digest) {
        throw new Error('Transaction failed: No transaction digest received');
      }

      setTransactionStage('executing');
      setTransactionHash(response.digest);
      socketService.emitWalletEvent('transactionExecuting', {
        transactionHash: response.digest,
        playerAddress: walletAddress,
        tokenType,
        amount: value,
      });

      setTransactionStage('confirming');
      socketService.emitWalletEvent('transactionConfirming', {
        transactionHash: response.digest,
        playerAddress: walletAddress,
      });

      setTransactionStage('success');
      socketService.emitWalletEvent('transactionSuccess', {
        transactionHash: response.digest,
        playerAddress: walletAddress,
        action: 'stakeTransaction',
      });
    } catch (error: any) {
      console.error('Transaction preparation error:', error);
      console.error('Transaction error details:', {
        errorType: error.constructor.name,
        errorMessage: error.message,
        stack: error.stack,
        tokenType,
        amount: value,
        stage: transactionStage,
      });

      let errorMessage = error.message || 'Transaction failed. Please try again.';
      if (errorMessage.includes('cancelled') || errorMessage.includes('failed to appear')) {
        errorMessage =
          'Wallet confirmation was cancelled or did not appear. Please check your wallet extension is active and try again.';
      }

      setTransactionError(errorMessage);
      setTransactionStage('error');

      socketService.emitWalletEvent('transactionError', {
        error: errorMessage,
        errorObject: JSON.stringify(error),
        errorType: error.constructor.name,
        stage: 'staking',
        tokenType,
        amount: value,
        playerAddress: walletAddress,
        walletStatus: isConnected ? 'connected' : 'disconnected',
        timestamp: new Date().toISOString(),
      });
    }
  };

  const handleCreateGame = (tokenType: 'SUI' | 'SUIMON', amount: string) => {
    setTransactionStage('idle');
    setTransactionError(undefined);
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
                onClick={() => setStakeAmount(option.value)}
                disabled={!isConnected}
              >
                {option.label}
                <span className="gas-fee">+ Gas Fee</span>
              </button>
            ))}
          </div>
          {isConnected && stakeAmount && (
            <button
              className="stake-now-button"
              onClick={() => handleStakeButtonClick(selectedToken, stakeAmount)}
            >
              Stake {stakeAmount} {selectedToken}
            </button>
          )}
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