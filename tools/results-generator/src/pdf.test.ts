import { describe, expect, it } from 'vitest';
import { PdfPage, renderPdf, textWidth, UnencodableTextError } from './pdf';
import { pageCount, readTextRuns } from './pdf-text';

const info = { title: 'Test', subject: 'Test subject' };

describe('the PDF writer and its text-layer reader', () => {
  it('round-trips text, including brackets, backslashes and an en dash', () => {
    const page = new PdfPage();
    page.text(50, 700, 'Bands (80–100%) \\ done', { size: 10 });
    page.text(50, 680, "Bachelor's", { font: 'bold', size: 12 });
    page.text(50, 660, 'Zoë', { size: 10 });
    const runs = readTextRuns(renderPdf([page], info));
    expect(runs.map((r) => [r.text, r.x, r.y, r.font, r.size, r.angle])).toEqual([
      ['Bands (80–100%) \\ done', 50, 700, 'regular', 10, 0],
      ["Bachelor's", 50, 680, 'bold', 12, 0],
      ['Zoë', 50, 660, 'regular', 10, 0],
    ]);
  });

  it('refuses text the standard fonts cannot show, rather than printing it wrongly', () => {
    const page = new PdfPage();
    expect(() => page.text(50, 700, 'tick ✓', { size: 10 })).toThrow(UnencodableTextError);
  });

  it('aligns right and centre by the text’s measured width', () => {
    const page = new PdfPage();
    page.text(300, 600, '42', { size: 10, align: 'right' });
    page.text(300, 580, '42', { size: 10, align: 'center' });
    const [right, centre] = readTextRuns(renderPdf([page], info));
    expect(textWidth('42', 'regular', 10)).toBeCloseTo(11.12, 2);
    expect(right?.x).toBeCloseTo(300 - 11.12, 2);
    expect(centre?.x).toBeCloseTo(300 - 5.56, 2);
  });

  it('reads back the angle of rotated text', () => {
    const page = new PdfPage();
    page.text(200, 300, 'SAMPLE', { size: 40, angle: 30 });
    const [run] = readTextRuns(renderPdf([page], info));
    expect(run?.angle).toBeCloseTo(30, 3);
  });

  it('counts pages', () => {
    expect(pageCount(renderPdf([new PdfPage()], info))).toBe(1);
    expect(pageCount(renderPdf([new PdfPage(), new PdfPage()], info))).toBe(2);
  });

  it('starts as a PDF and ends with an end-of-file marker', () => {
    const bytes = renderPdf([new PdfPage()], info);
    const text = new TextDecoder('latin1').decode(bytes);
    expect(text.startsWith('%PDF-1.4')).toBe(true);
    expect(text.trimEnd().endsWith('%%EOF')).toBe(true);
    // The cross-reference table points at each object.
    const xref = Number(/startxref\s+(\d+)/.exec(text)?.[1]);
    expect(text.slice(xref, xref + 4)).toBe('xref');
    for (const m of text.matchAll(/^(\d{10}) 00000 n/gm)) {
      expect(text.slice(Number(m[1])).match(/^\d+ 0 obj/)).not.toBeNull();
    }
  });
});
