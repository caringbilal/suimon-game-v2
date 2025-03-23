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

// Placeholder interface for GameEndDialog (update this if you have the actual component)
interface GameEndDialogProps {
  winner: 'player' | 'opponent'; // Assuming GameEndDialog expects this type
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
  }) => {
    console.log('GameBoard rendering for playerRole:', playerRole, 'with gameState:', gameState);

    const [attackingCard, setAttackingCard] = useState<string | null>(null);
    const [defendingCard, setDefendingCard] = useState<string | null>(null);
    const [error, setError] = useState<string>('');
    const [imagesLoaded, setImagesLoaded] = useState<boolean>(false);

    // Determine the player's and opponent's data based on the playerRole
    const myData = playerRole === 'player1' ? gameState.player1 : gameState.player2;
    const opponentData = playerRole === 'player1' ? gameState.player2 : gameState.player1;

    useEffect(() => {
      const preloadImages = async () => {
        console.log('Preloading images for cards...');
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

        await Promise.all(imagePromises);
        setImagesLoaded(true);
        console.log('All images preloaded successfully.');
      };

      preloadImages();
    }, [myData.hand, opponentData.hand, gameState.battlefield]);

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

        console.log('Updated Player 1 Hand:', newState.player1.hand);
        console.log('Updated Player 2 Hand:', newState.player2.hand);
        console.log('Updated Battlefield:', newState.battlefield);

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

      // Determine additional combat log entries based on the outcome
      let additionalLogEntries: CombatLogEntry[] = [];
      if (player2Card.hp <= 0) {
        additionalLogEntries = [
          {
            timestamp: Date.now(),
            message: `${player2Card.name} has been defeated! Player 2's turn!`,
            type: 'death',
          },
        ];
        onCardDefeated?.('player2');
      } else if (player1Card.hp <= 0) {
        additionalLogEntries = [
          {
            timestamp: Date.now(),
            message: `${player1Card.name} has been defeated! Player 1's turn!`,
            type: 'death',
          },
        ];
        onCardDefeated?.('player1');
      } else {
        additionalLogEntries = [
          {
            timestamp: Date.now(),
            message: `Both cards survived! ${roundLoser === 'player1' ? 'Player 1' : 'Player 2'}'s turn!`,
            type: 'combat',
          },
        ];
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
        currentTurn: roundLoser,
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

      console.log('Updated game state after combat:', updatedGameState);
      setGameState(updatedGameState);
      if (roomId) {
        console.log('Emitting updateGame event with updated state:', updatedGameState);
        socket.emit('updateGame', { roomId, gameState: updatedGameState, playerRole });
      }
    }, [gameState, onCardDefeated, roomId, socket, setGameState]);

    useEffect(() => {
      if (playerRole === 'player1') {
        console.log('Setting up combat interval for Player 1');
        const fightInterval = setInterval(() => {
          if (gameState.battlefield.player1.length > 0 && gameState.battlefield.player2.length > 0) {
            handleCombat();
          }
        }, 500);
        return () => {
          console.log('Clearing combat interval for Player 1');
          clearInterval(fightInterval);
        };
      }
    }, [playerRole, gameState, handleCombat]);

    useEffect(() => {
      if (gameState.battlefield.player1.length > 0 && gameState.battlefield.player2.length > 0) {
        const player1Card = gameState.battlefield.player1[0];
        const player2Card = gameState.battlefield.player2[0];
        console.log('Setting up combat animations:', { player1Card, player2Card });
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
          console.log('Card dropped by player:', item);
          onCardPlay(item);
        } else {
          console.log('Card drop ignored: Not player’s turn or game not in playing state.');
        }
        return undefined;
      },
      collect: (monitor) => ({
        isOver: monitor.isOver(),
      }),
    });

    const handleRestart = useCallback(() => {
      console.log('Restarting game for room:', roomId);
      setGameState(null);
      if (roomId) {
        socket.emit('restartGame', { roomId, playerRole });
      }
    }, [roomId, socket, setGameState, playerRole]);

    if (!imagesLoaded) {
      console.log('Waiting for images to load...');
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
        console.log(`Fixing image URL for player's card ${card.id}. Setting to: ${expectedImageUrl}`);
        return { ...card, imageUrl: expectedImageUrl };
      }

      if (card.name === 'Hidden Card' || !card.name) {
        console.log(`Fixing name for player's card ${card.id}. Setting to: ${card.id}`);
        return { ...card, name: card.id };
      }

      return card;
    };

    console.log('Rendering GameBoard UI...');
    return (
      <div className="game-board">
        <div className="room-info-box">
          <h3>Room ID: {roomId}</h3>
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
                console.log('Room ID copied to clipboard:', roomId);
              }}
            >
              Copy Room ID
            </button>
          </div>
        </div>
        {gameState.gameStatus === 'finished' && (
          <GameEndDialog
            // Map 'player1' | 'player2' to 'player' | 'opponent' based on playerRole
            winner={playerRole === 'player1' ? (gameState.player1.energy <= 0 ? 'opponent' : 'player') : (gameState.player2.energy <= 0 ? 'opponent' : 'player')}
            onRestart={handleRestart}
          />
        )}

        
        {/* Draggable Stat Boxes */}
        <DraggableStatBox
          type="opponent"
          title="OPPONENT CARDS TOTAL HP"
          totalHP={(() => {
            const battlefieldHP = gameState.battlefield[playerRole === 'player1' ? 'player2' : 'player1'].reduce(
              (total, card) => total + card.hp,
              0
            );
            const handHP = opponentData.hand.reduce((total, card) => total + card.hp, 0);
            return battlefieldHP + handHP;
          })()}
          energy={opponentData.energy}
          maxEnergy={opponentData.maxHealth}
          avatar={opponentInfo.avatar}
          kills={playerRole === 'player1' ? killCount.player2 : killCount.player1}
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

        {/* Draggable Combat Stats */}
        <DraggableCombatStats
          combatLog={combatLog}
          playerCardsCount={myData.hand.length + gameState.battlefield[playerRole].length}
          opponentCardsCount={opponentData.hand.length + gameState.battlefield[playerRole === 'player1' ? 'player2' : 'player1'].length}
        />

        <div className={`player-area opponent ${gameState.currentTurn === (playerRole === 'player1' ? 'player2' : 'player1') ? 'active-turn' : ''}`}>
          <div className="player-profile opponent-profile">
            <img src={opponentInfo.avatar} alt="Opponent" className="profile-picture" />
            <span className="player-name">
              {opponentInfo.name}
              <span className={`turn-indicator ${gameState.currentTurn === (playerRole === 'player1' ? 'player2' : 'player1') ? 'active' : 'waiting'}`}>
                {gameState.currentTurn === (playerRole === 'player1' ? 'player2' : 'player1') ? 'Opponent Turn' : 'Waiting...'}
              </span>
            </span>
          </div>
          <div className="player-hand opponent-hand">
            {opponentData.hand.map((card: CardType, index: number) => {
              const updatedCard = validateCardImageUrl(card, true);
              console.log('Rendering opponent hand card:', updatedCard);
              return (
                <Card
                  key={`opponent-card-${index}`}
                  card={updatedCard}
                  onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => {
                    console.error(`Failed to load image for opponent hand card ${index}: ${updatedCard.imageUrl}`);
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
              console.log('Rendering opponent battlefield card:', updatedCard);
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
                    console.error(`Failed to load image for opponent card ${card.id}: ${updatedCard.imageUrl}`);
                    e.currentTarget.src = cardBackMonster;
                  }}
                />
              );
            })}
          </div>
          <div ref={dropRef as unknown as React.RefObject<HTMLDivElement>} className={`player-field ${isOver ? 'field-highlight' : ''}`}>
            {gameState.battlefield[playerRole].map((card: CardType) => {
              const updatedCard = validateCardImageUrl(card, false);
              console.log('Rendering player battlefield card:', updatedCard);
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
                    console.error(`Failed to load image for player card ${card.id}: ${updatedCard.imageUrl}`);
                  }}
                />
              );
            })}
          </div>
        </div>
        <div className={`player-area current-player ${gameState.currentTurn === playerRole ? 'active-turn' : ''}`}>
          <div className="player-profile">
            <img src={playerInfo.avatar} alt="Player" className="profile-picture" />
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
                console.log('Rendering player hand card:', updatedCard);
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
                        console.log('Player playing card:', updatedCard);
                        onCardPlay(card);
                        addCombatLogEntry(`${playerInfo.name} plays ${card.name}!`, 'play');
                      } else {
                        console.log('Card play ignored: Not player’s turn or battlefield not empty.');
                      }
                    }}
                    onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => {
                      console.error(`Failed to load image for hand card ${card.id}: ${updatedCard.imageUrl}`);
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