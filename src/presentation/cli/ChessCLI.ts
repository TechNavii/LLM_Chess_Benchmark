import { Command } from 'commander';
import * as inquirer from 'inquirer';
import chalk from 'chalk';
import { ChessGameManager } from '../../domain/chess/ChessGameManager';
import { PlayerManager } from '../../domain/player/PlayerManager';
import { GameTimerManager } from '../../domain/timer/GameTimerManager';
import { GameOrchestrator } from '../../application/GameOrchestrator';
import { OpenRouterClient } from '../../infrastructure/api/OpenRouterClient';
import { ConfigurationManager } from '../../infrastructure/config/ConfigurationManager';
import { StateManager } from '../../infrastructure/storage/StateManager';
import { BoardFormatter } from '../formatters/BoardFormatter';
import { PlayerColor, TimerType } from '../../shared/types/CommonTypes';
import { GameConfiguration } from '../../infrastructure/config/ConfigTypes';

export class ChessCLI {
  private program: Command;
  private configManager: ConfigurationManager;
  private stateManager: StateManager;

  constructor() {
    this.program = new Command();
    this.configManager = new ConfigurationManager();
    this.stateManager = new StateManager();
    this.setupCommands();
  }

  private setupCommands(): void {
    this.program
      .name('chess-llm')
      .description('Chess game where two LLMs play against each other')
      .version('1.0.0');

    this.program
      .command('play')
      .description('Start a new chess game between two LLMs')
      .option('-w, --white <model>', 'Model name for white player')
      .option('-b, --black <model>', 'Model name for black player')
      .option('-t, --time <minutes>', 'Time control in minutes', '10')
      .option('-i, --increment <seconds>', 'Time increment in seconds', '5')
      .option('--timer-type <type>', 'Timer type (fischer/bronstein/simple)', 'fischer')
      .option('--no-save', 'Do not save the game')
      .option('--api-key <key>', 'OpenRouter API key')
      .action(async (options) => {
        await this.startGame(options);
      });

    this.program
      .command('interactive')
      .description('Start an interactive setup for a new game')
      .action(async () => {
        await this.interactiveSetup();
      });

    this.program
      .command('models')
      .description('List available models from OpenRouter')
      .option('--api-key <key>', 'OpenRouter API key')
      .action(async (options) => {
        await this.listModels(options);
      });

    this.program
      .command('config')
      .description('Configure default settings')
      .action(async () => {
        await this.configureSettings();
      });
  }

  async run(): Promise<void> {
    await this.program.parseAsync(process.argv);
  }

  private async startGame(options: any): Promise<void> {
    try {
      const config = await this.configManager.loadConfiguration();

      if (options.apiKey) {
        config.openRouterApiKey = options.apiKey;
      }

      if (!config.openRouterApiKey) {
        console.error(chalk.red('Error: OpenRouter API key is required'));
        console.log('Set it via --api-key flag or OPENROUTER_API_KEY environment variable');
        process.exit(1);
      }

      const gameConfig: GameConfiguration = {
        whitePlayer: {
          id: 'white-player',
          modelName: options.white || config.defaultModels.white,
          initialTimeMs: parseInt(options.time) * 60 * 1000,
          incrementMs: parseInt(options.increment) * 1000
        },
        blackPlayer: {
          id: 'black-player',
          modelName: options.black || config.defaultModels.black,
          initialTimeMs: parseInt(options.time) * 60 * 1000,
          incrementMs: parseInt(options.increment) * 1000
        },
        timerType: this.parseTimerType(options.timerType),
        outputFormat: config.gameSettings.outputFormat,
        saveGame: options.save !== false
      };

      await this.runGame(gameConfig, config.openRouterApiKey);
    } catch (error) {
      console.error(chalk.red('Error starting game:'), error);
      process.exit(1);
    }
  }

  private async interactiveSetup(): Promise<void> {
    const config = await this.configManager.loadConfiguration();

    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'apiKey',
        message: 'OpenRouter API key:',
        default: config.openRouterApiKey,
        when: !config.openRouterApiKey
      },
      {
        type: 'input',
        name: 'whiteModel',
        message: 'Model for White player:',
        default: config.defaultModels.white
      },
      {
        type: 'input',
        name: 'blackModel',
        message: 'Model for Black player:',
        default: config.defaultModels.black
      },
      {
        type: 'number',
        name: 'timeMinutes',
        message: 'Time control (minutes):',
        default: 10
      },
      {
        type: 'number',
        name: 'incrementSeconds',
        message: 'Time increment (seconds):',
        default: 5
      },
      {
        type: 'list',
        name: 'timerType',
        message: 'Timer type:',
        choices: ['fischer', 'bronstein', 'simple'],
        default: 'fischer'
      },
      {
        type: 'confirm',
        name: 'displayBoard',
        message: 'Display board after each move?',
        default: true
      },
      {
        type: 'confirm',
        name: 'saveGame',
        message: 'Save game to file?',
        default: true
      }
    ]);

    const apiKey = answers.apiKey || config.openRouterApiKey;

    const gameConfig: GameConfiguration = {
      whitePlayer: {
        id: 'white-player',
        modelName: answers.whiteModel,
        initialTimeMs: answers.timeMinutes * 60 * 1000,
        incrementMs: answers.incrementSeconds * 1000
      },
      blackPlayer: {
        id: 'black-player',
        modelName: answers.blackModel,
        initialTimeMs: answers.timeMinutes * 60 * 1000,
        incrementMs: answers.incrementSeconds * 1000
      },
      timerType: this.parseTimerType(answers.timerType),
      outputFormat: config.gameSettings.outputFormat,
      saveGame: answers.saveGame
    };

    config.gameSettings.displayBoard = answers.displayBoard;
    await this.runGame(gameConfig, apiKey, answers.displayBoard);
  }

  private async runGame(
    gameConfig: GameConfiguration,
    apiKey: string,
    displayBoard: boolean = true
  ): Promise<void> {
    console.log(chalk.cyan('\n═══════════════════════════════════════'));
    console.log(chalk.cyan('        LLM Chess Game Starting        '));
    console.log(chalk.cyan('═══════════════════════════════════════\n'));

    const apiClient = new OpenRouterClient(apiKey);
    const chessManager = new ChessGameManager();
    const playerManager = new PlayerManager();
    const timerManager = new GameTimerManager({
      initialTimeMs: gameConfig.whitePlayer.initialTimeMs,
      incrementMs: gameConfig.whitePlayer.incrementMs,
      type: gameConfig.timerType
    });

    await playerManager.createPlayer(
      {
        id: gameConfig.whitePlayer.id,
        color: PlayerColor.WHITE,
        modelName: gameConfig.whitePlayer.modelName,
        initialTimeMs: gameConfig.whitePlayer.initialTimeMs,
        incrementMs: gameConfig.whitePlayer.incrementMs
      },
      apiClient
    );

    await playerManager.createPlayer(
      {
        id: gameConfig.blackPlayer.id,
        color: PlayerColor.BLACK,
        modelName: gameConfig.blackPlayer.modelName,
        initialTimeMs: gameConfig.blackPlayer.initialTimeMs,
        incrementMs: gameConfig.blackPlayer.incrementMs
      },
      apiClient
    );

    const orchestrator = new GameOrchestrator(
      chessManager,
      playerManager,
      timerManager,
      this.stateManager,
      (message: string) => {
        console.log(chalk.gray(`[Game] ${message}`));

        if (displayBoard && message.includes('Move notation:')) {
          const gameState = chessManager.getCurrentGameState();
          const lastMove = gameState.moveHistory[gameState.moveHistory.length - 1];
          console.log(BoardFormatter.formatSimpleBoard(gameState.fen));
        }
      }
    );

    await orchestrator.startGame(gameConfig);

    console.log(chalk.green('\nGame in progress...\n'));

    try {
      const result = await orchestrator.processGameLoop();

      console.log(chalk.cyan('\n═══════════════════════════════════════'));
      console.log(chalk.cyan('           Game Finished!              '));
      console.log(chalk.cyan('═══════════════════════════════════════\n'));

      if (result.winner) {
        console.log(chalk.green(`Winner: ${result.winner}`));
      } else {
        console.log(chalk.yellow('Game ended in a draw'));
      }
      console.log(`Result: ${result.reason}`);
      console.log(`Total moves: ${result.moveCount}`);

      if (gameConfig.saveGame) {
        const gameState = chessManager.getCurrentGameState();
        await this.stateManager.saveGameState(gameState, Date.now().toString());
        const pgn = await this.stateManager.exportGame(gameState, 'pgn');
        console.log(chalk.gray('\nGame saved to game-saves/'));
        console.log(chalk.gray('\nPGN:'));
        console.log(pgn);
      }
    } catch (error) {
      console.error(chalk.red('\nGame error:'), error);
    } finally {
      timerManager.cleanup();
    }
  }

  private async listModels(options: any): Promise<void> {
    try {
      const config = await this.configManager.loadConfiguration();
      const apiKey = options.apiKey || config.openRouterApiKey;

      if (!apiKey) {
        console.error(chalk.red('Error: OpenRouter API key is required'));
        return;
      }

      const client = new OpenRouterClient(apiKey);
      console.log(chalk.cyan('Fetching available models...'));

      const models = await client.getAvailableModels();

      console.log(chalk.green(`\nFound ${models.length} models:\n`));

      const popularModels = [
        'openai/gpt-4o',
        'openai/gpt-4o-mini',
        'anthropic/claude-3-opus',
        'anthropic/claude-3-sonnet',
        'anthropic/claude-3-haiku',
        'google/gemini-pro',
        'meta-llama/llama-3-70b-instruct'
      ];

      const popular = models.filter(m => popularModels.includes(m.id));
      const others = models.filter(m => !popularModels.includes(m.id));

      if (popular.length > 0) {
        console.log(chalk.yellow('Popular models:'));
        popular.forEach(model => {
          console.log(`  - ${model.id}`);
        });
      }

      if (others.length > 0) {
        console.log(chalk.gray('\nOther available models:'));
        others.slice(0, 20).forEach(model => {
          console.log(`  - ${model.id}`);
        });
        if (others.length > 20) {
          console.log(chalk.gray(`  ... and ${others.length - 20} more`));
        }
      }
    } catch (error) {
      console.error(chalk.red('Error fetching models:'), error);
    }
  }

  private async configureSettings(): Promise<void> {
    const config = await this.configManager.loadConfiguration();

    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'whiteModel',
        message: 'Default model for White:',
        default: config.defaultModels.white
      },
      {
        type: 'input',
        name: 'blackModel',
        message: 'Default model for Black:',
        default: config.defaultModels.black
      },
      {
        type: 'number',
        name: 'defaultTime',
        message: 'Default time (minutes):',
        default: config.timerSettings.initialTimeMs / 60000
      },
      {
        type: 'number',
        name: 'defaultIncrement',
        message: 'Default increment (seconds):',
        default: config.timerSettings.incrementMs / 1000
      }
    ]);

    config.defaultModels.white = answers.whiteModel;
    config.defaultModels.black = answers.blackModel;
    config.timerSettings.initialTimeMs = answers.defaultTime * 60000;
    config.timerSettings.incrementMs = answers.defaultIncrement * 1000;

    await this.configManager.saveConfiguration(config);
    console.log(chalk.green('Configuration saved!'));
  }

  private parseTimerType(type: string): TimerType {
    switch (type.toLowerCase()) {
      case 'bronstein':
        return TimerType.BRONSTEIN;
      case 'simple':
        return TimerType.SIMPLE;
      default:
        return TimerType.FISCHER;
    }
  }
}