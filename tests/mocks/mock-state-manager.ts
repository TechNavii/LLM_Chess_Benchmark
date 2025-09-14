import { IStateManager } from '../../src/infrastructure/storage/StateManager';
import { GameState } from '../../src/domain/chess/ChessTypes';
import { GameConfiguration } from '../../src/infrastructure/config/ConfigTypes';

/**
 * Mock State Manager for testing
 */
export class MockStateManager implements IStateManager {
  private savedStates: Map<string, GameState> = new Map();
  private savedConfig: GameConfiguration | null = null;

  async saveGameState(gameState: GameState, gameId: string): Promise<void> {
    this.savedStates.set(gameId, gameState);
  }

  async loadGameState(gameId: string): Promise<GameState> {
    const state = this.savedStates.get(gameId);
    if (!state) {
      throw new Error(`No saved game found with ID: ${gameId}`);
    }
    return state;
  }

  async saveConfiguration(config: GameConfiguration): Promise<void> {
    this.savedConfig = config;
  }

  async loadConfiguration(): Promise<GameConfiguration | null> {
    return this.savedConfig;
  }

  async exportGame(gameState: GameState, format: 'pgn' | 'json'): Promise<string> {
    if (format === 'pgn') {
      return gameState.pgn || '1. e4 e5 *';
    } else {
      return JSON.stringify({
        fen: gameState.fen,
        pgn: gameState.pgn,
        moves: gameState.moveHistory,
        status: gameState.gameStatus
      }, null, 2);
    }
  }

  async listSavedGames(): Promise<string[]> {
    return Array.from(this.savedStates.keys());
  }

  // Testing helper methods
  clear(): void {
    this.savedStates.clear();
    this.savedConfig = null;
  }

  getSavedState(gameId: string): GameState | undefined {
    return this.savedStates.get(gameId);
  }

  getSavedConfig(): GameConfiguration | null {
    return this.savedConfig;
  }
}

// Export a factory function for Jest mocks
export function createMockStateManager(): jest.Mocked<IStateManager> {
  const mockManager = new MockStateManager();
  return {
    saveGameState: jest.fn().mockImplementation(mockManager.saveGameState.bind(mockManager)),
    loadGameState: jest.fn().mockImplementation(mockManager.loadGameState.bind(mockManager)),
    saveConfiguration: jest.fn().mockImplementation(mockManager.saveConfiguration.bind(mockManager)),
    loadConfiguration: jest.fn().mockImplementation(mockManager.loadConfiguration.bind(mockManager)),
    exportGame: jest.fn().mockImplementation(mockManager.exportGame.bind(mockManager)),
    listSavedGames: jest.fn().mockImplementation(mockManager.listSavedGames.bind(mockManager))
  };
}