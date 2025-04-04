# Suimon Game Contract Deployment Guide

This guide provides a step-by-step process for deploying the Suimon Game staking contract to the Sui blockchain without directly using the `sui move build` command.

## Prerequisites

1. Sui CLI installed on your machine
2. A Sui wallet with sufficient SUI tokens for deployment
3. Node.js and npm installed

## Step 1: Configure Your Sui Wallet

Before deploying, you need to ensure your Sui wallet is properly configured:

```bash
# Check if Sui CLI is installed
sui --version

# Check your active addresses
sui client addresses

# Make sure you have an active address with SUI tokens
sui client gas
```

If you need to create a new address:

```bash
sui client new-address ed25519
```

To switch to a specific address:

```bash
sui client switch --address <YOUR_ADDRESS>
```

## Step 2: Verify Move.toml Configuration

Your `Move.toml` file is already properly configured:

```toml
[package]
name = "suimon_game"
version = "0.0.1"

[dependencies]
Sui = { git = "https://github.com/MystenLabs/sui.git", subdir = "crates/sui-framework/packages/sui-framework", rev = "framework/testnet" }

[addresses]
suimon_game = "0x0"
```

## Step 3: Deploy the Contract Directly

Since you can't run `sui move build` directly, you can use the publish command which will build and publish in one step:

```bash
# Navigate to the contracts directory
cd /Users/bilal/Desktop/suimon-game-v2/backend/contracts

# Publish the contract (this will build and publish in one step)
sui client publish --gas-budget 100000000
```

If you encounter any issues with the above command, try the following alternative approach:

```bash
# Alternative approach with explicit build path
sui client publish --build-config /Users/bilal/Desktop/suimon-game-v2/backend/contracts/Move.toml --gas-budget 100000000
```

## Step 4: Record Important Information

After successful deployment, you'll see output containing important information. Make note of:

1. Package ID (this is your contract address)
2. StakingTreasury object ID

Example output will look something like:

```
----- Transaction Effects ----
Status : Success
Created Objects:
  - ID: 0x123...abc (package object)
  - ID: 0x456...def (StakingTreasury object)
```

## Step 5: Update Frontend Configuration

Update the contract address in the frontend code:

1. Open `/Users/bilal/Desktop/suimon-game-v2/frontend/src/utils/suiTransactions.ts`
2. Update the `GAME_CONTRACT_ADDRESS` constant with your deployed package ID:

```typescript
export const GAME_CONTRACT_ADDRESS = '0xYOUR_PACKAGE_ID'; // Replace with your actual package ID
```

## Step 6: Test the Contract

Test the contract functions using the Sui CLI:

### Create a Game Room

```bash
sui client call --package <PACKAGE_ID> --module staking --function create_game_room --args <COIN_OBJECT_ID> false "room123" "Player1" --gas-budget 10000000
```

To get a coin object ID for testing:

```bash
# List your coins
sui client gas

# Split a coin to get a specific amount
sui client split-coin --coin-id <COIN_ID> --amounts 1000000 --gas-budget 1000000
```

### Join a Game Room

```bash
sui client call --package <PACKAGE_ID> --module staking --function join_game_room --args <GAME_ROOM_OBJECT_ID> <COIN_OBJECT_ID> "Player2" --gas-budget 10000000
```

### Declare a Winner

```bash
sui client call --package <PACKAGE_ID> --module staking --function declare_winner --args <GAME_ROOM_OBJECT_ID> <TREASURY_OBJECT_ID> <WINNER_ADDRESS> --gas-budget 10000000
```

## Step 7: Verify Contract Deployment

Verify your contract deployment by checking the Sui Explorer:

1. Go to https://explorer.sui.io/ (select the appropriate network - testnet or mainnet)
2. Search for your package ID
3. Verify that the modules and functions are correctly displayed

## Troubleshooting

### Error: Failed to build package

If you encounter build errors, check:

1. Make sure you're in the correct directory with the Move.toml file
2. Verify that your Move.toml dependencies are correct
3. Try increasing the gas budget

### Error: Insufficient gas

If you encounter gas errors:

```bash
sui client publish --gas-budget 200000000
```

### Error: Package verification failed

This could be due to incompatible Sui framework versions. Try updating the `rev` field in your Move.toml to match your Sui CLI version:

```bash
# Check your Sui version
sui --version

# Update the Move.toml file accordingly
# For example, if you're on testnet:
Sui = { git = "https://github.com/MystenLabs/sui.git", subdir = "crates/sui-framework/packages/sui-framework", rev = "framework/testnet" }
# For mainnet:
Sui = { git = "https://github.com/MystenLabs/sui.git", subdir = "crates/sui-framework/packages/sui-framework", rev = "framework/mainnet" }
```

## Security Considerations

1. The contract handles real tokens, so ensure proper testing before deploying to mainnet
2. The team wallet address is hardcoded in the contract - ensure this is the correct address
3. The fee percentage is set to 10% - adjust if needed before deployment

## Conclusion

Your Suimon Game staking contract should now be deployed and ready for integration with the frontend. Players can stake tokens, play games, and winners can claim their rewards with the 90/10 split between winners and the team wallet.