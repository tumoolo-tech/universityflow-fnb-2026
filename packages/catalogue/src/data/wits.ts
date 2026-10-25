import type { ApplicationWindow, Programme, University } from '../records';
import { either, requires } from '../records';
import { ENGLISH_ANY, LIFE_SCI, MATHS, MATHS_LIT, PHYSICAL } from './subject-groups';

/**
 * University of the Witwatersrand, 2027 intake.
 *
 * DRAFT: researched on 2026-10-13 from the live wits.ac.za course-finder and application pages
 * (Wits publishes no dated 2027 prospectus PDF). Not yet verified by a person (hard rule 3).
 */

const COURSE = (path: string) => `https://www.wits.ac.za/course-finder/undergraduate/${path}/`;
const SOURCE_YEAR = { academicYear: 2027 } as const;

export const wits: University = {
  ...SOURCE_YEAR,
  sourceUrl: 'https://www.wits.ac.za/undergraduate/apply-to-wits/',
  id: 'wits',
  name: 'University of the Witwatersrand',
  shortName: 'Wits',
  city: 'Johannesburg',
  province: 'Gauteng',
  applicationRoute: 'direct',
  applyUrl: 'https://www.wits.ac.za/applications/',
};

export const witsWindow: ApplicationWindow = {
  ...SOURCE_YEAR,
  sourceUrl: 'https://www.wits.ac.za/undergraduate/apply-to-wits/timelines/',
  universityId: 'wits',
  // Wits says only "March", with no day.
  opensOn: null,
  closesOn: '2026-09-30',
  earlierClosings: [
    {
      scope:
        'Health Sciences, Architectural Studies, Audiology, Speech-Language Pathology, BA Film and Television',
      closesOn: '2026-06-30',
    },
  ],
  grade11ResultsAccepted: true,
  feeZar: 100,
  feeNote:
    "'Initial assessment is based on self-reported final Grade 11 results, with final decisions based on your official matric results.' Choose up to three programmes.",
};

const NOT_GUARANTEED =
  "'Compliance with the minimum requirements does not guarantee a place at the University.'";
const HEALTH =
  "Health Sciences doesn't select on the APS: it ranks applicants on a Composite Index (75% the average of five matric subjects, 25% the NBT average), and publishes no cut-off. The NBT must be written in person (pencil and paper) by mid-August; online NBT results are not considered.";
const base = {
  ...SOURCE_YEAR,
  universityId: 'wits',
  requiredPass: 'bachelor',
  closesOn: null,
} as const;
const ENGLISH = (level: number) => requires(ENGLISH_ANY, { level });

export const witsProgrammes: Programme[] = [
  {
    ...base,
    sourceUrl: COURSE('science/computer-science'),
    id: 'wits-bsc-computer-science',
    name: 'Bachelor of Science in the field of Computer Science',
    faculty: 'Science',
    qualification: 'degree',
    durationYears: 3,
    minimumScore: 44,
    subjectRequirements: [ENGLISH(5), requires(MATHS, { level: 6 })],
    nbt: 'required',
    selection: `'Applicants with 41-43 points may be wait-listed, subject to place availability.' All Science applicants must write both NBTs by 31 October. ${NOT_GUARANTEED}`,
  },
  {
    ...base,
    sourceUrl: COURSE('ebe/civil-engineering'),
    id: 'wits-bsceng-civil',
    name: 'Bachelor of Science in Engineering in Civil Engineering',
    faculty: 'Engineering and the Built Environment',
    qualification: 'degree',
    durationYears: 4,
    minimumScore: 42,
    subjectRequirements: [
      ENGLISH(5),
      requires(MATHS, { level: 5 }),
      requires(PHYSICAL, { level: 5 }),
    ],
    nbt: 'none',
    selection:
      "'Applicants with English, Mathematics and Physical Sciences at Level 5 will be wait-listed, subject to place availability. Generally, applicants who achieve Level 6 in English, Mathematics and Physical Sciences stand a greater chance of being accepted.'",
  },
  {
    ...base,
    sourceUrl: COURSE('ebe/electrical-engineering'),
    id: 'wits-bsceng-electrical',
    name: 'Bachelor of Science in Engineering in Electrical Engineering',
    faculty: 'Engineering and the Built Environment',
    qualification: 'degree',
    durationYears: 4,
    minimumScore: 42,
    subjectRequirements: [
      ENGLISH(5),
      requires(MATHS, { level: 5 }),
      requires(PHYSICAL, { level: 5 }),
    ],
    nbt: 'none',
    selection:
      "'Applicants with English, Mathematics and Physical Sciences at Level 5 will be wait-listed, subject to place availability.' Level 6 in all three gives a greater chance. All engineering disciplines share a common first year.",
  },
  {
    ...base,
    sourceUrl: COURSE('health/medicine-and-surgery'),
    id: 'wits-mbbch',
    name: 'Bachelor of Medicine and Bachelor of Surgery (MBBCh)',
    faculty: 'Health Sciences',
    qualification: 'degree',
    durationYears: 6,
    minimumScore: null,
    subjectRequirements: [
      ENGLISH(5),
      requires(MATHS, { level: 5 }),
      requires([...LIFE_SCI, ...PHYSICAL], { level: 5 }),
    ],
    nbt: 'required',
    selection: HEALTH,
    closesOn: '2026-06-30',
  },
  {
    ...base,
    sourceUrl: COURSE('health/pharmacy'),
    id: 'wits-bpharm',
    name: 'Bachelor of Pharmacy',
    faculty: 'Health Sciences',
    qualification: 'degree',
    durationYears: 4,
    minimumScore: null,
    subjectRequirements: [
      ENGLISH(5),
      requires(MATHS, { level: 5 }),
      requires([...LIFE_SCI, ...PHYSICAL], { level: 5 }),
    ],
    nbt: 'required',
    selection: HEALTH,
    closesOn: '2026-06-30',
  },
  {
    ...base,
    sourceUrl: COURSE('health/nursing'),
    id: 'wits-bnurs',
    name: 'Bachelor of Nursing',
    faculty: 'Health Sciences',
    qualification: 'degree',
    durationYears: 4,
    minimumScore: null,
    subjectRequirements: [
      ENGLISH(4),
      requires(MATHS, { level: 4 }),
      requires([...LIFE_SCI, ...PHYSICAL], { level: 4 }),
    ],
    nbt: 'required',
    selection: HEALTH,
    closesOn: '2026-06-30',
  },
  {
    ...base,
    sourceUrl: COURSE('clm/accounting-science-baccsc'),
    id: 'wits-baccsc',
    name: 'Bachelor of Accounting Science (Chartered Accountant route)',
    faculty: 'Commerce, Law and Management',
    qualification: 'degree',
    durationYears: 3,
    minimumScore: 44,
    subjectRequirements: [ENGLISH(5), requires(MATHS, { level: 6 })],
    nbt: 'none',
    selection:
      "Graduates go on to the HDipAcc for the SAICA exams. 'Applicants with an APS of 39-43, as well as English 6 and Mathematics 6, may be wait-listed subject to place availability.'",
  },
  {
    ...base,
    sourceUrl: COURSE('clm/accounting'),
    id: 'wits-bcom-accounting',
    name: 'Bachelor of Commerce in the field of Accounting',
    faculty: 'Commerce, Law and Management',
    qualification: 'degree',
    durationYears: 3,
    minimumScore: 38,
    subjectRequirements: [ENGLISH(5), requires(MATHS, { level: 5 })],
    nbt: 'none',
    selection:
      "Not the chartered accountant route. 'Applicants with an APS of 35-37, as well as English 6 and Mathematics 6, may be wait-listed subject to place availability.'",
  },
  {
    ...base,
    sourceUrl: COURSE('clm/bcom'),
    id: 'wits-bcom',
    name: 'Bachelor of Commerce',
    faculty: 'Commerce, Law and Management',
    qualification: 'degree',
    durationYears: 3,
    minimumScore: 38,
    subjectRequirements: [ENGLISH(5), requires(MATHS, { level: 5 })],
    nbt: 'none',
    selection:
      "'Applicants with an APS of 35-37, as well as English Level 6 and Mathematics Level 6, may be wait-listed subject to place availability.'",
  },
  {
    ...base,
    sourceUrl: COURSE('clm/llb-law'),
    id: 'wits-llb',
    name: 'Bachelor of Laws (LLB), four-year stream',
    faculty: 'Commerce, Law and Management',
    qualification: 'degree',
    durationYears: 4,
    minimumScore: 46,
    subjectRequirements: [
      ENGLISH(6),
      either(requires(MATHS, { level: 5 }), requires(MATHS_LIT, { level: 6 })),
    ],
    nbt: 'none',
    selection:
      "'Applicants with an APS of 40-45, as well as English Level 6 AND Mathematics Level 5 OR Maths Literacy Level 6, may be wait-listed, subject to place availability.'",
  },
  {
    ...base,
    sourceUrl: COURSE('humanities/ba'),
    id: 'wits-ba',
    name: 'Bachelor of Arts',
    faculty: 'Humanities',
    qualification: 'degree',
    durationYears: 3,
    minimumScore: 36,
    subjectRequirements: [ENGLISH(5)],
    nbt: 'none',
    selection:
      "'Applicants with entry requirements of at least 30-35 APS points are wait-listed, subject to place availability.'",
  },
  {
    ...base,
    sourceUrl: COURSE('humanities/bed-foundation-phase-teaching'),
    id: 'wits-bed-foundation-phase',
    name: 'Bachelor of Education in Foundation Phase Teaching',
    faculty: 'Humanities',
    qualification: 'degree',
    durationYears: 4,
    minimumScore: 37,
    subjectRequirements: [
      ENGLISH(5),
      either(
        requires(MATHS, { level: 4 }),
        requires([...MATHS_LIT, 'technical-mathematics'], { level: 5 }),
      ),
    ],
    nbt: 'none',
    selection:
      "'Applicants with an entry requirement of at least 31-36 APS points are wait-listed, subject to place availability.' 'Preference is given to students with higher English results.'",
  },
  {
    ...base,
    sourceUrl: COURSE('humanities/social-work'),
    id: 'wits-bsw',
    name: 'Bachelor of Social Work',
    faculty: 'Humanities',
    qualification: 'degree',
    durationYears: 4,
    minimumScore: 36,
    subjectRequirements: [ENGLISH(5)],
    nbt: 'none',
    selection:
      "'Only 60 places are available in the first year of study.' Applicants are selected on merit within school quintiles. 34–35 APS may be wait-listed.",
  },
];
