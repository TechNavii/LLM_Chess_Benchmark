import { GameOrchestrator } from '../../src/application/GameOrchestrator';
import { ChessGameManager } from '../../src/domain/chess/ChessGameManager';
import { PlayerManager } from '../../src/domain/player/PlayerManager';
import { GameTimerManager } from '../../src/domain/timer/GameTimerManager';
import { GameStatus, PlayerColor, TimerType } from '../../src/shared/types/CommonTypes';
import { MockLLMApiClient } from '../mocks/mock-llm-client';
import { MockWebSocketServer } from '../mocks/mock-websocket-server';
import { createMockGameConfig, createMockTimerConfig, TestMoves, createMockPlayerConfig } from '../utils/test-helpers';
import { createMockStateManager } from '../mocks/mock-state-manager';

describe('End-to-End Game Simulation', () => {
  let orchestrator: GameOrchestrator;
  let gameManager: ChessGameManager;
  let playerManager: PlayerManager;
  let timerManager: GameTimerManager;
  let mockStateManager: jest.Mocked<any>;
  let mockApiClient: MockLLMApiClient;
  let mockWebSocketServer: MockWebSocketServer;
  let gameEvents: Array<{ event: string; data: any; timestamp: Date }> = [];

  const logGameEvent = (event: string, data: any) => {
    gameEvents.push({ event, data, timestamp: new Date() });
  };

  beforeEach(() => {
    jest.useFakeTimers();

    // Reset game events
    gameEvents = [];

    // Create components
    gameManager = new ChessGameManager();
    playerManager = new PlayerManager();
    timerManager = new GameTimerManager(createMockTimerConfig({
      initialTimeMs: 300000, // 5 minutes
      incrementMs: 5000,     // 5 seconds
      type: TimerType.FISCHER
    }));

    mockStateManager = createMockStateManager();
    mockApiClient = new MockLLMApiClient();
    mockWebSocketServer = new MockWebSocketServer(3001);

    orchestrator = new GameOrchestrator(
      gameManager,
      playerManager,
      timerManager,
      mockStateManager,
      (message: string) => logGameEvent('log', { message })
    );
  });

  afterEach(() => {
    timerManager.cleanup();
    mockWebSocketServer.stop();
    jest.useRealTimers();
  });

  describe('Complete Game Scenarios', () => {
    it('should simulate a complete game from start to finish', async () => {
      // Setup: Create a realistic game configuration
      const gameConfig = createMockGameConfig({
        whitePlayer: {
          id: 'gpt-4-white',
          color: PlayerColor.WHITE,
          modelName: 'GPT-4',
          modelId: 'openai/gpt-4',
          initialTimeMs: 600000, // 10 minutes
          incrementMs: 5000
        },
        blackPlayer: {
          id: 'claude-3-black',
          color: PlayerColor.BLACK,
          modelName: 'Claude-3',
          modelId: 'anthropic/claude-3-opus',
          initialTimeMs: 600000,
          incrementMs: 5000
        },
        timerType: TimerType.FISCHER,
        saveGame: true
      });

      // Setup WebSocket server
      await mockWebSocketServer.start();
      const client = mockWebSocketServer.addClient();

      // Setup realistic move sequence for a short game
      const moveSequence = [
        'e2e4', 'e7e5',     // 1. e4 e5
        'g1f3', 'b8c6',     // 2. Nf3 Nc6
        'f1c4', 'f8c5',     // 3. Bc4 Bc5
        'd2d3', 'd7d6',     // 4. d3 d6
        'e1g1', 'g8f6',     // 5. O-O Nf6
        'f1e1', 'e8g8',     // 6. Re1 O-O
      ];

      let moveIndex = 0;
      mockApiClient.setResponse = jest.fn((key: string, response: any) => {
        // Override to provide sequential moves
      });

      // Mock API client to return moves in sequence
      jest.spyOn(mockApiClient, 'sendRequest').mockImplementation(async () => {
        const move = moveSequence[moveIndex % moveSequence.length];
        moveIndex++;
        return {
          id: `move-${moveIndex}`,
          model: 'test-model',
          content: move,
          usage: { promptTokens: 150, completionTokens: 10, totalTokens: 160 }
        };
      });

      // Create players
      const whitePlayerConfig = createMockPlayerConfig(PlayerColor.WHITE, {
        id: gameConfig.whitePlayer.id,
        initialTimeMs: gameConfig.whitePlayer.initialTimeMs,
        incrementMs: gameConfig.whitePlayer.incrementMs
      });
      const blackPlayerConfig = createMockPlayerConfig(PlayerColor.BLACK, {
        id: gameConfig.blackPlayer.id,
        initialTimeMs: gameConfig.blackPlayer.initialTimeMs,
        incrementMs: gameConfig.blackPlayer.incrementMs
      });
      await playerManager.createPlayer(whitePlayerConfig, mockApiClient);
      await playerManager.createPlayer(blackPlayerConfig, mockApiClient);

      logGameEvent('game_setup', { config: gameConfig });

      // Start the game
      await orchestrator.startGame(gameConfig);
      logGameEvent('game_started', { status: orchestrator.getGameStatus() });

      // Simulate WebSocket notifications
      mockWebSocketServer.broadcast('gameStarted', {
        gameId: Date.now().toString(),
        players: {
          white: gameConfig.whitePlayer.modelName,
          black: gameConfig.blackPlayer.modelName
        },
        timeControl: {
          initial: gameConfig.whitePlayer.initialTimeMs,
          increment: gameConfig.whitePlayer.incrementMs
        }
      });

      // Play a limited number of moves for the test
      const maxMoves = 12; // 6 moves per side
      let movesPlayed = 0;

      while (movesPlayed < maxMoves && !gameManager.isGameComplete()) {
        const currentPlayer = playerManager.getCurrentPlayer();
        const gameState = gameManager.getCurrentGameState();

        logGameEvent('turn_start', {
          player: currentPlayer.color,
          moveNumber: Math.floor(movesPlayed / 2) + 1,
          fen: gameState.fen
        });

        // Simulate move thinking time
        jest.advanceTimersByTime(2000); // 2 seconds thinking time

        try {
          // Make the move
          const move = { from: moveSequence[movesPlayed].substring(0, 2), to: moveSequence[movesPlayed].substring(2, 4) };
          const moveResult = await gameManager.makeMove(move);

          if (moveResult.success) {
            logGameEvent('move_made', {
              player: currentPlayer.color,
              move: moveResult.move,
              isCheck: moveResult.isCheck,
              timeRemaining: timerManager.getRemainingTime(currentPlayer.id)
            });

            // Broadcast move to WebSocket clients
            mockWebSocketServer.broadcast('moveUpdate', {
              move: moveResult.move,
              gameState: moveResult.newGameState,
              currentPlayer: playerManager.switchTurn()
            });

            movesPlayed++;
          } else {
            logGameEvent('invalid_move', {
              player: currentPlayer.color,
              error: moveResult.error
            });
            break;
          }
        } catch (error) {
          logGameEvent('move_error', {
            player: currentPlayer.color,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
          break;
        }
      }

      // Verify game state
      const finalGameState = gameManager.getCurrentGameState();
      const gameHistory = gameManager.getGameHistory();

      expect(gameHistory.length).toBeGreaterThan(0);
      expect(gameHistory.length).toBeLessThanOrEqual(maxMoves);

      // Verify WebSocket received updates
      const client1Messages = client.getReceivedMessages();
      expect(client1Messages.length).toBeGreaterThan(0);

      // Verify state manager was called
      expect(mockStateManager.saveConfiguration).toHaveBeenCalledWith(gameConfig);

      logGameEvent('game_complete', {
        totalMoves: gameHistory.length,
        finalFen: finalGameState.fen,
        gameStatus: finalGameState.gameStatus
      });

      // Log final game summary
      console.log(`\n=== Game Summary ===`);
      console.log(`Total moves played: ${gameHistory.length}`);
      console.log(`Game status: ${finalGameState.gameStatus}`);
      console.log(`Final position: ${finalGameState.fen}`);
      console.log(`Events logged: ${gameEvents.length}`);
    });

    it('should handle a complete game ending in checkmate (Fool\'s mate)', async () => {
      const gameConfig = createMockGameConfig();

      // Setup the infamous Fool's mate sequence
      const foolsMateSequence = [
        'f2f3', 'e7e5',  // 1. f3 e5
        'g2g4', 'd8h4'   // 2. g4 Qh4# (checkmate)
      ];

      let moveIndex = 0;
      jest.spyOn(mockApiClient, 'sendRequest').mockImplementation(async () => {
        const move = foolsMateSequence[moveIndex];
        moveIndex++;
        return {
          id: `fool-${moveIndex}`,
          model: 'test-model',
          content: move,
          usage: { promptTokens: 50, completionTokens: 5, totalTokens: 55 }
        };
      });

      await playerManager.createPlayer(createMockPlayerConfig(PlayerColor.WHITE, {
        id: gameConfig.whitePlayer.id,
        initialTimeMs: gameConfig.whitePlayer.initialTimeMs
      }), mockApiClient);
      await playerManager.createPlayer(createMockPlayerConfig(PlayerColor.BLACK, {
        id: gameConfig.blackPlayer.id,
        initialTimeMs: gameConfig.blackPlayer.initialTimeMs
      }), mockApiClient);

      await orchestrator.startGame(gameConfig);

      // Play out Fool's mate
      for (const moveStr of foolsMateSequence) {
        const move = { from: moveStr.substring(0, 2), to: moveStr.substring(2, 4) };
        const moveResult = await gameManager.makeMove(move);

        expect(moveResult.success).toBe(true);
        playerManager.switchTurn();

        logGameEvent('fool_mate_move', {
          move: moveStr,
          check: moveResult.isCheck,
          checkmate: moveResult.isCheckmate
        });
      }

      const finalState = gameManager.getCurrentGameState();
      expect(finalState.gameStatus).toBe(GameStatus.CHECKMATE);
      expect(gameManager.isGameComplete()).toBe(true);

      logGameEvent('fool_mate_complete', {
        winner: PlayerColor.BLACK,
        moves: gameManager.getGameHistory().length
      });
    });

    it('should handle timeout scenarios', async () => {
      const shortTimeConfig = createMockGameConfig({
        whitePlayer: { ...createMockGameConfig().whitePlayer, initialTimeMs: 1000 }, // 1 second
        blackPlayer: { ...createMockGameConfig().blackPlayer, initialTimeMs: 60000 }  // 1 minute
      });

      const shortTimerManager = new GameTimerManager(createMockTimerConfig({ initialTimeMs: 1000 }));
      const timeoutOrchestrator = new GameOrchestrator(
        gameManager,
        playerManager,
        shortTimerManager,
        mockStateManager,
        (message: string) => logGameEvent('timeout_log', { message })
      );

      // Mock slow API response
      jest.spyOn(mockApiClient, 'sendRequest').mockImplementation(async () => {
        // Simulate slow response
        jest.advanceTimersByTime(2000); // 2 seconds - longer than time limit
        return {
          id: 'slow-response',
          model: 'test-model',
          content: 'e2e4',
          usage: { promptTokens: 100, completionTokens: 10, totalTokens: 110 }
        };
      });

      await playerManager.createPlayer(shortTimeConfig.whitePlayer, mockApiClient);
      await playerManager.createPlayer(shortTimeConfig.blackPlayer, mockApiClient);

      await timeoutOrchestrator.startGame(shortTimeConfig);

      // Start white player's timer
      shortTimerManager.startTimer(shortTimeConfig.whitePlayer.id);

      // Advance time beyond the limit
      jest.advanceTimersByTime(1500);

      expect(shortTimerManager.isTimeExpired(shortTimeConfig.whitePlayer.id)).toBe(true);

      logGameEvent('timeout_occurred', {
        player: PlayerColor.WHITE,
        remainingTime: shortTimerManager.getRemainingTime(shortTimeConfig.whitePlayer.id)
      });
    });
  });

  describe('Error Recovery Scenarios', () => {
    it('should handle multiple invalid moves and recover', async () => {
      const gameConfig = createMockGameConfig();

      // Setup sequence with invalid moves followed by valid ones
      const moveSequence = [
        'e2e5', // Invalid - can't move pawn two squares when blocked
        'a1a3', // Invalid - can't move rook through pieces
        'e2e4', // Valid
        'e7e5'  // Valid
      ];

      let moveIndex = 0;
      jest.spyOn(mockApiClient, 'sendRequest').mockImplementation(async () => {
        const move = moveSequence[moveIndex % moveSequence.length];
        moveIndex++;
        return {
          id: `recovery-${moveIndex}`,
          model: 'test-model',
          content: move,
          usage: { promptTokens: 75, completionTokens: 8, totalTokens: 83 }
        };
      });

      await playerManager.createPlayer(createMockPlayerConfig(PlayerColor.WHITE, {
        id: gameConfig.whitePlayer.id,
        initialTimeMs: gameConfig.whitePlayer.initialTimeMs
      }), mockApiClient);
      await playerManager.createPlayer(createMockPlayerConfig(PlayerColor.BLACK, {
        id: gameConfig.blackPlayer.id,
        initialTimeMs: gameConfig.blackPlayer.initialTimeMs
      }), mockApiClient);

      await orchestrator.startGame(gameConfig);

      let invalidMoveCount = 0;
      let validMoveCount = 0;

      // Try the first few moves
      for (let i = 0; i < 4; i++) {
        const moveStr = moveSequence[i];
        const move = { from: moveStr.substring(0, 2), to: moveStr.substring(2, 4) };
        const moveResult = await gameManager.makeMove(move);

        if (moveResult.success) {
          validMoveCount++;
          playerManager.switchTurn();
          logGameEvent('valid_move_after_error', { move: moveStr, attempt: i + 1 });
        } else {
          invalidMoveCount++;
          logGameEvent('invalid_move_attempt', { move: moveStr, error: moveResult.error });
        }
      }

      expect(invalidMoveCount).toBe(2);
      expect(validMoveCount).toBe(2);
      expect(gameManager.getGameHistory().length).toBe(2);
    });

    it('should handle API rate limiting and retry logic', async () => {
      const gameConfig = createMockGameConfig();

      let apiCallCount = 0;
      jest.spyOn(mockApiClient, 'sendRequest').mockImplementation(async () => {
        apiCallCount++;

        // Simulate rate limiting on first few calls
        if (apiCallCount <= 2) {
          throw {
            statusCode: 429,
            code: 'RATE_LIMIT',
            message: 'Rate limit exceeded'
          };
        }

        return {
          id: `rate-limit-recovery-${apiCallCount}`,
          model: 'test-model',
          content: 'e2e4',
          usage: { promptTokens: 90, completionTokens: 12, totalTokens: 102 }
        };
      });

      await playerManager.createPlayer(createMockPlayerConfig(PlayerColor.WHITE, {
        id: gameConfig.whitePlayer.id,
        initialTimeMs: gameConfig.whitePlayer.initialTimeMs
      }), mockApiClient);
      await playerManager.createPlayer(createMockPlayerConfig(PlayerColor.BLACK, {
        id: gameConfig.blackPlayer.id,
        initialTimeMs: gameConfig.blackPlayer.initialTimeMs
      }), mockApiClient);

      await orchestrator.startGame(gameConfig);

      logGameEvent('api_rate_limit_test', { expectedFailures: 2 });

      // The orchestrator should eventually succeed after retries
      expect(apiCallCount).toBeGreaterThan(2);
    });
  });

  describe('Performance and Stress Tests', () => {
    it('should handle rapid move sequences without issues', async () => {
      const gameConfig = createMockGameConfig();

      // Setup a longer game sequence
      const rapidMoveSequence = [
        'e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'f8c5',
        'd2d3', 'd7d6', 'e1g1', 'g8f6', 'f1e1', 'e8g8',
        'c2c3', 'a7a6', 'b2b4', 'c5a7', 'a2a4', 'b7b5'
      ];

      let moveIndex = 0;
      jest.spyOn(mockApiClient, 'sendRequest').mockImplementation(async () => {
        const move = rapidMoveSequence[moveIndex % rapidMoveSequence.length];
        moveIndex++;

        // Simulate very fast responses
        return {
          id: `rapid-${moveIndex}`,
          model: 'test-model',
          content: move,
          usage: { promptTokens: 50, completionTokens: 5, totalTokens: 55 }
        };
      });

      await playerManager.createPlayer(createMockPlayerConfig(PlayerColor.WHITE, {
        id: gameConfig.whitePlayer.id,
        initialTimeMs: gameConfig.whitePlayer.initialTimeMs
      }), mockApiClient);
      await playerManager.createPlayer(createMockPlayerConfig(PlayerColor.BLACK, {
        id: gameConfig.blackPlayer.id,
        initialTimeMs: gameConfig.blackPlayer.initialTimeMs
      }), mockApiClient);

      const startTime = Date.now();
      await orchestrator.startGame(gameConfig);

      // Play through the sequence rapidly
      for (let i = 0; i < rapidMoveSequence.length; i++) {
        const moveStr = rapidMoveSequence[i];
        const move = { from: moveStr.substring(0, 2), to: moveStr.substring(2, 4) };
        await gameManager.makeMove(move);
        playerManager.switchTurn();

        // Advance minimal time
        jest.advanceTimersByTime(100);
      }

      const endTime = Date.now();
      const gameHistory = gameManager.getGameHistory();

      expect(gameHistory.length).toBe(rapidMoveSequence.length);

      logGameEvent('performance_test_complete', {
        movesPlayed: gameHistory.length,
        testDuration: endTime - startTime,
        averageTimePerMove: (endTime - startTime) / gameHistory.length
      });
    });
  });

  describe('WebSocket Integration', () => {
    it('should broadcast all game events to connected clients', async () => {
      await mockWebSocketServer.start();
      const spectator1 = mockWebSocketServer.addClient();
      const spectator2 = mockWebSocketServer.addClient();

      const gameConfig = createMockGameConfig();
      const moveSequence = ['e2e4', 'e7e5', 'g1f3', 'b8c6'];

      let moveIndex = 0;
      jest.spyOn(mockApiClient, 'sendRequest').mockImplementation(async () => {
        const move = moveSequence[moveIndex];
        moveIndex++;
        return {
          id: `websocket-${moveIndex}`,
          model: 'test-model',
          content: move
        };
      });

      await playerManager.createPlayer(createMockPlayerConfig(PlayerColor.WHITE, {
        id: gameConfig.whitePlayer.id,
        initialTimeMs: gameConfig.whitePlayer.initialTimeMs
      }), mockApiClient);
      await playerManager.createPlayer(createMockPlayerConfig(PlayerColor.BLACK, {
        id: gameConfig.blackPlayer.id,
        initialTimeMs: gameConfig.blackPlayer.initialTimeMs
      }), mockApiClient);
      await orchestrator.startGame(gameConfig);

      // Broadcast game start
      mockWebSocketServer.broadcast('gameStarted', { gameId: 'test-game' });

      // Play moves and broadcast each one
      for (let i = 0; i < 4; i++) {
        const moveStr = moveSequence[i];
        const move = { from: moveStr.substring(0, 2), to: moveStr.substring(2, 4) };
        const moveResult = await gameManager.makeMove(move);

        if (moveResult.success) {
          mockWebSocketServer.broadcast('moveUpdate', {
            move: moveResult.move,
            gameState: moveResult.newGameState
          });
          playerManager.switchTurn();
        }
      }

      // Broadcast game end
      mockWebSocketServer.broadcast('gameEnded', {
        reason: 'test-complete',
        totalMoves: gameManager.getGameHistory().length
      });

      // Verify both spectators received all messages
      const spectator1Messages = spectator1.getReceivedMessages();
      const spectator2Messages = spectator2.getReceivedMessages();

      expect(spectator1Messages.length).toBeGreaterThan(4); // Start + moves + end
      expect(spectator2Messages.length).toBe(spectator1Messages.length);

      expect(spectator1Messages.some(m => m.event === 'gameStarted')).toBe(true);
      expect(spectator1Messages.some(m => m.event === 'gameEnded')).toBe(true);

      logGameEvent('websocket_test_complete', {
        spectators: mockWebSocketServer.getClientCount(),
        messagesPerSpectator: spectator1Messages.length
      });
    });
  });

  afterEach(() => {
    // Log test summary
    if (gameEvents.length > 0) {
      console.log(`\n=== Test Event Summary ===`);
      gameEvents.forEach((event, index) => {
        console.log(`${index + 1}. ${event.event}: ${JSON.stringify(event.data).substring(0, 100)}`);
      });
    }
  });
});