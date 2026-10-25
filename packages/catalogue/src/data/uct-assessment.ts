import type { AssessmentComponent, ModuleAssessment, UniversityAssessment } from '../assessment';

/**
 * University of Cape Town (UCT): how marks work (Phase 6a). Schema:
 * `packages/catalogue/src/assessment.ts`.
 *
 * DRAFT: researched on 2026-10-24 from the 2026 handbooks (text extracted from UCT's own PDFs and
 * quoted from that text). Not yet verified by a person (hard rule 3): never add
 * `verifiedOn`/`verifiedBy`. A rule UCT doesn't print is left out, never a "usual" value (gotcha 40).
 *
 * - General rules: Handbook 3 (General Rules and Policies, 2026); faculty rules from handbooks 6a
 *   (Commerce), 7a (EBE), 8a (Health Sciences), 9a (Humanities).
 * - Module schemes: the course entries' "DP requirements" and "Assessment" paragraphs, for the
 *   first-year courses of the curricula in uct-curricula.ts, quoted verbatim. Weights are recorded
 *   only when printed exactly and adding up to 100: "up to 40%" (MAM1010F, MAM1020F, MAM1021S),
 *   "a maximum of 40% … a minimum of 60%" (HUB1006F) and "33.3% … 66.6%" (MAM1031F, MAM1032S,
 *   which add to 99.9) are quoted but give no weighting, so their calculators say the weights
 *   aren't published. The nine CIV and EEE engineering courses print no scheme ("Please refer to
 *   the official course handout document") and have no record: their learners' outlines fill it.
 * - Calendar: the DRAFT 2027 Academic Year Planner.
 */

const HANDBOOK_3 =
  'https://degree.uct.ac.za/sites/default/files/media/documents/uct_ac_za/49/2026-handbook-3.pdf';
const COMMERCE =
  'https://uct.ac.za/sites/default/files/media/documents/2026-commerce-handbook-6a-final-web.pdf';
const ENGINEERING =
  'https://uct.ac.za/sites/default/files/media/documents/2026-ebe-handbook-7a-final-web.pdf';
const HEALTH =
  'https://uct.ac.za/sites/default/files/media/documents/2026-fhs-handbook-8a-final-web.pdf';
const HUMANITIES =
  'https://uct.ac.za/sites/default/files/media/documents/2026-hum-handbook-9a-final-web.pdf';

type Entry = Omit<ModuleAssessment, 'sourceUrl' | 'academicYear' | 'universityId'>;
const course = (sourceUrl: string, entry: Entry): ModuleAssessment => ({
  sourceUrl,
  academicYear: 2026,
  universityId: 'uct',
  ...entry,
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
const dp = (quote: string, conditions: string[], minimumYearMark?: number) => ({
  term: 'DP',
  ...(minimumYearMark === undefined ? {} : { minimumYearMark }),
  conditions,
  quote,
});

const ECONOMICS_DP =
  'All tests/assignments/essays/projects/tutorial attendance/submissions to be completed for DP purposes (details will be provided in the course documentation). If your year mark is below 40% you will not be permitted to write the final examination.';
const CSC_DP = 'Minimum of 45% aggregate in practical work.';
const PHY_ENG_DP = 'An average of at least 40% for class record, including 50% for laboratories.';
const PHY_ENG_ASSESSMENT =
  'Class record (weekly problem sets, class tests and laboratory record) counts 50%; one 2-hour examination counts 50%. Although a supplementary examination is usually granted for a final grade in the range 45-49%, a supplementary examination may also be granted for certain key courses in the range 40-44% under conditions agreed to by the Deans of EBE and Science, normally involving a mandatory pre-supp tutoring and revision programme.';
const MAM_ENG_DP = '30% for class record, high tutorial attendance.';
const MAM103X_DP =
  'Minimum of 30% for class tests, minimum 30% for weekly online tests, and 80% attendance at tutorial sessions.';
const PPH_ASSESSMENT =
  'Continuous, performance-based in-course assessments provide students with regular feedback. Those students who achieve an average of 60% or above for these in-course assessments are not required to write the final written examination. Those students who average below 60% for their in-course assessments are required to write a final examination and must achieve a minimum of 50% in this examination in order to pass the course.';
const HUB_AP_ASSESSMENT = (code: string) =>
  `The in-course assessments comprise written and on-going practical assessments, which make up 45% of the final course mark. The final written and practical exams make up the remaining 55% of the final course mark. In order to pass ${code}, a final course mark of 50% is required. However, both the anatomy and physiology components of the course must be passed with a subminimum of at least 45% in the final course mark. In addition, a subminimum of 40% needs to be achieved in the examination.`;
const HUB_AP_OTHER =
  'both the anatomy and physiology components of the course must be passed with a subminimum of at least 45% in the final course mark.';
const SOC_PREAMBLE =
  'A pass mark for any course in Sociology is a minimum of 50%. (Department of Sociology preamble, p. 400)';

const modules: ModuleAssessment[] = [
  // Commerce handbook 6a.
  course(COMMERCE, {
    code: 'ACC1006F',
    name: 'Financial Accounting',
    page: 'p. 139',
    yearMarkWeight: 35,
    examWeight: 65,
    dpRequirement: dp(
      'Attendance at and submission of a minimum of 70% of tutorials AND a weighted average of 35% for class tests (excluding objective tests) and having written at least one class test AND an average of 35% for assignments. (where relevant and excludes objective tests).',
      [
        'Attendance at and submission of a minimum of 70% of tutorials',
        'a weighted average of 35% for class tests (excluding objective tests) and having written at least one class test',
        'an average of 35% for assignments (where relevant and excludes objective tests)',
      ],
    ),
    quote: 'Assessment: Coursework: 35% Exam: 65%',
  }),
  course(COMMERCE, {
    code: 'ACC1015F',
    name: 'Business Acumen for Accountants',
    page: 'p. 140',
    components: [
      c('Group assignment', 'project', 30),
      c(
        'Individual assignments (weekly writing assignment and learning journal)',
        'assignment',
        20,
      ),
      c('Final exam', 'exam', 50, 45),
    ],
    yearMarkWeight: 50,
    examWeight: 50,
    examSubminimum: 45,
    dpRequirement: dp(
      'Participation in group project, 70% attendance at tutorials and 70% submission of weekly hand in’s.',
      [
        'Participation in group project',
        '70% attendance at tutorials',
        '70% submission of weekly hand in’s',
      ],
    ),
    quote:
      'Assessment: Group assignment 30%. Individual assignments (Weekly writing assignment and learning journal) 20%. Final Exam 50%. A subminimum of 45% for the final examination is required in order to pass the course.',
    note: 'Printed as ACC1015F/S; the curriculum lists ACC1015F only.',
  }),
  course(COMMERCE, {
    code: 'ACC1011S',
    name: 'Financial Reporting I',
    page: 'p. 140',
    yearMarkWeight: 40,
    examWeight: 60,
    dpRequirement: dp(
      'A weighted average of 35% for class tests, having written at least one class test.',
      ['A weighted average of 35% for class tests, having written at least one class test.'],
    ),
    otherRules: [
      'NB: Students require an overall average of 60% for Financial Reporting I to proceed to Financial Reporting II',
    ],
    quote:
      'Assessment: Coursework: 40% Exam: 60%. The coursework component may include participation.',
  }),
  course(COMMERCE, {
    code: 'ECO1010F',
    alternativeCodes: ['ECO1010S'],
    name: 'Microeconomics',
    page: 'p. 153',
    yearMarkWeight: 50,
    examWeight: 50,
    dpRequirement: dp(
      ECONOMICS_DP,
      [
        'All tests/assignments/essays/projects/tutorial attendance/submissions to be completed for DP purposes',
      ],
      40,
    ),
    quote:
      'Assessment: Coursework 50%; Exam 50%. The course documentation will detail the breakdown for assessment weightings and variation for exemptions and absences. Note: The ECO1010F supplementary/deferred exam will be scheduled during the last week of the mid-year vacation. If students do not write this exam they will be marked as AB and will have to retake the course. The ECO1010S supplementary/deferred exam will be scheduled during January of the following year.',
  }),
  course(COMMERCE, {
    code: 'ECO1011S',
    alternativeCodes: ['ECO1011F'],
    name: 'Macroeconomics',
    page: 'p. 153',
    yearMarkWeight: 50,
    examWeight: 50,
    dpRequirement: dp(
      ECONOMICS_DP,
      [
        'All tests/assignments/essays/projects/tutorial attendance/submissions to be completed for DP purposes',
      ],
      40,
    ),
    quote:
      'Assessment: Coursework: 50%; Exam: 50%. The course documentation will detail the breakdown for assessment weightings and variation for exemptions and absences. Note: The ECO1011F supplementary/deferred exam will be scheduled during the last week of the mid-year vacation. … The ECO1011S supplementary/deferred exam will be scheduled during January of the following year.',
    note: 'Printed as ECO1011F/S; the curricula list ECO1011S. The DP text has no full stop at its end in the handbook.',
  }),
  course(COMMERCE, {
    code: 'INF1002F',
    alternativeCodes: ['INF1002S'],
    name: 'Foundations of Information Systems',
    page: 'p. 177',
    yearMarkWeight: 65,
    examWeight: 35,
    examSubminimum: 40,
    dpRequirement: dp(
      'Year mark greater than or equal to 45% (based on all assessments prior to the final exam). 80% participation for all practicals (tutorials and workshops).',
      ['80% participation for all practicals (tutorials and workshops)'],
      45,
    ),
    quote:
      'Assessment: Coursework 65%; Final Examination 35%. Sub-minimum of 40% for the final exam.',
  }),
  course(COMMERCE, {
    code: 'STA1000S',
    name: 'Introductory Statistics',
    page: 'p. 247',
    yearMarkWeight: 40,
    examWeight: 60,
    examPapers: 'a 2-hour exam',
    dpRequirement: dp(
      'Satisfactory attendance of lectures, tutorials, practicals and tests and completion of assignments and/or exercises as set out in course outline. Class record of at least 35%.',
      [
        'Satisfactory attendance of lectures, tutorials, practicals and tests and completion of assignments and/or exercises as set out in course outline.',
      ],
      35,
    ),
    otherRules: [
      'Weights will be adjusted in the case of missed assessments, as detailed in the course outline.',
    ],
    quote:
      'Assessment: Class record 40% and a 2-hour exam counting 60%. Weights will be adjusted in the case of missed assessments, as detailed in the course outline.',
  }),
  course(COMMERCE, {
    code: 'STA1006S',
    name: 'Mathematical Statistics I',
    page: 'p. 248',
    yearMarkWeight: 30,
    examWeight: 70,
    examPapers: 'a 3-hour exam',
    dpRequirement: dp(
      'Satisfactory attendance of lectures, tutorials, practicals and tests and completion of assignments and/or class exercises as set out in course outline. Class record of at least 35%.',
      [
        'Satisfactory attendance of lectures, tutorials, practicals and tests and completion of assignments and/or class exercises as set out in course outline.',
      ],
      35,
    ),
    otherRules: [
      'Weights will be adjusted in the case of missed assessments, as detailed in the course outline.',
    ],
    quote:
      'Assessment: Class record 30% and a 3-hour exam counting 70%. Weights will be adjusted in the case of missed assessments, as detailed in the course outline.',
  }),
  course(COMMERCE, {
    code: 'CML1001F',
    alternativeCodes: ['CML1001S'],
    name: 'Business Law I',
    page: 'p. 203',
    yearMarkWeight: 40,
    examWeight: 60,
    dpRequirement: dp(
      'Coursework is compulsory. If the student does not submit hand-ins or write a test the student will receive a mark of 0 for that assessment (unless granted an exemption). But the student will be able to write the exam.',
      ['Coursework is compulsory.'],
    ),
    quote: 'Assessment: Coursework 40%; final examination 60%.',
  }),
  course(COMMERCE, {
    code: 'BUS1036F',
    name: 'Evidence-based Management',
    page: 'p. 187',
    components: [c('Coursework', 'assignment', 75), c('Capstone assessment', 'project', 25, 45)],
    dpRequirement: dp(
      'Submission of all coursework assignments. Participation in small group case study discussions as required. Achieving a weighted average of at least 40%.',
      [
        'Submission of all coursework assignments.',
        'Participation in small group case study discussions as required.',
      ],
      40,
    ),
    quote:
      'Assessment: Coursework 75%; Capstone assessment 25%. A sub-minimum of 45% must be achieved in the capstone assessment.',
    note: 'Printed as BUS1036F/S. The capstone is recorded as a project, not an exam: the entry doesn’t call it an examination.',
  }),
  course(COMMERCE, {
    code: 'BUS1003H',
    name: 'Introduction to Actuarial Science',
    page: 'p. 186',
    components: [
      c('Tutorials and Assignments', 'assignment', 15),
      c('Tests', 'test', 35),
      c('Examination', 'exam', 50),
    ],
    yearMarkWeight: 50,
    examWeight: 50,
    dpRequirement: dp(
      'Attempting all classwork and obtaining an overall average of 40%.',
      ['Attempting all classwork'],
      40,
    ),
    quote: 'Assessment: Tutorials and Assignments 15%; Tests 35%; Examination 50%.',
  }),
  course(COMMERCE, {
    code: 'MAM1010F',
    name: 'Mathematics 1010',
    page: 'p. 219',
    dpRequirement: dp('Minimum of 30% in class tests and full attendance at workshops.', [
      'Minimum of 30% in class tests',
      'full attendance at workshops',
    ]),
    examPapers: 'June examination 1 x 2 hour paper',
    quote: 'Assessment: Semester mark up to 40%. June examination 1 x 2 hour paper',
    note: 'Weights not recorded: only "Semester mark up to 40%" is printed, no exact split.',
  }),
  course(COMMERCE, {
    code: 'MAM1031F',
    name: 'Mathematics 1031',
    page: 'p. 221',
    dpRequirement: dp(MAM103X_DP, [
      'Minimum of 30% for class tests',
      'minimum 30% for weekly online tests',
      '80% attendance at tutorial sessions',
    ]),
    quote: 'Assessment: Semester mark counts 33.3% and end-of-semester exam counts 66.6%.',
    note: 'Weights not recorded: the printed 33.3% and 66.6% add up to 99.9%, and a weighting is refused rather than rescaled. A person decides how to record it.',
  }),
  course(COMMERCE, {
    code: 'MAM1032S',
    name: 'Mathematics 1032',
    page: 'p. 221',
    dpRequirement: dp(MAM103X_DP, [
      'Minimum of 30% for class tests',
      'minimum 30% for weekly online tests',
      '80% attendance at tutorial sessions',
    ]),
    quote: 'Assessment: Semester mark counts 33.3% and end-of-semester exam counts 66.6%.',
    note: 'Weights not recorded: the printed 33.3% and 66.6% add up to 99.9%, and a weighting is refused rather than rescaled. A person decides how to record it.',
  }),
  course(COMMERCE, {
    code: 'CSC1015F',
    alternativeCodes: ['CSC1015S'],
    name: 'Computer Science 1015',
    page: 'p. 207',
    components: [
      c('Theory tests', 'test', 15),
      c('Practical tests and practical assignments', 'practical', 25, 45),
      c('June examination', 'exam', 60),
    ],
    yearMarkWeight: 40,
    examWeight: 60,
    examPapers: 'June examination 2 hours',
    dpRequirement: dp(CSC_DP, ['Minimum of 45% aggregate in practical work.']),
    otherRules: ['Subminima: … 45% on weighted average of theory tests and examination.'],
    quote:
      'Assessment: Theory tests 15%; practical tests and practical assignments 25%; June examination 2 hours 60%. Subminima: 45% for practicals, 45% on weighted average of theory tests and examination.',
    note: 'Also printed word for word in the EBE (p. 168) and Science (p. 102) handbooks.',
  }),
  // Science courses printed in the EBE handbook's "courses offered by other faculties".
  course(ENGINEERING, {
    code: 'CSC1016S',
    name: 'Computer Science 1016',
    page: 'p. 169',
    components: [
      c('Theory tests', 'test', 15),
      c('Practical tests and practical assignments', 'practical', 25, 45),
      c('November examination', 'exam', 60),
    ],
    yearMarkWeight: 40,
    examWeight: 60,
    examPapers: 'one 2-hour exam written in November',
    dpRequirement: dp(CSC_DP, ['Minimum of 45% aggregate in practical work.']),
    otherRules: ['Subminima: … 45% on weighted average of theory tests and examination.'],
    quote:
      'Assessment: Theory tests count 15%; practical tests and practical assignments count 25%; one 2-hour exam written in November counts 60%. Subminima: 45% for practicals and 45% on weighted average of theory tests and examination.',
  }),
  course(ENGINEERING, {
    code: 'MAM1020F',
    name: 'Mathematics IA for Engineers',
    page: 'p. 179',
    dpRequirement: dp(MAM_ENG_DP, ['high tutorial attendance'], 30),
    examPapers: 'Examination, not longer than 3 hours in June',
    quote:
      'Assessment: Examination, not longer than 3 hours in June: Class record up to 40%. DP requirements: 30% For class record, high tutorial attendance.',
    note: 'Weights not recorded: only "Class record up to 40%" is printed.',
  }),
  course(ENGINEERING, {
    code: 'MAM1021S',
    name: 'Mathematics IB for Engineers',
    page: 'p. 180',
    dpRequirement: dp(MAM_ENG_DP, ['high tutorial attendance'], 30),
    examPapers: 'Examination, not longer than 3 hours in June or November',
    quote:
      'Assessment: Examination, not longer than 3 hours in June or November: Class record up to 40%. DP requirements: 30% for class record, high tutorial attendance.',
    note: 'Weights not recorded: only "Class record up to 40%" is printed.',
  }),
  course(ENGINEERING, {
    code: 'PHY1012F',
    name: 'Physics A for Engineers',
    page: 'p. 187',
    yearMarkWeight: 50,
    examWeight: 50,
    examPapers: 'one 2-hour examination',
    dpRequirement: dp(PHY_ENG_DP, ['including 50% for laboratories'], 40),
    otherRules: [
      'Although a supplementary examination is usually granted for a final grade in the range 45-49%, a supplementary examination may also be granted for certain key courses in the range 40-44% under conditions agreed to by the Deans of EBE and Science, normally involving a mandatory pre-supp tutoring and revision programme.',
    ],
    quote: PHY_ENG_ASSESSMENT,
  }),
  course(ENGINEERING, {
    code: 'PHY1013S',
    name: 'Physics B for Engineers',
    page: 'pp. 188–189',
    yearMarkWeight: 50,
    examWeight: 50,
    examPapers: 'one 2-hour examination',
    dpRequirement: dp(PHY_ENG_DP, ['including 50% for laboratories'], 40),
    otherRules: [
      'Although a supplementary examination is usually granted for a final grade in the range 45-49%, a supplementary examination may also be granted for certain key courses in the range 40-44% under conditions agreed to by the Deans of EBE and Science, normally involving a mandatory pre-supp tutoring and revision programme.',
    ],
    quote: PHY_ENG_ASSESSMENT,
  }),
  course(ENGINEERING, {
    code: 'GEO1008F',
    name: 'Introduction to Geology for Civil Engineers',
    page: 'p. 176',
    yearMarkWeight: 40,
    examWeight: 60,
    examPapers: 'June examination 3 hours',
    dpRequirement: dp('Attendance of at least 80% of the practicals.', [
      'Attendance of at least 80% of the practicals.',
    ]),
    quote: 'Assessment: June examination 3 hours 60%, year mark 40%.',
  }),
  course(ENGINEERING, {
    code: 'APG1023S',
    name: 'Surveying and Geographic Information Systems for Engineers',
    page: 'p. 75',
    components: [
      c('Tests', 'test', 25),
      c('Practical assignments', 'assignment', 25),
      c('Examination', 'exam', 50, 40),
    ],
    yearMarkWeight: 50,
    examWeight: 50,
    examSubminimum: 40,
    examPapers: 'examination of 3 hours',
    dpRequirement: dp(
      'Attendance at and completion of all assignments with a minimum average of 40%, a minimum class test average of 40%.',
      [
        'Attendance at and completion of all assignments with a minimum average of 40%',
        'a minimum class test average of 40%',
      ],
    ),
    quote:
      'Assessment: Tests count 25%, practical assignments count 25%, examination of 3 hours counts 50% (sub-minimum 40%).',
  }),
  // Health Sciences handbook 8a.
  course(HEALTH, {
    code: 'PPH1001F',
    name: 'Becoming a Professional',
    page: 'p. 226',
    dpRequirement: dp(
      'Attendance of all small group learning sessions and other academic commitments, including the HIV-AIDS workshop; completion of all set assignments and assessment activities.',
      [
        'Attendance of all small group learning sessions and other academic commitments, including the HIV-AIDS workshop',
        'completion of all set assignments and assessment activities',
      ],
    ),
    otherRules: [PPH_ASSESSMENT],
    quote: `Assessment: ${PPH_ASSESSMENT}`,
    note: 'No weights are printed. The exemption at a 60% in-course average and the 50% exam minimum for those who write are quoted as other rules: the calculator does not apply them.',
  }),
  course(HEALTH, {
    code: 'PPH1002S',
    name: 'Becoming a Health Professional',
    page: 'p. 227',
    dpRequirement: dp(
      'Attendance of all group sessions, community and health service site visits and the life support skills workshop; completion of all assignments and assessment activities.',
      [
        'Attendance of all group sessions, community and health service site visits and the life support skills workshop',
        'completion of all assignments and assessment activities',
      ],
    ),
    otherRules: [PPH_ASSESSMENT],
    quote: `Assessment: ${PPH_ASSESSMENT}`,
    note: 'No weights are printed; the exemption and exam minimum are quoted, not applied.',
  }),
  course(HEALTH, {
    code: 'HUB1006F',
    name: 'Introduction to Integrated Health Sciences: Part I',
    page: 'p. 133',
    dpRequirement: dp(
      'Attendance at and/or participation in all academic activities, where official registers are circulated or online monitoring is available, including problem-based learning sessions, tutorials, workshops, and BHS practical sessions are a requirement for DP. Submission of all written and online assignments on time and completion of all in-course assessment activities are also a requirement for DP.',
      [
        'Attendance at and/or participation in all academic activities, where official registers are circulated or online monitoring is available',
        'Submission of all written and online assignments on time and completion of all in-course assessment activities',
      ],
    ),
    otherRules: [
      'In-course assessments account for a maximum of 40% and end-of-course assessments account for a minimum of 60% of the final course mark. Sub-minima may apply.',
      'Students who achieve a course result of 45-49% and pass at least one class test or the final examination will be eligible for a supplementary examination. Students who are granted a supplementary examination will have their final course results calculated using the same weightings as their original course mark. The marks from the supplementary examination will substitute for the original examination mark. The year mark will be retained in calculating the final course results.',
    ],
    quote:
      'All components of in-course and end-of-course assessments must be written to pass the course. … In-course assessments account for a maximum of 40% and end-of-course assessments account for a minimum of 60% of the final course mark. Sub-minima may apply. Students who achieve a course result of 45-49% and pass at least one class test or the final examination will be eligible for a supplementary examination. … The marks from the supplementary examination will substitute for the original examination mark. The year mark will be retained in calculating the final course results. Refer to the HUB1006F Course Handbook for further details regarding assessments and the course.',
    note: 'Weights not recorded: only a maximum and a minimum are printed; the split is in the course handbook (the learner’s outline).',
  }),
  course(HEALTH, {
    code: 'IBS1007S',
    name: 'Introduction to Integrated Health Sciences: Part II',
    page: 'pp. 142–143',
    dpRequirement: dp(
      'Irrespective of whether online or face-to-face, attendance of all academic activities, where official registers are circulated, including problem-based learning sessions, tutorials, Family Medicine OPD visits, workshops, and BHS practical sessions are a requirement for DP. Submission of all written assignments on time and completion of all in-course assessment activities are also a requirement for DP.',
      [
        'attendance of all academic activities, where official registers are circulated',
        'Submission of all written assignments on time and completion of all in-course assessment activities',
      ],
    ),
    otherRules: [
      'Students are required to achieve a course result of 45-49% and to pass at least one class test or the final examination in order to be eligible for a supplementary examination. Should students be granted a supplementary examination, the same weighting as the original examination mark will be used to calculate the final mark.',
    ],
    quote:
      'In-course assessments and end-of-course assessments are weighted as stipulated in the course handbook and count towards the final course mark. Sub-minima may apply. Students are required to achieve a course result of 45-49% and to pass at least one class test or the final examination in order to be eligible for a supplementary examination.',
    note: 'Weights not printed: "as stipulated in the course handbook".',
  }),
  course(HEALTH, {
    code: 'CEM1011F',
    name: 'Chemistry for Medical Students',
    page: 'p. 252',
    components: [
      c('Practical record', 'practical', 8),
      c('Tutorial exercises', 'tutorial', 5),
      c('Two class tests', 'test', 20),
      c('Practical test', 'practical', 12),
      c('Final examination', 'exam', 55, 45),
    ],
    yearMarkWeight: 45,
    examWeight: 55,
    examSubminimum: 45,
    dpRequirement: dp(
      'Irrespective of whether learning activities are delivered online or face-to-face, attendance and/or participation in all scheduled academic activities, completion of all set written course activities (i.e., practical reports, course tests and tutorial exercises).',
      [
        'attendance and/or participation in all scheduled academic activities',
        'completion of all set written course activities (i.e., practical reports, course tests and tutorial exercises)',
      ],
    ),
    quote:
      'Assessment: The class record counts 45% and comprises a practical record (8%); tutorial exercises (5%); two class tests (20%); and a practical test (12%). The final examination counts 55%. A subminimum of 45% is required in the final examination.',
  }),
  course(HEALTH, {
    code: 'PHY1025F',
    name: 'Physics',
    page: 'p. 255',
    components: [
      c('Class test 1', 'test', 10),
      c('Class test 2', 'test', 10),
      c('Class test 3', 'test', 10),
      c('Laboratory record', 'practical', 10),
      c('Final examination', 'exam', 60),
    ],
    yearMarkWeight: 40,
    examWeight: 60,
    dpRequirement: dp(
      'Attendance of all scheduled tutorials and practical sessions; completion of all set written course activities (i.e. tutorial assignments, practical reports and course tests); and a minimum class record of 35%.',
      [
        'Attendance of all scheduled tutorials and practical sessions',
        'completion of all set written course activities (i.e. tutorial assignments, practical reports and course tests)',
      ],
      35,
    ),
    quote:
      'Assessment: Coursework counts 40% and comprises three class tests (10% each) and a laboratory record (10%); and the final examination counts 60%.',
  }),
  course(HEALTH, {
    code: 'SLL1044S',
    name: 'Beginners’ Afrikaans for MBChB',
    page: 'p. 257',
    components: [
      c('In-course assessments', 'test', 50),
      c('Oral summative assessment', 'exam', 50),
    ],
    yearMarkWeight: 50,
    examWeight: 50,
    dpRequirement: dp(
      'Attendance of all lectures AND students are required to complete all in-course vocabulary and listening comprehension tests.',
      [
        'Attendance of all lectures',
        'complete all in-course vocabulary and listening comprehension tests',
      ],
    ),
    otherRules: ['The students receive a PA (pass) or F (fail) grade at the end of the course.'],
    quote:
      'Assessment: In-course assessments (50%) and one oral summative assessment (50%). The students receive a PA (pass) or F (fail) grade at the end of the course.',
  }),
  course(HEALTH, {
    code: 'SLL1041S',
    name: 'Beginners’ Xhosa for MBChB',
    page: 'p. 257',
    dpRequirement: dp('Attendance of all tutorials.', ['Attendance of all tutorials.']),
    otherRules: [
      'One oral summative assessment, for which students receive a PA (pass) or F (fail) grade.',
    ],
    quote:
      'Assessment: One oral summative assessment, for which students receive a PA (pass) or F (fail) grade.',
  }),
  course(HEALTH, {
    code: 'HUB1019F',
    name: 'Anatomy and Physiology IA',
    page: 'p. 134',
    yearMarkWeight: 45,
    examWeight: 55,
    passMark: 50,
    examSubminimum: 40,
    dpRequirement: dp(
      'Attendance of and participation in all lectures, practical sessions, workshops and tutorials, and submission of assignments by the due date. Both the anatomy and physiology components of the course require a subminimum of at least 40% to achieve DP.',
      [
        'Attendance of and participation in all lectures, practical sessions, workshops and tutorials, and submission of assignments by the due date',
        'Both the anatomy and physiology components of the course require a subminimum of at least 40% to achieve DP.',
      ],
    ),
    otherRules: [HUB_AP_OTHER],
    quote: `Assessment: ${HUB_AP_ASSESSMENT('HUB 1019F')}`,
  }),
  course(HEALTH, {
    code: 'HUB1020S',
    name: 'Anatomy and Physiology IB',
    page: 'p. 134',
    yearMarkWeight: 45,
    examWeight: 55,
    passMark: 50,
    examSubminimum: 40,
    dpRequirement: dp(
      'Attendance of, and or participation in all learning activities, including lectures, practical sessions, workshops and tutorials, and submissions of assignments by the due date are required for DP. Both the anatomy and physiology components of the course require a subminimum of at least 40% to achieve DP.',
      [
        'Attendance of, and or participation in all learning activities, including lectures, practical sessions, workshops and tutorials, and submissions of assignments by the due date',
        'Both the anatomy and physiology components of the course require a subminimum of at least 40% to achieve DP.',
      ],
    ),
    otherRules: [HUB_AP_OTHER],
    quote: `Assessment: ${HUB_AP_ASSESSMENT('HUB1020S')}`,
  }),
  course(HEALTH, {
    code: 'HUB1022F',
    name: 'Biosciences for Physiotherapy IA',
    page: 'p. 135',
    components: [
      c('Assignments', 'assignment', 10),
      c('Class tests', 'test', 30),
      c('Ad hoc mini tests', 'test', 20),
      c('Examination (three-hour written, June)', 'exam', 40),
    ],
    yearMarkWeight: 60,
    examWeight: 40,
    examPapers: 'a three-hour written examination in June',
    dpRequirement: dp(
      'Students must attend 75% of tutorials, hand-ins and mini tests and must obtain a combined class mark of at least 40%.',
      ['attend 75% of tutorials, hand-ins and mini tests'],
      40,
    ),
    otherRules: [
      'Both the physics and chemistry components of the course must be passed, with a subminimum of at least 40% for each component in the final examination.',
    ],
    quote:
      'Assessment: The course mark contributes 60% and comprises assignments (10%); class tests (30%); and ad hoc mini tests (20%). The examination contributes 40% and consists of a three-hour written examination in June. Both the physics and chemistry components of the course must be passed, with a subminimum of at least 40% for each component in the final examination.',
  }),
  course(HEALTH, {
    code: 'HUB1023S',
    name: 'Biosciences for Physiotherapy IB',
    page: 'p. 135',
    components: [
      c('Assignments', 'assignment', 10),
      c('Class tests', 'test', 30),
      c('Ad hoc mini tests', 'test', 20),
      c('Examination (three-hour written, November)', 'exam', 40),
    ],
    yearMarkWeight: 60,
    examWeight: 40,
    examPapers: 'a three-hour written paper in November',
    dpRequirement: dp(
      'Students must attend 75% of tutorials, hand-ins, and mini tests and obtain a combined class mark of at least 40%.',
      ['attend 75% of tutorials, hand-ins, and mini tests'],
      40,
    ),
    otherRules: [
      'Both the physics and chemistry components must be passed with a subminimum of 40% for each component in the final examination.',
    ],
    quote:
      'Assessment: The course mark contributes 60% and consists of assignments (10%), class tests (30%) and ad hoc mini tests (20%). The examination contributes 40% and consists of a three-hour written paper in November. Both the physics and chemistry components must be passed with a subminimum of 40% for each component in the final examination.',
  }),
  course(HEALTH, {
    code: 'AHS1033F',
    name: 'Movement Science I',
    page: 'p. 90',
    components: [
      c('Assignments and post-module tests', 'test', 15),
      c('Mid-semester theory test', 'test', 20),
      c('Structured practical test', 'practical', 15),
      c('Written examination', 'exam', 25),
      c('Structured practical examination', 'exam', 25),
    ],
    yearMarkWeight: 50,
    examWeight: 50,
    dpRequirement: dp(
      'Full attendance of and participation in all lectures, practical sessions, workshops and tutorials.',
      [
        'Full attendance of and participation in all lectures, practical sessions, workshops and tutorials.',
      ],
    ),
    quote:
      'Assessment: In-course assessment is weighted 50% and comprises assignments and post-module tests (15%) a mid-semester theory test (20%); and a structured practical test (15%). The final examination mark is weighted at 50% and comprises a written examination (25%) and a structured practical examination (25%).',
  }),
  course(HEALTH, {
    code: 'AHS1034S',
    name: 'Introduction to Applied Physiotherapy',
    page: 'p. 90',
    components: [
      c('Post-module tasks', 'assignment', 24),
      c('Theory test', 'test', 20),
      c('Structured practical test', 'practical', 16),
      c('Written examination', 'exam', 25),
      c('Structured practical exam', 'exam', 15),
    ],
    yearMarkWeight: 60,
    examWeight: 40,
    dpRequirement: dp(
      'Full attendance of and participation in all lectures, practical sessions, workshops and tutorials, and submission of assignments by the due dates.',
      [
        'Full attendance of and participation in all lectures, practical sessions, workshops and tutorials, and submission of assignments by the due dates.',
      ],
    ),
    quote:
      'Assessment: The coursework mark is weighted 60% and comprises post-module tasks (weighted 24%) towards the final mark); a theory test (20%); a structured practical test (16%) The final exam is weighted 40% and comprises of a written examination (25%) and a structured practical exam (15%).',
    note: 'The brackets are unbalanced in the handbook; quoted as printed.',
  }),
  // Humanities handbook 9a.
  course(HUMANITIES, {
    code: 'PSY1009F',
    name: 'Introduction to Psychology Part 1',
    page: 'p. 382',
    yearMarkWeight: 50,
    examWeight: 50,
    examPapers: 'one two-hour examination in June',
    dpRequirement: dp(
      'Satisfactory completion of all assignments by the due date, attending at least 80% of tutorials, complete both class tests. In addition, obtain one Student Research Participation Programme (SRPP) point or equivalent.',
      [
        'Satisfactory completion of all assignments by the due date',
        'attending at least 80% of tutorials',
        'complete both class tests',
        'obtain one Student Research Participation Programme (SRPP) point or equivalent',
      ],
    ),
    quote:
      'Assessment: Coursework (term assignments and tests) counts 50%; one two-hour examination in June counts 50%. Students are expected to complete the June examination and all coursework before being awarded a pass in this class.',
    note: 'The handbook prints "PSY1009F (previously PSY1004F)"; there is no 2026 PSY1004F entry.',
  }),
  course(HUMANITIES, {
    code: 'PSY1010S',
    name: 'Introduction to Psychology Part 2',
    page: 'p. 382',
    yearMarkWeight: 50,
    examWeight: 50,
    examPapers: 'one two-hour examination in November',
    dpRequirement: dp(
      'Satisfactory completion of all assignments by the due date, attending at least 80% of classroom tutorials, submitting all statistics lab-based exercises, complete both class tests. In addition, obtain two Student Research Participation Programme (SRPP) points or equivalent.',
      [
        'Satisfactory completion of all assignments by the due date',
        'attending at least 80% of classroom tutorials',
        'submitting all statistics lab-based exercises',
        'complete both class tests',
        'obtain two Student Research Participation Programme (SRPP) points or equivalent',
      ],
    ),
    quote:
      'Assessment: Coursework (term assignments and tests) counts 50%; one two-hour examination in November counts 50%. Students are expected to complete the November examination and all coursework before being awarded a pass in this class.',
  }),
  course(HUMANITIES, {
    code: 'SOC1001F',
    name: 'Introduction to Sociology',
    page: 'pp. 400–401',
    components: [c('Continuous assessment (essays, projects, tests, etc.)', 'other', 100)],
    passMark: 50,
    dpRequirement: dp('Completion of all written tests, essays and assignments.', [
      'Completion of all written tests, essays and assignments.',
    ]),
    quote: `Assessment: Continuous assessment (essays, projects, tests, etc.) counts 100%. ${SOC_PREAMBLE}`,
    note: 'The department preamble (p. 400) also says students "write an examination for each course in June and/or November", which conflicts with "counts 100%" continuous assessment: a person checks which holds.',
  }),
  course(HUMANITIES, {
    code: 'SOC1005S',
    name: 'Individual and Society',
    page: 'pp. 400–401',
    components: [c('Continuous assessment (essays, projects, tests, etc.)', 'other', 100)],
    passMark: 50,
    dpRequirement: dp('Completion of all written tests, essays and assignments as set.', [
      'Completion of all written tests, essays and assignments as set.',
    ]),
    quote: `Assessment: Continuous assessment (essays, projects, tests, etc.) counts 100%. ${SOC_PREAMBLE}`,
    note: 'Same preamble conflict as SOC1001F.',
  }),
  course(HUMANITIES, {
    code: 'SWK1013F',
    name: 'Community Connections',
    page: 'p. 390',
    yearMarkWeight: 50,
    examWeight: 50,
    examPapers: 'two-hour examination',
    dpRequirement: dp(
      'Submission of all essays, projects, seminar materials, and other required written work by the due date. Field trips where required, are compulsory. Attendance of lectures or seminars as indicated by the department.',
      [
        'Submission of all essays, projects, seminar materials, and other required written work by the due date.',
        'Field trips where required, are compulsory.',
        'Attendance of lectures or seminars as indicated by the department.',
      ],
    ),
    quote: 'Assessment: Coursework counts 50%; two-hour examination counts 50%.',
  }),
  course(HUMANITIES, {
    code: 'SWK1006S',
    name: 'Basic Professional Interaction',
    page: 'p. 390',
    yearMarkWeight: 50,
    examWeight: 50,
    examPapers: 'two-hour November examination',
    dpRequirement: dp(
      'Submission of all essays, projects, seminar materials and other required written work by the due date.',
      [
        'Submission of all essays, projects, seminar materials and other required written work by the due date.',
      ],
    ),
    quote: 'Assessment: Coursework counts 50%; two-hour November examination counts 50%.',
  }),
  course(HUMANITIES, {
    code: 'SWK1005S',
    name: 'Field Practice I',
    page: 'p. 389',
    dpRequirement: dp('Attendance of at least 80% of the workshops.', [
      'Attendance of at least 80% of the workshops.',
    ]),
    otherRules: [
      'The course will be examined through a practical examination where students will have to demonstrate that they have achieved competency in using the skills taught in the workshops.',
    ],
    quote:
      'Assessment: The course will be examined through a practical examination where students will have to demonstrate that they have achieved competency in using the skills taught in the workshops.',
    note: 'No weights or pass mark are printed.',
  }),
];

export const uctAssessment: UniversityAssessment = {
  rules: [
    {
      sourceUrl: HANDBOOK_3,
      academicYear: 2026,
      id: 'uct-general-rules',
      universityId: 'uct',
      title: '2026 Handbook 3, General Rules and Policies',
      passMark: {
        value: 50,
        quote:
          'G26.1 Results are classified and published as follows in all courses for bachelor and honours degrees and for diplomas and certificates: 75% to 100% First Class / 70 - 74% Second Class (Division One) / 60 – 69% Second Class (Division Two) / 50 – 59% Third Class … F 0-49% Fail',
        page: 'Rule G26.1, p. 18',
      },
      examAdmission: {
        term: 'DP',
        quote:
          'Senate may prescribe minimum requirements of attendance and performance in the work of a class which students must meet in order to be allowed to take the examination in the course. … Where Senate prescribes such minimum requirements the head of department must publish the list of those awarded and those refused duly performed certificates on or before the last teaching day of term.',
        page: 'Rules GB9.1, GB9.3, p. 26',
      },
      supplementary: {
        result: { kind: 'recorded-pass-or-fail' },
        notWhen: [
          'a supplementary examination may not be deferred for any reason;',
          'a student who is writing a deferred examination is not eligible for a supplementary exam.',
          'If a student is unable to sit the supplementary examination for any reason, the supplementary examination is forfeited and the original result stands.',
        ],
        quote:
          'The rules for a degree may allow Senate to permit students who fail in one or more courses to present themselves for a supplementary examination in one or more than one course. (GB11) … UP Unclassified Pass. A condoned pass or a supplementary examination written on academic grounds is graded as an Unclassified Pass. (G26.1) … Senate may take into account the results of the candidate’s original examination in the subject, as well as class work which did not form part of the examination, in deciding the result of a candidate who has taken a supplementary examination. (G22.1(c))',
        page: 'Rules GB11, G22.1, G26.1, G27.1, pp. 14–15, 18–19, 26',
      },
      deferredExam: {
        quote:
          'The Deferred Examination Committee (DEC) on behalf of Senate may allow students to write a deferred examination where they are unable to write a final examination for medical reasons, or where they have religious objections, or political objections, or other good cause for not writing on the scheduled day or days. … Any such application must be submitted to the Student Records Office … not later than seven calendar days after the day scheduled for the examination concerned, supported by a medical certificate or other documentary evidence.',
        page: 'Rules G27.1, G28.1(b), pp. 19–20',
      },
      otherRules: [
        {
          quote:
            'Senate … will not grant permission to students to write a deferred examination in courses in which they have been refused a duly performed certificate.',
          page: 'Rule G27.2(b), p. 19',
        },
      ],
      note: 'Handbook 3 has no sentence "the pass mark is 50%": the 50 comes from the G26.1 classification (50–59% Third Class, 0–49% Fail). The supplementary result is recorded as "pass or fail" from G26.1 ("graded as an Unclassified Pass") and G22.3 (a failed supplementary is recorded with its percentage and SF). No university-wide DP minimum, subminimum, supplementary range, rounding or distinction percentage is printed.',
    },
    {
      sourceUrl: COMMERCE,
      academicYear: 2026,
      id: 'uct-commerce-rules',
      universityId: 'uct',
      faculty: 'Commerce',
      title: 'Faculty of Commerce Handbook 2026',
      examAdmission: {
        term: 'DP',
        quote:
          'Candidates may not sit the final examination in a course if they have not been granted a Duly Performed Certificate for the course … Conditions for the award of a duly performed certificate are set out in the course description of each course in this handbook.',
        page: 'Rule FBA5, p. 25',
      },
      supplementary: {
        eligibleFinalMark: { from: 45, to: 49 },
        alsoWhen: [
          'A student will be granted a supplementary examination where only one outstanding course remains for the completion of the degree, and the student attained a final mark between 40% and 44% for that course unless supplementary examinations are not offered for the course.',
        ],
        result: { kind: 'recorded-pass-or-fail' },
        quote:
          'FS 45 – 49% Failed, but allowed to write a supplementary examination on academic grounds … SP Pass result obtained via a supplementary examination … UP Unclassified Pass A condoned pass or a supplementary examination that is written on academic grounds will be graded as an Unclassified Pass',
        page: 'General Information section 3, p. 13; Rule FBA14, p. 27',
      },
    },
    {
      sourceUrl: ENGINEERING,
      academicYear: 2026,
      id: 'uct-ebe-rules',
      universityId: 'uct',
      faculty: 'Engineering & the Built Environment',
      title: 'Faculty of Engineering & the Built Environment Handbook 2026',
      examAdmission: {
        term: 'DP',
        conditions: [
          'all parts of each project, tutorial and other assignments are completed to an acceptable standard and submitted for assessment at stipulated times',
          'there is satisfactory attendance (as prescribed by Senate) and satisfactory participation in all sections of the course',
        ],
        quote:
          'A DP certificate may be withheld unless (i) all parts of each project, tutorial and other assignments are completed to an acceptable standard and submitted for assessment at stipulated times; (ii) there is satisfactory attendance (as prescribed by Senate) and satisfactory participation in all sections of the course.',
        page: 'Rule FB6.3, p. 14',
      },
      supplementary: {
        eligibleFinalMark: { from: 45 },
        alsoWhen: [
          'Senate may permit candidates to take a second final examination … subject to the following: Students must have DP for the course, Students must have obtained marks from 40% to 44% in the course, and Attended the TRP.',
        ],
        notWhen: [
          'Courses in the Department of Chemical Engineering with mandatory reassessments do not offer supplementary examinations',
        ],
        quote:
          'Senate may permit candidates to take supplementary examinations in undergraduate and honours courses offered by a department, subject to supplementary examinations being offered in the department concerned … and subject to the following: Students must have DP for the course, and Students must have achieved at least 45% in the course.',
        page: 'Rules FB7.1, FB7.2, p. 15',
      },
      otherRules: [
        {
          quote:
            'Where an additional assessment is undertaken, the maximum mark obtainable is 50%, failing which the mark remains un-changed',
          page: 'Rule FB7.3, p. 15 (final-year additional assessment only)',
        },
      ],
      note: 'No cap is printed for an FB7.1 supplementary; the 50% maximum applies only to the FB7.3 final-year additional assessment.',
    },
    {
      sourceUrl: HEALTH,
      academicYear: 2026,
      id: 'uct-health-sciences-rules',
      universityId: 'uct',
      faculty: 'Health Sciences',
      title: 'Faculty of Health Sciences Handbook 2026',
      examAdmission: {
        term: 'Due Performance',
        quote:
          'A student who does not meet a specified Due Performance requirement for a course that has such requirements fails the course and has to repeat it … DP requirements for many courses therefore include full attendance and submission of all work by due dates.',
        page: 'Rule FGU 9.8, p. 37',
      },
      supplementary: {
        eligibleFinalMark: { from: 45 },
        notWhen: [
          'has failed a course with less than 45%',
          'has failed more than one component of a course that has subcomponents with subminimum during the final examination',
          'has performed poorly throughout the course, as opposed to only during the final examination',
          'fails two or more courses',
          'fails and has to repeat another course',
        ],
        quote:
          'The Senate may permit a student who fails a course if, in its judgement, they have performed adequately in the work of the course, to write a supplementary examination. To determine the final result for the course, the mark for the supplementary examination is either usually added to the class (or year-) mark or used as a stand-alone mark. (FGU 8.2) … A supplementary examination is not usually offered when a student: (a) has failed a course with less than 45%; … (FGU 9.7)',
        page: 'Rules FGU 8.2, FGU 9.7, pp. 35–37',
      },
      note: 'The range is read from FGU 9.7(a) ("not usually offered … less than 45%"), not printed as "45–49". The result is "either … added to the class mark or used as a stand-alone mark", so no result kind is recorded. MBChB years 4–6 have their own 48–49% rule (p. 29).',
    },
    {
      sourceUrl: HUMANITIES,
      academicYear: 2026,
      id: 'uct-humanities-rules',
      universityId: 'uct',
      faculty: 'Humanities',
      title: 'Faculty of Humanities Handbook 2026',
      examAdmission: {
        term: 'DP',
        quote:
          'Candidates may not sit the examination in a course if they have been refused a duly performed certificate for the course … Conditions for the award of a duly performed certificate are set out in the course description for the course concerned in this handbook.',
        page: 'Rule F4, p. 13',
      },
      supplementary: {
        offered: false,
        quote: 'The Faculty will not normally award supplementary examinations.',
        page: 'Rule F18.1, p. 18',
      },
      otherRules: [
        {
          quote:
            'The Head of the Department may require, on academic grounds, the student to undertake further tests or examinations during the period between the completion of the internal marking process and the finalisation of the results by the external examiner.',
          page: 'Rule F18.2, p. 18',
        },
      ],
      note: 'Courses taught by other faculties follow their own entries (e.g. the College of Accounting "will award a supplementary exam for ACC1006F").',
    },
  ],
  modules,
  calendars: [
    {
      sourceUrl: 'https://uct.ac.za/media/777169',
      academicYear: 2027,
      universityId: 'uct',
      title: 'Draft 2027 Academic Year Planner',
      examPeriods: [
        {
          label: 'June examinations (exams day 1 to 14)',
          dates: { from: '2027-05-19', to: '2027-06-07' },
        },
        {
          label: 'November examinations (exam day 1 to 14)',
          dates: { from: '2027-10-20', to: '2027-11-08' },
        },
      ],
      supplementaryExams: [
        { label: 'Supps & DE (F courses)', dates: { from: '2027-06-28', to: '2027-07-02' } },
        { label: 'DE & Supp exams', dates: { from: '2027-11-22', to: '2027-11-26' } },
      ],
      note: 'A DRAFT planner (.docx, linked from uct.ac.za/academic-calendar): re-check when the approved 2027 calendar appears. It moves the second semester\'s supplementaries to November (Handbook 3 G20.1 says "normally held in January"). The overview says 13 November exam days; the daily grid lists 14. DP lists: no date printed; GB9 says "before or on the last teaching day of the semester" (teaching day 60: 11 May and 12 October 2027). No supplementary registration is printed. Faculty of Health Sciences undergraduate dates are published separately.',
    },
  ],
};
