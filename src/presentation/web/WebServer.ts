import express, { Express } from 'express';
import { createServer, Server as HttpServer } from 'http';
import cors from 'cors';
import path from 'path';
import { GameWebSocketServer } from '../websocket/GameWebSocketServer';
import { OpenRouterClient } from '../../infrastructure/api/OpenRouterClient';
import { ConfigurationManager } from '../../infrastructure/config/ConfigurationManager';

export class WebServer {
  private app: Express;
  private server: HttpServer;
  private wsServer: GameWebSocketServer;
  private configManager: ConfigurationManager;
  private port: number;

  constructor(port: number = 3000) {
    this.port = port;
    this.app = express();
    this.server = createServer(this.app);
    this.wsServer = new GameWebSocketServer(this.server);
    this.configManager = new ConfigurationManager();
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    this.app.use(cors());
    this.app.use(express.json());

    const webUiPath = path.join(__dirname, '../../../web-ui/dist');
    this.app.use(express.static(webUiPath));
  }

  private setupRoutes(): void {
    this.app.get('/api/models', async (req, res) => {
      try {
        const config = await this.configManager.loadConfiguration();
        const apiKey = req.query.apiKey as string || config.openRouterApiKey;

        if (!apiKey) {
          return res.status(400).json({ error: 'API key required' });
        }

        const client = new OpenRouterClient(apiKey);
        const models = await client.getAvailableModels();
        res.json(models);
      } catch (error) {
        res.status(500).json({
          error: error instanceof Error ? error.message : 'Failed to fetch models'
        });
      }
    });

    this.app.get('/api/config', async (req, res) => {
      try {
        const config = await this.configManager.loadConfiguration();
        const hasApiKey = !!(config.openRouterApiKey || process.env.OPENROUTER_API_KEY);

        res.json({
          hasApiKey,
          defaultModels: config.defaultModels,
          timerSettings: config.timerSettings,
          gameSettings: config.gameSettings
        });
      } catch (error) {
        res.status(500).json({
          error: error instanceof Error ? error.message : 'Failed to load configuration'
        });
      }
    });

    this.app.post('/api/config', async (req, res) => {
      try {
        const config = await this.configManager.loadConfiguration();
        const updatedConfig = { ...config, ...req.body };
        await this.configManager.saveConfiguration(updatedConfig);
        res.json({ success: true });
      } catch (error) {
        res.status(500).json({
          error: error instanceof Error ? error.message : 'Failed to save configuration'
        });
      }
    });

    // Catch-all route for React Router (Express v5 compatible)
    this.app.use((req, res) => {
      if (req.method === 'GET' && !req.path.startsWith('/api')) {
        const webUiPath = path.join(__dirname, '../../../web-ui/dist/index.html');
        res.sendFile(webUiPath);
      } else {
        res.status(404).json({ error: 'Not found' });
      }
    });
  }

  public start(): void {
    this.server.listen(this.port, () => {
      console.log(`
╔═══════════════════════════════════════════════════════╗
║                                                       ║
║         Chess LLM Game - Web Interface               ║
║                                                       ║
║   Server running at: http://localhost:${this.port}            ║
║                                                       ║
║   Open your browser to play!                         ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
      `);
    });
  }

  public stop(): void {
    this.server.close();
  }
}