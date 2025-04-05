import React, { useState } from 'react';
import { useSuiClient, useCurrentAccount } from '@mysten/dapp-kit';
import { TransactionBlock } from '@mysten/sui.js/transactions';
import { useSuiWallet } from '../context/SuiWalletContext';
import TransactionStatus, { TransactionStage } from './TransactionStatus';
import { socketService } from '../services/socketService';
import './GameOptions.css';

// Define a minimal interface for the wallet account
interface CustomWalletAccount {
  [key: string]: any; // Allow any method to be called dynamically
  features?: string[]; // Features as an array of strings
}

// Define the Sui Wallet provider interface
interface SuiWalletProvider {
  signAndExecuteTransactionBlock: (args: {
    transactionBlock: TransactionBlock;
  }) => Promise<any>;
  signTransactionBlock: (args: {
    transactionBlock: TransactionBlock;
  }) => Promise<{ signature: string; transactionBlockBytes: string }>;
  signTransaction: (args: {
    transaction: TransactionBlock;
  }) => Promise<{ signature: string; transactionBlockBytes: string }>;
  [key: string]: any;
}

interface GameOptionsProps {
  onCreateGame: (tokenType: 'SUI' | 'SUIMON', amount: string) => void;
}

const GameOptions: React.FC<GameOptionsProps> = ({ onCreateGame }) => {
  const { walletAddress, suiBalance, suimonBalance, isConnected } = useSuiWallet();
  const suiClient = useSuiClient();
  const currentAccount = useCurrentAccount() as CustomWalletAccount | null;
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
      console.log('=== Starting Transaction Preparation ===');
      console.log('Wallet Address:', walletAddress);
      console.log('Token Type:', tokenType);
      console.log('Stake Amount:', value);
      console.log('SUI Balance:', suiBalance);
      console.log('SUIMON Balance:', suimonBalance);
      console.log('Is Connected:', isConnected);

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
      console.log('Amount in Mist:', amountInMist);

      const coinType =
        tokenType === 'SUI'
          ? '0x2::sui::SUI'
          : '0xc0ba93a810adb498900c82bb6f7c16ca3046dfa7b6f364ec985595fdeb1ee9ad::suimon::SUIMON';
      console.log('Coin Type:', coinType);

      console.log('Fetching coins from wallet...');
      const coins = await suiClient.getCoins({
        owner: walletAddress,
        coinType: coinType,
      });
      console.log('Coins Response:', JSON.stringify(coins, null, 2));

      if (!coins.data || coins.data.length === 0) {
        throw new Error(`No ${tokenType} coins found in wallet`);
      }

      const coinObjectId = coins.data[0].coinObjectId;
      console.log('Coin Object ID:', coinObjectId);
      console.log('Coin Balance:', coins.data[0].balance);

      const [coin] = tx.splitCoins(tx.object(coinObjectId), [tx.pure(amountInMist)]);
      console.log('Split Coins Transaction:', JSON.stringify(coin, null, 2));

      tx.moveCall({
        target: `0xa4e6822e7212ab15edc1243ff1cf33bf45346b35c08acacf4c7bf5204fdc3353::game::create_game`,
        arguments: [coin, tx.pure(tokenType === 'SUIMON')],
      });
      console.log('Move Call Prepared:', JSON.stringify(tx, null, 2));

      // Log currentAccount to inspect available methods and features
      console.log('=== Inspecting Current Account ===');
      console.log('Current Account (Raw):', currentAccount);
      console.log('Current Account (Stringified):', JSON.stringify(currentAccount, null, 2));
      const availableMethods = Object.keys(currentAccount || {});
      console.log('Available Methods on Current Account:', availableMethods);
      console.log('Wallet Features (Raw):', currentAccount?.features);
      console.log('Wallet Features (Stringified):', JSON.stringify(currentAccount?.features, null, 2));
      console.log('Feature Keys:', Object.keys(currentAccount?.features || {}));

      // Log all properties of currentAccount to find any hidden methods
      console.log('All Properties of Current Account:', Object.getOwnPropertyNames(currentAccount || {}));
      console.log('Prototype Methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(currentAccount || {})));

      // Access the Sui Wallet provider
      const suiWallet = (window as any).suiWallet as SuiWalletProvider | undefined;
      console.log('=== Inspecting Sui Wallet Provider ===');
      console.log('Sui Wallet Provider (Raw):', suiWallet);
      console.log('Sui Wallet Provider (Stringified):', JSON.stringify(suiWallet, null, 2));
      console.log('Sui Wallet Provider Methods:', suiWallet ? Object.keys(suiWallet) : 'Not available');
      console.log('Sui Wallet Provider Prototype Methods:', suiWallet ? Object.getOwnPropertyNames(Object.getPrototypeOf(suiWallet)) : 'Not available');

      // Try different methods for signing and executing the transaction
      let response;
      if (!currentAccount.features) {
        throw new Error('Wallet features not available');
      }

      // Check if the wallet supports the desired features
      const features = currentAccount.features as string[];
      if (features.includes('sui:signAndExecuteTransactionBlock') && suiWallet?.signAndExecuteTransactionBlock) {
        console.log('Attempting to sign and execute transaction with sui:signAndExecuteTransactionBlock...');
        response = await suiWallet.signAndExecuteTransactionBlock({
          transactionBlock: tx,
        });
      } else if (features.includes('sui:signTransactionBlock') && suiWallet?.signTransactionBlock) {
        console.log('Attempting to sign transaction with sui:signTransactionBlock...');
        const signedTx = await suiWallet.signTransactionBlock({
          transactionBlock: tx,
        });
        console.log('Signed Transaction:', JSON.stringify(signedTx, null, 2));

        response = await suiClient.executeTransactionBlock({
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
      } else if (features.includes('sui:signTransaction') && suiWallet?.signTransaction) {
        console.log('Attempting to sign transaction with sui:signTransaction...');
        const signedTx = await suiWallet.signTransaction({
          transaction: tx,
        });
        console.log('Signed Transaction:', JSON.stringify(signedTx, null, 2));

        response = await suiClient.executeTransactionBlock({
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
      } else if (features.includes('sui:signAndExecuteTransaction') && suiWallet?.signAndExecuteTransaction) {
        console.log('Attempting to sign and execute transaction with sui:signAndExecuteTransaction...');
        response = await suiWallet.signAndExecuteTransaction({
          transaction: tx,
          requestType: 'WaitForLocalExecution',
          options: {
            showInput: true,
            showEffects: true,
            showEvents: true,
            showObjectChanges: true,
          },
        });
      } else {
        console.log('No supported transaction signing method found in features:', features);
        throw new Error('Wallet does not support any known transaction signing methods');
      }

      console.log('Transaction Response:', JSON.stringify(response, null, 2));

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
        walletAddress,
        suiBalance,
        suimonBalance,
        coinsInWallet: await suiClient.getCoins({
          owner: walletAddress,
          coinType:
            tokenType === 'SUI'
              ? '0x2::sui::SUI'
              : '0xc0ba93a810adb498900c82bb6f7c16ca3046dfa7b6f364ec985595fdeb1ee9ad::suimon::SUIMON',
        }),
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
        additionalDetails: {
          suiBalance,
          suimonBalance,
          coinsInWallet: await suiClient.getCoins({
            owner: walletAddress,
            coinType:
              tokenType === 'SUI'
                ? '0x2::sui::SUI'
                : '0xc0ba93a810adb498900c82bb6f7c16ca3046dfa7b6f364ec985595fdeb1ee9ad::suimon::SUIMON',
          }),
        },
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