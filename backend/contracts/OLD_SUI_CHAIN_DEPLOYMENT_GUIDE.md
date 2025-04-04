# Suimon Game Staking Contract Deployment Guide

This guide will walk you through the process of deploying the Suimon Game staking contract to the Sui blockchain and integrating it with the frontend application.

## Prerequisites

1. Sui CLI installed on your machine
2. A Sui wallet with sufficient SUI tokens for deployment
3. Node.js and npm installed

## Step 1: Update the Move.toml File

Before deploying, make sure your `Move.toml` file is properly configured:

```toml
[package]
name = "suimon_game"
version = "0.0.1"

[dependencies]
Sui = { git = "https://github.com/MystenLabs/sui.git", subdir = "crates/sui-framework/packages/sui-framework", rev = "framework/testnet" }

[addresses]
suimon_game = "0x0"
```

## Step 2: Build the Contract

```bash
cd /Users/bilal/Desktop/suimon-game-v2/backend/contracts
sui move build
```

This will compile your Move code and generate the build artifacts.

## Step 3: Deploy the Contract

```bash
sui client publish --gas-budget 100000000
```

After running this command, you'll see output containing the package ID and other important information. Make note of the following:

1. Package ID (this is your contract address)
2. StakingTreasury object ID

## Step 4: Update Frontend Configuration

After deployment, you need to update the contract address in the frontend code:

1. Open `/Users/bilal/Desktop/suimon-game-v2/frontend/src/utils/suiTransactions.ts`
2. Update the `GAME_CONTRACT_ADDRESS` constant with your deployed package ID:

```typescript
export const GAME_CONTRACT_ADDRESS = '0xYOUR_PACKAGE_ID'; // Replace with your actual package ID
```

## Step 5: Test the Contract

You can test the contract functions using the Sui CLI:

### Create a Game Room

```bash
sui client call --package <PACKAGE_ID> --module staking --function create_game_room --args <COIN_OBJECT_ID> false "room123" "Player1" --gas-budget 10000000
```

### Join a Game Room

```bash
sui client call --package <PACKAGE_ID> --module staking --function join_game_room --args <GAME_ROOM_OBJECT_ID> <COIN_OBJECT_ID> "Player2" --gas-budget 10000000
```

### Declare a Winner

```bash
sui client call --package <PACKAGE_ID> --module staking --function declare_winner --args <GAME_ROOM_OBJECT_ID> <TREASURY_OBJECT_ID> <WINNER_ADDRESS> --gas-budget 10000000
```

## Step 6: Verify Contract Deployment

You can verify your contract deployment by checking the Sui Explorer:

1. Go to https://explorer.sui.io/ (select the appropriate network - testnet or mainnet)
2. Search for your package ID
3. Verify that the modules and functions are correctly displayed

## Integration with Frontend

The frontend is already configured to interact with the smart contract. The key components are:

1. `suiTransactions.ts` - Contains utility functions for interacting with the contract
2. `GameRoom.tsx` - Manages the game room state and handles staking transactions
3. `GameOptions.tsx` - Allows users to select token type and amount for staking

## Troubleshooting

### Gas Budget Issues

If you encounter gas budget errors, try increasing the gas budget in your transaction:

```bash
sui client publish --gas-budget 200000000
```

### Contract Upgrade

If you need to upgrade the contract, you'll need to republish it and update the address in the frontend code.

### Transaction Failures

Check the transaction details in the Sui Explorer to understand why a transaction failed. Common issues include:

- Insufficient gas
- Incorrect object ownership
- Failed assertions in the contract code

## Security Considerations

1. The contract handles real tokens, so ensure proper testing before deploying to mainnet
2. The team wallet address is hardcoded in the contract - ensure this is the correct address
3. The fee percentage is set to 10% - adjust if needed before deployment

## Conclusion

Your Suimon Game staking contract is now deployed and integrated with the frontend. Players can now stake tokens, play games, and winners can claim their rewards with the 90/10 split between winners and the team wallet.