import { Chess } from 'chess.js';
import { PlayerColor, GameStatus, TimerType, OutputFormat } from '../../src/shared/types/CommonTypes';
import { GameConfiguration } from '../../src/infrastructure/config/ConfigTypes';
import { PlayerConfiguration } from '../../src/domain/player/PlayerTypes';
import { ChessMove } from '../../src/domain/chess/ChessTypes';
import { TimerConfiguration } from '../../src/domain/timer/TimerTypes';

/**
 * Creates a mock player configuration for testing
 */
export function createMockPlayerConfig(
  color: PlayerColor,
  overrides?: Partial<PlayerConfiguration>
): PlayerConfiguration {
  return {
    id: `${color.toLowerCase()}-player`,
    color,
    modelName: 'test-model',
    initialTimeMs: 600000, // 10 minutes
    incrementMs: 5000, // 5 seconds
    ...overrides,
  };
}

/**
 * Creates a mock game configuration for testing
 */
export function createMockGameConfig(
  overrides?: Partial<GameConfiguration>
): GameConfiguration {
  return {
    whitePlayer: {
      id: 'white-player',
      modelName: 'test-white-model',
      initialTimeMs: 600000,
      incrementMs: 5000,
    },
    blackPlayer: {
      id: 'black-player',
      modelName: 'test-black-model',
      initialTimeMs: 600000,
      incrementMs: 5000,
    },
    timerType: TimerType.FISCHER,
    outputFormat: OutputFormat.PGN,
    saveGame: false,
    ...overrides,
  };
}

/**
 * Creates a mock timer configuration for testing
 */
export function createMockTimerConfig(
  overrides?: Partial<TimerConfiguration>
): TimerConfiguration {
  return {
    initialTimeMs: 600000, // 10 minutes
    incrementMs: 5000, // 5 seconds
    type: TimerType.FISCHER,
    ...overrides,
  };
}

/**
 * Creates a chess move object for testing
 */
export function createChessMove(
  from: string,
  to: string,
  color: PlayerColor,
  overrides?: Partial<ChessMove>
): ChessMove {
  const notation = `${from}${to}`;
  return {
    from,
    to,
    notation,
    san: notation,
    fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    timestamp: new Date(),
    timeUsed: 1000,
    color,
    ...overrides,
  };
}

/**
 * Helper to create a chess position for testing
 */
export function createChessPosition(fen?: string): Chess {
  const chess = new Chess();
  if (fen) {
    chess.load(fen);
  }
  return chess;
}

/**
 * Common FEN positions for testing
 */
export const TestPositions = {
  STARTING: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  AFTER_E4: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1',
  SICILIAN: 'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq c6 0 2',
  CHECKMATE: 'rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3',
  STALEMATE: 'k7/8/K7/8/8/8/8/8 b - - 0 1',
  DRAW_BY_INSUFFICIENT: '8/8/8/8/8/8/8/K6k w - - 0 1',
};

/**
 * Test moves for common scenarios
 */
export const TestMoves = {
  E4: { from: 'e2', to: 'e4' },
  E5: { from: 'e7', to: 'e5' },
  NF3: { from: 'g1', to: 'f3' },
  NC6: { from: 'b8', to: 'c6' },
  INVALID: { from: 'e2', to: 'e6' }, // Invalid move from starting position
  CASTLING_KINGSIDE: { from: 'e1', to: 'g1' },
  CASTLING_QUEENSIDE: { from: 'e1', to: 'c1' },
  PROMOTION: { from: 'a7', to: 'a8', promotion: 'q' },
};

/**
 * Sleep utility for tests
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Creates a mock logger for testing
 */
export function createMockLogger(): jest.MockedFunction<(message: string) => void> {
  return jest.fn();
}

/**
 * Asserts that a move is valid in chess.js format
 */
export function assertValidMove(move: any): void {
  expect(move).toHaveProperty('from');
  expect(move).toHaveProperty('to');
  expect(typeof move.from).toBe('string');
  expect(typeof move.to).toBe('string');
  expect(move.from).toMatch(/^[a-h][1-8]$/);
  expect(move.to).toMatch(/^[a-h][1-8]$/);
}

/**
 * Asserts that a game state has the expected structure
 */
export function assertValidGameState(gameState: any): void {
  expect(gameState).toHaveProperty('board');
  expect(gameState).toHaveProperty('currentPlayer');
  expect(gameState).toHaveProperty('moveHistory');
  expect(gameState).toHaveProperty('gameStatus');
  expect(gameState).toHaveProperty('fen');
  expect(gameState).toHaveProperty('pgn');
  expect(Array.isArray(gameState.moveHistory)).toBe(true);
}

/**
 * Creates a sequence of moves for testing game flow
 */
export function createMoveSequence(): Array<{ from: string; to: string }> {
  return [
    TestMoves.E4,    // 1. e4
    TestMoves.E5,    // 1... e5
    TestMoves.NF3,   // 2. Nf3
    TestMoves.NC6,   // 2... Nc6
  ];
}

/**
 * Mock implementation for timing tests
 */
export class MockTimer {
  private startTime: number = 0;
  private elapsed: number = 0;

  start(): void {
    this.startTime = Date.now();
  }

  stop(): number {
    if (this.startTime === 0) return 0;
    this.elapsed = Date.now() - this.startTime;
    this.startTime = 0;
    return this.elapsed;
  }

  getElapsed(): number {
    if (this.startTime > 0) {
      return Date.now() - this.startTime;
    }
    return this.elapsed;
  }

  reset(): void {
    this.startTime = 0;
    this.elapsed = 0;
  }
}