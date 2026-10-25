import type { ApplicationWindow, Programme, ScoreBand, University } from '../records';
import { either, requires } from '../records';
import {
  ENGLISH_ANY,
  ENGLISH_FAL,
  ENGLISH_HL,
  LIFE_SCI,
  LO,
  MATHS,
  PHYSICAL,
} from './subject-groups';

/**
 * University of Cape Town, 2027 intake.
 *
 * DRAFT: researched on 2026-10-13 from UCT's 2027 Undergraduate Prospectus and 2027 Directions
 * for Undergraduate Applicants. Not yet verified by a person (hard rule 3).
 *
 * UCT scores raw percentages, not levels (the "FPS", out of 600 in most faculties). It admits
 * in bands: A on the plain score for everyone, B on a weighted score that adds a disadvantage
 * factor we can't calculate (UCT doesn't publish its formula), and C for South African
 * applicants in redress categories. `minimumScore` is the lowest published threshold; the bands
 * are shown with it so a learner sees what each band needs and who it is for.
 */

const PROSPECTUS = 'https://degree.uct.ac.za/media/685611';
const DIRECTIONS = 'https://www.uct.ac.za/media/695796';
const SOURCE = { sourceUrl: PROSPECTUS, academicYear: 2027 } as const;

export const uct: University = {
  ...SOURCE,
  id: 'uct',
  name: 'University of Cape Town',
  shortName: 'UCT',
  city: 'Cape Town',
  province: 'Western Cape',
  applicationRoute: 'direct',
  applyUrl: 'https://applyonline.uct.ac.za',
};

export const uctWindow: ApplicationWindow = {
  sourceUrl: DIRECTIONS,
  academicYear: 2027,
  universityId: 'uct',
  opensOn: '2026-04-01',
  closesOn: '2026-07-31',
  earlierClosings: [],
  grade11ResultsAccepted: true,
  feeZar: 100,
  feeNote:
    "R100 for South African and SADC applicants, non-refundable. 'No late applications are accepted.' Health Sciences: write the NBTs by 31 July for a conditional offer; all NBTs by 3 October.",
};

const ALL = 'All applicants';
const REDRESS = 'South African applicants in redress categories only';
const band = (
  name: string,
  threshold: number | null,
  basis: ScoreBand['basis'],
  who: string,
  outcome: string,
): ScoreBand => ({ band: name, threshold, basis, who, outcome });

const base = { ...SOURCE, universityId: 'uct', closesOn: null, requiredPass: 'bachelor' } as const;
const COMMERCE_BANDS = [
  band('A', 435, 'score', ALL, 'Guaranteed admission'),
  band('B', 470, 'weighted-score', ALL, 'Likely admission'),
  band('C', 430, 'score', REDRESS, 'Possible admission into the Education Development Unit only'),
];
const COMMERCE_SUBJECTS = [
  requires(MATHS, { percent: 60 }),
  either(requires(ENGLISH_HL, { percent: 50 }), requires(ENGLISH_FAL, { percent: 60 })),
];
const HUMANITIES_BANDS = [
  band('A', 450, 'score', ALL, 'Guaranteed admission (NBT Academic Literacy: Proficient)'),
  band('B', 450, 'weighted-score', ALL, 'Likely admission (NBT AL: Upper Intermediate or above)'),
  band('C', 380, 'score', REDRESS, 'Possible admission (NBT AL: Intermediate or above)'),
];
const HUMANITIES_ENGLISH = either(
  requires(ENGLISH_HL, { percent: 50 }),
  requires(ENGLISH_FAL, { percent: 60 }),
);

export const uctProgrammes: Programme[] = [
  {
    ...base,
    id: 'uct-bsc-computer-science',
    name: 'Bachelor of Science (Computer Science major)',
    faculty: 'Science',
    qualification: 'degree',
    durationYears: 3,
    minimumScore: 550,
    scoreMethod: 'uct-fps-science',
    scoreBands: [
      band('A', 660, 'score', ALL, 'Guaranteed admission'),
      band('B', 640, 'weighted-score', ALL, 'Likely admission'),
      band('C', 550, 'score', REDRESS, 'Possible admission'),
    ],
    subjectRequirements: [requires(MATHS, { percent: 70 }), requires(PHYSICAL, { percent: 60 })],
    nbt: 'required',
    selection:
      "Science scores out of 800: Mathematics and Physical Sciences count double. 'Admission to the Faculty of Science requires a minimum FPS of 550, but this does not guarantee admission.' Computer Science has limited places. NBTs must be written; they are used for placement, not admission.",
  },
  {
    ...base,
    id: 'uct-bsceng-civil',
    name: 'Bachelor of Science in Engineering in Civil Engineering',
    faculty: 'Engineering & the Built Environment',
    qualification: 'degree',
    durationYears: 4,
    minimumScore: 420,
    scoreBands: [
      band('A', 500, 'score', ALL, 'Guaranteed admission'),
      band('B', 480, 'weighted-score', ALL, 'Likely admission'),
      band('C', 420, 'score', REDRESS, 'Possible admission'),
    ],
    subjectRequirements: [requires(MATHS, { percent: 80 }), requires(PHYSICAL, { percent: 70 })],
    nbt: 'required',
    selection:
      'Mathematical Literacy, Technical Mathematics and Technical Sciences are not accepted. NBTs must be written but are not used for admission.',
  },
  {
    ...base,
    id: 'uct-bsceng-electrical',
    name: 'Bachelor of Science in Engineering in Electrical Engineering',
    faculty: 'Engineering & the Built Environment',
    qualification: 'degree',
    durationYears: 4,
    minimumScore: 420,
    scoreBands: [
      band('A', 500, 'score', ALL, 'Guaranteed admission'),
      band('B', 480, 'weighted-score', ALL, 'Likely admission'),
      band('C', 420, 'score', REDRESS, 'Possible admission'),
    ],
    subjectRequirements: [requires(MATHS, { percent: 80 }), requires(PHYSICAL, { percent: 75 })],
    nbt: 'required',
    selection:
      'The same criteria apply to Electrical & Computer Engineering and Mechatronics. NBTs must be written but are not used for admission.',
  },
  {
    ...base,
    id: 'uct-mbchb',
    name: 'Bachelor of Medicine and Bachelor of Surgery (MBChB)',
    faculty: 'Health Sciences',
    qualification: 'degree',
    durationYears: 6,
    // The sub-minimum on the school-results part of the score (out of 600). Selection uses a
    // score out of 900 that adds three NBT results, which we can't know in advance.
    minimumScore: 450,
    scoreBands: [
      band('A', 810, 'score', ALL, 'Guaranteed admission (out of 900, with NBTs Proficient)'),
      band('B', 807, 'weighted-score', ALL, 'Likely admission (NBTs Intermediate or above)'),
      band('C', 644, 'score', REDRESS, 'Possible admission (NBTs Intermediate or above)'),
    ],
    subjectRequirements: [
      requires(MATHS, { percent: 70 }),
      requires(PHYSICAL, { percent: 70 }),
      requires(ENGLISH_ANY, { percent: 65 }),
    ],
    nbt: 'required',
    selection:
      "The minimum shown is UCT's sub-minimum of 450 on school results. Selection adds your three NBT scores (out of 300) for a score out of 900; the bands use that score. The next three best subjects also need 70%. First-choice applicants are prioritised. Write the NBTs by 31 July for a conditional offer.",
  },
  {
    ...base,
    id: 'uct-bsc-physiotherapy',
    name: 'Bachelor of Science in Physiotherapy',
    faculty: 'Health Sciences',
    qualification: 'degree',
    durationYears: 4,
    minimumScore: 360,
    scoreBands: [
      band('A', 730, 'score', ALL, 'Guaranteed admission (out of 900, with NBTs)'),
      band('B', 797, 'weighted-score', ALL, 'Likely admission'),
      band('C', 580, 'score', REDRESS, 'Possible admission (580, 610 or 680 by redress category)'),
    ],
    subjectRequirements: [
      requires(MATHS, { percent: 60 }),
      requires([...PHYSICAL, ...LIFE_SCI], { percent: 65 }),
      requires(ENGLISH_ANY, { percent: 65 }),
    ],
    nbt: 'required',
    selection:
      "The minimum shown is UCT's sub-minimum of 360 on school results; selection adds the NBTs for a score out of 900. The next three best subjects also need 60%. UCT has no undergraduate nursing degree.",
  },
  {
    ...base,
    id: 'uct-bcom-financial-accounting-ca',
    name: 'Bachelor of Commerce: Financial Accounting (Chartered Accountant stream)',
    faculty: 'Commerce',
    qualification: 'degree',
    durationYears: 3,
    minimumScore: 430,
    scoreBands: COMMERCE_BANDS,
    subjectRequirements: COMMERCE_SUBJECTS,
    nbt: 'required',
    selection:
      "NBT Academic and Quantitative Literacy: Upper Intermediate or above. 'Study offers are limited for reasons of capacity.' Final offers may need more than the published bands.",
  },
  {
    ...base,
    id: 'uct-bcom-general',
    name: 'Bachelor of Commerce (general specialisations)',
    faculty: 'Commerce',
    qualification: 'degree',
    durationYears: 3,
    minimumScore: 430,
    scoreBands: COMMERCE_BANDS,
    subjectRequirements: COMMERCE_SUBJECTS,
    nbt: 'required',
    selection:
      "NBT Academic and Quantitative Literacy: Upper Intermediate or above. 'Satisfying the minimum subject requirements does not ensure an applicant admission.'",
  },
  {
    ...base,
    id: 'uct-bcom-actuarial-science',
    name: 'Bachelor of Commerce in Actuarial Science',
    faculty: 'Commerce',
    qualification: 'degree',
    durationYears: 3,
    minimumScore: 475,
    scoreBands: [
      band('A', 500, 'score', ALL, 'Guaranteed admission'),
      band('B', 525, 'weighted-score', ALL, 'Likely admission'),
      band(
        'C',
        475,
        'score',
        REDRESS,
        'Possible admission into the Education Development Unit only',
      ),
    ],
    subjectRequirements: [
      requires(MATHS, { percent: 80 }),
      either(requires(ENGLISH_HL, { percent: 60 }), requires(ENGLISH_FAL, { percent: 80 })),
    ],
    nbt: 'required',
    selection:
      "NBT AL and QL: Upper Intermediate or above (Proficient for English FAL applicants). 'If you do not meet the conditional offer points for Actuarial Science but do meet the criteria for the other Commerce UG programmes, we will automatically make you an offer for those programmes.'",
  },
  {
    ...base,
    id: 'uct-llb',
    name: 'Bachelor of Laws (LLB)',
    faculty: 'Law',
    qualification: 'degree',
    durationYears: 4,
    minimumScore: 470,
    scoreBands: [
      band('A', 500, 'score', ALL, 'Guaranteed admission (NBT AL Proficient, QL Intermediate+)'),
      band('B', 500, 'weighted-score', ALL, 'Likely admission'),
      band('C', 470, 'score', REDRESS, 'Possible admission (NBT AL and QL Proficient)'),
    ],
    subjectRequirements: [],
    nbt: 'required',
    selection:
      "'Applications vastly exceed the available places. If there are more applicants who meet the admission criteria than there are places, only the best applicants will be made an offer.'",
  },
  {
    ...base,
    id: 'uct-ba-general',
    name: 'Bachelor of Arts (General) or Bachelor of Social Science (General)',
    faculty: 'Humanities',
    qualification: 'degree',
    durationYears: 3,
    minimumScore: 380,
    scoreBands: HUMANITIES_BANDS,
    subjectRequirements: [HUMANITIES_ENGLISH, requires(LO, { percent: 50 })],
    nbt: 'required',
    selection:
      "'FPS 380 with Academic Literacy NBT score at Intermediate Level.' Life Orientation must be passed at 50% but isn't counted. Some majors need more (Economics: Mathematics 60%).",
  },
  {
    ...base,
    id: 'uct-bsw',
    name: 'Bachelor of Social Work',
    faculty: 'Humanities',
    qualification: 'degree',
    durationYears: 4,
    minimumScore: 380,
    scoreBands: HUMANITIES_BANDS,
    subjectRequirements: [HUMANITIES_ENGLISH],
    nbt: 'required',
    selection:
      "Applicants may be asked to attend an interview. 'A limit of 80 applicants will be accepted into the qualification annually.'",
  },
  {
    ...base,
    id: 'uct-bcom-education-development-unit',
    name: 'Bachelor of Commerce (Academic Development Programme)',
    faculty: 'Commerce',
    qualification: 'extended-degree',
    durationYears: 4,
    minimumScore: 430,
    scoreBands: [
      band('C', 430, 'score', REDRESS, 'Possible admission into the Education Development Unit'),
    ],
    subjectRequirements: COMMERCE_SUBJECTS,
    nbt: 'required',
    selection:
      'Open to South African applicants in redress categories, and to applicants whose NBT results show potential. Taken over three or four years.',
  },
  {
    ...base,
    id: 'uct-ba-extended',
    name: 'Bachelor of Arts or Social Science (Extended Programme)',
    faculty: 'Humanities',
    qualification: 'extended-degree',
    durationYears: 4,
    minimumScore: null,
    subjectRequirements: [HUMANITIES_ENGLISH],
    nbt: 'required',
    selection:
      "'Applicants are considered on the basis of their performance in the NBTs, FPS and on their educational background.' Offered to South African applicants who show potential with extra support.",
  },
];
