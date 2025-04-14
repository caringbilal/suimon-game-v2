import { SuiClient } from '@mysten/sui.js/client';
import { TransactionBlock } from '@mysten/sui.js/transactions';

// SUIMON Token contract constants
export const SUIMON_TOKEN_ADDRESS = '0xaae614cf7c6801a95b25d32bd3b9006d4b9f9841e9876584de37e885062d9425';
export const SUIMON_TOKEN_MODULE = 'suimon_token';
export const SUIMON_COIN_TYPE = `${SUIMON_TOKEN_ADDRESS}::${SUIMON_TOKEN_MODULE}::SUIMON_TOKEN`;

/**
 * Get SUIMON token balance for a wallet address
 */
/**
 * Get SUIMON token balance for a wallet address
 * @param suiClient The Sui client instance
 * @param walletAddress The wallet address to check balance for
 * @returns A Promise that always resolves to a string representing the balance
 */
export async function getSuimonBalance(suiClient: SuiClient | undefined, walletAddress: string): Promise<string> {
  try {
    if (!suiClient) {
      console.error('SUI Client not initialized');
      return '0';
    }
    
    const coins = await suiClient.getCoins({
      owner: walletAddress,
      coinType: SUIMON_COIN_TYPE
    });

    const totalBalance = coins?.data && Array.isArray(coins.data) && coins.data.length > 0
      ? coins.data.reduce((acc, coin) => acc + BigInt(coin.balance), BigInt(0))
      : BigInt(0);
    return totalBalance.toString();
  } catch (error) {
    console.error('Error fetching SUIMON balance:', error);
    return '0'; // Always return a string, never undefined
  }
}

/**
 * Create a transaction for staking SUIMON tokens in a game room
 */
export function createSuimonStakeTransaction(
  amount: string,
  gameRoomId: string
): TransactionBlock {
  const txb = new TransactionBlock();
  
  // Split SUIMON coin if needed and stake it in the game room
  const [stakeCoin] = txb.splitCoins(txb.gas, [amount]);
  
  // Call the stake function in the game contract
  txb.moveCall({
    target: `${SUIMON_TOKEN_ADDRESS}::${SUIMON_TOKEN_MODULE}::stake_tokens`,
    arguments: [stakeCoin, txb.object(gameRoomId)]
  });

  return txb;
}

/**
 * Create a transaction for claiming SUIMON token rewards
 */
export function createClaimRewardsTransaction(
  gameRoomId: string
): TransactionBlock {
  const txb = new TransactionBlock();
  
  // Call the claim rewards function
  txb.moveCall({
    target: `${SUIMON_TOKEN_ADDRESS}::${SUIMON_TOKEN_MODULE}::claim_rewards`,
    arguments: [txb.object(gameRoomId)]
  });

  return txb;
}