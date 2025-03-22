import React, { useState, useEffect, Dispatch, SetStateAction, useCallback } from 'react';
import { GameState, CardType } from '../types/game';
import Card from './Card';
import cardBack from '../assets/ui/card-back.png';
import cardBackMonster from '../assets/monsters/card-back.png';
import '../styles/combat.css';
import '../styles/player.css';
import '../styles/game-stats.css';
import GameEndDialog from './GameEndDialog';
import { useDrop } from 'react-dnd';
import { Socket } from 'socket.io-client';

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
  killCount: { player: number; opponent: number };
  playerRole: 'player1' | 'player2';
  roomId: string;
  socket: Socket;
  onCardDefeated?: (defeatedPlayerKey: 'player' | 'opponent') => void;
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

    // Determine player and opponent keys based on playerRole
    const playerKey: 'player' | 'opponent' = playerRole === 'player1' ? 'player' : 'opponent';
    const opponentKey: 'player' | 'opponent' = playerRole === 'player1' ? 'opponent' : 'player';

    // Preload card images to ensure they are available on first render
    useEffect(() => {
      const preloadImages = async () => {
        console.log('Preloading images for cards...');
        const cardsToPreload = [
          ...gameState.players[playerKey].hand,
          ...gameState.players[opponentKey].hand,
          ...gameState.battlefield.player,
          ...gameState.battlefield.opponent,
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
    }, [gameState.players, gameState.battlefield, playerKey, opponentKey]);

    // Sync game state with server
    useEffect(() => {
      socket.on('gameStateUpdated', (newState: GameState) => {
        console.log('Received gameStateUpdated in GameBoard for socket ID:', socket.id, 'newState:', newState);
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
    }, [socket, setGameState]);

    // Debug: Log game state changes
    useEffect(() => {
      console.log('Current gameState in GameBoard:', gameState);
      console.log('Player hand:', gameState.players[playerKey].hand);
      console.log('Opponent hand:', gameState.players[opponentKey].hand);
      console.log('Battlefield (player):', gameState.battlefield.player);
      console.log('Battlefield (opponent):', gameState.battlefield.opponent);
      console.log('Opponent info:', opponentInfo);
      console.log('Current turn:', gameState.currentTurn);
    }, [gameState, playerKey, opponentKey, opponentInfo]);

    // Handle combat (only for Player 1)
    const handleCombat = useCallback(() => {
      const playerCard = gameState.battlefield.player[0];
      const opponentCard = gameState.battlefield.opponent[0];

      if (!playerCard || !opponentCard) {
        console.log('No combat: Missing player or opponent card on battlefield.');
        return;
      }

      console.log('Initiating combat between:', playerCard, 'and', opponentCard);

      const playerDamage = Math.max(2, playerCard.attack - Math.floor(opponentCard.defense * 0.8));
      const opponentDamage = Math.max(2, opponentCard.attack - Math.floor(playerCard.defense * 0.8));
      playerCard.hp -= opponentDamage;
      opponentCard.hp -= playerDamage;

      const playerHpPercentage = Math.round((playerCard.hp / playerCard.maxHp) * 100);
      const opponentHpPercentage = Math.round((opponentCard.hp / playerCard.maxHp) * 100);

      const newCombatLog = [
        ...gameState.combatLog,
        {
          timestamp: Date.now(),
          message: `${playerCard.name} attacks with ${playerCard.attack} ATK vs ${opponentCard.defense} DEF`,
          type: 'combat',
        },
        {
          timestamp: Date.now(),
          message: `${opponentCard.name} attacks with ${opponentCard.attack} ATK vs ${playerCard.defense} DEF`,
          type: 'combat',
        },
        {
          timestamp: Date.now(),
          message: `${playerCard.name} takes ${opponentDamage} damage (HP: ${playerCard.hp}, ${playerHpPercentage}%)`,
          type: 'damage',
        },
        {
          timestamp: Date.now(),
          message: `${opponentCard.name} takes ${playerDamage} damage (HP: ${opponentCard.hp}, ${opponentHpPercentage}%)`,
          type: 'damage',
        },
      ];

      const playerWonRound =
        playerDamage > opponentDamage || (playerDamage === opponentDamage && playerHpPercentage > opponentHpPercentage);
      const roundWinner = playerWonRound ? 'player' : 'opponent';
      const roundLoser = playerWonRound ? 'opponent' : 'player';

      const damageDealt = playerWonRound ? playerDamage : opponentDamage;
      const baseEnergyLoss = Math.max(2, Math.floor(damageDealt * 0.8));
      const winnerEnergyLoss = Math.min(baseEnergyLoss, gameState.players[roundWinner].energy);
      const loserEnergyLoss = Math.min(baseEnergyLoss * 2, gameState.players[roundLoser].energy);

      const updatedPlayers = {
        player: {
          ...gameState.players.player,
          energy: gameState.players.player.energy - (roundWinner === 'player' ? winnerEnergyLoss : loserEnergyLoss),
        },
        opponent: {
          ...gameState.players.opponent,
          energy:
            gameState.players.opponent.energy - (roundWinner === 'opponent' ? winnerEnergyLoss : loserEnergyLoss),
        },
      };

      const updatedBattlefield = {
        player: playerCard.hp > 0 ? [playerCard] : [],
        opponent: opponentCard.hp > 0 ? [opponentCard] : [],
      };

      let nextTurn: 'player' | 'opponent';
      let updatedKillCount = { ...gameState.killCount };
      if (opponentCard.hp <= 0) {
        updatedKillCount = {
          ...updatedKillCount,
          player: updatedKillCount.player + 1,
        };
        nextTurn = 'opponent';
        newCombatLog.push({
          timestamp: Date.now(),
          message: `${opponentCard.name} has been defeated! ${opponentInfo.name}'s turn!`,
          type: 'death',
        });
        onCardDefeated?.('opponent');
      } else if (playerCard.hp <= 0) {
        updatedKillCount = {
          ...updatedKillCount,
          opponent: updatedKillCount.opponent + 1,
        };
        nextTurn = 'player';
        newCombatLog.push({
          timestamp: Date.now(),
          message: `${playerCard.name} has been defeated! ${playerInfo.name}'s turn!`,
          type: 'death',
        });
        onCardDefeated?.('player');
      } else {
        nextTurn = roundLoser;
        newCombatLog.push({
          timestamp: Date.now(),
          message: `Both cards survived! ${roundLoser === 'player' ? playerInfo.name : opponentInfo.name}'s turn!`,
          type: 'combat',
        });
      }

      const updatedState: GameState = {
        ...gameState,
        players: updatedPlayers,
        battlefield: updatedBattlefield,
        currentTurn: nextTurn,
        gameStatus: updatedPlayers.player.energy <= 0 || updatedPlayers.opponent.energy <= 0 ? 'finished' : 'playing',
        combatLog: newCombatLog,
        killCount: updatedKillCount,
      };

      console.log('Updated game state after combat:', updatedState);
      setGameState(updatedState);
      if (roomId) {
        console.log('Emitting updateGame event with updated state:', updatedState);
        socket.emit('updateGame', { roomId, gameState: updatedState, playerRole });
      }
    }, [gameState, onCardDefeated, opponentInfo.name, playerInfo.name, roomId, socket, setGameState]);

    // Combat interval (Player 1 only)
    useEffect(() => {
      if (playerRole === 'player1') {
        console.log('Setting up combat interval for Player 1');
        const fightInterval = setInterval(() => {
          if (gameState.battlefield.player.length > 0 && gameState.battlefield.opponent.length > 0) {
            handleCombat();
          }
        }, 500);
        return () => {
          console.log('Clearing combat interval for Player 1');
          clearInterval(fightInterval);
        };
      }
    }, [playerRole, gameState, handleCombat]);

    // Combat animations
    useEffect(() => {
      if (gameState.battlefield.player.length > 0 && gameState.battlefield.opponent.length > 0) {
        const playerCard = gameState.battlefield.player[0];
        const opponentCard = gameState.battlefield.opponent[0];
        console.log('Setting up combat animations:', { playerCard, opponentCard });
        setAttackingCard(playerCard.id);
        setDefendingCard(opponentCard.id);
        setTimeout(() => {
          setAttackingCard(opponentCard.id);
          setDefendingCard(playerCard.id);
        }, 1000);
      } else {
        setAttackingCard(null);
        setDefendingCard(null);
      }
    }, [gameState.battlefield]);

    // Card drop handling
    const [{ isOver }, dropRef] = useDrop<CardType, void, { isOver: boolean }>({
      accept: 'CARD',
      drop: (item) => {
        const isPlayerTurn =
          playerRole === 'player1'
            ? gameState.currentTurn === 'player' && gameState.gameStatus === 'playing'
            : gameState.currentTurn === 'opponent' && gameState.gameStatus === 'playing';
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

    // Restart game
    const handleRestart = useCallback(() => {
      console.log('Restarting game for room:', roomId);
      setGameState(null);
      if (roomId) {
        socket.emit('restartGame', { roomId, playerRole });
      }
    }, [roomId, socket, setGameState, playerRole]);

    // Ensure cards are loaded before rendering
    if (!imagesLoaded) {
      console.log('Waiting for images to load...');
      return <div className="loading">Loading card images...</div>;
    }

    // Validate and fix card image URL
    const validateCardImageUrl = (card: CardType): CardType => {
      const expectedImageUrl = `/monsters/${card.id}.png`;
      if (!card.imageUrl || card.imageUrl === '/monsters/card-back.png' || card.name.includes('Hidden Card')) {
        console.warn(`Invalid imageUrl or name for card ${card.id}. Setting to expected path: ${expectedImageUrl}`);
        return { ...card, imageUrl: expectedImageUrl, name: card.id };
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
              <span className={gameState.gameStatus}>
                {gameState.gameStatus.charAt(0).toUpperCase() + gameState.gameStatus.slice(1)}
                <span className={`status-dot ${gameState.gameStatus}`}></span>
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
            winner={gameState.players[playerKey].energy <= 0 ? opponentKey : playerKey}
            onRestart={handleRestart}
          />
        )}
        <div className="game-stats-panel">
          <div className="kill-counter">
            <div className="kill-stat">
              <span className="kill-label">Player Kills:</span>
              <span className="kill-value">{killCount.player}</span>
            </div>
            <div className="kill-stat">
              <span className="kill-label">Opponent Kills:</span>
              <span className="kill-value">{killCount.opponent}</span>
            </div>
          </div>
          <div className="health-summary-boxes">
            <div className="health-summary opponent-summary">
              <img src={opponentInfo.avatar} alt="Opponent" className="profile-picture" />
              <div className="summary-content">
                <div className="summary-title">OPPONENT CARDS TOTAL HP</div>
                <div className="summary-value">
                  {gameState.battlefield[opponentKey].reduce((total, card) => total + card.hp, 0) +
                    gameState.players[opponentKey].hand.reduce((total, card) => total + card.hp, 0)}
                  <div className="hp-bar">
                    <div
                      className="hp-fill"
                      style={{ width: `${(gameState.players[opponentKey].energy / gameState.opponentMaxHealth) * 100}%` }}
                    />
                    <span>{gameState.players[opponentKey].energy} Energy</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="health-summary player-summary">
              <img src={playerInfo.avatar} alt="Player" className="profile-picture" />
              <div className="summary-content">
                <div className="summary-title">PLAYER CARDS TOTAL HP</div>
                <div className="summary-value">
                  {gameState.battlefield[playerKey].reduce((total, card) => total + card.hp, 0) +
                    gameState.players[playerKey].hand.reduce((total, card) => total + card.hp, 0)}
                  <div className="hp-bar">
                    <div
                      className="hp-fill"
                      style={{ width: `${(gameState.players[playerKey].energy / gameState.playerMaxHealth) * 100}%` }}
                    />
                    <span>{gameState.players[playerKey].energy} Energy</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="combat-stats-container">
          <div className="combat-stats-display">
            <div className="combat-stats-title">Combat Statistics</div>
            <div className="total-cards-info">
              <div className="player-cards-count">
                Player Total Cards: {gameState.players[playerKey].hand.length + gameState.battlefield[playerKey].length}
              </div>
              <div className="opponent-cards-count">
                Opponent Total Cards: {gameState.players[opponentKey].hand.length + gameState.battlefield[opponentKey].length}
              </div>
            </div>
            <div className="combat-stats-content">
              {combatLog.slice(-5).map((entry, index) => (
                <div key={index} className={`combat-log-entry ${entry.type}`}>
                  {entry.message}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className={`player-area opponent ${gameState.currentTurn === opponentKey ? 'active-turn' : ''}`}>
          <div className="player-profile opponent-profile">
            <img src={opponentInfo.avatar} alt="Opponent" className="profile-picture" />
            <span className="player-name">
              {opponentInfo.name}
              <span className={`turn-indicator ${gameState.currentTurn === opponentKey ? 'active' : 'waiting'}`}>
                {gameState.currentTurn === opponentKey ? 'Opponent Turn' : 'Waiting...'}
              </span>
            </span>
          </div>
          <div className="player-hand opponent-hand">
            {gameState.players[opponentKey].hand.map((card: CardType, index: number) => (
              <div key={`opponent-card-${index}`} className="card card-back">
                <img
                  src={cardBackMonster}
                  alt="Card Back"
                  className="card-back-image"
                  onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => {
                    console.error('Failed to load card back image');
                    e.currentTarget.src = cardBack;
                  }}
                />
                <div className="card-back-overlay"></div>
              </div>
            ))}
          </div>
        </div>
        <div className="battlefield">
          <div className="opponent-field">
            {gameState.battlefield[opponentKey].map((card: CardType) => {
              const updatedCard = validateCardImageUrl(card);
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
                  }}
                />
              );
            })}
          </div>
          <div ref={dropRef as unknown as React.RefObject<HTMLDivElement>} className={`player-field ${isOver ? 'field-highlight' : ''}`}>
            {gameState.battlefield[playerKey].map((card: CardType) => {
              const updatedCard = validateCardImageUrl(card);
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
        <div className={`player-area current-player ${gameState.currentTurn === playerKey ? 'active-turn' : ''}`}>
          <div className="player-profile">
            <img src={playerInfo.avatar} alt="Player" className="profile-picture" />
            <span className="player-name">
              {playerInfo.name}
              <span className={`turn-indicator ${gameState.currentTurn === playerKey ? 'active' : 'waiting'}`}>
                {gameState.currentTurn === playerKey ? 'Your Turn' : 'Please Wait...'}
              </span>
            </span>
          </div>
          <div className="player-hand">
            {gameState.players[playerKey].hand.length > 0 ? (
              gameState.players[playerKey].hand.map((card: CardType) => {
                const updatedCard = validateCardImageUrl(card);
                console.log('Rendering player hand card:', updatedCard);
                return (
                  <Card
                    key={card.id}
                    card={updatedCard}
                    onClick={() => {
                      const isPlayerTurn =
                        playerRole === 'player1'
                          ? gameState.currentTurn === 'player' && gameState.gameStatus === 'playing'
                          : gameState.currentTurn === 'opponent' && gameState.gameStatus === 'playing';
                      if (isPlayerTurn && gameState.battlefield[playerKey].length === 0) {
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