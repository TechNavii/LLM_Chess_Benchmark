import { LLMPlayer, PlayerConfiguration } from './PlayerTypes';
import { LLMPlayerImpl } from './LLMPlayer';
import { PlayerColor } from '../../shared/types/CommonTypes';
import { ILLMApiClient } from '../../infrastructure/api/LLMApiTypes';

export interface IPlayerManager {
  createPlayer(config: PlayerConfiguration, apiClient: ILLMApiClient): Promise<LLMPlayer>;
  switchTurn(): PlayerColor;
  getCurrentPlayer(): LLMPlayer;
  getPlayerByColor(color: PlayerColor): LLMPlayer;
  getAllPlayers(): LLMPlayer[];
}

export class PlayerManager implements IPlayerManager {
  private players: Map<PlayerColor, LLMPlayer> = new Map();
  private currentPlayerColor: PlayerColor = PlayerColor.WHITE;

  async createPlayer(config: PlayerConfiguration, apiClient: ILLMApiClient): Promise<LLMPlayer> {
    const player = new LLMPlayerImpl(config, apiClient);
    this.players.set(config.color, player);
    return player;
  }

  switchTurn(): PlayerColor {
    this.currentPlayerColor = this.currentPlayerColor === PlayerColor.WHITE
      ? PlayerColor.BLACK
      : PlayerColor.WHITE;
    return this.currentPlayerColor;
  }

  getCurrentPlayer(): LLMPlayer {
    const player = this.players.get(this.currentPlayerColor);
    if (!player) {
      throw new Error(`No player found for color: ${this.currentPlayerColor}`);
    }
    return player;
  }

  getPlayerByColor(color: PlayerColor): LLMPlayer {
    const player = this.players.get(color);
    if (!player) {
      throw new Error(`No player found for color: ${color}`);
    }
    return player;
  }

  getAllPlayers(): LLMPlayer[] {
    return Array.from(this.players.values());
  }
}