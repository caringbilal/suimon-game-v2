import { TransactionBlock } from '@mysten/sui.js/transactions';
import { SUI_CLOCK_OBJECT_ID } from '@mysten/sui.js/utils';

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
 * Prepares a transaction to create a new game with staked tokens
 * @param suiClient The Sui client instance
 * @param walletAddress The user's wallet address
 * @param tokenType The type of token to stake ('SUI' or 'SUIMON')
 * @param amount The amount to stake
 * @param playerName The name of the player
 * @returns TransactionBlock to be executed by the caller
 */
export async function prepareCreateStakedGame(
  suiClient: any,
  walletAddress: string,
  tokenType: 'SUI' | 'SUIMON',
  amount: string,
  playerName: string
): Promise<TransactionBlock> {
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

    // Call the create_game function from the smart contract
    tx.moveCall({
      target: `${GAME_CONTRACT_ADDRESS}::${GAME_MODULE_NAME}::create_game`,
      arguments: [
        coin,
        tx.pure(tokenType === 'SUIMON'), // true for SUIMON, false for SUI
      ],
    });

    return tx;
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error('Error preparing staked game transaction:', error);
      console.error('Transaction context:', {
        stage: 'creation',
        tokenType,
        amount,
        walletAddress: walletAddress.substring(0, 8) + '...',
        errorType: error.constructor.name,
        errorMessage: error.message,
        timestamp: new Date().toISOString()
      });
      throw error;
    }
    throw new Error('Unknown error preparing staked game transaction');
  }
}

/**
 * Prepares a transaction to join an existing game with staked tokens
 * @param suiClient The Sui client instance
 * @param walletAddress The user's wallet address
 * @param gameObjectId The object ID of the game to join
 * @param tokenType The type of token to stake ('SUI' or 'SUIMON')
 * @param amount The amount to stake
 * @returns TransactionBlock to be executed by the caller
 */
export async function prepareJoinStakedGame(
  suiClient: any,
  walletAddress: string,
  gameObjectId: string,
  tokenType: 'SUI' | 'SUIMON',
  amount: string
): Promise<TransactionBlock> {
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

    return tx;
  } catch (error) {
    console.error('Error preparing join staked game transaction:', error);
    throw error;
  }
}

/**
 * Prepares a transaction to declare the winner of a game and distribute rewards
 * @param gameObjectId The object ID of the game
 * @param treasuryObjectId The object ID of the game treasury
 * @param winnerAddress The address of the winner
 * @returns TransactionBlock to be executed by the caller
 */
export function prepareDeclareWinner(
  gameObjectId: string,
  treasuryObjectId: string,
  winnerAddress: string
): TransactionBlock {
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

    return tx;
  } catch (error) {
    console.error('Error preparing declare winner transaction:', error);
    throw error;
  }
}

/**
 * Gets information about a game
 * @param suiClient The Sui client instance
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