import { describe, expect, it } from 'vitest';
import { catalogueView, examPapersForSuppression, RAW_CATALOGUE } from './catalogue';
import {
  daysUntil,
  type ExamPaper,
  examGrade,
  examPaperSchema,
  examSubjects,
  isOfficialExamSource,
  nscExamYear,
  nscSessionSlots,
  paperSlot,
  papersFor,
  sastDateOf,
  suppressionExamYears,
} from './exams';
import { isDraft } from './provenance';

const TODAY = new Date('2026-10-13T08:00:00Z');
const PAPERS = RAW_CATALOGUE.examPapers;

const MATHS_P1: ExamPaper = {
  sourceUrl: 'https://www.education.gov.za/timetable.pdf',
  academicYear: 2026,
  id: 'nsc-2026-mathematics-p1',
  examination: 'nsc-final',
  subjectId: 'mathematics',
  paper: 1,
  date: '2026-10-23',
  session: 'morning',
  startsAt: '09:00',
  durationMinutes: 180,
};

describe('the NSC exam timetable (hard rule 3: every paper sourced)', () => {
  it.each(PAPERS.map((p) => [p.id, p]))('%s validates', (_id, paper) => {
    expect(examPaperSchema.parse(paper)).toBeTruthy();
  });

  it('holds every paper as a draft until a person verifies it', () => {
    expect(PAPERS.length).toBeGreaterThan(40);
    expect(PAPERS.every(isDraft)).toBe(true);
    for (const p of PAPERS) {
      expect(p).not.toHaveProperty('verifiedOn');
      expect(p).not.toHaveProperty('verifiedBy');
    }
  });

  it('cites only the Department of Basic Education or a provincial education department', () => {
    for (const p of PAPERS) expect(isOfficialExamSource(p.sourceUrl), p.id).toBe(true);
    expect(isOfficialExamSource('https://www.matricexams.example.co.za/timetable')).toBe(false);
    expect(isOfficialExamSource('https://education.gov.za.evil.example/t.pdf')).toBe(false);
    expect(isOfficialExamSource('https://www.education.gov.za/t.pdf')).toBe(true);
  });

  it('gives each paper a unique id, and each subject at most one of each paper number', () => {
    const ids = PAPERS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    const keys = PAPERS.map((p) => `${p.academicYear}:${p.subjectId}:${p.paper}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('never gives a learner two papers at once', () => {
    // Shared slots (Mathematics, Mathematical Literacy, Technical Mathematics) are alternatives:
    // a learner takes one of them, so only the same subject's own clash would be an error.
    for (const a of PAPERS) {
      for (const b of PAPERS) {
        if (a === b || a.subjectId !== b.subjectId) continue;
        const [x, y] = [paperSlot(a), paperSlot(b)];
        expect(x.endsAt <= y.startsAt || y.endsAt <= x.startsAt, `${a.id} / ${b.id}`).toBe(true);
      }
    }
  });

  it('has no paper for Life Orientation, which has no final written exam', () => {
    expect(PAPERS.some((p) => p.subjectId === 'life-orientation')).toBe(false);
  });

  it('holds nothing for 2027: that timetable is not published, and must not be invented', () => {
    expect(PAPERS.filter((p) => p.academicYear !== 2026)).toEqual([]);
  });

  it('refuses a paper without a source, in the wrong year, or with a session that lies', () => {
    const { sourceUrl: _s, ...noSource } = MATHS_P1;
    expect(examPaperSchema.safeParse(noSource).success).toBe(false);
    expect(examPaperSchema.safeParse({ ...MATHS_P1, academicYear: 2027 }).success).toBe(false);
    expect(examPaperSchema.safeParse({ ...MATHS_P1, startsAt: '14:00' }).success).toBe(false);
    expect(examPaperSchema.safeParse({ ...MATHS_P1, startsAt: '9:00' }).success).toBe(false);
    expect(examPaperSchema.safeParse({ ...MATHS_P1, paper: 4 }).success).toBe(false);
    expect(examPaperSchema.safeParse({ ...MATHS_P1, subjectId: 'astrology' }).success).toBe(false);
    expect(examPaperSchema.safeParse(MATHS_P1).success).toBe(true);
  });
});

describe('catalogueView and the timetable', () => {
  it('hides every unverified paper from learners', () => {
    expect(catalogueView(TODAY, { includeDrafts: false }).examPapers).toEqual([]);
  });

  it('shows drafts only in preview', () => {
    expect(catalogueView(TODAY, { includeDrafts: true }).examPapers).toHaveLength(PAPERS.length);
  });
});

describe('papers we stay quiet for (A12-01): every sourced paper, never shown', () => {
  it('includes every sourced paper, drafts too, while the learner-facing view stays verified-only', () => {
    const quiet = examPapersForSuppression();
    expect(quiet).toHaveLength(PAPERS.length);
    expect(quiet.some(isDraft)).toBe(true);
    expect(catalogueView(TODAY, { includeDrafts: false }).examPapers).toEqual([]);
  });

  it('leaves out a record with no source: an unsourced date decides nothing', () => {
    const { sourceUrl: _s, ...noSource } = MATHS_P1;
    expect(examPapersForSuppression([noSource as ExamPaper, MATHS_P1])).toEqual([MATHS_P1]);
  });
});

describe('the exam years and sessions we stay quiet for (A12-02, A12-03)', () => {
  it('takes the year for the grade given and the grade after (a profile may be a year stale)', () => {
    expect([...suppressionExamYears(11, TODAY, TODAY)].sort()).toEqual([2026, 2027]);
    expect([...suppressionExamYears(12, TODAY, TODAY)].sort()).toEqual([2026, 2027]);
    expect([...suppressionExamYears(null, TODAY, TODAY)].sort()).toEqual([2026, 2027]);
    expect([...suppressionExamYears(10, TODAY, TODAY)].sort()).toEqual([2027, 2028]);
    // A window across New Year takes both ends.
    const jan = new Date('2027-01-05T08:00:00Z');
    expect([...suppressionExamYears(12, TODAY, jan)].sort()).toEqual([2026, 2027, 2028]);
  });

  it('turns the timetable into one window per exam session: earliest start to latest end', () => {
    const sessions = nscSessionSlots(PAPERS, 2026);
    const oct15 = sessions.filter((s) => s.startsAt.toISOString().startsWith('2026-10-15'));
    // English HL P3 (180 min) and English FAL P3 (150 min), both at 09:00.
    expect(oct15).toEqual([
      { startsAt: new Date('2026-10-15T07:00:00Z'), endsAt: new Date('2026-10-15T10:00:00Z') },
    ]);
    expect(sessions.some((s) => s.startsAt.toISOString() === '2026-10-30T12:00:00.000Z')).toBe(
      true,
    );
    expect(nscSessionSlots(PAPERS, 2027)).toEqual([]);
  });
});

describe('paper times (SAST, UTC+2 all year)', () => {
  it('turns the printed date, time and duration into instants', () => {
    expect(paperSlot(MATHS_P1)).toEqual({
      startsAt: new Date('2026-10-23T07:00:00Z'),
      endsAt: new Date('2026-10-23T10:00:00Z'),
    });
  });

  it('counts South African calendar days to a paper', () => {
    expect(daysUntil(MATHS_P1, TODAY)).toBe(10);
    expect(daysUntil(MATHS_P1, new Date('2026-10-23T06:59:00Z'))).toBe(0);
    // 23:30 SAST on the 22nd is still the 22nd in South Africa, though 21:30 UTC.
    expect(daysUntil(MATHS_P1, new Date('2026-10-22T21:30:00Z'))).toBe(1);
    expect(daysUntil(MATHS_P1, new Date('2026-10-22T22:30:00Z'))).toBe(0);
    expect(sastDateOf(new Date('2026-10-22T22:30:00Z'))).toBe('2026-10-23');
  });
});

describe('which papers a learner sits', () => {
  it('writes in Grade 12 this year, in Grade 11 (or unknown) next year', () => {
    expect(nscExamYear(12, TODAY)).toBe(2026);
    expect(nscExamYear(11, TODAY)).toBe(2027);
    expect(nscExamYear(null, TODAY)).toBe(2027);
    expect(nscExamYear(10, TODAY)).toBe(2028);
    // G10-1: Grade 9 writes three years on, not next year.
    expect(nscExamYear(9, TODAY)).toBe(2029);
  });

  it('takes Grade 12 from a Grade 12 report, whatever grade was typed', () => {
    expect(examGrade(11, 'grade-12-june')).toBe(12);
    expect(examGrade(11, 'grade-11-final')).toBe(11);
    expect(examGrade(null, null)).toBeNull();
  });

  it('takes the confirmed subjects, less the ones removed, plus the ones added', () => {
    expect(
      examSubjects(
        ['english-hl', 'mathematics', 'life-orientation', 'not-a-subject'],
        [
          { subjectId: 'mathematics', included: false },
          { subjectId: 'mathematical-literacy', included: true },
        ],
      ),
    ).toEqual(['english-hl', 'life-orientation', 'mathematical-literacy']);
  });

  it('matches only those subjects, in the right year, earliest first', () => {
    const subjects = examSubjects(['mathematics', 'english-fal', 'life-orientation'], []);
    const mine = papersFor(PAPERS, subjects, 2026);
    expect(mine.map((p) => p.id)).toEqual([
      'nsc-2026-english-fal-p3',
      'nsc-2026-mathematics-p1',
      'nsc-2026-mathematics-p2',
      'nsc-2026-english-fal-p1',
      'nsc-2026-english-fal-p2',
    ]);
    expect(papersFor(PAPERS, subjects, 2027)).toEqual([]);
    // Papers in the same slot come in a stable order.
    expect(
      papersFor(PAPERS, ['mathematical-literacy', 'mathematics'], 2026)
        .slice(0, 2)
        .map((p) => p.id),
    ).toEqual(['nsc-2026-mathematical-literacy-p1', 'nsc-2026-mathematics-p1']);
    expect(papersFor(PAPERS, [], 2026)).toEqual([]);
  });
});
