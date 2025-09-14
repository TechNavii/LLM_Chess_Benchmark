import { TimerType } from '../../shared/types/CommonTypes';

export interface TimerConfiguration {
  initialTimeMs: number;
  incrementMs: number;
  type: TimerType;
}

export interface PlayerTimer {
  playerId: string;
  remainingTimeMs: number;
  isRunning: boolean;
  lastStartTime?: Date;
}