import type { AssessmentComponent, ModuleAssessment, UniversityAssessment } from '../assessment';

/**
 * University of KwaZulu-Natal (UKZN): how marks work (Phase 6a). Schema:
 * `packages/catalogue/src/assessment.ts`.
 *
 * DRAFT: researched on 2026-10-24 from the 2026 college handbooks (text extracted from UKZN's own
 * PDFs and quoted from that text). Not yet verified by a person (hard rule 3): never add
 * `verifiedOn`/`verifiedBy`. A rule UKZN doesn't print is left out (gotcha 40): the General
 * Academic Rules print no university-wide DP minimum, exam subminimum, supplementary cap,
 * rounding or module distinction percentage.
 *
 * - General rules: the General Academic Rules (GR1–GR33, BR rules), printed word for word in every
 *   college handbook; the CAES copy is cited. Only the College of Law and Management Studies adds
 *   a supplementary rule (LM-U3); Health Sciences and Humanities defer wholly to the general rules.
 * - Module schemes: each handbook's "Assessment" and "DP Requirement" lines, for the first-year
 *   modules of the curricula in ukzn-curricula.ts. Where two colleges print the same module
 *   differently (ECON101, MATH130, STAT130, STAT140 in CAES and CLMS), each entry names its college.
 *   EDSJ1CS and SOWK114 have no syllabus entry; CMED1EN, CMED1CL and CMDV104 print no exam weight.
 * - Calendars: the 2026 sessional dates (CAES handbook, read in full) and 2027 (registrar's page,
 *   read through a summariser: check every date).
 */

const CAES = 'https://saa.ukzn.ac.za/wp-content/uploads/2026/07/CAES-2026.pdf';
const CLMS = 'https://clms.ukzn.ac.za/wp-content/uploads/2026/01/UKZN-CLMS-Handbook-2026.pdf';
const CHS = 'https://chs.ukzn.ac.za/wp-content/uploads/2026/01/Health-Sciences-HB-2026-1.pdf';
const COH = 'https://coh.ukzn.ac.za/wp-content/uploads/2026/02/Humanities-2026-Handbook-min.pdf';

const CAES_FACULTY = 'College of Agriculture, Engineering and Science';
const CLMS_FACULTY = 'College of Law and Management Studies';

type Entry = Omit<
  ModuleAssessment,
  'sourceUrl' | 'academicYear' | 'universityId' | 'code' | 'quote'
>;
const module = (
  sourceUrl: string,
  code: string,
  quote: string,
  entry: Entry = {},
): ModuleAssessment => ({
  sourceUrl,
  academicYear: 2026,
  universityId: 'ukzn',
  code,
  ...entry,
  quote,
});
const c = (
  name: string,
  kind: AssessmentComponent['kind'],
  weight: number,
  subminimum?: number,
): AssessmentComponent => ({
  name,
  kind,
  weight,
  ...(subminimum === undefined ? {} : { subminimum }),
});
const split = (yearMarkWeight: number, examWeight: number) => ({ yearMarkWeight, examWeight });
/** The DP line as printed: its whole text, the conditions, and the class-mark minimum if printed. */
const dp = (quote: string, conditions: string[] = [], minimumYearMark?: number) => ({
  term: 'DP',
  ...(minimumYearMark === undefined ? {} : { minimumYearMark }),
  ...(conditions.length === 0 ? {} : { conditions }),
  quote,
});

const MATH_DP =
  'DP Requirement: 40% Class mark, 80% attendance at lectures and 80% completion of tutorial requirements.';
const MATH_33 = 'Assessment: Class tests and/or assignments (33%); 3 h exam (67%).';
const MATH_DP_CONDITIONS = [
  '80% attendance at lectures',
  '80% completion of tutorial requirements',
];
const PHYS_DP =
  'DP Requirement: Class mark 40%, 100% attendance at tests, 80% attendance at lectures, tutorials and practicals.';
const PHYS_CONDITIONS = [
  '100% attendance at tests',
  '80% attendance at lectures, tutorials and practicals',
];
const PHYS_COMPONENTS = [
  c('Tests, assignments and quizzes', 'test', 30),
  c('Practicals', 'practical', 10),
  c('Exam (3 h)', 'exam', 60),
];
const COMP_COMPONENTS = [
  c('Theory tests (at least 2)', 'test', 25),
  c('Practical test (at least 1)', 'practical', 20),
  c('Practicals/assignments/quizzes/tests', 'assignment', 5),
  c('Exam (3 h)', 'exam', 50, 40),
];
const COMP_DP = 'DP Requirement: Class mark 40%, attendance at 80% of the practicals.';
const CHEM_ENG_DP =
  'DP Requirement: Class mark 40%, 80% attendance at practicals, 100% attendance at tests.';
const CHEM_ENG_CONDITIONS = ['80% attendance at practicals', '100% attendance at tests'];
const AUGMENTED_COMPONENTS = [
  c('Tests/assignments', 'test', 30),
  c('Practical reports', 'practical', 20),
  c('Theory exam (3 h)', 'exam', 50),
];
const SCOM =
  'Assessment: Tests, Assignments and Oral presentation (50%) and 3 hr Exam (50%). DP Requirement. Attendance at 80% of lectures and tutorials and 100% of tests. Assignment submissions and oral presentation are compulsory.';
const CLASS_50 = 'Assessment: Class mark (50%), Examination (50%). DP Requirement: None';
const ISTN =
  'Assessment: 2-hour examination (50%), tests/assignments (50%). Students must obtain at least 40% in the examination paper. DP Requirement: None';
const ISTN_COMPONENTS = [
  c('Tests/assignments', 'test', 50),
  c('2-hour examination', 'exam', 50, 40),
];
const CLMS_STAT =
  'Assessment: Two tests and/or practical assignments (35%); 3-hour examination (65%). DP Requirement: Minimum class mark of 35%, and 80% attendance at lectures & tutorials.';
const CLMS_MATH =
  'Assessment: Class tests and/or assignments (33%); 3-hour examination (67%). DP Requirement: Minimum class mark of 35%, and 80% attendance at lectures & tutorials.';
const ACCT =
  'Assessment: Class Mark (50%), Examination (50%) DP Requirement: A class mark of at least 40%.';
const ACLE_COMPONENTS = [
  c('2 tests', 'test', 30),
  c('2 essays', 'assignment', 35),
  c('Examination', 'exam', 35),
];
const ACLE_DP = 'DP Requirement: 80% attendance and submission of all written work.';
const CMED_DP = (components: string) =>
  `DP Requirement: 80% attendance at all scheduled teaching activities; must pass each component (${components}) in the year mark and must obtain at least 50% in the year mark`;
const PHRM_DP =
  'DP Requirement: A student must obtain a CAM of ≥40%; 100% attendance and submission of 100% of all practical reports.';
const NURS_OTHER = [
  'A subminimum of 50% in all components of the theory examination will apply.',
  'Objective Structured Clinical Examination: A subminimum of 50% in all components of the clinical examination will apply.',
];
const ANAT =
  "Assessment: For the Anatomy 1 module, typical methods of assessment and their percentage weightings might include: 1.Theory Test – 20% 2.Spotter Test – 20% 3.Spotter Examination – 30% 4.Examination – 30% These percentages can vary based on the program's specific requirements DP Requirement: 40%";
const ZULU = (discipline: string) =>
  `Assessment: Class work: 40% Examination: 60% DP Requirement: Students must submit of all written work on time and must comply with the attendance requirements for the ${discipline}.`;
const ZULU_CONDITIONS = [
  'submit all written work on time',
  'comply with the attendance requirements',
];

const modules: ModuleAssessment[] = [
  // College of Agriculture, Engineering and Science handbook 2026.
  module(
    CAES,
    'COMP100',
    `Assessment: Class mark 50% (at least 2 theory tests (25%), at least 1 practical test (20%), practicals/assignments/quizzes/tests (5%)); 3 h exam (50%), with a sub-minimum of 40% on the exam. ${COMP_DP}`,
    {
      name: 'Introduction to Computer Science',
      page: 'p. 305',
      components: COMP_COMPONENTS,
      ...split(50, 50),
      examSubminimum: 40,
      dpRequirement: dp(COMP_DP, ['attendance at 80% of the practicals'], 40),
    },
  ),
  module(
    CAES,
    'COMP102',
    `Assessment: Class mark 50% (at least 2 theory tests (25%), at least 1 practical test (20%), practicals/ assignments/quizzes/tests (5%)); 3 h exam (50%), with a sub-minimum of 40% on the exam. ${COMP_DP}`,
    {
      name: 'Computer Programming',
      page: 'p. 306',
      components: COMP_COMPONENTS,
      ...split(50, 50),
      examSubminimum: 40,
      dpRequirement: dp(COMP_DP, ['attendance at 80% of the practicals'], 40),
    },
  ),
  module(
    CAES,
    'COMP107',
    'Assessment: 3 tests (30%); 3h exam (70%). DP Requirement: 40% class mark, attendance at 80% of the practicals.',
    {
      name: 'Foundations of Computer Science',
      page: 'p. 306',
      ...split(30, 70),
      dpRequirement: dp(
        'DP Requirement: 40% class mark, attendance at 80% of the practicals.',
        ['attendance at 80% of the practicals'],
        40,
      ),
    },
  ),
  module(CAES, 'MATH130', `${MATH_33} ${MATH_DP}`, {
    name: 'Introduction to Calculus',
    faculty: CAES_FACULTY,
    page: 'p. 427',
    ...split(33, 67),
    dpRequirement: dp(MATH_DP, MATH_DP_CONDITIONS, 40),
  }),
  module(CAES, 'MATH140', `${MATH_33} ${MATH_DP}`, {
    name: 'Calculus and Linear Algebra',
    page: 'p. 428',
    ...split(33, 67),
    dpRequirement: dp(MATH_DP, MATH_DP_CONDITIONS, 40),
  }),
  ...(
    [
      ['MATH131', 'Mathematics 1A (Eng)', 'p. 428'],
      ['MATH132', 'Applied Mathematics 1A (Eng)', 'p. 428'],
      ['MATH141', 'Mathematics 1B (Eng)', 'pp. 428–429'],
      ['MATH142', 'Applied Mathematics 1B (Eng)', 'p. 429'],
    ] as const
  ).map(([code, name, page]) =>
    module(CAES, code, `${MATH_33} ${MATH_DP}`, {
      name,
      page,
      ...split(33, 67),
      dpRequirement: dp(MATH_DP, MATH_DP_CONDITIONS, 40),
    }),
  ),
  module(
    CAES,
    'MATH195',
    `Assessment: Tests/Assignments (50%); 3 hr theory exam (50%). ${MATH_DP}`,
    {
      name: 'Introduction to Calculus (Augmented)',
      page: 'p. 430',
      ...split(50, 50),
      dpRequirement: dp(MATH_DP, MATH_DP_CONDITIONS, 40),
    },
  ),
  module(
    CAES,
    'STAT130',
    'Assessment: Two tests and or practical assignments (35%); 3 h exam (65%). DP Requirement: 35% Class mark, 80% attendance at tutorials and practicals.',
    {
      name: 'Introduction to Statistics',
      faculty: CAES_FACULTY,
      page: 'p. 469',
      ...split(35, 65),
      dpRequirement: dp(
        'DP Requirement: 35% Class mark, 80% attendance at tutorials and practicals.',
        ['80% attendance at tutorials and practicals'],
        35,
      ),
    },
  ),
  module(
    CAES,
    'STAT140',
    'Assessment: Two tests and or practical assignments (35%); 3 h exam (65%). DP Requirement: 35% Class mark, 80% attendance at practicals and tutorials.',
    {
      name: 'Statistical Methods',
      faculty: CAES_FACULTY,
      page: 'p. 469',
      ...split(35, 65),
      dpRequirement: dp(
        'DP Requirement: 35% Class mark, 80% attendance at practicals and tutorials.',
        ['80% attendance at practicals and tutorials'],
        35,
      ),
    },
  ),
  module(CAES, 'ISTN103', ISTN, {
    name: 'Development and Applications Fundamentals',
    page: 'p. 419',
    components: ISTN_COMPONENTS,
    ...split(50, 50),
    examSubminimum: 40,
    dpRequirement: dp('DP Requirement: None'),
    note: 'The CLMS handbook (p. 246) prints the same entry word for word.',
  }),
  module(
    CAES,
    'ECON101',
    'Assessment: 3 tests (40%), 1 three-hour examination (60%) DP Requirement: Students must write all class tests and obtain a class record of at least 40%.',
    {
      name: 'Principles of Microeconomics',
      faculty: CAES_FACULTY,
      page: 'p. 480',
      ...split(40, 60),
      dpRequirement: dp(
        'DP Requirement: Students must write all class tests and obtain a class record of at least 40%.',
        ['write all class tests'],
        40,
      ),
      note: 'The CLMS handbook (p. 161) prints a different scheme (50/50, DP None): that entry is recorded for the College of Law and Management Studies.',
    },
  ),
  ...(
    [
      ['PHYS110', 'Mechanics, Optics and Thermal Physics', 'p. 449'],
      ['PHYS120', 'Electromagnetism, Waves and Modern Physics', 'pp. 449–450'],
      ['PHYS151', 'Engineering Physics 1A', 'p. 451'],
      ['PHYS152', 'Engineering Physics 1B', 'p. 451'],
    ] as const
  ).map(([code, name, page]) =>
    module(
      CAES,
      code,
      `Assessment: Tests, assignments and quizzes (30%), practicals (10%); 3 h exam (60%). ${PHYS_DP}`,
      {
        name,
        page,
        components: PHYS_COMPONENTS,
        ...split(40, 60),
        dpRequirement: dp(PHYS_DP, PHYS_CONDITIONS, 40),
      },
    ),
  ),
  module(
    CAES,
    'CHEM181',
    `Assessment: Tests (8%), Practicals (25%); 2 h Exam (67%). ${CHEM_ENG_DP}`,
    {
      name: 'Chemistry for Engineers 1A',
      page: 'p. 299',
      components: [
        c('Tests', 'test', 8),
        c('Practicals', 'practical', 25),
        c('Exam (2 h)', 'exam', 67),
      ],
      ...split(33, 67),
      dpRequirement: dp(CHEM_ENG_DP, CHEM_ENG_CONDITIONS, 40),
    },
  ),
  module(
    CAES,
    'CHEM191',
    `Assessment: Tests (8%), Practicals (25%); 2 h Exam (67%). ${CHEM_ENG_DP}`,
    {
      name: 'Chemistry for Engineers 1B',
      page: 'p. 299',
      components: [
        c('Tests', 'test', 8),
        c('Practicals', 'practical', 25),
        c('Exam (2 h)', 'exam', 67),
      ],
      ...split(33, 67),
      dpRequirement: dp(CHEM_ENG_DP, CHEM_ENG_CONDITIONS, 40),
    },
  ),
  module(
    CAES,
    'CHEM163',
    `Assessment: Tests (7%), practical reports (26%); 2 h exam (67%). ${CHEM_ENG_DP}`,
    {
      name: 'Chemistry & Society 1',
      page: 'p. 298',
      components: [
        c('Tests', 'test', 7),
        c('Practical reports', 'practical', 26),
        c('Exam (2 h)', 'exam', 67),
      ],
      ...split(33, 67),
      dpRequirement: dp(CHEM_ENG_DP, CHEM_ENG_CONDITIONS, 40),
    },
  ),
  module(
    CAES,
    'CHEM173',
    `Assessment: Tests (7%), practical reports (26%); 2 h exam (67%). ${CHEM_ENG_DP}`,
    {
      name: 'Chemistry & Society 2',
      page: 'p. 299',
      components: [
        c('Tests', 'test', 7),
        c('Practical reports', 'practical', 26),
        c('Exam (2 h)', 'exam', 67),
      ],
      ...split(33, 67),
      dpRequirement: dp(CHEM_ENG_DP, CHEM_ENG_CONDITIONS, 40),
    },
  ),
  module(
    CAES,
    'ENCH1TC',
    'Assessment: Continuous assessment (technical report, online activities/short quizzes and oral presentation). DP Requirement: Not applicable. This module has no supplementary exam.',
    {
      name: 'Technical Communication for Engineers',
      page: 'p. 319',
      otherRules: ['This module has no supplementary exam.'],
      note: 'Continuous assessment with no weights printed and no DP.',
    },
  ),
  module(
    CAES,
    'ENME1DR',
    'Assessment: Drawings: tutorials and tests (12.5%); CAD: tutorials and test (37.5%); 3 h exam (50%). DP Requirement: Attendance at all tests, 50% for the CAD component.',
    {
      name: 'Engineering Drawing',
      page: 'p. 366',
      components: [
        c('Drawings: tutorials and tests', 'test', 12.5),
        c('CAD: tutorials and test', 'test', 37.5),
        c('Exam (3 h)', 'exam', 50),
      ],
      ...split(50, 50),
      dpRequirement: dp('DP Requirement: Attendance at all tests, 50% for the CAD component.', [
        'Attendance at all tests',
        '50% for the CAD component',
      ]),
    },
  ),
  module(
    CAES,
    'ENME1EM',
    'Assessment: Tests, assignments/tutorials (30%); 2 h exam (70%). DP Requirement: Students are required to attend all tests and to complete all assignments satisfactorily, as specified in the module outline.',
    {
      name: 'Introduction to Engineering Materials',
      page: 'p. 367',
      ...split(30, 70),
      dpRequirement: dp(
        'DP Requirement: Students are required to attend all tests and to complete all assignments satisfactorily, as specified in the module outline.',
        [
          'attend all tests and complete all assignments satisfactorily, as specified in the module outline',
        ],
      ),
    },
  ),
  module(
    CAES,
    'ENAG1MT',
    'Assessment: Class mark: 30% (2 tests, assignments/tutorials); 2 h exam (70%). DP Requirement: Students are required to write all class tests and complete all tutorials and assignments satisfactorily, as specified in the module outline.',
    {
      name: 'Introduction to Engineering Materials',
      page: 'p. 313',
      ...split(30, 70),
      dpRequirement: dp(
        'DP Requirement: Students are required to write all class tests and complete all tutorials and assignments satisfactorily, as specified in the module outline.',
        [
          'write all class tests and complete all tutorials and assignments satisfactorily, as specified in the module outline',
        ],
      ),
    },
  ),
  module(
    CAES,
    'ENAG1DE',
    'Assessment: Class mark (30%), including assignments, projects and tests, Practical exam (25%), final exam (45%). DP Requirement: Students are required to write all class tests and complete all practicals and assignments satisfactorily, as specified in the module outline.',
    {
      name: 'Engineering Design',
      page: 'pp. 312–313',
      components: [
        c('Class mark (assignments, projects and tests)', 'other', 30),
        c('Practical exam', 'exam', 25),
        c('Final exam', 'exam', 45),
      ],
      dpRequirement: dp(
        'DP Requirement: Students are required to write all class tests and complete all practicals and assignments satisfactorily, as specified in the module outline.',
        [
          'write all class tests and complete all practicals and assignments satisfactorily, as specified in the module outline',
        ],
      ),
    },
  ),
  module(
    CAES,
    'ENCV1ED',
    'Assessment: Class mark (40%); 4 h exam (60%). DP Requirement: Students are required to attend all tutorials/lectures and complete all practicals, assignments and tutorials satisfactorily, as specified in the module outline.',
    {
      name: 'Introduction to Civil Design',
      page: 'p. 330',
      ...split(40, 60),
      dpRequirement: dp(
        'DP Requirement: Students are required to attend all tutorials/lectures and complete all practicals, assignments and tutorials satisfactorily, as specified in the module outline.',
        [
          'attend all tutorials/lectures and complete all practicals, assignments and tutorials satisfactorily, as specified in the module outline',
        ],
      ),
    },
  ),
  module(
    CAES,
    'ENCV1EP',
    'Assessment: Coursework comprising individual and group assignments (100%). DP Requirement: 100% attendance.',
    {
      name: 'Engineering Practice Workshop',
      page: 'p. 330',
      components: [c('Individual and group assignments', 'assignment', 100)],
      dpRequirement: dp('DP Requirement: 100% attendance.', ['100% attendance']),
    },
  ),
  module(
    CAES,
    'ENEL1ED',
    'Assessment: Class mark (30%); 2 h exam (70%). DP Requirement: Performed all practicals and assignments satisfactorily, as specified in the module outline.',
    {
      name: 'Electrical Design 1',
      page: 'p. 341',
      ...split(30, 70),
      dpRequirement: dp(
        'DP Requirement: Performed all practicals and assignments satisfactorily, as specified in the module outline.',
        [
          'Performed all practicals and assignments satisfactorily, as specified in the module outline',
        ],
      ),
    },
  ),
  module(
    CAES,
    'BIOL195',
    'Assessment: Tests/assignments (30%), practical reports (20%), 3 h theory exam (50%) DP Requirement: Class mark of 40%; Attendance at 80% of lectures, practicals and tutorials and 100% attendance at all assessments',
    {
      name: 'Smaller Side of Life (Augmented)',
      page: 'p. 280',
      components: AUGMENTED_COMPONENTS,
      ...split(50, 50),
      dpRequirement: dp(
        'DP Requirement: Class mark of 40%; Attendance at 80% of lectures, practicals and tutorials and 100% attendance at all assessments',
        [
          'Attendance at 80% of lectures, practicals and tutorials',
          '100% attendance at all assessments',
        ],
        40,
      ),
      note: 'The entry prints "Subminimum to pass:" with no value (followed by "Credit may not be obtained for both BIOL195 and BIOL101."): no subminimum is recorded.',
    },
  ),
  module(
    CAES,
    'CHEM195',
    'Assessment: Tests/Assignments (30%), practical reports (20%); 3 hr theory exam (50%). DP Requirement: Class mark 40%, Attendance at 80% of lectures, practicals and tutorials and 100% attendance at all assessments.',
    {
      name: 'General Principles of Chemistry (Augmented)',
      page: 'p. 300',
      components: AUGMENTED_COMPONENTS,
      ...split(50, 50),
      dpRequirement: dp(
        'DP Requirement: Class mark 40%, Attendance at 80% of lectures, practicals and tutorials and 100% attendance at all assessments.',
        [
          'Attendance at 80% of lectures, practicals and tutorials',
          '100% attendance at all assessments',
        ],
        40,
      ),
    },
  ),
  module(
    CAES,
    'PHYS195',
    'Assessment: Tests/Assignments/Homework and quizzes (30%), practical reports (20%); 3 h theory exam (50%). DP Requirement: Class mark of 40%, Attendance at 80% of lectures, tutorials and practicals and 100% attendance at all assessments.',
    {
      name: 'Mech Optics & Thermal Physics (Augmented)',
      page: 'p. 452',
      components: AUGMENTED_COMPONENTS,
      ...split(50, 50),
      dpRequirement: dp(
        'DP Requirement: Class mark of 40%, Attendance at 80% of lectures, tutorials and practicals and 100% attendance at all assessments.',
        [
          'Attendance at 80% of lectures, tutorials and practicals',
          '100% attendance at all assessments',
        ],
        40,
      ),
    },
  ),
  module(CAES, 'SCOM101', SCOM, {
    name: 'Communication in Science A',
    page: 'p. 465',
    ...split(50, 50),
    dpRequirement: dp(
      'DP Requirement. Attendance at 80% of lectures and tutorials and 100% of tests. Assignment submissions and oral presentation are compulsory.',
      [
        'Attendance at 80% of lectures and tutorials and 100% of tests',
        'Assignment submissions and oral presentation are compulsory',
      ],
    ),
  }),
  module(CAES, 'SCOM102', SCOM, {
    name: 'Communication in Science B',
    page: 'p. 466',
    ...split(50, 50),
    dpRequirement: dp(
      'DP Requirement. Attendance at 80% of lectures and tutorials and 100% of tests. Assignment submissions and oral presentation are compulsory.',
      [
        'Attendance at 80% of lectures and tutorials and 100% of tests',
        'Assignment submissions and oral presentation are compulsory',
      ],
    ),
  }),
  // College of Law and Management Studies handbook 2026.
  module(CLMS, 'ACCT101', ACCT, {
    name: 'Accounting 101',
    page: 'p. 145',
    ...split(50, 50),
    dpRequirement: dp('DP Requirement: A class mark of at least 40%.', [], 40),
  }),
  module(CLMS, 'ACCT102', ACCT, {
    name: 'Accounting 102',
    page: 'p. 145',
    ...split(50, 50),
    dpRequirement: dp('DP Requirement: A class mark of at least 40%.', [], 40),
  }),
  module(CLMS, 'ACCT103', 'Assessment: Class Mark (50%), Examination (50%) DP Requirement: None', {
    name: 'Accounting 103',
    page: 'p. 145',
    ...split(50, 50),
    dpRequirement: dp('DP Requirement: None'),
  }),
  module(
    CLMS,
    'ACCT1AL',
    'Assessment: 4 Assignments (80%) and 1 project (20%) DP Requirement: This is a continuous assessment module. There is no exam or DP requirement',
    {
      name: 'Academic Literacy for Commerce',
      page: 'p. 145',
      components: [c('4 assignments', 'assignment', 80), c('1 project', 'project', 20)],
      dpRequirement: dp(
        'DP Requirement: This is a continuous assessment module. There is no exam or DP requirement',
      ),
    },
  ),
  module(CLMS, 'ECON101', CLASS_50, {
    name: 'Principles of Microeconomics',
    faculty: CLMS_FACULTY,
    page: 'p. 161',
    ...split(50, 50),
    dpRequirement: dp('DP Requirement: None'),
  }),
  module(CLMS, 'ECON102', CLASS_50, {
    name: 'Principles of Macroeconomics',
    page: 'p. 162',
    ...split(50, 50),
    dpRequirement: dp('DP Requirement: None'),
  }),
  module(CLMS, 'ECON1CO', CLASS_50, {
    name: 'Elementary Microeconomics',
    page: 'p. 162',
    ...split(50, 50),
    dpRequirement: dp('DP Requirement: None'),
    note: 'Printed "ECON1C0" (digit zero) in the syllabus; the curriculum records ECON1CO.',
  }),
  module(CLMS, 'ECON1DO', CLASS_50, {
    name: 'Elementary Macroeconomics',
    page: 'p. 162',
    ...split(50, 50),
    dpRequirement: dp('DP Requirement: None'),
    note: 'Printed "ECON1D0" (digit zero) in the syllabus; the curriculum records ECON1DO.',
  }),
  module(CLMS, 'ISTN101', ISTN, {
    name: 'IS & T for Business',
    page: 'p. 246',
    components: ISTN_COMPONENTS,
    ...split(50, 50),
    examSubminimum: 40,
    dpRequirement: dp('DP Requirement: None'),
  }),
  module(CLMS, 'STAT130', CLMS_STAT, {
    name: 'Introduction to Statistics',
    faculty: CLMS_FACULTY,
    page: 'p. 251',
    ...split(35, 65),
    dpRequirement: dp(
      'DP Requirement: Minimum class mark of 35%, and 80% attendance at lectures & tutorials.',
      ['80% attendance at lectures & tutorials'],
      35,
    ),
  }),
  module(CLMS, 'STAT140', CLMS_STAT, {
    name: 'Statistical Methods',
    faculty: CLMS_FACULTY,
    page: 'pp. 251–252',
    ...split(35, 65),
    dpRequirement: dp(
      'DP Requirement: Minimum class mark of 35%, and 80% attendance at lectures & tutorials.',
      ['80% attendance at lectures & tutorials'],
      35,
    ),
  }),
  module(CLMS, 'MATH130', CLMS_MATH, {
    name: 'Introduction to Calculus',
    faculty: CLMS_FACULTY,
    page: 'p. 250',
    ...split(33, 67),
    dpRequirement: dp(
      'DP Requirement: Minimum class mark of 35%, and 80% attendance at lectures & tutorials.',
      ['80% attendance at lectures & tutorials'],
      35,
    ),
  }),
  module(CLMS, 'MATH134', CLMS_MATH, {
    name: 'Quantitative Methods 1',
    page: 'p. 250',
    ...split(33, 67),
    dpRequirement: dp(
      'DP Requirement: Minimum class mark of 35%, and 80% attendance at lectures & tutorials.',
      ['80% attendance at lectures & tutorials'],
      35,
    ),
  }),
  module(
    CLMS,
    'MATH194',
    'Assessment: Class mark (Assignments, Class tests, 3-hour June test, and tutorial tests) (50%); 3-hour examination. (50%). DP Requirement: Minimum class mark of 40%, and 80% attendance at lectures & tutorials',
    {
      name: 'Foundation Mathematics for Commerce',
      page: 'p. 250',
      ...split(50, 50),
      dpRequirement: dp(
        'DP Requirement: Minimum class mark of 40%, and 80% attendance at lectures & tutorials',
        ['80% attendance at lectures & tutorials'],
        40,
      ),
    },
  ),
  module(
    CLMS,
    'ACLE101',
    `Assessment: Average class mark 65% (2 tests 30% and 2 Essays 35%); Examination 35%. ${ACLE_DP}`,
    {
      name: 'Academic Literacy in English',
      page: 'p. 254',
      components: ACLE_COMPONENTS,
      ...split(65, 35),
      dpRequirement: dp(ACLE_DP, ['80% attendance', 'submission of all written work']),
    },
  ),
  module(
    CLMS,
    'MGNT102',
    'Assessment: Tests/Assignment (33%); 3-hour Examination (67%) DP Requirement: A class mark of at least 40%.',
    {
      name: 'Management 120',
      page: 'p. 221',
      ...split(33, 67),
      dpRequirement: dp('DP Requirement: A class mark of at least 40%.', [], 40),
    },
  ),
  module(
    CLMS,
    'MGNT1SL',
    'Assessment: Course work: 50% (3 assignments and 1 project), examination: 50%. DP Requirement: At least 40% course work component; 80% attendance',
    {
      name: 'Service-Learning',
      page: 'p. 222',
      ...split(50, 50),
      dpRequirement: dp(
        'DP Requirement: At least 40% course work component; 80% attendance',
        ['80% attendance'],
        40,
      ),
    },
  ),
  module(
    CLMS,
    'LAWS1IC',
    'Assessment: Students are required to write either one or both tests weighted 30% each, with the better of the two marks being used as the class mark. The examination counts 70% towards the overall mark. DP Requirement: Achieve at least 40% in one of the written tests.',
    {
      name: 'Introduction to Commercial Law',
      page: 'p. 192',
      components: [c('Tests (the better of two)', 'test', 30), c('Examination', 'exam', 70)].map(
        (x) => (x.kind === 'test' ? { ...x, bestOf: { count: 1, of: 2 } } : x),
      ),
      ...split(30, 70),
      dpRequirement: dp('DP Requirement: Achieve at least 40% in one of the written tests.', [
        'Achieve at least 40% in one of the written tests.',
      ]),
    },
  ),
  module(
    CLMS,
    'LAWS1LW',
    'Assessment: 50% formative assessment in the form of class tests and an assignment; 50% summative assessment in the form of a final examination. DP Requirement: 80% attendance at lectures and tutorials with the submission of written preparation for tutorial exercises and completion and submission of all assessments.',
    {
      name: 'Introduction to Law',
      page: 'p. 192',
      ...split(50, 50),
      dpRequirement: dp(
        'DP Requirement: 80% attendance at lectures and tutorials with the submission of written preparation for tutorial exercises and completion and submission of all assessments.',
        [
          '80% attendance at lectures and tutorials',
          'submission of written preparation for tutorial exercises',
          'completion and submission of all assessments',
        ],
      ),
    },
  ),
  module(
    CLMS,
    'LAWS1FL',
    'Assessment: 50% assessment in the form of class tests and/or an assignment; 50% assessment in the form of a final examination. DP Requirements: 80% attendance at lectures and tutorials with the submission of written preparation for tutorial exercises, completion and submission of all assessments.',
    {
      name: 'Foundations of SA Law',
      page: 'p. 191',
      ...split(50, 50),
      dpRequirement: dp(
        'DP Requirements: 80% attendance at lectures and tutorials with the submission of written preparation for tutorial exercises, completion and submission of all assessments.',
        [
          '80% attendance at lectures and tutorials',
          'submission of written preparation for tutorial exercises',
          'completion and submission of all assessments',
        ],
      ),
    },
  ),
  // College of Health Sciences handbook 2026.
  module(
    CHS,
    'CMED1BF',
    `Assessment: Module Mark = Year Mark(50%) + End-of-Module Exam (50%); Year Mark = 4 class tests (25% each). ${CMED_DP('anatomy, physiology, pathology, microbiology, therapeutics')}`,
    {
      name: 'Basic and Foundation Science for Medicine',
      page: 'pp. 253–254',
      ...split(50, 50),
      dpRequirement: dp(
        CMED_DP('anatomy, physiology, pathology, microbiology, therapeutics'),
        [
          '80% attendance at all scheduled teaching activities',
          'must pass each component (anatomy, physiology, pathology, microbiology, therapeutics) in the year mark',
        ],
        50,
      ),
      otherRules: [
        'A student may be exempted from the EME by virtue of having obtained at least 65% in each ETT. Such a student will further need to have obtained a sub-minimum of 50% in each of the components of each ETT … The final module mark of a student who is exempted from the EME will be the average of the class tests.',
      ],
      note: 'The 25% weights are shares of the year mark, so only the 50/50 split is recorded.',
    },
  ),
  module(
    CHS,
    'CMED1EN',
    `Assessment: Year Mark = worksheets and exercises 10% + writing tasks in different genres 10% + class tests 30% … The End of Module examination will have the same structure as the class test, i.e. written and practical components. ${CMED_DP('written and oral')}`,
    {
      name: 'English Literacy',
      page: 'p. 254',
      dpRequirement: dp(
        CMED_DP('written and oral'),
        [
          '80% attendance at all scheduled teaching activities',
          'must pass each component (written and oral) in the year mark',
        ],
        50,
      ),
      note: 'The exam weight is not printed, so no weighting is recorded.',
    },
  ),
  module(
    CHS,
    'CMED1CL',
    `Assessment: Year Mark = 4 class tests (25% each) [each class test has written and practical components] The written component 75% and practical component (25%) in each test. … The End of Module examination will have the same structure as the class test ${CMED_DP('Word, Excel, PowerPoint')}`,
    {
      name: 'Computer Literacy',
      page: 'p. 254',
      dpRequirement: dp(
        CMED_DP('Word, Excel, PowerPoint'),
        [
          '80% attendance at all scheduled teaching activities',
          'must pass each component (Word, Excel, PowerPoint) in the year mark',
        ],
        50,
      ),
      note: 'The year/exam split is not printed, so no weighting is recorded.',
    },
  ),
  module(
    CHS,
    'CMED1ZU',
    `Assessment: Module Mark = Year Mark 50% + Final Examination (End of Module exam 50%) Year Mark = 4 class tests (25% each) [each class test has written and practical components] The written component 50% and practical component (50%) in each test. ${CMED_DP('written and oral')}`,
    {
      name: 'IsiZulu',
      page: 'p. 255',
      ...split(50, 50),
      dpRequirement: dp(
        CMED_DP('written and oral'),
        [
          '80% attendance at all scheduled teaching activities',
          'must pass each component (written and oral) in the year mark',
        ],
        50,
      ),
    },
  ),
  module(
    CHS,
    'CMED1PC',
    'Assessment: The summative mark for the calculation of the end of Semester two will be comprised of 33.3% from each of the two end of term tests and 33.3% from the Making a Difference activity. Exemption from the EME. A student may be exempted from the EME by virtue of having obtained at least 65% in each of the 5 year mark components. … This exemption does not include the OSCE component. The final module mark of a student who is exempted from the EME will be calculated by adding the weighted average of the class mark to the OSCE mark, in a proportion of 90% to 10%. DP Requirement: There are no DP requirements.',
    {
      name: 'Becoming a Professional',
      page: 'pp. 254–255',
      dpRequirement: dp('DP Requirement: There are no DP requirements.'),
      otherRules: [
        'A student may be exempted from the EME by virtue of having obtained at least 65% in each of the 5 year mark components.',
      ],
      note: 'On p. 255 the CMED1ZU box overlays this text, so the parts were matched by position: check visually. The three 33.3% shares add to 99.9% and the year/exam split is not printed, so no weighting is recorded.',
    },
  ),
  module(
    CHS,
    'SHSC1BH',
    'Assessment: Continuous Assessment … without a final summative university examination. Assignment: 60% (2 Group assessments, weighted at 30% each). Theory: 40% (2 MCQ tests weighted at 20% each) DP Requirement: 80% attendance at all practical sessions; and submission of assignment',
    {
      name: 'Becoming a Health Professional',
      page: 'p. 242',
      components: [
        c('Assignment (2 group assessments)', 'assignment', 60),
        c('Theory (2 MCQ tests)', 'test', 40),
      ],
      dpRequirement: dp(
        'DP Requirement: 80% attendance at all practical sessions; and submission of assignment',
        ['80% attendance at all practical sessions', 'submission of assignment'],
      ),
    },
  ),
  module(
    CHS,
    'SHSC1HI',
    'Assessment: Module mark = Final Examination (60%) + Formative Assessment (40%) The formative assessment will consist of: Two tests (40%) A student needs to obtain a formative assessment mark of at least 40% to qualify for the final examination. The summative assessment consists of: Final Examination : 1 x 3-hour Paper DP Requirement: Formative Assessment Mark of 40%',
    {
      name: 'Health, Illness and Behaviour',
      page: 'pp. 242–243',
      ...split(40, 60),
      examPapers: '1 x 3-hour Paper',
      dpRequirement: dp('DP Requirement: Formative Assessment Mark of 40%', [], 40),
    },
  ),
  module(
    CHS,
    'PHRM141',
    `Assessment: Formative: 60% of the tests + 40% of average of the Practical Reports. Summative: 1 x 2-hour paper. Final Exam = 50% Exam mark+50% of CAM. A 40% subminimum rule will apply. ${PHRM_DP}`,
    {
      name: 'Pharmaceutical Chemistry 1',
      page: 'p. 391',
      ...split(50, 50),
      examPapers: '1 x 2-hour paper',
      dpRequirement: dp(
        PHRM_DP,
        ['100% attendance', 'submission of 100% of all practical reports'],
        40,
      ),
      otherRules: ['A 40% subminimum rule will apply.'],
      note: 'The 60/40 split is inside the CAM (continuous assessment mark). The subminimum doesn’t name its component, so it is quoted, not applied.',
    },
  ),
  module(
    CHS,
    'PHRM142',
    `Assessment: Formative: 70% of the two test marks + 30% of the average of the practical marks. Summative: 1 x 2-hour paper . Final Exam = 50% Exam mark + 50% of CAM. A 40% subminimum rule will apply. ${PHRM_DP.replace('≥40%', '≥ 40%')}`,
    {
      name: 'Pharmaceutical Chemistry 2',
      page: 'p. 391',
      ...split(50, 50),
      examPapers: '1 x 2-hour paper',
      dpRequirement: dp(
        PHRM_DP.replace('≥40%', '≥ 40%'),
        ['100% attendance', 'submission of 100% of all practical reports'],
        40,
      ),
      otherRules: ['A 40% subminimum rule will apply.'],
      note: 'The 70/30 split is inside the CAM. The subminimum doesn’t name its component, so it is quoted, not applied.',
    },
  ),
  module(
    CHS,
    'NURS115',
    'Formative Assessments (40%): Written test and portfolio of evidence Summative Assessment (60%): Theory examination paper. A subminimum of 50% in all components of the theory examination will apply. Objective Structured Clinical Examination: A subminimum of 50% in all components of the clinical examination will apply. DP Requirement: 75% class attendance and 40% class mark.',
    {
      name: 'Fundamental Nursing Science 1',
      page: 'p. 334',
      ...split(40, 60),
      dpRequirement: dp(
        'DP Requirement: 75% class attendance and 40% class mark.',
        ['75% class attendance'],
        40,
      ),
      otherRules: NURS_OTHER,
    },
  ),
  module(
    CHS,
    'NURS116',
    'Formative assessment (40%): Written test and portfolio of evidence, group work assignment. Summative assessment (60%): Theory examination paper. A subminimum of 50% in all components of the theory examination will apply. Objective Structured Clinical Examination: A subminimum of 50% in all components of the clinical examination will apply. DP Requirement: 75% class attendance and 40% class mark.',
    {
      name: 'Fundamental Nursing Science 2',
      page: 'p. 334',
      ...split(40, 60),
      dpRequirement: dp(
        'DP Requirement: 75% class attendance and 40% class mark.',
        ['75% class attendance'],
        40,
      ),
      otherRules: NURS_OTHER,
    },
  ),
  module(CHS, 'ANAT120', ANAT, {
    name: 'Anatomy 1 for Nursing Students',
    page: 'p. 247',
    dpRequirement: dp('DP Requirement: 40%', [
      'DP Requirement: 40% (the entry doesn’t say of what)',
    ]),
    note: 'The weights are hedged ("might include", "can vary"), so no weighting is recorded; the DP line prints "40%" without saying of what, so no minimum is recorded.',
  }),
  module(CHS, 'ANAT121', ANAT, {
    name: 'Anatomy 2 for Nursing Students',
    page: 'p. 247',
    dpRequirement: dp('DP Requirement: 40%', [
      'DP Requirement: 40% (the entry doesn’t say of what)',
    ]),
    note: 'The entry repeats ANAT120\'s text word for word, including "For the Anatomy 1 module" (apparently a copy slip). Weights hedged and DP unclear, as ANAT120.',
  }),
  module(
    CHS,
    'HPHS1NU',
    'Assessment: Coursework assessment: (i) 2 class tests … and (ii) assignments. Each test will contribute equally to the semester mark. Assignments will contribute 30% to the semester mark and tests will contribute 70% to the semester mark. … Examination assessment: 1 2 hour written examination. The final module mark will be made up of 40% semester mark and 60% examination mark. DP Requirement: DP requirements: 40% obtained for the semester mark',
    {
      name: 'Physiology 1',
      page: 'p. 313',
      ...split(40, 60),
      examPapers: '1 2 hour written examination',
      dpRequirement: dp(
        'DP Requirement: DP requirements: 40% obtained for the semester mark',
        [],
        40,
      ),
      note: 'The 30/70 split is of the semester mark, so only the 40/60 split is recorded.',
    },
  ),
  module(
    CHS,
    'CHEM100',
    'Assessment: Tests, quizzes or assignments (33%); 3 h exam (67%). DP Requirement: Class mark 40%, 100% attendance at tests. For students in the School of Nursing only.',
    {
      name: 'Special Science',
      page: 'p. 427',
      ...split(33, 67),
      dpRequirement: dp(
        'DP Requirement: Class mark 40%, 100% attendance at tests.',
        ['100% attendance at tests'],
        40,
      ),
    },
  ),
  module(
    CHS,
    'PHYS131',
    'Assessment: Tests (24%), practicals (6%); 3 h exam (70%). DP Requirement: Class mark 40%, 100% attendance at tests, 80% attendance at lectures, tutorials and practicals.',
    {
      name: 'Intro Physics for Life Sciences & Agriculture',
      page: 'p. 428',
      components: [
        c('Tests', 'test', 24),
        c('Practicals', 'practical', 6),
        c('Exam (3 h)', 'exam', 70),
      ],
      ...split(30, 70),
      dpRequirement: dp(PHYS_DP, PHYS_CONDITIONS, 40),
    },
  ),
  module(
    CHS,
    'BIOL103',
    'Assessment: Theory tests (20%), practical tests (15%); practical reports (15%); 3 h theory exam (50%). DP Requirement: Attendance at 80% of practicals and 100% of tests. … Subminimum to pass: 40% in exam.',
    {
      name: 'Introductory Biology for Health Sciences',
      page: 'p. 429',
      components: [
        c('Theory tests', 'test', 20),
        c('Practical tests', 'practical', 15),
        c('Practical reports', 'practical', 15),
        c('Theory exam (3 h)', 'exam', 50, 40),
      ],
      ...split(50, 50),
      examSubminimum: 40,
      dpRequirement: dp('DP Requirement: Attendance at 80% of practicals and 100% of tests.', [
        'Attendance at 80% of practicals and 100% of tests',
      ]),
    },
  ),
  module(CHS, 'MATH150', `${MATH_33} ${MATH_DP}`, {
    name: 'Mathematics for Natural Sciences',
    page: 'p. 430',
    ...split(33, 67),
    dpRequirement: dp(MATH_DP, MATH_DP_CONDITIONS, 40),
  }),
  module(CHS, 'ZULN101', ZULU('School of IsiZulu Studies'), {
    name: 'Basic isiZulu Language Studies',
    page: 'p. 432',
    ...split(40, 60),
    dpRequirement: dp(
      'DP Requirement: Students must submit of all written work on time and must comply with the attendance requirements for the School of IsiZulu Studies.',
      ZULU_CONDITIONS,
    ),
  }),
  module(CHS, 'ZULM105', ZULU('School of IsiZulu Studies'), {
    name: 'Academic Writing',
    page: 'p. 432',
    ...split(40, 60),
    dpRequirement: dp(
      'DP Requirement: Students must submit of all written work on time and must comply with the attendance requirements for the School of IsiZulu Studies.',
      ZULU_CONDITIONS,
    ),
  }),
  module(
    CHS,
    'ACLE102',
    `Assessment: Class Mark ( 2 tests 30% and 2 Essays 35%) Class average mark 65% and Exam 35% ${ACLE_DP}`,
    {
      name: 'Academic Learning in English',
      page: 'p. 432',
      components: ACLE_COMPONENTS,
      ...split(65, 35),
      dpRequirement: dp(ACLE_DP, ['80% attendance', 'submission of all written work']),
    },
  ),
  // College of Humanities handbook 2026.
  module(
    COH,
    'SOWK103',
    'Assessment: Coursework: 50%; Examination: 50% DP Requirement: Submission of all written work on time and a minimum DP of 40%.',
    {
      name: 'Social Work and Developmental Social Welfare',
      page: 'p. 581',
      ...split(50, 50),
      dpRequirement: dp(
        'DP Requirement: Submission of all written work on time and a minimum DP of 40%.',
        ['Submission of all written work on time'],
        40,
      ),
    },
  ),
  module(
    COH,
    'SOWK112',
    'Assessment: Coursework: 50%, Examination: 50% DP Requirement: 80% attendance at all lectures and tutorials; Completion of all assignments, including the agency visit; Class mark of 50%',
    {
      name: 'Fields of Practice and Organisations in Social Work',
      page: 'p. 581',
      ...split(50, 50),
      dpRequirement: dp(
        'DP Requirement: 80% attendance at all lectures and tutorials; Completion of all assignments, including the agency visit; Class mark of 50%',
        [
          '80% attendance at all lectures and tutorials',
          'Completion of all assignments, including the agency visit',
        ],
        50,
      ),
    },
  ),
  module(
    COH,
    'SOWK113',
    'Assessment: Course mark: 50%; Examination: 50% DP Requirement: 80% attendance at all lectures and tutorials; Completion of all tasks and assignments is compulsory; Class mark of 50%',
    {
      name: 'Intro to Professional Social Work Practice',
      page: 'p. 581',
      ...split(50, 50),
      dpRequirement: dp(
        'DP Requirement: 80% attendance at all lectures and tutorials; Completion of all tasks and assignments is compulsory; Class mark of 50%',
        [
          '80% attendance at all lectures and tutorials',
          'Completion of all tasks and assignments is compulsory',
        ],
        50,
      ),
    },
  ),
  ...(
    [
      ['CFSD101', 'Introduction to Criminology', 'p. 366'],
      ['CFSD102', 'Introduction to Criminal Justice', 'p. 367'],
    ] as const
  ).map(([code, name, page]) =>
    module(
      COH,
      code,
      'Assessment: Cumulative assessment (50%): 3-hour examination: (50%) DP Requirement: Min DP requirements 40% accumulative for all pre-exam, formative and summative assessments.',
      {
        name,
        page,
        ...split(50, 50),
        dpRequirement: dp(
          'DP Requirement: Min DP requirements 40% accumulative for all pre-exam, formative and summative assessments.',
          [],
          40,
        ),
      },
    ),
  ),
  module(
    COH,
    'CMDV101',
    'Assessment: Written assignments: 50%; 3-hour examination: 50% DP Requirement: Attendance of 80% of lectures and 100% of tutorials is mandatory. Submission of all assignments on time.',
    {
      name: 'Intro to Community Development Theory',
      page: 'p. 361',
      ...split(50, 50),
      dpRequirement: dp(
        'DP Requirement: Attendance of 80% of lectures and 100% of tutorials is mandatory. Submission of all assignments on time.',
        [
          'Attendance of 80% of lectures and 100% of tutorials',
          'Submission of all assignments on time',
        ],
      ),
    },
  ),
  module(
    COH,
    'CMDV104',
    'Assessment: Written assignments 50% and a 3-hour examination DP Requirement: Attendance of 80% of lectures and 100% of tutorials is mandatory. Submission of all assignments on time.',
    {
      name: 'Institutions in Community Development',
      page: 'p. 361',
      dpRequirement: dp(
        'DP Requirement: Attendance of 80% of lectures and 100% of tutorials is mandatory. Submission of all assignments on time.',
        [
          'Attendance of 80% of lectures and 100% of tutorials',
          'Submission of all assignments on time',
        ],
      ),
      note: 'The exam weight is not printed, so no weighting is recorded.',
    },
  ),
  ...(
    [
      ['PSYC101', 'Introduction to Psychology A', 'p. 559'],
      ['PSYC102', 'Introduction to Psychology B', 'p. 560'],
    ] as const
  ).map(([code, name, page]) =>
    module(
      COH,
      code,
      'Assessment: Cumulative assessment (40%); Examination (60%) DP Requirement: Class mark minimum of 40%.',
      {
        name,
        page,
        ...split(40, 60),
        dpRequirement: dp('DP Requirement: Class mark minimum of 40%.', [], 40),
      },
    ),
  ),
  ...(
    [
      ['SOCY101', 'Introduction to Sociology'],
      ['SOCY102', 'Introduction to South African Society'],
    ] as const
  ).map(([code, name]) =>
    module(
      COH,
      code,
      'Assessment: Coursework (50%), examination (50%). DP Requirement: Minimum 40% in coursework; submission of all required tasks',
      {
        name,
        page: 'p. 577',
        ...split(50, 50),
        dpRequirement: dp(
          'DP Requirement: Minimum 40% in coursework; submission of all required tasks',
          ['submission of all required tasks'],
          40,
        ),
      },
    ),
  ),
  module(
    COH,
    'ELDV001',
    'Assessment: One 3-hour examination: 33%: Cumulative assessment 67% DP Requirement: 90% attendance; Completion of all assessment tasks.',
    {
      name: 'English Language Development A',
      page: 'p. 497',
      ...split(67, 33),
      dpRequirement: dp('DP Requirement: 90% attendance; Completion of all assessment tasks.', [
        '90% attendance',
        'Completion of all assessment tasks',
      ]),
    },
  ),
  ...(
    [
      ['ENGL101', 'Introduction to English Studies A'],
      ['ENGL102', 'Introduction to English Studies B'],
    ] as const
  ).map(([code, name]) =>
    module(
      COH,
      code,
      'Assessment: Class assignments (50%) which may include short exercises, tests and essay/s, and controlled assessment (50%) DP Requirement: Submit all written work on time, and attend at least 80% of classes.',
      {
        name,
        page: 'p. 498',
        components: [
          c('Class assignments', 'assignment', 50),
          c('Controlled assessment', 'other', 50),
        ],
        dpRequirement: dp(
          'DP Requirement: Submit all written work on time, and attend at least 80% of classes.',
          ['Submit all written work on time', 'attend at least 80% of classes'],
        ),
        note: 'The handbook says "controlled assessment", not "examination", so it is not recorded as an exam.',
      },
    ),
  ),
  ...(
    [
      ['HIST104', 'The Making of the Modern World', 'p. 514'],
      ['HIST105', 'Empires of the Modern World', 'p. 515'],
    ] as const
  ).map(([code, name, page]) =>
    module(
      COH,
      code,
      'Assessment: Class Work 50%; Examination 50% DP Requirement: Punctual submission of all written and oral work and attendance at 90% of tutorials.',
      {
        name,
        page,
        ...split(50, 50),
        dpRequirement: dp(
          'DP Requirement: Punctual submission of all written and oral work and attendance at 90% of tutorials.',
          ['Punctual submission of all written and oral work', 'attendance at 90% of tutorials'],
        ),
      },
    ),
  ),
  ...(['POLS101', 'POLS102'] as const).map((code) =>
    module(
      COH,
      code,
      'Assessment: Coursework (60%) (This may include tests, essays and tutorial assignments/participation); examination (40%). DP Requirement: Submission of all written work on time. 75% attendance of lectures and 100% attendance of tutorials.',
      {
        name:
          code === 'POLS101'
            ? 'Introduction to Political Science'
            : 'Introduction to Global Politics',
        page: 'p. 555',
        ...split(60, 40),
        dpRequirement: dp(
          'DP Requirement: Submission of all written work on time. 75% attendance of lectures and 100% attendance of tutorials.',
          [
            'Submission of all written work on time',
            '75% attendance of lectures and 100% attendance of tutorials',
          ],
        ),
      },
    ),
  ),
  ...(
    [
      ['ZULM101', 'Introduction to IsiZulu A'],
      ['ZULM102', 'Introduction to IsiZulu B'],
    ] as const
  ).map(([code, name]) =>
    module(COH, code, ZULU('IsiZulu Discipline').replace('submit of all', 'submit all'), {
      name,
      page: 'p. 593',
      ...split(40, 60),
      dpRequirement: dp(
        'DP Requirement: Students must submit all written work on time and must comply with the attendance requirements for the IsiZulu Discipline.',
        ZULU_CONDITIONS,
      ),
    }),
  ),
];

const GENERAL_RULES =
  'GENERAL ACADEMIC RULES FOR DEGREES, DIPLOMAS AND CERTIFICATES (College of Agriculture, Engineering and Science Handbook for 2026)';

export const ukznAssessment: UniversityAssessment = {
  rules: [
    {
      sourceUrl: CAES,
      academicYear: 2026,
      id: 'ukzn-general-rules',
      universityId: 'ukzn',
      title: GENERAL_RULES,
      passMark: {
        value: 50,
        quote:
          'The pass mark for all modules in the University shall be 50%, provided that any sub-minima required in certain components of the Senate-approved assessment have been met.',
        page: 'Rule GR27, p. 28',
      },
      examAdmission: {
        term: 'DP',
        quote:
          'a) Students shall not present themselves for examination in any module unless the module co-ordinator / lecturer has certified that they have met the DP requirements for the specified module. b) Such DP certification shall be valid only for the examinations, including supplementary examinations, of the semester in which it is issued. … d) The DP requirements for each module shall be published in the college handbook',
        page: 'Rule GR16, p. 26',
      },
      supplementary: {
        eligibleFinalMark: { from: 40 },
        alsoWhen: [
          'or who obtains a passing mark less than that prescribed for registration for another module, shall be awarded a supplementary examination',
          'under exceptional circumstances, and with the permission of the college academic affairs board, a student who has failed a module with a mark of less than 40% may be awarded a supplementary examination.',
        ],
        notWhen: [
          'Supplementary examinations shall not be awarded for any continuously assessed modules or components of modules.',
          'A supplementary or special aegrotat examination shall not be granted in respect of any supplementary examination awarded in terms of Rule GR22.',
        ],
        quote:
          'Provided that the rules of any college do not prohibit this for a particular module: a) a student who fails a module with a mark of at least 40%, or who obtains a passing mark less than that prescribed for registration for another module, shall be awarded a supplementary examination; (BR6) … To pass supplementary and special examinations, students must demonstrate a level of academic competence equivalent to that required in the original examination. (GR24)',
        page: 'Rules BR6, GR22, GR24, GR25, pp. 27–32',
      },
      deferredExam: {
        quote:
          'Special aegrotat examinations: A student who has commenced and not been able to complete the original final examination by reason of illness or any other reason deemed sufficient by the Senate, may, on application, be granted permission to sit a special aegrotat examination, during the next applicable supplementary examination session. … within five (5) working days of the date of the examination concerned.',
        page: 'Rule GR23, pp. 27–28',
      },
      otherRules: [
        {
          quote:
            '…a list of those students refused DP certification shall be published, in a manner deemed appropriate by the college on or before the last day of teaching in each semester. (GR16(e)) An appeal must be lodged with the relevant school, in the prescribed manner, on or before the date specified in the sessional dates which shall be no less than three (3) working days after the last day of notification of DP refusals. (GR17(b))',
          page: 'Rules GR16(e), GR17(b), p. 26',
        },
        {
          quote:
            '“supplementary examination” means an examination awarded by the Senate to a student, based on the student’s performance in the original module assessment. All examination papers which constitute the module shall be re-written.',
          page: 'Definitions, p. 21',
        },
      ],
      note: 'No supplementary cap or result rule, rounding rule, university-wide DP minimum, exam subminimum or module distinction percentage is printed. The range is printed only as "at least 40%" with "fails". The same rules are reprinted in the CLMS (GR27 p. 31), CHS and Humanities handbooks.',
    },
    {
      sourceUrl: CLMS,
      academicYear: 2026,
      id: 'ukzn-clms-rules',
      universityId: 'ukzn',
      faculty: CLMS_FACULTY,
      title: 'College of Law and Management Studies Handbook 2026',
      supplementary: {
        alsoWhen: [
          'A student may, at the discretion of the Board of the School in which (s)he is registered, be permitted to write supplementary examinations in all modules for which the student obtained a mark of at least 30% provided that passing all those supplementary examinations will result in the student fulfilling all the requirements for the completion of the qualification.',
        ],
        quote:
          'LM-U3 Supplementary Examinations 1. A student may, at the discretion of the Board of the School in which (s)he is registered, be permitted to write supplementary examinations in all modules for which the student obtained a mark of at least 30% provided that passing all those supplementary examinations will result in the student fulfilling all the requirements for the completion of the qualification.',
        page: 'Rule LM-U3, p. 66',
      },
      note: "The college overrides nothing else; the general rules' supplementary range (BR6) still applies.",
    },
  ],
  modules,
  calendars: [
    {
      sourceUrl: CAES,
      academicYear: 2026,
      universityId: 'ukzn',
      title: 'Sessional Dates 2026 (College of Agriculture, Engineering and Science Handbook)',
      semesters: [
        { term: 'S1', dates: { from: '2026-02-09', to: '2026-06-25' } },
        { term: 'S2', dates: { from: '2026-07-20', to: '2026-12-01' } },
      ],
      examPeriods: [
        {
          label: 'First semester main examinations',
          dates: { from: '2026-05-25', to: '2026-06-10' },
        },
        {
          label: 'Second semester main examinations',
          dates: { from: '2026-11-02', to: '2026-11-17' },
        },
      ],
      supplementaryExams: [
        {
          label: 'First semester supplementary examinations',
          dates: { from: '2026-06-18', to: '2026-06-25' },
        },
        {
          label: 'Second semester supplementary examinations',
          dates: { from: '2026-11-24', to: '2026-12-01' },
        },
      ],
      dpLists: [
        {
          label: 'DP refusals published (modules with formal sit-down examinations)',
          date: '2026-05-15',
        },
        {
          label: 'DP refusals published (modules with formal sit-down examinations)',
          date: '2026-10-26',
        },
      ],
      note: 'pp. 7–13. DP-refusal appeals close Wed 20 May 2026 @ 16h30 and Thu 29 Oct 2026. Supplementaries are awarded (BR6 "shall be awarded"), not applied for: no supplementary registration is printed. Semester dates run from "First semester and lectures commence" to "First semester ends for all students" (and the same for the second).',
    },
    {
      sourceUrl: 'https://registrar.ukzn.ac.za/sessional-dates-2027/',
      academicYear: 2027,
      universityId: 'ukzn',
      title: 'Sessional Dates 2027',
      semesters: [
        { term: 'S1', dates: { from: '2027-02-08', to: '2027-06-24' } },
        { term: 'S2', dates: { from: '2027-07-19', to: '2027-11-30' } },
      ],
      examPeriods: [
        {
          label: 'First semester main examinations',
          dates: { from: '2027-05-24', to: '2027-06-08' },
        },
        {
          label: 'Second semester main examinations',
          dates: { from: '2027-11-01', to: '2027-11-16' },
        },
      ],
      supplementaryExams: [
        {
          label: 'First semester supplementary examinations',
          dates: { from: '2027-06-17', to: '2027-06-24' },
        },
        {
          label: 'Second semester supplementary examinations',
          dates: { from: '2027-11-23', to: '2027-11-30' },
        },
      ],
      dpLists: [
        {
          label: 'DP refusals published (modules with formal sit-down examinations)',
          date: '2027-05-14',
        },
        {
          label: 'DP refusals published (modules with formal sit-down examinations)',
          date: '2027-10-25',
        },
      ],
      note: 'Read through a page summariser, not as raw text: check every date on the page. The main calendar for Howard College, Westville and Pietermaritzburg; Education and Medicine publish their own. DP-refusal appeals close Wed 19 May 2027 @ 16h30 and Thu 28 Oct 2027 at 16h30.',
    },
  ],
};
