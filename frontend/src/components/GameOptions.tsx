import React, { useState } from 'react';
import { useSuiClient, useCurrentAccount, useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { TransactionBlock } from '@mysten/sui.js/transactions';
import { SuiClient, getFullnodeUrl } from '@mysten/sui.js/client';
import { useSuiWallet } from '../context/SuiWalletContext';
import TransactionStatus, { TransactionStage } from './TransactionStatus';
import { socketService } from '../services/socketService';
import { SUIMON_COIN_TYPE } from '../utils/suimonTokenUtils';
import './GameOptions.css';

// Configure the network
const NETWORK = 'testnet'; // Options: 'testnet', 'devnet', 'mainnet'
const suiRpcClient = new SuiClient({ url: getFullnodeUrl(NETWORK) });

// Contract addresses
const SUI_GAME_CONTRACT = '0xba02ab9d67f2058424da11e1f063bff31683fd229a8408d87c018dea223ce4f0';
const SUI_MODULE_NAME = 'game';

// SUIMON contract addresses
const SUIMON_GAME_CONTRACT = '0x10d78dba03c656a2e9e6e88183b643128483ca38be8e4f8219ee73ef7fd10a22';
const SUIMON_MODULE_NAME = 'suimon_staking'; // Fixed: Removed incorrect 'suimon_token_paid_room' prefix

// Expected SUIMON_COIN_TYPE for validation
const EXPECTED_SUIMON_COIN_TYPE = '0xaae614cf7c6801a95b25d32bd3b9006d4b9f9841e9876584de37e885062d9425::suimon_token::SUIMON_TOKEN';

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
  const suiClient = useSuiClient();
  const currentAccount = useCurrentAccount() as CustomWalletAccount | null;
  const { mutateAsync: signAndExecuteTransactionAsync, isPending } = useSignAndExecuteTransaction();

  const [transactionStage, setTransactionStage] = useState<TransactionStage>('idle');
  const [transactionError, setTransactionError] = useState<string | undefined>();
  const [stakeAmount, setStakeAmount] = useState<string>('');
  const [transactionHash, setTransactionHash] = useState<string | undefined>();
  const [roomId, setRoomId] = useState<string | undefined>();
  const [selectedToken, setSelectedToken] = useState<TokenType>('SUI');

  const formatBalance = (balance: string | null | undefined, isSuimon: boolean = false) => {
    if (!balance) return '0';
    try {
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

    const requiredAmount = parseFloat(amount) * 1_000_000_000;
    const userBalanceBigInt = BigInt(selectedToken === 'SUI' ? suiBalance || '0' : suimonBalance || '0');
    const requiredAmountBigInt = BigInt(Math.floor(requiredAmount));

    console.log(`Balance check for ${selectedToken}:`, {
      amount,
      requiredAmount: requiredAmount.toString(),
      userBalance: selectedToken === 'SUI' ? suiBalance : suimonBalance,
      userBalanceFormatted: formatBalance(selectedToken === 'SUI' ? suiBalance : suimonBalance, selectedToken === 'SUIMON'),
      hasEnough: userBalanceBigInt >= requiredAmountBigInt,
    });

    if (userBalanceBigInt < requiredAmountBigInt) {
      setTransactionError(`Insufficient ${selectedToken} balance`);
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
        tokenType: selectedToken,
        amount,
        walletAddress: ownerAddress,
        timestamp: new Date().toISOString(),
      });

      socketService.emitWalletEvent('stakingDetails', {
        gameId: `game_${Date.now()}`,
        tokenType: selectedToken,
        player1: { address: ownerAddress, amount: amount },
        player2: { address: 'pending', amount: amount },
        totalStaked: (parseFloat(amount) * 2).toString(),
        winnerPotential: (parseFloat(amount) * 2 * 0.9).toFixed(6),
        marketingFee: (parseFloat(amount) * 2 * 0.1).toFixed(6),
        timestamp: new Date().toISOString(),
      });

      const minimalAmount = Math.floor(parseFloat(amount) * 1_000_000_000).toString();
      let paymentCoin;
      let generatedRoomId;
      const timestamp = Date.now();

      if (selectedToken === 'SUI') {
        const balance = BigInt(suiBalance || '0');
        const need = BigInt(minimalAmount);
        if (balance < need) throw new Error('Insufficient SUI balance');
        paymentCoin = tx.splitCoins(tx.gas, [tx.pure.u64(minimalAmount)]);

        generatedRoomId = `Paid_SUI_Room_${timestamp}`;
        setRoomId(generatedRoomId);

        tx.moveCall({
          target: `${SUI_GAME_CONTRACT}::${SUI_MODULE_NAME}::create_game`,
          arguments: [paymentCoin],
        });

        console.log(`Creating SUI game with ${amount} tokens, room ID: ${generatedRoomId}`);
      } else {
        if (SUIMON_COIN_TYPE !== EXPECTED_SUIMON_COIN_TYPE) {
          throw new Error(`Invalid SUIMON_COIN_TYPE. Expected: ${EXPECTED_SUIMON_COIN_TYPE}, but got: ${SUIMON_COIN_TYPE}`);
        }

        const coins = await suiClient.getCoins({
          owner: ownerAddress,
          coinType: SUIMON_COIN_TYPE,
        });

        if (!coins.data || coins.data.length === 0) {
          throw new Error('No SUIMON coins found');
        }

        console.log('SUIMON Balance Check:', {
          userBalance: suimonBalance,
          userBalanceFormatted: formatBalance(suimonBalance),
          requiredAmount: requiredAmount.toString(),
          requiredAmountBigInt: requiredAmountBigInt.toString(),
          userBalanceBigInt: userBalanceBigInt.toString(),
          hasEnough: userBalanceBigInt >= requiredAmountBigInt,
        });

        const available = coins.data.filter(c => BigInt(c.balance) > 0);
        const total = available.reduce((sum, c) => sum + BigInt(c.balance), BigInt(0));

        console.log('SUIMON Transaction Details:', {
          availableCoins: available.length,
          coinsData: available.map(c => ({ id: c.coinObjectId, balance: c.balance })),
          totalBalance: total.toString(),
          requiredAmount: minimalAmount,
          hasEnough: total >= BigInt(minimalAmount),
          coinType: SUIMON_COIN_TYPE,
        });

        if (total < BigInt(minimalAmount)) {
          throw new Error('Insufficient SUIMON balance');
        }

        if (available.length === 0) {
          throw new Error('No SUIMON coins with positive balance found');
        }

        const c0 = tx.object(available[0].coinObjectId);
        if (available.length > 1) {
          tx.mergeCoins(c0, available.slice(1).map(c => tx.object(c.coinObjectId)));
        }

        paymentCoin = tx.splitCoins(c0, [tx.pure.u64(minimalAmount)]);

        generatedRoomId = `Paid_SUIMON_Room_${timestamp}`;
        setRoomId(generatedRoomId);

        console.log('SUIMON Move Call Details:', {
          target: `${SUIMON_GAME_CONTRACT}::${SUIMON_MODULE_NAME}::create_game`,
          arguments: [paymentCoin],
        });

        tx.moveCall({
          target: `${SUIMON_GAME_CONTRACT}::${SUIMON_MODULE_NAME}::create_game`,
          arguments: [paymentCoin],
        });

        console.log(`Creating SUIMON game with ${amount} tokens, room ID: ${generatedRoomId}`);
      }

      setTransactionStage('signing');
      tx.setSender(ownerAddress);

      // Set the gas budget on the TransactionBlock
      tx.setGasBudget(100000000); // 100M MIST

      // Serialize the TransactionBlock to base64
      const txBytes = await tx.build({ client: suiRpcClient });
      const txBase64 = bytesToBase64(txBytes);

      const response = await signAndExecuteTransactionAsync({
        transaction: txBase64,
      });

      if (!response?.digest) throw new Error('No digest returned');

      const digest = response.digest;
      setTransactionHash(digest);
      setTransactionStage('executing');

      socketService.emitWalletEvent('transactionExecuting', { digest, tokenType: selectedToken, amount });

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
        tokenType: selectedToken,
        amount,
        gameId: `game_${Date.now()}`,
        walletAddress: ownerAddress,
      });

      socketService.emitWalletEvent('addTransaction', {
        playerId: ownerAddress,
        gameId: `game_${Date.now()}`,
        transactionType: 'stake',
        tokenType: selectedToken,
        amount,
        transactionHash: digest,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error('Stake error:', error);
      let msg = error?.message || 'An unknown error occurred';
      if (
        error?.name === 'UserRejectedRequestError' ||
        msg.includes('rejected') ||
        msg.includes('cancelled') ||
        msg.includes('denied')
      ) {
        msg = 'Transaction rejected or cancelled';
      } else if (msg.includes('Insufficient') || msg.includes('balance') || msg.includes('gas')) {
        msg = `Insufficient ${selectedToken} balance`;
      } else if (msg.includes('VMVerificationOrDeserializationError')) {
        msg = 'Failed to verify the transaction. Please check the smart contract configuration or wallet compatibility.';
      } else if (msg.includes('toJSON is not a function')) {
        msg = 'Transaction serialization failed. Please ensure the library versions are compatible.';
      }
      setTransactionStage('error');
      setTransactionError(msg);
      socketService.emitWalletEvent('transactionError', { error: msg, tokenType: selectedToken, amount });
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
      roomId: roomId,
      timestamp: new Date().toISOString(),
    });
  };

  return (
    <div className="game-options">
      <div className="token-selector">
        <button
          className={`token-button ${selectedToken === 'SUI' ? 'active' : ''}`}
          onClick={() => setSelectedToken('SUI')}>
          SUI Token <span className="balance">{formatBalance(suiBalance)} SUI</span>
        </button>
        <button
          className={`token-button ${selectedToken === 'SUIMON' ? 'active' : ''}`}
          onClick={() => setSelectedToken('SUIMON')}>
          SUIMON Token <span className="balance">{formatBalance(suimonBalance, true)} SUIMON</span>
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
              onClick={() => handleStakeButtonClick(stakeAmount)}
              disabled={!stakeAmount || transactionStage !== 'idle' || isPending}>
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