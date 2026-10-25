import { describe, expect, it } from 'vitest';
import { SAMPLE_REPORT, SampleReportReader } from './reader';
import {
  confirmedMarksSchema,
  draftFromExtraction,
  type ExtractedReport,
  normaliseName,
  resolveSubject,
} from './report';
import { checkUpload, InvalidUploadError, MAX_UPLOAD_BYTES, sniffType } from './uploads';

describe('resolveSubject (subject names as schools print them)', () => {
  it.each([
    ['English Home Language', 'english-hl'],
    ['ENGLISH HL', 'english-hl'],
    ['Eng FAL', 'english-fal'],
    ['English First Additional Language', 'english-fal'],
    ['English 1st Additional Language', 'english-fal'],
    ['Afrikaans Huistaal', 'afrikaans-hl'],
    ['Afrikaans Eerste Addisionele Taal', 'afrikaans-fal'],
    ['IsiZulu HL', 'isizulu-hl'],
    ['Sesotho sa Leboa Home Language', 'sepedi-hl'],
    ['Sesotho Home Language', 'sesotho-hl'],
    ['Setswana FAL', 'setswana-fal'],
    ['Tshivenḓa Home Language', 'tshivenda-hl'],
    ['Mathematics', 'mathematics'],
    ['Maths', 'mathematics'],
    ['Wiskunde', 'mathematics'],
    ['Mathematical Literacy', 'mathematical-literacy'],
    ['Maths Lit', 'mathematical-literacy'],
    ['Technical Mathematics', 'technical-mathematics'],
    ['Physical Science', 'physical-sciences'],
    ['Life Sciences', 'life-sciences'],
    ['Life Orientation', 'life-orientation'],
    ['LO', 'life-orientation'],
    ['Lewensoriëntering', 'life-orientation'],
    ['CAT', 'computer-applications-technology'],
    ['Engineering Graphics & Design', 'engineering-graphics-and-design'],
    ['Dramatic Arts', 'dramatic-arts'],
    ['Visual Arts', 'visual-arts'],
    ['Business Studies', 'business-studies'],
  ])('%s → %s', (printed, expected) => {
    expect(resolveSubject(printed)).toBe(expected);
  });

  it('leaves a language without a level unresolved: only the learner knows which they take', () => {
    expect(resolveSubject('English')).toBeNull();
    expect(resolveSubject('isiXhosa')).toBeNull();
  });

  it('leaves nonsense unresolved', () => {
    expect(resolveSubject('Astrology')).toBeNull();
    expect(resolveSubject('   ')).toBeNull();
  });

  it('normalises accents, case and punctuation', () => {
    expect(normaliseName('  Lewensoriëntering (LO)  ')).toBe('lewensorientering lo');
  });
});

describe('draftFromExtraction', () => {
  it('maps the sample report to subjects with no issues', () => {
    const draft = draftFromExtraction(SAMPLE_REPORT);
    expect(draft.rows.every((r) => r.issue === null)).toBe(true);
    expect(draft.rows.map((r) => r.subject)).toContain('english-fal');
    expect(draft.warnings).toEqual([]);
  });

  it('flags every problem a learner must fix before confirming', () => {
    const extracted: ExtractedReport = {
      isSchoolReport: true,
      grade: 12,
      term: 'june',
      subjects: [
        { nameAsPrinted: 'English', percent: 60 },
        { nameAsPrinted: 'Mathematics', percent: null },
        { nameAsPrinted: 'Maths', percent: 61 },
        { nameAsPrinted: 'Geography', percent: 140 },
        { nameAsPrinted: 'History', percent: 72.6 },
      ],
      partlyUnreadable: true,
    };
    const draft = draftFromExtraction(extracted);
    expect(draft.rows.map((r) => r.issue)).toEqual([
      'unknown-subject',
      'missing-percent',
      'duplicate',
      'out-of-range',
      null,
    ]);
    expect(draft.rows[4]?.percent).toBe(73);
    expect(draft.warnings).toEqual(['partly-unreadable', 'not-grade-11', 'few-subjects']);
  });

  it('carries the report the document prints, so the form starts there (A1-35)', () => {
    expect(draftFromExtraction({ ...SAMPLE_REPORT, grade: 10, term: 'final' }).printedKind).toBe(
      'grade-10-final',
    );
    expect(draftFromExtraction({ ...SAMPLE_REPORT, grade: 12, term: 'june' }).printedKind).toBe(
      'grade-12-june',
    );
    expect(
      draftFromExtraction({ ...SAMPLE_REPORT, grade: null, term: null }).printedKind,
    ).toBeNull();
  });

  it('names the school record’s June and September reports as the generator prints them (§18.7 C2)', () => {
    const printed = (grade: number, term: 'june' | 'september' | 'final') =>
      draftFromExtraction({ ...SAMPLE_REPORT, grade, term }).printedKind;
    expect(printed(10, 'june')).toBe('grade-10-june');
    expect(printed(11, 'june')).toBe('grade-11-june');
    expect(printed(11, 'september')).toBe('grade-11-september');
    // The generator also prints a Grade 10 September statement: no kind of its own, so the
    // learner picks, rather than it being called the final Grade 10 report.
    expect(printed(10, 'september')).toBeNull();
  });

  it('rounds a printed 29.5% to a whole mark the learner then confirms (levels read whole marks)', () => {
    const draft = draftFromExtraction({
      ...SAMPLE_REPORT,
      subjects: [{ nameAsPrinted: 'Mathematics', percent: 29.5 }],
    });
    expect(draft.rows[0]?.percent).toBe(30);
  });

  it('warns when the document is not a report', () => {
    const draft = draftFromExtraction({ ...SAMPLE_REPORT, isSchoolReport: false });
    expect(draft.warnings).toContain('not-a-report');
  });
});

describe('confirmedMarksSchema (hard rule 6: only confirmed values are used)', () => {
  it('accepts a clean set', () => {
    expect(
      confirmedMarksSchema.safeParse([
        { subject: 'mathematics', percent: 60 },
        { subject: 'english-fal', percent: 70 },
      ]).success,
    ).toBe(true);
  });

  it.each([
    [[]],
    [[{ subject: 'astrology', percent: 60 }]],
    [[{ subject: 'mathematics', percent: 60.5 }]],
    [[{ subject: 'mathematics', percent: 101 }]],
    [
      [
        { subject: 'mathematics', percent: 60 },
        { subject: 'mathematics', percent: 61 },
      ],
    ],
  ])('refuses %j', (marks) => {
    expect(confirmedMarksSchema.safeParse(marks).success).toBe(false);
  });
});

describe('SampleReportReader (the local stand-in)', () => {
  it('says it is a sample and returns a fresh copy each time', async () => {
    const reader = new SampleReportReader();
    expect(reader.isSample).toBe(true);
    const first = await reader.read();
    first.subjects.pop();
    expect((await reader.read()).subjects).toHaveLength(SAMPLE_REPORT.subjects.length);
  });
});

describe('uploads', () => {
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]);
  const webp = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
  const pdf = new TextEncoder().encode('%PDF-1.7\n');

  it('decides the type from the bytes', () => {
    expect(sniffType(jpeg)).toBe('image/jpeg');
    expect(sniffType(png)).toBe('image/png');
    expect(sniffType(webp)).toBe('image/webp');
    expect(sniffType(pdf)).toBe('application/pdf');
    expect(sniffType(new TextEncoder().encode('<html>'))).toBeNull();
  });

  it('refuses empty, oversized and unsupported files', () => {
    expect(() => checkUpload(new Uint8Array())).toThrow(InvalidUploadError);
    expect(() => checkUpload(new Uint8Array(MAX_UPLOAD_BYTES + 1).fill(0xff))).toThrow(/too-large/);
    expect(() => checkUpload(new TextEncoder().encode('GIF89a'))).toThrow(/unsupported-type/);
    expect(checkUpload(pdf)).toBe('application/pdf');
  });
});
