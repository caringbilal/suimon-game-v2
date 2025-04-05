import { TransactionBlock } from '@mysten/sui.js/transactions';
import { SUI_CLOCK_OBJECT_ID } from '@mysten/sui.js/utils';
import { useSuiClient } from '@mysten/dapp-kit';
import { useSignAndExecuteTransaction } from '@mysten/dapp-kit';

// Constants
export const TEAM_WALLET_ADDRESS = '0x975109d5f34edee5556a431d3e4658bb7007389519c415d86c10c63a286ebf2b';
export const FEE_PERCENTAGE = 10; // 10% fee

// Game contract address
export const GAME_CONTRACT_ADDRESS = '0xa4e6822e7212ab15edc1243ff1cf33bf45346b35c08acacf4c7bf5204fdc3353';
export const GAME_MODULE_NAME = 'game';

// Coin types
export const SUI_COIN_TYPE = '0x2::sui::SUI';
export const SUIMON_COIN_TYPE = '0xc0ba93a810adb498900c82bb6f7c16ca3046dfa7b6f364ec985595fdeb1ee9ad::suimon::SUIMON';

// Game status constants
export const GAME_STATUS = {
  CREATED: 0,
  STARTED: 1,
  FINISHED: 2
};

// Interface for game room data
export interface GameRoomData {
  gameId: string;
  creator: {
    address: string;
    name: string;
  };
  tokenType: 'SUI' | 'SUIMON';
  stakeAmount: string;
  status: number;
  opponent?: {
    address: string;
    name: string;
  };
  winner?: string;
  createdAt: number;
}

/**
 * Creates a new game with staked tokens
 * @param suiClient The Sui client instance
 * @param signAndExecuteTransactionBlock The sign and execute transaction hook
 * @param walletAddress The user's wallet address
 * @param tokenType The type of token to stake ('SUI' or 'SUIMON')
 * @param amount The amount to stake
 * @param playerName The name of the player
 * @returns Transaction response
 */
export async function createStakedGame(
  suiClient: any,
  signAndExecuteTransactionBlock: any,
  walletAddress: string,
  tokenType: 'SUI' | 'SUIMON',
  amount: string,
  playerName: string
) {
  try {
    const tx = new TransactionBlock();

    // Convert amount to MIST (both SUI and SUIMON use 9 decimal places)
    const amountInMist = Math.floor(parseFloat(amount) * 1_000_000_000);

    // Determine the coin type
    const coinType = tokenType === 'SUI' ? SUI_COIN_TYPE : SUIMON_COIN_TYPE;

    // Fetch the user's coins of the specified type
    const coins = await suiClient.getCoins({
      owner: walletAddress,
      coinType: coinType,
    });

    if (!coins.data || coins.data.length === 0) {
      throw new Error(`No ${tokenType} coins found in wallet`);
    }

    // Use the first coin object (you might want to select a specific coin if the user has multiple)
    const coinObjectId = coins.data[0].coinObjectId;

    // Split the coin to get the amount to stake
    const [coin] = tx.splitCoins(tx.object(coinObjectId), [tx.pure(amountInMist)]);

    // Call the create_game function from the smart contract
    tx.moveCall({
      target: `${GAME_CONTRACT_ADDRESS}::${GAME_MODULE_NAME}::create_game`,
      arguments: [
        coin,
        tx.pure(tokenType === 'SUIMON'), // true for SUIMON, false for SUI
      ],
    });

    // Log transaction details before execution
    console.log('Executing transaction with details:', {
      tokenType,
      amount,
      walletAddress: walletAddress.substring(0, 8) + '...',
      coinObjectId: coinObjectId.substring(0, 8) + '...',
      amountInMist
    });
    
    // Execute the transaction with proper wallet interaction settings
    console.log('About to call signAndExecuteTransactionBlock with transaction:', {
      txType: tx.blockData.transactions.length > 0 ? 'Has transactions' : 'Empty',
      txSize: JSON.stringify(tx).length,
      timestamp: new Date().toISOString()
    });
    
    // Add more detailed logging to track the transaction execution flow
    console.log('About to execute transaction with wallet', {
      walletAddress: walletAddress.substring(0, 8) + '...',
      tokenType,
      amount,
      timestamp: new Date().toISOString()
    });
    
    const response = await signAndExecuteTransactionBlock({
      transaction: tx,  // Updated from transactionBlock to transaction
      options: {
        showEffects: true,
        showEvents: true,
        showInput: true,
        showObjectChanges: true,
      },
      requestType: 'WaitForLocalExecution',
    });

    // Verify that the response contains the necessary information
    if (!response) {
      throw new Error('Transaction was cancelled or failed');
    }
    
    if (!response.digest) {
      throw new Error('Transaction failed: No transaction digest received');
    }
    
    // Check for transaction effects
    if (!response.effects) {
      throw new Error('Transaction failed: No effects received');
    }
    
    // Check if transaction was successful
    if (response.effects.status.status !== 'success') {
      throw new Error(`Transaction failed: ${response.effects.status.error || 'Unknown error'}`);
    }

    return response;
  } catch (error: unknown) {
    // Enhanced error logging with more context
    if (error instanceof Error) {
      console.error('Error creating staked game:', error);
      console.error('Transaction context:', {
        stage: 'creation',
        tokenType,
        amount,
        walletAddress: walletAddress.substring(0, 8) + '...',
        errorType: error.constructor.name,
        errorMessage: error.message,
        timestamp: new Date().toISOString()
      });
  
      // Rethrow with more descriptive message if possible
      if (error.message === 'Transaction was cancelled or failed') {
        throw new Error('Wallet confirmation was cancelled or failed to appear. Please try again and check your wallet extension is working properly.');
      }
    }
    throw error;
  }
}

/**
 * Joins an existing game with staked tokens
 * @param suiClient The Sui client instance
 * @param signAndExecuteTransactionBlock The sign and execute transaction hook
 * @param walletAddress The user's wallet address
 * @param gameObjectId The object ID of the game to join
 * @param tokenType The type of token to stake ('SUI' or 'SUIMON')
 * @param amount The amount to stake
 * @returns Transaction response
 */
export async function joinStakedGame(
  suiClient: any,
  signAndExecuteTransactionBlock: any,
  walletAddress: string,
  gameObjectId: string,
  tokenType: 'SUI' | 'SUIMON',
  amount: string
) {
  try {
    const tx = new TransactionBlock();

    // Convert amount to MIST (both SUI and SUIMON use 9 decimal places)
    const amountInMist = Math.floor(parseFloat(amount) * 1_000_000_000);

    // Determine the coin type
    const coinType = tokenType === 'SUI' ? SUI_COIN_TYPE : SUIMON_COIN_TYPE;

    // Fetch the user's coins of the specified type
    const coins = await suiClient.getCoins({
      owner: walletAddress,
      coinType: coinType,
    });

    if (!coins.data || coins.data.length === 0) {
      throw new Error(`No ${tokenType} coins found in wallet`);
    }

    // Use the first coin object
    const coinObjectId = coins.data[0].coinObjectId;

    // Split the coin to get the amount to stake
    const [coin] = tx.splitCoins(tx.object(coinObjectId), [tx.pure(amountInMist)]);

    // Call the join_game function from the smart contract
    tx.moveCall({
      target: `${GAME_CONTRACT_ADDRESS}::${GAME_MODULE_NAME}::join_game`,
      arguments: [
        tx.object(gameObjectId), // The game object
        coin,
      ],
    });

    // Execute the transaction and wait for confirmation
    const response = await signAndExecuteTransactionBlock({
      transaction: tx,  // Updated from transactionBlock to transaction
      requestType: 'WaitForEffects',
      options: {
        showEffects: true,
        showEvents: true,
        showInput: true,
      },
      chain: 'sui:testnet'
    });

    // Verify that the response contains the necessary information
    if (!response) {
      throw new Error('Transaction was cancelled or failed');
    }
    
    if (!response.digest) {
      throw new Error('Transaction failed: No transaction digest received');
    }
    
    // Check for transaction effects
    if (!response.effects) {
      throw new Error('Transaction failed: No effects received');
    }
    
    // Check if transaction was successful
    if (response.effects.status.status !== 'success') {
      throw new Error(`Transaction failed: ${response.effects.status.error || 'Unknown error'}`);
    }

    return response;
  } catch (error) {
    console.error('Error joining staked game:', error);
    throw error;
  }
}

/**
 * Declares the winner of a game and distributes rewards
 * @param suiClient The Sui client instance
 * @param signAndExecuteTransactionBlock The sign and execute transaction hook
 * @param gameObjectId The object ID of the game
 * @param treasuryObjectId The object ID of the game treasury
 * @param winnerAddress The address of the winner
 * @returns Transaction response
 */
export async function declareWinner(
  suiClient: any,
  signAndExecuteTransactionBlock: any,
  gameObjectId: string,
  treasuryObjectId: string,
  winnerAddress: string
) {
  try {
    const tx = new TransactionBlock();

    // Call the declare_winner function from the smart contract
    tx.moveCall({
      target: `${GAME_CONTRACT_ADDRESS}::${GAME_MODULE_NAME}::declare_winner`,
      arguments: [
        tx.object(gameObjectId), // The game object
        tx.object(treasuryObjectId), // The treasury object
        tx.pure(winnerAddress), // The winner's address
      ],
    });

    // Execute the transaction and wait for confirmation
    const response = await signAndExecuteTransactionBlock({
      transaction: tx,  // Updated from transactionBlock to transaction
      requestType: 'WaitForEffects',
      options: {
        showEffects: true,
        showEvents: true,
        showInput: true,
      },
      chain: 'sui:testnet'
    });

    // Verify that the response contains the necessary information
    if (!response) {
      throw new Error('Transaction was cancelled or failed');
    }
    
    if (!response.digest) {
      throw new Error('Transaction failed: No transaction digest received');
    }
    
    // Check for transaction effects
    if (!response.effects) {
      throw new Error('Transaction failed: No effects received');
    }
    
    // Check if transaction was successful
    if (response.effects.status.status !== 'success') {
      throw new Error(`Transaction failed: ${response.effects.status.error || 'Unknown error'}`);
    }

    return response;
  } catch (error) {
    console.error('Error declaring winner:', error);
    throw error;
  }
}