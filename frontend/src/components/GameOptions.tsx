import React, { useState } from 'react';
import { useSuiClient, useCurrentAccount, useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { TransactionBlock } from '@mysten/sui.js/transactions';
import { SuiClient, getFullnodeUrl } from '@mysten/sui.js/client';
import { useSuiWallet } from '../context/SuiWalletContext';
import TransactionStatus, { TransactionStage } from './TransactionStatus';
import { socketService } from '../services/socketService';
import { SUIMON_COIN_TYPE } from '../utils/suimonTokenUtils';
import './GameOptions.css';

// Explicit client for offline tx build
const suiRpcClient = new SuiClient({ url: getFullnodeUrl('testnet') }); // or 'mainnet'

// Contract addresses
const SUI_GAME_CONTRACT = '0xba02ab9d67f2058424da11e1f063bff31683fd229a8408d87c018dea223ce4f0';
const SUIMON_GAME_CONTRACT = '0xd87d922719e3267aa78c9537b98a53af03086576afcb23ea7a035b39260cb747';

const SUI_MODULE_NAME = 'game';
const SUIMON_MODULE_NAME = 'suimon_staking';

type TokenType = 'SUI' | 'SUIMON';

interface CustomWalletAccount {
  address: string;
  [key: string]: any;
}

interface GameOptionsProps {
  onCreateGame: (tokenType: TokenType, amount: string) => void;
}

const suiOptions = [
  { label: '0.0005 SUI', value: '0.0005' },
  { label: '0.005 SUI', value: '0.005' },
  { label: '0.05 SUI', value: '0.05' },
];

const suimonOptions = [
  { label: '50,000 SUIMON', value: '50000' },
  { label: '100,000 SUIMON', value: '100000' },
  { label: '200,000 SUIMON', value: '200000' },
];

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

const GameOptions: React.FC<GameOptionsProps> = ({ onCreateGame }) => {
  const { walletAddress, suiBalance, suimonBalance, isConnected } = useSuiWallet();
  const suiClient = useSuiClient(); // Used for blockchain interactions like waitForTransaction
  const currentAccount = useCurrentAccount() as CustomWalletAccount | null;
  const { mutateAsync: signAndExecuteTransactionAsync, isPending } = useSignAndExecuteTransaction();

  const [selectedToken, setSelectedToken] = useState<TokenType>('SUI');
  const [transactionStage, setTransactionStage] = useState<TransactionStage>('idle');
  const [transactionError, setTransactionError] = useState<string | undefined>();
  const [stakeAmount, setStakeAmount] = useState<string>('');
  const [transactionHash, setTransactionHash] = useState<string | undefined>();
  const [roomId, setRoomId] = useState<string | undefined>();

  const formatBalance = (balance: string | null | undefined, tokenType = 'SUI') => {
    if (!balance) return '0';
    try {
      const num =
        tokenType === 'SUI'
          ? parseFloat(balance) / 1_000_000_000
          : parseFloat(balance);
      if (isNaN(num)) return '0';
      if (num === 0) return '0';
      if (num < 0.0001 && num > 0) return '< 0.0001';
      if (num >= 1000) return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
      if (num >= 1) return num.toLocaleString(undefined, { maximumFractionDigits: 3 });
      return num.toLocaleString(undefined, { maximumFractionDigits: 4 });
    } catch {
      return 'Error';
    }
  };

  const handleStakeButtonClick = async (tokenType: TokenType, amount: string) => {
    if (!isConnected || !currentAccount?.address) {
      setTransactionError('Wallet not connected');
      setTransactionStage('error');
      return;
    }

    // Check if user has sufficient balance
    const userBalance = tokenType === 'SUI' ? suiBalance : suimonBalance;

    // Both SUI and SUIMON balances are in their smallest units (MIST for SUI)
    // Convert the stake amount to the smallest unit for comparison
    const requiredAmount = parseFloat(amount) * 1_000_000_000; // Convert to smallest unit (9 decimals)

    // Compare as BigInt to avoid floating point issues
    const userBalanceBigInt = BigInt(userBalance || '0');
    const requiredAmountBigInt = BigInt(Math.floor(requiredAmount));

    if (userBalanceBigInt < requiredAmountBigInt) {
      setTransactionError(`Insufficient ${tokenType} balance`);
      setTransactionStage('error');
      return;
    }

    setStakeAmount(amount);
    setTransactionStage('preparing');
    setTransactionError(undefined);
    setTransactionHash(undefined);

    const ownerAddress = currentAccount.address;
    const tx = new TransactionBlock();

    try {
      socketService.emitWalletEvent('transactionStarted', {
        tokenType, amount, walletAddress: ownerAddress, timestamp: new Date().toISOString(),
      });

      socketService.emitWalletEvent('stakingDetails', {
        gameId: `game_${Date.now()}`,
        tokenType,
        player1: { address: ownerAddress, amount: amount },
        player2: { address: 'pending', amount: amount },
        totalStaked: (parseFloat(amount) * 2).toString(),
        winnerPotential: (parseFloat(amount) * 2 * 0.9).toFixed(6),
        marketingFee: (parseFloat(amount) * 2 * 0.1).toFixed(6),
        timestamp: new Date().toISOString(),
      });

      // For the transaction, convert amounts to the smallest unit (9 decimals for both SUI and SUIMON)
      const minimalAmount = Math.floor(parseFloat(amount) * 1_000_000_000).toString(); // Convert to smallest unit

      const coinType = tokenType === 'SUI'
        ? '0x2::sui::SUI'
        : SUIMON_COIN_TYPE;

      const coins = await suiClient.getCoins({ owner: ownerAddress, coinType });
      if (!coins.data || coins.data.length === 0) throw new Error(`No ${tokenType} coins`);

      let paymentCoin;

      if (tokenType === 'SUI') {
        // For SUI, we can use the gas coin directly
        const balance = BigInt(suiBalance || '0');
        const need = BigInt(minimalAmount);
        if (balance < need) throw new Error('Insufficient SUI balance');
        paymentCoin = tx.splitCoins(tx.gas, [tx.pure.u64(minimalAmount)]);
      } else {
        // For SUIMON, we need to find coins with positive balance
        const available = coins.data.filter(c => BigInt(c.balance) > 0);
        const total = available.reduce((sum, c) => sum + BigInt(c.balance), BigInt(0));
        if (total < BigInt(minimalAmount)) throw new Error('Insufficient SUIMON');
        
        // Use the first coin and merge others if needed
        const c0 = tx.object(available[0].coinObjectId);
        if (available.length > 1) {
          tx.mergeCoins(c0, available.slice(1).map(c => tx.object(c.coinObjectId)));
        }
        
        // Split the coin to get the exact amount needed
        paymentCoin = tx.splitCoins(c0, [tx.pure.u64(minimalAmount)]);
      }

      const contractAddress = tokenType === 'SUI' ? SUI_GAME_CONTRACT : SUIMON_GAME_CONTRACT;
      const moduleName = tokenType === 'SUI' ? SUI_MODULE_NAME : SUIMON_MODULE_NAME;
      
      // Both contracts use 'create_game' method based on the contract code
      const methodName = 'create_game';

      const timestamp = Date.now();
      const generatedRoomId = tokenType === 'SUI' ? `Paid_Room_${timestamp}` : `Free_Room_${timestamp}`;
      setRoomId(generatedRoomId);

      // Based on the contract code, SUI and SUIMON contracts have different parameter expectations
      if (tokenType === 'SUI') {
        // SUI contract only expects the coin parameter
        tx.moveCall({
          target: `${contractAddress}::${moduleName}::${methodName}`,
          arguments: [
            paymentCoin, // Coin object
          ],
        });
      } else {
        // SUIMON contract expects the coin parameter and might need a context parameter
        // Let's try with just the coin parameter first as seen in the contract code
        tx.moveCall({
          target: `${contractAddress}::${moduleName}::${methodName}`,
          arguments: [
            paymentCoin, // Coin object
          ],
        });
      }
      
      console.log(`Creating ${tokenType} game with ${amount} tokens, room ID: ${generatedRoomId}`);

      
      // Add a transaction description for debugging
      console.log(`Creating ${tokenType} game with ${amount} tokens, room ID: ${generatedRoomId}`);


      setTransactionStage('signing');
      tx.setSender(ownerAddress);

      const txBytes = await tx.build({ client: suiRpcClient });
      const txBase64 = bytesToBase64(txBytes);

      const response = await signAndExecuteTransactionAsync({
        transaction: txBase64,
      });

      if (!response?.digest) throw new Error('No digest returned');

      const digest = response.digest;
      setTransactionHash(digest);
      setTransactionStage('executing');

      socketService.emitWalletEvent('transactionExecuting', { digest, tokenType, amount });

      setTransactionStage('confirming');

      const confirmedTx = await suiClient.waitForTransaction({
        digest,
        options: { showEffects: true, showEvents: true },
        timeout: 30000,
      });

      const status = confirmedTx?.effects?.status?.status;
      if (status !== 'success') {
        const err = confirmedTx?.effects?.status?.error || 'Unknown error';
        throw new Error(`Transaction failed: ${err}`);
      }

      setTransactionStage('success');
      socketService.emitWalletEvent('transactionSuccess', {
        digest,
        tokenType,
        amount,
        gameId: `game_${Date.now()}`,
        walletAddress: ownerAddress,
      });

      socketService.emitWalletEvent('addTransaction', {
        playerId: ownerAddress,
        gameId: `game_${Date.now()}`,
        transactionType: 'stake',
        tokenType,
        amount,
        transactionHash: digest,
        timestamp: new Date().toISOString(),
      });

    } catch (error: any) {
      console.error('Stake error:', error);
      let msg = error?.message || 'An unknown error';
      if (
        error?.name === 'UserRejectedRequestError' ||
        msg.includes('rejected') ||
        msg.includes('cancelled') ||
        msg.includes('denied')
      ) msg = 'Transaction rejected or cancelled';
      else if (msg.includes('Insufficient') || msg.includes('balance') || msg.includes('gas'))
        msg = `Insufficient ${tokenType} balance`;
      setTransactionStage('error');
      setTransactionError(msg);
      socketService.emitWalletEvent('transactionError', { error: msg, tokenType, amount });
    }
  };

  const handleFinalizeGameCreation = () => {
    onCreateGame(selectedToken, stakeAmount);
    setTransactionStage('idle');
    setTransactionError(undefined);
    setTransactionHash(undefined);
    setStakeAmount('');
    socketService.emitWalletEvent('gameCreationFinalized', {
      tokenType: selectedToken,
      amount: stakeAmount,
      timestamp: new Date().toISOString(),
    });
  };

  return (
    <div className="game-options">
      <div className="token-selector">
        <button
          className={`token-button ${selectedToken === 'SUI' ? 'active' : ''}`}
          onClick={() => {
            setSelectedToken('SUI');
            setStakeAmount('');
            setTransactionError(undefined);
            setTransactionStage('idle');
          }}>
          SUI Token <span className="balance">{formatBalance(suiBalance, 'SUI')} SUI</span>
        </button>
        <button
          className={`token-button ${selectedToken === 'SUIMON' ? 'active' : ''}`}
          onClick={() => {
            setSelectedToken('SUIMON');
            setStakeAmount('');
            setTransactionError(undefined);
            setTransactionStage('idle');
          }}>
          SUIMON Token <span className="balance">{formatBalance(suimonBalance, 'SUIMON')} SUIMON</span>
        </button>
      </div>

      {isPending && <div className="loading-overlay">Waiting for Wallet Confirmation...</div>}

      {!isPending && transactionStage === 'idle' ? (
        <div className="stake-options">
          <h3>Select Stake Amount</h3>
          <div className="options-grid">
            {(selectedToken === 'SUI' ? suiOptions : suimonOptions).map(option => (
              <button
                key={option.value}
                className={`stake-button ${stakeAmount === option.value ? 'selected' : ''}`}
                onClick={() => setStakeAmount(option.value)}
                disabled={!isConnected}>
                {option.label}
                <span className="gas-fee">+ Gas Fee</span>
              </button>
            ))}
          </div>
          {isConnected ? (
            <button
              className="stake-now-button"
              onClick={() => handleStakeButtonClick(selectedToken, stakeAmount)}
              disabled={!stakeAmount || transactionStage !== 'idle' || isPending}
            >
              {stakeAmount ? `Stake ${stakeAmount} ${selectedToken}` : 'Select Amount'}
            </button>
          ) : (
            <div className="connect-wallet-prompt">Connect wallet to stake</div>
          )}
        </div>
      ) : (
        (transactionStage !== 'idle' || isPending) && (
          <TransactionStatus
            stage={isPending ? 'signing' : transactionStage}
            error={transactionError}
            onCreateGame={handleFinalizeGameCreation}
            tokenType={selectedToken}
            amount={stakeAmount}
            transactionHash={transactionHash}
            roomId={roomId}
          />
        )
      )}
    </div>
  );
};

export default GameOptions;