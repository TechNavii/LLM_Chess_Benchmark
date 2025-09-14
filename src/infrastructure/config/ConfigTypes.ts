import { TimerType, OutputFormat } from '../../shared/types/CommonTypes';

export interface AppConfiguration {
  openRouterApiKey: string;
  defaultModels: {
    white: string;
    black: string;
  };
  timerSettings: {
    initialTimeMs: number;
    incrementMs: number;
    type: TimerType;
  };
  gameSettings: {
    outputFormat: OutputFormat;
    saveGames: boolean;
    logLevel: 'debug' | 'info' | 'warn' | 'error';
    showThinking: boolean;
    displayBoard: boolean;
  };
}

export interface GameConfiguration {
  whitePlayer: {
    id: string;
    modelName: string;
    initialTimeMs: number;
    incrementMs: number;
  };
  blackPlayer: {
    id: string;
    modelName: string;
    initialTimeMs: number;
    incrementMs: number;
  };
  timerType: TimerType;
  outputFormat: OutputFormat;
  saveGame: boolean;
}