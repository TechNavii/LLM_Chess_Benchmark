import { ChessGameManager } from '../../../src/domain/chess/ChessGameManager';
import { PlayerColor, GameStatus } from '../../../src/shared/types/CommonTypes';
import { TestPositions, TestMoves, assertValidGameState, createChessPosition } from '../../utils/test-helpers';

describe('ChessGameManager', () => {
  let chessGameManager: ChessGameManager;

  beforeEach(() => {
    chessGameManager = new ChessGameManager();
  });

  describe('Game Initialization', () => {
    it('should initialize a new game with starting position', async () => {
      await chessGameManager.initializeGame();

      const gameState = chessGameManager.getCurrentGameState();
      expect(gameState.fen).toBe(TestPositions.STARTING);
      expect(gameState.currentPlayer).toBe(PlayerColor.WHITE);
      expect(gameState.gameStatus).toBe(GameStatus.IN_PROGRESS);
      expect(gameState.moveHistory).toHaveLength(0);
    });

    it('should initialize game with custom FEN position', async () => {
      const customFen = TestPositions.SICILIAN;
      await chessGameManager.initializeGame({ fen: customFen });

      const gameState = chessGameManager.getCurrentGameState();
      expect(gameState.fen).toBe(customFen);
      expect(gameState.currentPlayer).toBe(PlayerColor.WHITE);
    });

    it('should reset game state when initializing', async () => {
      // Make a move first
      await chessGameManager.initializeGame();
      await chessGameManager.makeMove(TestMoves.E4);

      // Reinitialize
      await chessGameManager.initializeGame();

      const gameState = chessGameManager.getCurrentGameState();
      expect(gameState.fen).toBe(TestPositions.STARTING);
      expect(gameState.moveHistory).toHaveLength(0);
    });
  });

  describe('Move Validation', () => {
    beforeEach(async () => {
      await chessGameManager.initializeGame();
    });

    it('should validate legal moves', () => {
      const result = chessGameManager.validateMove(TestMoves.E4);
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject illegal moves', () => {
      const result = chessGameManager.validateMove(TestMoves.INVALID);
      expect(result.isValid).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('not legal');
    });

    it('should validate promotion moves', () => {
      // Set up position where pawn can promote
      const promotionFen = 'K7/P7/8/8/8/8/8/7k w - - 0 1';
      chessGameManager = new ChessGameManager();
      chessGameManager.initializeGame({ fen: promotionFen });

      const result = chessGameManager.validateMove(TestMoves.PROMOTION);
      expect(result.isValid).toBe(true);
    });

    it('should handle validation errors gracefully', () => {
      // Test with invalid square notation
      const invalidMove = { from: 'invalid', to: 'also-invalid' };
      const result = chessGameManager.validateMove(invalidMove);
      expect(result.isValid).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Making Moves', () => {
    beforeEach(async () => {
      await chessGameManager.initializeGame();
    });

    it('should make valid moves successfully', async () => {
      const moveResult = await chessGameManager.makeMove(TestMoves.E4);

      expect(moveResult.success).toBe(true);
      expect(moveResult.move).toBeDefined();
      expect(moveResult.move!.from).toBe('e2');
      expect(moveResult.move!.to).toBe('e4');
      expect(moveResult.move!.color).toBe(PlayerColor.WHITE);
      expect(moveResult.newGameState).toBeDefined();
    });

    it('should reject invalid moves', async () => {
      const moveResult = await chessGameManager.makeMove(TestMoves.INVALID);

      expect(moveResult.success).toBe(false);
      expect(moveResult.error).toBeDefined();
      expect(moveResult.move).toBeUndefined();
    });

    it('should update move history correctly', async () => {
      await chessGameManager.makeMove(TestMoves.E4);
      await chessGameManager.makeMove(TestMoves.E5);

      const history = chessGameManager.getGameHistory();
      expect(history).toHaveLength(2);
      expect(history[0].from).toBe('e2');
      expect(history[0].to).toBe('e4');
      expect(history[1].from).toBe('e7');
      expect(history[1].to).toBe('e5');
    });

    it('should track captured pieces', async () => {
      // Set up a position where White can capture
      const captureFen = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2';
      await chessGameManager.initializeGame({ fen: captureFen });

      const moveResult = await chessGameManager.makeMove({ from: 'e4', to: 'e5' });

      expect(moveResult.success).toBe(true);
      expect(moveResult.move!.capturedPiece).toBeDefined();
      expect(moveResult.move!.capturedPiece!.color).toBe(PlayerColor.BLACK);

      const gameState = chessGameManager.getCurrentGameState();
      expect(gameState.capturedPieces.white).toHaveLength(1);
    });

    it('should detect check status', async () => {
      // Set up a position that leads to check
      await chessGameManager.makeMove({ from: 'f2', to: 'f3' });
      await chessGameManager.makeMove({ from: 'e7', to: 'e5' });
      await chessGameManager.makeMove({ from: 'g2', to: 'g4' });

      const moveResult = await chessGameManager.makeMove({ from: 'd8', to: 'h4' });

      expect(moveResult.success).toBe(true);
      expect(moveResult.isCheck).toBe(true);
    });

    it('should handle promotion moves', async () => {
      // Set up position where pawn can promote
      const promotionFen = 'K7/P7/8/8/8/8/8/7k w - - 0 1';
      await chessGameManager.initializeGame({ fen: promotionFen });

      const moveResult = await chessGameManager.makeMove(TestMoves.PROMOTION);

      expect(moveResult.success).toBe(true);
      expect(moveResult.move!.promotion).toBe('q');
    });
  });

  describe('Game State Management', () => {
    beforeEach(async () => {
      await chessGameManager.initializeGame();
    });

    it('should provide complete game state', () => {
      const gameState = chessGameManager.getCurrentGameState();

      assertValidGameState(gameState);
      expect(gameState.currentPlayer).toBe(PlayerColor.WHITE);
      expect(gameState.castlingRights).toBeDefined();
      expect(gameState.halfmoveClock).toBe(0);
      expect(gameState.fullmoveNumber).toBe(1);
    });

    it('should update current player after moves', async () => {
      await chessGameManager.makeMove(TestMoves.E4);
      const gameState = chessGameManager.getCurrentGameState();
      expect(gameState.currentPlayer).toBe(PlayerColor.BLACK);
    });

    it('should track castling rights', async () => {
      let gameState = chessGameManager.getCurrentGameState();
      expect(gameState.castlingRights.whiteKingSide).toBe(true);
      expect(gameState.castlingRights.whiteQueenSide).toBe(true);

      // Move king to lose castling rights
      await chessGameManager.makeMove({ from: 'e1', to: 'e2' });
      gameState = chessGameManager.getCurrentGameState();
      expect(gameState.castlingRights.whiteKingSide).toBe(false);
      expect(gameState.castlingRights.whiteQueenSide).toBe(false);
    });

    it('should provide correct FEN and PGN', async () => {
      await chessGameManager.makeMove(TestMoves.E4);
      await chessGameManager.makeMove(TestMoves.E5);

      const fen = chessGameManager.getFEN();
      const pgn = chessGameManager.getPGN();

      expect(fen).toContain('b KQkq');
      expect(pgn).toContain('1. e4 e5');
    });
  });

  describe('Game Completion Detection', () => {
    it('should detect checkmate', async () => {
      // Fool's mate
      await chessGameManager.initializeGame();
      await chessGameManager.makeMove({ from: 'f2', to: 'f3' });
      await chessGameManager.makeMove({ from: 'e7', to: 'e5' });
      await chessGameManager.makeMove({ from: 'g2', to: 'g4' });
      await chessGameManager.makeMove({ from: 'd8', to: 'h4' });

      expect(chessGameManager.isGameComplete()).toBe(true);
      const gameState = chessGameManager.getCurrentGameState();
      expect(gameState.gameStatus).toBe(GameStatus.CHECKMATE);
    });

    it('should detect stalemate', async () => {
      const stalemateFen = '8/8/8/8/8/8/8/K6k w - - 0 1';
      await chessGameManager.initializeGame({ fen: stalemateFen });

      expect(chessGameManager.isGameComplete()).toBe(true);
      const gameState = chessGameManager.getCurrentGameState();
      expect(gameState.gameStatus).toBe(GameStatus.STALEMATE);
    });

    it('should detect draw conditions', async () => {
      // Position with insufficient material
      const drawFen = '8/8/8/8/8/8/8/K6k w - - 0 1';
      await chessGameManager.initializeGame({ fen: drawFen });

      expect(chessGameManager.isGameComplete()).toBe(true);
      const gameState = chessGameManager.getCurrentGameState();
      expect([GameStatus.DRAW, GameStatus.STALEMATE]).toContain(gameState.gameStatus);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle malformed move objects', async () => {
      await chessGameManager.initializeGame();

      const malformedMove = { from: null, to: undefined } as any;
      const moveResult = await chessGameManager.makeMove(malformedMove);

      expect(moveResult.success).toBe(false);
      expect(moveResult.error).toBeDefined();
    });

    it('should handle invalid FEN positions gracefully', async () => {
      const invalidFen = 'invalid-fen-string';

      try {
        await chessGameManager.initializeGame({ fen: invalidFen });
        fail('Expected error to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
    });

    it('should maintain consistency after failed moves', async () => {
      await chessGameManager.initializeGame();
      const initialState = chessGameManager.getCurrentGameState();

      await chessGameManager.makeMove(TestMoves.INVALID);

      const currentState = chessGameManager.getCurrentGameState();
      expect(currentState.fen).toBe(initialState.fen);
      expect(currentState.moveHistory).toHaveLength(0);
    });

    it('should handle concurrent move attempts', async () => {
      await chessGameManager.initializeGame();

      // Simulate concurrent move attempts
      const movePromises = [
        chessGameManager.makeMove(TestMoves.E4),
        chessGameManager.makeMove(TestMoves.E4),
      ];

      const results = await Promise.all(movePromises);

      // Only one should succeed
      const successCount = results.filter(r => r.success).length;
      expect(successCount).toBe(1);
    });
  });
});