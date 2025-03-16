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
  energy: number;
  deck: CardType[];
  hand: CardType[];
}

// Combat log entry interface
export interface CombatLogEntry {
  timestamp: number;
  message: string;
  type: string;
}

// Single GameState interface with proper types
export interface GameState {
  players: {
    player: Player;
    opponent: Player;
  };
  battlefield: {
    player: CardType[];
    opponent: CardType[];
  };
  currentTurn: 'player' | 'opponent';
  gameStatus: 'waiting' | 'playing' | 'finished';
  playerMaxHealth: number;
  opponentMaxHealth: number;
  combatLog: CombatLogEntry[]; // Added to store combat log entries
  killCount: { player: number; opponent: number }; // Added to store kill counts
}