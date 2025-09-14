import { MockWebSocketServer, MockWebSocketClient } from '../../mocks/mock-websocket-server';

// Mock the actual WebSocket implementation
jest.mock('socket.io', () => {
  return {
    Server: jest.fn().mockImplementation(() => ({
      on: jest.fn(),
      emit: jest.fn(),
      listen: jest.fn(),
      close: jest.fn(),
      clients: new Set(),
    }))
  };
});

describe('GameWebSocketServer', () => {
  let mockServer: MockWebSocketServer;

  beforeEach(() => {
    mockServer = new MockWebSocketServer(3001);
  });

  afterEach(async () => {
    await mockServer.stop();
  });

  describe('Server Lifecycle', () => {
    it('should start server successfully', async () => {
      const listeningPromise = new Promise<void>((resolve) => {
        mockServer.on('listening', resolve);
      });

      await mockServer.start();
      await listeningPromise;

      expect(mockServer.isListening()).toBe(true);
    });

    it('should stop server successfully', async () => {
      await mockServer.start();
      expect(mockServer.isListening()).toBe(true);

      const closePromise = new Promise<void>((resolve) => {
        mockServer.on('close', resolve);
      });

      await mockServer.stop();
      await closePromise;

      expect(mockServer.isListening()).toBe(false);
    });

    it('should throw error when starting already running server', async () => {
      await mockServer.start();

      await expect(mockServer.start()).rejects.toThrow('Server already running');
    });

    it('should handle stopping non-running server gracefully', async () => {
      expect(mockServer.isListening()).toBe(false);

      await expect(mockServer.stop()).resolves.not.toThrow();
    });
  });

  describe('Client Management', () => {
    beforeEach(async () => {
      await mockServer.start();
    });

    it('should handle client connections', async () => {
      expect(mockServer.getClientCount()).toBe(0);

      const connectionPromise = new Promise<MockWebSocketClient>((resolve) => {
        mockServer.on('connection', resolve);
      });

      const client = mockServer.addClient();
      const connectedClient = await connectionPromise;

      expect(mockServer.getClientCount()).toBe(1);
      expect(connectedClient).toBe(client);
      expect(client.isConnected()).toBe(true);
    });

    it('should handle multiple client connections', async () => {
      const client1 = mockServer.addClient();
      const client2 = mockServer.addClient();
      const client3 = mockServer.addClient();

      expect(mockServer.getClientCount()).toBe(3);
      expect(client1.isConnected()).toBe(true);
      expect(client2.isConnected()).toBe(true);
      expect(client3.isConnected()).toBe(true);
    });

    it('should remove clients when they disconnect', async () => {
      const client1 = mockServer.addClient();
      const client2 = mockServer.addClient();

      expect(mockServer.getClientCount()).toBe(2);

      client1.disconnect();

      expect(mockServer.getClientCount()).toBe(1);
      expect(client1.isConnected()).toBe(false);
      expect(client2.isConnected()).toBe(true);
    });

    it('should disconnect all clients when server stops', async () => {
      const client1 = mockServer.addClient();
      const client2 = mockServer.addClient();

      expect(mockServer.getClientCount()).toBe(2);
      expect(client1.isConnected()).toBe(true);
      expect(client2.isConnected()).toBe(true);

      await mockServer.stop();

      expect(mockServer.getClientCount()).toBe(0);
      expect(client1.isConnected()).toBe(false);
      expect(client2.isConnected()).toBe(false);
    });
  });

  describe('Message Broadcasting', () => {
    let client1: MockWebSocketClient;
    let client2: MockWebSocketClient;

    beforeEach(async () => {
      await mockServer.start();
      client1 = mockServer.addClient();
      client2 = mockServer.addClient();
    });

    it('should broadcast messages to all connected clients', async () => {
      const gameState = {
        currentPlayer: 'white',
        move: 'e2e4',
        fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1'
      };

      // Set up message listeners
      const client1Messages: Array<{ event: string; data: any }> = [];
      const client2Messages: Array<{ event: string; data: any }> = [];

      client1.on('gameStateUpdate', (data) => {
        client1Messages.push({ event: 'gameStateUpdate', data });
      });

      client2.on('gameStateUpdate', (data) => {
        client2Messages.push({ event: 'gameStateUpdate', data });
      });

      // Broadcast message
      mockServer.broadcast('gameStateUpdate', gameState);

      expect(client1Messages).toHaveLength(1);
      expect(client2Messages).toHaveLength(1);
      expect(client1Messages[0].data).toEqual(gameState);
      expect(client2Messages[0].data).toEqual(gameState);
    });

    it('should only send messages to connected clients', async () => {
      client1.disconnect();

      const gameState = { move: 'e7e5' };
      const client2Messages: any[] = [];

      client1.on('gameStateUpdate', () => {
        throw new Error('Disconnected client should not receive messages');
      });

      client2.on('gameStateUpdate', (data) => {
        client2Messages.push(data);
      });

      mockServer.broadcast('gameStateUpdate', gameState);

      expect(client2Messages).toHaveLength(1);
    });

    it('should handle different message types', async () => {
      const messages: Array<{ event: string; data: any }> = [];

      client1.on('gameStart', (data) => {
        messages.push({ event: 'gameStart', data });
      });

      client1.on('gameEnd', (data) => {
        messages.push({ event: 'gameEnd', data });
      });

      client1.on('errorEvent', (data) => {
        messages.push({ event: 'errorEvent', data });
      });

      mockServer.broadcast('gameStart', { white: 'player1', black: 'player2' });
      mockServer.broadcast('gameEnd', { winner: 'white', reason: 'checkmate' });
      mockServer.broadcast('errorEvent', { message: 'Invalid move' });

      expect(messages).toHaveLength(3);
      expect(messages[0].event).toBe('gameStart');
      expect(messages[1].event).toBe('gameEnd');
      expect(messages[2].event).toBe('errorEvent');
    });
  });

  describe('Client Communication', () => {
    let client: MockWebSocketClient;

    beforeEach(async () => {
      await mockServer.start();
      client = mockServer.addClient();
    });

    it('should track received messages in client', () => {
      const message1 = { event: 'test1', data: { value: 1 } };
      const message2 = { event: 'test2', data: { value: 2 } };

      client.receive(message1.event, message1.data);
      client.receive(message2.event, message2.data);

      const receivedMessages = client.getReceivedMessages();
      expect(receivedMessages).toHaveLength(2);
      expect(receivedMessages[0]).toEqual(message1);
      expect(receivedMessages[1]).toEqual(message2);
    });

    it('should get last received message', () => {
      client.receive('first', { data: 'first' });
      client.receive('second', { data: 'second' });
      client.receive('third', { data: 'third' });

      const lastMessage = client.getLastMessage();
      expect(lastMessage).toEqual({ event: 'third', data: { data: 'third' } });
    });

    it('should clear received messages', () => {
      client.receive('test', { data: 'test' });
      expect(client.getReceivedMessages()).toHaveLength(1);

      client.clearReceivedMessages();
      expect(client.getReceivedMessages()).toHaveLength(0);
    });

    it('should handle client sending messages', () => {
      const receivedMessages: Array<{ event: string; data: any }> = [];

      client.on('clientMessage', (data) => {
        receivedMessages.push({ event: 'clientMessage', data });
      });

      client.send('clientMessage', { move: 'e2e4', player: 'white' });

      expect(receivedMessages).toHaveLength(1);
      expect(receivedMessages[0].data).toEqual({ move: 'e2e4', player: 'white' });
    });

    it('should prevent sending messages from disconnected client', () => {
      client.disconnect();

      expect(() => {
        client.send('test', { data: 'test' });
      }).toThrow('Cannot send to disconnected client');
    });

    it('should not receive messages when disconnected', () => {
      client.disconnect();

      client.receive('test', { data: 'test' });

      expect(client.getReceivedMessages()).toHaveLength(0);
    });
  });

  describe('Chess Game Integration Scenarios', () => {
    beforeEach(async () => {
      await mockServer.start();
    });

    it('should handle game initialization flow', async () => {
      const spectatorClient = mockServer.addClient();
      const receivedEvents: string[] = [];

      spectatorClient.on('gameInitialized', () => receivedEvents.push('gameInitialized'));
      spectatorClient.on('playersReady', () => receivedEvents.push('playersReady'));
      spectatorClient.on('gameStarted', () => receivedEvents.push('gameStarted'));

      // Simulate game initialization
      mockServer.broadcast('gameInitialized', {
        gameId: 'test-game-1',
        players: { white: 'gpt-4', black: 'claude-3' }
      });

      mockServer.broadcast('playersReady', { ready: true });
      mockServer.broadcast('gameStarted', { timestamp: new Date() });

      expect(receivedEvents).toEqual(['gameInitialized', 'playersReady', 'gameStarted']);
    });

    it('should handle move sequence broadcasting', async () => {
      const client = mockServer.addClient();
      const moves: any[] = [];

      client.on('moveUpdate', (data) => {
        moves.push(data);
      });

      // Simulate a game sequence
      const moveSequence = [
        { move: 'e2e4', player: 'white', notation: 'e4' },
        { move: 'e7e5', player: 'black', notation: 'e5' },
        { move: 'g1f3', player: 'white', notation: 'Nf3' },
        { move: 'b8c6', player: 'black', notation: 'Nc6' }
      ];

      for (const move of moveSequence) {
        mockServer.broadcast('moveUpdate', move);
      }

      expect(moves).toHaveLength(4);
      expect(moves.map(m => m.notation)).toEqual(['e4', 'e5', 'Nf3', 'Nc6']);
    });

    it('should handle game end scenarios', async () => {
      const client = mockServer.addClient();
      let gameEndData: any = null;

      client.on('gameEnded', (data) => {
        gameEndData = data;
      });

      mockServer.broadcast('gameEnded', {
        result: 'checkmate',
        winner: 'white',
        finalPosition: 'rnbqkb1r/pppp1ppp/5n2/4p3/2B1P3/8/PPPP1PPP/RNBQK1NR w KQkq - 4 4',
        moveCount: 8
      });

      expect(gameEndData).toEqual({
        result: 'checkmate',
        winner: 'white',
        finalPosition: 'rnbqkb1r/pppp1ppp/5n2/4p3/2B1P3/8/PPPP1PPP/RNBQK1NR w KQkq - 4 4',
        moveCount: 8
      });
    });

    it('should handle error conditions', async () => {
      const client = mockServer.addClient();
      const errors: any[] = [];

      client.on('error', (data) => {
        errors.push(data);
      });

      // Simulate various error conditions
      mockServer.broadcast('error', { type: 'invalidMove', message: 'Move is not legal' });
      mockServer.broadcast('error', { type: 'timeout', message: 'Player timed out' });
      mockServer.broadcast('error', { type: 'apiError', message: 'LLM API error' });

      expect(errors).toHaveLength(3);
      expect(errors[0].type).toBe('invalidMove');
      expect(errors[1].type).toBe('timeout');
      expect(errors[2].type).toBe('apiError');
    });
  });
});