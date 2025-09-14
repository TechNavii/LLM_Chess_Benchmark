import { useEffect, useState } from 'react';
import { useGameStore } from '../stores/gameStore';
import { GameStatus } from '../types/game';

const formatTime = (ms: number): string => {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

const TimerDisplay = () => {
  const { whiteTime, blackTime, currentPlayer, whitePlayer, blackPlayer, gameStatus } = useGameStore();
  const [localWhiteTime, setLocalWhiteTime] = useState(600000); // Start with 10 minutes
  const [localBlackTime, setLocalBlackTime] = useState(600000); // Start with 10 minutes

  // Update local times when server sends updates
  useEffect(() => {
    // Only update if we get a reasonable time value from server that is lower than current
    // This prevents timer from jumping up when receiving late updates
    if (whiteTime > 0 && whiteTime <= 3600000) { // Max 1 hour
      setLocalWhiteTime(prev => Math.min(prev, whiteTime));
    }
    if (blackTime > 0 && blackTime <= 3600000) {
      setLocalBlackTime(prev => Math.min(prev, blackTime));
    }
  }, [whiteTime, blackTime]);

  // Run local timer countdown
  useEffect(() => {
    if (gameStatus !== GameStatus.IN_PROGRESS) {
      return;
    }

    const interval = setInterval(() => {
      if (currentPlayer === 'white') {
        setLocalWhiteTime(prev => {
          const newTime = prev - 1000;
          return newTime >= 0 ? newTime : 0;
        });
      } else if (currentPlayer === 'black') {
        setLocalBlackTime(prev => {
          const newTime = prev - 1000;
          return newTime >= 0 ? newTime : 0;
        });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [currentPlayer, gameStatus]);

  return (
    <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-4 text-white">Timers</h2>

      <div className="space-y-4">
        <div className={`p-4 rounded ${currentPlayer === 'white' ? 'bg-blue-900' : 'bg-gray-700'}`}>
          <div className="flex justify-between items-center">
            <div>
              <div className="text-sm text-gray-300">White</div>
              <div className="text-xs text-gray-400 truncate">{whitePlayer?.modelName || 'Not set'}</div>
            </div>
            <div className="text-2xl font-mono font-bold text-white">
              {formatTime(localWhiteTime)}
            </div>
          </div>
        </div>

        <div className={`p-4 rounded ${currentPlayer === 'black' ? 'bg-blue-900' : 'bg-gray-700'}`}>
          <div className="flex justify-between items-center">
            <div>
              <div className="text-sm text-gray-300">Black</div>
              <div className="text-xs text-gray-400 truncate">{blackPlayer?.modelName || 'Not set'}</div>
            </div>
            <div className="text-2xl font-mono font-bold text-white">
              {formatTime(localBlackTime)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TimerDisplay;