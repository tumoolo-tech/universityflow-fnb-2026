import type { ApplicationWindow, Programme, University } from '../records';
import { either, requires } from '../records';
import {
  ANY_LANGUAGE,
  ENGLISH_ANY,
  ENGLISH_FAL,
  ENGLISH_HL,
  LIFE_SCI,
  LO,
  MATHS,
  MATHS_LIT,
  PHYSICAL,
} from './subject-groups';

/**
 * University of KwaZulu-Natal, 2027 intake. First-time applicants apply through the Central
 * Applications Office (CAO).
 *
 * DRAFT: researched from UKZN's own 2027 Undergraduate Prospectus on 2026-10-13. Not yet verified
 * by a person; nothing here reaches a student until it is (hard rule 3).
 */

const PROSPECTUS = 'https://applications.ukzn.ac.za/wp-content/uploads/2026/05/2027-Undergrad.pdf';
const SOURCE = { sourceUrl: PROSPECTUS, academicYear: 2027 } as const;

export const ukzn: University = {
  ...SOURCE,
  id: 'ukzn',
  name: 'University of KwaZulu-Natal',
  shortName: 'UKZN',
  city: 'Durban',
  province: 'KwaZulu-Natal',
  applicationRoute: 'cao',
  applyUrl: 'https://www.cao.ac.za/Apply.aspx?content=Apply',
};

export const ukznWindow: ApplicationWindow = {
  sourceUrl: 'https://www.cao.ac.za/download/2027%20Admin%20Fee%20Structure%20(1).png',
  academicYear: 2027,
  universityId: 'ukzn',
  // Neither UKZN nor the CAO publishes an opening date.
  opensOn: null,
  closesOn: '2026-09-30',
  earlierClosings: [{ scope: 'Medicine (MBChB): no late applications', closesOn: '2026-06-30' }],
  grade11ResultsAccepted: true,
  feeZar: 250,
  feeNote:
    'One CAO fee covers up to six choices at all CAO institutions. R250 if the full application and fee arrive by 31 October; R470 after that. Not refundable.',
};

const base = { ...SOURCE, universityId: 'ukzn', nbt: 'none', closesOn: null } as const;
const ENGLISH = (level: number) => requires(ENGLISH_ANY, { level });
const LO4 = requires(LO, { level: 4 });
const RANKED =
  "Selection starts from the highest APS down until places are filled: 'The minimum APS's published should therefore only be used as a guide.'";
const HUMANITIES_ELECTIVE = requires(
  [
    'business-studies',
    'consumer-studies',
    'dramatic-arts',
    'economics',
    'geography',
    'history',
    'information-technology',
    'life-sciences',
    'mathematics',
    'mathematical-literacy',
    'music',
    'religion-studies',
    'visual-arts',
    ...ANY_LANGUAGE,
  ],
  { level: 5 },
);

export const ukznProgrammes: Programme[] = [
  {
    ...base,
    id: 'ukzn-bsc-computer-science-it',
    name: 'Bachelor of Science in Computer Science and Information Technology',
    faculty: 'College of Agriculture, Engineering and Science',
    qualification: 'degree',
    durationYears: 3,
    minimumScore: 30,
    requiredPass: 'bachelor',
    subjectRequirements: [
      requires(MATHS, { level: 5 }),
      ENGLISH(4),
      LO4,
      requires(['agricultural-sciences', 'life-sciences', 'physical-sciences'], { level: 4 }),
    ],
    selection: `${RANKED} Campuses: Pietermaritzburg, Westville.`,
  },
  {
    ...base,
    id: 'ukzn-bsceng-civil',
    name: 'Bachelor of Science in Engineering: Civil',
    faculty: 'College of Agriculture, Engineering and Science',
    qualification: 'degree',
    durationYears: 4,
    minimumScore: 33,
    requiredPass: 'bachelor',
    subjectRequirements: [
      requires(MATHS, { level: 5, percent: 65 }),
      requires(PHYSICAL, { level: 5, percent: 65 }),
      requires(ENGLISH_ANY, { level: 4, percent: 50 }),
      requires(LO, { level: 4, percent: 50 }),
    ],
    selection: `${RANKED} Campuses: Howard College, Pietermaritzburg.`,
  },
  {
    ...base,
    id: 'ukzn-bsceng-electrical',
    name: 'Bachelor of Science in Engineering: Electrical',
    faculty: 'College of Agriculture, Engineering and Science',
    qualification: 'degree',
    durationYears: 4,
    minimumScore: 33,
    requiredPass: 'bachelor',
    subjectRequirements: [
      requires(MATHS, { level: 5, percent: 65 }),
      requires(PHYSICAL, { level: 5, percent: 65 }),
      requires(ENGLISH_ANY, { level: 4, percent: 50 }),
      requires(LO, { level: 4, percent: 50 }),
    ],
    selection: `${RANKED} Campuses: Howard College, Pietermaritzburg.`,
  },
  {
    ...base,
    id: 'ukzn-mbchb',
    name: 'Bachelor of Medicine and Bachelor of Surgery (MBChB)',
    faculty: 'College of Health Sciences',
    qualification: 'degree',
    durationYears: 6,
    // Not an APS: the average of six subjects, which must be at least 65%.
    minimumScore: 65,
    scoreMethod: 'ukzn-mbchb-average',
    requiredPass: 'bachelor',
    subjectRequirements: [
      requires(MATHS, { level: 5, percent: 60 }),
      requires(PHYSICAL, { level: 5, percent: 60 }),
      requires(LIFE_SCI, { level: 5, percent: 60 }),
      requires(ENGLISH_ANY, { level: 5, percent: 60 }),
      LO4,
    ],
    selection:
      "Ranked on the average of six subjects including Mathematics, Physical Sciences, Life Sciences and English (not Life Orientation), with a 65% aggregate. 'Seventy percent of the seats reserved for the Grade 12 learners will be allocated based on the Grade 11 end of year examinations as well as Grade 12 mid-year examination results.' Places are subject to target groups set by the College. Upgraded matric results are not accepted.",
    closesOn: '2026-06-30',
  },
  {
    ...base,
    id: 'ukzn-bpharm',
    name: 'Bachelor of Pharmacy',
    faculty: 'College of Health Sciences',
    qualification: 'degree',
    durationYears: 4,
    minimumScore: 33,
    requiredPass: 'bachelor',
    subjectRequirements: [
      ENGLISH(4),
      LO4,
      requires(MATHS, { level: 4 }),
      requires(LIFE_SCI, { level: 4 }),
      requires(PHYSICAL, { level: 4 }),
    ],
    selection: `'Only first to third choices will be considered.' ${RANKED} Campus: Westville.`,
  },
  {
    ...base,
    id: 'ukzn-bnursing',
    name: 'Bachelor of Nursing',
    faculty: 'College of Health Sciences',
    qualification: 'degree',
    durationYears: 4,
    minimumScore: 30,
    requiredPass: 'bachelor',
    subjectRequirements: [
      ENGLISH(4),
      LO4,
      requires(LIFE_SCI, { level: 4 }),
      requires([...MATHS, ...MATHS_LIT], { level: 3 }),
    ],
    selection: `'Only first choice applications will be considered.' ${RANKED} Campus: Howard College.`,
  },
  {
    ...base,
    id: 'ukzn-bcom-accounting',
    name: 'Bachelor of Commerce in Accounting',
    faculty: 'College of Law and Management Studies',
    qualification: 'degree',
    durationYears: 3,
    minimumScore: 32,
    requiredPass: 'bachelor',
    subjectRequirements: [requires(MATHS, { level: 5 }), ENGLISH(4), LO4],
    selection: `Early selection is considered at APS 35 with English, Life Orientation and Mathematics level 5. ${RANKED} Campuses: Pietermaritzburg, Westville.`,
  },
  {
    ...base,
    id: 'ukzn-bcom-general',
    name: 'Bachelor of Commerce (General)',
    faculty: 'College of Law and Management Studies',
    qualification: 'degree',
    durationYears: 3,
    minimumScore: 30,
    requiredPass: 'bachelor',
    subjectRequirements: [requires(MATHS, { level: 4 }), ENGLISH(4), LO4],
    selection: `${RANKED} Campuses: Pietermaritzburg, Westville.`,
  },
  {
    ...base,
    id: 'ukzn-llb',
    name: 'Bachelor of Laws (LLB)',
    faculty: 'College of Law and Management Studies',
    qualification: 'degree',
    durationYears: 4,
    minimumScore: 32,
    requiredPass: 'bachelor',
    subjectRequirements: [
      either(requires(ENGLISH_HL, { level: 5 }), requires(ENGLISH_FAL, { level: 6 })),
      either(requires(MATHS, { level: 3 }), requires(MATHS_LIT, { level: 5 })),
      LO4,
    ],
    selection: `${RANKED} Campuses: Howard College, Pietermaritzburg.`,
  },
  {
    ...base,
    id: 'ukzn-bsocsc',
    name: 'Bachelor of Social Science',
    faculty: 'College of Humanities',
    qualification: 'degree',
    durationYears: 3,
    minimumScore: 28,
    requiredPass: 'bachelor',
    subjectRequirements: [ENGLISH(4), LO4, HUMANITIES_ELECTIVE],
    selection:
      "'Obtaining 28 points does not guarantee acceptance in to the programme.' Campuses: Howard College, Pietermaritzburg.",
  },
  {
    ...base,
    id: 'ukzn-ba',
    name: 'Bachelor of Arts',
    faculty: 'College of Humanities',
    qualification: 'degree',
    durationYears: 3,
    minimumScore: 28,
    requiredPass: 'bachelor',
    subjectRequirements: [ENGLISH(4), LO4, HUMANITIES_ELECTIVE],
    selection: `${RANKED} Campuses: Howard College, Pietermaritzburg.`,
  },
  {
    ...base,
    id: 'ukzn-bed-foundation-phase',
    name: 'Bachelor of Education (Foundation Phase)',
    faculty: 'College of Humanities',
    qualification: 'degree',
    durationYears: 4,
    minimumScore: 28,
    requiredPass: 'bachelor',
    subjectRequirements: [
      ENGLISH(4),
      LO4,
      requires(['isizulu-hl', 'isizulu-fal'], { level: 4 }),
      either(requires(MATHS_LIT, { level: 4 }), requires(MATHS, { level: 3 })),
    ],
    selection:
      "'Meeting the minimum requirement does not guarantee acceptance into the programme.' Students study both English and isiZulu. Campus: Edgewood.",
  },
  {
    ...base,
    id: 'ukzn-bsw',
    name: 'Bachelor of Social Work',
    faculty: 'College of Humanities',
    qualification: 'degree',
    durationYears: 4,
    minimumScore: 28,
    requiredPass: 'bachelor',
    subjectRequirements: [ENGLISH(4), LO4, HUMANITIES_ELECTIVE],
    selection:
      "'Because of limited space in the programme, 28/30 points do not guarantee acceptance.' Campus: Howard College.",
  },
  {
    ...base,
    id: 'ukzn-bsc-augmented',
    name: 'Bachelor of Science (Augmented Programme)',
    faculty: 'College of Agriculture, Engineering and Science',
    qualification: 'extended-degree',
    durationYears: 4,
    minimumScore: 26,
    requiredPass: 'bachelor',
    subjectRequirements: [
      ENGLISH(4),
      LO4,
      requires(MATHS, { level: 3 }),
      requires(['agricultural-sciences', 'life-sciences', 'physical-sciences'], { level: 3 }),
    ],
    selection:
      "'Only applicants from schools with quintiles 1 and 2 will be considered.' The first year is spread over two years. Not open to anyone who has completed a semester at a tertiary institution. Campuses: Pietermaritzburg, Westville.",
  },
  {
    ...base,
    id: 'ukzn-bcom-extended',
    name: 'Bachelor of Commerce (Extended Curriculum)',
    faculty: 'College of Law and Management Studies',
    qualification: 'extended-degree',
    durationYears: 4,
    minimumScore: 26,
    requiredPass: 'bachelor',
    subjectRequirements: [requires(MATHS, { level: 3 }), ENGLISH(4), LO4],
    selection:
      'Preference is given to students from Quintile 1–3 schools. Not open to anyone who has completed a semester at a tertiary institution. Campuses: Pietermaritzburg, Westville.',
  },
];
