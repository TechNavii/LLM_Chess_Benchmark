import { TimerConfiguration, PlayerTimer } from './TimerTypes';
import { TimerType } from '../../shared/types/CommonTypes';

export interface IGameTimerManager {
  startTimer(playerId: string): void;
  pauseTimer(playerId: string): number;
  getRemainingTime(playerId: string): number;
  addIncrement(playerId: string, incrementMs: number): void;
  isTimeExpired(playerId: string): boolean;
  resetTimer(playerId: string, timeMs: number): void;
  initializeTimer(playerId: string, config: TimerConfiguration): void;
}

export class GameTimerManager implements IGameTimerManager {
  private timers: Map<string, PlayerTimer> = new Map();
  private timerConfig: TimerConfiguration;
  private intervals: Map<string, NodeJS.Timeout> = new Map();

  constructor(config: TimerConfiguration) {
    this.timerConfig = config;
  }

  initializeTimer(playerId: string, config: TimerConfiguration): void {
    this.timers.set(playerId, {
      playerId,
      remainingTimeMs: config.initialTimeMs,
      isRunning: false
    });
  }

  startTimer(playerId: string): void {
    const timer = this.timers.get(playerId);
    if (!timer) {
      throw new Error(`Timer not found for player: ${playerId}`);
    }

    if (timer.isRunning) {
      return;
    }

    timer.isRunning = true;
    timer.lastStartTime = new Date();

    const interval = setInterval(() => {
      const currentTimer = this.timers.get(playerId);
      if (currentTimer && currentTimer.isRunning) {
        currentTimer.remainingTimeMs -= 100;
        if (currentTimer.remainingTimeMs <= 0) {
          currentTimer.remainingTimeMs = 0;
          this.pauseTimer(playerId);
        }
      }
    }, 100);

    this.intervals.set(playerId, interval);
  }

  pauseTimer(playerId: string): number {
    const timer = this.timers.get(playerId);
    if (!timer) {
      throw new Error(`Timer not found for player: ${playerId}`);
    }

    if (!timer.isRunning || !timer.lastStartTime) {
      return 0;
    }

    const now = new Date();
    const timeUsed = now.getTime() - timer.lastStartTime.getTime();

    timer.isRunning = false;
    timer.remainingTimeMs = Math.max(0, timer.remainingTimeMs);

    const interval = this.intervals.get(playerId);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(playerId);
    }

    return timeUsed;
  }

  getRemainingTime(playerId: string): number {
    const timer = this.timers.get(playerId);
    if (!timer) {
      throw new Error(`Timer not found for player: ${playerId}`);
    }

    if (timer.isRunning && timer.lastStartTime) {
      const now = new Date();
      const elapsed = now.getTime() - timer.lastStartTime.getTime();
      return Math.max(0, timer.remainingTimeMs - elapsed);
    }

    return timer.remainingTimeMs;
  }

  addIncrement(playerId: string, incrementMs: number): void {
    const timer = this.timers.get(playerId);
    if (!timer) {
      throw new Error(`Timer not found for player: ${playerId}`);
    }

    if (this.timerConfig.type === TimerType.FISCHER) {
      timer.remainingTimeMs += incrementMs;
    } else if (this.timerConfig.type === TimerType.BRONSTEIN) {
      timer.remainingTimeMs = Math.min(
        timer.remainingTimeMs + incrementMs,
        this.timerConfig.initialTimeMs
      );
    }
  }

  isTimeExpired(playerId: string): boolean {
    return this.getRemainingTime(playerId) <= 0;
  }

  resetTimer(playerId: string, timeMs: number): void {
    const timer = this.timers.get(playerId);
    if (!timer) {
      this.timers.set(playerId, {
        playerId,
        remainingTimeMs: timeMs,
        isRunning: false
      });
    } else {
      this.pauseTimer(playerId);
      timer.remainingTimeMs = timeMs;
      timer.isRunning = false;
    }
  }

  cleanup(): void {
    for (const interval of this.intervals.values()) {
      clearInterval(interval);
    }
    this.intervals.clear();
  }
}