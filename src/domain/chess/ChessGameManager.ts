import { Chess } from 'chess.js';
import { ChessMove, GameState, MoveResult, ValidationResult, ChessPiece } from './ChessTypes';
import { PlayerColor, GameStatus, GameRules, CastlingRights, DrawReason } from '../../shared/types/CommonTypes';

export interface IChessGameManager {
  initializeGame(config?: { fen?: string }): Promise<void>;
  makeMove(move: { from: string; to: string; promotion?: string }): Promise<MoveResult>;
  isGameComplete(): boolean;
  getCurrentGameState(): GameState;
  getGameHistory(): ChessMove[];
  validateMove(move: { from: string; to: string; promotion?: string }): ValidationResult;
  getFEN(): string;
  getPGN(): string;
}

export class ChessGameManager implements IChessGameManager {
  private chess: Chess;
  private moveHistory: ChessMove[] = [];
  private gameStatus: GameStatus = GameStatus.NOT_STARTED;
  private capturedPieces: {
    white: ChessPiece[];
    black: ChessPiece[];
  } = {
    white: [],
    black: []
  };

  constructor() {
    this.chess = new Chess();
  }

  async initializeGame(config?: { fen?: string }): Promise<void> {
    if (config?.fen) {
      this.chess.load(config.fen);
    } else {
      this.chess.reset();
    }
    this.moveHistory = [];
    this.gameStatus = GameStatus.IN_PROGRESS;
    this.capturedPieces = { white: [], black: [] };
  }

  async makeMove(move: { from: string; to: string; promotion?: string }): Promise<MoveResult> {
    try {
      const validation = this.validateMove(move);
      if (!validation.isValid) {
        return {
          success: false,
          error: validation.error
        };
      }

      const moveTimestamp = new Date();
      const currentPlayer = this.chess.turn() === 'w' ? PlayerColor.WHITE : PlayerColor.BLACK;

      const result = this.chess.move(move);

      if (!result) {
        return {
          success: false,
          error: 'Invalid move'
        };
      }

      const chessMove: ChessMove = {
        from: result.from,
        to: result.to,
        notation: result.san,
        san: result.san,
        fen: this.chess.fen(),
        timestamp: moveTimestamp,
        timeUsed: 0,
        color: currentPlayer,
        promotion: result.promotion
      };

      if (result.captured) {
        const capturedPiece = {
          type: result.captured as any,
          color: currentPlayer === PlayerColor.WHITE ? PlayerColor.BLACK : PlayerColor.WHITE
        };
        this.capturedPieces[currentPlayer].push(capturedPiece);
        chessMove.capturedPiece = capturedPiece;
      }

      this.moveHistory.push(chessMove);
      this.updateGameStatus();

      const drawReason = this.getDrawReason();

      return {
        success: true,
        move: chessMove,
        newGameState: this.getCurrentGameState(),
        isCheck: this.chess.inCheck(),
        isCheckmate: this.chess.isCheckmate(),
        isStalemate: this.chess.isStalemate(),
        isDraw: this.chess.isDraw(),
        drawReason
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  validateMove(move: { from: string; to: string; promotion?: string }): ValidationResult {
    try {
      const moves = this.chess.moves({ verbose: true });
      const isValid = moves.some(m =>
        m.from === move.from &&
        m.to === move.to &&
        (!move.promotion || m.promotion === move.promotion)
      );

      if (!isValid) {
        return {
          isValid: false,
          error: 'Move is not legal in current position'
        };
      }

      return { isValid: true };
    } catch (error) {
      return {
        isValid: false,
        error: error instanceof Error ? error.message : 'Validation error'
      };
    }
  }

  isGameComplete(): boolean {
    return this.chess.isGameOver();
  }

  getCurrentGameState(): GameState {
    const board = this.chess.board();
    const squares = new Map();

    for (let rank = 0; rank < 8; rank++) {
      for (let file = 0; file < 8; file++) {
        const square = String.fromCharCode(97 + file) + (8 - rank);
        const piece = board[rank][file];
        squares.set(square, piece ? {
          type: piece.type,
          color: piece.color === 'w' ? PlayerColor.WHITE : PlayerColor.BLACK
        } : null);
      }
    }

    return {
      board: {
        squares,
        activeColor: this.chess.turn() === 'w' ? PlayerColor.WHITE : PlayerColor.BLACK
      },
      currentPlayer: this.chess.turn() === 'w' ? PlayerColor.WHITE : PlayerColor.BLACK,
      moveHistory: this.moveHistory,
      gameStatus: this.gameStatus,
      capturedPieces: this.capturedPieces,
      castlingRights: this.getCastlingRights(),
      enPassantTarget: this.getEnPassantTarget(),
      halfmoveClock: parseInt(this.chess.fen().split(' ')[4]),
      fullmoveNumber: parseInt(this.chess.fen().split(' ')[5]),
      fen: this.chess.fen(),
      pgn: this.chess.pgn()
    };
  }

  getGameHistory(): ChessMove[] {
    return [...this.moveHistory];
  }

  getFEN(): string {
    return this.chess.fen();
  }

  getPGN(): string {
    return this.chess.pgn();
  }

  private updateGameStatus(): void {
    if (this.chess.isCheckmate()) {
      this.gameStatus = GameStatus.CHECKMATE;
    } else if (this.chess.isStalemate()) {
      this.gameStatus = GameStatus.STALEMATE;
    } else if (this.chess.isDraw()) {
      this.gameStatus = GameStatus.DRAW;
    } else if (this.chess.inCheck()) {
      this.gameStatus = GameStatus.CHECK;
    } else {
      this.gameStatus = GameStatus.IN_PROGRESS;
    }
  }

  private getCastlingRights(): CastlingRights {
    const fen = this.chess.fen();
    const castling = fen.split(' ')[2];

    return {
      whiteKingSide: castling.includes('K'),
      whiteQueenSide: castling.includes('Q'),
      blackKingSide: castling.includes('k'),
      blackQueenSide: castling.includes('q')
    };
  }

  private getEnPassantTarget(): string | undefined {
    const fen = this.chess.fen();
    const enPassant = fen.split(' ')[3];
    return enPassant === '-' ? undefined : enPassant;
  }

  private getDrawReason(): DrawReason | undefined {
    if (!this.chess.isDraw()) {
      return undefined;
    }

    // Check for stalemate first
    if (this.chess.isStalemate()) {
      return DrawReason.STALEMATE;
    }

    // Check for insufficient material
    if (this.chess.isInsufficientMaterial()) {
      return DrawReason.INSUFFICIENT_MATERIAL;
    }

    // Check for threefold repetition
    if (this.chess.isThreefoldRepetition()) {
      return DrawReason.THREEFOLD_REPETITION;
    }

    // Check for fifty-move rule
    // The fifty-move rule is triggered when halfmove clock reaches 100 (50 full moves)
    const fen = this.chess.fen();
    const halfmoveClock = parseInt(fen.split(' ')[4]);
    if (halfmoveClock >= 100) {
      return DrawReason.FIFTY_MOVE_RULE;
    }

    // If it's a draw but none of the above, it might be a future agreement
    // For now, return undefined
    return undefined;
  }
}