import { SAMPLE_NOTICE } from './results-source';

/**
 * The results generator's SAMPLE statements (tools/results-generator), recognised from their
 * bytes, for judge demo mode (docs/deploy/demo.md), which accepts no other upload.
 *
 * The generator writes uncompressed content streams, so the notice it prints at the top of
 * every page is readable as a PDF string inside a stream, and it names itself as the producer.
 * This is a filter against a real document by mistake, not proof against a forgery: anyone can
 * write those bytes, and the demo holds made-up learners only.
 */

/** The `/Producer` of every statement the generator writes. */
export const SAMPLE_PDF_PRODUCER = 'UniversityFlow results generator (sample documents only)';

/** A PDF literal string as the generator writes it (brackets and backslashes escaped). */
function literal(value: string): string {
  return `(${value.replace(/[()\\]/g, (c) => `\\${c}`)})`;
}

export function isGeneratedSamplePdf(bytes: Uint8Array): boolean {
  const text = new TextDecoder('latin1').decode(bytes);
  if (!text.startsWith('%PDF-')) return false;
  if (!text.includes(`/Producer ${literal(SAMPLE_PDF_PRODUCER)}`)) return false;
  const notice = `${literal(SAMPLE_NOTICE)} Tj`;
  for (const stream of text.matchAll(/stream\n([\s\S]*?)\nendstream/g)) {
    if (String(stream[1]).includes(notice)) return true;
  }
  return false;
}
