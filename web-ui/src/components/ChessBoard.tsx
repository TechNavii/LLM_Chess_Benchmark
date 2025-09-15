import { useGameStore } from '../stores/gameStore';

const ChessBoard = () => {
  const { currentFen } = useGameStore();

  // Simple chess board representation
  // You can customize these symbols as needed
  const pieces: { [key: string]: string } = {
    'K': '♚', 'Q': '♛', 'R': '♖', 'B': '♗', 'N': '♘', 'P': '♙',
    'k': '♔', 'q': '♕', 'r': '♜', 'b': '♝', 'n': '♞', 'p': '♟'
  };

  const renderBoard = () => {

    const rows = currentFen.split(' ')[0].split('/');
    const board = [];

    for (let i = 0; i < 8; i++) {
      const row = rows[i];
      const squares = [];
      let fileIndex = 0;

      for (const char of row) {
        if (isNaN(parseInt(char))) {
          squares.push(char); // Store the original character for color detection
          fileIndex++;
        } else {
          const emptySquares = parseInt(char);
          for (let j = 0; j < emptySquares; j++) {
            squares.push('');
            fileIndex++;
          }
        }
      }

      board.push(squares);
    }

    return board;
  };

  const board = renderBoard();
  const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  const ranks = ['8', '7', '6', '5', '4', '3', '2', '1'];

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="bg-gray-800 p-6 rounded-lg shadow-2xl">
        <div className="bg-amber-100 p-4 rounded">
          {/* Files labels */}
          <div className="flex">
            <div className="w-8"></div>
            {files.map(file => (
              <div key={file} className="w-12 h-8 flex items-center justify-center text-sm font-bold">
                {file}
              </div>
            ))}
            <div className="w-8"></div>
          </div>

          {/* Board squares */}
          {board.map((row, rankIndex) => (
            <div key={rankIndex} className="flex">
              <div className="w-8 h-12 flex items-center justify-center text-sm font-bold">
                {ranks[rankIndex]}
              </div>
              {row.map((_, fileIndex) => {
                const isLight = (rankIndex + fileIndex) % 2 === 0;
                return (
                  <div
                    key={`${rankIndex}-${fileIndex}`}
                    className={`w-12 h-12 flex items-center justify-center text-3xl ${
                      isLight ? 'bg-amber-200' : 'bg-amber-700'
                    }`}
                  >
                    <span className={row[fileIndex] && row[fileIndex] === row[fileIndex].toLowerCase() ? 'text-gray-900 drop-shadow-md' : 'text-white drop-shadow-lg'}>
                      {row[fileIndex] ? pieces[row[fileIndex]] : ''}
                    </span>
                  </div>
                );
              })}
              <div className="w-8 h-12 flex items-center justify-center text-sm font-bold">
                {ranks[rankIndex]}
              </div>
            </div>
          ))}

          {/* Files labels */}
          <div className="flex">
            <div className="w-8"></div>
            {files.map(file => (
              <div key={file} className="w-12 h-8 flex items-center justify-center text-sm font-bold">
                {file}
              </div>
            ))}
            <div className="w-8"></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChessBoard;