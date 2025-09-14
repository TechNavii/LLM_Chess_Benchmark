import { useGameStore } from '../stores/gameStore';
import { GameStatus } from '../types/game';

const WinProbability = () => {
  const { currentFen, gameStatus, moveHistory } = useGameStore();

  // Piece values for material calculation
  const pieceValues: { [key: string]: number } = {
    'p': 1, 'n': 3, 'b': 3, 'r': 5, 'q': 9, 'k': 0,
    'P': 1, 'N': 3, 'B': 3, 'R': 5, 'Q': 9, 'K': 0
  };

  // Parse FEN to analyze board position
  const analyzeBoardPosition = () => {
    if (!currentFen) return { whiteScore: 50, blackScore: 50 };

    const fenParts = currentFen.split(' ');
    const board = fenParts[0];
    const activeColor = fenParts[1];
    const castlingRights = fenParts[2] || '-';
    const moveCount = parseInt(fenParts[5] || '1');

    // Count material for both sides
    let whiteMaterial = 0;
    let blackMaterial = 0;
    let whitePieces: { [key: string]: number } = { P: 0, N: 0, B: 0, R: 0, Q: 0, K: 0 };
    let blackPieces: { [key: string]: number } = { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 };

    // Parse board and count pieces
    const rows = board.split('/');
    for (let rank = 0; rank < rows.length; rank++) {
      let file = 0;
      for (const char of rows[rank]) {
        if (isNaN(parseInt(char))) {
          if (char.toUpperCase() === char) {
            whiteMaterial += pieceValues[char];
            whitePieces[char]++;
          } else {
            blackMaterial += pieceValues[char];
            blackPieces[char]++;
          }
          file++;
        } else {
          file += parseInt(char);
        }
      }
    }

    // Calculate positional bonuses
    let whitePositionalBonus = 0;
    let blackPositionalBonus = 0;

    // Center control bonus (analyze e4, d4, e5, d5 squares)
    const centerSquares = ['e4', 'd4', 'e5', 'd5'];
    let centerControlWhite = 0;
    let centerControlBlack = 0;

    // Parse board for center control
    rows.forEach((row, rankIndex) => {
      let fileIndex = 0;
      for (const char of row) {
        if (isNaN(parseInt(char))) {
          const file = String.fromCharCode(97 + fileIndex); // Convert to file letter
          const rank = 8 - rankIndex;
          const square = file + rank;

          if (centerSquares.includes(square)) {
            if (char.toUpperCase() === char) {
              centerControlWhite += 0.5;
            } else {
              centerControlBlack += 0.5;
            }
          }
          fileIndex++;
        } else {
          fileIndex += parseInt(char);
        }
      }
    });

    whitePositionalBonus += centerControlWhite;
    blackPositionalBonus += centerControlBlack;

    // Castling rights bonus
    if (castlingRights.includes('K') || castlingRights.includes('Q')) {
      whitePositionalBonus += 0.5;
    }
    if (castlingRights.includes('k') || castlingRights.includes('q')) {
      blackPositionalBonus += 0.5;
    }

    // Development bonus in opening (moves < 20)
    if (moveCount < 20) {
      // Knights and bishops developed
      whitePositionalBonus += (whitePieces['N'] + whitePieces['B']) * 0.2;
      blackPositionalBonus += (blackPieces['n'] + blackPieces['b']) * 0.2;
    }

    // Pawn structure bonus (pawns in center files)
    const pawnStructureBonus = analyzePawnStructure(rows);
    whitePositionalBonus += pawnStructureBonus.white;
    blackPositionalBonus += pawnStructureBonus.black;

    // Calculate total scores
    const whiteTotal = whiteMaterial + whitePositionalBonus;
    const blackTotal = blackMaterial + blackPositionalBonus;

    // Convert to win probability percentage
    const total = whiteTotal + blackTotal;
    if (total === 0) return { whiteScore: 50, blackScore: 50 };

    let whiteProb = (whiteTotal / total) * 100;
    let blackProb = (blackTotal / total) * 100;

    // Adjust based on whose turn it is (small tempo bonus)
    if (activeColor === 'w') {
      whiteProb += 1;
      blackProb -= 1;
    } else {
      blackProb += 1;
      whiteProb -= 1;
    }

    // Ensure probabilities are within 0-100 range
    whiteProb = Math.max(0, Math.min(100, whiteProb));
    blackProb = Math.max(0, Math.min(100, blackProb));

    // Normalize to ensure they sum to 100
    const sum = whiteProb + blackProb;
    whiteProb = (whiteProb / sum) * 100;
    blackProb = (blackProb / sum) * 100;

    return {
      whiteScore: Math.round(whiteProb * 10) / 10,
      blackScore: Math.round(blackProb * 10) / 10
    };
  };

  // Analyze pawn structure
  const analyzePawnStructure = (rows: string[]) => {
    let whiteBonus = 0;
    let blackBonus = 0;

    rows.forEach((row, rankIndex) => {
      let fileIndex = 0;
      for (const char of row) {
        if (char === 'P') {
          // White pawns in center files get bonus
          if (fileIndex >= 2 && fileIndex <= 5) {
            whiteBonus += 0.1;
          }
          // Advanced pawns get bonus
          if (rankIndex <= 3) {
            whiteBonus += 0.1;
          }
        } else if (char === 'p') {
          // Black pawns in center files get bonus
          if (fileIndex >= 2 && fileIndex <= 5) {
            blackBonus += 0.1;
          }
          // Advanced pawns get bonus
          if (rankIndex >= 4) {
            blackBonus += 0.1;
          }
        }

        if (isNaN(parseInt(char))) {
          fileIndex++;
        } else {
          fileIndex += parseInt(char);
        }
      }
    });

    return { white: whiteBonus, black: blackBonus };
  };

  // Handle special game states
  if (gameStatus === GameStatus.CHECKMATE) {
    const lastMove = moveHistory[moveHistory.length - 1];
    const winner = lastMove && (moveHistory.length % 2 === 1) ? 'white' : 'black';
    return (
      <div className="bg-gray-800 p-4 rounded-lg shadow-lg">
        <h3 className="text-lg font-semibold text-white mb-3">Win Probability</h3>
        <div className="space-y-2">
          <div className="text-center text-yellow-400 font-bold">
            {winner === 'white' ? 'White Wins!' : 'Black Wins!'}
          </div>
        </div>
      </div>
    );
  }

  if (gameStatus === GameStatus.DRAW || gameStatus === GameStatus.STALEMATE) {
    return (
      <div className="bg-gray-800 p-4 rounded-lg shadow-lg">
        <h3 className="text-lg font-semibold text-white mb-3">Win Probability</h3>
        <div className="text-center text-gray-400 font-bold">Draw</div>
      </div>
    );
  }

  const { whiteScore, blackScore } = analyzeBoardPosition();

  return (
    <div className="bg-gray-800 p-4 rounded-lg shadow-lg">
      <h3 className="text-lg font-semibold text-white mb-3">Win Probability</h3>

      <div className="space-y-3">
        {/* White probability */}
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-300">White</span>
            <span className="text-white font-bold">{whiteScore}%</span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-gray-100 to-white transition-all duration-500"
              style={{ width: `${whiteScore}%` }}
            />
          </div>
        </div>

        {/* Black probability */}
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-300">Black</span>
            <span className="text-white font-bold">{blackScore}%</span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-gray-800 to-gray-600 transition-all duration-500"
              style={{ width: `${blackScore}%` }}
            />
          </div>
        </div>

        {/* Visual bar showing balance */}
        <div className="mt-4">
          <div className="w-full bg-gray-700 rounded-full h-6 overflow-hidden flex">
            <div
              className="bg-gradient-to-r from-gray-100 to-white transition-all duration-500 border-r-2 border-gray-900"
              style={{ width: `${whiteScore}%` }}
            />
            <div
              className="bg-gradient-to-r from-gray-600 to-gray-800 transition-all duration-500"
              style={{ width: `${blackScore}%` }}
            />
          </div>
        </div>

        {/* Material and position details */}
        <div className="text-xs text-gray-400 text-center mt-2">
          Based on material, position, and game phase
        </div>
      </div>
    </div>
  );
};

export default WinProbability;