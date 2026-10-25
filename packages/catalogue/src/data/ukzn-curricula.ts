import type { Curriculum, CurriculumModule } from '../curriculum';

/**
 * University of KwaZulu-Natal (UKZN): first-year curricula, one record per programme and
 * rule-book year (planning.md §11, Phase 5c).
 *
 * Fill this array only: the catalogue already reads it, and the catalogue tests validate every
 * record added here. Schema and field notes: `packages/catalogue/src/curriculum.ts`.
 * - `programmeId` is an id from data/ukzn.ts; `sourceUrl` is the faculty rule book or
 *   programme page on ukzn.ac.za; `academicYear` is the year the rule book is for.
 * - Modules as printed (code, name, semester, credits, compulsory). Electives are modules with
 *   `compulsory: false`, named in an elective group. Credit totals as published.
 * - Never add `verifiedOn`/`verifiedBy`: a person does. A programme with no published
 *   first-year curriculum gets no record.
 *
 * DRAFT: researched on 2026-10-16 from the 2026 college handbooks (the latest published; the
 * 2027 handbooks are not out). Not yet verified by a person (hard rule 3).
 *
 * Not recorded (see the research report): the BA and BSocSc (no fixed first year: two majors
 * chosen from lists), the BEd Foundation Phase (two mutually exclusive language packages, which
 * an elective group can't express).
 */

const CAES = {
  sourceUrl: 'https://saa.ukzn.ac.za/wp-content/uploads/2026/07/CAES-2026.pdf',
  academicYear: 2026,
} as const;
const CHS = {
  sourceUrl: 'https://ww2.chs.ukzn.ac.za/wp-content/uploads/2026/01/Health-Sciences-HB-2026-1.pdf',
  academicYear: 2026,
} as const;
const CLMS = {
  sourceUrl: 'https://clms.ukzn.ac.za/wp-content/uploads/2026/01/UKZN-CLMS-Handbook-2026.pdf',
  academicYear: 2026,
} as const;
const COH = {
  sourceUrl: 'https://coh.ukzn.ac.za/wp-content/uploads/2026/02/Humanities-2026-Handbook-min.pdf',
  academicYear: 2026,
} as const;

type Term = CurriculumModule['semester'];
const core = (code: string, name: string, semester: Term, credits: number): CurriculumModule => ({
  code,
  name,
  semester,
  credits,
  compulsory: true,
});
const elective = (
  code: string,
  name: string,
  semester: Term,
  credits: number,
): CurriculumModule => ({ code, name, semester, credits, compulsory: false });

/** The first year shared by both engineering programmes, before their own design module. */
const ENGINEERING_SHARED = (names: {
  techComm: string;
  maths1A: string;
  appliedMaths1A: string;
  maths1B: string;
  appliedMaths1B: string;
}): CurriculumModule[] => [
  elective('CHEM181', 'Chemistry for Engineers 1A', 'S1', 8),
  elective('CHEM163', 'Chemistry & Society 1', 'S1', 8),
  core('ENCH1TC', names.techComm, 'S1', 8),
  core('ENME1DR', 'Engineering Drawing', 'S1', 8),
  core('MATH131', names.maths1A, 'S1', 16),
  core('MATH132', names.appliedMaths1A, 'S1', 16),
  elective('PHYS151', 'Engineering Physics 1A', 'S1', 16),
  elective('PHYS110', 'Mechanics, Optics & Thermal Phys', 'S1', 16),
  elective('CHEM191', 'Chemistry for Engineers 1B', 'S2', 8),
  elective('CHEM173', 'Chemistry & Society 2', 'S2', 8),
  elective('ENME1EM', 'Intro to Engineering Materials', 'S2', 8),
  elective('ENAG1MT', 'Intro. to Engineering Materials', 'S2', 8),
  elective('ENAG1DE', 'Engineering Design', 'S2', 8),
  core('MATH141', names.maths1B, 'S2', 16),
  core('MATH142', names.appliedMaths1B, 'S2', 16),
  elective('PHYS152', 'Engineering Physics 1B', 'S2', 16),
  elective('PHYS120', 'Electromag, Waves & Mod. Phys', 'S2', 16),
];
const ENGINEERING_GROUPS: Curriculum['electiveGroups'] = [
  { label: 'CHEM181 or CHEM163', choose: { count: 1 }, from: ['CHEM181', 'CHEM163'] },
  { label: 'PHYS151 or PHYS110', choose: { count: 1 }, from: ['PHYS151', 'PHYS110'] },
  { label: 'CHEM191 or CHEM173', choose: { count: 1 }, from: ['CHEM191', 'CHEM173'] },
  { label: 'ENME1EM or ENAG1MT', choose: { count: 1 }, from: ['ENME1EM', 'ENAG1MT'] },
  { label: 'PHYS152 or PHYS120', choose: { count: 1 }, from: ['PHYS152', 'PHYS120'] },
];
const ENGINEERING_NOTE =
  'The rule book prints each pair as "OR" without saying who takes which; the first year is also offered on the Pietermaritzburg Campus, and the ENAG, CHEM163/173 and PHYS110/120 alternatives may be the Pietermaritzburg modules.';

export const ukznCurricula: Curriculum[] = [
  {
    ...CAES,
    programmeId: 'ukzn-bsc-computer-science-it',
    programmeCode: 'BSC-CI',
    yearOfStudy: 1,
    modules: [
      core('COMP100', 'Introduction to Computer Science', 'S1', 16),
      core('MATH130', 'Introduction to Calculus', 'S1', 16),
      core('STAT130', 'Introduction to Statistics', 'S1', 16),
      core('COMP102', 'Computer Programming', 'S2', 16),
      core('MATH140', 'Calculus and Linear Algebra', 'S2', 16),
      core('ISTN103', 'Development and Applications Fundamentals', 'S2', 16),
      elective('PHYS110', 'Mechanics, Optics and Thermal Physics', 'S1', 16),
      elective('ECON101', 'Principles of Microeconomics', 'S1', 16),
      elective('PHYS120', 'Electromagnetism, Waves and Modern Physics', 'S2', 16),
      elective('COMP107', 'Foundations of Computer Science', 'S2', 16),
      elective('STAT140', 'Statistical Methods', 'S2', 16),
    ],
    electiveGroups: [],
    openElectiveCredits: {
      credits: 32,
      note: 'One "Level 1 elective" (16 credits) in each semester; the listed electives are only the "Recommended electives"',
    },
    totalCredits: { min: 128, max: 128 },
    note: 'One "Level 1 elective" (16 credits) in each semester. The listed electives are the "Recommended electives", not a closed list, so they are in no group: any Level 1 elective counts, recorded as 32 open elective credits (the two printed 16-credit slots). CONFLICT: the handbook eligibility says APS 28 and Mathematics Level 4; the 2027 prospectus (data/ukzn.ts) says APS 30 and Mathematics Level 5.',
  },
  {
    ...CAES,
    programmeId: 'ukzn-bsceng-civil',
    programmeCode: 'ENG-CV',
    yearOfStudy: 1,
    modules: [
      ...ENGINEERING_SHARED({
        techComm: 'Tech. Comm. for Engineers',
        maths1A: 'Mathematics 1A (Eng)',
        appliedMaths1A: 'Applied Mathematics 1A (Eng)',
        maths1B: 'Mathematics 1B (Eng)',
        appliedMaths1B: 'Applied Mathematics 1B (Eng)',
      }),
      elective('ENCV1ED', 'Introduction to Civil Design', 'S2', 8),
      core('ENCV1EP', 'Engineering Practice Workshop', 'S2', 0),
    ],
    electiveGroups: [
      ...ENGINEERING_GROUPS,
      { label: 'ENCV1ED or ENAG1DE', choose: { count: 1 }, from: ['ENCV1ED', 'ENAG1DE'] },
    ],
    totalCredits: { min: 144, max: 144 },
    note: `ENCV1EP carries no credits (printed "DP"). ${ENGINEERING_NOTE}`,
  },
  {
    ...CAES,
    programmeId: 'ukzn-bsceng-electrical',
    programmeCode: 'ENG-EL',
    yearOfStudy: 1,
    modules: [
      ...ENGINEERING_SHARED({
        techComm: 'Tech. Communication for Engineers',
        maths1A: 'Mathematics 1A(Eng)',
        appliedMaths1A: 'Applied Mathematics 1A(Eng)',
        maths1B: 'Mathematics 1B(Eng)',
        appliedMaths1B: 'Applied Mathematics 1B(Eng)',
      }),
      elective('ENEL1ED', 'Electrical Design 1', 'S2', 8),
    ],
    electiveGroups: [
      ...ENGINEERING_GROUPS,
      { label: 'ENEL1ED or ENAG1DE', choose: { count: 1 }, from: ['ENEL1ED', 'ENAG1DE'] },
    ],
    totalCredits: { min: 144, max: 144 },
    note: ENGINEERING_NOTE,
  },
  {
    ...CAES,
    programmeId: 'ukzn-bsc-augmented',
    programmeCode: 'BSCA',
    yearOfStudy: 1,
    modules: [
      core('BIOL195', 'Smaller Side of Life – Augmented', 'Y', 16),
      core('CHEM195', 'General Principles of Chemistry – Augmented', 'Y', 16),
      core('MATH195', 'Introduction to Calculus – Augmented', 'Y', 16),
      core('PHYS195', 'Mechanics, Optics & Thermal Physics – Augmented', 'Y', 16),
      core('SCOM101', 'Communication in Science A', 'S1', 8),
      core('SCOM102', 'Communication in Science B', 'S2', 8),
    ],
    electiveGroups: [],
    totalCredits: { min: 80, max: 80 },
    note: '"Level 1 (Year 1)" of the four-year augmented BSc. "The Augmented modules are year-long modules, which have 16-degree credits and 16-foundation credits"; only the degree credits are recorded.',
  },
  {
    ...CHS,
    programmeId: 'ukzn-mbchb',
    programmeCode: 'MBChB6',
    yearOfStudy: 1,
    modules: [
      core('EDSJ1CS', 'Critical Social Justice and Citizenship', 'either', 0),
      core('CMED1BF', 'Basic & Foundation Science for Medicine', 'Y', 96),
      core('CMED1PC', 'Becoming a Professional', 'Y', 32),
      core('CMED1EN', 'English Literacy', 'Y', 8),
      core('CMED1ZU', 'isiZulu', 'Y', 8),
      core('CMED1CL', 'Computer Literacy', 'Y', 8),
    ],
    electiveGroups: [],
    totalCredits: { min: 152, max: 152 },
    note: 'EDSJ1CS (0 credits) is printed under both Semester One and Semester Two. The CMED modules are printed as "YEAR MODULES".',
  },
  {
    ...CHS,
    programmeId: 'ukzn-bpharm',
    programmeCode: 'B-PHAM',
    yearOfStudy: 1,
    modules: [
      core('BIOL103', 'Introductory Biology for Health Sciences', 'S1', 16),
      core('MATH150', 'Mathematics for Natural Sciences', 'S1', 16),
      core('PHRM141', 'Pharmaceutical Chemistry 1', 'S1', 16),
      core('PHYS131', 'Intro Physics for Life Sciences & Agriculture', 'S1', 16),
      core('EDSJ1CS', 'Critical Social Justice and Citizenship', 'S1', 0),
      core('SHSC1BH', 'Becoming a Health Professional', 'S2', 16),
      core('SHSC1HI', 'Health, Illness and Behaviour', 'S2', 16),
      core('PHRM142', 'Pharmaceutical Chemistry 2', 'S2', 16),
      elective('ZULN101', 'Basic isiZulu Languages Studies', 'S2', 16),
      elective('ZULM105', 'Academic Writing', 'S2', 16),
    ],
    electiveGroups: [
      {
        label: 'Choose ONE of the following isiZulu modules',
        choose: { count: 1 },
        from: ['ZULN101', 'ZULM105'],
      },
    ],
    totalCredits: { min: 128, max: 128 },
    note: '"Choose ZULN101 (if non-Nguni speaker) or ZULM105 (if Nguni speaker)."',
  },
  {
    ...CHS,
    programmeId: 'ukzn-bnursing',
    programmeCode: 'B-NURS',
    yearOfStudy: 1,
    modules: [
      core('NURS115', 'Fundamental Nursing Science 1', 'S1', 16),
      core('CHEM100', 'Special Science', 'S1', 16),
      core('ANAT120', 'Anatomy 1 for Nurses', 'S1', 16),
      core('EDJICS', 'Critical social justice and citizenship', 'S1', 0),
      core('SHSC1BH', 'Becoming a Health Care Professional', 'S1', 16),
      core('NURS116', 'Fundamental Nursing Science 2', 'S2', 16),
      core('HPHS1NU', 'Physiology 1', 'S2', 16),
      core('ANAT121', 'Anatomy 2 for Nurses', 'S2', 16),
      elective('ZULN101', 'Basic IsiZulu Language Studies', 'S2', 16),
      elective('ACLE102', 'Academic Learning in English', 'S2', 16),
    ],
    electiveGroups: [
      { label: 'ZULN101 / ACLE102', choose: { count: 1 }, from: ['ZULN101', 'ACLE102'] },
    ],
    totalCredits: { min: 128, max: 128 },
    note: 'The code "EDJICS" is printed as shown; other programmes print this module as EDSJ1CS. The rule book does not say who takes ZULN101 and who ACLE102.',
  },
  {
    ...CLMS,
    programmeId: 'ukzn-bcom-accounting',
    programmeCode: 'BCOM-C',
    yearOfStudy: 1,
    modules: [
      core('ACCT101', 'Accounting 101', 'S1', 16),
      core('ECON101', 'Principles of Microeconomics', 'S1', 16),
      core('ISTN101', 'IS&T for Business', 'S1', 16),
      core('STAT130', 'Introduction to Statistics', 'S1', 16),
      core('MATH130', 'Introduction to Calculus', 'S1', 16),
      core('ACCT102', 'Accounting 102', 'S2', 16),
      core('ECON102', 'Principles of Macroeconomics', 'S2', 16),
      core('ISTN103', 'Development & Applications Fundamentals', 'S2', 16),
      core('STAT140', 'Statistical Methods', 'S2', 16),
      elective('ZULN101', 'Basic IsiZulu Language Studies', 'S2', 16),
      elective('ACLE101', 'Academic Literacy in English', 'S2', 16),
    ],
    electiveGroups: [
      {
        label: 'ZULN101 or, if exempted in terms of rule BR(9), ACLE101',
        choose: { count: 1 },
        from: ['ZULN101', 'ACLE101'],
      },
    ],
    totalCredits: { min: 160, max: 160 },
  },
  {
    ...CLMS,
    programmeId: 'ukzn-bcom-general',
    programmeCode: 'B-COM',
    yearOfStudy: 1,
    modules: [
      core('ACCT101', 'Accounting 101', 'S1', 16),
      core('ECON101', 'Principles of Microeconomics', 'S1', 16),
      core('ISTN101', 'IS&T for Business', 'S1', 16),
      core('MATH134', 'Quantitative Methods 1', 'S1', 16),
      core('MGNT102', 'Management 120', 'S1', 16),
      elective('ACCT103', 'Accounting 103', 'S2', 16),
      elective('ACCT102', 'Accounting 102', 'S2', 16),
      core('ECON102', 'Principles of Macroeconomics', 'S2', 16),
      core('ISTN103', 'Development & Applications Fundamentals', 'S2', 16),
      core('STAT130', 'Introduction to Statistics', 'S2', 16),
      core('LAWS1IC', 'Introduction to Commercial Law', 'S2', 16),
    ],
    electiveGroups: [
      {
        label: 'Accounting 103 or, if majoring in Accounting, Accounting 102',
        choose: { count: 1 },
        from: ['ACCT103', 'ACCT102'],
      },
    ],
    totalCredits: { min: 160, max: 160 },
    note: 'STAT130 is printed under Semester Two here (Semester One in the BCom Accounting table).',
  },
  {
    ...CLMS,
    programmeId: 'ukzn-bcom-extended',
    programmeCode: 'BCOF-G',
    yearOfStudy: 1,
    modules: [
      core('ECON1CO', 'Elementary Microeconomics', 'S1', 16),
      // Printed with semester "1 & 2", which doesn't say year-long or either semester: no term.
      { code: 'ACCT1AL', name: 'Academic Literacy for Commerce', credits: 32, compulsory: true },
      { code: 'MATH194', name: 'Foundation Mathematics', credits: 32, compulsory: true },
      core('ECON1DO', 'Elementary Macroeconomics', 'S2', 16),
      core('MGNT1SL', 'Service-Learning', 'S2', 16),
    ],
    electiveGroups: [],
    totalCredits: { min: 112, max: 112 },
    note: 'Level One (the foundation year) of the Bachelor of Commerce (4 Year Foundation General), whose eligibility (APS 26, Mathematics Level 3) matches this programme. ACCT1AL and MATH194 are printed with semester "1 & 2", which doesn\'t say whether they are year-long or offered in either semester, so no term is recorded. "ISTN Workshops" (semester 1, 0 credits) is printed without a module code and is left out. The syllabus prints ECON1CO and ECON1DO as "ECON1C0" and "ECON1D0" (zero): check the codes.',
  },
  {
    ...CLMS,
    programmeId: 'ukzn-llb',
    programmeCode: 'LLB4',
    yearOfStudy: 1,
    modules: [
      core('LAWS1LW', 'Introduction to Law', 'S1', 16),
      core('LAWS1FL', 'Foundations of SA Law', 'S2', 16),
      elective('ACLE101', 'Academic Literacy in English', 'either', 16),
      elective('CFSD101', 'Introduction to Criminology', 'S1', 16),
      elective('CFSD102', 'Introduction to Criminal Justice', 'S2', 16),
      elective('ENGL101', 'Introduction to English Studies A', 'S1', 16),
      elective('ENGL102', 'Introduction to English Studies B', 'S2', 16),
      elective('HIST104', 'The Making of the Modern World', 'S1', 16),
      elective('HIST105', 'Empires of the Modern World', 'S2', 16),
      elective('POLS101', 'Introduction to Political Science', 'S1', 16),
      elective('POLS102', 'Introduction to Global Politics', 'S2', 16),
      elective('SOCY101', 'Introduction to Sociology', 'S1', 16),
      elective('SOCY102', 'Introduction to South African Society', 'S2', 16),
      elective('ZULM101', 'Introduction to isiZulu A', 'S1', 16),
      elective('ZULM102', 'Introduction to isiZulu B', 'S2', 16),
      elective('ZULN101', 'Basic isiZulu Language Studies A', 'either', 16),
    ],
    electiveGroups: [],
    openElectiveCredits: {
      credits: 64,
      note: 'Four "Non-legal module" slots (16 credits each); the handbook lists only "suggested" non-legal modules',
    },
    totalCredits: { min: 128, max: 128 },
    note: 'Level 1 is LAWS1LW and LAWS1FL plus four "Non-legal module" and two "English module" slots (16 credits each). The electives are the first-year "suggested" non-legal modules (LM-LU5), so they are in no group; "suggested" is read as not a closed list, so the four non-legal slots are recorded as 64 open elective credits: check that any non-legal module is allowed; their terms come from the handbook syllabi (Howard College and Pietermaritzburg offerings). 16 credits must be an approved isiZulu module unless exempted (Nguni speakers take Academic Literacy in English), and 32 credits English Language modules, with exemptions (80%+ matric English: 16 credits). ELDV100 English Language Development B is also suggested but its syllabus prints no semester ("HB"), so it is left out.',
  },
  {
    ...COH,
    programmeId: 'ukzn-bsw',
    programmeCode: 'BSOWK',
    yearOfStudy: 1,
    modules: [
      core('SOWK103', 'Social Work and Developmental Social Welfare', 'S1', 16),
      core('SOWK113', 'Intro to Professional Social Work Practice', 'S1', 16),
      core('SOWK 112', 'Fields of Practice and Organisations in Social Work', 'S2', 16),
      core('SOWK114', 'Afrocentrism, Human Behaviour and the Social Environment', 'S2', 16),
      elective('CFSD101', 'Introduction to Criminology', 'S1', 16),
      elective('CFSD102', 'Introduction to Criminal Justice', 'S2', 16),
      elective('CMDV101', 'Intro to Community Development Theory', 'S1', 16),
      elective('CMDV104', 'Institutions in Community Development', 'S2', 16),
      elective('PSYC101', 'Introduction to Psychology A', 'S1', 16),
      elective('PSYC102', 'Introduction to Psychology B', 'S2', 16),
      elective('SOCY101', 'Introduction to Sociology', 'S1', 16),
      elective('SOCY102', 'Intro to South African Society', 'S2', 16),
      elective('ACLE 102', 'Academic Literacy', 'either', 16),
      elective('ELDV001', 'English Language Development A', 'S1', 16),
      elective('ZULN101', 'Basic IsiZulu Language Studies A', 'either', 16),
    ],
    electiveGroups: [
      {
        label: 'CHOOSE FOUR ELECTIVES FROM THE FOLLOWING LIST 64CR',
        choose: { count: 4 },
        from: [
          'CFSD101',
          'CFSD102',
          'CMDV101',
          'CMDV104',
          'PSYC101',
          'PSYC102',
          'SOCY101',
          'SOCY102',
        ],
      },
      {
        label: 'CHOOSE ONE ELECTIVE FROM THE FOLLOWING LIST 16C- IN ANY SEMESTER',
        choose: { count: 1 },
        from: ['ACLE 102', 'ELDV001'],
      },
    ],
    totalCredits: { min: 144, max: 144 },
    note: '"Students who do not meet the isiZulu requirement, must replace one elective with ZULN101 in either semester": the rule book does not say which elective, so ZULN101 is in no group and a learner taking it may show one elective short. ACLE 102 is printed "in any semester"; ELDV001\'s term is from its syllabus (H1 P1). CONFLICT: the handbook says BSW eligibility is APS 32; the 2027 prospectus (data/ukzn.ts) says 28.',
  },
];
