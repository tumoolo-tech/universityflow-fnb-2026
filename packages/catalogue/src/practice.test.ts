import { describe, expect, it } from 'vitest';
import { catalogueView, RAW_CATALOGUE } from './catalogue';
import {
  isPracticeSource,
  type PracticeResource,
  practiceForSubject,
  practiceResourceSchema,
} from './practice';
import { isDraft } from './provenance';

const TODAY = new Date('2026-10-13T08:00:00Z');
const RESOURCES = RAW_CATALOGUE.practice;

const BOOK: PracticeResource = {
  sourceUrl: 'https://www.siyavula.com/read',
  academicYear: 2026,
  id: 'siyavula-mathematics-grade-12-textbook',
  provider: 'siyavula',
  kind: 'textbook',
  subjectId: 'mathematics',
  grades: [12],
  title: 'Mathematics Grade 12',
  url: 'https://www.siyavula.com/read/za/mathematics/grade-12',
  access: 'free',
  licence: 'cc-by-3.0',
  accessedOn: '2026-10-13',
};

describe('Siyavula practice records (hard rule 3: every link sourced)', () => {
  it.each(RESOURCES.map((r) => [r.id, r]))('%s validates', (_id, record) => {
    expect(practiceResourceSchema.parse(record)).toBeTruthy();
  });

  it('holds every record as a draft until a person verifies it', () => {
    expect(RESOURCES.length).toBeGreaterThanOrEqual(18);
    expect(RESOURCES.every(isDraft)).toBe(true);
    for (const r of RESOURCES) {
      expect(r).not.toHaveProperty('verifiedOn');
      expect(r).not.toHaveProperty('verifiedBy');
    }
  });

  it('links and cites only siyavula.com, over HTTPS', () => {
    for (const r of RESOURCES) {
      expect(new URL(r.url).hostname, r.id).toBe('www.siyavula.com');
      expect(new URL(r.sourceUrl).hostname, r.id).toBe('www.siyavula.com');
      expect(r.url.startsWith('https://'), r.id).toBe(true);
    }
    expect(isPracticeSource('https://siyavula.com.evil.example/read')).toBe(false);
    expect(isPracticeSource('https://www.everythingmaths.co.za/')).toBe(false);
  });

  it('gives each record a unique id', () => {
    const ids = RESOURCES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('covers Grade 10–12 Mathematics and Physical Sciences with books, practice and past papers', () => {
    for (const subject of ['mathematics', 'physical-sciences'] as const) {
      for (const grade of [10, 11, 12]) {
        expect(
          RESOURCES.some(
            (r) => r.subjectId === subject && r.kind === 'textbook' && r.grades.includes(grade),
          ),
          `${subject} ${grade}`,
        ).toBe(true);
      }
      expect(RESOURCES.some((r) => r.subjectId === subject && r.kind === 'practice')).toBe(true);
      expect(RESOURCES.some((r) => r.subjectId === subject && r.kind === 'past-papers')).toBe(true);
    }
  });

  it('records only free resources, and says when an account is needed', () => {
    for (const r of RESOURCES) {
      expect(['free', 'free-with-account']).toContain(r.access);
      if (r.kind === 'practice') expect(r.access).toBe('free-with-account');
    }
    expect(practiceResourceSchema.safeParse({ ...BOOK, access: 'paid' }).success).toBe(false);
  });

  it('refuses a record off the provider’s site, without a source, or with bad grades', () => {
    expect(practiceResourceSchema.safeParse(BOOK).success).toBe(true);
    const { sourceUrl: _s, ...noSource } = BOOK;
    expect(practiceResourceSchema.safeParse(noSource).success).toBe(false);
    expect(
      practiceResourceSchema.safeParse({ ...BOOK, url: 'https://pirated-pdfs.example/maths.pdf' })
        .success,
    ).toBe(false);
    expect(
      practiceResourceSchema.safeParse({ ...BOOK, sourceUrl: 'https://blog.example/siyavula' })
        .success,
    ).toBe(false);
    expect(
      practiceResourceSchema.safeParse({ ...BOOK, url: 'http://www.siyavula.com/read' }).success,
    ).toBe(false);
    expect(practiceResourceSchema.safeParse({ ...BOOK, grades: [] }).success).toBe(false);
    expect(practiceResourceSchema.safeParse({ ...BOOK, grades: [9] }).success).toBe(false);
    expect(practiceResourceSchema.safeParse({ ...BOOK, grades: [12, 12] }).success).toBe(false);
    expect(practiceResourceSchema.safeParse({ ...BOOK, subjectId: 'astrology' }).success).toBe(
      false,
    );
  });
});

describe('catalogueView and practice', () => {
  it('hides every unverified record from learners', () => {
    expect(catalogueView(TODAY, { includeDrafts: false }).practice).toEqual([]);
  });

  it('shows drafts only in preview', () => {
    expect(catalogueView(TODAY, { includeDrafts: true }).practice).toHaveLength(RESOURCES.length);
  });

  it('shows a verified record to learners', () => {
    const verified = { ...BOOK, verifiedOn: '2026-10-12', verifiedBy: 'A Person' };
    expect(practiceResourceSchema.parse(verified)).toBeTruthy();
    expect(isDraft(verified)).toBe(false);
  });
});

describe('practiceForSubject', () => {
  it('gives a Grade 11 learner Grade 11 and 12 material, textbooks first', () => {
    const list = practiceForSubject(RESOURCES, 'mathematics', 11);
    expect(list.map((r) => r.id)).toEqual([
      'siyavula-mathematics-grade-11-textbook',
      'siyavula-mathematics-grade-12-textbook',
      'siyavula-mathematics-practice',
      'siyavula-mathematics-past-papers',
    ]);
  });

  it('falls back to every book for the subject when none is for their grade or later', () => {
    expect(practiceForSubject(RESOURCES, 'life-sciences', 12).map((r) => r.id)).toEqual([
      'siyavula-life-sciences-grade-10-textbook',
    ]);
  });

  it('gives everything for the subject when the grade is unknown, and nothing for no match', () => {
    expect(practiceForSubject(RESOURCES, 'physical-sciences', null)).toHaveLength(5);
    expect(practiceForSubject(RESOURCES, 'geography', 11)).toEqual([]);
  });
});
