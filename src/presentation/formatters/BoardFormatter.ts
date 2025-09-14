import chalk from 'chalk';
import { Chess } from 'chess.js';

export class BoardFormatter {
  static formatBoard(fen: string, lastMove?: { from: string; to: string }): string {
    const chess = new Chess(fen);
    const board = chess.board();
    let output = '\n';

    const pieceSymbols: { [key: string]: string } = {
      'K': '♔', 'Q': '♕', 'R': '♖', 'B': '♗', 'N': '♘', 'P': '♙',
      'k': '♚', 'q': '♛', 'r': '♜', 'b': '♝', 'n': '♞', 'p': '♟'
    };

    output += '   a b c d e f g h\n';
    output += '  ┌─────────────────┐\n';

    for (let rank = 0; rank < 8; rank++) {
      output += `${8 - rank} │ `;
      for (let file = 0; file < 8; file++) {
        const square = String.fromCharCode(97 + file) + (8 - rank);
        const piece = board[rank][file];
        const isLight = (rank + file) % 2 === 0;

        let squareStr = ' ';
        if (piece) {
          const symbol = pieceSymbols[`${piece.color === 'w' ? piece.type.toUpperCase() : piece.type}`];
          squareStr = piece.color === 'w' ? chalk.white(symbol) : chalk.gray(symbol);
        }

        if (lastMove && (square === lastMove.from || square === lastMove.to)) {
          squareStr = chalk.bgYellow(squareStr);
        } else if (isLight) {
          squareStr = chalk.bgWhite.black(` ${squareStr} `);
        } else {
          squareStr = chalk.bgBlackBright.white(` ${squareStr} `);
        }

        output += squareStr;
      }
      output += ` │ ${8 - rank}\n`;
    }

    output += '  └─────────────────┘\n';
    output += '   a b c d e f g h\n';

    return output;
  }

  static formatSimpleBoard(fen: string): string {
    const chess = new Chess(fen);
    const board = chess.board();
    let output = '\n';

    const pieceSymbols: { [key: string]: string } = {
      'k': 'k', 'q': 'q', 'r': 'r', 'b': 'b', 'n': 'n', 'p': 'p',
      'K': 'K', 'Q': 'Q', 'R': 'R', 'B': 'B', 'N': 'N', 'P': 'P'
    };

    output += '  a b c d e f g h\n';

    for (let rank = 0; rank < 8; rank++) {
      output += `${8 - rank} `;
      for (let file = 0; file < 8; file++) {
        const piece = board[rank][file];
        if (piece) {
          const symbol = pieceSymbols[piece.color === 'w' ? piece.type.toUpperCase() : piece.type];
          output += symbol + ' ';
        } else {
          output += '. ';
        }
      }
      output += `${8 - rank}\n`;
    }

    output += '  a b c d e f g h\n';

    return output;
  }
}