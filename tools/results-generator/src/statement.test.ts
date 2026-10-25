import { LEVEL_FLOOR } from '@universityflow/admissions';
import {
  draftFromExtraction,
  type ExtractedReport,
  SAMPLE_NOTICE,
  type SampleLearner,
} from '@universityflow/documents';
import { describe, expect, it } from 'vitest';
import { DEFAULT_SEED, generateLearner } from './learners';
import { PAGE, textWidth } from './pdf';
import { pageCount, readTextRuns, type TextRun } from './pdf-text';
import { statementPdf } from './statement';
import { LEVEL_WORDS } from './strings';

const LATIN1 = new TextDecoder('latin1');

function learnerWith(subjectCount: number): SampleLearner {
  return generateLearner({ seed: `${DEFAULT_SEED}:${subjectCount}`, subjectCount });
}

function statement(subjectCount: number, reportIndex = 8) {
  const learner = learnerWith(subjectCount);
  const report = learner.reports[reportIndex];
  if (!report) throw new Error('fixture');
  const bytes = statementPdf(learner, report);
  return { learner, report, bytes, runs: readTextRuns(bytes), raw: LATIN1.decode(bytes) };
}

const allText = (runs: ReadonlyArray<TextRun>) => runs.map((r) => r.text).join('\n');

describe('a statement is one page', () => {
  it.each([7, 9, 11, 12])('at %d subjects: one page, everything on it', (count) => {
    const { bytes, runs } = statement(count);
    expect(pageCount(bytes)).toBe(1);
    for (const run of runs) {
      if (run.angle !== 0) continue; // the watermark, checked below
      expect(run.x).toBeGreaterThanOrEqual(PAGE.margin - 0.01);
      expect(run.x + textWidth(run.text, run.font, run.size)).toBeLessThanOrEqual(
        PAGE.width - PAGE.margin + 0.01,
      );
      expect(run.y).toBeGreaterThanOrEqual(PAGE.margin - 0.01);
      expect(run.y + run.size).toBeLessThanOrEqual(PAGE.height - PAGE.margin / 2);
    }
  });

  it('refuses more subjects than one page holds, rather than spilling onto a second', () => {
    const learner = learnerWith(12);
    const report = learner.reports[8];
    if (!report) throw new Error('fixture');
    const subjects = [...report.subjects, ...report.subjects.slice(0, 1)];
    expect(() => statementPdf(learner, { ...report, subjects })).toThrow(RangeError);
  });

  it('refuses a report period it does not know', () => {
    const learner = learnerWith(7);
    const report = learner.reports[8];
    if (!report) throw new Error('fixture');
    const period = 'grade-13-final' as typeof report.period;
    expect(() => statementPdf(learner, { ...report, period })).toThrow(RangeError);
  });
});

describe('every page says it is a sample, and carries no insignia', () => {
  it.each([7, 9, 11])('at %d subjects the sample notice is printed, top and bottom', (count) => {
    const { runs } = statement(count);
    const notices = runs.filter((r) => r.text.includes(SAMPLE_NOTICE));
    expect(notices.length).toBeGreaterThanOrEqual(2);
    const ys = notices.map((r) => r.y);
    expect(Math.max(...ys)).toBeGreaterThan(PAGE.height * 0.9);
    expect(Math.min(...ys)).toBeLessThan(PAGE.height * 0.1);
    expect(runs.some((r) => r.text === 'SAMPLE' && r.angle !== 0)).toBe(true);
  });

  it('says so in the document information too', () => {
    const { raw } = statement(7);
    expect(raw).toContain(`/Subject (${SAMPLE_NOTICE})`);
  });

  it('embeds no image, form, annotation, signature, font file or script', () => {
    const { raw } = statement(11);
    for (const marker of [
      '/XObject',
      '/Image',
      '/Annot',
      '/AcroForm',
      '/Sig',
      '/FontFile',
      '/EmbeddedFile',
      '/JavaScript',
      '/OpenAction',
      'BI ', // an inline image
    ]) {
      expect(raw).not.toContain(marker);
    }
    // Only the two standard fonts, by name, nothing embedded.
    const fonts = [...raw.matchAll(/\/BaseFont \/([A-Za-z-]+)/g)].map((m) => m[1]);
    expect(fonts.sort()).toEqual(['Helvetica', 'Helvetica-Bold']);
  });

  it('names no issuer and prints no seal, signature, barcode or certificate number', () => {
    const { runs } = statement(9);
    const text = allText(runs).replaceAll(SAMPLE_NOTICE, '').toLowerCase();
    for (const word of [
      'umalusi',
      'department',
      'dbe',
      'ieb',
      'sacai',
      'coat of arms',
      'seal',
      'signature',
      'signed',
      'barcode',
      'certificate number',
      'certificate no',
      'serial',
      'official',
    ]) {
      expect(text).not.toContain(word);
    }
    expect(text).not.toMatch(/\d{7,}/);
  });
});

describe('the statement’s structure', () => {
  it('heads the page with the learner, exam number, school, year and report', () => {
    const { learner, report, runs } = statement(7);
    const text = allText(runs);
    expect(text).toContain(learner.displayName);
    expect(text).toContain(learner.examNumber);
    expect(text).toContain(learner.school);
    expect(text).toContain(String(report.academicYear));
    expect(text).toContain('Grade 12, final');
  });

  it('has one table, Subject · % · Achievement level, closed by a row of asterisks', () => {
    const { report, runs } = statement(9);
    const header = runs.find((r) => r.text === 'Subject');
    expect(header).toBeDefined();
    expect(runs.some((r) => r.text === '%' && r.y === header?.y)).toBe(true);
    expect(runs.some((r) => r.text === 'Achievement level' && r.y === header?.y)).toBe(true);
    const rows = runs.filter((r) => r.y < (header?.y ?? 0) && r.x === PAGE.margin);
    const names = rows.slice(0, report.subjects.length).map((r) => r.text);
    expect(names).toEqual(report.subjects.map((s) => s.nameAsPrinted));
    const closing = rows[report.subjects.length];
    expect(closing?.text).toMatch(/^\*+$/);
  });

  it('prints the pass statement and a key to all seven levels, bands from LEVEL_FLOOR', () => {
    const { runs } = statement(7);
    const text = allText(runs);
    expect(text).toContain('Pass statement');
    expect(text).toMatch(/Passed|Not yet passed/);
    for (const level of [7, 6, 5, 4, 3, 2, 1] as const) {
      expect(text).toContain(LEVEL_WORDS[level]);
      const high = level === 7 ? 100 : LEVEL_FLOOR[(level + 1) as 2] - 1;
      expect(text).toContain(`${LEVEL_FLOOR[level]}–${high}%`);
    }
  });

  it('labels an earlier report’s pass as a projection', () => {
    const { runs } = statement(7, 0);
    const text = allText(runs);
    expect(text).toContain('Grade 10, June');
    expect(text).toContain('On these marks:');
    expect(text).toContain('A projection from these marks');
  });

  it('writes the same bytes for the same learner and report', () => {
    expect(statement(9).bytes).toEqual(statement(9).bytes);
  });
});

describe('the report reader can read what the statement prints', () => {
  /** Rows of the table from the text layer alone, as a reader that sees only the text would. */
  function extract(runs: ReadonlyArray<TextRun>): ExtractedReport {
    const header = runs.find((r) => r.text === 'Subject');
    if (!header) throw new Error('no table');
    const subjects: ExtractedReport['subjects'] = [];
    for (const name of runs.filter((r) => r.y < header.y && r.x === PAGE.margin)) {
      if (/^\*+$/.test(name.text)) break;
      // The first number right of the name is the %; the level comes after it.
      const percent = runs
        .filter((r) => r.y === name.y && r.x > PAGE.margin && /^\d{1,3}$/.test(r.text))
        .sort((a, b) => a.x - b.x)[0];
      subjects.push({ nameAsPrinted: name.text, percent: percent ? Number(percent.text) : null });
    }
    const label = runs.map((r) => r.text).find((t) => /^Grade 1[0-2], /.test(t)) ?? '';
    const [, grade, term] = /^Grade (\d+), (\w+)/.exec(label) ?? [];
    return {
      isSchoolReport: true,
      grade: grade ? Number(grade) : null,
      term:
        term === 'final'
          ? 'final'
          : term === 'June'
            ? 'june'
            : term === 'September'
              ? 'september'
              : 'other',
      subjects,
      partlyUnreadable: false,
    };
  }

  it.each([7, 9, 11])('at %d subjects the text layer holds every mark, row by row', (count) => {
    const { report, runs } = statement(count);
    const draft = draftFromExtraction(extract(runs));
    expect(draft.rows.map((r) => r.issue)).toEqual(report.subjects.map(() => null));
    expect(draft.rows.map((r) => [r.subject, r.percent])).toEqual(
      report.subjects.map((s) => [s.subject, s.percent]),
    );
    expect(draft.printedKind).toBe('grade-12-final');
  });
});
