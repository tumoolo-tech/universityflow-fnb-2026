import {
  type ExtractedModuleOutline,
  SAMPLE_OUTLINE_YEARS,
  type SampleOutlineYear,
  sampleModuleOutline,
} from '@universityflow/documents';
import { type FontName, PAGE, PdfPage, renderPdf, textWidth } from './pdf';
import { OUTLINE, SAMPLE_NOTICE } from './strings';

/**
 * A SAMPLE module outline (Phase 6b, docs/plans/phase-6-proposal.md), on one page: exactly what
 * packages/documents `sampleModuleOutline(year)` holds (a made-up module, a made-up lecturer with
 * a made-up work email on a reserved example domain, a made-up book), plus what a real outline
 * often prints and the reader must never keep: a class list of made-up students. Every page says
 * SAMPLE at the top, at the bottom and across the middle, and it names the generator as its
 * producer, so judge demo mode accepts it (packages/documents isGeneratedSamplePdf).
 *
 * The web app can't depend on a tool, so `demo-outlines-cli.ts` writes the three outlines, base64,
 * into apps/web/lib/server/demo/sample-outlines.ts; module-outline.test.ts keeps it current.
 */

const LEFT = PAGE.margin;
const RIGHT = PAGE.width - PAGE.margin;
const WEIGHT_RIGHT = 400;
const SUBMIN_X = 430;

/** Words broken into lines no wider than `width` points. */
function wrap(text: string, width: number, font: FontName, size: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    const next = line === '' ? word : `${line} ${word}`;
    if (line !== '' && textWidth(next, font, size) > width) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line !== '') lines.push(line);
  return lines;
}

export function moduleOutlinePdf(outline: ExtractedModuleOutline): Uint8Array {
  const page = new PdfPage();
  page.text(PAGE.width / 2, PAGE.height / 2, OUTLINE.watermark, {
    font: 'bold',
    size: 110,
    gray: 0.9,
    align: 'center',
    angle: 35,
  });
  const bandTop = PAGE.height - PAGE.margin / 2;
  page.rect(LEFT, bandTop - 26, RIGHT - LEFT, 26, 0.15);
  page.text(PAGE.width / 2, bandTop - 18, SAMPLE_NOTICE, {
    font: 'bold',
    size: 13,
    gray: 1,
    align: 'center',
  });

  let y = bandTop - 56;
  page.text(LEFT, y, OUTLINE.title, { font: 'bold', size: 16 });
  y -= 24;
  // The code on its own, so the demo's stand-in reader can tell which year's sample it is.
  page.text(LEFT, y, outline.moduleCodeAsPrinted ?? '', { font: 'bold', size: 12 });
  page.text(LEFT + 90, y, outline.moduleNameAsPrinted ?? '', { font: 'bold', size: 12 });
  y -= 16;
  page.text(
    LEFT,
    y,
    OUTLINE.yearAndTerm(outline.academicYearAsPrinted ?? 0, outline.termAsPrinted ?? ''),
    {
      size: 10,
      gray: 0.35,
    },
  );

  const heading = (words: string) => {
    y -= 24;
    page.text(LEFT, y, words, { font: 'bold', size: 11 });
    page.line(LEFT, y - 5, RIGHT, y - 5, 0.6);
    y -= 18;
  };
  const paragraph = (words: string, size = 9) => {
    for (const line of wrap(words, RIGHT - LEFT, 'regular', size)) {
      page.text(LEFT, y, line, { size });
      y -= size + 3;
    }
  };

  heading(OUTLINE.assessment);
  page.text(LEFT, y, OUTLINE.component, { size: 9, gray: 0.35 });
  page.text(WEIGHT_RIGHT, y, OUTLINE.weight, { size: 9, gray: 0.35, align: 'right' });
  page.text(SUBMIN_X, y, OUTLINE.subminimum, { size: 9, gray: 0.35 });
  y -= 15;
  for (const c of outline.components) {
    page.text(LEFT, y, c.name, { size: 10 });
    page.text(WEIGHT_RIGHT, y, c.weightAsPrinted ?? '', { size: 10, align: 'right' });
    page.text(SUBMIN_X, y, c.subminimumAsPrinted ?? '', { size: 10 });
    y -= 14;
  }
  y -= 4;
  paragraph(
    OUTLINE.dp(outline.dpRequirement.percentAsPrinted ?? '', outline.dpRequirement.quote ?? ''),
  );
  paragraph(OUTLINE.examSubminimum(outline.examSubminimumAsPrinted ?? ''));
  paragraph(outline.supplementaryQuote ?? '');

  heading(OUTLINE.dates);
  for (const d of outline.dates) {
    page.text(LEFT, y, d.whatAsPrinted, { size: 10 });
    page.text(LEFT + 200, y, d.dateAsPrinted ?? '', { size: 10 });
    y -= 14;
  }

  heading(OUTLINE.books);
  for (const b of outline.books) {
    paragraph(OUTLINE.book(b.role === 'prescribed', b.title, b.authors, b.edition, b.isbn), 9.5);
  }

  heading(OUTLINE.people);
  for (const p of outline.people) {
    paragraph(`${p.name}, ${p.roleAsPrinted ?? ''}`, 10);
    paragraph(OUTLINE.contact(p.email ?? '', p.office ?? '', p.consultationTimes ?? ''));
  }

  // What the reader must never keep (its schema has no place for it).
  heading(OUTLINE.classList);
  paragraph(OUTLINE.classListNames.join(', '));

  page.line(LEFT, PAGE.margin + 14, RIGHT, PAGE.margin + 14, 0.6);
  page.text(LEFT, PAGE.margin, OUTLINE.footer, { size: 7.5, gray: 0.25 });
  if (y < PAGE.margin + 30) throw new RangeError('The sample outline no longer fits on one page');

  return renderPdf([page], {
    title: `${OUTLINE.title}: ${outline.moduleCodeAsPrinted ?? ''}`,
    subject: SAMPLE_NOTICE,
    producer: OUTLINE.producer,
  });
}

/** The judge demo's sample outline for a year of study. */
export function demoOutlinePdf(year: SampleOutlineYear): Uint8Array {
  return moduleOutlinePdf(sampleModuleOutline(year));
}

/** The web module's source, exactly. */
export function demoOutlinesSource(): string {
  const entries = SAMPLE_OUTLINE_YEARS.map((year) => {
    const base64 = Buffer.from(demoOutlinePdf(year)).toString('base64');
    return `  ${year}: '${base64}',\n`;
  }).join('');
  return `// Written by tools/results-generator (pnpm --filter @universityflow/results-generator demo-outlines).
// Do not edit: tools/results-generator/src/module-outline.test.ts fails if this differs.
import 'server-only';

/**
 * The results generator's SAMPLE module outlines that judge demo mode offers as "Use a sample
 * module outline" (Phase 6b): one per year of study of the demo's university learners, each for
 * the first module on their made-up registration. A made-up module, lecturer and book; every page
 * says SAMPLE. Base64 PDFs, by year of study.
 */
export const SAMPLE_OUTLINES = {
${entries}} as const;

export type SampleOutlineYear = keyof typeof SAMPLE_OUTLINES;
`;
}
