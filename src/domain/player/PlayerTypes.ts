import { PlayerColor, GameRules } from '../../shared/types/CommonTypes';
import { GameState, ChessMove } from '../chess/ChessTypes';

export interface PlayerConfiguration {
  id: string;
  color: PlayerColor;
  modelName: string;
  initialTimeMs: number;
  incrementMs: number;
  apiKey?: string;
}

export interface GameContext {
  currentBoard: string;
  moveHistory: ChessMove[];
  gameState: GameState;
  timeRemaining: number;
  opponentTimeRemaining: number;
  gameRules?: GameRules;
  lastMove?: ChessMove;
  possibleMoves?: string[];
  invalidMoveFeedback?: string; // Feedback about previous invalid move attempts
}

export interface MoveResponse {
  from: string;
  to: string;
  promotion?: string;
  offerDraw?: boolean;
}

export interface DrawResponse {
  acceptDraw: boolean;
  reason?: string;
}

export interface LLMPlayer {
  id: string;
  color: PlayerColor;
  modelName: string;
  timeRemaining: number;
  requestMove(gameContext: GameContext): Promise<MoveResponse>;
  respondToDrawOffer?(gameContext: GameContext): Promise<DrawResponse>;
  updateGameContext(gameState: GameState): void;
  getRetryCount(): number;
  incrementRetryCount(): void;
  resetRetryCount(): void;
}