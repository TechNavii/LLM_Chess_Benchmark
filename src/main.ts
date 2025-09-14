#!/usr/bin/env node

import { Command } from 'commander';
import { ChessCLI } from './presentation/cli/ChessCLI';
import { WebServer } from './presentation/web/WebServer';
import chalk from 'chalk';

async function main() {
  const program = new Command();

  program
    .name('chess-llm')
    .description('Chess game where two LLMs play against each other')
    .version('1.0.0');

  program
    .command('web')
    .description('Start web interface for the chess game')
    .option('-p, --port <number>', 'Port number', '3000')
    .action(async (options) => {
      try {
        const port = parseInt(options.port);
        const server = new WebServer(port);
        server.start();
      } catch (error) {
        console.error(chalk.red('Failed to start web server:'), error);
        process.exit(1);
      }
    });

  program
    .command('cli', { isDefault: true })
    .description('Start CLI interface (default)')
    .action(async () => {
      try {
        const cli = new ChessCLI();
        await cli.run();
      } catch (error) {
        console.error(chalk.red('Fatal error:'), error);
        process.exit(1);
      }
    });

  await program.parseAsync(process.argv);
}

main().catch(error => {
  console.error(chalk.red('Unhandled error:'), error);
  process.exit(1);
});