import React, { useState } from 'react';
import { useSuiClient, useCurrentAccount, useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { TransactionBlock } from '@mysten/sui.js/transactions';
import { SuiClient, getFullnodeUrl } from '@mysten/sui.js/client';
import { useSuiWallet } from '../context/SuiWalletContext';
import TransactionStatus, { TransactionStage } from './TransactionStatus';
import { socketService } from '../services/socketService';
import './GameOptions.css';

// Explicit client for offline tx build
const suiRpcClient = new SuiClient({ url: getFullnodeUrl('testnet') });  // or 'mainnet'

// contract addresses
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
  { label: '1,000 SUIMON', value: '1000' },
  { label: '10,000 SUIMON', value: '10000' },
  { label: '100,000 SUIMON', value: '100000' },
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
  const suiClient = useSuiClient(); // still used elsewhere e.g. waitForTransaction
  const currentAccount = useCurrentAccount() as CustomWalletAccount | null;
  const { mutateAsync: signAndExecuteTransactionAsync, isPending } = useSignAndExecuteTransaction();

  const [selectedToken, setSelectedToken] = useState<TokenType>('SUI');
  const [transactionStage, setTransactionStage] = useState<TransactionStage>('idle');
  const [transactionError, setTransactionError] = useState<string | undefined>();
  const [stakeAmount, setStakeAmount] = useState<string>('');
  const [transactionHash, setTransactionHash] = useState<string | undefined>();

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

      const minimalAmount = tokenType === 'SUI'
        ? Math.floor(parseFloat(amount) * 1_000_000_000).toString()
        : parseInt(amount, 10).toString();

      const coinType = tokenType === 'SUI'
        ? '0x2::sui::SUI'
        : '0xc0ba93a810adb498900c82bb6f7c16ca3046dfa7b6f364ec985595fdeb1ee9ad::suimon::SUIMON';

      const coins = await suiClient.getCoins({ owner: ownerAddress, coinType });
      if (!coins.data || coins.data.length === 0) throw new Error(`No ${tokenType} coins`);

      let paymentCoin;

      if (tokenType === 'SUI') {
        const balance = BigInt(suiBalance || '0');
        const need = BigInt(minimalAmount);
        if (balance < need) throw new Error('Insufficient SUI balance');
        paymentCoin = tx.splitCoins(tx.gas, [tx.pure.u64(minimalAmount)]);
      } else {
        const available = coins.data.filter(c => BigInt(c.balance) > 0);
        const total = available.reduce((sum, c) => sum + BigInt(c.balance), BigInt(0));
        if (total < BigInt(minimalAmount)) throw new Error('Insufficient SUIMON');
        const c0 = tx.object(available[0].coinObjectId);
        if (available.length > 1) {
          tx.mergeCoins(c0, available.slice(1).map(c => tx.object(c.coinObjectId)));
        }
        paymentCoin = tx.splitCoins(c0, [tx.pure.u64(minimalAmount)]);
      }

      const contractAddress = tokenType === 'SUI' ? SUI_GAME_CONTRACT : SUIMON_GAME_CONTRACT;
      const moduleName = tokenType === 'SUI' ? SUI_MODULE_NAME : SUIMON_MODULE_NAME;
      const methodName = tokenType === 'SUI' ? 'create_game' : 'create_room';

      if (tokenType === 'SUI') {
        tx.moveCall({
          target: `${contractAddress}::${moduleName}::${methodName}`,
          arguments: [paymentCoin],
        });
      } else {
        const roomId = `room_${Date.now()}`;
        tx.moveCall({
          target: `${contractAddress}::${moduleName}::${methodName}`,
          arguments: [
            paymentCoin,
            tx.pure.string(roomId),
            tx.pure.string('Player'),
          ],
        });
      }

      setTransactionStage('signing');

      // Important: set sender!
      tx.setSender(ownerAddress);

      const txBytes = await tx.build({ client: suiRpcClient });  // pass explicit provider here!
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
        options: {
          showEffects: true,
          showEvents: true,
        },
      });

      const status = confirmedTx?.effects?.status?.status;
      if (status !== 'success') {
        const err = confirmedTx?.effects?.status?.error || 'Unknown error';
        throw new Error(`Transaction failed: ${err}`);
      }

      setTransactionStage('success');
      socketService.emitWalletEvent('transactionSuccess', { digest, tokenType, amount });

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
                {selectedToken === 'SUI' && <span className="gas-fee">+ Gas Fee</span>}
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
          />
        )
      )}
    </div>
  );
};

export default GameOptions;
