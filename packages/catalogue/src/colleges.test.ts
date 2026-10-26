import { describe, expect, it } from 'vitest';
import {
  type College,
  type CollegeProgramme,
  type CollegeRecords,
  closingNotice,
  collegeById,
  collegeProblems,
  collegeProgrammeSchema,
  collegeSchema,
  collegeViewOf,
  INSTITUTION_TYPES,
  isCollegeSource,
  isRegistered,
  normaliseCollegeName,
  type ProgrammeTypeEntry,
  programmesAt,
  programmeTypeEntry,
  programmeTypeEntrySchema,
  registrationCheck,
  type TeachOutNotice,
  teachOutNoticeSchema,
} from './colleges';

/**
 * Public TVET colleges (planning.md §19.1, the owner's decision of 2026-10-24): an institution type
 * beside universities, DHET's register as the source of what is a public college, each college's
 * own site as the source of what it offers. Drafts until a person verifies (hard rule 3).
 * Every record here is synthetic.
 */

const REGISTER = {
  sourceUrl: 'https://www.dhet.gov.za/register.pdf',
  academicYear: 2026,
};

const SITE = {
  sourceUrl: 'https://www.example-college.edu.za/about/',
  academicYear: 2027,
  name: 'Example College',
  abbreviations: ['EXC'],
  website: 'https://www.example-college.edu.za/',
  domains: ['example-college.edu.za'],
  mainTown: 'Kimberley',
  applyUrl: 'https://apply.example-college.edu.za/',
};

const COLLEGE: College = {
  ...REGISTER,
  id: 'example',
  type: 'public-tvet-college',
  dhetName: 'Example TVET College',
  province: 'Northern Cape',
  provinceSourceUrl: 'https://www.dhet.gov.za/principals-2020.pdf',
  site: SITE,
};

const PROGRAMME: CollegeProgramme = {
  sourceUrl: 'https://www.example-college.edu.za/courses/',
  academicYear: 2027,
  id: 'example-ncv-tourism',
  collegeId: 'example',
  type: 'ncv',
  programme: 'Tourism',
  nameAtCollege: 'NC(V) Tourism L2-L4',
  campuses: ['Main'],
  yearPrinted: null,
  entryQuote: 'Grade 9 pass',
  entryQuoteUrl: 'https://www.example-college.edu.za/courses/tourism/',
};

const records = (
  colleges: ReadonlyArray<College> = [COLLEGE],
  programmes: ReadonlyArray<CollegeProgramme> = [PROGRAMME],
): CollegeRecords => ({ colleges, programmes });

const verified = { verifiedOn: '2026-10-20', verifiedBy: 'A. Person' };
const TODAY = new Date('2026-10-24T10:00:00Z');

describe('institution types', () => {
  it('has universities and public TVET colleges, with room for private institutions', () => {
    expect(INSTITUTION_TYPES).toEqual([
      'university',
      'public-tvet-college',
      'private-higher-education',
      'private-college',
    ]);
  });

  it('refuses a college of a type not built yet', () => {
    expect(collegeSchema.safeParse({ ...COLLEGE, type: 'private-college' }).success).toBe(false);
  });
});

describe('collegeSchema', () => {
  it('accepts a sourced draft (no verifiedOn or verifiedBy)', () => {
    expect(collegeSchema.safeParse(COLLEGE).success).toBe(true);
  });

  it("refuses a register fact that isn't from DHET's own domain", () => {
    expect(
      collegeSchema.safeParse({ ...COLLEGE, sourceUrl: 'https://tvetcolleges.co.za/list' }).success,
    ).toBe(false);
    expect(
      collegeSchema.safeParse({ ...COLLEGE, provinceSourceUrl: 'https://en.wikipedia.org/x' })
        .success,
    ).toBe(false);
  });

  it("refuses a site fact that isn't on the college's own domains", () => {
    const site = { ...SITE, applyUrl: 'https://colleges-portal.co.za/apply' };
    expect(collegeSchema.safeParse({ ...COLLEGE, site }).success).toBe(false);
    const source = { ...SITE, sourceUrl: 'https://fundiconnect.co.za/example' };
    expect(collegeSchema.safeParse({ ...COLLEGE, site: source }).success).toBe(false);
  });

  it('holds a college with no readable site as a register record only', () => {
    expect(collegeSchema.safeParse({ ...COLLEGE, site: null }).success).toBe(true);
  });

  it('keeps a town or apply page the site does not print as null, never a default', () => {
    const site = { ...SITE, mainTown: null, applyUrl: null, website: null };
    expect(collegeSchema.safeParse({ ...COLLEGE, site }).success).toBe(true);
  });
});

describe('collegeProgrammeSchema', () => {
  it('accepts a sourced programme', () => {
    expect(collegeProgrammeSchema.safeParse(PROGRAMME).success).toBe(true);
  });

  it('refuses a programme without a source (hard rule 3)', () => {
    const { sourceUrl: _omitted, ...rest } = PROGRAMME;
    expect(collegeProgrammeSchema.safeParse(rest).success).toBe(false);
  });

  it("refuses a national name that isn't one of its type's", () => {
    expect(
      collegeProgrammeSchema.safeParse({ ...PROGRAMME, programme: 'Business Management' }).success,
    ).toBe(false);
    expect(
      collegeProgrammeSchema.safeParse({
        ...PROGRAMME,
        type: 'n4-n6',
        programme: 'Business Management',
      }).success,
    ).toBe(true);
    expect(collegeProgrammeSchema.safeParse({ ...PROGRAMME, programme: 'OTHER' }).success).toBe(
      true,
    );
  });

  it('needs a quote and its page together', () => {
    expect(collegeProgrammeSchema.safeParse({ ...PROGRAMME, entryQuoteUrl: null }).success).toBe(
      false,
    );
    expect(
      collegeProgrammeSchema.safeParse({ ...PROGRAMME, entryQuote: null, entryQuoteUrl: null })
        .success,
    ).toBe(true);
  });
});

describe('collegeProblems', () => {
  it('finds nothing wrong with a clean set', () => {
    expect(collegeProblems(records())).toEqual([]);
  });

  it("flags a programme source that isn't on its college's own domains", () => {
    const off = { ...PROGRAMME, sourceUrl: 'https://www.other-college.co.za/courses/' };
    expect(collegeProblems(records([COLLEGE], [off]))).toEqual([
      "example-ncv-tourism: sourceUrl https://www.other-college.co.za/courses/ is not on example's own domains",
    ]);
    const quote = { ...PROGRAMME, entryQuoteUrl: 'https://www.careers-portal.co.za/x' };
    expect(collegeProblems(records([COLLEGE], [quote]))).toHaveLength(1);
  });

  it('flags a programme at a college with no site, an unknown college and repeated ids', () => {
    const noSite = { ...COLLEGE, site: null };
    expect(collegeProblems(records([noSite], [PROGRAMME]))).toEqual([
      'example-ncv-tourism: example has no site record, so nothing can source its programmes',
    ]);
    expect(collegeProblems(records([COLLEGE], [{ ...PROGRAMME, collegeId: 'nowhere' }]))).toEqual([
      'example-ncv-tourism: no college nowhere',
    ]);
    expect(collegeProblems(records([COLLEGE, COLLEGE], [PROGRAMME, PROGRAMME]))).toEqual([
      'college example is listed twice',
      'programme example-ncv-tourism is listed twice',
    ]);
  });

  it('flags the same national programme twice at one college and type', () => {
    const again = { ...PROGRAMME, id: 'example-ncv-tourism-2' };
    expect(collegeProblems(records([COLLEGE], [PROGRAMME, again]))).toEqual([
      'example-ncv-tourism-2: example lists ncv Tourism twice',
    ]);
  });

  it('lets OTHER repeat (each is a different programme the college names)', () => {
    const a = { ...PROGRAMME, id: 'a', programme: 'OTHER' as const, nameAtCollege: 'Robotics' };
    const b = { ...PROGRAMME, id: 'b', programme: 'OTHER' as const, nameAtCollege: 'Drones' };
    expect(collegeProblems(records([COLLEGE], [a, b]))).toEqual([]);
  });

  it('flags a verifiedOn or verifiedBy on one record but not the other', () => {
    expect(collegeProblems(records([{ ...COLLEGE, verifiedOn: '2026-10-20' }]))).toEqual([
      'college example: verifiedOn and verifiedBy go together',
    ]);
  });
});

describe('isCollegeSource', () => {
  it('accepts the college domain and its subdomains only', () => {
    expect(isCollegeSource(COLLEGE, 'https://example-college.edu.za/x')).toBe(true);
    expect(isCollegeSource(COLLEGE, 'https://apply.example-college.edu.za/x')).toBe(true);
    expect(isCollegeSource(COLLEGE, 'https://notexample-college.edu.za/x')).toBe(false);
    expect(isCollegeSource({ ...COLLEGE, site: null }, 'https://example-college.edu.za/x')).toBe(
      false,
    );
  });
});

describe('collegeViewOf', () => {
  it('shows no draft outside preview (hard rule 3)', () => {
    const view = collegeViewOf(records(), TODAY, { includeDrafts: false });
    expect(view.colleges).toEqual([]);
    expect(view.programmes).toEqual([]);
    expect(view.includesDrafts).toBe(false);
  });

  it('shows drafts in preview, labelled', () => {
    const view = collegeViewOf(records(), TODAY, { includeDrafts: true });
    expect(view.colleges.map((c) => c.id)).toEqual(['example']);
    expect(view.programmes.map((p) => p.id)).toEqual(['example-ncv-tourism']);
    expect(view.includesDrafts).toBe(true);
  });

  it("keeps a verified register record but drops its draft site and the site's programmes", () => {
    const college = { ...COLLEGE, ...verified };
    const view = collegeViewOf(records([college], [{ ...PROGRAMME, ...verified }]), TODAY, {
      includeDrafts: false,
    });
    expect(view.colleges.map((c) => c.id)).toEqual(['example']);
    expect(view.colleges[0]?.site).toBeNull();
    expect(view.programmes).toEqual([]);
  });

  it('shows a verified programme only when its college and its site are verified too', () => {
    const college = { ...COLLEGE, ...verified, site: { ...SITE, ...verified } };
    const view = collegeViewOf(records([college], [{ ...PROGRAMME, ...verified }]), TODAY, {
      includeDrafts: false,
    });
    expect(view.programmes.map((p) => p.id)).toEqual(['example-ncv-tourism']);
    expect(collegeById(view, 'example')?.dhetName).toBe('Example TVET College');
    expect(programmesAt(view, 'example')).toHaveLength(1);
  });

  it('never shows a verification dated in the future', () => {
    const college = { ...COLLEGE, verifiedOn: '2026-12-01', verifiedBy: 'A. Person' };
    expect(collegeViewOf(records([college]), TODAY, { includeDrafts: false }).colleges).toEqual([]);
  });
});

describe('where a programme type starts (A1-84): a sourced record, gated like every other', () => {
  const ENTRY: ProgrammeTypeEntry = {
    sourceUrl: 'https://www.dhet.gov.za/ncv-policy.pdf',
    academicYear: 2027,
    type: 'ncv',
    afterGrade: 9,
    orAfter: null,
    quote: 'The minimum entrance requirements are a Grade 9 Certificate.',
    page: 'p. 13',
  };
  const withEntry = (entry: ProgrammeTypeEntry) => ({ ...records(), entries: [entry] });

  it('cites DHET’s own domain', () => {
    expect(programmeTypeEntrySchema.safeParse(ENTRY).success).toBe(true);
    expect(
      programmeTypeEntrySchema.safeParse({ ...ENTRY, sourceUrl: 'https://example.org/ncv.pdf' })
        .success,
    ).toBe(false);
  });

  it('reaches a learner verified, or as a draft in preview only (hard rule 3)', () => {
    const draft = withEntry(ENTRY);
    expect(collegeViewOf(draft, TODAY, { includeDrafts: false }).entries).toEqual([]);
    expect(programmeTypeEntry(collegeViewOf(draft, TODAY, { includeDrafts: true }), 'ncv')).toEqual(
      ENTRY,
    );
    const checked = collegeViewOf(withEntry({ ...ENTRY, ...verified }), TODAY, {
      includeDrafts: false,
    });
    expect(programmeTypeEntry(checked, 'ncv')?.afterGrade).toBe(9);
    expect(programmeTypeEntry(checked, 'n4-n6')).toBeUndefined();
  });
});

describe('normaliseCollegeName', () => {
  it('forgives case, punctuation, accents, "&", "TVET" and "FET"', () => {
    expect(normaliseCollegeName('  Example   T.V.E.T. College ')).toBe('example college');
    expect(normaliseCollegeName('EXAMPLE FET COLLEGE')).toBe('example college');
    expect(normaliseCollegeName('Example TVET College')).toBe('example college');
    expect(normaliseCollegeName('College of Cape Town for TVET')).toBe('college of cape town');
    expect(normaliseCollegeName('uMfolozi TVET College')).toBe('umfolozi college');
    expect(normaliseCollegeName('Arts & Crafts College')).toBe('arts and crafts college');
    expect(normaliseCollegeName('Ngqéleni College')).toBe('ngqeleni college');
  });
});

describe('registrationCheck (no false yes)', () => {
  const view = collegeViewOf(records(), TODAY, { includeDrafts: true });

  it.each([
    'Example TVET College',
    'example tvet college',
    'Example FET College',
    'Example College',
    'EXAMPLE T.V.E.T COLLEGE',
    'EXC',
    'exc',
  ])('finds %s on the list', (name) => {
    const check = registrationCheck(view, name);
    expect(check.status).toBe('listed');
    expect(check.status === 'listed' && check.college.id).toBe('example');
    expect(isRegistered(view, name)).toBe(true);
  });

  it.each([
    'Example',
    'Example Private College',
    'Example College of Business',
    'Example TVET College (Pty) Ltd',
    'Examples College',
    'Exampel College',
    'EXC Academy',
    'TVET College',
    'College',
  ])('never says yes to %s, a name that only looks like one on the list', (name) => {
    expect(registrationCheck(view, name).status).toBe('not-found');
    expect(isRegistered(view, name)).toBe(false);
  });

  it('suggests names on the list that share the words, never as a yes', () => {
    const check = registrationCheck(view, 'Example');
    expect(check).toEqual({ status: 'not-found', query: 'Example', similar: [COLLEGE] });
  });

  it('asks for a name when the box is empty or holds only filler', () => {
    expect(registrationCheck(view, '   ').status).toBe('empty');
    expect(registrationCheck(view, 'TVET').status).toBe('empty');
  });

  it("says the list isn't available when no college may be shown (never a false no)", () => {
    const shut = collegeViewOf(records(), TODAY, { includeDrafts: false });
    expect(registrationCheck(shut, 'Example TVET College').status).toBe('unavailable');
  });

  it('never matches an abbreviation the college does not print', () => {
    const plain = collegeViewOf(
      records([{ ...COLLEGE, site: { ...SITE, abbreviations: [] } }]),
      TODAY,
      { includeDrafts: true },
    );
    expect(registrationCheck(plain, 'EXC').status).toBe('not-found');
  });

  it('matches a former DHET name only when the record carries it', () => {
    const renamed = collegeViewOf(
      records([{ ...COLLEGE, otherDhetNames: ['Old Example TVET College'] }]),
      TODAY,
      { includeDrafts: true },
    );
    expect(registrationCheck(renamed, 'Old Example College').status).toBe('listed');
    expect(registrationCheck(view, 'Old Example College').status).toBe('not-found');
  });
});

describe('teach-out notices (DHET circulars)', () => {
  const NOTICE: TeachOutNotice = {
    sourceUrl: 'https://www.example-college.edu.za/circulars/tc-0001.pdf',
    academicYear: 2027,
    id: 'tc-0001',
    circular: 'TC 0001',
    title: 'Teach-out of selected NC(V) programmes',
    datePrinted: '01 July 2026',
    type: 'ncv',
    programmes: ['Tourism'],
    noFirstIntakeFrom: 2027,
    quotes: ['From January 2027, there will be no first-year intake enrolment in these programmes'],
    hostCollegeId: 'example',
    supportingUrls: [],
  };

  it("cites DHET's own domain, or names the college whose copy it cites", () => {
    expect(teachOutNoticeSchema.safeParse(NOTICE).success).toBe(true);
    const { hostCollegeId: _omitted, ...unhosted } = NOTICE;
    expect(teachOutNoticeSchema.safeParse(unhosted).success).toBe(false);
    expect(
      teachOutNoticeSchema.safeParse({ ...unhosted, sourceUrl: 'https://www.dhet.gov.za/tc.pdf' })
        .success,
    ).toBe(true);
    expect(
      teachOutNoticeSchema.safeParse({ ...NOTICE, supportingUrls: ['https://news.example.com/x'] })
        .success,
    ).toBe(false);
    expect(teachOutNoticeSchema.safeParse({ ...NOTICE, programmes: ['Robotics'] }).success).toBe(
      false,
    );
  });

  it("flags a college copy that isn't on its host's own domains", () => {
    const off = { ...NOTICE, sourceUrl: 'https://www.elsewhere.co.za/tc.pdf' };
    expect(collegeProblems({ ...records(), notices: [off] })).toEqual([
      "teach-out tc-0001: https://www.elsewhere.co.za/tc.pdf is not on example's own domains",
    ]);
    expect(collegeProblems({ ...records(), notices: [NOTICE] })).toEqual([]);
  });

  it('closes the programmes it names from its first year on, and nothing else', () => {
    expect(closingNotice(PROGRAMME, [NOTICE], 2027)).toBe(NOTICE);
    expect(closingNotice(PROGRAMME, [NOTICE], 2026)).toBeUndefined();
    expect(
      closingNotice({ ...PROGRAMME, programme: 'Hospitality' }, [NOTICE], 2028),
    ).toBeUndefined();
    expect(closingNotice({ ...PROGRAMME, type: 'n4-n6' }, [NOTICE], 2028)).toBeUndefined();
    const all = { ...NOTICE, type: 'n4-n6' as const, programmes: null };
    expect(closingNotice({ type: 'n4-n6', programme: 'OTHER' }, [all], 2027)).toBe(all);
  });

  it('applies a draft notice even outside preview: it only ever closes options', () => {
    const view = collegeViewOf({ ...records(), notices: [NOTICE] }, TODAY, {
      includeDrafts: false,
    });
    expect(view.notices).toEqual([NOTICE]);
  });
});
