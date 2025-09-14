import { GameTimerManager } from '../../../src/domain/timer/GameTimerManager';
import { TimerType } from '../../../src/shared/types/CommonTypes';
import { createMockTimerConfig, sleep } from '../../utils/test-helpers';

describe('GameTimerManager', () => {
  let timerManager: GameTimerManager;
  const playerId = 'test-player';

  beforeEach(() => {
    jest.useFakeTimers();
    const config = createMockTimerConfig({
      initialTimeMs: 10000, // 10 seconds for testing
      incrementMs: 1000,    // 1 second increment
    });
    timerManager = new GameTimerManager(config);
  });

  afterEach(() => {
    timerManager.cleanup();
    jest.useRealTimers();
  });

  describe('Timer Initialization', () => {
    it('should initialize timer with correct configuration', () => {
      const config = createMockTimerConfig({
        initialTimeMs: 5000,
        incrementMs: 500,
      });

      timerManager.initializeTimer(playerId, config);
      const remainingTime = timerManager.getRemainingTime(playerId);

      expect(remainingTime).toBe(5000);
      expect(timerManager.isTimeExpired(playerId)).toBe(false);
    });

    it('should initialize multiple players with different configs', () => {
      const player1Config = createMockTimerConfig({ initialTimeMs: 5000 });
      const player2Config = createMockTimerConfig({ initialTimeMs: 8000 });

      timerManager.initializeTimer('player1', player1Config);
      timerManager.initializeTimer('player2', player2Config);

      expect(timerManager.getRemainingTime('player1')).toBe(5000);
      expect(timerManager.getRemainingTime('player2')).toBe(8000);
    });
  });

  describe('Timer Start/Pause Operations', () => {
    beforeEach(() => {
      const config = createMockTimerConfig();
      timerManager.initializeTimer(playerId, config);
    });

    it('should start timer correctly', () => {
      expect(() => timerManager.startTimer(playerId)).not.toThrow();
    });

    it('should pause timer and return time used', () => {
      timerManager.startTimer(playerId);

      // Advance time by 500ms
      jest.advanceTimersByTime(500);

      const timeUsed = timerManager.pauseTimer(playerId);
      expect(timeUsed).toBeGreaterThan(0);
    });

    it('should handle starting already running timer', () => {
      timerManager.startTimer(playerId);
      const initialTime = timerManager.getRemainingTime(playerId);

      // Starting again should not change anything
      timerManager.startTimer(playerId);
      const timeAfterRestart = timerManager.getRemainingTime(playerId);

      expect(timeAfterRestart).toBe(initialTime);
    });

    it('should handle pausing non-running timer', () => {
      const timeUsed = timerManager.pauseTimer(playerId);
      expect(timeUsed).toBe(0);
    });
  });

  describe('Time Tracking', () => {
    beforeEach(() => {
      const config = createMockTimerConfig({ initialTimeMs: 10000 });
      timerManager.initializeTimer(playerId, config);
    });

    it('should decrease remaining time when running', () => {
      const initialTime = timerManager.getRemainingTime(playerId);
      timerManager.startTimer(playerId);

      // Advance time by 1 second
      jest.advanceTimersByTime(1000);

      const currentTime = timerManager.getRemainingTime(playerId);
      expect(currentTime).toBeLessThan(initialTime);
      // Timer may have decremented more due to interval timing
      expect(currentTime).toBeGreaterThanOrEqual(initialTime - 2000);
      expect(currentTime).toBeLessThanOrEqual(initialTime - 1000);
    });

    it('should not decrease time when paused', () => {
      timerManager.startTimer(playerId);
      jest.advanceTimersByTime(500);
      timerManager.pauseTimer(playerId);

      const timeAfterPause = timerManager.getRemainingTime(playerId);

      // Advance more time while paused
      jest.advanceTimersByTime(1000);

      const timeAfterAdvance = timerManager.getRemainingTime(playerId);
      expect(timeAfterAdvance).toBe(timeAfterPause);
    });

    it('should stop at zero and not go negative', () => {
      const config = createMockTimerConfig({ initialTimeMs: 500 });
      timerManager.initializeTimer(playerId, config);

      timerManager.startTimer(playerId);

      // Advance time beyond the initial time
      jest.advanceTimersByTime(1000);

      const remainingTime = timerManager.getRemainingTime(playerId);
      expect(remainingTime).toBe(0);
    });
  });

  describe('Time Expiration', () => {
    it('should detect time expiration', () => {
      const config = createMockTimerConfig({ initialTimeMs: 500 });
      timerManager.initializeTimer(playerId, config);

      expect(timerManager.isTimeExpired(playerId)).toBe(false);

      timerManager.startTimer(playerId);
      jest.advanceTimersByTime(600); // More than initial time

      expect(timerManager.isTimeExpired(playerId)).toBe(true);
    });

    it('should auto-pause when time expires', () => {
      const config = createMockTimerConfig({ initialTimeMs: 500 });
      timerManager.initializeTimer(playerId, config);

      timerManager.startTimer(playerId);
      jest.advanceTimersByTime(600);

      // Timer should auto-pause at zero
      expect(timerManager.getRemainingTime(playerId)).toBe(0);
      expect(timerManager.isTimeExpired(playerId)).toBe(true);
    });
  });

  describe('Increment Handling', () => {
    beforeEach(() => {
      const config = createMockTimerConfig({
        initialTimeMs: 10000,
        incrementMs: 1000,
        type: TimerType.FISCHER
      });
      timerManager.initializeTimer(playerId, config);
    });

    it('should add Fischer increment correctly', () => {
      const initialTime = timerManager.getRemainingTime(playerId);
      timerManager.addIncrement(playerId, 2000);

      const newTime = timerManager.getRemainingTime(playerId);
      expect(newTime).toBe(initialTime + 2000);
    });

    it('should handle Bronstein increment (not exceed initial time)', () => {
      const config = createMockTimerConfig({
        initialTimeMs: 10000,
        incrementMs: 5000,
        type: TimerType.BRONSTEIN
      });
      timerManager = new GameTimerManager(config);
      timerManager.initializeTimer(playerId, config);

      // Use some time first
      timerManager.startTimer(playerId);
      jest.advanceTimersByTime(2000);
      timerManager.pauseTimer(playerId);

      const timeAfterUse = timerManager.getRemainingTime(playerId);
      expect(timeAfterUse).toBe(8000);

      // Add increment - should not exceed initial time
      timerManager.addIncrement(playerId, 5000);
      const timeAfterIncrement = timerManager.getRemainingTime(playerId);
      expect(timeAfterIncrement).toBe(10000); // Capped at initial time
    });
  });

  describe('Timer Reset', () => {
    beforeEach(() => {
      const config = createMockTimerConfig();
      timerManager.initializeTimer(playerId, config);
    });

    it('should reset timer to new time value', () => {
      // Use some time first
      timerManager.startTimer(playerId);
      jest.advanceTimersByTime(2000);
      timerManager.pauseTimer(playerId);

      // Reset to new time
      timerManager.resetTimer(playerId, 15000);

      expect(timerManager.getRemainingTime(playerId)).toBe(15000);
      expect(timerManager.isTimeExpired(playerId)).toBe(false);
    });

    it('should reset non-existent timer by creating new one', () => {
      timerManager.resetTimer('new-player', 5000);

      expect(timerManager.getRemainingTime('new-player')).toBe(5000);
    });

    it('should pause running timer before reset', () => {
      timerManager.startTimer(playerId);
      timerManager.resetTimer(playerId, 8000);

      // Should not be running after reset
      const timeBefore = timerManager.getRemainingTime(playerId);
      jest.advanceTimersByTime(1000);
      const timeAfter = timerManager.getRemainingTime(playerId);

      expect(timeBefore).toBe(timeAfter);
      expect(timeAfter).toBe(8000);
    });
  });

  describe('Error Handling', () => {
    it('should throw error when starting non-existent timer', () => {
      expect(() => {
        timerManager.startTimer('non-existent-player');
      }).toThrow('Timer not found for player: non-existent-player');
    });

    it('should throw error when pausing non-existent timer', () => {
      expect(() => {
        timerManager.pauseTimer('non-existent-player');
      }).toThrow('Timer not found for player: non-existent-player');
    });

    it('should throw error when getting remaining time for non-existent timer', () => {
      expect(() => {
        timerManager.getRemainingTime('non-existent-player');
      }).toThrow('Timer not found for player: non-existent-player');
    });

    it('should throw error when adding increment to non-existent timer', () => {
      expect(() => {
        timerManager.addIncrement('non-existent-player', 1000);
      }).toThrow('Timer not found for player: non-existent-player');
    });
  });

  describe('Cleanup', () => {
    it('should cleanup all intervals when called', () => {
      const config = createMockTimerConfig();
      timerManager.initializeTimer('player1', config);
      timerManager.initializeTimer('player2', config);

      timerManager.startTimer('player1');
      timerManager.startTimer('player2');

      // Cleanup should not throw
      expect(() => timerManager.cleanup()).not.toThrow();
    });

    it('should be safe to call cleanup multiple times', () => {
      const config = createMockTimerConfig();
      timerManager.initializeTimer(playerId, config);
      timerManager.startTimer(playerId);

      timerManager.cleanup();
      expect(() => timerManager.cleanup()).not.toThrow();
    });
  });

  describe('Concurrent Timer Operations', () => {
    it('should handle multiple players with independent timers', () => {
      const config = createMockTimerConfig({ initialTimeMs: 10000 });

      timerManager.initializeTimer('player1', config);
      timerManager.initializeTimer('player2', config);

      timerManager.startTimer('player1');
      jest.advanceTimersByTime(1000);
      timerManager.pauseTimer('player1');

      timerManager.startTimer('player2');
      jest.advanceTimersByTime(500);
      timerManager.pauseTimer('player2');

      expect(timerManager.getRemainingTime('player1')).toBe(9000);
      expect(timerManager.getRemainingTime('player2')).toBe(9500);
    });
  });
});