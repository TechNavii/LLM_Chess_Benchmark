import { Server, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import { GameOrchestrator } from '../../application/GameOrchestrator';
import { GameConfiguration } from '../../infrastructure/config/ConfigTypes';
import { GameState, ChessMove } from '../../domain/chess/ChessTypes';
import { PlayerColor, GameStatus } from '../../shared/types/CommonTypes';
import { Chess } from 'chess.js';

export interface ServerToClientEvents {
  'game:started': (data: { gameId: string; config: GameConfiguration }) => void;
  'game:move': (data: { move: ChessMove; gameState: GameState }) => void;
  'game:thinking': (data: { player: PlayerColor; thinking: boolean; text?: string }) => void;
  'game:timeUpdate': (data: { whiteTime: number; blackTime: number }) => void;
  'game:ended': (data: { result: any }) => void;
  'game:error': (data: { message: string; code?: string }) => void;
  'game:status': (data: { status: GameStatus }) => void;
  'game:boardUpdate': (data: { fen: string; pgn: string }) => void;
  'game:drawOffer': (data: { player: PlayerColor; accepted?: boolean; reason?: string }) => void;
}

export interface ClientToServerEvents {
  'game:start': (config: GameConfiguration) => void;
  'game:pause': () => void;
  'game:resume': () => void;
  'game:reset': () => void;
  'game:export': (format: 'pgn' | 'json') => void;
  'game:getModels': () => void;
}

export class GameWebSocketServer {
  private io: Server<ClientToServerEvents, ServerToClientEvents>;
  private orchestrator?: GameOrchestrator;
  private gameInProgress: boolean = false;
  private currentSocket?: Socket;

  constructor(server: HttpServer) {
    this.io = new Server(server, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST']
      }
    });
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.io.on('connection', (socket) => {
      console.log('Client connected:', socket.id);
      this.currentSocket = socket;

      socket.on('game:start', async (config: GameConfiguration) => {
        if (this.gameInProgress) {
          socket.emit('game:error', {
            message: 'A game is already in progress',
            code: 'GAME_IN_PROGRESS'
          });
          return;
        }

        try {
          await this.startGame(config, socket);
        } catch (error) {
          socket.emit('game:error', {
            message: error instanceof Error ? error.message : 'Failed to start game'
          });
        }
      });

      socket.on('game:pause', () => {
        if (this.orchestrator) {
          this.orchestrator.pauseGame();
          socket.emit('game:status', { status: GameStatus.PAUSED });
        }
      });

      socket.on('game:resume', () => {
        if (this.orchestrator) {
          this.orchestrator.resumeGame();
          socket.emit('game:status', { status: GameStatus.IN_PROGRESS });
        }
      });

      socket.on('game:reset', () => {
        this.gameInProgress = false;
        this.orchestrator = undefined;
        socket.emit('game:status', { status: GameStatus.NOT_STARTED });
      });

      socket.on('game:export', async (format: 'pgn' | 'json') => {
        if (this.orchestrator) {
          const gameState = this.orchestrator.getGameManager().getCurrentGameState();
          const exportData = format === 'pgn' ? gameState.pgn : JSON.stringify(gameState, null, 2);
          socket.emit('game:boardUpdate', {
            fen: gameState.fen,
            pgn: exportData
          });
        }
      });

      socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
      });
    });
  }

  private async startGame(config: GameConfiguration, socket: Socket): Promise<void> {
    const { ChessGameManager } = await import('../../domain/chess/ChessGameManager');
    const { PlayerManager } = await import('../../domain/player/PlayerManager');
    const { GameTimerManager } = await import('../../domain/timer/GameTimerManager');
    const { StateManager } = await import('../../infrastructure/storage/StateManager');
    const { OpenRouterClient } = await import('../../infrastructure/api/OpenRouterClient');

    const apiKey = process.env.OPENROUTER_API_KEY || '';
    if (!apiKey) {
      throw new Error('OpenRouter API key not configured');
    }

    const apiClient = new OpenRouterClient(apiKey);
    const chessManager = new ChessGameManager();
    const playerManager = new PlayerManager();
    const timerManager = new GameTimerManager({
      initialTimeMs: config.whitePlayer.initialTimeMs,
      incrementMs: config.whitePlayer.incrementMs,
      type: config.timerType
    });
    const stateManager = new StateManager();

    await playerManager.createPlayer({
      id: config.whitePlayer.id,
      color: PlayerColor.WHITE,
      modelName: config.whitePlayer.modelName,
      initialTimeMs: config.whitePlayer.initialTimeMs,
      incrementMs: config.whitePlayer.incrementMs
    }, apiClient);

    await playerManager.createPlayer({
      id: config.blackPlayer.id,
      color: PlayerColor.BLACK,
      modelName: config.blackPlayer.modelName,
      initialTimeMs: config.blackPlayer.initialTimeMs,
      incrementMs: config.blackPlayer.incrementMs
    }, apiClient);

    this.orchestrator = new GameOrchestrator(
      chessManager,
      playerManager,
      timerManager,
      stateManager,
      (message: string) => {
        console.log(`[WebSocket] ${message}`);

        // Handle invalid move warnings
        if (message.includes('⚠️ Invalid move')) {
          const player = message.includes('white') ? PlayerColor.WHITE : PlayerColor.BLACK;
          const moveMatch = message.match(/Invalid move \(([^)]+)\)/);
          const move = moveMatch ? moveMatch[1] : 'unknown';
          const attemptMatch = message.match(/attempt (\d+)\/3/);
          const attempt = attemptMatch ? attemptMatch[1] : '1';

          socket.emit('game:invalidMove', {
            player,
            move,
            attempt: parseInt(attempt),
            message: message
          });
        }

        if (message.includes('thinking') || message.includes('Requesting move')) {
          const player = message.includes('white') ? PlayerColor.WHITE : PlayerColor.BLACK;
          socket.emit('game:thinking', { player, thinking: true, text: message });
        }

        if (message.includes('plays:')) {
          // Send thinking finished event
          const player = message.includes('white') ? PlayerColor.WHITE : PlayerColor.BLACK;
          socket.emit('game:thinking', { player, thinking: false });
        }

        if (message.includes('Move notation:')) {
          const gameState = chessManager.getCurrentGameState();
          const lastMove = gameState.moveHistory[gameState.moveHistory.length - 1];
          socket.emit('game:move', { move: lastMove, gameState });
          socket.emit('game:boardUpdate', { fen: gameState.fen, pgn: gameState.pgn });

          // Also send time update after each move
          const whiteTime = timerManager.getRemainingTime(config.whitePlayer.id);
          const blackTime = timerManager.getRemainingTime(config.blackPlayer.id);
          socket.emit('game:timeUpdate', { whiteTime, blackTime });
        }

        if (message.includes('Rate limit hit')) {
          socket.emit('game:status', { status: GameStatus.IN_PROGRESS });
          socket.emit('game:thinking', {
            player: message.includes('white') ? PlayerColor.WHITE : PlayerColor.BLACK,
            thinking: true,
            text: 'Waiting for rate limit cooldown (15 seconds)...'
          });
        }

        if (message.includes('Game paused')) {
          socket.emit('game:status', { status: GameStatus.PAUSED });
        }

        if (message.includes('Max retries exceeded') || message.includes('forfeit')) {
          socket.emit('game:thinking', {
            player: message.includes('white') ? PlayerColor.WHITE : PlayerColor.BLACK,
            thinking: false,
            text: message
          });
        }
      }
    );

    this.gameInProgress = true;
    await this.orchestrator.startGame(config);
    socket.emit('game:started', { gameId: Date.now().toString(), config });

    setTimeout(async () => {
      try {
        console.log('[WebSocket] Starting processGameLoop...');
        const result = await this.orchestrator!.processGameLoop();
        console.log('[WebSocket] Game loop completed with result:', result);
        socket.emit('game:ended', { result });
        this.gameInProgress = false;
      } catch (error) {
        console.log('[WebSocket] Game loop error:', error);
        socket.emit('game:error', {
          message: error instanceof Error ? error.message : 'Game error'
        });
        socket.emit('game:ended', {
          result: {
            result: 'error',
            reason: error instanceof Error ? error.message : 'Game error',
            moveCount: 0
          }
        });
        this.gameInProgress = false;
      }
    }, 100);
  }

  public getOrchestrator(): GameOrchestrator | undefined {
    return this.orchestrator;
  }
}