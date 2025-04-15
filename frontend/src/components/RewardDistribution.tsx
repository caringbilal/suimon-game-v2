import React, { useState } from 'react';
import { useSuiClient, useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { SuiClient } from '@mysten/sui.js/client';
import { useSuiWallet } from '../context/SuiWalletContext';
import TransactionStatus, { TransactionStage } from './TransactionStatus';
import { socketService } from '../services/socketService';
import { distributeRewards, connectBattleOutcome } from '../utils/rewardSystem';
import './RewardDistribution.css';

interface RewardDistributionProps {
  gameId: string;
  winner: {
    address: string;
    name: string;
  };
  loser: {
    address: string;
    name: string;
  };
  tokenType: 'SUI' | 'SUIMON';
  stakeAmount: string;
  onRewardClaimed: () => void;
}

const RewardDistribution: React.FC<RewardDistributionProps> = ({
  gameId,
  winner,
  loser,
  tokenType,
  stakeAmount,
  onRewardClaimed
}) => {
  const { walletAddress } = useSuiWallet();
  const suiClient = useSuiClient();
  const { mutateAsync: signAndExecuteTransactionAsync, isPending } = useSignAndExecuteTransaction();

  const [transactionStage, setTransactionStage] = useState<TransactionStage>('idle');
  const [transactionError, setTransactionError] = useState<string | undefined>();
  const [transactionHash, setTransactionHash] = useState<string | undefined>();

  // Calculate total staked amount (both players)
  const totalStaked = (parseFloat(stakeAmount) * 2).toString();
  
  // Calculate reward amounts
  const winnerReward = (parseFloat(totalStaked) * 0.9).toFixed(6);
  const marketingFee = (parseFloat(totalStaked) * 0.1).toFixed(6);

  const handleClaimRewards = async () => {
    if (!walletAddress) {
      setTransactionError('Wallet not connected');
      setTransactionStage('error');
      return;
    }

    // Check if the current user is the winner
    if (walletAddress !== winner.address) {
      setTransactionError('Only the winner can claim rewards');
      setTransactionStage('error');
      return;
    }

    setTransactionStage('preparing');
    setTransactionError(undefined);
    setTransactionHash(undefined);

    try {
      // Log the claim attempt
      socketService.emitWalletEvent('rewardClaimAttempt', {
        gameId,
        winner,
        loser,
        tokenType,
        totalStaked,
        winnerReward,
        marketingFee,
        timestamp: new Date().toISOString()
      });

      // Connect battle outcome to get game object ID
      const gameObjectId = await connectBattleOutcome(
        {
          gameId,
          winner,
          loser,
          tokenType,
          stakeAmount,
          totalStaked
        },
        suiClient
      );

      setTransactionStage('signing');

      // Distribute rewards
      const rewardData = await distributeRewards(
        suiClient,
        signAndExecuteTransactionAsync,
        gameObjectId,
        winner.address,
        tokenType,
        gameId,
        totalStaked
      );

      setTransactionHash(rewardData.transactionHash);
      setTransactionStage('success');

      // Update player info in database
      socketService.emitWalletEvent('updatePlayerInfo', {
        gameId,
        winner: {
          address: winner.address,
          name: winner.name,
          reward: winnerReward,
          tokenType
        },
        loser: {
          address: loser.address,
          name: loser.name
        },
        timestamp: new Date().toISOString()
      });

    } catch (error: any) {
      console.error('Reward claim error:', error);
      let msg = error?.message || 'An unknown error';
      if (
        error?.name === 'UserRejectedRequestError' ||
        msg.includes('rejected') ||
        msg.includes('cancelled') ||
        msg.includes('denied')
      ) msg = 'Transaction rejected or cancelled';
      
      setTransactionStage('error');
      setTransactionError(msg);
      socketService.emitWalletEvent('rewardClaimError', { error: msg, gameId, tokenType });
    }
  };

  const handleFinalize = () => {
    onRewardClaimed();
    setTransactionStage('idle');
    setTransactionError(undefined);
    setTransactionHash(undefined);
    socketService.emitWalletEvent('rewardClaimFinalized', {
      gameId,
      tokenType,
      timestamp: new Date().toISOString(),
    });
  };

  return (
    <div className="reward-distribution">
      <h3>Game Rewards</h3>
      
      <div className="reward-details">
        <div className="reward-info">
          <div className="info-row">
            <span className="label">Game ID:</span>
            <span className="value">{gameId}</span>
          </div>
          <div className="info-row">
            <span className="label">Token Type:</span>
            <span className="value">{tokenType}</span>
          </div>
          <div className="info-row">
            <span className="label">Total Staked:</span>
            <span className="value">{totalStaked} {tokenType}</span>
          </div>
          <div className="info-row winner-row">
            <span className="label">Winner Reward (90%):</span>
            <span className="value">{winnerReward} {tokenType}</span>
          </div>
          <div className="info-row fee-row">
            <span className="label">Marketing Fee (10%):</span>
            <span className="value">{marketingFee} {tokenType}</span>
          </div>
        </div>

        <div className="players-info">
          <div className="player winner">
            <div className="player-label">Winner</div>
            <div className="player-name">{winner.name}</div>
            <div className="player-address">{winner.address.substring(0, 8)}...{winner.address.substring(winner.address.length - 6)}</div>
          </div>
          <div className="player loser">
            <div className="player-label">Loser</div>
            <div className="player-name">{loser.name}</div>
            <div className="player-address">{loser.address.substring(0, 8)}...{loser.address.substring(loser.address.length - 6)}</div>
          </div>
        </div>
      </div>

      {isPending && <div className="loading-overlay">Waiting for Wallet Confirmation...</div>}

      {!isPending && transactionStage === 'idle' ? (
        <button
          className="claim-rewards-button"
          onClick={handleClaimRewards}
          disabled={walletAddress !== winner.address}
        >
          {walletAddress === winner.address ? 'Claim Rewards' : 'Only Winner Can Claim'}
        </button>
      ) : (
        (transactionStage !== 'idle' || isPending) && (
          <TransactionStatus
            stage={isPending ? 'signing' : transactionStage}
            error={transactionError}
            onCreateGame={handleFinalize}
            tokenType={tokenType}
            amount={winnerReward}
            transactionHash={transactionHash}
          />
        )
      )}
    </div>
  );
};

export default RewardDistribution;