import { IChessGameManager } from '../domain/chess/ChessGameManager';
import { IPlayerManager } from '../domain/player/PlayerManager';
import { IGameTimerManager } from '../domain/timer/GameTimerManager';
import { IStateManager } from '../infrastructure/storage/StateManager';
import { GameConfiguration } from '../infrastructure/config/ConfigTypes';
import { GameContext } from '../domain/player/PlayerTypes';
import { GameStatus, PlayerColor, GameResult, DrawReason, DrawOffer } from '../shared/types/CommonTypes';
import { InvalidMoveError, TimeoutError, ErrorResolution } from '../shared/errors/GameErrors';
import { LLMApiError } from '../infrastructure/api/LLMApiTypes';
import { Chess } from 'chess.js';

export interface IGameOrchestrator {
  startGame(configuration: GameConfiguration): Promise<void>;
  processGameLoop(): Promise<GameResult>;
  pauseGame(): void;
  resumeGame(): void;
  getGameStatus(): GameStatus;
}

export class GameOrchestrator implements IGameOrchestrator {
  private gameStatus: GameStatus = GameStatus.NOT_STARTED;
  private isPaused: boolean = false;
  private gameId: string;
  private maxRetries: number = 3;
  private moveCount: number = 0;
  private invalidMoveAttempts: Map<string, Map<string, number>> = new Map(); // playerId -> {move -> count}
  private lastInvalidMoveReason: Map<string, string> = new Map(); // playerId -> reason

  constructor(
    private gameManager: IChessGameManager,
    private playerManager: IPlayerManager,
    private timerManager: IGameTimerManager,
    private stateManager: IStateManager,
    private logger: (message: string) => void = console.log
  ) {
    this.gameId = Date.now().toString();
  }

  async startGame(configuration: GameConfiguration): Promise<void> {
    try {
      await this.gameManager.initializeGame();

      this.timerManager.initializeTimer(
        configuration.whitePlayer.id,
        {
          initialTimeMs: configuration.whitePlayer.initialTimeMs,
          incrementMs: configuration.whitePlayer.incrementMs,
          type: configuration.timerType
        }
      );

      this.timerManager.initializeTimer(
        configuration.blackPlayer.id,
        {
          initialTimeMs: configuration.blackPlayer.initialTimeMs,
          incrementMs: configuration.blackPlayer.incrementMs,
          type: configuration.timerType
        }
      );

      this.gameStatus = GameStatus.IN_PROGRESS;

      if (configuration.saveGame) {
        await this.stateManager.saveConfiguration(configuration);
      }

      this.logger('Game started successfully');
      this.logger(`White: ${configuration.whitePlayer.modelName}`);
      this.logger(`Black: ${configuration.blackPlayer.modelName}`);
    } catch (error) {
      this.gameStatus = GameStatus.NOT_STARTED;
      throw error;
    }
  }

  async processGameLoop(): Promise<GameResult> {
    this.logger('[GameLoop] Starting game loop');
    while (!this.gameManager.isGameComplete() &&
           (this.gameStatus === GameStatus.IN_PROGRESS || this.gameStatus === GameStatus.PAUSED)) {
      if (this.isPaused) {
        await this.sleep(1000);
        continue;
      }

      const currentPlayer = this.playerManager.getCurrentPlayer();
      this.logger(`\n--- Move ${Math.floor(this.moveCount / 2) + 1} - ${currentPlayer.color}'s turn ---`);

      try {
        const { timeUsed, move } = await this.processTurn(currentPlayer);

        if (this.timerManager.isTimeExpired(currentPlayer.id)) {
          throw new TimeoutError(currentPlayer.id, currentPlayer.color);
        }

        this.timerManager.addIncrement(currentPlayer.id, 5000);

        // Handle draw offer if present
        if (move && (move as any).offerDraw) {
          const drawResult = await this.handleDrawOffer(currentPlayer);
          if (drawResult) {
            return drawResult;
          }
        }

        this.playerManager.switchTurn();
        this.moveCount++;

        currentPlayer.resetRetryCount();

        // Add a small delay between moves to avoid rate limits
        await this.sleep(2000);

        const gameState = this.gameManager.getCurrentGameState();
        if (gameState.gameStatus === GameStatus.CHECKMATE) {
          return this.createResult('win', gameState);
        } else if (gameState.gameStatus === GameStatus.STALEMATE) {
          return this.createResult('draw', gameState, DrawReason.STALEMATE);
        } else if (gameState.gameStatus === GameStatus.DRAW) {
          // Detect specific draw reason
          const drawReason = await this.detectDrawReason();
          this.logger(`[GameLoop] Game drawn: ${drawReason || 'Unknown reason'}`);
          return this.createResult('draw', gameState, drawReason);
        }

      } catch (error) {
        const resolution = await this.handleError(error, currentPlayer);

        if (resolution === ErrorResolution.END_GAME) {
          this.logger('[GameLoop] Ending game due to error');
          return this.createErrorResult(error);
        } else if (resolution === ErrorResolution.FORFEIT) {
          this.logger(`[GameLoop] ${currentPlayer.color} forfeits the game`);

          // Get the invalid moves this player attempted
          const playerMoveAttempts = this.invalidMoveAttempts.get(currentPlayer.id);
          const invalidMoves: string[] = [];
          if (playerMoveAttempts) {
            playerMoveAttempts.forEach((count, move) => {
              invalidMoves.push(`${move} (${count}x)`);
            });
          }

          // Ask the forfeiting player for a reason
          const forfeitReason = await this.askForfeitReason(currentPlayer, error, invalidMoves);

          // Add forfeit to move history
          const forfeitMove = {
            from: 'forfeit',
            to: 'forfeit',
            piece: undefined,
            notation: `${currentPlayer.color} forfeits: ${forfeitReason}`,
            san: 'forfeit',
            fen: this.gameManager.getCurrentGameState().fen,
            timestamp: new Date(),
            timeUsed: 0,
            color: currentPlayer.color
          };

          // Add to game state
          const currentState = this.gameManager.getCurrentGameState();
          currentState.moveHistory.push(forfeitMove);

          const forfeitResult = this.createForfeitResult(currentPlayer.color, forfeitReason);
          this.logger(`[GameLoop] Returning forfeit result: ${JSON.stringify(forfeitResult)}`);
          return forfeitResult;
        } else if (resolution === ErrorResolution.PAUSE_GAME) {
          this.pauseGame();
          // Continue the loop instead of ending the game
          continue;
        } else if (resolution === ErrorResolution.RETRY) {
          // Continue the loop to retry the turn
          continue;
        }
      }
    }

    const finalState = this.gameManager.getCurrentGameState();
    return this.createResult(
      finalState.gameStatus === GameStatus.CHECKMATE ? 'win' : 'draw',
      finalState
    );
  }

  pauseGame(): void {
    if (this.gameStatus === GameStatus.IN_PROGRESS) {
      this.isPaused = true;
      this.gameStatus = GameStatus.PAUSED;

      // Pause timers for both players
      const allPlayers = this.playerManager.getAllPlayers();
      for (const player of allPlayers) {
        try {
          this.timerManager.pauseTimer(player.id);
        } catch (e) {
          // Timer might not be running, which is ok
        }
      }

      this.logger('Game paused');
    }
  }

  resumeGame(): void {
    if (this.gameStatus === GameStatus.PAUSED) {
      this.isPaused = false;
      this.gameStatus = GameStatus.IN_PROGRESS;

      // Resume timer for current player only
      const currentPlayer = this.playerManager.getCurrentPlayer();
      if (currentPlayer) {
        this.timerManager.startTimer(currentPlayer.id);
      }

      this.logger('Game resumed');
    }
  }

  getGameStatus(): GameStatus {
    return this.gameStatus;
  }

  getGameManager(): IChessGameManager {
    return this.gameManager;
  }

  private async processTurn(player: any): Promise<{ timeUsed: number; move: any }> {
    this.timerManager.startTimer(player.id);

    try {
      const gameContext = this.buildGameContext(player);
      const chess = new Chess(gameContext.gameState.fen);
      const possibleMoves = chess.moves({ verbose: true });
      gameContext.possibleMoves = possibleMoves.map(m => `${m.from}${m.to}`);

      // Add invalid move feedback if there was a recent invalid move
      const invalidMoveReason = this.lastInvalidMoveReason.get(player.id);
      if (invalidMoveReason) {
        gameContext.invalidMoveFeedback = invalidMoveReason;
        this.lastInvalidMoveReason.delete(player.id);
      }

      this.logger(`Requesting move from ${player.modelName}...`);

      // Retry loop for API calls
      let move;
      let attemptCount = 0;
      const maxAttempts = 3;

      while (attemptCount < maxAttempts) {
        try {
          move = await player.requestMove(gameContext);
          break; // Success, exit retry loop
        } catch (error: any) {
          attemptCount++;

          if (error.message && error.message.includes('Rate limit')) {
            if (attemptCount < maxAttempts) {
              this.logger(`Rate limit hit, waiting 15 seconds before retry (attempt ${attemptCount}/${maxAttempts})...`);
              await this.sleep(15000);
              continue;
            }
          } else if (error.message && (error.message.includes('LLMApiError') || error.message.includes('Failed to parse move'))) {
            if (attemptCount < maxAttempts) {
              this.logger(`API/Parse error, waiting 3 seconds before retry (attempt ${attemptCount}/${maxAttempts}): ${error.message}`);
              await this.sleep(3000);
              continue;
            }
          } else if (error.message && error.message.includes('No JSON found')) {
            if (attemptCount < maxAttempts) {
              this.logger(`Invalid response format, retrying (attempt ${attemptCount}/${maxAttempts})...`);
              await this.sleep(2000);
              continue;
            }
          }

          // If we've exhausted retries, log the error and throw it
          if (attemptCount >= maxAttempts) {
            this.logger(`Failed after ${maxAttempts} attempts: ${error.message}`);
          }
          throw error;
        }
      }

      if (!move) {
        throw new Error('Failed to get move after retries');
      }

      const timeUsed = this.timerManager.pauseTimer(player.id);

      this.logger(`${player.color} plays: ${move.from}${move.to}${move.promotion || ''}`);

      const moveResult = await this.gameManager.makeMove(move);

      if (!moveResult.success) {
        throw new InvalidMoveError(moveResult.error || 'Invalid move', move);
      }

      if (moveResult.move) {
        this.logger(`Move notation: ${moveResult.move.notation}`);
      }

      if (moveResult.isCheck) {
        this.logger('CHECK!');
      }

      const allPlayers = this.playerManager.getAllPlayers();
      for (const p of allPlayers) {
        p.updateGameContext(this.gameManager.getCurrentGameState());
      }

      return { timeUsed, move };
    } catch (error) {
      this.timerManager.pauseTimer(player.id);
      throw error;
    }
  }

  private buildGameContext(player: any): GameContext {
    const gameState = this.gameManager.getCurrentGameState();
    const opponentColor = player.color === PlayerColor.WHITE ? PlayerColor.BLACK : PlayerColor.WHITE;
    const opponent = this.playerManager.getPlayerByColor(opponentColor);

    return {
      currentBoard: gameState.fen,
      moveHistory: gameState.moveHistory,
      gameState: gameState,
      timeRemaining: this.timerManager.getRemainingTime(player.id),
      opponentTimeRemaining: this.timerManager.getRemainingTime(opponent.id),
      lastMove: gameState.moveHistory[gameState.moveHistory.length - 1]
    };
  }

  private async handleError(error: any, player: any): Promise<ErrorResolution> {
    this.logger(`Error: ${error.message}`);

    if (error instanceof TimeoutError) {
      this.gameStatus = GameStatus.TIMEOUT;
      return ErrorResolution.END_GAME;
    }

    if (error instanceof InvalidMoveError) {
      // Track the invalid move attempt per specific move
      const moveStr = error.move ? `${error.move.from}${error.move.to}${error.move.promotion || ''}` : 'unknown';

      // Get or create the move attempts map for this player
      let playerMoveAttempts = this.invalidMoveAttempts.get(player.id);
      if (!playerMoveAttempts) {
        playerMoveAttempts = new Map<string, number>();
        this.invalidMoveAttempts.set(player.id, playerMoveAttempts);
      }

      // Increment the count for this specific move
      const currentCount = playerMoveAttempts.get(moveStr) || 0;
      const newCount = currentCount + 1;
      playerMoveAttempts.set(moveStr, newCount);

      // Store the reason for this invalid move to provide feedback
      this.lastInvalidMoveReason.set(player.id,
        `⚠️ Your move ${moveStr} was invalid. ${error.message}. ` +
        `Attempt ${newCount}/3 for this move. Please choose a different legal move.`);

      // Log the invalid move with a warning
      this.logger(`⚠️ Invalid move (${moveStr}) by ${player.color}, attempt ${newCount}/3 for this specific move`);

      // Only forfeit if the SAME move has been attempted 3 times
      if (newCount >= this.maxRetries) {
        this.logger(`${player.color} attempted the same invalid move ${moveStr} three times. Forfeiting...`);

        // Get all invalid moves this player has attempted
        const allInvalidMoves: string[] = [];
        playerMoveAttempts.forEach((count, move) => {
          allInvalidMoves.push(`${move} (${count}x)`);
        });

        return ErrorResolution.FORFEIT;
      } else {
        // Give the player another chance with feedback about the invalid move
        this.logger(`Giving ${player.color} another chance after invalid move ${moveStr}`);
        return ErrorResolution.RETRY;
      }
    }

    // For parsing errors or other API errors that weren't caught in processTurn
    if (error.message && (error.message.includes('parse') || error.message.includes('JSON'))) {
      player.incrementRetryCount();
      if (player.getRetryCount() < this.maxRetries) {
        this.logger(`Parse error, retrying... (${player.getRetryCount()}/${this.maxRetries})`);
        return ErrorResolution.RETRY;
      } else {
        this.logger(`Max retries exceeded for ${player.color} due to parsing errors`);
        return ErrorResolution.FORFEIT;
      }
    }

    // For other unhandled errors
    this.logger(`Unhandled error type: ${error.constructor.name}`);
    // Still give it a chance to retry
    player.incrementRetryCount();
    if (player.getRetryCount() < this.maxRetries) {
      return ErrorResolution.RETRY;
    }
    return ErrorResolution.FORFEIT;
  }

  private createResult(type: 'win' | 'draw', gameState: any, drawReason?: DrawReason): GameResult {
    let winner: PlayerColor | undefined;
    let reason: string;

    if (type === 'win') {
      winner = gameState.currentPlayer === PlayerColor.WHITE ? PlayerColor.BLACK : PlayerColor.WHITE;
      reason = 'Checkmate';
    } else {
      // Provide specific draw reason
      if (drawReason) {
        switch (drawReason) {
          case DrawReason.STALEMATE:
            reason = 'Stalemate - No legal moves available';
            break;
          case DrawReason.THREEFOLD_REPETITION:
            reason = 'Threefold Repetition - Same position occurred 3 times';
            break;
          case DrawReason.FIFTY_MOVE_RULE:
            reason = 'Fifty-Move Rule - 50 moves without pawn move or capture';
            break;
          case DrawReason.INSUFFICIENT_MATERIAL:
            reason = 'Insufficient Material - Neither side can checkmate';
            break;
          case DrawReason.AGREEMENT:
            reason = 'Draw by Agreement - Both players agreed to draw';
            break;
          default:
            reason = 'Draw';
        }
      } else if (gameState.gameStatus === GameStatus.STALEMATE) {
        reason = 'Stalemate';
        drawReason = DrawReason.STALEMATE;
      } else {
        reason = 'Draw';
      }
    }

    this.logger(`[GameResult] ${type === 'win' ? `Winner: ${winner}` : 'Draw'} - ${reason}`);

    return {
      winner,
      result: type,
      reason,
      drawReason,
      finalPosition: gameState.fen,
      moveCount: this.moveCount
    };
  }

  private createErrorResult(error: any): GameResult {
    if (error instanceof TimeoutError) {
      const winner = error.playerColor === PlayerColor.WHITE ? PlayerColor.BLACK : PlayerColor.WHITE;
      return {
        winner,
        result: 'timeout',
        reason: `${error.playerColor} ran out of time`,
        moveCount: this.moveCount
      };
    }

    return {
      result: 'draw',
      reason: `Game ended due to error: ${error.message}`,
      moveCount: this.moveCount
    };
  }

  private createForfeitResult(forfeitingColor: PlayerColor, reason: string): GameResult {
    const winner = forfeitingColor === PlayerColor.WHITE ? PlayerColor.BLACK : PlayerColor.WHITE;
    return {
      winner,
      result: 'forfeit',
      reason: `${forfeitingColor} forfeited: ${reason}`,
      moveCount: this.moveCount
    };
  }

  private async askForfeitReason(player: any, error: any, invalidMoves: string[]): Promise<string> {
    try {
      this.logger(`Asking ${player.color} for forfeit reason...`);

      // Format the invalid moves for display
      const invalidMovesStr = invalidMoves.length > 0
        ? `Your attempted invalid moves: ${invalidMoves.join(', ')}`
        : 'You attempted invalid moves';

      // Create a prompt asking for the reason for invalid moves and forfeit
      const prompt = `You attempted to make invalid moves in the chess game and must now forfeit.

Current board position (FEN): ${this.gameManager.getCurrentGameState().fen}
${invalidMovesStr}

Please explain in 2-3 sentences:
1. Why you think your moves (${invalidMoves.join(', ')}) were invalid
2. What you were trying to accomplish with those moves
3. What mistake you made in evaluating the position

Respond with only your explanation, no additional formatting.`;

      // If player has an LLM connection, ask for reason
      if (player.askLLM) {
        const reason = await player.askLLM(prompt);

        // Include the invalid moves in the reason
        if (invalidMoves.length > 0) {
          return `Attempted invalid moves: ${invalidMoves.join(', ')}. ${reason}`;
        }
        return reason || 'Unable to continue playing due to repeated invalid moves';
      }

      // Default reason if can't ask LLM
      if (invalidMoves.length > 0) {
        return `Attempted invalid moves: ${invalidMoves.join(', ')}. Unable to continue playing.`;
      }
      return 'Unable to continue playing due to repeated invalid moves';
    } catch (e) {
      this.logger(`Failed to get forfeit reason from ${player.color}: ${e}`);
      if (invalidMoves.length > 0) {
        return `Attempted invalid moves: ${invalidMoves.join(', ')}. Unable to continue playing.`;
      }
      return 'Unable to continue playing due to repeated invalid moves';
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async detectDrawReason(): Promise<DrawReason | undefined> {
    const gameState = this.gameManager.getCurrentGameState();
    const chess = new Chess(gameState.fen);

    if (chess.isStalemate()) {
      return DrawReason.STALEMATE;
    }

    if (chess.isInsufficientMaterial()) {
      return DrawReason.INSUFFICIENT_MATERIAL;
    }

    if (chess.isThreefoldRepetition()) {
      return DrawReason.THREEFOLD_REPETITION;
    }

    // Check for fifty-move rule
    const halfmoveClock = parseInt(gameState.fen.split(' ')[4]);
    if (halfmoveClock >= 100) {
      return DrawReason.FIFTY_MOVE_RULE;
    }

    return undefined;
  }

  private async handleDrawOffer(offeringPlayer: any): Promise<GameResult | null> {
    const opponent = this.playerManager.getOpponent(offeringPlayer.color);

    if (!opponent) {
      return null;
    }

    this.logger(`[DrawOffer] ${offeringPlayer.color} offers a draw`);

    // Check if opponent has a method to respond to draw offers
    if (!opponent.respondToDrawOffer) {
      this.logger(`[DrawOffer] ${opponent.color} cannot respond to draw offers`);
      return null;
    }

    const gameContext = this.buildGameContext(opponent);
    const response = await opponent.respondToDrawOffer(gameContext);

    if (response.acceptDraw) {
      this.logger(`[DrawOffer] ${opponent.color} accepts the draw: ${response.reason || 'No reason given'}`);
      const gameState = this.gameManager.getCurrentGameState();
      return this.createResult('draw', gameState, DrawReason.AGREEMENT);
    } else {
      this.logger(`[DrawOffer] ${opponent.color} declines the draw: ${response.reason || 'No reason given'}`);
      return null;
    }
  }
}