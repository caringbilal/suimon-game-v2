import React, { useState, useEffect } from 'react';
import { useSuiClient, useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { useSuiWallet } from '../context/SuiWalletContext';
import TransactionStatus, { TransactionStage } from './TransactionStatus';
import { socketService } from '../services/socketService';
import { createStakedGame, joinStakedGame, declareWinner, GameRoomData, TEAM_WALLET_ADDRESS } from '../utils/suiTransactions';
import './GameRoom.css';

interface GameRoomProps {
  roomId: string;
  playerRole: 'player1' | 'player2' | null;
  gameRoomData: GameRoomData | null;
  onJoinGame: () => void;
  onLeaveRoom: () => void;
}

const GameRoom: React.FC<GameRoomProps> = ({ 
  roomId, 
  playerRole, 
  gameRoomData, 
  onJoinGame, 
  onLeaveRoom 
}) => {
  const { walletAddress, isConnected } = useSuiWallet();
  const suiClient = useSuiClient();
  const { mutate: signAndExecuteTransactionBlock } = useSignAndExecuteTransaction();
  
  const [transactionStage, setTransactionStage] = useState<TransactionStage>('idle');
  const [transactionError, setTransactionError] = useState<string | undefined>();
  const [transactionHash, setTransactionHash] = useState<string | undefined>();
  const [gameObjectId, setGameObjectId] = useState<string | undefined>();

  // Handle staking transaction for game creation
  const handleStakeTransaction = async (tokenType: 'SUI' | 'SUIMON', amount: string, playerName: string) => {
    if (!isConnected || !walletAddress) {
      setTransactionError('Wallet not connected');
      setTransactionStage('error');
      return;
    }

    try {
      // Start transaction flow
      setTransactionStage('preparing');
      
      // Create transaction
      setTransactionStage('signing');
      const response = await createStakedGame(
        suiClient,
        signAndExecuteTransactionBlock,
        walletAddress,
        tokenType,
        amount,
        playerName
      );

      // Transaction is being executed
      setTransactionStage('executing');
      setTransactionHash(response.digest);

      // Wait for confirmation
      setTransactionStage('confirming');
      
      // Extract the game object ID from the transaction response
      const gameObjectId = response.effects?.created?.[0]?.reference?.objectId;
      if (gameObjectId) {
        setGameObjectId(gameObjectId);
        
        // Emit event to server with game object ID
        socketService.emitWalletEvent('gameCreated', {
          roomId,
          gameObjectId,
          tokenType,
          amount,
          playerAddress: walletAddress,
          transactionHash: response.digest
        });

        // Transaction successful
        setTransactionStage('success');
      } else {
        throw new Error('Game object ID not found in transaction response');
      }
    } catch (error: any) {
      console.error('Staking transaction error:', error);
      setTransactionError(error.message || 'Transaction failed');
      setTransactionStage('error');
      
      // Emit error event
      socketService.emitWalletEvent('transactionError', {
        roomId,
        error: error.message,
        stage: 'staking'
      });
    }
  };

  // Handle joining an existing game
  const handleJoinGame = async (gameObjectId: string, tokenType: 'SUI' | 'SUIMON', amount: string) => {
    if (!isConnected || !walletAddress) {
      setTransactionError('Wallet not connected');
      setTransactionStage('error');
      return;
    }

    try {
      // Start transaction flow
      setTransactionStage('preparing');
      
      // Create transaction
      setTransactionStage('signing');
      const response = await joinStakedGame(
        suiClient,
        signAndExecuteTransactionBlock,
        walletAddress,
        gameObjectId,
        tokenType,
        amount
      );

      // Transaction is being executed
      setTransactionStage('executing');
      setTransactionHash(response.digest);

      // Wait for confirmation
      setTransactionStage('confirming');
      
      // Emit event to server
      socketService.emitWalletEvent('gameJoined', {
        roomId,
        gameObjectId,
        playerAddress: walletAddress,
        transactionHash: response.digest
      });

      // Transaction successful
      setTransactionStage('success');
      
      // Call the onJoinGame callback
      onJoinGame();
    } catch (error: any) {
      console.error('Join game transaction error:', error);
      setTransactionError(error.message || 'Transaction failed');
      setTransactionStage('error');
      
      // Emit error event
      socketService.emitWalletEvent('transactionError', {
        roomId,
        error: error.message,
        stage: 'joining'
      });
    }
  };

  // Handle claiming rewards for the winner
  const handleClaimRewards = async (gameObjectId: string, treasuryObjectId: string) => {
    if (!isConnected || !walletAddress) {
      setTransactionError('Wallet not connected');
      setTransactionStage('error');
      return;
    }

    try {
      // Start transaction flow
      setTransactionStage('preparing');
      
      // Create transaction
      setTransactionStage('signing');
      const response = await declareWinner(
        suiClient,
        signAndExecuteTransactionBlock,
        gameObjectId,
        treasuryObjectId,
        walletAddress
      );

      // Transaction is being executed
      setTransactionStage('executing');
      setTransactionHash(response.digest);

      // Wait for confirmation
      setTransactionStage('confirming');
      
      // Emit event to server
      socketService.emitWalletEvent('rewardsClaimed', {
        roomId,
        gameObjectId,
        winnerAddress: walletAddress,
        transactionHash: response.digest
      });

      // Transaction successful
      setTransactionStage('success');
    } catch (error: any) {
      console.error('Claim rewards transaction error:', error);
      setTransactionError(error.message || 'Transaction failed');
      setTransactionStage('error');
      
      // Emit error event
      socketService.emitWalletEvent('transactionError', {
        roomId,
        error: error.message,
        stage: 'claiming'
      });
    }
  };

  // Reset transaction state
  const resetTransactionState = () => {
    setTransactionStage('idle');
    setTransactionError(undefined);
    setTransactionHash(undefined);
  };

  // Render game room status
  const renderGameRoomStatus = () => {
    if (!gameRoomData) {
      return <div className="game-room-status">Loading game room data...</div>;
    }

    switch (gameRoomData.status) {
      case 0: // CREATED
        return (
          <div className="game-room-status waiting">
            <h3>Waiting for Opponent</h3>
            <p>Share this Room ID with your opponent: <strong>{roomId}</strong></p>
            <p>Token Type: {gameRoomData.tokenType}</p>
            <p>Stake Amount: {gameRoomData.stakeAmount} {gameRoomData.tokenType}</p>
            <button className="copy-room-id" onClick={() => navigator.clipboard.writeText(roomId)}>
              Copy Room ID
            </button>
          </div>
        );
      case 1: // STARTED
        return (
          <div className="game-room-status started">
            <h3>Game In Progress</h3>
            <div className="players-info">
              <div className="player">
                <h4>Player 1 (Creator)</h4>
                <p>{gameRoomData.creator.name}</p>
                <p>{gameRoomData.creator.address.substring(0, 6)}...{gameRoomData.creator.address.substring(gameRoomData.creator.address.length - 4)}</p>
              </div>
              {gameRoomData.opponent && (
                <div className="player">
                  <h4>Player 2</h4>
                  <p>{gameRoomData.opponent.name}</p>
                  <p>{gameRoomData.opponent.address.substring(0, 6)}...{gameRoomData.opponent.address.substring(gameRoomData.opponent.address.length - 4)}</p>
                </div>
              )}
            </div>
            <p>Total Staked: {parseFloat(gameRoomData.stakeAmount) * 2} {gameRoomData.tokenType}</p>
            <button className="join-game-button" onClick={onJoinGame}>
              Join Game
            </button>
          </div>
        );
      case 2: // FINISHED
        return (
          <div className="game-room-status finished">
            <h3>Game Finished</h3>
            <p>Winner: {gameRoomData.winner}</p>
            <p>Rewards: {parseFloat(gameRoomData.stakeAmount) * 2 * 0.9} {gameRoomData.tokenType} (90%)</p>
            <p>Platform Fee: {parseFloat(gameRoomData.stakeAmount) * 2 * 0.1} {gameRoomData.tokenType} (10%)</p>
            <button className="new-game-button" onClick={onLeaveRoom}>
              Start New Game
            </button>
          </div>
        );
      default:
        return <div className="game-room-status">Unknown game status</div>;
    }
  };

  // Render transaction details
  const renderTransactionDetails = () => {
    if (transactionStage === 'idle' || !transactionHash) {
      return null;
    }

    return (
      <div className="transaction-details">
        <h4>Transaction Details</h4>
        <p>Status: {transactionStage}</p>
        {transactionHash && (
          <p>
            Transaction Hash: 
            <a 
              href={`https://explorer.sui.io/txblock/${transactionHash}?network=testnet`} 
              target="_blank" 
              rel="noopener noreferrer"
            >
              {transactionHash.substring(0, 8)}...{transactionHash.substring(transactionHash.length - 8)}
            </a>
          </p>
        )}
        {transactionError && <p className="error">Error: {transactionError}</p>}
      </div>
    );
  };

  return (
    <div className="game-room">
      <h2>Game Room: {roomId}</h2>
      
      {renderGameRoomStatus()}
      
      {transactionStage !== 'idle' && (
        <TransactionStatus 
          stage={transactionStage}
          error={transactionError}
          onCreateGame={() => {}} // This is handled differently in this component
          tokenType={gameRoomData?.tokenType || 'SUI'}
          amount={gameRoomData?.stakeAmount || '0'}
        />
      )}
      
      {renderTransactionDetails()}
      
      <button className="leave-room-button" onClick={onLeaveRoom}>
        Leave Room
      </button>
    </div>
  );
};

export default GameRoom;