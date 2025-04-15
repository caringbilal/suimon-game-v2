// rewardHandler.js - Backend handler for reward system
import { updatePlayerStats, getPlayer } from '../database/players.js';
import { updateGame, getGame } from '../database/games.js';
import db from '../database/sqlite.js';

// Marketing wallet that receives 10% fee
const MARKETING_WALLET = '0x975109d5f34edee5556a431d3e4658bb7007389519c415d86c10c63a286ebf2b';
const FEE_PERCENTAGE = 10; // 10% fee

/**
 * Log staking details for a game
 * @param {Object} data - Staking details data
 */
export const logStakingDetails = async (data) => {
  const { gameId, tokenType, player1, player2, totalStaked, winnerPotential, marketingFee } = data;
  
  console.group(`=== Staking Details for Game ${gameId} ===`);
  console.log(`Token Type: ${tokenType}`);
  console.log(`Player 1 (${player1.address.substring(0, 8)}...): ${player1.amount} ${tokenType}`);
  console.log(`Player 2 (${player2.address.substring(0, 8)}...): ${player2.amount} ${tokenType}`);
  console.log(`Total Staked: ${totalStaked} ${tokenType}`);
  console.log(`Potential Winner Reward (90%): ${winnerPotential} ${tokenType}`);
  console.log(`Marketing Fee (10%): ${marketingFee} ${tokenType}`);
  console.groupEnd();
  
  try {
    // Update game record with staking information
    await updateGame(gameId, {
      tokenType,
      tokenAmount: totalStaked,
      stakingDetails: JSON.stringify({
        player1Stake: player1.amount,
        player2Stake: player2.amount,
        totalStaked,
        winnerPotential,
        marketingFee,
        timestamp: new Date().toISOString()
      })
    });
    
    // Update player wallet information if needed
    const p1 = await getPlayer(player1.address);
    if (p1) {
      await updatePlayerWalletInfo(player1.address, tokenType, player1.amount, 'stake');
    }
    
    const p2 = await getPlayer(player2.address);
    if (p2) {
      await updatePlayerWalletInfo(player2.address, tokenType, player2.amount, 'stake');
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error logging staking details:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Process battle outcome and connect with staking contracts
 * @param {Object} data - Battle outcome data
 */
export const processBattleOutcome = async (data) => {
  const { gameId, winner, loser, tokenType, totalStaked } = data;
  
  console.group(`=== Battle Outcome for Game ${gameId} ===`);
  console.log(`Winner: ${winner.name} (${winner.address.substring(0, 8)}...)`);
  console.log(`Loser: ${loser.name} (${loser.address.substring(0, 8)}...)`);
  console.log(`Token Type: ${tokenType}`);
  console.log(`Total Staked: ${totalStaked} ${tokenType}`);
  console.groupEnd();
  
  try {
    // Update game record with battle outcome
    await updateGame(gameId, {
      winner: winner.address,
      winnerName: winner.name,
      battleOutcome: JSON.stringify({
        winner,
        loser,
        tokenType,
        totalStaked,
        timestamp: new Date().toISOString()
      })
    });
    
    // Update player stats
    await updatePlayerStats(winner.address, 1, 0);
    await updatePlayerStats(loser.address, 0, 1);
    
    return { success: true, gameObjectId: `game_${gameId}` };
  } catch (error) {
    console.error('Error processing battle outcome:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Process reward distribution
 * @param {Object} data - Reward distribution data
 */
export const processRewardDistribution = async (data) => {
  const { gameId, winnerAddress, winnerAmount, marketingAmount, tokenType, transactionHash } = data;
  
  console.group(`=== Reward Distribution for Game ${gameId} ===`);
  console.log(`Transaction Hash: ${transactionHash}`);
  console.log(`Winner (${winnerAddress.substring(0, 8)}...) received: ${winnerAmount} ${tokenType}`);
  console.log(`Marketing wallet received: ${marketingAmount} ${tokenType}`);
  console.groupEnd();
  
  try {
    // Get game details
    const game = await getGame(gameId);
    if (!game) {
      throw new Error(`Game ${gameId} not found`);
    }
    
    // Update game record with reward distribution details
    await updateGame(gameId, {
      rewardDistribution: JSON.stringify({
        winnerAddress,
        winnerAmount,
        marketingAmount,
        tokenType,
        transactionHash,
        timestamp: new Date().toISOString()
      })
    });
    
    // Update winner's wallet info
    await updatePlayerWalletInfo(winnerAddress, tokenType, winnerAmount, 'reward');
    
    return { success: true };
  } catch (error) {
    console.error('Error processing reward distribution:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Update player wallet information
 * @param {string} playerId - Player ID
 * @param {string} tokenType - Token type ('SUI' or 'SUIMON')
 * @param {string} amount - Amount of tokens
 * @param {string} operation - Operation type ('stake' or 'reward')
 */
export const updatePlayerWalletInfo = async (playerId, tokenType, amount, operation) => {
  try {
    // Get current player info
    const player = await getPlayer(playerId);
    if (!player) {
      throw new Error(`Player ${playerId} not found`);
    }
    
    // Update wallet balance based on operation and token type
    if (tokenType === 'SUI') {
      // For SUI tokens
      const currentBalance = parseFloat(player.walletBalance || '0');
      const amountValue = parseFloat(amount);
      
      const newBalance = operation === 'stake' 
        ? Math.max(0, currentBalance - amountValue) // Subtract for staking
        : currentBalance + amountValue; // Add for rewards
      
      await new Promise((resolve, reject) => {
        db.run(
          'UPDATE players SET walletBalance = ? WHERE playerId = ?',
          [newBalance.toString(), playerId],
          function (err) {
            if (err) reject(err);
            else resolve();
          }
        );
      });
    } else if (tokenType === 'SUIMON') {
      // For SUIMON tokens
      const currentBalance = parseFloat(player.suimonBalance || '0');
      const amountValue = parseFloat(amount);
      
      const newBalance = operation === 'stake' 
        ? Math.max(0, currentBalance - amountValue) // Subtract for staking
        : currentBalance + amountValue; // Add for rewards
      
      await new Promise((resolve, reject) => {
        db.run(
          'UPDATE players SET suimonBalance = ? WHERE playerId = ?',
          [newBalance.toString(), playerId],
          function (err) {
            if (err) reject(err);
            else resolve();
          }
        );
      });
    }
    
    // Log the wallet update
    console.log(`Updated ${playerId}'s ${tokenType} balance for ${operation} operation: ${amount} ${tokenType}`);
    
    return { success: true };
  } catch (error) {
    console.error('Error updating player wallet info:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Add transaction record to player history
 * @param {string} playerId - Player ID
 * @param {Object} transactionData - Transaction data
 */
export const addTransactionToHistory = async (playerId, transactionData) => {
  try {
    // Check if transactions table exists, create if not
    await new Promise((resolve, reject) => {
      db.run(
        `CREATE TABLE IF NOT EXISTS transactions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          playerId TEXT NOT NULL,
          gameId TEXT,
          transactionType TEXT NOT NULL,
          tokenType TEXT NOT NULL,
          amount TEXT NOT NULL,
          transactionHash TEXT,
          timestamp INTEGER NOT NULL,
          FOREIGN KEY(playerId) REFERENCES players(playerId)
        )`,
        function (err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });
    
    // Insert transaction record
    const { gameId, transactionType, tokenType, amount, transactionHash } = transactionData;
    
    await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO transactions (playerId, gameId, transactionType, tokenType, amount, transactionHash, timestamp)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [playerId, gameId, transactionType, tokenType, amount, transactionHash, Date.now()],
        function (err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });
    
    return { success: true };
  } catch (error) {
    console.error('Error adding transaction to history:', error);
    return { success: false, error: error.message };
  }
};