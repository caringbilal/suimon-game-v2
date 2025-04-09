// GameBoard.tsx
import React, { useState, useEffect, Dispatch, SetStateAction, useCallback } from 'react';
import { GameState, CardType } from '../types/game';
import Card from '@components/Card';
import cardBackMonster from '../assets/monsters/card-back.png';
import GameEndDialog from '@components/GameEndDialog';
import DraggableStatBox from '@components/DraggableStatBox';
import DraggableCombatStats from '@components/DraggableCombatStats';
import { useDrop } from 'react-dnd';
import { Socket } from 'socket.io-client';
import '../styles/draggable-stats.css';
import LogoutButton from './LogoutButton';
import defaultAvatar from '../assets/ui/default-avatar.png';
import { useSuiWallet } from '../context/SuiWalletContext';
import WalletConnection from './WalletConnection';
import DraggableBox from './DraggableBox';

interface GameEndDialogProps {
  winner: 'player' | 'opponent';
  onRestart: () => void;
}

interface CombatLogEntry {
  timestamp: number;
  message: string;
  type: string;
}

interface GameBoardProps {
  gameState: GameState;
  onCardPlay: (card: CardType) => void;
  setGameState: Dispatch<React.SetStateAction<GameState | null>>;
  playerInfo: { name: string; avatar: string };
  opponentInfo: { name: string; avatar: string };
  combatLog: CombatLogEntry[];
  addCombatLogEntry: (message: string, type: string) => void;
  killCount: { player1: number; player2: number };
  playerRole: 'player1' | 'player2';
  roomId: string;
  socket: Socket;
  onCardDefeated?: (defeatedPlayerKey: 'player1' | 'player2') => void;
  onSignOut?: () => void;
}

export default React.memo<GameBoardProps>(
  ({
    gameState,
    onCardPlay,
    setGameState,
    playerInfo,
    opponentInfo,
    combatLog,
    addCombatLogEntry,
    killCount,
    playerRole,
    roomId,
    socket,
    onCardDefeated,
    onSignOut,
  }) => {
    const { isConnected, suiBalance, suimonBalance } = useSuiWallet();
    console.log('GameBoard rendering for playerRole:', playerRole, 'with gameState:', gameState);
    console.log('Player Info:', playerInfo);
    console.log('Opponent Info:', opponentInfo);

    const [attackingCard, setAttackingCard] = useState<string | null>(null);
    const [defendingCard, setDefendingCard] = useState<string | null>(null);
    const [error, setError] = useState<string>('');
    const [imagesLoaded, setImagesLoaded] = useState<boolean>(false);
    const [avatarLoadError, setAvatarLoadError] = useState<boolean>(false);

    const myData = playerRole === 'player1' ? gameState.player1 : gameState.player2;
    const opponentData = playerRole === 'player1' ? gameState.player2 : gameState.player1;

    // Handle avatar loading errors by using default profile
    const handleAvatarError = () => {
      setAvatarLoadError(true);
      console.error('Failed to load avatar image');
    };

    useEffect(() => {
      const preloadImages = async () => {
        console.log('Preloading images for cards and avatars...');
        const cardsToPreload = [
          ...myData.hand,
          ...opponentData.hand,
          ...gameState.battlefield.player1,
          ...gameState.battlefield.player2,
        ];

        const imagePromises = cardsToPreload.map((card) => {
          if (card.imageUrl && !card.imageUrl.includes('card-back')) {
            return new Promise<void>((resolve) => {
              const img = new Image();
              img.src = card.imageUrl;
              img.onload = () => {
                console.log(`Successfully preloaded image: ${card.imageUrl}`);
                resolve();
              };
              img.onerror = () => {
                console.error(`Failed to preload image: ${card.imageUrl}`);
                resolve();
              };
            });
          }
          return Promise.resolve();
        });

        const avatarPromises = [
          playerInfo.avatar,
          opponentInfo.avatar,
        ].map((avatarUrl) => {
          if (avatarUrl) {
            return new Promise<void>((resolve) => {
              const img = new Image();
              img.src = avatarUrl;
              img.onload = () => {
                console.log(`Successfully preloaded avatar: ${avatarUrl}`);
                resolve();
              };
              img.onerror = () => {
                console.error(`Failed to preload avatar: ${avatarUrl}`);
                resolve();
              };
            });
          }
          return Promise.resolve();
        });

        await Promise.all([...imagePromises, ...avatarPromises]);
        setImagesLoaded(true);
        console.log('All images and avatars preloaded successfully.');
      };

      preloadImages();
    }, [myData.hand, opponentData.hand, gameState.battlefield, playerInfo.avatar, opponentInfo.avatar]);

    useEffect(() => {
      socket.on('gameStateUpdated', (data: { gameState: GameState; playerRole: 'player1' | 'player2' }) => {
        const { gameState: newState, playerRole: receivedRole } = data;
        console.log('Received gameStateUpdated in GameBoard for socket ID:', socket.id, 'newState:', newState, 'playerRole:', receivedRole);

        if (!newState || !newState.player1 || !newState.player2 || !newState.battlefield) {
          console.error('Invalid game state received:', newState);
          setError('Invalid game state received from server');
          return;
        }

        if (receivedRole !== playerRole) {
          console.warn(`Player role mismatch: expected ${playerRole}, received ${receivedRole}`);
        }

        setGameState(newState);
        setError('');
      });

      socket.on('error', (message: string) => {
        console.error('Socket error in GameBoard:', message);
        setError(message);
      });

      socket.on('playerDisconnected', () => {
        console.log('Opponent disconnected in GameBoard');
        setError('Opponent disconnected. Game ended.');
        setGameState(null);
      });

      return () => {
        socket.off('gameStateUpdated');
        socket.off('error');
        socket.off('playerDisconnected');
      };
    }, [socket, setGameState, playerRole]);

    useEffect(() => {
      console.log('Current gameState in GameBoard:', gameState);
      console.log('Player 1 hand:', gameState.player1.hand);
      console.log('Player 2 hand:', gameState.player2.hand);
      console.log('Battlefield (player1):', gameState.battlefield.player1);
      console.log('Battlefield (player2):', gameState.battlefield.player2);
      console.log('Opponent info:', opponentInfo);
      console.log('Current turn:', gameState.currentTurn);
    }, [gameState, opponentInfo]);

    const handleCombat = useCallback(() => {
      const player1Card = gameState.battlefield.player1[0];
      const player2Card = gameState.battlefield.player2[0];

      if (!player1Card || !player2Card) {
        console.log('No combat: Missing player1 or player2 card on battlefield.');
        return;
      }

      console.log('Initiating combat between:', player1Card, 'and', player2Card);

      const player1Damage = Math.max(2, player1Card.attack - Math.floor(player2Card.defense * 0.8));
      const player2Damage = Math.max(2, player2Card.attack - Math.floor(player1Card.defense * 0.8));
      player1Card.hp -= player2Damage;
      player2Card.hp -= player1Damage;

      const player1HpPercentage = Math.round((player1Card.hp / player1Card.maxHp) * 100);
      const player2HpPercentage = Math.round((player2Card.hp / player2Card.maxHp) * 100);

      const baseCombatLog = [
        ...gameState.combatLog,
        {
          timestamp: Date.now(),
          message: `${player1Card.name} attacks with ${player1Card.attack} ATK vs ${player2Card.defense} DEF`,
          type: 'combat',
        },
        {
          timestamp: Date.now(),
          message: `${player2Card.name} attacks with ${player2Card.attack} ATK vs ${player1Card.defense} DEF`,
          type: 'combat',
        },
        {
          timestamp: Date.now(),
          message: `${player1Card.name} takes ${player2Damage} damage (HP: ${player1Card.hp}, ${player1HpPercentage}%)`,
          type: 'damage',
        },
        {
          timestamp: Date.now(),
          message: `${player2Card.name} takes ${player1Damage} damage (HP: ${player2Card.hp}, ${player2HpPercentage}%)`,
          type: 'damage',
        },
      ];

      const player1WonRound =
        player1Damage > player2Damage || (player1Damage === player2Damage && player1HpPercentage > player2HpPercentage);
      const roundWinner = player1WonRound ? 'player1' : 'player2';
      const roundLoser = player1WonRound ? 'player2' : 'player1';

      const damageDealt = player1WonRound ? player1Damage : player2Damage;
      const baseEnergyLoss = Math.max(2, Math.floor(damageDealt * 0.8));
      const winnerEnergyLoss = Math.min(baseEnergyLoss, gameState[roundWinner].energy);
      const loserEnergyLoss = Math.min(baseEnergyLoss * 2, gameState[roundLoser].energy);

      let additionalLogEntries: CombatLogEntry[] = [];
      let nextTurn: 'player1' | 'player2' = roundLoser as 'player1' | 'player2'; // Default to giving the loser the next turn
      
      if (player2Card.hp <= 0) {
        additionalLogEntries = [
          {
            timestamp: Date.now(),
            message: `${player2Card.name} has been defeated! Player 2's turn!`,
            type: 'death',
          },
        ];
        onCardDefeated?.('player2');
        nextTurn = 'player2'; // Explicitly set next turn to player2 when their card is defeated
      } else if (player1Card.hp <= 0) {
        additionalLogEntries = [
          {
            timestamp: Date.now(),
            message: `${player1Card.name} has been defeated! Player 1's turn!`,
            type: 'death',
          },
        ];
        onCardDefeated?.('player1');
        nextTurn = 'player1'; // Explicitly set next turn to player1 when their card is defeated
      } else {
        additionalLogEntries = [
          {
            timestamp: Date.now(),
            message: `Both cards survived! ${roundLoser === 'player1' ? 'Player 1' : 'Player 2'}'s turn!`,
            type: 'combat',
          },
        ];
        // Keep nextTurn as roundLoser when both cards survive
      }

      const updatedGameState: GameState = {
        ...gameState,
        player1: {
          ...gameState.player1,
          energy: gameState.player1.energy - (roundWinner === 'player1' ? winnerEnergyLoss : loserEnergyLoss),
        },
        player2: {
          ...gameState.player2,
          energy: gameState.player2.energy - (roundWinner === 'player2' ? winnerEnergyLoss : loserEnergyLoss),
        },
        battlefield: {
          player1: player1Card.hp > 0 ? [player1Card] : [],
          player2: player2Card.hp > 0 ? [player2Card] : [],
        },
        currentTurn: nextTurn, // Use the calculated nextTurn value
        combatLog: [...baseCombatLog, ...additionalLogEntries],
        killCount: {
          player1: player2Card.hp <= 0 ? gameState.killCount.player1 + 1 : gameState.killCount.player1,
          player2: player1Card.hp <= 0 ? gameState.killCount.player2 + 1 : gameState.killCount.player2,
        },
        gameStatus:
          gameState.player1.energy - (roundWinner === 'player1' ? winnerEnergyLoss : loserEnergyLoss) <= 0 ||
          gameState.player2.energy - (roundWinner === 'player2' ? winnerEnergyLoss : loserEnergyLoss) <= 0
            ? 'finished'
            : 'playing',
      };

      setGameState(updatedGameState);
      if (roomId) {
        socket.emit('updateGame', { roomId, gameState: updatedGameState, playerRole });
      }
    }, [gameState, onCardDefeated, roomId, socket, setGameState]);

    useEffect(() => {
      if (playerRole === 'player1') {
        const fightInterval = setInterval(() => {
          if (gameState.battlefield.player1.length > 0 && gameState.battlefield.player2.length > 0) {
            handleCombat();
          }
        }, 500);
        return () => clearInterval(fightInterval);
      }
    }, [playerRole, gameState, handleCombat]);

    useEffect(() => {
      if (gameState.battlefield.player1.length > 0 && gameState.battlefield.player2.length > 0) {
        const player1Card = gameState.battlefield.player1[0];
        const player2Card = gameState.battlefield.player2[0];
        setAttackingCard(player1Card.id);
        setDefendingCard(player2Card.id);
        setTimeout(() => {
          setAttackingCard(player2Card.id);
          setDefendingCard(player1Card.id);
        }, 1000);
      } else {
        setAttackingCard(null);
        setDefendingCard(null);
      }
    }, [gameState.battlefield]);

    const [{ isOver }, dropRef] = useDrop<CardType, void, { isOver: boolean }>({
      accept: 'CARD',
      drop: (item) => {
        const isPlayerTurn =
          playerRole === 'player1'
            ? gameState.currentTurn === 'player1' && gameState.gameStatus === 'playing'
            : gameState.currentTurn === 'player2' && gameState.gameStatus === 'playing';
        if (isPlayerTurn) {
          onCardPlay(item);
        }
        return undefined;
      },
      collect: (monitor) => ({
        isOver: monitor.isOver(),
      }),
    });

    const handleRestart = useCallback(() => {
      setGameState(null);
      if (roomId) {
        socket.emit('restartGame', { roomId, playerRole });
      }
    }, [roomId, socket, setGameState, playerRole]);

    if (!imagesLoaded) {
      return <div className="loading">Loading card images...</div>;
    }

    const validateCardImageUrl = (card: CardType, isOpponentCard: boolean = false): CardType => {
      if (!card || !card.id) {
        console.warn('Invalid card object received in validateCardImageUrl');
        return card;
      }

      if (isOpponentCard) {
        return {
          ...card,
          imageUrl: cardBackMonster,
          name: 'Hidden Card',
          attack: 0,
          defense: 0,
          hp: 0,
          maxHp: 1,
        };
      }

      const expectedImageUrl = `/monsters/${card.id}.png`;
      if (!card.imageUrl || card.imageUrl === cardBackMonster) {
        return { ...card, imageUrl: expectedImageUrl };
      }

      if (card.name === 'Hidden Card' || !card.name) {
        return { ...card, name: card.id };
      }

      return card;
    };

    // Always use the actual opponent name when available
  const opponentDisplayName = opponentInfo.name && opponentInfo.name !== 'Waiting...' && opponentInfo.name !== 'Opponent'
      ? opponentInfo.name 
      : playerRole === 'player1' ? opponentInfo.name || 'Guest' : opponentInfo.name || 'Host';

    return (
      <div className="game-board">
        <DraggableBox title="Wallet Info" initialPosition={{ x: 1100, y: 100 }}>
          <WalletConnection />
        </DraggableBox>

        <DraggableBox title={`Room ID: ${roomId}`} initialPosition={{ x: 1100, y: 374 }}>
          <div className="room-info-content">
            <p>
              Your Role:
              <span className={playerRole === 'player1' ? 'host' : ''}>
                {playerRole === 'player1' ? 'Host (Player 1)' : 'Player 2'}
                <span className={`status-dot ${playerRole === 'player1' ? 'host' : ''}`}></span>
              </span>
            </p>
            <p>
              Game Status:
              <span className={gameState.gameStatus || ''}>
                {gameState.gameStatus ? gameState.gameStatus.charAt(0).toUpperCase() + gameState.gameStatus.slice(1) : 'Unknown'}
                <span className={`status-dot ${gameState.gameStatus || ''}`}></span>
              </span>
            </p>
            <button
              className="copy-room-id"
              onClick={() => {
                navigator.clipboard.writeText(roomId);
              }}
            >
              Copy Room ID
            </button>
            {onSignOut && (
              <LogoutButton className="room-info-logout" onSignOut={onSignOut} />
            )}
          </div>
        </DraggableBox>
        {gameState.gameStatus === 'finished' && (
          <GameEndDialog
            winner={playerRole === 'player1' ? (gameState.player1.energy <= 0 ? 'opponent' : 'player') : (gameState.player2.energy <= 0 ? 'opponent' : 'player')}
            onRestart={handleRestart}
          />
        )}

        <DraggableStatBox
          type="opponent"
          title="OPPONENT CARDS TOTAL HP"
          totalHP={(() => {
            // For battlefield cards, we can see their actual HP
            const battlefieldHP = gameState.battlefield[playerRole === 'player1' ? 'player2' : 'player1'].reduce(
              (total, card) => total + card.hp,
              0
            );
            // For opponent's hand cards, we need to use the totalHP property directly from opponentData
            // since it's calculated correctly on the server side
            return opponentData.totalHP;
          })()}
          energy={opponentData.energy}
          maxEnergy={opponentData.maxHealth}
          avatar={opponentInfo.avatar}
          kills={playerRole === 'player1' ? killCount.player2 : killCount.player1}
          isCurrentTurn={gameState.currentTurn === (playerRole === 'player1' ? 'player2' : 'player1')}
        />
        
        <DraggableStatBox
          type="player"
          title="PLAYER CARDS TOTAL HP"
          totalHP={(() => {
            const battlefieldHP = gameState.battlefield[playerRole].reduce((total, card) => total + card.hp, 0);
            const handHP = myData.hand.reduce((total, card) => total + card.hp, 0);
            return battlefieldHP + handHP;
          })()}
          energy={myData.energy}
          maxEnergy={myData.maxHealth}
          avatar={playerInfo.avatar}
          kills={playerRole === 'player1' ? killCount.player1 : killCount.player2}
          isCurrentTurn={gameState.currentTurn === playerRole}
        />

        <DraggableCombatStats
          combatLog={combatLog}
          playerCardsCount={myData.hand.length + gameState.battlefield[playerRole].length}
          opponentCardsCount={opponentData.hand.length + gameState.battlefield[playerRole === 'player1' ? 'player2' : 'player1'].length}
        />

        <div className={`player-area opponent ${gameState.currentTurn === (playerRole === 'player1' ? 'player2' : 'player1') ? 'active-turn' : ''}`}>
          <div className="player-profile opponent-profile">
            <img 
              src={opponentInfo && opponentInfo.avatar ? opponentInfo.avatar : defaultAvatar} 
              alt={opponentDisplayName} 
              className="profile-picture" 
              onError={(e) => {
                console.error(`Failed to load opponent profile image: ${opponentInfo && opponentInfo.avatar ? opponentInfo.avatar : 'undefined'}`); 
                e.currentTarget.src = defaultAvatar;
              }}
              style={{ width: '50px', height: '50px', objectFit: 'cover', borderRadius: '10px' }}
              crossOrigin="anonymous"
              referrerPolicy="no-referrer"
            />
            <span className="player-name">
              {opponentDisplayName}
              <span className={`turn-indicator ${gameState.currentTurn === (playerRole === 'player1' ? 'player2' : 'player1') ? 'active' : 'waiting'}`}>
                {gameState.currentTurn === (playerRole === 'player1' ? 'player2' : 'player1') ? `${opponentDisplayName}'s Turn` : 'Please Wait...'}
              </span>
            </span>
          </div>
          <div className="player-hand opponent-hand">
            {opponentData.hand.map((card: CardType, index: number) => {
              const updatedCard = validateCardImageUrl(card, true);
              return (
                <Card
                  key={`opponent-card-${index}`}
                  card={updatedCard}
                  onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => {
                    e.currentTarget.src = cardBackMonster;
                  }}
                />
              );
            })}
          </div>
        </div>
        <div className="battlefield">
          <div className="opponent-field">
            {gameState.battlefield[playerRole === 'player1' ? 'player2' : 'player1'].map((card: CardType) => {
              const updatedCard = {
                ...card,
                imageUrl: card.imageUrl || `/monsters/${card.id}.png`,
                name: card.name || card.id,
              };
              return (
                <Card
                  key={card.id}
                  card={updatedCard}
                  isAttacking={attackingCard === card.id}
                  isDefending={defendingCard === card.id}
                  onAnimationEnd={() => {
                    if (attackingCard === card.id) setAttackingCard(null);
                    if (defendingCard === card.id) setDefendingCard(null);
                  }}
                  onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => {
                    e.currentTarget.src = cardBackMonster;
                  }}
                />
              );
            })}
          </div>
          <div ref={dropRef as unknown as React.RefObject<HTMLDivElement>} className={`player-field ${isOver ? 'field-highlight' : ''}`}>
            {gameState.battlefield[playerRole].map((card: CardType) => {
              const updatedCard = validateCardImageUrl(card, false);
              return (
                <Card
                  key={card.id}
                  card={updatedCard}
                  isAttacking={attackingCard === card.id}
                  isDefending={defendingCard === card.id}
                  onAnimationEnd={() => {
                    if (attackingCard === card.id) setAttackingCard(null);
                    if (defendingCard === card.id) setDefendingCard(null);
                  }}
                  onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => {
                    e.currentTarget.src = cardBackMonster;
                  }}
                />
              );
            })}
          </div>
        </div>
        <div className={`player-area current-player ${gameState.currentTurn === playerRole ? 'active-turn' : ''}`}>
          <div className="player-profile">
            <img 
              src={playerInfo && playerInfo.avatar ? playerInfo.avatar : defaultAvatar} 
              alt={playerInfo.name} 
              className="profile-picture" 
              onError={(e) => {
                console.error(`Failed to load player profile image: ${playerInfo.avatar}`);
                e.currentTarget.src = defaultAvatar;
              }}
              style={{ width: '50px', height: '50px', objectFit: 'cover', borderRadius: '10px' }}
              crossOrigin="anonymous"
              referrerPolicy="no-referrer"
            />
            <span className="player-name">
              {playerInfo.name}
              <span className={`turn-indicator ${gameState.currentTurn === playerRole ? 'active' : 'waiting'}`}>
                {gameState.currentTurn === playerRole ? 'Your Turn' : 'Please Wait...'}
              </span>
            </span>
          </div>
          <div className="player-hand">
            {myData.hand.length > 0 ? (
              myData.hand.map((card: CardType) => {
                const updatedCard = validateCardImageUrl(card, false);
                return (
                  <Card
                    key={card.id}
                    card={updatedCard}
                    onClick={() => {
                      const isPlayerTurn =
                        playerRole === 'player1'
                          ? gameState.currentTurn === 'player1' && gameState.gameStatus === 'playing'
                          : gameState.currentTurn === 'player2' && gameState.gameStatus === 'playing';
                      if (isPlayerTurn && gameState.battlefield[playerRole].length === 0) {
                        onCardPlay(card);
                        addCombatLogEntry(`${playerInfo.name} plays ${card.name}!`, 'play');
                      }
                    }}
                    onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => {
                      e.currentTarget.src = cardBackMonster;
                    }}
                  />
                );
              })
            ) : (
              <div>No cards available in hand</div>
            )}
          </div>
        </div>
        {error && <div className="error-message">{error}</div>}
      </div>
    );
  }
);
