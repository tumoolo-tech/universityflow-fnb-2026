import { type FontName, WIN_ANSI_DECODE } from './pdf';

/**
 * Reads the text layer of a PDF this tool wrote: each shown string with its position, font,
 * size and angle. A test aid, so the statements can be checked as a text-reading report reader
 * would see them (what is printed, where, and that nothing else is there).
 */

export interface TextRun {
  readonly text: string;
  readonly x: number;
  readonly y: number;
  readonly font: FontName;
  readonly size: number;
  /** Degrees, anticlockwise; 0 for ordinary text. */
  readonly angle: number;
}

function latin1(bytes: Uint8Array): string {
  return new TextDecoder('latin1').decode(bytes);
}

/** The number of page objects in the file. */
export function pageCount(bytes: Uint8Array): number {
  return [...latin1(bytes).matchAll(/\/Type \/Page(?![s\w])/g)].length;
}

/** A literal string's characters, with escapes undone and WinAnsi mapped back to Unicode. */
function decodeLiteral(body: string): string {
  let out = '';
  for (let i = 0; i < body.length; i++) {
    const char = body.charAt(i);
    if (char !== '\\') {
      out += char;
      continue;
    }
    const octal = /^[0-7]{1,3}/.exec(body.slice(i + 1))?.[0];
    if (octal) {
      const code = Number.parseInt(octal, 8);
      out += WIN_ANSI_DECODE.get(code) ?? String.fromCodePoint(code);
      i += octal.length;
    } else {
      out += body.charAt(i + 1);
      i += 1;
    }
  }
  return out;
}

const TOKEN = /\((?:\\.|[^\\)])*\)|\/[A-Za-z0-9]+|-?\d*\.?\d+|[A-Za-z*]+/g;

export function readTextRuns(bytes: Uint8Array): TextRun[] {
  const runs: TextRun[] = [];
  for (const stream of latin1(bytes).matchAll(/stream\n([\s\S]*?)\nendstream/g)) {
    const operands: string[] = [];
    let font: FontName = 'regular';
    let size = 0;
    let matrix = [1, 0, 0, 1, 0, 0];
    for (const [token] of String(stream[1]).matchAll(TOKEN)) {
      if (!/^[A-Za-z*]+$/.test(token)) {
        operands.push(token);
        continue;
      }
      if (token === 'Tf') {
        font = operands[0] === '/F2' ? 'bold' : 'regular';
        size = Number(operands[1]);
      } else if (token === 'Tm') {
        matrix = operands.slice(-6).map(Number);
      } else if (token === 'Tj') {
        const [a, b, , , e, f] = matrix as [number, number, number, number, number, number];
        runs.push({
          text: decodeLiteral(String(operands.at(-1)).slice(1, -1)),
          x: e,
          y: f,
          font,
          size,
          angle: Math.round(((Math.atan2(b, a) * 180) / Math.PI) * 1000) / 1000,
        });
      }
      operands.length = 0;
    }
  }
  return runs;
}
