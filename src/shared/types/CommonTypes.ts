export enum PlayerColor {
  WHITE = 'white',
  BLACK = 'black'
}

export enum GameStatus {
  NOT_STARTED = 'not_started',
  IN_PROGRESS = 'in_progress',
  CHECK = 'check',
  CHECKMATE = 'checkmate',
  STALEMATE = 'stalemate',
  DRAW = 'draw',
  PAUSED = 'paused',
  TIMEOUT = 'timeout',
  FORFEIT = 'forfeit',
  DRAW_OFFERED = 'draw_offered'
}

export enum DrawReason {
  STALEMATE = 'stalemate',
  THREEFOLD_REPETITION = 'threefold_repetition',
  FIFTY_MOVE_RULE = 'fifty_move_rule',
  INSUFFICIENT_MATERIAL = 'insufficient_material',
  AGREEMENT = 'agreement'
}

export enum TimerType {
  FISCHER = 'fischer',
  BRONSTEIN = 'bronstein',
  SIMPLE = 'simple'
}

export enum OutputFormat {
  PGN = 'pgn',
  JSON = 'json',
  TEXT = 'text'
}

export interface Position {
  file: string;
  rank: number;
}

export interface ChessPiece {
  type: 'p' | 'n' | 'b' | 'r' | 'q' | 'k';
  color: PlayerColor;
  position?: Position;
}

export interface CastlingRights {
  whiteKingSide: boolean;
  whiteQueenSide: boolean;
  blackKingSide: boolean;
  blackQueenSide: boolean;
}

export interface GameRules {
  allowCastling: boolean;
  allowEnPassant: boolean;
  allowPromotion: boolean;
  threefoldRepetitionDraw: boolean;
  fiftyMoveRuleDraw: boolean;
}

export interface GameResult {
  winner?: PlayerColor;
  result: 'win' | 'draw' | 'timeout' | 'forfeit';
  reason: string;
  drawReason?: DrawReason;
  finalPosition?: string;
  moveCount: number;
}

export interface DrawOffer {
  player: PlayerColor;
  moveNumber: number;
  timestamp: Date;
  accepted?: boolean;
  respondedBy?: PlayerColor;
}