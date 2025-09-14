import { LLMPlayer, PlayerConfiguration, GameContext } from './PlayerTypes';
import { PlayerColor } from '../../shared/types/CommonTypes';
import { GameState } from '../chess/ChessTypes';
import { ILLMApiClient } from '../../infrastructure/api/LLMApiTypes';

export class LLMPlayerImpl implements LLMPlayer {
  public id: string;
  public color: PlayerColor;
  public modelName: string;
  public timeRemaining: number;
  private retryCount: number = 0;
  private apiClient: ILLMApiClient;
  private currentGameState?: GameState;

  constructor(
    config: PlayerConfiguration,
    apiClient: ILLMApiClient
  ) {
    this.id = config.id;
    this.color = config.color;
    this.modelName = config.modelName;
    this.timeRemaining = config.initialTimeMs;
    this.apiClient = apiClient;
  }

  async requestMove(gameContext: GameContext): Promise<{ from: string; to: string; promotion?: string }> {
    const prompt = this.buildPrompt(gameContext);

    try {
      const response = await this.apiClient.sendRequest({
        model: this.modelName,
        messages: [
          {
            role: 'system',
            content: `You are a chess engine playing as ${this.color}. You MUST respond with ONLY a JSON object containing your move.

RULES:
1. Response must be ONLY valid JSON
2. No text before or after the JSON
3. Format: {"from": "e2", "to": "e4"}
4. For pawn promotion add: "promotion": "q"

EXAMPLES OF VALID RESPONSES:
{"from": "e2", "to": "e4"}
{"from": "g1", "to": "f3"}
{"from": "e7", "to": "e8", "promotion": "q"}

DO NOT include explanations, just the JSON move.`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        maxTokens: 50
      });

      const moveText = response.content;
      console.log(`[LLMPlayer] Raw response from ${this.modelName}: "${moveText}"`);
      return this.parseMove(moveText);
    } catch (error) {
      console.log(`[LLMPlayer] Error from ${this.modelName}: ${error}`);

      // If the LLM fails, try to make a random legal move as fallback
      if (gameContext.possibleMoves && gameContext.possibleMoves.length > 0) {
        console.log(`[LLMPlayer] Using fallback move for ${this.color}`);
        const randomMove = gameContext.possibleMoves[Math.floor(Math.random() * gameContext.possibleMoves.length)];
        const from = randomMove.substring(0, 2);
        const to = randomMove.substring(2, 4);
        const promotion = randomMove.length > 4 ? randomMove.substring(4) : undefined;
        return { from, to, promotion };
      }

      throw new Error(`Failed to get move from ${this.modelName}: ${error}`);
    }
  }

  updateGameContext(gameState: GameState): void {
    this.currentGameState = gameState;
  }

  getRetryCount(): number {
    return this.retryCount;
  }

  incrementRetryCount(): void {
    this.retryCount++;
  }

  resetRetryCount(): void {
    this.retryCount = 0;
  }

  private buildPrompt(context: GameContext): string {
    const moveList = context.moveHistory
      .map((move, index) => {
        const moveNumber = Math.floor(index / 2) + 1;
        if (index % 2 === 0) {
          return `${moveNumber}. ${move.notation}`;
        } else {
          return ` ${move.notation}`;
        }
      })
      .join('');

    const possibleMovesText = context.possibleMoves
      ? `\nLegal moves available: ${context.possibleMoves.join(', ')}`
      : '';

    const invalidMoveFeedback = context.invalidMoveFeedback
      ? `\n⚠️ IMPORTANT: ${context.invalidMoveFeedback}\n`
      : '';

    return `${invalidMoveFeedback}Current game state:
FEN: ${context.gameState.fen}
Your color: ${this.color}
Current turn: ${context.gameState.currentPlayer}
Game status: ${context.gameState.gameStatus}

Move history: ${moveList || 'Game just started'}

Your time remaining: ${Math.floor(context.timeRemaining / 1000)} seconds
Opponent time remaining: ${Math.floor(context.opponentTimeRemaining / 1000)} seconds
${possibleMovesText}

Please analyze the position and provide your next move. Consider:
1. Tactical opportunities (checks, captures, threats)
2. Positional advantages (center control, piece development)
3. Time management (you have ${Math.floor(context.timeRemaining / 1000)} seconds remaining)

Respond only with a valid JSON object containing your move.`;
  }

  private parseMove(responseText: string): { from: string; to: string; promotion?: string } {
    try {
      const jsonMatch = responseText.match(/\{[^}]+\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const move = JSON.parse(jsonMatch[0]);

      // Handle case where LLM might concatenate from and to in the "from" field
      if (move.from && !move.to && move.from.length === 4) {
        return {
          from: move.from.substring(0, 2).toLowerCase(),
          to: move.from.substring(2, 4).toLowerCase(),
          promotion: move.promotion?.toLowerCase()
        };
      }

      if (!move.from || !move.to) {
        throw new Error('Invalid move format: missing from or to');
      }

      return {
        from: move.from.toLowerCase(),
        to: move.to.toLowerCase(),
        promotion: move.promotion?.toLowerCase()
      };
    } catch (error) {
      throw new Error(`Failed to parse move from response: ${responseText}. Error: ${error}`);
    }
  }

  async askLLM(prompt: string): Promise<string> {
    try {
      const response = await this.apiClient.sendRequest({
        model: this.modelName,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      });

      return response.content || 'Unable to provide a response';
    } catch (error) {
      console.error(`[LLMPlayer] Failed to get response from ${this.modelName}:`, error);
      return 'Unable to provide a response due to an error';
    }
  }
}