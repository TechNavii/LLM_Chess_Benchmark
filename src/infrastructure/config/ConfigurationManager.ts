import * as fs from 'fs/promises';
import * as path from 'path';
import { AppConfiguration } from './ConfigTypes';
import { TimerType, OutputFormat } from '../../shared/types/CommonTypes';
import * as dotenv from 'dotenv';

export interface IConfigurationManager {
  loadConfiguration(): Promise<AppConfiguration>;
  saveConfiguration(config: AppConfiguration): Promise<void>;
  validateConfiguration(config: AppConfiguration): { isValid: boolean; errors: string[] };
}

export class ConfigurationManager implements IConfigurationManager {
  private configPath: string;

  constructor(configPath: string = './config/app-config.json') {
    this.configPath = configPath;
    dotenv.config();
  }

  async loadConfiguration(): Promise<AppConfiguration> {
    try {
      const configData = await fs.readFile(this.configPath, 'utf-8');
      const config = JSON.parse(configData);
      return this.mergeWithEnv(config);
    } catch (error) {
      console.log('No configuration file found, using defaults');
      return this.getDefaultConfiguration();
    }
  }

  async saveConfiguration(config: AppConfiguration): Promise<void> {
    const configDir = path.dirname(this.configPath);
    await fs.mkdir(configDir, { recursive: true });

    const configToSave = { ...config };
    delete (configToSave as any).openRouterApiKey;

    await fs.writeFile(
      this.configPath,
      JSON.stringify(configToSave, null, 2),
      'utf-8'
    );
  }

  validateConfiguration(config: AppConfiguration): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!config.openRouterApiKey) {
      errors.push('OpenRouter API key is required');
    }

    if (!config.defaultModels.white || !config.defaultModels.black) {
      errors.push('Both white and black player models must be specified');
    }

    if (config.timerSettings.initialTimeMs < 60000) {
      errors.push('Initial time must be at least 1 minute (60000ms)');
    }

    if (config.timerSettings.incrementMs < 0) {
      errors.push('Time increment cannot be negative');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  private mergeWithEnv(config: AppConfiguration): AppConfiguration {
    return {
      ...config,
      openRouterApiKey: process.env.OPENROUTER_API_KEY || config.openRouterApiKey || ''
    };
  }

  private getDefaultConfiguration(): AppConfiguration {
    return {
      openRouterApiKey: process.env.OPENROUTER_API_KEY || '',
      defaultModels: {
        white: 'openai/gpt-4o-mini',
        black: 'anthropic/claude-3-haiku'
      },
      timerSettings: {
        initialTimeMs: 600000,
        incrementMs: 5000,
        type: TimerType.FISCHER
      },
      gameSettings: {
        outputFormat: OutputFormat.PGN,
        saveGames: true,
        logLevel: 'info',
        showThinking: true,
        displayBoard: true
      }
    };
  }
}