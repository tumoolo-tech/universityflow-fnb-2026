import { type AchievementLevel, LEVEL_FLOOR } from '@universityflow/admissions';
import type { SampleLearner, SampleReport } from '@universityflow/documents';
import { PAGE, PdfPage, renderPdf, textWidth } from './pdf';
import {
  LEVEL_WORDS,
  PASS_FINAL,
  PASS_PROJECTED,
  reportLabel,
  SAMPLE_NOTICE,
  STATEMENT,
  type TERM_NAMES,
} from './strings';

/**
 * One results statement, always on ONE page (planning.md §18.7): a header (learner, exam number,
 * school, year, report), one table (Subject · % · Achievement level) closed by a row of
 * asterisks, the pass statement, and a key to the levels. Extra subjects add rows, never a page:
 * a statement that wouldn't fit is refused. Every page says SAMPLE at the top, at the bottom and
 * across the middle, and nothing on it imitates an issuer's insignia.
 */

const LEFT = PAGE.margin;
const RIGHT = PAGE.width - PAGE.margin;
const PERCENT_RIGHT = 400;
const LEVEL_X = 430;
const ROW = 18;
const LEVELS: ReadonlyArray<AchievementLevel> = [7, 6, 5, 4, 3, 2, 1];

/** The most subject rows one page holds with room for the pass and the key. */
export const MAX_ROWS = 12;

function periodParts(period: SampleReport['period']) {
  const [, grade, term] = /^grade-(1[0-2])-(june|september|final)$/.exec(period) ?? [];
  if (!grade || !term) throw new RangeError(`Unknown report period: ${period}`);
  return { grade: Number(grade) as 10 | 11 | 12, term: term as keyof typeof TERM_NAMES };
}

function band(level: AchievementLevel): string {
  const high = level === 7 ? 100 : LEVEL_FLOOR[(level + 1) as AchievementLevel] - 1;
  return `${LEVEL_FLOOR[level]}–${high}%`;
}

/** Repeats `*` to fill `width` points at `size`. */
function asterisks(width: number, size: number): string {
  const count = Math.max(1, Math.floor(width / textWidth('*', 'regular', size)));
  return '*'.repeat(count);
}

export function statementPdf(learner: SampleLearner, report: SampleReport): Uint8Array {
  if (report.subjects.length > MAX_ROWS) {
    throw new RangeError(
      `A statement holds at most ${MAX_ROWS} subjects on one page, not ${report.subjects.length}`,
    );
  }
  const { grade, term } = periodParts(report.period);
  const page = new PdfPage();

  // Behind everything: SAMPLE, huge and pale, across the middle.
  page.text(PAGE.width / 2, PAGE.height / 2, STATEMENT.watermark, {
    font: 'bold',
    size: 110,
    gray: 0.9,
    align: 'center',
    angle: 35,
  });

  // Top: the sample notice on a dark band.
  const bandTop = PAGE.height - PAGE.margin / 2;
  page.rect(LEFT, bandTop - 26, RIGHT - LEFT, 26, 0.15);
  page.text(PAGE.width / 2, bandTop - 18, SAMPLE_NOTICE, {
    font: 'bold',
    size: 13,
    gray: 1,
    align: 'center',
  });

  let y = bandTop - 60;
  page.text(LEFT, y, STATEMENT.title, { font: 'bold', size: 16 });

  // Header.
  y -= 28;
  const fields: ReadonlyArray<readonly [string, string]> = [
    [STATEMENT.header.learner, learner.displayName],
    [STATEMENT.header.examNumber, learner.examNumber],
    [STATEMENT.header.school, learner.school],
    [STATEMENT.header.year, String(report.academicYear)],
    [STATEMENT.header.report, reportLabel(grade, term)],
  ];
  for (const [label, value] of fields) {
    page.text(LEFT, y, label, { size: 9, gray: 0.35 });
    page.text(LEFT + 100, y, value, { font: 'bold', size: 10 });
    y -= 16;
  }

  // The table.
  y -= 10;
  page.line(LEFT, y + 12, RIGHT, y + 12, 0.6);
  page.text(LEFT, y, STATEMENT.table.subject, { font: 'bold', size: 10 });
  page.text(PERCENT_RIGHT, y, STATEMENT.table.percent, { font: 'bold', size: 10, align: 'right' });
  page.text(LEVEL_X, y, STATEMENT.table.level, { font: 'bold', size: 10 });
  page.line(LEFT, y - 6, RIGHT, y - 6, 0.6);
  y -= ROW + 4;
  for (const s of report.subjects) {
    page.text(LEFT, y, s.nameAsPrinted, { size: 10 });
    page.text(PERCENT_RIGHT, y, String(s.percent), { size: 10, align: 'right' });
    page.text(LEVEL_X, y, String(s.level), { size: 10 });
    y -= ROW;
  }
  // The closing row of asterisks, one run per column, as on a real statement.
  page.text(LEFT, y, asterisks(PERCENT_RIGHT - 60 - LEFT, 10), { size: 10 });
  page.text(PERCENT_RIGHT, y, '***', { size: 10, align: 'right' });
  page.text(LEVEL_X, y, asterisks(RIGHT - LEVEL_X, 10), { size: 10 });
  page.line(LEFT, y - 8, RIGHT, y - 8, 0.6);

  // The pass statement.
  y -= 34;
  page.text(LEFT, y, STATEMENT.passHeading, { size: 9, gray: 0.35 });
  y -= 15;
  const final = grade === 12 && term === 'final';
  page.text(LEFT, y, (final ? PASS_FINAL : PASS_PROJECTED)[report.pass], {
    font: 'bold',
    size: 11,
  });
  if (!final) {
    y -= 13;
    page.text(LEFT, y, STATEMENT.projectionNote, { size: 8.5, gray: 0.35 });
  }

  // The key to the levels.
  y -= 30;
  page.text(LEFT, y, STATEMENT.keyHeading, { font: 'bold', size: 9 });
  for (const level of LEVELS) {
    y -= 12;
    page.text(LEFT, y, String(level), { size: 9 });
    page.text(LEFT + 20, y, LEVEL_WORDS[level], { size: 9 });
    page.text(LEFT + 200, y, band(level), { size: 9 });
  }

  // Bottom: the sample notice again.
  page.line(LEFT, PAGE.margin + 14, RIGHT, PAGE.margin + 14, 0.6);
  // MAX_ROWS rows leave the key well above this line: statement.test.ts measures it at 12.
  page.text(LEFT, PAGE.margin, STATEMENT.footer, { size: 7.5, gray: 0.25 });

  return renderPdf([page], {
    title: `${STATEMENT.title}: ${learner.examNumber}, ${reportLabel(grade, term)}`,
    subject: SAMPLE_NOTICE,
    producer: STATEMENT.producer,
  });
}
