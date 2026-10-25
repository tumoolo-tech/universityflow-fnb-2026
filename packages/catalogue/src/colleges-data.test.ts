import { describe, expect, it } from 'vitest';
import { PROVINCES } from './basics';
import {
  closingNotice,
  collegeProblems,
  collegeProgrammeSchema,
  collegeSchema,
  isDhetSource,
  teachOutNoticeSchema,
} from './colleges';
import { DHET_COLLEGE_LIST, RAW_COLLEGES } from './colleges-catalogue';

/**
 * The real college data (drafts, researched 2026-10-24): it parses, its sources are where they
 * should be, and the list is DHET's own, counted, not assumed (planning.md §19.1).
 */

const { colleges, programmes, notices = [] } = RAW_COLLEGES;

describe('the public TVET college records', () => {
  it('parse, every one', () => {
    for (const c of colleges) expect(collegeSchema.safeParse(c).error).toBeUndefined();
    for (const p of programmes) expect(collegeProgrammeSchema.safeParse(p).error).toBeUndefined();
    for (const n of notices) expect(teachOutNoticeSchema.safeParse(n).error).toBeUndefined();
  });

  it('have nothing wrong across records: sources on the college’s own domains, unique ids', () => {
    expect(collegeProblems(RAW_COLLEGES)).toEqual([]);
  });

  it("are DHET's 50, with the per-province counts DHET's 2024 statistics print (Table 5.5)", () => {
    expect(colleges).toHaveLength(DHET_COLLEGE_LIST.count);
    expect(new Set(colleges.map((c) => c.dhetName)).size).toBe(50);
    const per = Object.fromEntries(
      PROVINCES.map((p) => [p, colleges.filter((c) => c.province === p).length]),
    );
    expect(per).toEqual({
      'Eastern Cape': 8,
      'Free State': 4,
      Gauteng: 8,
      'KwaZulu-Natal': 9,
      Limpopo: 7,
      Mpumalanga: 3,
      'North West': 3,
      'Northern Cape': 2,
      'Western Cape': 6,
    });
  });

  it("cite DHET's own list for what is a public college", () => {
    for (const c of colleges) {
      expect(c.sourceUrl).toBe(DHET_COLLEGE_LIST.url);
      expect(isDhetSource(c.provinceSourceUrl ?? '')).toBe(true);
    }
  });

  it('keep the names DHET changed findable (2020 → 2024)', () => {
    const byId = new Map(colleges.map((c) => [c.id, c]));
    expect(byId.get('college-of-cape-town')?.dhetName).toBe('College of Cape Town');
    expect(byId.get('college-of-cape-town')?.otherDhetNames).toEqual([
      'College of Cape Town for TVET',
    ]);
    expect(byId.get('northlink')?.otherDhetNames).toEqual(['Northlink TVET College']);
    expect(byId.get('south-west-gauteng')?.otherDhetNames).toEqual([
      'South West Gauteng TVET College',
    ]);
  });

  it('hold a register record only, with no programmes, where no site could be read or trusted', () => {
    for (const id of ['lovedale', 'taletso', 'lephalale', 'umgungundlovu']) {
      expect(colleges.find((c) => c.id === id)?.site).toBeNull();
      expect(programmes.filter((p) => p.collegeId === id)).toEqual([]);
    }
  });

  it('never apply for a learner through a third-party portal', () => {
    for (const c of colleges) {
      if (c.site?.applyUrl) expect(c.site.applyUrl).not.toMatch(/coltech|gostudy|learnerprofiler/);
    }
  });

  it('name each programme by DHET’s national name, keeping the college’s own beside it', () => {
    expect(programmes.length).toBeGreaterThan(700);
    for (const p of programmes) expect(p.nameAtCollege.length).toBeGreaterThan(1);
  });

  it('close every N4–N6 programme and six NC(V) ones to first-year students from 2027', () => {
    const n4 = programmes.filter((p) => p.type === 'n4-n6');
    expect(n4.length).toBeGreaterThan(0);
    for (const p of n4) expect(closingNotice(p, notices, 2027)?.id).toBe('tc-0134-b');
    const closedNcv = programmes.filter(
      (p) => p.type === 'ncv' && closingNotice(p, notices, 2027) !== undefined,
    );
    expect(new Set(closedNcv.map((p) => p.programme))).toEqual(
      new Set([
        'Finance, Economics and Accounting',
        'Management',
        'Marketing',
        'Education and Development',
        'Office Administration',
        'Process Plant Operations',
      ]),
    );
    const open = programmes.filter((p) => p.type === 'ncv' && !closingNotice(p, notices, 2027));
    expect(open.length).toBeGreaterThan(200);
  });
});
