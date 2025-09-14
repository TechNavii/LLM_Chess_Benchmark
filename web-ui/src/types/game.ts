export interface ChessMove {
  from: string;
  to: string;
  piece?: any;
  notation: string;
  san?: string;
  fen?: string;
  timestamp: Date;
  timeUsed: number;
  color: 'white' | 'black';
}

export interface GameState {
  fen: string;
  pgn: string;
  moveHistory: ChessMove[];
  gameStatus: GameStatus;
  currentPlayer: 'white' | 'black';
}

export const GameStatus = {
  NOT_STARTED: 'not_started',
  IN_PROGRESS: 'in_progress',
  CHECK: 'check',
  CHECKMATE: 'checkmate',
  STALEMATE: 'stalemate',
  DRAW: 'draw',
  PAUSED: 'paused',
  TIMEOUT: 'timeout',
  FORFEIT: 'forfeit'
} as const;

export type GameStatus = typeof GameStatus[keyof typeof GameStatus];

export interface PlayerInfo {
  id: string;
  color: 'white' | 'black';
  modelName: string;
  timeRemaining: number;
}

export interface GameConfiguration {
  whitePlayer: {
    id: string;
    modelName: string;
    initialTimeMs: number;
    incrementMs: number;
  };
  blackPlayer: {
    id: string;
    modelName: string;
    initialTimeMs: number;
    incrementMs: number;
  };
  timerType: 'fischer' | 'bronstein' | 'simple';
  outputFormat: 'pgn' | 'json';
  saveGame: boolean;
}