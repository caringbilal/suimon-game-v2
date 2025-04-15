import { TransactionBlock } from '@mysten/sui.js/transactions';
import { SuiClient } from '@mysten/sui.js/client';
import { socketService } from '../services/socketService';

// Contract addresses (using the existing ones from GameOptions.tsx)
const SUI_GAME_CONTRACT = '0xba02ab9d67f2058424da11e1f063bff31683fd229a8408d87c018dea223ce4f0';
const SUIMON_GAME_CONTRACT = '0xd87d922719e3267aa78c9537b98a53af03086576afcb23ea7a035b39260cb747';

// Module names
const SUI_MODULE_NAME = 'game';
const SUIMON_MODULE_NAME = 'suimon_staking';

// Marketing wallet that receives 10% fee
const MARKETING_WALLET = '0x975109d5f34edee5556a431d3e4658bb7007389519c415d86c10c63a286ebf2b';
const FEE_PERCENTAGE = 10; // 10% fee

// Token types
type TokenType = 'SUI' | 'SUIMON';

/**
 * Interface for game result data
 */
interface GameResultData {
  gameId: string;
  winner: {
    address: string;
    name: string;
  };
  loser: {
    address: string;
    name: string;
  };
  tokenType: TokenType;
  stakeAmount: string;
  totalStaked: string; // Total amount staked by both players
}

/**
 * Interface for reward distribution data
 */
interface RewardDistributionData {
  gameId: string;
  winnerAddress: string;
  winnerAmount: string;
  marketingAmount: string;
  tokenType: TokenType;
  transactionHash: string;
}

/**
 * Logs detailed staking information
 * @param tokenType The type of token staked ('SUI' or 'SUIMON')
 * @param player1Address Player 1's wallet address
 * @param player1Amount Amount staked by player 1
 * @param player2Address Player 2's wallet address
 * @param player2Amount Amount staked by player 2
 * @param gameId The game ID
 */
export function logStakingDetails(
  tokenType: TokenType,
  player1Address: string,
  player1Amount: string,
  player2Address: string,
  player2Amount: string,
  gameId: string
) {
  const totalStaked = parseFloat(player1Amount) + parseFloat(player2Amount);
  const formattedTotal = tokenType === 'SUI' 
    ? totalStaked.toFixed(6) 
    : Math.floor(totalStaked).toString();

  console.group(`=== Staking Details for Game ${gameId} ===`);
  console.log(`Token Type: ${tokenType}`);
  console.log(`Player 1 (${player1Address.substring(0, 8)}...): ${player1Amount} ${tokenType}`);
  console.log(`Player 2 (${player2Address.substring(0, 8)}...): ${player2Amount} ${tokenType}`);
  console.log(`Total Staked: ${formattedTotal} ${tokenType}`);
  console.log(`Potential Winner Reward (90%): ${(totalStaked * 0.9).toFixed(6)} ${tokenType}`);
  console.log(`Marketing Fee (10%): ${(totalStaked * 0.1).toFixed(6)} ${tokenType}`);
  console.groupEnd();

  // Emit socket event for backend logging
  socketService.emitWalletEvent('stakingDetails', {
    gameId,
    tokenType,
    player1: {
      address: player1Address,
      amount: player1Amount
    },
    player2: {
      address: player2Address,
      amount: player2Amount
    },
    totalStaked: formattedTotal,
    winnerPotential: (totalStaked * 0.9).toFixed(6),
    marketingFee: (totalStaked * 0.1).toFixed(6),
    timestamp: new Date().toISOString()
  });
}

/**
 * Connects battle outcome with staking contracts
 * @param gameResult The game result data
 * @param suiClient The Sui client instance
 */
export async function connectBattleOutcome(
  gameResult: GameResultData,
  suiClient: SuiClient
): Promise<string> {
  try {
    // Log the battle outcome
    console.group(`=== Battle Outcome for Game ${gameResult.gameId} ===`);
    console.log(`Winner: ${gameResult.winner.name} (${gameResult.winner.address.substring(0, 8)}...)`);
    console.log(`Loser: ${gameResult.loser.name} (${gameResult.loser.address.substring(0, 8)}...)`);
    console.log(`Token Type: ${gameResult.tokenType}`);
    console.log(`Total Staked: ${gameResult.totalStaked} ${gameResult.tokenType}`);
    console.groupEnd();

    // Emit socket event for backend logging
    socketService.emitWalletEvent('battleOutcome', {
      gameId: gameResult.gameId,
      winner: gameResult.winner,
      loser: gameResult.loser,
      tokenType: gameResult.tokenType,
      totalStaked: gameResult.totalStaked,
      timestamp: new Date().toISOString()
    });

    // Determine which contract to use based on token type
    const contractAddress = gameResult.tokenType === 'SUI' ? SUI_GAME_CONTRACT : SUIMON_GAME_CONTRACT;
    const moduleName = gameResult.tokenType === 'SUI' ? SUI_MODULE_NAME : SUIMON_MODULE_NAME;

    // Get the game object ID from the contract
    // This is a placeholder - in a real implementation, you would query the contract
    // to get the actual game object ID based on the gameId
    const gameObjectId = `game_${gameResult.gameId}`;

    return gameObjectId;
  } catch (error) {
    console.error('Error connecting battle outcome:', error);
    socketService.emitWalletEvent('battleOutcomeError', {
      gameId: gameResult.gameId,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
    throw error;
  }
}

/**
 * Creates a transaction to distribute rewards to the winner and marketing wallet
 * @param gameObjectId The game object ID
 * @param winnerAddress The winner's wallet address
 * @param tokenType The type of token ('SUI' or 'SUIMON')
 */
export function createRewardDistributionTransaction(
  gameObjectId: string,
  winnerAddress: string,
  tokenType: TokenType
): TransactionBlock {
  const tx = new TransactionBlock();

  // Determine which contract to use based on token type
  const contractAddress = tokenType === 'SUI' ? SUI_GAME_CONTRACT : SUIMON_GAME_CONTRACT;
  const moduleName = tokenType === 'SUI' ? SUI_MODULE_NAME : SUIMON_MODULE_NAME;

  // Call the distribute_rewards function from the smart contract
  tx.moveCall({
    target: `${contractAddress}::${moduleName}::distribute_rewards`,
    arguments: [
      tx.object(gameObjectId),
      tx.pure.address(winnerAddress),
      tx.pure.address(MARKETING_WALLET),
      tx.pure.u64(FEE_PERCENTAGE)
    ],
  });

  return tx;
}

/**
 * Distributes rewards to the winner and marketing wallet
 * @param suiClient The Sui client instance
 * @param signAndExecuteTransactionBlock The sign and execute transaction hook
 * @param gameObjectId The game object ID
 * @param winnerAddress The winner's wallet address
 * @param tokenType The type of token ('SUI' or 'SUIMON')
 * @param gameId The game ID for logging
 * @param totalStaked The total amount staked
 */
export async function distributeRewards(
  suiClient: SuiClient,
  signAndExecuteTransactionBlock: any,
  gameObjectId: string,
  winnerAddress: string,
  tokenType: TokenType,
  gameId: string,
  totalStaked: string
) {
  try {
    // Create the transaction
    const tx = createRewardDistributionTransaction(gameObjectId, winnerAddress, tokenType);

    // Log the reward distribution attempt
    console.group(`=== Reward Distribution for Game ${gameId} ===`);
    console.log(`Game Object ID: ${gameObjectId}`);
    console.log(`Winner Address: ${winnerAddress.substring(0, 8)}...`);
    console.log(`Token Type: ${tokenType}`);
    console.log(`Total Staked: ${totalStaked} ${tokenType}`);
    console.log(`Winner Amount (90%): ${(parseFloat(totalStaked) * 0.9).toFixed(6)} ${tokenType}`);
    console.log(`Marketing Amount (10%): ${(parseFloat(totalStaked) * 0.1).toFixed(6)} ${tokenType}`);
    console.groupEnd();

    // Emit socket event for backend logging
    socketService.emitWalletEvent('rewardDistributionAttempt', {
      gameId,
      gameObjectId,
      winnerAddress,
      tokenType,
      totalStaked,
      winnerAmount: (parseFloat(totalStaked) * 0.9).toFixed(6),
      marketingAmount: (parseFloat(totalStaked) * 0.1).toFixed(6),
      timestamp: new Date().toISOString()
    });

    // Execute the transaction
    const response = await signAndExecuteTransactionBlock({
      transaction: tx,
      options: {
        showEffects: true,
        showEvents: true,
      },
    });

    if (!response?.digest) {
      throw new Error('No transaction digest returned');
    }

    const digest = response.digest;

    // Wait for transaction confirmation
    const confirmedTx = await suiClient.waitForTransactionBlock({
      digest,
      options: {
        showEffects: true,
        showEvents: true,
      },
    });

    // Check if transaction was successful
    if (!confirmedTx?.effects?.status?.status || confirmedTx.effects.status.status !== 'success') {
      const error = confirmedTx?.effects?.status?.error || 'Unknown error';
      throw new Error(`Transaction failed: ${error}`);
    }

    // Log the successful reward distribution
    const winnerAmount = (parseFloat(totalStaked) * 0.9).toFixed(6);
    const marketingAmount = (parseFloat(totalStaked) * 0.1).toFixed(6);

    console.group(`=== Reward Distribution Success for Game ${gameId} ===`);
    console.log(`Transaction Hash: ${digest}`);
    console.log(`Winner (${winnerAddress.substring(0, 8)}...) received: ${winnerAmount} ${tokenType}`);
    console.log(`Marketing wallet received: ${marketingAmount} ${tokenType}`);
    console.groupEnd();

    // Emit socket event for backend logging
    const rewardData: RewardDistributionData = {
      gameId,
      winnerAddress,
      winnerAmount,
      marketingAmount,
      tokenType,
      transactionHash: digest
    };

    socketService.emitWalletEvent('rewardDistributionSuccess', {
      ...rewardData,
      timestamp: new Date().toISOString()
    });

    return rewardData;
  } catch (error) {
    console.error('Error distributing rewards:', error);
    socketService.emitWalletEvent('rewardDistributionError', {
      gameId,
      gameObjectId,
      winnerAddress,
      tokenType,
      totalStaked,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
    throw error;
  }
}

/**
 * Updates player information in the database based on game results and rewards
 * @param gameId The game ID
 * @param winnerAddress The winner's wallet address
 * @param winnerName The winner's name
 * @param loserAddress The loser's wallet address
 * @param loserName The loser's name
 * @param tokenType The type of token ('SUI' or 'SUIMON')
 * @param rewardAmount The amount rewarded to the winner
 */
export function updatePlayerInfo(
  gameId: string,
  winnerAddress: string,
  winnerName: string,
  loserAddress: string,
  loserName: string,
  tokenType: TokenType,
  rewardAmount: string
) {
  // Emit socket event to update player information in the database
  socketService.emitWalletEvent('updatePlayerInfo', {
    gameId,
    winner: {
      address: winnerAddress,
      name: winnerName,
      reward: rewardAmount,
      tokenType
    },
    loser: {
      address: loserAddress,
      name: loserName
    },
    timestamp: new Date().toISOString()
  });

  console.group(`=== Player Info Update for Game ${gameId} ===`);
  console.log(`Winner: ${winnerName} (${winnerAddress.substring(0, 8)}...)`);
  console.log(`Loser: ${loserName} (${loserAddress.substring(0, 8)}...)`);
  console.log(`Token Type: ${tokenType}`);
  console.log(`Reward Amount: ${rewardAmount} ${tokenType}`);
  console.groupEnd();
}