export class ChessGameError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'ChessGameError';
  }
}

export class InvalidMoveError extends ChessGameError {
  constructor(message: string, public move?: { from: string; to: string; promotion?: string }) {
    super(message, 'INVALID_MOVE');
  }
}

export class TimeoutError extends ChessGameError {
  constructor(public playerId: string, public playerColor: string) {
    super(`Player ${playerId} (${playerColor}) exceeded time limit`, 'TIMEOUT');
  }
}

export class GameSetupError extends ChessGameError {
  constructor(message: string) {
    super(message, 'SETUP_ERROR');
  }
}

export enum ErrorResolution {
  RETRY = 'retry',
  FORFEIT = 'forfeit',
  PAUSE_GAME = 'pause',
  END_GAME = 'end'
}