import type { ApplicationWindow, Programme, University } from '../records';
import { requires } from '../records';
import { ENGLISH_ANY, LIFE_SCI, MATHS, PHYSICAL } from './subject-groups';

/**
 * University of Pretoria, 2027 intake.
 *
 * DRAFT: researched on 2026-10-13 from UP's 2027 programme infographics and application
 * requirement tables (files.up.ac.za). The APS method itself is quoted from UP's 2026 NSC/IEB
 * prospectus because www.up.ac.za refused automated access; confirm it against the 2027
 * prospectus when verifying. Nothing here reaches a student until verified (hard rule 3).
 */

const TABLES_2027 =
  'https://drupalwebprod-files.up.ac.za/Public/2026-03/UP_DESA_Application%20requirements%20tables_2027_web.pdf?VersionId=vw30gCBk2BMAXzOhFSBflmkFOHOMFOoa';
const INTERNATIONAL_2027 =
  'https://drupalwebprod-files.up.ac.za/Public/2026-01/UP_International%20undergraduate%20prospectus%202027_DevV5_web_0.pdf?VersionId=egrlWPH7OXcBE9lmjX5HETrKreTMOVVz';
const INFOGRAPHIC = (path: string) => `https://drupalwebprod-files.up.ac.za/Public/2026-02/${path}`;

export const up: University = {
  sourceUrl: INTERNATIONAL_2027,
  academicYear: 2027,
  id: 'up',
  name: 'University of Pretoria',
  shortName: 'UP',
  city: 'Pretoria',
  province: 'Gauteng',
  applicationRoute: 'direct',
  applyUrl: 'https://www.up.ac.za/apply',
};

export const upWindow: ApplicationWindow = {
  sourceUrl: INTERNATIONAL_2027,
  academicYear: 2027,
  universityId: 'up',
  opensOn: '2026-04-01',
  closesOn: '2026-06-30',
  earlierClosings: [{ scope: 'Faculty of Veterinary Science', closesOn: '2026-05-31' }],
  grade11ResultsAccepted: true,
  // The amount could not be confirmed on an official page; left blank rather than guessed.
  feeZar: null,
  feeNote:
    "'All study programmes at the University of Pretoria are number-limited.' Apply with final Grade 11 results.",
};

const NOT_GUARANTEED =
  "'Meeting the application requirements does not guarantee admission into a programme.'";
const base = {
  academicYear: 2027,
  universityId: 'up',
  nbt: 'none',
  closesOn: null,
  requiredPass: 'bachelor',
} as const;
const ENGLISH = (level: number) => requires(ENGLISH_ANY, { level });

export const upProgrammes: Programme[] = [
  {
    ...base,
    sourceUrl: INFOGRAPHIC(
      'UP_EBIT%202027_infographic_Bachelor%20of%20Science%20in%20Computer%20Science_web.pdf',
    ),
    id: 'up-bsc-computer-science',
    name: 'Bachelor of Science in Computer Science',
    faculty: 'Engineering, Built Environment and Information Technology',
    qualification: 'degree',
    durationYears: 3,
    minimumScore: 30,
    subjectRequirements: [ENGLISH(5), requires(MATHS, { level: 6 })],
    selection: NOT_GUARANTEED,
  },
  {
    ...base,
    sourceUrl: INFOGRAPHIC(
      'UP_EBIT%202027_infographic_Bachelor%20of%20Engineering%20in%20Civil%20Engineering_web.pdf',
    ),
    id: 'up-beng-civil',
    name: 'Bachelor of Engineering in Civil Engineering',
    faculty: 'Engineering, Built Environment and Information Technology',
    qualification: 'degree',
    durationYears: 4,
    minimumScore: 35,
    subjectRequirements: [
      ENGLISH(5),
      requires(MATHS, { level: 6 }),
      requires(PHYSICAL, { level: 6 }),
    ],
    selection: NOT_GUARANTEED,
  },
  {
    ...base,
    sourceUrl: INFOGRAPHIC(
      'UP_EBIT%202027_infographic_Bachelor%20of%20Engineering%20in%20Electrical%20Engineering_web.pdf',
    ),
    id: 'up-beng-electrical',
    name: 'Bachelor of Engineering in Electrical Engineering',
    faculty: 'Engineering, Built Environment and Information Technology',
    qualification: 'degree',
    durationYears: 4,
    minimumScore: 35,
    subjectRequirements: [
      ENGLISH(5),
      requires(MATHS, { level: 6 }),
      requires(PHYSICAL, { level: 6 }),
    ],
    selection: NOT_GUARANTEED,
  },
  {
    ...base,
    sourceUrl: INFOGRAPHIC(
      'UP_Health%20Sciences%202027_infographic_Bachelor%20of%20Medicine%20and%20Surgery_web.pdf',
    ),
    id: 'up-mbchb',
    name: 'Bachelor of Medicine and Surgery (MBChB)',
    faculty: 'Health Sciences',
    qualification: 'degree',
    durationYears: 6,
    minimumScore: 35,
    subjectRequirements: [
      ENGLISH(5),
      requires(MATHS, { level: 6 }),
      requires(PHYSICAL, { level: 5 }),
    ],
    selection:
      "'Each year, 300 first-year students are chosen.' Selection is by merit list. 'Conditional offers are based on your final Grade 11 results.' To keep a conditional offer you must maintain your Grade 11 average in the final exams.",
  },
  {
    ...base,
    sourceUrl: INFOGRAPHIC(
      'UP_Health%20Sciences%202027_infographic_Bachelor%20of%20Nursing%20Science_web.pdf?VersionId=iqUoTjosY6o008kV2zYIFIOxHd8sWZZe',
    ),
    id: 'up-bnursing-science',
    name: 'Bachelor of Nursing Science',
    faculty: 'Health Sciences',
    qualification: 'degree',
    durationYears: 4,
    minimumScore: 28,
    subjectRequirements: [
      ENGLISH(4),
      requires(MATHS, { level: 4 }),
      requires(LIFE_SCI, { level: 4 }),
    ],
    selection:
      "Selection programme: 'Admission is competitive and not guaranteed, even if the application requirements are met.' Selection uses final Grade 11 results.",
  },
  {
    ...base,
    sourceUrl: INFOGRAPHIC(
      'UP_EMS%202027_infographic_Bachelor%20of%20Commerce%20in%20Accounting%20Sciences_web.pdf',
    ),
    id: 'up-bcom-accounting-sciences',
    name: 'Bachelor of Commerce in Accounting Sciences',
    faculty: 'Economic and Management Sciences',
    qualification: 'degree',
    durationYears: 3,
    minimumScore: 34,
    subjectRequirements: [ENGLISH(5), requires(MATHS, { level: 6 })],
    selection: `The first step towards qualifying as a chartered accountant. Accounting at school is not required. ${NOT_GUARANTEED}`,
  },
  {
    ...base,
    sourceUrl: TABLES_2027,
    id: 'up-bcom',
    name: 'Bachelor of Commerce',
    faculty: 'Economic and Management Sciences',
    qualification: 'degree',
    durationYears: 3,
    minimumScore: 30,
    subjectRequirements: [ENGLISH(5), requires(MATHS, { level: 4 })],
    selection: NOT_GUARANTEED,
  },
  {
    ...base,
    sourceUrl:
      'https://drupalwebprod-files.up.ac.za/Public/2026-02/UP_Law%202027_infographic_How%20to%20choose_web.pdf?VersionId=_2hLza01KEwN_L9uT7e4eOyphwM0lLkp',
    id: 'up-llb',
    name: 'Bachelor of Laws (LLB)',
    faculty: 'Law',
    qualification: 'degree',
    durationYears: 4,
    minimumScore: 35,
    subjectRequirements: [ENGLISH(6)],
    selection: `Apply as early as possible from 1 April. Other routes into law: BA specialising in Law (APS 34) and BCom specialising in Law (APS 32). ${NOT_GUARANTEED}`,
  },
  {
    ...base,
    sourceUrl: INFOGRAPHIC('UP_Humanities%202027_infographic_Bachelor%20of%20Arts_web.pdf'),
    id: 'up-ba',
    name: 'Bachelor of Arts',
    faculty: 'Humanities',
    qualification: 'degree',
    durationYears: 3,
    minimumScore: 30,
    subjectRequirements: [ENGLISH(5)],
    selection:
      'APS 30 on Grade 11 results for a conditional offer; to keep it you need APS 28 in the final Grade 12 results.',
  },
  {
    ...base,
    sourceUrl: INFOGRAPHIC(
      'UP_Education%202027_infographic_Bachelor%20of%20Education%20in%20Foundation%20Phase%20Teaching_web.pdf',
    ),
    id: 'up-bed-foundation-phase',
    name: 'Bachelor of Education in Foundation Phase Teaching',
    faculty: 'Education',
    qualification: 'degree',
    durationYears: 4,
    minimumScore: 28,
    subjectRequirements: [ENGLISH(4)],
    selection: NOT_GUARANTEED,
  },
  {
    ...base,
    sourceUrl: INFOGRAPHIC(
      'UP_Humanities%202027_infographic_Bachelor%20of%20Social%20Work_web.pdf',
    ),
    id: 'up-bsw',
    name: 'Bachelor of Social Work',
    faculty: 'Humanities',
    qualification: 'degree',
    durationYears: 4,
    minimumScore: 30,
    subjectRequirements: [ENGLISH(5)],
    selection:
      'APS 30 on Grade 11 results for a conditional offer; APS 28 in the final Grade 12 results confirms it. Students go through departmental selection at the end of first year.',
  },
  {
    ...base,
    sourceUrl:
      'https://drupalwebprod-files.up.ac.za/Public/2026-03/Bachelor%20of%20Commerce%204%20years%20UP_EMS%202027_infographic.pdf?VersionId=Dt_Y2n.z8P.m.12YCQAtg1LvJxw1m90z',
    id: 'up-bcom-extended',
    name: 'Bachelor of Commerce (four-year programme)',
    faculty: 'Economic and Management Sciences',
    qualification: 'extended-degree',
    durationYears: 4,
    minimumScore: 26,
    subjectRequirements: [ENGLISH(4), requires(MATHS, { level: 3 })],
    selection:
      "'This is a selection programme. Additional selection criteria apply.' For learners whose results don't meet the three-year BCom. The first year is a foundation year.",
  },
  {
    ...base,
    sourceUrl: TABLES_2027,
    id: 'up-beng-extended',
    name: 'Bachelor of Engineering (five-year programme)',
    faculty: 'Engineering, Built Environment and Information Technology',
    qualification: 'extended-degree',
    durationYears: 5,
    minimumScore: 33,
    subjectRequirements: [
      requires(ENGLISH_ANY, { percent: 65 }),
      requires(MATHS, { percent: 65 }),
      requires(PHYSICAL, { percent: 65 }),
    ],
    selection:
      'A five-year programme for all engineering disciplines; the first year offers foundation modules.',
  },
  {
    ...base,
    sourceUrl: TABLES_2027,
    id: 'up-bsc-extended-physical',
    name: 'Bachelor of Science (four-year programme): Chemistry, Geoinformatics, Geology, Meteorology or Physics',
    faculty: 'Natural and Agricultural Sciences',
    qualification: 'extended-degree',
    durationYears: 4,
    minimumScore: 32,
    subjectRequirements: [
      requires(ENGLISH_ANY, { percent: 58 }),
      requires(MATHS, { percent: 58 }),
      requires(PHYSICAL, { percent: 58 }),
    ],
    selection: 'The first year offers foundation modules.',
  },
];
