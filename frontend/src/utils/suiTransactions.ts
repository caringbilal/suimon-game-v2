import { TransactionBlock } from '@mysten/sui.js/transactions';
import { SUI_CLOCK_OBJECT_ID } from '@mysten/sui.js/utils';
import { useSuiClient } from '@mysten/dapp-kit';
import { useSignAndExecuteTransaction } from '@mysten/dapp-kit';

// Constants
export const TEAM_WALLET_ADDRESS = '0x975109d5f34edee5556a431d3e4658bb7007389519c415d86c10c63a286ebf2b';
export const FEE_PERCENTAGE = 10; // 10% fee

// Game contract address - this should be updated after deployment
export const GAME_CONTRACT_ADDRESS = '0x0'; // Placeholder, will be updated after deployment
export const GAME_MODULE_NAME = 'game';

// SUIMON token type - this should match the one in SuiWalletContext.tsx
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
 * @param tokenType The type of token to stake ('SUI' or 'SUIMON')
 * @param amount The amount to stake
 * @param playerName The name of the player
 * @returns Transaction response
 */
export async function createStakedGame(
  suiClient: any,
  signAndExecuteTransactionBlock: any,
  tokenType: 'SUI' | 'SUIMON',
  amount: string,
  playerName: string
) {
  try {
    const tx = new TransactionBlock();
    
    // Convert amount to MIST (SUI's smallest unit, 1 SUI = 10^9 MIST)
    const amountInMist = tokenType === 'SUI' 
      ? Math.floor(parseFloat(amount) * 1_000_000_000)
      : Math.floor(parseFloat(amount));
    
    // Create a coin to stake
    const [coin] = tx.splitCoins(tx.gas, [tx.pure(amountInMist)]);
    
    // Call the create_game function from the smart contract
    tx.moveCall({
      target: `${GAME_CONTRACT_ADDRESS}::${GAME_MODULE_NAME}::create_game`,
      arguments: [
        coin,
        tx.pure(tokenType === 'SUIMON'), // true for SUIMON, false for SUI
      ],
    });

    // Execute the transaction
    const response = await signAndExecuteTransactionBlock({
      transactionBlock: tx,
    });

    return response;
  } catch (error) {
    console.error('Error creating staked game:', error);
    throw error;
  }
}

/**
 * Joins an existing game with staked tokens
 * @param gameObjectId The object ID of the game to join
 * @param tokenType The type of token to stake ('SUI' or 'SUIMON')
 * @param amount The amount to stake
 * @returns Transaction response
 */
export async function joinStakedGame(
  suiClient: any,
  signAndExecuteTransactionBlock: any,
  gameObjectId: string,
  tokenType: 'SUI' | 'SUIMON',
  amount: string
) {
  try {
    const tx = new TransactionBlock();
    
    // Convert amount to MIST (SUI's smallest unit, 1 SUI = 10^9 MIST)
    const amountInMist = tokenType === 'SUI' 
      ? Math.floor(parseFloat(amount) * 1_000_000_000)
      : Math.floor(parseFloat(amount));
    
    // Create a coin to stake
    const [coin] = tx.splitCoins(tx.gas, [tx.pure(amountInMist)]);
    
    // Call the join_game function from the smart contract
    tx.moveCall({
      target: `${GAME_CONTRACT_ADDRESS}::${GAME_MODULE_NAME}::join_game`,
      arguments: [
        tx.object(gameObjectId), // The game object
        coin,
      ],
    });

    // Execute the transaction
    const response = await signAndExecuteTransactionBlock({
      transactionBlock: tx,
    });

    return response;
  } catch (error) {
    console.error('Error joining staked game:', error);
    throw error;
  }
}

/**
 * Declares the winner of a game and distributes rewards
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

    // Execute the transaction
    const response = await signAndExecuteTransactionBlock({
      transactionBlock: tx,
    });

    return response;
  } catch (error) {
    console.error('Error declaring winner:', error);
    throw error;
  }
}

/**
 * Gets information about a game
 * @param gameObjectId The object ID of the game
 * @returns Game information
 */
export async function getGameInfo(suiClient: any, gameObjectId: string) {
  try {
    const gameObject = await suiClient.getObject({
      id: gameObjectId,
      options: { showContent: true },
    });

    return gameObject;
  } catch (error) {
    console.error('Error getting game info:', error);
    throw error;
  }
}