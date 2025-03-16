import React, { useState, useEffect, Dispatch, SetStateAction, useCallback } from 'react';
import { GameState, CardType } from '../types/game';
import Card from './Card';
import cardBack from '../assets/ui/card-back.png';
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
  setGameState: Dispatch<SetStateAction<GameState | null>>;
  playerInfo: { name: string; avatar: string };
  opponentInfo: { name: string; avatar: string };
  combatLog: CombatLogEntry[];
  addCombatLogEntry: (message: string, type: string) => void;
  killCount: { player: number; opponent: number };
  playerRole: 'player1' | 'player2';
  roomId: string | null;
  socket: Socket;
  onCardDefeated?: (defeatedPlayerKey: 'player' | 'opponent') => void;
}

export default React.memo<GameBoardProps>(({
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
  const [attackingCard, setAttackingCard] = useState<string | null>(null);
  const [defendingCard, setDefendingCard] = useState<string | null>(null);

  const playerKey = playerRole === 'player1' ? 'player' : 'opponent';
  const opponentKey = playerRole === 'player1' ? 'opponent' : 'player';

  // Sync game state with server
  useEffect(() => {
    socket.on('updateGameState', (newState: GameState) => {
      setGameState(newState);
    });
    return () => {
      socket.off('updateGameState');
    };
  }, [socket, setGameState]);

  // Handle combat (only for Player 1)
  const handleCombat = useCallback(() => {
    const playerCard = gameState.battlefield.player[0];
    const opponentCard = gameState.battlefield.opponent[0];

    if (!playerCard || !opponentCard) return;

    const playerDamage = Math.max(2, playerCard.attack - Math.floor(opponentCard.defense * 0.8));
    const opponentDamage = Math.max(2, opponentCard.attack - Math.floor(playerCard.defense * 0.8));
    playerCard.hp -= opponentDamage;
    opponentCard.hp -= playerDamage;

    const playerHpPercentage = Math.round((playerCard.hp / playerCard.maxHp) * 100);
    const opponentHpPercentage = Math.round((opponentCard.hp / opponentCard.maxHp) * 100);

    // Add combat log entries
    const newCombatLog = [
      ...gameState.combatLog,
      { timestamp: Date.now(), message: `${playerCard.name} attacks with ${playerCard.attack} ATK vs ${opponentCard.defense} DEF`, type: 'combat' },
      { timestamp: Date.now(), message: `${opponentCard.name} attacks with ${opponentCard.attack} ATK vs ${playerCard.defense} DEF`, type: 'combat' },
      { timestamp: Date.now(), message: `${playerCard.name} takes ${opponentDamage} damage (HP: ${playerCard.hp}, ${playerHpPercentage}%)`, type: 'damage' },
      { timestamp: Date.now(), message: `${opponentCard.name} takes ${playerDamage} damage (HP: ${opponentCard.hp}, ${opponentHpPercentage}%)`, type: 'damage' },
    ];

    const playerWonRound = playerDamage > opponentDamage || 
                          (playerDamage === opponentDamage && playerHpPercentage > opponentHpPercentage);
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
        energy: gameState.players.opponent.energy - (roundWinner === 'opponent' ? winnerEnergyLoss : loserEnergyLoss),
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
        player: updatedKillCount.player + 1
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
        opponent: updatedKillCount.opponent + 1
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

    setGameState(updatedState);
    if (roomId) {
      socket.emit('updateGameState', roomId, updatedState);
    }
  }, [gameState, onCardDefeated, opponentInfo.name, playerInfo.name, roomId, socket, setGameState]);

  // Combat interval (Player 1 only)
  useEffect(() => {
    if (playerRole === 'player1') {
      const fightInterval = setInterval(() => {
        if (gameState.battlefield.player.length > 0 && gameState.battlefield.opponent.length > 0) {
          handleCombat();
        }
      }, 500);
      return () => clearInterval(fightInterval);
    }
  }, [playerRole, gameState, handleCombat]);

  // Combat animations
  useEffect(() => {
    if (gameState.battlefield[playerKey].length > 0 && gameState.battlefield[opponentKey].length > 0) {
      const playerCard = gameState.battlefield[playerKey][0];
      const opponentCard = gameState.battlefield[opponentKey][0];
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
  }, [gameState.battlefield, playerKey, opponentKey]);

  // Card drop handling
  const [{ isOver }, dropRef] = useDrop<CardType, void, { isOver: boolean }>({    accept: 'CARD',
    drop: (item) => {
      const isPlayerTurn = playerRole === 'player1' ? 
        (gameState.currentTurn === 'player' && gameState.gameStatus === 'playing') : 
        (gameState.currentTurn === 'opponent' && gameState.gameStatus === 'playing');
      if (isPlayerTurn) {
        onCardPlay(item);
        // Update game state with new turn
        const newState: GameState = {
          ...gameState,
          currentTurn: playerRole === 'player1' ? 'opponent' : 'player'
        };
        setGameState(newState);
        if (roomId) {
          socket.emit('updateGameState', roomId, newState);
        }
      }
      return undefined;
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
  });

  // Restart game
  const handleRestart = useCallback(() => {
    const newState: GameState = {
      gameStatus: 'waiting',
      currentTurn: 'player',
      battlefield: { player: [], opponent: [] },
      players: {
        player: { id: 'player1', hand: gameState.players.player.hand, deck: [], energy: 700 },
        opponent: { id: 'player2', hand: gameState.players.opponent.hand, deck: [], energy: 700 },
      },
      playerMaxHealth: 700,
      opponentMaxHealth: 700,
      combatLog: [],
      killCount: { player: 0, opponent: 0 },
    };
    setGameState(newState);
    if (roomId) {
      socket.emit('updateGameState', roomId, newState);
    }
  }, [gameState.players.player.hand, gameState.players.opponent.hand, roomId, socket, setGameState]);

  return (
    <div className="game-board">
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
          {gameState.players[opponentKey].hand.map((card: CardType) => (
            <div key={card.id} className="card">
              <img src={cardBack} alt="Card Back" className="card-back-image" />
            </div>
          ))}
        </div>
      </div>
      <div className="battlefield">
        <div className="opponent-field">
          {gameState.battlefield[opponentKey].map((card: CardType) => (
            <Card
              key={card.id}
              card={card}
              isAttacking={attackingCard === card.id}
              isDefending={defendingCard === card.id}
              onAnimationEnd={() => {
                if (attackingCard === card.id) setAttackingCard(null);
                if (defendingCard === card.id) setDefendingCard(null);
              }}
            />
          ))}
        </div>
        <div ref={dropRef as unknown as React.RefObject<HTMLDivElement>} className={`player-field ${isOver ? 'field-highlight' : ''}`}>
          {gameState.battlefield[playerKey].map((card: CardType) => (
            <Card
              key={card.id}
              card={card}
              isAttacking={attackingCard === card.id}
              isDefending={defendingCard === card.id}
              onAnimationEnd={() => {
                if (attackingCard === card.id) setAttackingCard(null);
                if (defendingCard === card.id) setDefendingCard(null);
              }}
            />
          ))}
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
          {gameState.players[playerKey].hand.map((card: CardType) => (
            <Card 
              key={card.id} 
              card={card} 
              onClick={() => gameState.currentTurn === playerKey ? onCardPlay(card) : null} 
            />
          ))}
        </div>
      </div>
    </div>
  );
});