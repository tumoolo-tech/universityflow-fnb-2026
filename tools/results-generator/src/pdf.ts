/**
 * A minimal PDF writer: text in the two standard Helvetica fonts, filled rectangles and lines,
 * nothing else. Written here rather than added as a dependency (no PDF library was in the
 * lockfile, and nothing this small needs one). It can't embed an image or a font, so a statement
 * can't carry a logo, a seal, a signature or a barcode by accident.
 *
 * Content streams are uncompressed ASCII, so `pdf-text.ts` (and any text-layer reader) can read
 * back exactly what was printed.
 */

/** A4 in points, and the margin everything stays inside. */
export const PAGE = { width: 595.28, height: 841.89, margin: 48 } as const;

export type FontName = 'regular' | 'bold';

const BASE_FONTS: Readonly<Record<FontName, string>> = {
  regular: 'Helvetica',
  bold: 'Helvetica-Bold',
};
const RESOURCE: Readonly<Record<FontName, string>> = { regular: 'F1', bold: 'F2' };

export class UnencodableTextError extends Error {
  override readonly name = 'UnencodableTextError';
}

/** Unicode characters above Latin-1's printable range that WinAnsiEncoding can show. */
const WIN_ANSI_EXTRA: ReadonlyMap<string, number> = new Map([
  ['€', 0x80],
  ['…', 0x85],
  ['‘', 0x91],
  ['’', 0x92],
  ['“', 0x93],
  ['”', 0x94],
  ['•', 0x95],
  ['–', 0x96],
  ['—', 0x97],
]);
export const WIN_ANSI_DECODE: ReadonlyMap<number, string> = new Map(
  [...WIN_ANSI_EXTRA].map(([char, code]) => [code, char]),
);

/** The WinAnsiEncoding byte for each character of `value`; throws for one it can't show. */
export function encodeWinAnsi(value: string): number[] {
  return [...value].map((char) => {
    const code = char.codePointAt(0) ?? 0;
    if ((code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff)) return code;
    const extra = WIN_ANSI_EXTRA.get(char);
    if (extra !== undefined) return extra;
    throw new UnencodableTextError(`Can't print U+${code.toString(16).toUpperCase()}`);
  });
}

// Helvetica and Helvetica-Bold advance widths (thousandths of an em) for ASCII 32–126, from
// Adobe's AFM files. Other characters use a typical width: good enough for layout.
const REGULAR_WIDTHS = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556,
  556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667,
  611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667,
  667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500,
  222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
];
const BOLD_WIDTHS = [
  278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556,
  556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611, 975, 722, 722, 722, 722, 667,
  611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667,
  667, 611, 333, 278, 333, 584, 556, 333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556,
  278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584,
];
const OTHER_WIDTHS: ReadonlyMap<number, number> = new Map([
  [0x96, 556],
  [0x97, 1000],
  [0x85, 1000],
  [0x95, 350],
]);

/** The printed width of `value` in points. */
export function textWidth(value: string, font: FontName, size: number): number {
  const table = font === 'bold' ? BOLD_WIDTHS : REGULAR_WIDTHS;
  let units = 0;
  for (const code of encodeWinAnsi(value)) {
    units += table[code - 32] ?? OTHER_WIDTHS.get(code) ?? 556;
  }
  return (units * size) / 1000;
}

/** A PDF literal string: printable ASCII as is, brackets and backslashes escaped, the rest octal. */
function literal(value: string): string {
  let out = '(';
  for (const code of encodeWinAnsi(value)) {
    if (code === 0x28 || code === 0x29 || code === 0x5c) out += `\\${String.fromCharCode(code)}`;
    else if (code >= 0x20 && code <= 0x7e) out += String.fromCharCode(code);
    else out += `\\${code.toString(8).padStart(3, '0')}`;
  }
  return `${out})`;
}

/** Numbers as PDF writes them: at most three decimals, no exponent. */
function n(value: number): string {
  return String(Math.round(value * 1000) / 1000);
}

export interface TextOptions {
  readonly font?: FontName;
  readonly size?: number;
  /** 0 is black, 1 is white. */
  readonly gray?: number;
  readonly align?: 'left' | 'right' | 'center';
  /** Degrees, anticlockwise. */
  readonly angle?: number;
}

export class PdfPage {
  readonly #ops: string[] = [];

  text(x: number, y: number, value: string, options: TextOptions = {}): void {
    const { font = 'regular', size = 10, gray = 0, align = 'left', angle = 0 } = options;
    const width = textWidth(value, font, size);
    const shift = align === 'right' ? width : align === 'center' ? width / 2 : 0;
    const radians = (angle * Math.PI) / 180;
    // Six decimals, so the angle reads back true to a thousandth of a degree.
    const cos = Math.round(Math.cos(radians) * 1e6) / 1e6;
    const sin = Math.round(Math.sin(radians) * 1e6) / 1e6;
    const tx = x - shift * cos;
    const ty = y - shift * sin;
    this.#ops.push(
      `BT /${RESOURCE[font]} ${n(size)} Tf ${n(gray)} g ${cos} ${sin} ${-sin || 0} ${cos} ${n(tx)} ${n(ty)} Tm ${literal(value)} Tj ET`,
    );
  }

  rect(x: number, y: number, width: number, height: number, gray: number): void {
    this.#ops.push(`${n(gray)} g ${n(x)} ${n(y)} ${n(width)} ${n(height)} re f`);
  }

  line(x1: number, y1: number, x2: number, y2: number, gray = 0, width = 0.75): void {
    this.#ops.push(`${n(gray)} G ${n(width)} w ${n(x1)} ${n(y1)} m ${n(x2)} ${n(y2)} l S`);
  }

  get content(): string {
    return this.#ops.join('\n');
  }
}

export interface DocumentInfo {
  readonly title: string;
  readonly subject: string;
  readonly producer?: string;
}

/** The pages as a PDF file. No dates or IDs: the same pages always give the same bytes. */
export function renderPdf(pages: ReadonlyArray<PdfPage>, info: DocumentInfo): Uint8Array {
  const objects: string[] = [];
  const add = (body: string) => objects.push(body);

  const fontObj = (font: FontName, id: number) =>
    `${id} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /${BASE_FONTS[font]} /Encoding /WinAnsiEncoding >>\nendobj\n`;

  // 1 catalog, 2 pages, 3 info, 4–5 fonts, then a page and its content per page.
  const pageIds = pages.map((_, i) => 6 + i * 2);
  add('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
  add(
    `2 0 obj\n<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>\nendobj\n`,
  );
  const producer = info.producer ? ` /Producer ${literal(info.producer)}` : '';
  add(
    `3 0 obj\n<< /Title ${literal(info.title)} /Subject ${literal(info.subject)}${producer} >>\nendobj\n`,
  );
  add(fontObj('regular', 4));
  add(fontObj('bold', 5));
  pages.forEach((page, i) => {
    const id = pageIds[i] as number;
    const content = page.content;
    add(
      `${id} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${n(PAGE.width)} ${n(PAGE.height)}] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents ${id + 1} 0 R >>\nendobj\n`,
    );
    add(
      `${id + 1} 0 obj\n<< /Length ${content.length} >>\nstream\n${content}\nendstream\nendobj\n`,
    );
  });

  let out = '%PDF-1.4\n';
  const offsets: number[] = [];
  for (const body of objects) {
    offsets.push(out.length);
    out += body;
  }
  const xref = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) out += `${String(offset).padStart(10, '0')} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${xref}\n%%EOF\n`;

  // Everything above is ASCII (strings are escaped), so one byte per character.
  return Uint8Array.from(out, (char) => char.charCodeAt(0));
}
