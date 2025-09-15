import { useState, useEffect } from 'react';
import { useGameStore } from '../stores/gameStore';
import socketService from '../services/socketService';
import type { GameConfiguration } from '../types/game';
import { GameStatus } from '../types/game';

const GameControls = () => {
  const { gameStatus, gameResult, resetGame } = useGameStore();

  // Load saved preferences from localStorage
  const [whiteModel, setWhiteModel] = useState(() =>
    localStorage.getItem('whiteModel') || 'openai/gpt-4o-mini'
  );
  const [blackModel, setBlackModel] = useState(() =>
    localStorage.getItem('blackModel') || 'anthropic/claude-3-haiku'
  );
  const [timeMinutes, setTimeMinutes] = useState(() =>
    parseInt(localStorage.getItem('timeMinutes') || '10')
  );
  const [increment, setIncrement] = useState(() =>
    parseInt(localStorage.getItem('increment') || '5')
  );
  const [apiKeyStatus, setApiKeyStatus] = useState<'checking' | 'found' | 'missing'>('checking');

  // Save preferences when they change
  useEffect(() => {
    localStorage.setItem('whiteModel', whiteModel);
  }, [whiteModel]);

  useEffect(() => {
    localStorage.setItem('blackModel', blackModel);
  }, [blackModel]);

  useEffect(() => {
    localStorage.setItem('timeMinutes', timeMinutes.toString());
  }, [timeMinutes]);

  useEffect(() => {
    localStorage.setItem('increment', increment.toString());
  }, [increment]);

  useEffect(() => {
    // Check if API key exists on backend
    fetch('/api/config')
      .then(res => res.json())
      .then(data => {
        setApiKeyStatus(data.hasApiKey ? 'found' : 'missing');
      })
      .catch(() => setApiKeyStatus('missing'));
  }, []);

  const handleStartGame = () => {
    if (apiKeyStatus !== 'found') {
      alert('Please set your OpenRouter API key in the .env file on the server');
      return;
    }

    // Update store with current timer settings before starting
    const { updateTime } = useGameStore.getState();
    const timeMs = timeMinutes * 60 * 1000;
    updateTime(timeMs, timeMs);

    const config: GameConfiguration = {
      whitePlayer: {
        id: 'white-player',
        modelName: whiteModel,
        initialTimeMs: timeMinutes * 60 * 1000,
        incrementMs: increment * 1000,
      },
      blackPlayer: {
        id: 'black-player',
        modelName: blackModel,
        initialTimeMs: timeMinutes * 60 * 1000,
        incrementMs: increment * 1000,
      },
      timerType: 'fischer',
      outputFormat: 'pgn',
      saveGame: true
    };

    socketService.startGame(config);
  };

  const handlePause = () => {
    socketService.pauseGame();
  };

  const handleResume = () => {
    socketService.resumeGame();
  };

  const handleReset = () => {
    socketService.resetGame();
    resetGame();
    // Reset timers to selected values when resetting the game
    const { updateTime } = useGameStore.getState();
    const timeMs = timeMinutes * 60 * 1000;
    updateTime(timeMs, timeMs);
  };

  return (
    <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-4 text-white">Game Controls</h2>

      {gameStatus === GameStatus.NOT_STARTED && (
        <div className="space-y-4">
          {apiKeyStatus === 'checking' && (
            <div className="text-yellow-400 text-sm">Checking API key configuration...</div>
          )}
          {apiKeyStatus === 'missing' && (
            <div className="bg-red-900 p-3 rounded text-red-200 text-sm">
              ⚠️ OpenRouter API key not found. Please set OPENROUTER_API_KEY in your .env file.
            </div>
          )}
          {apiKeyStatus === 'found' && (
            <div className="bg-green-900 p-3 rounded text-green-200 text-sm">
              ✓ API key configured
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              White Player Model
            </label>
            <input
              type="text"
              value={whiteModel}
              onChange={(e) => setWhiteModel(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., openai/gpt-4o-mini, anthropic/claude-3-haiku"
            />
            <div className="text-xs text-gray-400 mt-1">
              Examples: openai/gpt-4o, anthropic/claude-3-sonnet, deepseek/deepseek-chat-v3.1:free
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Black Player Model
            </label>
            <input
              type="text"
              value={blackModel}
              onChange={(e) => setBlackModel(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., google/gemini-pro, meta-llama/llama-3-70b"
            />
            <div className="text-xs text-gray-400 mt-1">
              Examples: google/gemini-pro, z-ai/glm-4.5-air:free, openai/gpt-4o-mini
            </div>
          </div>

          <div className="border border-gray-600 rounded-lg p-3 bg-gray-750">
            <div className="text-sm font-medium text-gray-300 mb-2 flex justify-between items-center">
              <span>⏱️ Timer Settings</span>
              <span className="text-xs text-blue-400">{timeMinutes} min + {increment} sec</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Time (minutes)
                </label>
                <input
                  type="number"
                  value={timeMinutes}
                  onChange={(e) => setTimeMinutes(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-gray-700 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="1"
                  max="60"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Increment (seconds)
                </label>
                <input
                  type="number"
                  value={increment}
                  onChange={(e) => setIncrement(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-gray-700 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="0"
                  max="30"
                />
              </div>
            </div>
          </div>

          <button
            onClick={handleStartGame}
            className="w-full py-2 px-4 bg-green-600 hover:bg-green-700 text-white font-bold rounded-md transition duration-200"
          >
            Start Game
          </button>

          {/* Timer Presets */}
          <div className="mt-3 space-y-1">
            <div className="text-xs text-gray-400 mb-1">Quick Timer Presets:</div>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => {
                  setTimeMinutes(3);
                  setIncrement(2);
                }}
                className="py-1 px-2 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded transition"
              >
                Blitz 3+2
              </button>
              <button
                onClick={() => {
                  setTimeMinutes(5);
                  setIncrement(5);
                }}
                className="py-1 px-2 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded transition"
              >
                Rapid 5+5
              </button>
              <button
                onClick={() => {
                  setTimeMinutes(10);
                  setIncrement(5);
                }}
                className="py-1 px-2 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded transition"
              >
                Classic 10+5
              </button>
            </div>
          </div>
        </div>
      )}

      {gameStatus === GameStatus.IN_PROGRESS && (
        <div className="space-y-2">
          <button
            onClick={handlePause}
            className="w-full py-2 px-4 bg-yellow-600 hover:bg-yellow-700 text-white font-bold rounded-md transition duration-200"
          >
            Pause Game
          </button>
          <button
            onClick={handleReset}
            className="w-full py-2 px-4 bg-red-600 hover:bg-red-700 text-white font-bold rounded-md transition duration-200"
          >
            Reset Game
          </button>
        </div>
      )}

      {gameStatus === GameStatus.PAUSED && (
        <div className="space-y-2">
          <button
            onClick={handleResume}
            className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-md transition duration-200"
          >
            Resume Game
          </button>
          <button
            onClick={handleReset}
            className="w-full py-2 px-4 bg-red-600 hover:bg-red-700 text-white font-bold rounded-md transition duration-200"
          >
            Reset Game
          </button>
        </div>
      )}

      {(gameStatus === GameStatus.CHECKMATE ||
        gameStatus === GameStatus.STALEMATE ||
        gameStatus === GameStatus.DRAW ||
        gameStatus === GameStatus.TIMEOUT ||
        gameStatus === GameStatus.FORFEIT) && (
        <div className="space-y-2">
          <div className="text-center text-xl font-bold text-yellow-400 mb-2">
            Game Over
          </div>
          {gameStatus === GameStatus.FORFEIT && gameResult && (
            <div className="text-center text-lg text-white mb-2">
              {gameResult.winner === 'white' ? 'White' : 'Black'} wins by forfeit!
              <div className="text-sm text-gray-400 mt-1">
                {gameResult.reason}
              </div>
            </div>
          )}
          {gameStatus === GameStatus.CHECKMATE && gameResult && (
            <div className="text-center text-lg text-white mb-2">
              {gameResult.winner === 'white' ? 'White' : 'Black'} wins by checkmate!
            </div>
          )}
          {gameStatus === GameStatus.TIMEOUT && gameResult && (
            <div className="text-center text-lg text-white mb-2">
              {gameResult.winner === 'white' ? 'White' : 'Black'} wins on time!
            </div>
          )}
          {gameStatus === GameStatus.DRAW && (
            <div className="text-center text-lg text-white mb-2">
              Draw
              {gameResult?.reason && (
                <div className="text-sm text-gray-400 mt-1">
                  {gameResult.reason}
                </div>
              )}
            </div>
          )}
          {gameStatus === GameStatus.STALEMATE && (
            <div className="text-center text-lg text-white mb-2">
              Stalemate - Draw
              {gameResult?.reason && (
                <div className="text-sm text-gray-400 mt-1">
                  {gameResult.reason}
                </div>
              )}
            </div>
          )}
          <button
            onClick={handleReset}
            className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-md transition duration-200"
          >
            New Game
          </button>

          {/* Quick Rematch with Same Settings */}
          <button
            onClick={() => {
              handleReset();
              // Keep the same models and time settings
              setTimeout(() => {
                const { updateTime } = useGameStore.getState();
                const timeMs = timeMinutes * 60 * 1000;
                updateTime(timeMs, timeMs);
                handleStartGame();
              }, 100);
            }}
            className="w-full py-2 px-4 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-md transition duration-200 mt-2"
          >
            Quick Rematch (Same Settings)
          </button>
        </div>
      )}
    </div>
  );
};

export default GameControls;