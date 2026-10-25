import { describe, expect, it } from 'vitest';
import { isGeneratedSamplePdf, SAMPLE_NOTICE, SAMPLE_PDF_PRODUCER } from './index';

/**
 * Judge demo mode accepts only the results generator's SAMPLE statements (docs/deploy/demo.md):
 * a PDF whose text layer prints the sample notice and whose producer is the generator's. A real
 * report, a photo or any other PDF is refused before anything is stored or read.
 */

const pdfString = (value: string) => value.replace(/[()\\]/g, (c) => `\\${c}`);
const bytes = (text: string) => Uint8Array.from(text, (c) => c.charCodeAt(0));

function pdf({ notice = SAMPLE_NOTICE, producer = SAMPLE_PDF_PRODUCER } = {}) {
  const content = `BT /F2 13 Tf 1 g 1 0 0 1 100 800 Tm (${pdfString(notice)}) Tj ET`;
  return bytes(
    `%PDF-1.4\n3 0 obj\n<< /Title (Results statement \\(sample\\)) /Producer (${pdfString(producer)}) >>\nendobj\n` +
      `7 0 obj\n<< /Length ${content.length} >>\nstream\n${content}\nendstream\nendobj\n%%EOF\n`,
  );
}

describe('isGeneratedSamplePdf', () => {
  it('accepts a PDF with the notice in its text layer and the generator as its producer', () => {
    expect(isGeneratedSamplePdf(pdf())).toBe(true);
  });

  it('refuses a PDF without the sample notice printed', () => {
    expect(isGeneratedSamplePdf(pdf({ notice: 'Statement of results' }))).toBe(false);
  });

  it('refuses a PDF made by anything else', () => {
    expect(isGeneratedSamplePdf(pdf({ producer: 'Microsoft Word' }))).toBe(false);
  });

  it('refuses the notice only in the metadata, not printed on the page', () => {
    const text = `%PDF-1.4\n<< /Subject (${SAMPLE_NOTICE}) /Producer (${pdfString(SAMPLE_PDF_PRODUCER)}) >>\n%%EOF\n`;
    expect(isGeneratedSamplePdf(bytes(text))).toBe(false);
  });

  it('refuses anything that is not a PDF (a photo)', () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, ...pdf()]);
    expect(isGeneratedSamplePdf(jpeg)).toBe(false);
  });
});
