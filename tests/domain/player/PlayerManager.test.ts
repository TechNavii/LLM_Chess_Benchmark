import { PlayerManager } from '../../../src/domain/player/PlayerManager';
import { PlayerColor } from '../../../src/shared/types/CommonTypes';
import { MockLLMApiClient } from '../../mocks/mock-llm-client';
import { createMockPlayerConfig } from '../../utils/test-helpers';

describe('PlayerManager', () => {
  let playerManager: PlayerManager;
  let mockApiClient: MockLLMApiClient;

  beforeEach(() => {
    playerManager = new PlayerManager();
    mockApiClient = new MockLLMApiClient();
  });

  describe('Player Creation', () => {
    it('should create a white player successfully', async () => {
      const config = createMockPlayerConfig(PlayerColor.WHITE);
      const player = await playerManager.createPlayer(config, mockApiClient);

      expect(player).toBeDefined();
      expect(player.id).toBe(config.id);
      expect(player.color).toBe(PlayerColor.WHITE);
      expect(player.modelName).toBe(config.modelName);
    });

    it('should create a black player successfully', async () => {
      const config = createMockPlayerConfig(PlayerColor.BLACK);
      const player = await playerManager.createPlayer(config, mockApiClient);

      expect(player).toBeDefined();
      expect(player.id).toBe(config.id);
      expect(player.color).toBe(PlayerColor.BLACK);
      expect(player.modelName).toBe(config.modelName);
    });

    it('should create both players with different configurations', async () => {
      const whiteConfig = createMockPlayerConfig(PlayerColor.WHITE, {
        modelName: 'gpt-4',
        initialTimeMs: 300000
      });
      const blackConfig = createMockPlayerConfig(PlayerColor.BLACK, {
        modelName: 'claude-3',
        initialTimeMs: 600000
      });

      const whitePlayer = await playerManager.createPlayer(whiteConfig, mockApiClient);
      const blackPlayer = await playerManager.createPlayer(blackConfig, mockApiClient);

      expect(whitePlayer.modelName).toBe('gpt-4');
      expect(blackPlayer.modelName).toBe('claude-3');
      expect(whitePlayer.color).toBe(PlayerColor.WHITE);
      expect(blackPlayer.color).toBe(PlayerColor.BLACK);
    });
  });

  describe('Turn Management', () => {
    beforeEach(async () => {
      const whiteConfig = createMockPlayerConfig(PlayerColor.WHITE);
      const blackConfig = createMockPlayerConfig(PlayerColor.BLACK);

      await playerManager.createPlayer(whiteConfig, mockApiClient);
      await playerManager.createPlayer(blackConfig, mockApiClient);
    });

    it('should start with white player as current', () => {
      const currentPlayer = playerManager.getCurrentPlayer();
      expect(currentPlayer.color).toBe(PlayerColor.WHITE);
    });

    it('should switch turns correctly', () => {
      // Initial turn should be white
      expect(playerManager.getCurrentPlayer().color).toBe(PlayerColor.WHITE);

      // Switch to black
      const newColor = playerManager.switchTurn();
      expect(newColor).toBe(PlayerColor.BLACK);
      expect(playerManager.getCurrentPlayer().color).toBe(PlayerColor.BLACK);

      // Switch back to white
      const nextColor = playerManager.switchTurn();
      expect(nextColor).toBe(PlayerColor.WHITE);
      expect(playerManager.getCurrentPlayer().color).toBe(PlayerColor.WHITE);
    });

    it('should alternate turns multiple times', () => {
      const expectedSequence = [
        PlayerColor.WHITE,  // Initial
        PlayerColor.BLACK,  // After first switch
        PlayerColor.WHITE,  // After second switch
        PlayerColor.BLACK,  // After third switch
        PlayerColor.WHITE   // After fourth switch
      ];

      // Check initial state
      expect(playerManager.getCurrentPlayer().color).toBe(expectedSequence[0]);

      // Check switches
      for (let i = 1; i < expectedSequence.length; i++) {
        const switchedTo = playerManager.switchTurn();
        expect(switchedTo).toBe(expectedSequence[i]);
        expect(playerManager.getCurrentPlayer().color).toBe(expectedSequence[i]);
      }
    });
  });

  describe('Player Retrieval', () => {
    beforeEach(async () => {
      const whiteConfig = createMockPlayerConfig(PlayerColor.WHITE);
      const blackConfig = createMockPlayerConfig(PlayerColor.BLACK);

      await playerManager.createPlayer(whiteConfig, mockApiClient);
      await playerManager.createPlayer(blackConfig, mockApiClient);
    });

    it('should retrieve player by color', () => {
      const whitePlayer = playerManager.getPlayerByColor(PlayerColor.WHITE);
      const blackPlayer = playerManager.getPlayerByColor(PlayerColor.BLACK);

      expect(whitePlayer.color).toBe(PlayerColor.WHITE);
      expect(blackPlayer.color).toBe(PlayerColor.BLACK);
    });

    it('should get all players', () => {
      const allPlayers = playerManager.getAllPlayers();

      expect(allPlayers).toHaveLength(2);
      expect(allPlayers.map(p => p.color)).toContain(PlayerColor.WHITE);
      expect(allPlayers.map(p => p.color)).toContain(PlayerColor.BLACK);
    });

    it('should return the same player instance on repeated calls', () => {
      const player1 = playerManager.getPlayerByColor(PlayerColor.WHITE);
      const player2 = playerManager.getPlayerByColor(PlayerColor.WHITE);

      expect(player1).toBe(player2);
    });
  });

  describe('Error Handling', () => {
    it('should throw error when getting current player with no players created', () => {
      expect(() => {
        playerManager.getCurrentPlayer();
      }).toThrow('No player found for color: white');
    });

    it('should throw error when getting player by color that does not exist', () => {
      expect(() => {
        playerManager.getPlayerByColor(PlayerColor.BLACK);
      }).toThrow('No player found for color: black');
    });

    it('should throw error when only one player exists and switching to non-existent player', async () => {
      const whiteConfig = createMockPlayerConfig(PlayerColor.WHITE);
      await playerManager.createPlayer(whiteConfig, mockApiClient);

      // Switch turn (should change to black)
      playerManager.switchTurn();

      // Try to get current player (black doesn't exist)
      expect(() => {
        playerManager.getCurrentPlayer();
      }).toThrow('No player found for color: black');
    });

    it('should handle replacement of existing player', async () => {
      const initialConfig = createMockPlayerConfig(PlayerColor.WHITE, {
        modelName: 'initial-model'
      });
      const replacementConfig = createMockPlayerConfig(PlayerColor.WHITE, {
        modelName: 'replacement-model'
      });

      const initialPlayer = await playerManager.createPlayer(initialConfig, mockApiClient);
      expect(initialPlayer.modelName).toBe('initial-model');

      const replacementPlayer = await playerManager.createPlayer(replacementConfig, mockApiClient);
      expect(replacementPlayer.modelName).toBe('replacement-model');

      const currentPlayer = playerManager.getPlayerByColor(PlayerColor.WHITE);
      expect(currentPlayer.modelName).toBe('replacement-model');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty player list for getAllPlayers', () => {
      const allPlayers = playerManager.getAllPlayers();
      expect(allPlayers).toHaveLength(0);
      expect(Array.isArray(allPlayers)).toBe(true);
    });

    it('should maintain turn state when creating new players', async () => {
      const whiteConfig = createMockPlayerConfig(PlayerColor.WHITE);
      await playerManager.createPlayer(whiteConfig, mockApiClient);

      // Switch to black (but don't create black player yet)
      playerManager.switchTurn();

      // Now create black player
      const blackConfig = createMockPlayerConfig(PlayerColor.BLACK);
      await playerManager.createPlayer(blackConfig, mockApiClient);

      // Current player should still be black
      const currentPlayer = playerManager.getCurrentPlayer();
      expect(currentPlayer.color).toBe(PlayerColor.BLACK);
    });

    it('should handle player creation with same API client', async () => {
      const whiteConfig = createMockPlayerConfig(PlayerColor.WHITE);
      const blackConfig = createMockPlayerConfig(PlayerColor.BLACK);

      const whitePlayer = await playerManager.createPlayer(whiteConfig, mockApiClient);
      const blackPlayer = await playerManager.createPlayer(blackConfig, mockApiClient);

      expect(whitePlayer).toBeDefined();
      expect(blackPlayer).toBeDefined();
      expect(whitePlayer).not.toBe(blackPlayer);
    });
  });
});