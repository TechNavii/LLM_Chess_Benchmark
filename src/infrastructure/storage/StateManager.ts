import * as fs from 'fs/promises';
import * as path from 'path';
import { GameState } from '../../domain/chess/ChessTypes';
import { GameConfiguration } from '../config/ConfigTypes';

export interface IStateManager {
  saveGameState(gameState: GameState, gameId: string): Promise<void>;
  loadGameState(gameId: string): Promise<GameState>;
  saveConfiguration(config: GameConfiguration): Promise<void>;
  loadConfiguration(): Promise<GameConfiguration | null>;
  exportGame(gameState: GameState, format: 'pgn' | 'json'): Promise<string>;
  listSavedGames(): Promise<string[]>;
}

export class StateManager implements IStateManager {
  private savePath: string;

  constructor(savePath: string = './game-saves') {
    this.savePath = savePath;
  }

  async saveGameState(gameState: GameState, gameId: string): Promise<void> {
    await fs.mkdir(this.savePath, { recursive: true });

    const fileName = `game-${gameId}-${Date.now()}.json`;
    const filePath = path.join(this.savePath, fileName);

    const saveData = {
      gameId,
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      gameState: {
        fen: gameState.fen,
        pgn: gameState.pgn,
        moveHistory: gameState.moveHistory,
        gameStatus: gameState.gameStatus,
        capturedPieces: gameState.capturedPieces,
        currentPlayer: gameState.currentPlayer,
        halfmoveClock: gameState.halfmoveClock,
        fullmoveNumber: gameState.fullmoveNumber
      }
    };

    await fs.writeFile(filePath, JSON.stringify(saveData, null, 2), 'utf-8');
  }

  async loadGameState(gameId: string): Promise<GameState> {
    const files = await fs.readdir(this.savePath);
    const gameFiles = files.filter(f => f.startsWith(`game-${gameId}`));

    if (gameFiles.length === 0) {
      throw new Error(`No saved game found with ID: ${gameId}`);
    }

    gameFiles.sort((a, b) => b.localeCompare(a));
    const latestFile = gameFiles[0];
    const filePath = path.join(this.savePath, latestFile);

    const data = await fs.readFile(filePath, 'utf-8');
    const saveData = JSON.parse(data);

    return saveData.gameState;
  }

  async saveConfiguration(config: GameConfiguration): Promise<void> {
    await fs.mkdir(this.savePath, { recursive: true });
    const filePath = path.join(this.savePath, 'last-game-config.json');
    await fs.writeFile(filePath, JSON.stringify(config, null, 2), 'utf-8');
  }

  async loadConfiguration(): Promise<GameConfiguration | null> {
    try {
      const filePath = path.join(this.savePath, 'last-game-config.json');
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  async exportGame(gameState: GameState, format: 'pgn' | 'json'): Promise<string> {
    if (format === 'pgn') {
      return this.exportAsPGN(gameState);
    } else {
      return this.exportAsJSON(gameState);
    }
  }

  async listSavedGames(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.savePath);
      return files
        .filter(f => f.startsWith('game-') && f.endsWith('.json'))
        .map(f => {
          const match = f.match(/game-(.+?)-\d+\.json/);
          return match ? match[1] : '';
        })
        .filter(id => id !== '');
    } catch {
      return [];
    }
  }

  private exportAsPGN(gameState: GameState): string {
    const headers = [
      '[Event "LLM Chess Game"]',
      `[Date "${new Date().toISOString().split('T')[0]}"]`,
      '[White "LLM Player 1"]',
      '[Black "LLM Player 2"]',
      `[Result "${this.getResultString(gameState)}"]`,
      ''
    ].join('\n');

    return headers + gameState.pgn;
  }

  private exportAsJSON(gameState: GameState): string {
    return JSON.stringify({
      fen: gameState.fen,
      pgn: gameState.pgn,
      moves: gameState.moveHistory,
      status: gameState.gameStatus,
      capturedPieces: gameState.capturedPieces,
      timestamp: new Date().toISOString()
    }, null, 2);
  }

  private getResultString(gameState: GameState): string {
    switch (gameState.gameStatus) {
      case 'checkmate':
        return gameState.currentPlayer === 'white' ? '0-1' : '1-0';
      case 'draw':
      case 'stalemate':
        return '1/2-1/2';
      default:
        return '*';
    }
  }
}