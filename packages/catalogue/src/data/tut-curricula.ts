import type { Curriculum, CurriculumModule } from '../curriculum';

/**
 * Tshwane University of Technology (TUT): first-year curricula, one record per programme and
 * rule-book year (planning.md §11, Phase 5c).
 *
 * Fill this array only: the catalogue already reads it, and the catalogue tests validate every
 * record added here. Schema and field notes: `packages/catalogue/src/curriculum.ts`.
 * - `programmeId` is an id from data/tut.ts; `sourceUrl` is the faculty rule book or
 *   programme page on tut.ac.za; `academicYear` is the year the rule book is for.
 * - Modules as printed (code, name, semester, credits, compulsory). Electives are modules with
 *   `compulsory: false`, named in an elective group. Credit totals as published.
 * - Never add `verifiedOn`/`verifiedBy`: a person does. A programme with no published
 *   first-year curriculum gets no record.
 *
 * DRAFT: researched on 2026-10-16 from TUT's 2026 Prospectus, Parts 3–8 ("This Prospectus is
 * valid for 2026 only"); the 2027 parts were not yet published. Module names are copied without
 * the prospectus's footnote asterisks ("Information does not correspond to SAQA registration
 * certificate").
 *
 * How the semester is read: each prospectus curriculum lists some first-year modules under
 * "FIRST YEAR" before the "FIRST SEMESTER" heading, with no term printed. Those have no
 * `semester` (`NO_TERM`): the term is never guessed, and the registration check says nothing about
 * when they are taken. Every record with such a module says so in its note. Modules printed
 * "(first- or second-semester module)" are `either`; no first-year module is printed as a year
 * module, so none is `Y`.
 */

const PROSPECTUS = 'https://www.tut.ac.za/media/tshwane-interim/site-content/images/prospectus/';
const year2026 = (part: string) =>
  ({ sourceUrl: `${PROSPECTUS}${part}`, academicYear: 2026 }) as const;
const ICT = year2026('Part6_ICT_Prospectus.pdf');
const FEBE = year2026('Part4_FEBE_Prospectus.pdf');
const SCIENCE = year2026('Part8_Science.pdf');
const ECONOMICS = year2026('Part3_Economics-and-Finance_Prospectus.pdf');
const HUMANITIES = year2026('PART_5_Humanities_Prospectus_-2026.pdf');
const MANAGEMENT = year2026('Part7_Management-Sciences_Prospectus.pdf');

type Term = CurriculumModule['semester'];
/** The prospectus prints no term for the module: the record leaves `semester` out. */
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
): CurriculumModule => ({
  ...m(code, name, semester, credits),
  compulsory: false,
});

const YEAR_LIST =
  'The prospectus prints no term for the modules listed under "FIRST YEAR" before the semester headings, so they have none here.';
const total = (credits: number) => ({ min: credits, max: credits });

export const tutCurricula: Curriculum[] = [
  {
    ...ICT,
    programmeId: 'tut-dip-information-technology',
    programmeCode: 'DPIT20',
    yearOfStudy: 1,
    modules: [
      m('16E105X', 'Communication for Academic purpose', NO_TERM, 10),
      m('INF125D', 'Information Literacy (block module)', NO_TERM, 3),
      m('LFS125X', 'Life Skills (block module)', NO_TERM, 2),
      m('CHO115D', 'Computational Mathematics', 'S1', 15),
      m('CN1115D', 'Computer Networks 115R', 'S1', 15),
      m('TRO115D', 'Introduction to Programming 115R', 'either', 15),
      m('CAT116D', 'Computer Architecture 125R', 'S2', 15),
      m('CN2115D', 'Computer Networks 125R', 'S2', 15),
      m('DSM116D', 'Discrete Mathematics 115R', 'S2', 15),
      m('PPG115D', 'Principles of Programming 125R', 'either', 15),
    ],
    electiveGroups: [],
    totalCredits: total(120),
    note: `${YEAR_LIST} The prospectus adds "Modules are offered as determined by the Head of the Department." Introduction to Programming 115R is printed under the first semester and Principles of Programming 125R under the second, each marked "(first- or second-semester module)".`,
  },
  {
    ...ICT,
    programmeId: 'tut-dip-information-technology-extended',
    programmeCode: 'DPITF0',
    yearOfStudy: 1,
    modules: [
      m('CHOF05D', 'Computational Mathematics', NO_TERM, 15),
      m('CN1F05D', 'Computer Networks 115R', NO_TERM, 15),
      m('COEF05X', 'Communication for Academic Purpose', NO_TERM, 10),
      m('INFF25D', 'Information Literacy (block module)', NO_TERM, 3),
      m('LFS125X', 'Life Skills (block module)', NO_TERM, 2),
      m('TROF05D', 'Introduction to Programming 115R', NO_TERM, 15),
    ],
    electiveGroups: [],
    totalCredits: total(60),
    note: "The extended programme's first year prints no semester headings and no terms, so no module has a term here.",
  },
  {
    ...ICT,
    programmeId: 'tut-dip-computer-science',
    programmeCode: 'DPRS20',
    yearOfStudy: 1,
    modules: [
      m('16P105X', 'Communication for Academic Purposes', NO_TERM, 10),
      m('INF125D', 'Information Literacy (block module)', NO_TERM, 3),
      m('LFS125X', 'Life Skills (block module)', NO_TERM, 2),
      m('CFA115D', 'Computing Fundamentals A', 'S1', 15),
      m('COH115D', 'Computational Mathematics', 'S1', 15),
      m('PPA115D', 'Principles of Programming A', 'either', 15),
      m('CFB115D', 'Computing Fundamentals B', 'S2', 15),
      m('DCT115D', 'Discrete Structures', 'S2', 15),
      m('PPB115D', 'Principles of Programming B', 'either', 15),
      m('WEB115D', 'Web Computing', 'S2', 15),
    ],
    electiveGroups: [],
    totalCredits: total(120),
    note: `${YEAR_LIST} Principles of Programming A is printed under the first semester and B under the second, each marked "(first- or second-semester module)". Offered at Soshanguve South, eMalahleni and Polokwane with one curriculum.`,
  },
  {
    ...FEBE,
    programmeId: 'tut-dip-civil-engineering',
    programmeCode: 'DPCE26',
    yearOfStudy: 1,
    modules: [
      m('INL125C', 'Information Literacy (block module)', NO_TERM, 1),
      m('LFS125X', 'Life Skills (block module)', NO_TERM, 2),
      m('CEM115D', 'Civil Engineering Materials', 'S1', 14),
      m('COL115D', 'Computer Literacy', 'S1', 7),
      m('COS115D', 'Communication Skills', 'S1', 8),
      m('MHT115D', 'Mathematics I', 'S1', 14),
      m('SEH115D', 'Chemistry', 'S1', 8),
      m('SEM115D', 'Mechanics', 'S1', 10),
      m('SEP115D', 'Physics', 'S1', 14),
      m('CSP115D', 'Construction Principles', 'S2', 14),
      m('EGC115D', 'Engineering Graphics', 'S2', 14),
      m('MGC115D', 'Management: Civil', 'S2', 14),
      m('TST115D', 'Theory of Structures', 'S2', 14),
    ],
    electiveGroups: [],
    totalCredits: total(134),
    note: YEAR_LIST,
  },
  {
    ...FEBE,
    programmeId: 'tut-bengtech-electrical-engineering',
    programmeCode: 'BPEE19',
    yearOfStudy: 1,
    modules: [
      m('1EM105B', 'Mechanics', NO_TERM, 10),
      m('COL105X', 'Computer Literacy', NO_TERM, 5),
      m('COS105X', 'Communication Skills', NO_TERM, 6),
      m('EGE105B', 'Engineering Graphics', NO_TERM, 14),
      m('ELC105B', 'Electrical Circuits', NO_TERM, 28),
      m('ELS105B', 'Electronic Circuits', NO_TERM, 28),
      m('INL125C', 'Information Literacy (block module)', NO_TERM, 1),
      m('LFS125X', 'Life Skills (block module)', NO_TERM, 2),
      m('EM115AB', 'Engineering Mathematics IA', 'either', 14),
      m('SEP115B', 'Physics', 'S1', 10),
      m('EM115BB', 'Engineering Mathematics IB', 'either', 14),
      m('SEC115B', 'Chemistry', 'S2', 8),
    ],
    electiveGroups: [],
    totalCredits: total(140),
    note: `${YEAR_LIST} Engineering Mathematics IA is printed under the first semester and IB under the second, each marked "(first- or second-semester module)"; IA is IB's prerequisite.`,
  },
  {
    ...FEBE,
    programmeId: 'tut-dip-electrical-engineering',
    programmeCode: 'DPEE20',
    yearOfStudy: 1,
    modules: [
      m('COL115X', 'Computer Literacy', 'S1', 5),
      m('COS115X', 'Communication Skills', 'S1', 5),
      m('DSA115D', 'Digital Systems IA', 'S1', 12),
      m('EEA115D', 'Electrical Engineering IA', 'S1', 12),
      m('ETA115D', 'Electronics IA', 'S1', 12),
      m('LFS125X', 'Life Skills (block module)', 'S1', 2),
      m('MHA115D', 'Mathematics IA', 'S1', 12),
      m('EEB115D', 'Electrical Engineering IB', 'S2', 12),
      m('ETB115D', 'Electronics IB', 'S2', 12),
      m('MEC115D', 'Mechanics', 'S2', 12),
      m('MHB115D', 'Mathematics IB', 'S2', 12),
      m('SFD115D', 'Software Design', 'S2', 12),
    ],
    electiveGroups: [],
    totalCredits: total(120),
    note: 'Every first-year module is printed under a semester heading; Life Skills (block module) is under the first semester. The prospectus also allows a July intake on Pretoria Campus only.',
  },
  {
    ...SCIENCE,
    programmeId: 'tut-bnursing',
    programmeCode: 'BPNS20',
    yearOfStudy: 1,
    modules: [
      m('ALI125X', 'Academic Literacy (block module)', NO_TERM, 2),
      m('CNR105P', 'Clinical Nurse Training I (WIL)', NO_TERM, 25),
      m('COE105X', 'Communication for Academic Purpose', NO_TERM, 10),
      m('CPL105X', 'Computer Literacy', NO_TERM, 10),
      m('LFS125X', 'Life Skills (block module)', NO_TERM, 2),
      m('NTP105P', 'Nursing Theory and Practice I', NO_TERM, 24),
      m('GA1115P', 'General Anatomy I', 'S1', 12),
      m('GPY115P', 'General Physiology I', 'S1', 12),
      m('NRE115P', 'Nursing Ethos and Professional Practice I', 'S1', 6),
      m('GA2116P', 'General Anatomy II', 'S2', 12),
      m('GMB115P', 'General Microbiology', 'S2', 6),
      m('IPN115P', 'Introduction to Pharmacology in Nursing', 'S2', 6),
    ],
    electiveGroups: [],
    totalCredits: total(127),
    note: YEAR_LIST,
  },
  {
    ...SCIENCE,
    programmeId: 'tut-bpharm',
    programmeCode: 'BPPH26',
    yearOfStudy: 1,
    modules: [
      m('ATM125P', 'From Atoms to Molecules', NO_TERM, 15),
      m(
        'IBP125P',
        'Introduction to Biopharmaceutics, Pharmacokinetics and Pharmacodynamics',
        NO_TERM,
        21,
      ),
      m('MOM125P', 'Microorganisms, Man and Medicines', NO_TERM, 21),
      m('MTM125P', 'From Molecules to Medicines', NO_TERM, 21),
      m('NAG125P', 'Nutrition and Gastroenterology', NO_TERM, 21),
      m(
        'OPP125P',
        'Orientation and Introduction to the Practice of Pharmacy in South Africa',
        NO_TERM,
        21,
      ),
    ],
    electiveGroups: [],
    totalCredits: total(120),
    note: 'The prospectus prints "Modules are offered in blocks as determined by the Department." and no semesters or block dates, so no module has a term here. Qualification code BPPH26 (section 13.3, Arcadia Campus); the same Part 8 also lists a BPPH01 Bachelor of Pharmacy in a later section, which was not used.',
  },
  {
    ...ECONOMICS,
    programmeId: 'tut-dip-accounting',
    programmeCode: 'DPAG20',
    yearOfStudy: 1,
    modules: [
      m('ACL125X', 'Academic Literacy I (block module)', NO_TERM, 2),
      m('CPL105X', 'Computer Literacy', NO_TERM, 10),
      m('LFS125X', 'Life Skills (block module)', NO_TERM, 2),
      m('PAG105D', 'Professional Standards and Ethics I', NO_TERM, 12),
      m('WAG105D', 'WIL in Accounting I (Simulation)', NO_TERM, 12),
      m('CUA115X', 'Communication for Academic Purposes I', 'S1', 10),
      m('FAA115D', 'Financial Accounting IA', 'S1', 12),
      m('MIC115D', 'Microeconomics I', 'S1', 12),
      m('BMD115D', 'Business Mathematics I', 'S2', 12),
      m('BSM115D', 'Business Management I', 'S2', 12),
      m('FAB115D', 'Financial Accounting IB', 'S2', 12),
      m('MAE115D', 'Macroeconomic I', 'S2', 12),
    ],
    electiveGroups: [],
    totalCredits: total(120),
    note: YEAR_LIST,
  },
  {
    ...ECONOMICS,
    programmeId: 'tut-dip-internal-auditing',
    programmeCode: 'DPIA20',
    yearOfStudy: 1,
    modules: [
      m('CPL105X', 'Computer Literacy', NO_TERM, 10),
      m('IIL125D', 'Introduction to Information Literacy I (block module)', NO_TERM, 2),
      m('LFS125X', 'Life skills (block module)', NO_TERM, 2),
      m('CGV115D', 'Corporate Governance I', 'S1', 12),
      m('CUA115X', 'Communication for Academic Purposes I', 'S1', 10),
      m('FAA115D', 'Financial Accounting IA', 'S1', 12),
      m('WIU115D', 'WIL (Simulation) I', 'S1', 12),
      m('BCS115D', 'Business Communications I', 'S2', 12),
      m('BIY115D', 'Business Information Systems I', 'S2', 12),
      m('BMD115D', 'Business Mathematics I', 'S2', 12),
      m('FAB115D', 'Financial Accounting IB', 'S2', 12),
      m('PSG115D', 'Public Sector Governance, Control and Auditing I', 'S2', 12),
    ],
    electiveGroups: [],
    totalCredits: total(120),
    note: YEAR_LIST,
  },
  {
    ...HUMANITIES,
    programmeId: 'tut-bed-foundation-phase',
    programmeCode: 'BPFN20',
    yearOfStudy: 1,
    modules: [
      m('ALY105P', 'Academic Literacy and Life Skills', NO_TERM, 10),
      m('CLM116P', 'Classroom Management I', 'S1', 5),
      m('FEH106P', 'FAL: English I', NO_TERM, 6),
      m('FEL106P', 'FAL: English: Didactics I', NO_TERM, 6),
      m('FMD106P', 'Foundation Phase Mathematics: Didactics I', NO_TERM, 6),
      m('FNS105P', 'School-based Learning I (6 weeks)', NO_TERM, 12),
      m('FPM106P', 'Foundation Phase Mathematics I', NO_TERM, 6),
      m('ITE105P', 'ICT in Education I', NO_TERM, 8),
      m('LEU106P', 'Literacy in Education I', NO_TERM, 10),
      m('LFD106P', 'Life Skills: Didactics I', NO_TERM, 6),
      m('LFK106P', 'Life Skills I', NO_TERM, 6),
      m('PST106P', 'Professional Studies I', NO_TERM, 11),
      m('TEC106P', 'Theory of Education I (Curriculum Studies)', NO_TERM, 22),
      elective('HSI106P', 'Home Language: Sepedi I', NO_TERM, 6),
      elective('HTN106P', 'Home Language: Setswana I', NO_TERM, 6),
      elective('HTS106P', 'Home Language: Xitsonga I', NO_TERM, 6),
      elective('HZL106P', 'Home Language: isiZulu I', NO_TERM, 6),
      elective('HID106P', 'Home Language: Xitsonga: Didactics I', NO_TERM, 6),
      elective('HPD106P', 'Home Language: Sepedi: Didactics I', NO_TERM, 6),
      elective('HUD106P', 'Home Language: isiZulu: Didactics I', NO_TERM, 6),
      elective('HWD106P', 'Home Language: Setswana: Didactics I', NO_TERM, 6),
    ],
    electiveGroups: [
      {
        label: 'plus one of the following Home Language electives',
        choose: { count: 1 },
        from: ['HSI106P', 'HTN106P', 'HTS106P', 'HZL106P'],
      },
      {
        label:
          'plus one of the following Home Language Didactics relating to the above chosen module',
        choose: { count: 1 },
        from: ['HID106P', 'HPD106P', 'HUD106P', 'HWD106P'],
      },
    ],
    totalCredits: total(126),
    note: `The first year prints no semester headings; Classroom Management I is marked "(first-semester module)"; the rest have no printed term, so none here. The Didactics module must be in the same language as the chosen Home Language module, which the elective groups can't express. Language of Conversational Competence (LoCC) rules are printed, but no LoCC module is listed in the first year.`,
  },
  {
    ...HUMANITIES,
    programmeId: 'tut-dip-policing',
    programmeCode: 'DPPO20',
    yearOfStudy: 1,
    modules: [
      m('CAP105X', 'Communication for Academic Purposes', NO_TERM, 10),
      m('CPL105X', 'Computer Literacy', NO_TERM, 10),
      m('INI125D', 'Information Literacy I (block module)', NO_TERM, 2),
      m('LFS125X', 'Life Skills (block module)', NO_TERM, 2),
      m('ICA115D', 'Investigation of Crime IA', 'S1', 13),
      m('LPA115D', 'Law Policing IA', 'S1', 12),
      m('POA115D', 'Policing IA', 'S1', 13),
      elective('CPA115D', 'Criminology in Policing IA', 'S1', 10),
      elective('OPA115D', 'Operational Management Principles IA', 'S1', 10),
      m('ICB115D', 'Investigation of Crime IB', 'S2', 13),
      m('LPB115D', 'Law Policing IB', 'S2', 12),
      m('POB115D', 'Policing IB', 'S2', 13),
      elective('CPB115D', 'Criminology in Policing IB', 'S2', 10),
      elective('OPB115D', 'Operational Management Principles IB', 'S2', 10),
    ],
    electiveGroups: [
      {
        label: 'First semester: plus one of the following electives',
        choose: { count: 1 },
        from: ['CPA115D', 'OPA115D'],
      },
      {
        label: 'Second semester: plus one of the following electives',
        choose: { count: 1 },
        from: ['CPB115D', 'OPB115D'],
      },
    ],
    totalCredits: total(120),
    note: `${YEAR_LIST} This is "OPTION 1: SOSHANGUVE SOUTH CAMPUS (DPPO20)"; the qualification code is printed "DPPOO0 / DPPO20" (DPPOO0 is the distance/online option). Each second-semester elective has the matching first-semester one as its prerequisite.`,
  },
  {
    ...HUMANITIES,
    programmeId: 'tut-dip-law',
    programmeCode: 'DPLW20',
    yearOfStudy: 1,
    modules: [
      m('CAP105X', 'Communication for Academic Purposes', NO_TERM, 10),
      m('CPL105X', 'Computer Literacy', NO_TERM, 10),
      m('ILS125D', 'Information Literacy Skills (block module)', NO_TERM, 2),
      m('LED105D', 'Legal Drafting I', NO_TERM, 16),
      m('LFS125X', 'Life Skills (block module)', NO_TERM, 2),
      m('LPP105D', 'Legal Practice for Paralegals', NO_TERM, 20),
      m('SLP105D', 'Skills for Law Practitioners', NO_TERM, 12),
      m('WLW105D', 'Simulation in Law I', NO_TERM, 12),
      m('ISA115D', 'Introduction to South African Law', 'S1', 12),
      m('CHL115D', 'Constitutional and Human Rights Law', 'S2', 12),
      m('PFL115D', 'Persons and Family Law', 'S2', 12),
    ],
    electiveGroups: [],
    totalCredits: total(120),
    note: YEAR_LIST,
  },
  {
    ...MANAGEMENT,
    programmeId: 'tut-dip-marketing',
    programmeCode: 'DPMK19',
    yearOfStudy: 1,
    modules: [
      m('BSM105D', 'Business Management I', NO_TERM, 24),
      m('INI125D', 'Information Literacy I (block module)', NO_TERM, 2),
      m('LFS125X', 'Life Skills (block module)', NO_TERM, 2),
      m('MKT105D', 'Marketing I', NO_TERM, 24),
      m('PFS105D', 'Professional Selling I', NO_TERM, 24),
      m('CAP115X', 'Communication for Academic Purposes', 'S1', 10),
      m('CPL115X', 'Computer Literacy', 'S1', 10),
      m('COP216X', 'Communication for Occupational Purposes', 'S2', 8),
      m('CPL215X', 'Computer Literacy II', 'S2', 12),
    ],
    electiveGroups: [],
    totalCredits: total(116),
    note: YEAR_LIST,
  },
  {
    ...MANAGEMENT,
    programmeId: 'tut-dip-hospitality-management',
    programmeCode: 'DPHM19',
    yearOfStudy: 1,
    modules: [
      m('CAP105X', 'Communication for Academic Purposes', NO_TERM, 10),
      m('CPL105X', 'Computer Literacy', NO_TERM, 10),
      m('CSN105D', 'Culinary Studies and Nutrition I', NO_TERM, 30),
      m('HFM105D', 'Hospitality Financial Management I', NO_TERM, 21),
      m('INL125X', 'Information Literacy (block module)', NO_TERM, 2),
      m('LFS125X', 'Life Skills (block module)', NO_TERM, 2),
      m('FBS115D', 'Food and Beverage Studies I', 'S1', 15),
      m('HHS115D', 'Hospitality Health and Safety I', 'S1', 7),
      m('ACM115D', 'Accommodation Management I', 'S2', 8),
      m('HMN115D', 'Hospitality Management I', 'S2', 15),
    ],
    electiveGroups: [],
    totalCredits: total(120),
    note: YEAR_LIST,
  },
];
