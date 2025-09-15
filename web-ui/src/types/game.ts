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
  FORFEIT: 'forfeit',
  DRAW_OFFERED: 'draw_offered'
} as const;

export type GameStatus = typeof GameStatus[keyof typeof GameStatus];

export const DrawReason = {
  STALEMATE: 'stalemate',
  THREEFOLD_REPETITION: 'threefold_repetition',
  FIFTY_MOVE_RULE: 'fifty_move_rule',
  INSUFFICIENT_MATERIAL: 'insufficient_material',
  AGREEMENT: 'agreement'
} as const;

export type DrawReason = typeof DrawReason[keyof typeof DrawReason];

export interface GameResult {
  winner?: 'white' | 'black';
  result: 'win' | 'draw' | 'timeout' | 'forfeit';
  reason: string;
  drawReason?: DrawReason;
  finalPosition?: string;
  moveCount: number;
}

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