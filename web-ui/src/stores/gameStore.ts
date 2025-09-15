import { create } from 'zustand';
import type { GameState, ChessMove, PlayerInfo } from '../types/game';
import { GameStatus } from '../types/game';

interface GameStore {
  gameStatus: GameStatus;
  currentFen: string;
  moveHistory: ChessMove[];
  currentPlayer: 'white' | 'black';
  whitePlayer: PlayerInfo | null;
  blackPlayer: PlayerInfo | null;
  whiteTime: number;
  blackTime: number;
  isThinking: boolean;
  thinkingText: string;
  lastMove: ChessMove | null;
  gameResult: { winner?: string; reason?: string } | null;

  updateGameState: (state: Partial<GameState>) => void;
  setPlayers: (white: PlayerInfo, black: PlayerInfo) => void;
  updateTime: (whiteTime: number, blackTime: number) => void;
  setThinking: (isThinking: boolean, text?: string) => void;
  addMove: (move: ChessMove) => void;
  setGameResult: (result: { winner?: string; reason?: string } | null) => void;
  resetGame: () => void;
}

export const useGameStore = create<GameStore>((set) => ({
  gameStatus: GameStatus.NOT_STARTED,
  currentFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  moveHistory: [],
  currentPlayer: 'white',
  whitePlayer: null,
  blackPlayer: null,
  whiteTime: 600000,
  blackTime: 600000,
  isThinking: false,
  thinkingText: '',
  lastMove: null,
  gameResult: null,

  updateGameState: (state) => set((prev) => ({
    ...prev,
    ...state,
    currentFen: state.fen || prev.currentFen,
    moveHistory: state.moveHistory || prev.moveHistory,
    gameStatus: state.gameStatus || prev.gameStatus,
    currentPlayer: state.currentPlayer || prev.currentPlayer,
  })),

  setPlayers: (white, black) => set({
    whitePlayer: white,
    blackPlayer: black,
  }),

  updateTime: (whiteTime, blackTime) => set({
    whiteTime,
    blackTime,
  }),

  setThinking: (isThinking, text = '') => set({
    isThinking,
    thinkingText: text,
  }),

  addMove: (move) => set((state) => ({
    moveHistory: [...state.moveHistory, move],
    lastMove: move,
  })),

  setGameResult: (result) => set({
    gameResult: result,
  }),

  resetGame: () => set({
    gameStatus: GameStatus.NOT_STARTED,
    currentFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    moveHistory: [],
    currentPlayer: 'white',
    whiteTime: 600000,  // Reset to 10 minutes
    blackTime: 600000,  // Reset to 10 minutes
    isThinking: false,
    thinkingText: '',
    lastMove: null,
    gameResult: null,
  }),
}))