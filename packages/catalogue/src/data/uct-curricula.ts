import type { Curriculum, CurriculumModule } from '../curriculum';

/**
 * University of Cape Town (UCT): first-year curricula, one record per programme and
 * rule-book year (planning.md §11, Phase 5c).
 *
 * Fill this array only: the catalogue already reads it, and the catalogue tests validate every
 * record added here. Schema and field notes: `packages/catalogue/src/curriculum.ts`.
 * - `programmeId` is an id from data/uct.ts; `sourceUrl` is the faculty rule book or
 *   programme page on uct.ac.za; `academicYear` is the year the rule book is for.
 * - Modules as printed (code, name, semester, credits, compulsory). Electives are modules with
 *   `compulsory: false`, named in an elective group. Credit totals as published.
 * - Never add `verifiedOn`/`verifiedBy`: a person does. A programme with no published
 *   first-year curriculum gets no record.
 *
 * DRAFT: researched on 2026-10-16 from UCT's 2026 faculty handbooks (and the Health Sciences
 * errata). Not yet verified by a person (hard rule 3).
 *
 * Semesters come from the course-code suffix, which each handbook defines: F first semester (S1),
 * S second semester (S2), H and W taught over the whole year (Y). X ("not classified") and Z
 * ("other") are not terms, so such a module has no semester. A code printed "F/S" is offered in
 * either semester, and a registration shows the F or the S code: it is recorded as the F code with
 * the S code as an alternative, semester `either`.
 *
 * Held back (see the research report): BSc Computer Science (no first-year credit total is
 * published), LLB, BA/BSocSc general and extended, BCom general and the EDU programme (free
 * electives or several specialisations the schema can't hold as one record).
 */

const ENGINEERING =
  'https://uct.ac.za/sites/default/files/media/documents/2026-ebe-handbook-7a-final-web.pdf';

const COMMERCE =
  'https://uct.ac.za/sites/default/files/media/documents/2026-commerce-handbook-6a-final-web.pdf';
const HEALTH =
  'https://uct.ac.za/sites/default/files/media/documents/2026-fhs-handbook-8a-final-web.pdf';
const HEALTH_ERRATA =
  'https://uct.ac.za/sites/default/files/media/documents/uct_ac_za/49/errata-in-the-health-sciences-undergraduate-handbook-v2-2026.docx';
const HUMANITIES =
  'https://uct.ac.za/sites/default/files/media/documents/2026-hum-handbook-9a-final-web.pdf';

const core = (
  code: string,
  name: string,
  semester: CurriculumModule['semester'],
  credits: number,
): CurriculumModule => ({ code, name, semester, credits, compulsory: true });
const elective = (
  code: string,
  name: string,
  semester: CurriculumModule['semester'],
  credits: number,
): CurriculumModule => ({ code, name, semester, credits, compulsory: false });
/** Printed "ECO1010F/S": the F code, with the S code as an alternative, in either semester. */
const eitherSemester = (
  printed: string,
  name: string,
  credits: number,
  compulsory: boolean,
): CurriculumModule => {
  const base = printed.replace(/F\/S$/, '');
  return {
    code: `${base}F`,
    alternativeCodes: [`${base}S`],
    name,
    semester: 'either',
    credits,
    compulsory,
  };
};
/** A compulsory module whose code suffix (X or Z) is not a term: no semester is recorded. */
const coreNoTerm = (code: string, name: string, credits: number): CurriculumModule => ({
  code,
  name,
  credits,
  compulsory: true,
});

const EITHER_SEMESTER_NOTE =
  'Codes printed "F/S" (offered in either semester) are recorded as the F code with the S code as an alternative.';

export const uctCurricula: Curriculum[] = [
  {
    sourceUrl: HEALTH,
    academicYear: 2026,
    programmeId: 'uct-mbchb',
    programmeCode: 'MB014',
    yearOfStudy: 1,
    modules: [
      core('PPH1001F', 'Becoming a Professional', 'S1', 15),
      core('HUB1006F', 'Introduction to Integrated Health Sciences: Part I', 'S1', 30),
      core('CEM1011F', 'Chemistry for Medical Students', 'S1', 18),
      core('PHY1025F', 'Physics', 'S1', 18),
      core('PPH1002S', 'Becoming a Health Professional', 'S2', 15),
      core('IBS1007S', 'Introduction to Integrated Health Sciences: Part II', 'S2', 35),
      core('SLL1044S', 'Beginners Afrikaans for MBChB', 'S2', 18),
      core('SLL1041S', 'Beginners isiXhosa for MBChB', 'S2', 18),
    ],
    electiveGroups: [],
    totalCredits: { min: 167, max: 167 },
    note: 'Rule FBA3.1, "Total credits for year 1: 167". FBA3.2: all first-years register for both SLL1044S and SLL1041S; a student wishing to be credited and exempted must notify the course convener by the end of the fourth week of the first semester. Printed programme code "[MB014/MB020]" (MB020 is the Fundamentals of Health Sciences route).',
  },
  {
    sourceUrl: HEALTH_ERRATA,
    academicYear: 2026,
    programmeId: 'uct-bsc-physiotherapy',
    programmeCode: 'MB004AHS08',
    yearOfStudy: 1,
    modules: [
      core('PPH1001F', 'Becoming a Professional', 'S1', 15),
      elective('PSY1004F', 'Introduction to Psychology Part 1', 'S1', 18),
      elective('PSY1009F', 'Introduction to Psychology Part 1', 'S1', 15),
      core('HUB1019F', 'Anatomy and Physiology IA', 'S1', 18),
      core('HUB1022F', 'Biosciences for Physiotherapy IA', 'S1', 9),
      core('AHS1033F', 'Movement Science I', 'S1', 18),
      core('PPH1002S', 'Becoming a Health Professional', 'S2', 15),
      core('HUB1020S', 'Anatomy and Physiology IB', 'S2', 18),
      core('HUB1023S', 'Biosciences for Physiotherapy IB', 'S2', 9),
      core('AHS1034S', 'Introduction to Applied Physiotherapy', 'S2', 22),
    ],
    electiveGroups: [
      {
        label: 'Introduction to Psychology Part 1: PSY1004F or PSY1009F',
        choose: { count: 1 },
        from: ['PSY1004F', 'PSY1009F'],
      },
    ],
    totalCredits: { min: 142, max: 142 },
    note: 'From the 2026 Health Sciences errata (v2), which replaces handbook page 60 (FBF2.1). The original handbook lists PSY1004F (18 credits) only; the errata lists both PSY1004F (18) and PSY1009F (15) and keeps "Total NQF credits for year 1: 142", which only adds up with PSY1004F. The Humanities handbook says PSY1009F replaces PSY1004F from 2026. The one-of group is the researcher’s reading of that: check which one a 2026 first-year takes. Printed programme code "[MB004AHS08/MB017]".',
  },
  {
    sourceUrl: COMMERCE,
    academicYear: 2026,
    programmeId: 'uct-bcom-financial-accounting-ca',
    programmeCode: 'CB001ACC04',
    yearOfStudy: 1,
    modules: [
      core('ACC1006F', 'Financial Accounting', 'S1', 18),
      core('ACC1015F', 'Business Acumen for Accountants', 'S1', 15),
      eitherSemester('ECO1010F/S', 'Microeconomics', 18, true),
      core('MAM1010F', 'Mathematics 1010', 'S1', 18),
      core('ACC1011S', 'Financial Reporting I', 'S2', 18),
      core('ECO1011S', 'Macroeconomics', 'S2', 18),
      eitherSemester('INF1002F/S', 'Information Systems I', 18, true),
      core('STA1000S', 'Introductory Statistics', 'S2', 18),
      eitherSemester('CML1001F/S', 'Business Law I', 18, true),
    ],
    electiveGroups: [],
    totalCredits: { min: 159, max: 159 },
    note: `Bachelor of Commerce specialising in Financial Accounting: Chartered Accountant, "First Year Core Modules", total credits per year 159. ${EITHER_SEMESTER_NOTE}`,
  },
  {
    sourceUrl: COMMERCE,
    academicYear: 2026,
    programmeId: 'uct-bcom-actuarial-science',
    programmeCode: 'CB019BUS01',
    yearOfStudy: 1,
    modules: [
      core('ACC1006F', 'Financial Accounting', 'S1', 18),
      core('BUS1036F', 'Evidence-based Management', 'S1', 18),
      eitherSemester('CSC1015F/S', 'Computer Science 1015', 18, false),
      eitherSemester('INF1002F/S', 'Foundations of Information Systems', 18, false),
      eitherSemester('ECO1010F/S', 'Microeconomics I', 18, true),
      core('MAM1031F', 'Mathematics 1031', 'S1', 18),
      core('MAM1032S', 'Mathematics 1032', 'S2', 18),
      core('BUS1003H', 'Introduction to Actuarial Science', 'Y', 18),
      core('ACC1011S', 'Financial Reporting I', 'S2', 18),
      core('ECO1011S', 'Macroeconomics I', 'S2', 18),
      core('STA1006S', 'Mathematical Statistics I', 'S2', 18),
    ],
    electiveGroups: [
      {
        label: 'CSC1015F/S Computer Science 1015 OR INF1002F/S Foundations of Information Systems',
        choose: { count: 1 },
        from: ['CSC1015F', 'INF1002F'],
      },
    ],
    totalCredits: { min: 180, max: 180 },
    note: `Bachelor of Commerce in Actuarial Science, "First Year Core Modules", total credits per year 180. BUS1003H is an H course ("Half-course taught throughout the year"). ${EITHER_SEMESTER_NOTE}`,
  },
  {
    sourceUrl: HUMANITIES,
    academicYear: 2026,
    programmeId: 'uct-bsw',
    programmeCode: 'HB063',
    yearOfStudy: 1,
    modules: [
      core('PSY1009F', 'Introduction to Psychology Part 1', 'S1', 15),
      core('SOC1001F', 'Introduction to Sociology', 'S1', 15),
      core('SWK1013F', 'Community Connections', 'S1', 15),
      core('PSY1010S', 'Introduction to Psychology Part 2', 'S2', 15),
      core('SOC1005S', 'Individual and Society', 'S2', 15),
      core('SWK1006S', 'Basic Professional Interaction', 'S2', 15),
      core('SWK1005S', 'Field Practice I', 'S2', 8),
    ],
    electiveGroups: [],
    totalCredits: { min: 98, max: 98 },
    note: 'The handbook heads the list "First-year: 6 semester courses" but lists seven, totalling the printed "First-year total 98". It prints PSY1009F "(or PSY1004F if taken before 2026)" and PSY1010S "(or PSY1005S if taken before 2026)". Entry to second year is selective (judged on SWK1005S, a practical examination and an interview).',
  },
  {
    sourceUrl: ENGINEERING,
    academicYear: 2026,
    programmeId: 'uct-bsceng-civil',
    programmeCode: 'EB002CIV01',
    yearOfStudy: 1,
    modules: [
      core('CIV1008F', 'Introduction to Civil Engineering', 'S1', 12),
      core('MAM1020F', 'Mathematics IA for Engineers', 'S1', 18),
      core('CIV1009F', 'Civil Engineering Drawing', 'S1', 8),
      core('PHY1012F', 'Physics A for Engineers', 'S1', 18),
      core('GEO1008F', 'Introduction to Geology for Civil Engineers', 'S1', 12),
      core('CIV1013S', 'Environmental Chemistry for Civil Engineers', 'S2', 12),
      core('CIV1012S', 'Sustainable Urban Infrastructure', 'S2', 8),
      core('CIV1011S', 'Introduction to Engineering Mechanics', 'S2', 15),
      core('MAM1021S', 'Mathematics IB for Engineers', 'S2', 18),
      core('APG1023S', 'Surveying and Geographic Information Systems for Engineers', 'S2', 15),
      coreNoTerm('CIV1014Z', 'Water Challenge Scenario Project', 4),
    ],
    electiveGroups: [],
    totalCredits: { min: 140, max: 140 },
    note: 'BSc(Engineering)(Civil Engineering) 4-year curriculum, "First Year Core Courses", "Total credits per year 140". CIV1014Z has no semester: its suffix Z means "other" in the handbook’s course-code notes, not a term, and its course outline gives none. The handbook lists CIV1014Z at NQF level 6.',
  },
  {
    sourceUrl: ENGINEERING,
    academicYear: 2026,
    programmeId: 'uct-bsceng-electrical',
    programmeCode: 'EB009EEE01',
    yearOfStudy: 1,
    modules: [
      core('CSC1015F', 'Computer Science 1015', 'S1', 18),
      core('EEE1008F', 'Introduction to Electrical Engineering A', 'S1', 12),
      core('MAM1020F', 'Mathematics IA for Engineers', 'S1', 18),
      core('PHY1012F', 'Physics A for Engineers', 'S1', 18),
      core('CSC1016S', 'Computer Science 1016', 'S2', 18),
      core('EEE1009S', 'Introduction to Electrical Engineering B', 'S2', 12),
      core('MAM1021S', 'Mathematics IB for Engineers', 'S2', 18),
      core('PHY1013S', 'Physics B for Engineers', 'S2', 18),
      coreNoTerm('EEE1000X', 'Practical Training', 0),
    ],
    electiveGroups: [],
    totalCredits: { min: 132, max: 132 },
    note: 'BSc(Engineering)(Electrical Engineering), "First Year Core Courses (EE)", "Total credits per year 132". EEE1000X has no semester: its suffix X means "not classified" in the handbook’s course-code notes, and its outline describes at least six weeks of workshop practice "either before registration or during the long vacation following the year of first registration in the faculty (due by 31 March of the following year)". The handbook adds: "ASL1200S is a core course in the 576 cr. curriculum"; a candidate who registers in 2025 or later completes at least 560 credits.',
  },
];
