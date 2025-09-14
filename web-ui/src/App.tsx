import { useEffect, useState } from 'react';
import ChessBoard from './components/ChessBoard';
import GameControls from './components/GameControls';
import TimerDisplay from './components/TimerDisplay';
import MoveHistory from './components/MoveHistory';
import ThinkingDisplay from './components/ThinkingDisplay';
import WinProbability from './components/WinProbability';
import { InvalidMoveAlert } from './components/InvalidMoveAlert';
import socketService from './services/socketService';
import { useGameStore } from './stores/gameStore';
import { GameStatus } from './types/game';

function App() {
  const {
    updateGameState,
    setPlayers,
    updateTime,
    setThinking,
    addMove,
    setGameResult
  } = useGameStore();

  const { gameStatus } = useGameStore();
  const [invalidMove, setInvalidMove] = useState<any>(null);

  useEffect(() => {
    // Connect to WebSocket server on the same port as the web server
    const currentPort = window.location.port || '3001';
    const socket = socketService.connect(`http://localhost:${currentPort}`);

    socket.on('game:started', (data) => {
      console.log('Game started:', data);
      updateGameState({ gameStatus: GameStatus.IN_PROGRESS });
      setPlayers(
        {
          id: data.config.whitePlayer.id,
          color: 'white',
          modelName: data.config.whitePlayer.modelName,
          timeRemaining: data.config.whitePlayer.initialTimeMs,
        },
        {
          id: data.config.blackPlayer.id,
          color: 'black',
          modelName: data.config.blackPlayer.modelName,
          timeRemaining: data.config.blackPlayer.initialTimeMs,
        }
      );
    });

    socket.on('game:move', (data) => {
      console.log('Move received:', data);
      if (data.move) {
        addMove(data.move);
      }
      if (data.gameState) {
        updateGameState({
          fen: data.gameState.fen,
          pgn: data.gameState.pgn,
          moveHistory: data.gameState.moveHistory,
          gameStatus: data.gameState.gameStatus,
          currentPlayer: data.gameState.currentPlayer,
        });
      }
    });

    socket.on('game:thinking', (data) => {
      setThinking(data.thinking, data.text);
    });

    socket.on('game:timeUpdate', (data) => {
      updateTime(data.whiteTime, data.blackTime);
    });

    socket.on('game:boardUpdate', (data) => {
      updateGameState({ fen: data.fen, pgn: data.pgn });
    });

    socket.on('game:status', (data) => {
      updateGameState({ gameStatus: data.status });
    });

    socket.on('game:ended', (data) => {
      console.log('Game ended:', data);
      setThinking(false);
      if (data.result.result === 'win') {
        updateGameState({ gameStatus: GameStatus.CHECKMATE });
        setGameResult({ winner: data.result.winner, reason: data.result.reason });
      } else if (data.result.result === 'draw') {
        updateGameState({ gameStatus: GameStatus.DRAW });
      } else if (data.result.result === 'timeout') {
        updateGameState({ gameStatus: GameStatus.TIMEOUT });
        setGameResult({ winner: data.result.winner, reason: 'Timeout' });
      } else if (data.result.result === 'forfeit') {
        updateGameState({ gameStatus: GameStatus.FORFEIT });
        setGameResult({ winner: data.result.winner, reason: data.result.reason });
      } else if (data.result.result === 'error') {
        updateGameState({ gameStatus: GameStatus.DRAW });
        alert(`Game ended due to error: ${data.result.reason}`);
      }
    });

    socket.on('game:error', (data) => {
      console.error('Game error:', data);
      alert(`Error: ${data.message}`);
      if (data.message.includes('API key')) {
        alert('Please ensure your OpenRouter API key is set in the .env file on the server');
      }
    });

    socket.on('game:invalidMove', (data) => {
      console.log('Invalid move:', data);
      setInvalidMove(data);
    });

    return () => {
      socketService.disconnect();
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800">
      <InvalidMoveAlert invalidMove={invalidMove} />
      <header className="bg-gray-900 border-b border-gray-700 p-4">
        <div className="container mx-auto">
          <h1 className="text-3xl font-bold text-white flex items-center">
            <span className="mr-3">♟️</span>
            Chess LLM Game
          </h1>
        </div>
      </header>

      <main className="container mx-auto p-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <ChessBoard />

            {gameStatus !== GameStatus.NOT_STARTED && (
              <>
                <div className="bg-gray-800 p-4 rounded-lg shadow-lg">
                  <div className="text-center">
                    <span className="text-lg font-semibold text-white">
                      Status: {gameStatus.replace('_', ' ').toUpperCase()}
                    </span>
                  </div>
                </div>
                <WinProbability />
              </>
            )}
          </div>

          <div className="space-y-6">
            <GameControls />
            <ThinkingDisplay />
            <TimerDisplay />
            <MoveHistory />
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;