import type { ApplicationWindow, Programme, University } from '../records';
import { either, requires } from '../records';
import {
  ADDITIONAL_LANGUAGES,
  ENGLISH_ANY,
  ENGLISH_FAL,
  ENGLISH_HL,
  LIFE_SCI,
  MATHS,
  MATHS_LIT,
  MATHS_OR_TECH,
  PHYSICAL,
  PHYSICAL_OR_TECH,
} from './subject-groups';

/**
 * University of Johannesburg, 2027 intake.
 *
 * DRAFT: researched on 2026-10-13 from the April 2026 edition of UJ's 2027 Undergraduate
 * Prospectus (uj.ac.za refused automated downloads; read through an archive copy of that exact
 * uj.ac.za address). UJ published a revision on 25 June 2026 that research could not open:
 * every value here must be checked against that revision before it is verified (hard rule 3).
 */

const PROSPECTUS =
  'https://www.uj.ac.za/wp-content/uploads/2026/04/uj_undergrad_prospectus2027.pdf';
const PAGE = (n: number) => `${PROSPECTUS}#page=${n}`;
const SOURCE_YEAR = { academicYear: 2027 } as const;

export const uj: University = {
  ...SOURCE_YEAR,
  sourceUrl: PAGE(13),
  id: 'uj',
  name: 'University of Johannesburg',
  shortName: 'UJ',
  city: 'Johannesburg',
  province: 'Gauteng',
  applicationRoute: 'direct',
  applyUrl: 'https://www.uj.ac.za/Apply',
};

export const ujWindow: ApplicationWindow = {
  ...SOURCE_YEAR,
  sourceUrl: PAGE(15),
  universityId: 'uj',
  opensOn: '2026-04-01',
  closesOn: '2026-10-31',
  earlierClosings: [],
  grade11ResultsAccepted: true,
  feeZar: 0,
  feeNote:
    "'No application fee will be charged for online and paper based applications.' Applications close at 12:00 on the closing day. You get two study choices, and they can't be changed after you submit.",
};

const LIMITED =
  "'Due to limited space, fulfilling all the minimum admission requirements does not guarantee acceptance into a programme.'";
const base = { ...SOURCE_YEAR, universityId: 'uj', nbt: 'none', closesOn: null } as const;
// UJ's tables print one "English" column without saying Home or First Additional Language.
const ENGLISH = (level: number) => requires(ENGLISH_ANY, { level });

export const ujProgrammes: Programme[] = [
  {
    ...base,
    sourceUrl: PAGE(86),
    id: 'uj-bsc-it-computer-science',
    name: 'Bachelor of Science in Information Technology: Computer Science and Informatics',
    faculty: 'Science',
    qualification: 'degree',
    durationYears: 3,
    minimumScore: 30,
    requiredPass: 'bachelor',
    subjectRequirements: [ENGLISH(5), requires(MATHS, { level: 6 })],
    selection:
      "Technical Mathematics and Technical Science are not accepted for Science degrees. 'All minimum entrance requirements for the Faculty of Science are subject to change.'",
  },
  {
    ...base,
    sourceUrl: PAGE(91),
    id: 'uj-bsc-it-computer-science-extended',
    name: 'Bachelor of Science in Information Technology (Extended): Computer Science and Informatics',
    faculty: 'Science',
    qualification: 'extended-degree',
    durationYears: null,
    minimumScore: 26,
    requiredPass: 'bachelor',
    subjectRequirements: [ENGLISH(4), requires(MATHS, { level: 5 })],
    selection:
      "Extended programmes are 'strictly limited to first-time entering applicants' with no previous studies at NQF level 6 or higher.",
  },
  {
    ...base,
    sourceUrl: PAGE(60),
    id: 'uj-beng-civil',
    name: 'Bachelor of Engineering in Civil Engineering',
    faculty: 'Engineering and the Built Environment',
    qualification: 'degree',
    durationYears: 4,
    minimumScore: 32,
    requiredPass: 'bachelor',
    subjectRequirements: [
      ENGLISH(5),
      requires(MATHS_OR_TECH, { level: 5 }),
      requires(PHYSICAL, { level: 5 }),
    ],
    selection: `Technical Science is not accepted. ${LIMITED}`,
  },
  {
    ...base,
    sourceUrl: PAGE(60),
    id: 'uj-beng-electrical',
    name: 'Bachelor of Engineering in Electrical and Electronic Engineering',
    faculty: 'Engineering and the Built Environment',
    qualification: 'degree',
    durationYears: 4,
    minimumScore: 32,
    requiredPass: 'bachelor',
    subjectRequirements: [
      ENGLISH(5),
      requires(MATHS_OR_TECH, { level: 5 }),
      requires(PHYSICAL, { level: 5 }),
    ],
    selection: `Technical Science is not accepted. ${LIMITED}`,
  },
  {
    ...base,
    sourceUrl: PAGE(60),
    id: 'uj-bengtech-civil',
    name: 'Bachelor of Engineering Technology in Civil Engineering',
    faculty: 'Engineering and the Built Environment',
    qualification: 'degree',
    durationYears: 3,
    minimumScore: 28,
    requiredPass: 'bachelor',
    subjectRequirements: [
      ENGLISH(4),
      requires(MATHS_OR_TECH, { level: 5 }),
      requires(PHYSICAL_OR_TECH, { level: 5 }),
    ],
    selection: `Doornfontein campus. ${LIMITED}`,
  },
  {
    ...base,
    sourceUrl: PAGE(68),
    id: 'uj-bnursing',
    name: 'Bachelor of Nursing',
    faculty: 'Health Sciences',
    qualification: 'degree',
    durationYears: 4,
    minimumScore: 30,
    requiredPass: 'bachelor',
    subjectRequirements: [
      ENGLISH(5),
      requires(MATHS, { level: 4 }),
      requires(PHYSICAL, { level: 4 }),
      requires(LIFE_SCI, { level: 4 }),
    ],
    selection: `The prospectus lists Physical Sciences 4 and Life Sciences 4 in separate columns without saying whether both are needed; check with UJ. ${LIMITED}`,
  },
  {
    ...base,
    sourceUrl: PAGE(40),
    id: 'uj-bcom-accounting-ca',
    name: 'Bachelor of Commerce: Accounting (Chartered Accountant)',
    faculty: 'College of Business and Economics',
    qualification: 'degree',
    durationYears: 3,
    minimumScore: 33,
    requiredPass: 'bachelor',
    subjectRequirements: [ENGLISH(4), requires(MATHS, { level: 5 })],
    selection:
      'Mathematical Literacy and Technical Mathematics are not accepted. Compliance with the minimum requirements does not guarantee a place.',
  },
  {
    ...base,
    sourceUrl: PAGE(41),
    id: 'uj-bcom-accounting',
    name: 'Bachelor of Commerce: Accounting',
    faculty: 'College of Business and Economics',
    qualification: 'degree',
    durationYears: 3,
    minimumScore: 28,
    requiredPass: 'bachelor',
    subjectRequirements: [ENGLISH(4), requires(MATHS, { level: 4 })],
    selection:
      'Mathematical Literacy and Technical Mathematics are not accepted. Compliance with the minimum requirements does not guarantee a place.',
  },
  {
    ...base,
    sourceUrl: PAGE(41),
    id: 'uj-bcom-business-management',
    name: 'Bachelor of Commerce: Business Management',
    faculty: 'College of Business and Economics',
    qualification: 'degree',
    durationYears: 3,
    minimumScore: 26,
    requiredPass: 'bachelor',
    subjectRequirements: [ENGLISH(4), requires(MATHS_OR_TECH, { level: 4 })],
    selection: 'Mathematical Literacy is not accepted. Soweto campus.',
  },
  {
    ...base,
    sourceUrl: PAGE(43),
    id: 'uj-bcom-accounting-extended',
    name: 'Bachelor of Commerce Extended Degree: Accounting',
    faculty: 'College of Business and Economics',
    qualification: 'extended-degree',
    durationYears: 4,
    minimumScore: 25,
    minimumScoreWithMathematicalLiteracy: 28,
    requiredPass: 'bachelor',
    subjectRequirements: [
      ENGLISH(4),
      either(requires(MATHS, { level: 3 }), requires(MATHS_LIT, { level: 6 })),
    ],
    selection:
      "'Only new first time entering candidates are considered.' It does not give direct access to the Postgraduate Diploma in Accounting Science.",
  },
  {
    ...base,
    sourceUrl: PAGE(82),
    id: 'uj-llb',
    name: 'Bachelor of Laws (LLB)',
    faculty: 'Law',
    qualification: 'degree',
    durationYears: 4,
    minimumScore: 31,
    minimumScoreWithMathematicalLiteracy: 32,
    requiredPass: 'bachelor',
    subjectRequirements: [
      ENGLISH(5),
      requires(ADDITIONAL_LANGUAGES, { level: 4 }),
      either(requires(MATHS, { level: 3 }), requires(MATHS_LIT, { level: 4 })),
    ],
    selection:
      "'Meeting the Faculty's minimum requirements for a particular programme does not necessarily guarantee admission to that programme due to space constraints.'",
  },
  {
    ...base,
    sourceUrl: PAGE(75),
    id: 'uj-ba',
    name: 'Bachelor of Arts',
    faculty: 'Humanities',
    qualification: 'degree',
    durationYears: 3,
    minimumScore: 27,
    requiredPass: 'bachelor',
    subjectRequirements: [ENGLISH(5)],
    selection: `Mathematics 4 is needed only if you choose Mathematics as a major. ${LIMITED}`,
  },
  {
    ...base,
    sourceUrl: PAGE(74),
    id: 'uj-bsw',
    name: 'Bachelor of Social Work',
    faculty: 'Humanities',
    qualification: 'degree',
    durationYears: 4,
    minimumScore: 31,
    requiredPass: 'bachelor',
    subjectRequirements: [ENGLISH(5)],
    selection: LIMITED,
  },
  {
    ...base,
    sourceUrl: PAGE(54),
    id: 'uj-bed-foundation-phase',
    name: 'Bachelor of Education in Foundation Phase Teaching',
    faculty: 'Education',
    qualification: 'degree',
    durationYears: 4,
    minimumScore: 28,
    requiredPass: 'bachelor',
    subjectRequirements: [
      either(requires(ENGLISH_HL, { level: 5 }), requires(ENGLISH_FAL, { level: 6 })),
      either(
        requires(MATHS, { level: 3 }),
        requires([...MATHS_LIT, 'technical-mathematics'], { level: 5 }),
      ),
    ],
    selection:
      'Soweto campus. Compliance with the minimum requirements does not guarantee a place.',
  },
  {
    ...base,
    sourceUrl: PAGE(44),
    id: 'uj-dip-accountancy',
    name: 'Diploma in Accountancy',
    faculty: 'College of Business and Economics',
    qualification: 'diploma',
    durationYears: 3,
    minimumScore: 22,
    minimumScoreWithMathematicalLiteracy: 24,
    requiredPass: 'diploma',
    subjectRequirements: [
      ENGLISH(4),
      either(requires(MATHS_OR_TECH, { level: 3 }), requires(MATHS_LIT, { level: 5 })),
    ],
    selection:
      'An applicant with a diploma pass who misses the subject requirements may get in through the Programme in Commercial Accounting. Soweto campus.',
  },
  {
    ...base,
    sourceUrl: PAGE(62),
    id: 'uj-dip-management-services',
    name: 'Diploma in Management Services',
    faculty: 'Engineering and the Built Environment',
    qualification: 'diploma',
    durationYears: 3,
    minimumScore: 19,
    minimumScoreWithMathematicalLiteracy: 21,
    requiredPass: 'diploma',
    subjectRequirements: [
      ENGLISH(4),
      either(requires(MATHS_OR_TECH, { level: 3 }), requires(MATHS_LIT, { level: 5 })),
    ],
    selection: 'Doornfontein campus. An extended version has the same minimums.',
  },
];
