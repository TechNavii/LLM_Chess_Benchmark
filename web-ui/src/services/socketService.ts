import { io, Socket } from 'socket.io-client';
import type { GameConfiguration } from '../types/game';

class SocketService {
  private socket: Socket | null = null;

  connect(url: string = 'http://localhost:3001') {
    this.socket = io(url);
    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  startGame(config: GameConfiguration) {
    if (this.socket) {
      this.socket.emit('game:start', config);
    }
  }

  pauseGame() {
    if (this.socket) {
      this.socket.emit('game:pause');
    }
  }

  resumeGame() {
    if (this.socket) {
      this.socket.emit('game:resume');
    }
  }

  resetGame() {
    if (this.socket) {
      this.socket.emit('game:reset');
    }
  }

  exportGame(format: 'pgn' | 'json') {
    if (this.socket) {
      this.socket.emit('game:export', format);
    }
  }

  getSocket() {
    return this.socket;
  }
}

export default new SocketService();