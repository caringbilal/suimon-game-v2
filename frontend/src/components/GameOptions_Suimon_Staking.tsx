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
const SUIMON_GAME_CONTRACT = '0xd87d922719e3267aa78c9537b98a53af03086576afcb23ea7a035b39260cb747';
const SUIMON_MODULE_NAME = 'suimon_staking';

type TokenType = 'SUIMON';

interface CustomWalletAccount {
  address: string;
  [key: string]: any;
}

interface GameOptionsSuimonProps {
  onCreateGame: (tokenType: TokenType, amount: string) => void;
}

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

const GameOptionsSuimon: React.FC<GameOptionsSuimonProps> = ({ onCreateGame }) => {
  const { walletAddress, suimonBalance, isConnected } = useSuiWallet();
  const suiClient = useSuiClient(); // Used for blockchain interactions like waitForTransaction
  const currentAccount = useCurrentAccount() as CustomWalletAccount | null;
  const { mutateAsync: signAndExecuteTransactionAsync, isPending } = useSignAndExecuteTransaction();

  const [transactionStage, setTransactionStage] = useState<TransactionStage>('idle');
  const [transactionError, setTransactionError] = useState<string | undefined>();
  const [stakeAmount, setStakeAmount] = useState<string>('');
  const [transactionHash, setTransactionHash] = useState<string | undefined>();
  const [roomId, setRoomId] = useState<string | undefined>();

  const formatBalance = (balance: string | null | undefined) => {
    if (!balance) return '0';
    try {
      // SUIMON tokens are stored with 9 decimal places in the blockchain
      // We need to convert from the smallest unit to the display unit
      const num = parseFloat(balance) / 1_000_000_000;
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

  const handleStakeButtonClick = async (amount: string) => {
    if (!isConnected || !currentAccount?.address) {
      setTransactionError('Wallet not connected');
      setTransactionStage('error');
      return;
    }

    // Check if user has sufficient balance
    // IMPORTANT: The balance is already in the smallest unit (9 decimals)
    // Convert the stake amount to the smallest unit for comparison
    const requiredAmount = parseFloat(amount) * 1_000_000_000; // Convert to smallest unit (9 decimals)

    // Convert to BigInt for safe comparison
    const userBalanceBigInt = BigInt(suimonBalance || '0');
    const requiredAmountBigInt = BigInt(Math.floor(requiredAmount));

    console.log('SUIMON Balance Check:', {
      userBalance: suimonBalance,
      userBalanceFormatted: formatBalance(suimonBalance),
      requiredAmount: requiredAmount.toString(),
      requiredAmountBigInt: requiredAmountBigInt.toString(),
      userBalanceBigInt: userBalanceBigInt.toString(),
      hasEnough: userBalanceBigInt >= requiredAmountBigInt
    });

    if (userBalanceBigInt < requiredAmountBigInt) {
      setTransactionError(`Insufficient SUIMON balance`);
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
        tokenType: 'SUIMON', amount, walletAddress: ownerAddress, timestamp: new Date().toISOString(),
      });

      socketService.emitWalletEvent('stakingDetails', {
        gameId: `game_${Date.now()}`,
        tokenType: 'SUIMON',
        player1: { address: ownerAddress, amount: amount },
        player2: { address: 'pending', amount: amount },
        totalStaked: (parseFloat(amount) * 2).toString(),
        winnerPotential: (parseFloat(amount) * 2 * 0.9).toFixed(6),
        marketingFee: (parseFloat(amount) * 2 * 0.1).toFixed(6),
        timestamp: new Date().toISOString(),
      });

      // Convert to the smallest unit (9 decimals)
      const minimalAmount = Math.floor(parseFloat(amount) * 1_000_000_000).toString();

      // Get SUIMON coins
      const coins = await suiClient.getCoins({ 
        owner: ownerAddress, 
        coinType: SUIMON_COIN_TYPE 
      });
      
      if (!coins.data || coins.data.length === 0) {
        throw new Error('No SUIMON coins found');
      }

      // For SUIMON, we need to find coins with positive balance
      const available = coins.data.filter(c => BigInt(c.balance) > 0);
      const total = available.reduce((sum, c) => sum + BigInt(c.balance), BigInt(0));
      
      console.log('SUIMON Transaction Details:', {
        availableCoins: available.length,
        totalBalance: total.toString(),
        requiredAmount: minimalAmount,
        hasEnough: total >= BigInt(minimalAmount)
      });
      
      if (total < BigInt(minimalAmount)) {
        throw new Error('Insufficient SUIMON balance');
      }
      
      // Use the first coin and merge others if needed
      const c0 = tx.object(available[0].coinObjectId);
      if (available.length > 1) {
        tx.mergeCoins(c0, available.slice(1).map(c => tx.object(c.coinObjectId)));
      }
      
      // Split the coin to get the exact amount needed
      const paymentCoin = tx.splitCoins(c0, [tx.pure.u64(minimalAmount)]);

      // Generate room ID
      const timestamp = Date.now();
      const generatedRoomId = `Free_Room_${timestamp}`;
      setRoomId(generatedRoomId);

      // Call the contract method
      tx.moveCall({
        target: `${SUIMON_GAME_CONTRACT}::${SUIMON_MODULE_NAME}::create_game`,
        arguments: [
          paymentCoin, // Coin object
        ],
      });
      
      console.log(`Creating SUIMON game with ${amount} tokens, room ID: ${generatedRoomId}`);

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

      socketService.emitWalletEvent('transactionExecuting', { digest, tokenType: 'SUIMON', amount });

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
        tokenType: 'SUIMON',
        amount,
        gameId: `game_${Date.now()}`,
        walletAddress: ownerAddress,
      });

      socketService.emitWalletEvent('addTransaction', {
        playerId: ownerAddress,
        gameId: `game_${Date.now()}`,
        transactionType: 'stake',
        tokenType: 'SUIMON',
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
        msg = `Insufficient SUIMON balance`;
      setTransactionStage('error');
      setTransactionError(msg);
      socketService.emitWalletEvent('transactionError', { error: msg, tokenType: 'SUIMON', amount });
    }
  };

  const handleFinalizeGameCreation = () => {
    onCreateGame('SUIMON', stakeAmount);
    setTransactionStage('idle');
    setTransactionError(undefined);
    setTransactionHash(undefined);
    setStakeAmount('');
    socketService.emitWalletEvent('gameCreationFinalized', {
      tokenType: 'SUIMON',
      amount: stakeAmount,
      timestamp: new Date().toISOString(),
    });
  };

  return (
    <div className="game-options">
      <div className="token-selector">
        <button
          className="token-button active">
          SUIMON Token <span className="balance">{formatBalance(suimonBalance)} SUIMON</span>
        </button>
      </div>

      {isPending && <div className="loading-overlay">Waiting for Wallet Confirmation...</div>}

      {!isPending && transactionStage === 'idle' ? (
        <div className="stake-options">
          <h3>Select Stake Amount</h3>
          <div className="options-grid">
            {suimonOptions.map(option => (
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
              onClick={() => handleStakeButtonClick(stakeAmount)}
              disabled={!stakeAmount || transactionStage !== 'idle' || isPending}
            >
              {stakeAmount ? `Stake ${stakeAmount} SUIMON` : 'Select Amount'}
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
            tokenType="SUIMON"
            amount={stakeAmount}
            transactionHash={transactionHash}
            roomId={roomId}
          />
        )
      )}
    </div>
  );
};

export default GameOptionsSuimon;