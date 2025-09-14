import { useGameStore } from '../stores/gameStore';

const ThinkingDisplay = () => {
  const { isThinking, thinkingText, currentPlayer } = useGameStore();

  if (!isThinking) {
    return null;
  }

  return (
    <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-4 text-white">AI Thinking</h2>

      <div className="bg-gray-900 p-4 rounded">
        <div className="flex items-center space-x-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          <div>
            <div className="text-sm text-gray-300">
              {currentPlayer === 'white' ? 'White' : 'Black'} is thinking...
            </div>
            {thinkingText && (
              <div className="text-xs text-gray-500 mt-1">{thinkingText}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ThinkingDisplay;