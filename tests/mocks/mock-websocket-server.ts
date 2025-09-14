import { EventEmitter } from 'events';

/**
 * Mock WebSocket Server for testing
 */
export class MockWebSocketServer extends EventEmitter {
  private clients: Set<MockWebSocketClient> = new Set();
  private isRunning: boolean = false;

  constructor(private port?: number) {
    super();
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('Server already running');
    }
    this.isRunning = true;
    this.emit('listening');
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    // Disconnect all clients
    for (const client of this.clients) {
      client.disconnect();
    }
    this.clients.clear();

    this.isRunning = false;
    this.emit('close');
  }

  // Simulate client connection
  addClient(): MockWebSocketClient {
    const client = new MockWebSocketClient();
    this.clients.add(client);

    client.on('disconnect', () => {
      this.clients.delete(client);
    });

    this.emit('connection', client);
    return client;
  }

  broadcast(event: string, data: any): void {
    for (const client of this.clients) {
      client.receive(event, data);
    }
  }

  getClientCount(): number {
    return this.clients.size;
  }

  isListening(): boolean {
    return this.isRunning;
  }
}

/**
 * Mock WebSocket Client for testing
 */
export class MockWebSocketClient extends EventEmitter {
  private connected: boolean = true;
  private receivedMessages: Array<{ event: string; data: any }> = [];

  constructor() {
    super();
  }

  send(event: string, data: any): void {
    if (!this.connected) {
      throw new Error('Cannot send to disconnected client');
    }
    this.emit(event, data);
  }

  receive(event: string, data: any): void {
    if (!this.connected) {
      return;
    }
    this.receivedMessages.push({ event, data });
    this.emit(event, data);
  }

  disconnect(): void {
    if (!this.connected) {
      return;
    }
    this.connected = false;
    this.emit('disconnect');
  }

  isConnected(): boolean {
    return this.connected;
  }

  getReceivedMessages(): Array<{ event: string; data: any }> {
    return [...this.receivedMessages];
  }

  clearReceivedMessages(): void {
    this.receivedMessages = [];
  }

  getLastMessage(): { event: string; data: any } | undefined {
    return this.receivedMessages[this.receivedMessages.length - 1];
  }
}