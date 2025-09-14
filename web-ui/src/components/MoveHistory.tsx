import { useEffect, useRef } from 'react';
import { useGameStore } from '../stores/gameStore';

const MoveHistory = () => {
  const { moveHistory } = useGameStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [moveHistory]);

  const getPieceName = (notation: string) => {
    // Parse algebraic notation to get piece name
    if (!notation) return '';

    // Check for castling
    if (notation === 'O-O' || notation === 'O-O-O') {
      return 'Castles';
    }

    // Check first character for piece type
    const firstChar = notation[0];
    const pieces: { [key: string]: string } = {
      'K': 'King', 'Q': 'Queen', 'R': 'Rook',
      'B': 'Bishop', 'N': 'Knight'
    };

    // If first char is uppercase, it's a piece move
    if (pieces[firstChar]) {
      return pieces[firstChar];
    }

    // Otherwise it's a pawn move
    return 'Pawn';
  };

  const formatMove = (move: any) => {
    if (!move) return '';

    const notation = move.notation || move.san || '';

    // Check if it's a forfeit
    if (move.from === 'forfeit' || notation.includes('forfeits')) {
      return notation;
    }

    const pieceName = getPieceName(notation);

    // Check if it's a capture
    const isCapture = notation.includes('x');
    const action = isCapture ? 'takes' : 'to';

    // Extract destination square from notation
    const destMatch = notation.match(/[a-h][1-8]/);
    const destination = destMatch ? destMatch[0] : '';

    if (pieceName && destination) {
      return `${pieceName} ${action} ${destination}`;
    }

    return notation;
  };

  const formatMoves = () => {
    const moves: { moveNumber: number; white: string; black: string }[] = [];
    for (let i = 0; i < moveHistory.length; i += 2) {
      const moveNumber = Math.floor(i / 2) + 1;
      const whiteMove = formatMove(moveHistory[i]);
      const blackMove = formatMove(moveHistory[i + 1]);
      moves.push({ moveNumber, white: whiteMove, black: blackMove });
    }
    return moves;
  };

  return (
    <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-4 text-white">Move History</h2>

      <div
        ref={scrollRef}
        className="bg-gray-900 p-4 rounded h-48 overflow-y-auto font-mono text-sm text-gray-300"
      >
        {moveHistory.length === 0 ? (
          <div className="text-gray-500 italic">No moves yet...</div>
        ) : (
          <div className="space-y-1">
            {formatMoves().map((move, index) => {
              const isForfeitWhite = move.white.includes('forfeits');
              const isForfeitBlack = move.black && move.black.includes('forfeits');

              return (
                <div key={index} className="flex gap-2 border-b border-gray-700 pb-1">
                  <span className="text-yellow-400 font-bold w-8">{move.moveNumber}.</span>
                  <span className={`flex-1 ${isForfeitWhite ? 'text-red-400 italic' : 'text-white'}`}>
                    White: {move.white}
                  </span>
                  {move.black && (
                    <span className={`flex-1 ${isForfeitBlack ? 'text-red-400 italic' : 'text-gray-400'}`}>
                      Black: {move.black}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default MoveHistory;