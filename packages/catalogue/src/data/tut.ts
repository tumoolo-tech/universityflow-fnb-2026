import type { ApplicationWindow, Programme, University } from '../records';
import { either, otherSubjects, requires } from '../records';
import {
  ACCOUNTING,
  ADDITIONAL_LANGUAGES,
  ENGLISH_ANY,
  HOME_LANGUAGES,
  LIFE_SCI,
  MATHS,
  MATHS_LIT,
  MATHS_OR_TECH,
  PHYSICAL_OR_TECH,
} from './subject-groups';

/**
 * Tshwane University of Technology, 2027 intake (applications made during 2026).
 *
 * DRAFT: researched from TUT's own 2027 First Year Course Information on 2026-10-13. Not yet
 * verified by a person, so no record here reaches a student (hard rule 3) until `verifiedOn`
 * and `verifiedBy` are added after checking each one against the source.
 */

const COURSE_INFO =
  'https://www.tut.ac.za/media/tshwane-interim/site-content/documents/First-Year-Course_Information.pdf';
const SOURCE = { sourceUrl: COURSE_INFO, academicYear: 2027 } as const;

export const tut: University = {
  ...SOURCE,
  id: 'tut',
  name: 'Tshwane University of Technology',
  shortName: 'TUT',
  city: 'Pretoria',
  province: 'Gauteng',
  applicationRoute: 'direct',
  applyUrl: 'https://applications-prod.tut.ac.za/',
};

export const tutWindow: ApplicationWindow = {
  ...SOURCE,
  universityId: 'tut',
  opensOn: '2026-04-01',
  closesOn: '2026-09-30',
  earlierClosings: [
    { scope: 'BNursing, BPharm and other listed health programmes', closesOn: '2026-06-15' },
    {
      scope:
        'Arts and Design, Humanities (including all BEd, Policing and Law) and listed Science programmes',
      closesOn: '2026-07-31',
    },
  ],
  grade11ResultsAccepted: true,
  feeZar: 240,
  feeNote:
    'Payable once, non-refundable. TUT says a programme may close when it is full, even before the deadline.',
};

const base = { ...SOURCE, universityId: 'tut', nbt: 'none', closesOn: null } as const;
const ENGLISH = (level: number) => requires(ENGLISH_ANY, { level });
const EVALUATION =
  "TUT: 'Prospective students will not be admitted to any programme without prior evaluation.'";

export const tutProgrammes: Programme[] = [
  {
    ...base,
    id: 'tut-dip-information-technology',
    name: 'Diploma in Information Technology',
    faculty: 'Information and Communication Technology',
    qualification: 'diploma',
    durationYears: 3,
    minimumScore: 26,
    minimumScoreWithMathematicalLiteracy: 28,
    requiredPass: 'diploma',
    subjectRequirements: [
      ENGLISH(4),
      either(requires(MATHS_OR_TECH, { level: 5 }), requires(MATHS_LIT, { level: 7 })),
      requires(PHYSICAL_OR_TECH, { level: 3 }),
    ],
    selection: `Campus: Soshanguve South. ${EVALUATION}`,
  },
  {
    ...base,
    id: 'tut-dip-information-technology-extended',
    name: 'Diploma in Information Technology (Extended)',
    faculty: 'Information and Communication Technology',
    qualification: 'extended-diploma',
    durationYears: 4,
    minimumScore: 23,
    minimumScoreWithMathematicalLiteracy: 25,
    requiredPass: 'diploma',
    subjectRequirements: [
      ENGLISH(3),
      either(requires(MATHS_OR_TECH, { level: 4 }), requires(MATHS_LIT, { level: 6 })),
      requires(PHYSICAL_OR_TECH, { level: 3 }),
    ],
    selection: 'Campus: Soshanguve South.',
  },
  {
    ...base,
    id: 'tut-dip-computer-science',
    name: 'Diploma in Computer Science',
    faculty: 'Information and Communication Technology',
    qualification: 'diploma',
    durationYears: 3,
    minimumScore: 26,
    minimumScoreWithMathematicalLiteracy: 28,
    requiredPass: 'diploma',
    subjectRequirements: [
      ENGLISH(4),
      either(requires(MATHS_OR_TECH, { level: 5 }), requires(MATHS_LIT, { level: 7 })),
    ],
    selection:
      'Recommended subject: Information Technology. Campuses: Soshanguve South, eMalahleni, Polokwane.',
  },
  {
    ...base,
    id: 'tut-dip-civil-engineering',
    name: 'Diploma in Civil Engineering',
    faculty: 'Engineering and the Built Environment',
    qualification: 'diploma',
    durationYears: 3,
    minimumScore: 26,
    requiredPass: 'diploma',
    subjectRequirements: [
      ENGLISH(4),
      requires(MATHS_OR_TECH, { level: 4 }),
      requires(PHYSICAL_OR_TECH, { level: 4 }),
    ],
    selection: 'Recommended subject: Engineering Graphics and Design. Campus: Pretoria.',
  },
  {
    ...base,
    id: 'tut-bengtech-electrical-engineering',
    name: 'Bachelor of Engineering Technology in Electrical Engineering',
    faculty: 'Engineering and the Built Environment',
    qualification: 'degree',
    durationYears: 3,
    minimumScore: 30,
    requiredPass: 'bachelor',
    subjectRequirements: [
      ENGLISH(4),
      requires(MATHS_OR_TECH, { level: 5 }),
      requires(PHYSICAL_OR_TECH, { level: 5 }),
      otherSubjects(3, { level: 4 }),
    ],
    selection:
      'Recommended subjects: Engineering Graphics and Design, Electrical Technology. Campuses: Pretoria, eMalahleni.',
  },
  {
    ...base,
    id: 'tut-dip-electrical-engineering',
    name: 'Diploma in Electrical Engineering',
    faculty: 'Engineering and the Built Environment',
    qualification: 'diploma',
    durationYears: 3,
    minimumScore: 26,
    requiredPass: 'diploma',
    subjectRequirements: [
      ENGLISH(4),
      requires(MATHS_OR_TECH, { level: 4 }),
      requires(PHYSICAL_OR_TECH, { level: 4 }),
    ],
    selection:
      'Recommended subjects: Electrical Technology, Engineering Graphics and Design. Campuses: Pretoria, eMalahleni.',
  },
  {
    ...base,
    id: 'tut-bnursing',
    name: 'Bachelor of Nursing',
    faculty: 'Science (Health Sciences)',
    qualification: 'degree',
    durationYears: 4,
    minimumScore: 27,
    requiredPass: 'bachelor',
    subjectRequirements: [
      ENGLISH(4),
      requires(MATHS_OR_TECH, { level: 4 }),
      requires(LIFE_SCI, { level: 4 }),
    ],
    selection: 'Campus: Pretoria.',
    closesOn: '2026-06-15',
  },
  {
    ...base,
    id: 'tut-dip-accounting',
    name: 'Diploma in Accounting',
    faculty: 'Economics and Finance',
    qualification: 'diploma',
    durationYears: 3,
    minimumScore: 22,
    minimumScoreWithMathematicalLiteracy: 24,
    requiredPass: 'diploma',
    subjectRequirements: [
      ENGLISH(4),
      either(
        requires([...ACCOUNTING, ...MATHS_OR_TECH], { level: 3 }),
        requires(MATHS_LIT, { level: 5 }),
      ),
    ],
    selection: 'Campuses: GaRankuwa, Mbombela, Polokwane.',
  },
  {
    ...base,
    id: 'tut-dip-internal-auditing',
    name: 'Diploma in Internal Auditing',
    faculty: 'Economics and Finance',
    qualification: 'diploma',
    durationYears: 3,
    minimumScore: 22,
    minimumScoreWithMathematicalLiteracy: 24,
    requiredPass: 'diploma',
    subjectRequirements: [
      ENGLISH(4),
      either(
        requires([...ACCOUNTING, ...MATHS_OR_TECH], { level: 3 }),
        requires(MATHS_LIT, { level: 5 }),
      ),
    ],
    selection: 'Campuses: GaRankuwa, Mbombela, Polokwane.',
  },
  {
    ...base,
    id: 'tut-bed-foundation-phase',
    name: 'Bachelor of Education in Foundation Phase Teaching',
    faculty: 'Humanities',
    qualification: 'degree',
    durationYears: 4,
    minimumScore: 25,
    requiredPass: 'bachelor',
    subjectRequirements: [
      requires(HOME_LANGUAGES, { level: 5 }),
      requires(ADDITIONAL_LANGUAGES, { level: 4 }),
      either(requires(MATHS, { level: 4 }), requires(MATHS_LIT, { level: 5 })),
    ],
    selection:
      "The home language must be one the programme offers ('Home language offered in the programme'). Campus: Soshanguve North.",
    closesOn: '2026-07-31',
  },
  {
    ...base,
    id: 'tut-dip-marketing',
    name: 'Diploma in Marketing',
    faculty: 'Management Sciences',
    qualification: 'diploma',
    durationYears: 3,
    minimumScore: 24,
    requiredPass: 'diploma',
    subjectRequirements: [
      ENGLISH(4),
      either(requires(MATHS_OR_TECH, { level: 3 }), requires(MATHS_LIT, { level: 4 })),
    ],
    selection:
      'Recommended subjects: Accounting, Business Studies, Economics. Campuses: Pretoria, Mbombela.',
  },
  {
    ...base,
    id: 'tut-dip-policing',
    name: 'Diploma in Policing',
    faculty: 'Humanities',
    qualification: 'diploma',
    durationYears: 3,
    minimumScore: 20,
    requiredPass: 'diploma',
    subjectRequirements: [ENGLISH(3), requires([...MATHS_OR_TECH, ...MATHS_LIT], { level: 3 })],
    selection:
      'These requirements are for applicants not employed in law enforcement. Campus: Soshanguve South.',
    closesOn: '2026-07-31',
  },
  {
    ...base,
    id: 'tut-dip-law',
    name: 'Diploma in Law',
    faculty: 'Humanities',
    qualification: 'diploma',
    durationYears: 3,
    minimumScore: 20,
    requiredPass: 'diploma',
    subjectRequirements: [ENGLISH(4)],
    selection: 'Campuses: Soshanguve South, Mbombela.',
    closesOn: '2026-07-31',
  },
  {
    ...base,
    id: 'tut-dip-hospitality-management',
    name: 'Diploma in Hospitality Management',
    faculty: 'Management Sciences',
    qualification: 'diploma',
    durationYears: 3,
    minimumScore: 24,
    requiredPass: 'diploma',
    subjectRequirements: [ENGLISH(3), requires([...MATHS_OR_TECH, ...MATHS_LIT], { level: 3 })],
    selection: 'Campus: Pretoria.',
  },
  {
    ...base,
    id: 'tut-bpharm',
    name: 'Bachelor of Pharmacy',
    faculty: 'Science (Health Sciences)',
    qualification: 'degree',
    durationYears: 4,
    minimumScore: 24,
    requiredPass: 'bachelor',
    subjectRequirements: [
      ENGLISH(4),
      requires(MATHS_OR_TECH, { level: 4 }),
      requires(PHYSICAL_OR_TECH, { level: 4 }),
      requires(LIFE_SCI, { level: 4 }),
      otherSubjects(2, { level: 4 }),
    ],
    selection: 'Campus: Arcadia.',
    closesOn: '2026-06-15',
  },
];
