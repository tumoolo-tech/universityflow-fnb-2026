import type { Curriculum, CurriculumModule } from '../curriculum';

/**
 * University of the Witwatersrand (Wits): first-year curricula, one record per programme and
 * rule-book year (planning.md §11, Phase 5c).
 *
 * Fill this array only: the catalogue already reads it, and the catalogue tests validate every
 * record added here. Schema and field notes: `packages/catalogue/src/curriculum.ts`.
 * - `programmeId` is an id from data/wits.ts; `sourceUrl` is the faculty rule book or
 *   programme page on wits.ac.za; `academicYear` is the year the rule book is for.
 * - Modules as printed (code, name, semester, credits, compulsory). Electives are modules with
 *   `compulsory: false`, named in an elective group. Credit totals as published.
 * - Never add `verifiedOn`/`verifiedBy`: a person does. A programme with no published
 *   first-year curriculum gets no record.
 *
 * DRAFT: researched on 2026-10-16. Not yet verified by a person (hard rule 3).
 *
 * How the semester is read: Wits's 2026 rule books print codes and credits but no term. A term is
 * recorded only where an official Wits document of 2026 prints it, and the record's note names
 * that document and the codes it covers:
 * - the 2026 first-year BA General letter (`BA_LETTER`), which prints "Semester 1", "Semester 2",
 *   "Semester 1 & 2" (`either`) or "Full Year" (`Y`) for each module;
 * - for Health Sciences, the 2026 first-year timetable (`HS_TIMETABLE`: a code under only the "1st
 *   SEMESTER" or only the "2nd SEMESTER" timetable is S1 or S2; one under both has no term, since
 *   it may be year-long or offered in either semester) and the 2026 first-lecture document
 *   (`HS_FIRST_LECTURE`: "offered in the second semester" is S2). `Y` only where a document says
 *   "full year" for the module.
 * Everything else has no `semester` (`NO_TERM`): never guessed.
 *
 * Held back: wits-bsc-computer-science. APPM1026A is "Full Year" in the 2025 Science booklet but
 * has SM1 and SM2 course sites for 2026; see the research report.
 *
 * Year totals: no 2026 rule book prints a first-year credit total. Where every first-year module is
 * listed, the total is the sum of the printed credits (said in the note).
 */

const DOCS = 'https://www.wits.ac.za/media/wits-university/students/academic-matters/documents/';
const RULES = (book: string) => ({ sourceUrl: `${DOCS}${book}`, academicYear: 2026 }) as const;
const EBE = RULES('EBE_eBook.pdf');
const CLM = RULES('CLM_eBook.pdf');
const HUM = RULES('Hum_eBook.pdf');
const EDU = RULES('Edu_eBook.pdf');
const HEALTH = RULES('HSCi_eBook.pdf');

const BA_LETTER =
  'https://www.wits.ac.za/media/wits-university/study/undergraduate/2026%20letter%20BA%20General%20(ABA00)%20first%20year.pdf';
const HS_DOCS =
  'https://www.wits.ac.za/media/wits-university/faculties-and-schools/health-sciences/student-documents/timetables/';
const HS_TIMETABLE = `${HS_DOCS}First%20Year%20Timetable%20-%202026%20-%2029%20Jan.pdf`;
const HS_FIRST_LECTURE = `${HS_DOCS}First%20Lecture%20Information%201st%20years%202026.pdf`;

type Term = CurriculumModule['semester'];
/** No 2026 Wits document prints the module's term: the record leaves `semester` out. */
const NO_TERM = undefined;
/** A compulsory module as printed: code, name, term (or `NO_TERM`), credits. */
const m = (code: string, name: string, semester: Term, credits: number): CurriculumModule => ({
  code,
  name,
  ...(semester === undefined ? {} : { semester }),
  credits,
  compulsory: true,
});
/** An elective, listed in one of the record's elective groups. */
const elective = (
  code: string,
  name: string,
  semester: Term,
  credits: number,
): CurriculumModule => ({ ...m(code, name, semester, credits), compulsory: false });
const total = (credits: number) => ({ min: credits, max: credits });
const codes = (modules: CurriculumModule[]) => modules.map((x) => x.code);
const SUM = 'No year total is printed: the total is the sum of the printed first-year credits.';

// ── Humanities: BA General ──────────────────────────────────────────────────────────────────

/** The BA letter's first-year modules: all electives (the learner picks subjects). */
const BA_MODULES: CurriculumModule[] = [
  elective('AFRL1003A', 'Elementary IsiZulu Language and Culture IA', 'S1', 18),
  elective('AFRL1005A', 'Elementary Sesotho Language and Culture IA', 'either', 18),
  elective('AFRL1004A', 'Elementary IsiZulu Language and Culture IB', 'either', 18),
  elective('AFRL1006A', 'Elementary Sesotho Language and Culture IB', 'either', 18),
  elective('AFRL1007A', 'The History and Relationship of South African Languages', 'S1', 18),
  elective('AFRL1002A', 'Drama, Ritual and Performance I', 'S2', 18),
  elective('AFRT1002A', 'Oral Literature & Performance in South Africa', 'S1', 18),
  elective('AFRT1001A', 'African Fiction - An Introduction I', 'S2', 18),
  elective('ANTH1006A', 'Culture and Humanity', 'S1', 18),
  elective('ANTH1007A', 'Practices of Identification', 'S2', 18),
  elective('ARCL 1011A', 'Archeology I', 'Y', 36),
  elective('WDFL1000A', 'Arts and Global Citizenship IA', 'S1', 18),
  elective('WDFL1001A', 'Arts and Global Citizenship IB', 'S2', 18),
  elective('ENGL1003A', 'Global Literature and Film I', 'S1', 18),
  elective('ENGL1001A', 'English Literature in Context I', 'S2', 18),
  elective('IACS1000A', 'Film, Visual and Performing Arts IA', 'S1', 18),
  elective('IACS1001A', 'Film, Visual and Performing Arts IB', 'S2', 18),
  elective('GEOG1000A', 'Geography I', 'Y', 36),
  elective('HIST1011A', 'Global Encounters and Contemporary Realities IA', 'S1', 18),
  elective('HIST1015A', 'Global Encounters and Contemporary Realities ID', 'S2', 18),
  elective('INTR1012A', 'International Relations: An Introduction to the Discipline', 'S1', 18),
  elective('INTR1010A', 'The International Relations of South Africa and Africa', 'S2', 18),
  elective('LING1001A', 'Introduction to the Structure of Language I', 'S1', 18),
  elective('LING1003A', 'Language, Mind and Society', 'S2', 18),
  elective('MDST1000A', 'Media and Society 1A', 'S1', 18),
  elective('MDST1001A', 'Reading Media Forms 1B', 'S2', 18),
  elective('MDLL1003A', 'Basic French Language & Culture I', 'S1', 18),
  elective('MDLL1009A', 'Intermediate French Language & Culture I', 'S2', 18),
  elective('MDLL1004A', 'Basic German Language & Culture I', 'S1', 18),
  elective('MDLL1010A', 'Intermediate German Language & Culture I', 'S2', 18),
  elective('MDLL1005A', 'Basic Italian Language & Culture I', 'S1', 18),
  elective('MDLL1011A', 'Intermediate Italian Language & Culture I', 'S2', 18),
  elective('MDLL1006A', 'Basic Portuguese & Culture', 'S1', 18),
  elective('MDLL1012A', 'Intermediate Portuguese and Culture', 'S2', 18),
  elective('SASL1000A', 'South African Sign Language: Basic IA', 'S1', 18),
  elective('SASL1001A', 'South African Sign Language: Basic IB', 'S2', 18),
  elective('PHIL1003A', 'Introduction to Philosophy – Knowledge & Reality I', 'S1', 18),
  elective('PHIL1002A', 'Introduction to Ethics I', 'S2', 18),
  elective('POLS1007A', 'Introduction to Political Studies', 'S1', 18),
  elective('POLS1008A', 'States Power and Governance', 'S2', 18),
  elective('PSYC1009A', 'Psychology I', 'Y', 36),
  elective('SOCL1014A', 'Identity and Society I', 'S1', 18),
  elective('SOCL1013A', 'Southern Africa in the Era of Globalisation I', 'S2', 18),
];

/** The term the BA letter prints for a code (another faculty's record cites the letter for it). */
const baTerm = (code: string): Term => BA_MODULES.find((x) => x.code === code)?.semester;

// ── Engineering and the Built Environment: common first year ───────────────────────────────

const EBE_CORE: CurriculumModule[] = [
  m('CHEM1051A', 'Engineering Chemistry', NO_TERM, 12),
  m('FEBE1000A', 'Introduction to the Engineering Profession', NO_TERM, 12),
  m('FEBE1002A', 'Engineering Analysis and Design IA', NO_TERM, 12),
  m('FEBE1004A', 'Engineering Analysis and Design IB', NO_TERM, 12),
  m('MATH1048A', 'Engineering Mathematics IA', NO_TERM, 15),
  m('MATH1049A', 'Engineering Mathematics IB', NO_TERM, 15),
  m('PHYS1032A', 'Engineering Physics IA', NO_TERM, 18),
  m('PHYS1033A', 'Engineering Physics IB', NO_TERM, 18),
  m('PHYS1034A', 'Applied Physics I', NO_TERM, 12),
];
/** "A student shall also complete one of the following courses as may be offered in an academic year". */
const EBE_HUMANITIES: CurriculumModule[] = [
  elective('AFRL1003A', 'Elementary IsiZulu Language and Culture IA', baTerm('AFRL1003A'), 18),
  elective('AFRL1005A', 'Elementary Sesotho Language and Culture IA', baTerm('AFRL1005A'), 18),
  // The EBE book prints this name, which the BA letter gives INTR1010A: term left out.
  elective('INTR1012A', 'The International Relations of South Africa and Africa', NO_TERM, 18),
  elective('POLS1007A', 'Introduction to Political Studies', baTerm('POLS1007A'), 18),
  elective('SOCL1013A', 'Southern Africa in the Era of Globalisation', baTerm('SOCL1013A'), 18),
  elective('SOCL1014A', 'Identity and Society', baTerm('SOCL1014A'), 18),
  elective('PHIL1002A', 'Introduction to Ethics I', baTerm('PHIL1002A'), 18),
  elective(
    'PHIL1003A',
    'Introduction to Philosophy:  Knowledge and Reality',
    baTerm('PHIL1003A'),
    18,
  ),
  elective('HIST1011A', 'Global Encounters and Contemporary Realities IA', baTerm('HIST1011A'), 18),
];
const EBE_FIRST_YEAR = {
  ...EBE,
  yearOfStudy: 1 as const,
  modules: [...EBE_CORE, ...EBE_HUMANITIES],
  electiveGroups: [
    {
      label:
        'A student shall also complete one of the following courses as may be offered in an academic year',
      choose: { count: 1 },
      from: codes(EBE_HUMANITIES),
    },
  ],
  totalCredits: total(144),
  note: `All engineering branches share this first year. The EBE rule book prints no terms. Terms for AFRL1003A, AFRL1005A, POLS1007A, SOCL1013A, SOCL1014A, PHIL1002A, PHIL1003A and HIST1011A are from the 2026 BA General letter (${BA_LETTER}). INTR1012A has none: the EBE book names it "The International Relations of South Africa and Africa", which the BA letter gives to INTR1010A (it calls INTR1012A "International Relations: An Introduction to the Discipline"). ${SUM}`,
};

// ── Commerce, Law and Management ───────────────────────────────────────────────────────────

const CLM_NOTE = `The CLM rule book prints no terms. Part-time codes (e.g. ACCN1004A, ECON1013A) are left out. ${SUM}`;
const ECON_IA = m('ECON1012A', 'Economics IA - Microeconomics', NO_TERM, 18);
const ECON_IB = m('ECON1014A', 'Economics IB - Macroeconomics', NO_TERM, 18);
const LAW_I = m('LAWS1000A', 'Commercial Law I', NO_TERM, 18);
const APPM = m('APPM1004A', 'Computational Mathematics I', NO_TERM, 18);
const STATS = m('STAT1000A', 'Business Statistics I', NO_TERM, 18);
const INFO = [
  elective('INFO1000A', 'Information Systems IA', NO_TERM, 18),
  elective('INFO1004A', 'Fundamentals of Information Systems', NO_TERM, 18),
];
const INFO_GROUP = { label: 'and one of:', choose: { count: 1 }, from: codes(INFO) };

const BCOM_ECON = [
  elective('ECON1012A', 'Economics IA – Microeconomics', NO_TERM, 18),
  elective('ECON1014A', 'Economics IB – Macroeconomics', NO_TERM, 18),
  elective('ECON1016A', 'Economic Theory IA – Microeconomics for Economists', NO_TERM, 18),
  elective('ECON1018A', 'Economic Theory IB – Macroeconomics for Economists', NO_TERM, 18),
];

// ── Health Sciences ────────────────────────────────────────────────────────────────────────

const FIRST_AID = m('FAHS1898A', 'First Aid', NO_TERM, 0);
const COMPUTER_LITERACY = m('FAHS1997A', 'Computer Literacy', NO_TERM, 0);
const HS_NOTE = (covered: string) =>
  `The Health Sciences rule book prints no terms. ${covered} FAHS1898A First Aid and FAHS1997A Computer Literacy (0 credits, Rule M4) have no printed term. ${SUM}`;

export const witsCurricula: Curriculum[] = [
  {
    academicYear: 2026,
    sourceUrl: BA_LETTER,
    programmeId: 'wits-ba',
    programmeCode: 'ABA00',
    yearOfStudy: 1,
    modules: BA_MODULES,
    electiveGroups: [
      {
        label:
          'Select first-year courses and modules that total 144 credits (eight 18-credit modules, four 36-credit full-year courses, or a combination)',
        choose: { credits: 144 },
        from: codes(BA_MODULES),
      },
    ],
    totalCredits: total(144),
    note: `From the 2026 first-year BA General letter (curriculum planning and registration), which prints each module's semester, credits and timetable slot (A–E): no two modules on one slot in a semester, four modules a semester recommended, four subjects recommended (two become majors). Language rule: two first-year modules in isiZulu, Sesotho or SASL during the degree (strongly recommended in first year); a learner proficient in two of them may ask to take a modern language instead. The 2026 Humanities rule book (${DOCS}Hum_eBook.pdf, programme ABA00/ABA02) lists further BA majors not in this letter (e.g. Economics, Mathematics, History of Art, Spanish, Music in History and Society), so a module missing here may still be allowed. The letter prints "MDST1000A/" and "MDST1001A/" (trailing slash dropped here) and "Archeology".`,
  },
  {
    ...EBE_FIRST_YEAR,
    programmeId: 'wits-bsceng-civil',
    programmeCode: 'EFA01',
  },
  {
    ...EBE_FIRST_YEAR,
    programmeId: 'wits-bsceng-electrical',
    programmeCode: 'EFA03',
  },
  {
    ...CLM,
    programmeId: 'wits-baccsc',
    programmeCode: 'CBA08',
    yearOfStudy: 1,
    modules: [
      m('ACCN1009A', 'Accounting Information Systems', NO_TERM, 18),
      m('ACCN1010A', 'Financial Accounting I', NO_TERM, 30),
      ECON_IA,
      ECON_IB,
      LAW_I,
      APPM,
      STATS,
    ],
    electiveGroups: [],
    totalCredits: total(138),
    note: `${CLM_NOTE} A student who fails Financial Accounting I (ACCN1010A) twice must transfer to the BCom (CBA00) or the BCom in the field of Accounting (CBA14).`,
  },
  {
    ...CLM,
    programmeId: 'wits-bcom-accounting',
    programmeCode: 'CBA14',
    yearOfStudy: 1,
    modules: [
      m('ACCN1006A', 'Accounting I', NO_TERM, 36),
      m('ECON1012A', 'Economics IA – Microeconomics', NO_TERM, 18),
      m('ECON1014A', 'Economics IB – Macroeconomics', NO_TERM, 18),
      LAW_I,
      APPM,
      STATS,
      ...INFO,
    ],
    electiveGroups: [INFO_GROUP],
    totalCredits: total(144),
    note: `${CLM_NOTE} A student may transfer to the BAccSc with a 70% first-year average (excluding Accounting I) and at least 75% in Accounting I.`,
  },
  {
    ...CLM,
    programmeId: 'wits-bcom',
    programmeCode: 'CBA00',
    yearOfStudy: 1,
    modules: [
      m('ACCN1000A', 'Business Accounting I', NO_TERM, 36),
      APPM,
      STATS,
      LAW_I,
      ...BCOM_ECON,
      ...INFO,
    ],
    electiveGroups: [
      {
        label: 'Economics IA and Economics IB, or Economic Theory IA and Economic Theory IB',
        choose: {
          oneSetOf: [
            ['ECON1012A', 'ECON1014A'],
            ['ECON1016A', 'ECON1018A'],
          ],
        },
        from: codes(BCOM_ECON),
      },
      INFO_GROUP,
    ],
    totalCredits: total(144),
    note: `${CLM_NOTE} The book lists ECON1012A Economics IA, then ECON1014A Economics IB "or" ECON1016A Economic Theory IA and ECON1018A Economic Theory IB; read here as one pair or the other (36 credits): the group asks for one whole pair, never a mix. A student who wants to move to the BCom in the field of Accounting after first year must take Accounting I (ACCN1006A) instead of Business Accounting I.`,
  },
  {
    ...CLM,
    programmeId: 'wits-llb',
    programmeCode: 'LFA14',
    yearOfStudy: 1,
    modules: [
      m('LAWS1012A', 'Law of Persons', NO_TERM, 18),
      m('LAWS1013A', 'Family Law', NO_TERM, 36),
      m('LAWS1018A', 'Introduction to Law for LLB students', NO_TERM, 36),
      m('FCLM1995A', 'Computer Literacy Competence', NO_TERM, 0),
    ],
    electiveGroups: [],
    openElectiveCredits: {
      credits: 36,
      note: '"In addition, students must complete one or more courses from any other Faculty in the University to the value of 36 LLB credits"',
    },
    totalCredits: { min: 90, max: 126 },
    note: 'The CLM rule book prints no terms. "In addition, students must complete one or more courses from any other Faculty in the University to the value of 36 LLB credits" (free choice; ENGL1001A, ENGL1003A, ECON1012A, ECON1014A, ECON1002A, POLS1007A or POLS1008A recommended): recorded as 36 open elective credits, since no list can hold them. The minimum is the listed law modules (90) and the maximum adds the 36 (126); the rule says "must", so check whether the minimum should be 126. A year-long first-level course from another faculty counts 36 LLB credits, a half course 18.',
  },
  {
    ...HUM,
    programmeId: 'wits-bsw',
    programmeCode: 'AFA04',
    yearOfStudy: 1,
    modules: [
      m('SOCW1001A', 'Field Instruction in Social Work Practice I', NO_TERM, 18),
      m('SOCW1005A', 'Introduction to Social Work Theory and Practice', NO_TERM, 36),
      m('PSYC1009A', 'Psychology I', baTerm('PSYC1009A'), 36),
      m('SOCL1013A', 'Southern Africa in the Era of Globalisation I', baTerm('SOCL1013A'), 18),
      m('SOCL1014A', 'Identity and Society', baTerm('SOCL1014A'), 18),
      elective('ANTH1006A', 'Culture and Humanity', baTerm('ANTH1006A'), 18),
      elective('ANTH1007A', 'Practices of Identification', baTerm('ANTH1007A'), 18),
      elective('SASL1000A', 'South African Sign Language: Basic IA', baTerm('SASL1000A'), 18),
      elective('SASL1001A', 'South African Sign Language: Basic IB', baTerm('SASL1001A'), 18),
    ],
    electiveGroups: [
      {
        label:
          'A student must select either a) ANTH1006A and ANTH1007A or b) SASL1000A and SASL1001A',
        choose: {
          oneSetOf: [
            ['ANTH1006A', 'ANTH1007A'],
            ['SASL1000A', 'SASL1001A'],
          ],
        },
        from: ['ANTH1006A', 'ANTH1007A', 'SASL1000A', 'SASL1001A'],
      },
    ],
    totalCredits: total(162),
    note: `The Humanities rule book prints no terms. Terms for PSYC1009A, SOCL1013A, SOCL1014A, ANTH1006A, ANTH1007A, SASL1000A and SASL1001A are from the 2026 BA General letter (${BA_LETTER}); SOCW1001A and SOCW1005A have none. The group asks for one whole pair (a or b), never a mix. ${SUM}`,
  },
  {
    ...EDU,
    programmeId: 'wits-bed-foundation-phase',
    programmeCode: 'HFA00',
    yearOfStudy: 1,
    modules: [
      m('EDUC1248A', 'Education IA', NO_TERM, 6),
      m('EDUC1249A', 'Education IB', NO_TERM, 18),
      m('EDUC1252A', 'Childhood Studies I', NO_TERM, 24),
      m('EDUC1250A', 'Mathematics for Primary School Teachers I', NO_TERM, 12),
      m('EDUC1251A', 'Literacy for Primary School Teachers I', NO_TERM, 12),
      m('EDUC1261A', 'Teaching Experience IA', NO_TERM, 6),
      m('EDUC1262A', 'Teaching Experience IB', NO_TERM, 6),
      m('EDUC1311A', 'Being a Foundation Phase Teacher A', NO_TERM, 6),
      m('EDUC1312A', 'Being a Foundation Phase Teacher B', NO_TERM, 6),
      m('EDUC1255A', 'Arts for Teachers', NO_TERM, 12),
      elective('EDUC1260A', 'ICT Literacy', NO_TERM, 12),
      elective('EDUC1257A', 'Fun with Choir', NO_TERM, 12),
      elective('EDUC1256A', 'Physical Activity and Sports in Schools', NO_TERM, 12),
      elective('EDUC1259A', 'Financial Planning and Entrepreneurship', NO_TERM, 12),
      elective('EDUC1316A', 'Learning in and through Art', NO_TERM, 12),
      elective('EDUC1317A', 'Learning in and through Drama', NO_TERM, 12),
    ],
    electiveGroups: [
      {
        label: 'Select one of the following courses subject to the following conditions',
        choose: { count: 1 },
        from: ['EDUC1260A', 'EDUC1257A', 'EDUC1256A', 'EDUC1259A', 'EDUC1316A', 'EDUC1317A'],
      },
    ],
    totalCredits: total(120),
    note: `The Education rule book prints no terms. The choice is conditional: a student "unable to demonstrate existing competence in ICT" takes EDUC1260A ICT Literacy; everyone else picks one of the other five. EDUC1263A Additional Teaching Experience I (0 credits) is taken "only by School instruction" and is left out. ${SUM}`,
  },
  {
    ...HEALTH,
    programmeId: 'wits-mbbch',
    programmeCode: 'MFA00',
    yearOfStudy: 1,
    modules: [
      m('ISMS1000A', 'Integrated Sciences for Medical Students', NO_TERM, 72),
      m('FAMH1003A', 'Foundations of Public Health and Health Systems Science', 'S1', 18),
      m('FAMH1004A', 'The Science and Art of Health and Learning', NO_TERM, 28),
      m('FAMH1002A', 'Person, Family and Community I', 'S2', 26),
      FIRST_AID,
      COMPUTER_LITERACY,
    ],
    electiveGroups: [],
    totalCredits: total(144),
    note: HS_NOTE(
      `FAMH1003A's term (first-semester timetable only) is from the 2026 first-year timetable (${HS_TIMETABLE}); FAMH1002A ("offered in the second semester") from the 2026 first-lecture document (${HS_FIRST_LECTURE}). ISMS1000A and FAMH1004A have none: they are on both semesters' timetables, which could mean year-long or either semester, and no document says "full year". Plan code MPAMBS22.`,
    ),
  },
  {
    ...HEALTH,
    programmeId: 'wits-bpharm',
    programmeCode: 'MFA04',
    yearOfStudy: 1,
    modules: [
      m('APES1000A', 'Introduction to Medical Science', 'S1', 18),
      m('CHEM1048A', 'Chemistry I', 'Y', 36),
      m('PHYS1008A', 'Physics I', NO_TERM, 18),
      m('PACY1000A', 'Pharmaceutical Practice', NO_TERM, 36),
      m('FAMH1001A', 'Health Systems Sciences I', 'S2', 18),
      FIRST_AID,
      COMPUTER_LITERACY,
    ],
    electiveGroups: [],
    totalCredits: total(126),
    note: HS_NOTE(
      `CHEM1048A is Y from the rule book's own syllabus ("an existing full year course"). APES1000A's term (first-semester timetable only) is from the 2026 first-year timetable (${HS_TIMETABLE}); FAMH1001A ("offered in the second semester") from the 2026 first-lecture document (${HS_FIRST_LECTURE}). PACY1000A and PHYS1008A have none: both are on both semesters' timetables, which could mean year-long or either semester, and no document says "full year" (the first-lecture document calls PHYS1008A a "half course"). The rule book prints "Chemistry l" and "Physics l" (a lower-case L), written "I" here.`,
    ),
  },
  {
    ...HEALTH,
    programmeId: 'wits-bnurs',
    programmeCode: 'MFA07',
    yearOfStudy: 1,
    modules: [
      m('APES1000A', 'Introduction to Medical Sciences', 'S1', 18),
      m('SOCL1012A', 'Human Behavioural Sciences I', 'S2', 18),
      m('NRSE1002A', 'Integrated General Nursing Sciences I', NO_TERM, 64),
      m('ANAT2005A', 'Anatomy for Nursing Sciences I', 'S2', 24),
      FIRST_AID,
      COMPUTER_LITERACY,
    ],
    electiveGroups: [],
    totalCredits: total(124),
    note: HS_NOTE(
      `Terms for APES1000A (first-semester timetable only) and ANAT2005A (second-semester timetable only) are from the 2026 first-year timetable (${HS_TIMETABLE}); SOCL1012A ("offered in the second semester") from the 2026 first-lecture document (${HS_FIRST_LECTURE}). NRSE1002A has none: it is on both semesters' timetables, which could mean year-long or either semester, and no document says "full year".`,
    ),
  },
];
