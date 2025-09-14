import { PlayerColor, Position, CastlingRights, GameStatus, ChessPiece } from '../../shared/types/CommonTypes';

export { ChessPiece } from '../../shared/types/CommonTypes';

export interface ChessMove {
  from: string;
  to: string;
  piece?: ChessPiece;
  capturedPiece?: ChessPiece;
  promotion?: string;
  notation: string;
  san?: string;
  fen?: string;
  timestamp: Date;
  timeUsed: number;
  color: PlayerColor;
}

export interface ChessBoard {
  squares: Map<string, ChessPiece | null>;
  activeColor: PlayerColor;
}

export interface GameState {
  board: ChessBoard;
  currentPlayer: PlayerColor;
  moveHistory: ChessMove[];
  gameStatus: GameStatus;
  capturedPieces: {
    white: ChessPiece[];
    black: ChessPiece[];
  };
  castlingRights: CastlingRights;
  enPassantTarget?: string;
  halfmoveClock: number;
  fullmoveNumber: number;
  fen: string;
  pgn: string;
}

export interface MoveResult {
  success: boolean;
  move?: ChessMove;
  newGameState?: GameState;
  error?: string;
  isCheck?: boolean;
  isCheckmate?: boolean;
  isStalemate?: boolean;
  isDraw?: boolean;
}

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}