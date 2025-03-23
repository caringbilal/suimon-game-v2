// Card type definition
export interface CardType {
  id: string;
  name: string;
  attack: number;
  defense: number;
  hp: number;
  maxHp: number;
  imageUrl: string;
}

// Player interface
export interface Player {
  id: string;
  name: string;
  energy: number;
  deck: CardType[];
  hand: CardType[];
  totalHP: number;
  maxHealth: number;
}

// Combat log entry interface
export interface CombatLogEntry {
  timestamp: number;
  message: string;
  type: string;
}

// Single GameState interface with proper types
export interface GameState {
  gameStatus: 'waiting' | 'playing' | 'finished';
  currentTurn: 'player1' | 'player2';
  battlefield: {
    player1: CardType[];
    player2: CardType[];
  };
  combatLog: CombatLogEntry[];
  killCount: {
    player1: number;
    player2: number;
  };
  player1: Player;
  player2: Player;
  winner?: { id: string; name: string };
}