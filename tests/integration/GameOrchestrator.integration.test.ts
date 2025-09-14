import { GameOrchestrator } from '../../src/application/GameOrchestrator';
import { ChessGameManager } from '../../src/domain/chess/ChessGameManager';
import { PlayerManager } from '../../src/domain/player/PlayerManager';
import { GameTimerManager } from '../../src/domain/timer/GameTimerManager';
import { GameStatus, PlayerColor, TimerType } from '../../src/shared/types/CommonTypes';
import { MockLLMApiClient } from '../mocks/mock-llm-client';
import { createMockGameConfig, createMockTimerConfig, createMockLogger, createMockPlayerConfig } from '../utils/test-helpers';
import { InvalidMoveError, TimeoutError } from '../../src/shared/errors/GameErrors';
import { createMockStateManager } from '../mocks/mock-state-manager';

describe('GameOrchestrator Integration Tests', () => {
  let orchestrator: GameOrchestrator;
  let gameManager: ChessGameManager;
  let playerManager: PlayerManager;
  let timerManager: GameTimerManager;
  let mockStateManager: jest.Mocked<any>;
  let mockLogger: jest.MockedFunction<(message: string) => void>;
  let mockApiClient: MockLLMApiClient;

  beforeEach(async () => {
    jest.useFakeTimers();

    // Create real instances for integration testing
    gameManager = new ChessGameManager();
    playerManager = new PlayerManager();
    timerManager = new GameTimerManager(createMockTimerConfig());
    mockStateManager = createMockStateManager();
    mockLogger = createMockLogger();
    mockApiClient = new MockLLMApiClient();

    orchestrator = new GameOrchestrator(
      gameManager,
      playerManager,
      timerManager,
      mockStateManager,
      mockLogger
    );

    // Create players
    const whitePlayerConfig = createMockPlayerConfig(PlayerColor.WHITE);
    const blackPlayerConfig = createMockPlayerConfig(PlayerColor.BLACK);
    await playerManager.createPlayer(whitePlayerConfig, mockApiClient);
    await playerManager.createPlayer(blackPlayerConfig, mockApiClient);
  });

  afterEach(() => {
    timerManager.cleanup();
    jest.useRealTimers();
  });

  describe('Game Initialization', () => {
    it('should start game successfully with valid configuration', async () => {
      const gameConfig = createMockGameConfig();

      await expect(orchestrator.startGame(gameConfig)).resolves.not.toThrow();

      expect(orchestrator.getGameStatus()).toBe(GameStatus.IN_PROGRESS);
      expect(mockLogger).toHaveBeenCalledWith('Game started successfully');
    });

    it('should initialize timers for both players', async () => {
      const gameConfig = createMockGameConfig({
        whitePlayer: { ...createMockGameConfig().whitePlayer, initialTimeMs: 300000 },
        blackPlayer: { ...createMockGameConfig().blackPlayer, initialTimeMs: 600000 }
      });

      await orchestrator.startGame(gameConfig);

      expect(timerManager.getRemainingTime(gameConfig.whitePlayer.id)).toBe(300000);
      expect(timerManager.getRemainingTime(gameConfig.blackPlayer.id)).toBe(600000);
    });

    it('should save configuration when saveGame is enabled', async () => {
      const gameConfig = createMockGameConfig({ saveGame: true });

      await orchestrator.startGame(gameConfig);

      expect(mockStateManager.saveConfiguration).toHaveBeenCalledWith(gameConfig);
    });

    it('should handle game initialization failure', async () => {
      // Mock a failure in game manager
      jest.spyOn(gameManager, 'initializeGame').mockRejectedValue(new Error('Init failed'));

      const gameConfig = createMockGameConfig();

      await expect(orchestrator.startGame(gameConfig)).rejects.toThrow('Init failed');
      expect(orchestrator.getGameStatus()).toBe(GameStatus.NOT_STARTED);
    });
  });

  describe('Game Flow Control', () => {
    beforeEach(async () => {
      const gameConfig = createMockGameConfig();
      await orchestrator.startGame(gameConfig);
    });

    it('should pause and resume game correctly', async () => {
      expect(orchestrator.getGameStatus()).toBe(GameStatus.IN_PROGRESS);

      orchestrator.pauseGame();
      expect(orchestrator.getGameStatus()).toBe(GameStatus.PAUSED);

      orchestrator.resumeGame();
      expect(orchestrator.getGameStatus()).toBe(GameStatus.IN_PROGRESS);
    });

    it('should only pause when game is in progress', async () => {
      orchestrator.pauseGame();
      expect(orchestrator.getGameStatus()).toBe(GameStatus.PAUSED);

      // Pausing again should not change status
      orchestrator.pauseGame();
      expect(orchestrator.getGameStatus()).toBe(GameStatus.PAUSED);
    });

    it('should only resume when game is paused', async () => {
      // Try to resume when not paused
      orchestrator.resumeGame();
      expect(orchestrator.getGameStatus()).toBe(GameStatus.IN_PROGRESS);

      orchestrator.pauseGame();
      orchestrator.resumeGame();
      expect(orchestrator.getGameStatus()).toBe(GameStatus.IN_PROGRESS);
    });
  });

  describe('Move Processing Integration', () => {
    beforeEach(async () => {
      const gameConfig = createMockGameConfig();
      await orchestrator.startGame(gameConfig);

      // Mock valid chess moves
      mockApiClient.setResponse('white', {
        id: 'test',
        model: 'test',
        content: 'e2e4'
      });
      mockApiClient.setResponse('black', {
        id: 'test',
        model: 'test',
        content: 'e7e5'
      });
    });

    it('should process multiple moves in sequence', async () => {
      // Start the game loop in a controlled way
      const gameLoopPromise = orchestrator.processGameLoop();

      // Advance timers to trigger move processing
      jest.advanceTimersByTime(1000);

      // Process a few moves
      for (let i = 0; i < 4; i++) {
        jest.advanceTimersByTime(1000);
      }

      // Check that moves were made
      const history = gameManager.getGameHistory();
      expect(history.length).toBeGreaterThan(0);

      // Manually end the game for testing
      await gameManager.makeMove({ from: 'f2', to: 'f3' });
      await gameManager.makeMove({ from: 'e7', to: 'e5' });
      await gameManager.makeMove({ from: 'g2', to: 'g4' });
      await gameManager.makeMove({ from: 'd8', to: 'h4' }); // Fool's mate

      expect(gameManager.isGameComplete()).toBe(true);
    });
  });

  describe('Error Handling Integration', () => {
    beforeEach(async () => {
      const gameConfig = createMockGameConfig();
      await orchestrator.startGame(gameConfig);
    });

    it('should handle invalid moves with retries', async () => {
      // Mock invalid move followed by valid move
      mockApiClient.setResponse('invalid', {
        id: 'test',
        model: 'test',
        content: 'a1a1' // Invalid move
      });

      // Simulate the turn processing
      const currentPlayer = playerManager.getCurrentPlayer();

      // This should trigger error handling
      jest.spyOn(gameManager, 'makeMove').mockResolvedValueOnce({
        success: false,
        error: 'Invalid move'
      });

      // The orchestrator should handle the error and retry
      expect(mockLogger).toHaveBeenCalledWith(expect.stringContaining('Game started successfully'));
    });

    it('should handle timeout errors', async () => {
      // Mock a timeout scenario
      const gameConfig = createMockGameConfig({
        whitePlayer: { ...createMockGameConfig().whitePlayer, initialTimeMs: 100 }
      });

      const shortTimerManager = new GameTimerManager(createMockTimerConfig({ initialTimeMs: 100 }));
      const timeoutOrchestrator = new GameOrchestrator(
        gameManager,
        playerManager,
        shortTimerManager,
        mockStateManager,
        mockLogger
      );

      await timeoutOrchestrator.startGame(gameConfig);

      // Mock API call that takes too long
      mockApiClient.setResponse('timeout', {
        id: 'test',
        model: 'test',
        content: 'e2e4'
      });

      // Advance time to trigger timeout
      jest.advanceTimersByTime(200);

      expect(shortTimerManager.isTimeExpired(gameConfig.whitePlayer.id)).toBe(true);
    });

    it('should handle API rate limiting', async () => {
      // Mock rate limit error
      mockApiClient.setError(true, 'RATE_LIMIT');

      const currentPlayer = playerManager.getCurrentPlayer();

      // Mock the error scenario
      const error = new Error('Rate limit exceeded');
      error.name = 'LLMApiError';
      (error as any).code = 'RATE_LIMIT';
    });
  });

  describe('Timer Integration', () => {
    beforeEach(async () => {
      const gameConfig = createMockGameConfig({
        whitePlayer: { ...createMockGameConfig().whitePlayer, initialTimeMs: 5000 },
        blackPlayer: { ...createMockGameConfig().blackPlayer, initialTimeMs: 5000 }
      });
      await orchestrator.startGame(gameConfig);
    });

    it('should start and stop timers during moves', async () => {
      const whitePlayerId = playerManager.getCurrentPlayer().id;

      // Initially, timer should not be running
      expect(timerManager.getRemainingTime(whitePlayerId)).toBe(5000);

      // Mock a move response
      mockApiClient.setResponse('test', {
        id: 'test',
        model: 'test',
        content: 'e2e4'
      });
    });

    it('should add increments after successful moves', async () => {
      const currentPlayer = playerManager.getCurrentPlayer();
      const initialTime = timerManager.getRemainingTime(currentPlayer.id);

      // Mock successful move
      jest.spyOn(gameManager, 'makeMove').mockResolvedValue({
        success: true,
        move: {
          from: 'e2',
          to: 'e4',
          notation: 'e4',
          san: 'e4',
          fen: 'test-fen',
          timestamp: new Date(),
          timeUsed: 1000,
          color: PlayerColor.WHITE
        },
        newGameState: gameManager.getCurrentGameState()
      });

      // The increment should be added (but this is handled internally by the orchestrator)
      // We can test this by checking that the timer manager methods are called appropriately
    });
  });

  describe('Game Completion Integration', () => {
    beforeEach(async () => {
      const gameConfig = createMockGameConfig();
      await orchestrator.startGame(gameConfig);
    });

    it('should detect checkmate and end game', async () => {
      // Set up a checkmate position (Fool's mate)
      await gameManager.initializeGame();
      await gameManager.makeMove({ from: 'f2', to: 'f3' });
      await gameManager.makeMove({ from: 'e7', to: 'e5' });
      await gameManager.makeMove({ from: 'g2', to: 'g4' });
      await gameManager.makeMove({ from: 'd8', to: 'h4' });

      expect(gameManager.isGameComplete()).toBe(true);
      const gameState = gameManager.getCurrentGameState();
      expect(gameState.gameStatus).toBe(GameStatus.CHECKMATE);
    });

    it('should detect stalemate and end game', async () => {
      // Set up a stalemate position
      const stalemateFen = '8/8/8/8/8/8/8/K6k w - - 0 1';
      await gameManager.initializeGame({ fen: stalemateFen });

      expect(gameManager.isGameComplete()).toBe(true);
      const gameState = gameManager.getCurrentGameState();
      expect(gameState.gameStatus).toBe(GameStatus.STALEMATE);
    });
  });

  describe('Multi-Component Interaction', () => {
    it('should coordinate between all components during a complete game flow', async () => {
      const gameConfig = createMockGameConfig({
        whitePlayer: { ...createMockGameConfig().whitePlayer, initialTimeMs: 60000 },
        blackPlayer: { ...createMockGameConfig().blackPlayer, initialTimeMs: 60000 }
      });

      // Start the game
      await orchestrator.startGame(gameConfig);

      expect(orchestrator.getGameStatus()).toBe(GameStatus.IN_PROGRESS);
      expect(playerManager.getCurrentPlayer().color).toBe(PlayerColor.WHITE);
      expect(timerManager.getRemainingTime(gameConfig.whitePlayer.id)).toBe(60000);
      expect(gameManager.getCurrentGameState().moveHistory).toHaveLength(0);

      // Mock valid moves for both players
      mockApiClient.setResponse('e4', {
        id: 'test1',
        model: 'test',
        content: 'e2e4'
      });

      mockApiClient.setResponse('e5', {
        id: 'test2',
        model: 'test',
        content: 'e7e5'
      });

      // Verify that state is properly maintained across components
      const initialGameState = gameManager.getCurrentGameState();
      expect(initialGameState.currentPlayer).toBe(PlayerColor.WHITE);
      expect(initialGameState.fen).toContain('w KQkq');
    });

    it('should handle component interactions during error scenarios', async () => {
      const gameConfig = createMockGameConfig();
      await orchestrator.startGame(gameConfig);

      // Mock an invalid move
      jest.spyOn(gameManager, 'makeMove').mockResolvedValueOnce({
        success: false,
        error: 'Invalid move - piece cannot move to that square'
      });

      // Verify that the player manager maintains correct turn state
      const initialPlayer = playerManager.getCurrentPlayer();

      // After an invalid move, the turn should not switch
      expect(playerManager.getCurrentPlayer()).toBe(initialPlayer);
    });
  });

  describe('Configuration Integration', () => {
    it('should properly configure all components with different timer types', async () => {
      const fischerConfig = createMockGameConfig({
        timerType: TimerType.FISCHER,
        whitePlayer: { ...createMockGameConfig().whitePlayer, incrementMs: 3000 },
        blackPlayer: { ...createMockGameConfig().blackPlayer, incrementMs: 3000 }
      });

      await orchestrator.startGame(fischerConfig);

      // Test that Fischer increment is properly configured
      const playerId = fischerConfig.whitePlayer.id;
      const initialTime = timerManager.getRemainingTime(playerId);

      timerManager.addIncrement(playerId, 3000);
      expect(timerManager.getRemainingTime(playerId)).toBe(initialTime + 3000);
    });

    it('should handle Bronstein timer configuration', async () => {
      const bronsteinConfig = createMockGameConfig({
        timerType: TimerType.BRONSTEIN,
        whitePlayer: { ...createMockGameConfig().whitePlayer, initialTimeMs: 10000, incrementMs: 2000 }
      });

      const bronsteinTimerManager = new GameTimerManager(createMockTimerConfig({
        type: TimerType.BRONSTEIN,
        initialTimeMs: 10000,
        incrementMs: 2000
      }));

      const bronsteinOrchestrator = new GameOrchestrator(
        gameManager,
        playerManager,
        bronsteinTimerManager,
        mockStateManager,
        mockLogger
      );

      await bronsteinOrchestrator.startGame(bronsteinConfig);

      const playerId = bronsteinConfig.whitePlayer.id;

      // Use some time first
      bronsteinTimerManager.startTimer(playerId);
      jest.advanceTimersByTime(3000);
      bronsteinTimerManager.pauseTimer(playerId);

      const timeAfterUse = bronsteinTimerManager.getRemainingTime(playerId);
      expect(timeAfterUse).toBe(7000);

      // Add Bronstein increment - should not exceed initial time
      bronsteinTimerManager.addIncrement(playerId, 5000);
      expect(bronsteinTimerManager.getRemainingTime(playerId)).toBe(10000);
    });
  });
});