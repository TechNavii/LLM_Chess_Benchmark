import React, { useEffect, useState } from 'react';

interface InvalidMoveData {
  player: 'white' | 'black';
  move: string;
  attempt: number;
  message: string;
}

interface InvalidMoveAlertProps {
  invalidMove: InvalidMoveData | null;
}

export const InvalidMoveAlert: React.FC<InvalidMoveAlertProps> = ({ invalidMove }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (invalidMove) {
      setVisible(true);
      const timer = setTimeout(() => setVisible(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [invalidMove]);

  if (!visible || !invalidMove) return null;

  const bgColor = invalidMove.player === 'white'
    ? 'bg-yellow-100 border-yellow-500'
    : 'bg-yellow-100 border-yellow-600';

  return (
    <div className={`fixed top-4 left-1/2 transform -translate-x-1/2 z-50 animate-fade-in`}>
      <div className={`${bgColor} border-2 rounded-lg p-4 shadow-lg max-w-md`}>
        <div className="flex items-center space-x-2">
          <span className="text-2xl">⚠️</span>
          <div>
            <div className="font-semibold text-gray-800">
              Invalid Move Attempted
            </div>
            <div className="text-sm text-gray-700 mt-1">
              {invalidMove.player === 'white' ? 'White' : 'Black'} tried:
              <span className="font-mono font-bold ml-1">{invalidMove.move}</span>
            </div>
            <div className="text-xs text-gray-600 mt-1">
              Attempt {invalidMove.attempt}/3 for this move
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};