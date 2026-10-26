/**
 * `en.colleges`: public TVET colleges in Plan B, the results filter's institution and type, and
 * "Is this college registered?" (planning.md §19.1; the owner's decision of 2026-10-24). Every
 * fact (a college's name, rule, link) comes from packages/catalogue; these are only the words
 * around them. Never a promise of a place, and never a word about funding (not in scope).
 */
export const colleges = {
  /** The badge on a college's card in Plan B. */
  badge: 'Public TVET college',
  institutionTypes: {
    university: 'University',
    'public-tvet-college': 'Public TVET college',
  },
  programmeTypes: {
    ncv: 'NC(V)',
    'n4-n6': 'N4–N6',
  },
  verdicts: {
    'meets-minimum': 'You meet the minimum the college prints',
    'check-rule': 'Check the entry rule',
  },
  meetsNote:
    'Meeting the printed minimum isn’t a place: the college decides, and may test or interview you first.',
  checkNote: 'We can’t check this rule for you. Read it below, or ask the college.',
  ruleLabel: 'The college’s entry rule, as it prints it',
  noRule:
    'The college doesn’t print an entry rule for this course. Ask the college before you apply.',
  campuses: 'Campuses',
  yearPrinted: (year: number) => `The college printed this for ${year}.`,
  noYear: 'The college’s page prints no year: check it’s for the year you apply.',
  apply: 'How to apply (college site)',
  website: 'College website',
  coursePage: 'Course page',
  courses: (n: number) => (n === 1 ? '1 course' : `${n} courses`),
  where: (town: string, province: string) => `${town}, ${province}`,
  /** Below the college cards, when a teach-out left courses out. */
  closed: (count: number, circular: string) =>
    count === 1
      ? `1 more college course isn’t shown: DHET’s circular ${circular} says it takes no new first-year students from next year.`
      : `${count} more college courses aren’t shown: DHET’s circular ${circular} says they take no new first-year students from next year.`,
  closedSource: 'Read the circular',
  /** At the end of the college cards: the check, for any college a learner hears of. */
  checkLink: 'Is a college registered? Check its name',
  filters: {
    institution: 'Institution',
    allInstitutions: 'All institutions',
    type: 'Type',
    allTypes: 'All types',
  },
  checked: (n: number) => `${n} college courses checked.`,
  /** The judge demo's banner, when it shows the colleges' logos (a hackathon exception). */
  demoLogosNotice:
    'College logos are shown for this demo only. UniversityFlow is not affiliated with or endorsed by these colleges.',
  /** "Is this college registered?" (/colleges/registered): open to anyone, no sign-in. */
  check: {
    title: 'Is this college registered?',
    lead: 'Every year, “colleges” that aren’t registered take learners’ fees. Check a college’s name against the Department of Higher Education and Training’s (DHET’s) list of public TVET colleges.',
    label: 'The college’s name',
    hint: 'Type the name the college uses, like “Sedibeng TVET College” or its short name.',
    submit: 'Check',
    empty: 'Type a college’s name to check it.',
    listed: (name: string) => `Yes: ${name} is on DHET’s list of public TVET colleges.`,
    listedNote:
      'This says it is a public TVET college. It doesn’t say which courses it has open: check those, and how to apply, on the college’s own website.',
    listedAs: (dhetName: string, province: string) =>
      `DHET lists it as “${dhetName}”, in ${province}.`,
    notFound: (name: string) => `We didn’t find “${name}” on DHET’s list of public TVET colleges.`,
    notFoundWarning:
      'Be careful. Don’t pay any fee or send any documents until you’re sure the college is real. It may be a private college: those are on DHET’s own registers, linked below.',
    similar: 'Names on the list that look like it. Check the spelling: these are not a match.',
    unavailable:
      'We can’t check names yet: our copy of DHET’s list hasn’t been checked by a person. Use DHET’s own pages below.',
    draftNotice: 'Preview: our copy of DHET’s list is research nobody has checked yet.',
    source: (title: string, date: string, count: number) =>
      `We check against DHET’s ${title} (${date}), which lists ${count} public TVET colleges.`,
    dhetTitle: 'Check with DHET yourself',
    dhetTvet: 'DHET: TVET colleges',
    dhetRegisters: 'DHET: registers of private colleges and private higher education institutions',
    /** The page's search and share description, shorter than `lead` (A6-05, wave 10). Owed review. */
    description:
      'Before you pay a college any fee, check its name against DHET’s list of public TVET colleges. Free and open to anyone, with no sign-in.',
  },
  /**
   * A1-84 / A10-67: where a programme type starts, worded from the catalogue's sourced record
   * (packages/catalogue `ProgrammeTypeEntry`), never written here (hard rule 2). Grade 12 is matric.
   * These replace `programmeTypeLead`, `group` and `groupLead`, which held the facts themselves.
   */
  programmeTypeEntry: (afterGrade: number, orAfter: string | null) => {
    const grade = afterGrade === 12 ? 'matric' : `Grade ${afterGrade}`;
    return orAfter ? `Starts after ${grade} or ${orAfter}` : `Starts after ${grade}`;
  },
  /** On Grade 10 and Grade 11 June/September marks: NC(V) only, from its record. */
  groupAfter: (afterGrade: number) => `College courses after Grade ${afterGrade}`,
  groupLeadAfter: (afterGrade: number) =>
    `NC(V) courses at public TVET colleges start after Grade ${afterGrade}. These are the ones your report doesn’t rule out.`,
  /** The same group when no NC(V) record may be shown: no grade at all, never a usual one. */
  groupNoEntry: 'College courses',
  groupLeadNoEntry:
    'NC(V) courses at public TVET colleges. These are the ones your report doesn’t rule out.',
} as const;
