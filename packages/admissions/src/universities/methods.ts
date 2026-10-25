import { ENGLISH, type SubjectId, type UniversityId } from '@universityflow/catalogue';
import {
  bestOfMethod,
  NSC_LEVEL_TABLE,
  type PointsTable,
  type ScoreMethod,
} from '../scoring/engine';

/**
 * Each launch university's admission score, as published for the 2027 intake.
 *
 * DRAFT, like the catalogue records they serve: researched on 2026-10-13 from each university's
 * own prospectus, with the open questions recorded beside each method. A person verifies each
 * method against its source (and its worked example, where the prospectus prints one) before it
 * scores a real learner. The worked examples are the tests in methods.test.ts.
 */

const RESEARCHED = { academicYear: 2027 } as const;
const MATHS_GROUP: SubjectId[] = ['mathematics', 'mathematical-literacy'];

/**
 * UP: best six 20-credit subjects on the NSC 1–7 table; Life Orientation excluded; maximum 42.
 * Quoted from the 2026 NSC/IEB prospectus (www.up.ac.za refused automated access to the 2027
 * one); the 2027 requirement tables are consistent with it.
 */
export const upAps = bestOfMethod({
  id: 'up-aps',
  universityId: 'up',
  label: 'APS',
  subjectsCounted: 6,
  table: NSC_LEVEL_TABLE,
  lifeOrientation: { mode: 'excluded' },
  maximum: 42,
  closeMargin: 3,
  source: {
    ...RESEARCHED,
    sourceUrl:
      'https://drupalwebprod-files.up.ac.za/Public/2026-01/up_ug-prospectus-2026_nsc-ieb_devv4_web.zp260601.pdf?VersionId=mvtuDlg.4YojvcJdv.N7CcECIn5Hv132',
  },
});

/**
 * TUT: six subjects including English, Life Orientation excluded, and "an achievement level of
 * 1 in a subject [is] not considered", so level 1 earns 0. TUT publishes no maximum; six
 * subjects at level 7 is 42.
 */
const TUT_TABLE: PointsTable = NSC_LEVEL_TABLE.filter((band) => band.points > 1);
export const tutAps = bestOfMethod({
  id: 'tut-aps',
  universityId: 'tut',
  label: 'APS',
  subjectsCounted: 6,
  table: TUT_TABLE,
  lifeOrientation: { mode: 'excluded' },
  mustInclude: [ENGLISH],
  maximum: 42,
  closeMargin: 3,
  source: {
    ...RESEARCHED,
    sourceUrl:
      'https://www.tut.ac.za/media/tshwane-interim/site-content/documents/First-Year-Course_Information.pdf',
  },
});

/**
 * UKZN: six subjects, Life Orientation excluded; English and Mathematics (or Mathematical
 * Literacy) always count. "UKZN will recognise academic excellence by awarding eight points to
 * a subject with a performance level of 90-100%", maximum 48.
 *
 * OPEN QUESTION for verification: the table printed under that sentence stops at 80–100% = 7.
 * The sentence and the stated maximum of 48 agree with each other, so the method follows them.
 */
const UKZN_TABLE: PointsTable = [{ min: 90, points: 8 }, ...NSC_LEVEL_TABLE];
const UKZN_SOURCE = {
  ...RESEARCHED,
  sourceUrl: 'https://applications.ukzn.ac.za/wp-content/uploads/2026/05/2027-Undergrad.pdf',
};
export const ukznAps = bestOfMethod({
  id: 'ukzn-aps',
  universityId: 'ukzn',
  label: 'APS',
  subjectsCounted: 6,
  table: UKZN_TABLE,
  lifeOrientation: { mode: 'excluded' },
  mustInclude: [ENGLISH, MATHS_GROUP],
  maximum: 48,
  closeMargin: 3,
  source: UKZN_SOURCE,
});

/**
 * UKZN Medicine doesn't use the APS: applicants are ranked on "the arithmetic average of six
 * subjects includ[ing] Mathematics, Physical Science, Life Sciences and English (excluding Life
 * Orientation)", with a 65% aggregate.
 */
export const ukznMbchbAverage = bestOfMethod({
  id: 'ukzn-mbchb-average',
  universityId: 'ukzn',
  label: 'Average',
  subjectsCounted: 6,
  lifeOrientation: { mode: 'excluded' },
  mustInclude: [['mathematics'], ['physical-sciences'], ['life-sciences'], ENGLISH],
  average: true,
  maximum: 100,
  closeMargin: 5,
  source: UKZN_SOURCE,
});

const UCT_SOURCE = { ...RESEARCHED, sourceUrl: 'https://degree.uct.ac.za/media/685611' };

/**
 * UCT: "add English and the five best other subjects percentages, excluding Life Orientation
 * ... but including any other required subject(s) for the relevant programme ... Results below
 * 40% for any subject do not attract a score." Out of 600. Commerce, Engineering, Humanities and
 * Law use it as is; Health Sciences adds NBT scores we can't know in advance.
 */
export const uctFps = bestOfMethod({
  id: 'uct-fps',
  universityId: 'uct',
  label: 'FPS',
  subjectsCounted: 6,
  lifeOrientation: { mode: 'excluded' },
  mustInclude: [ENGLISH],
  includesProgrammeSubjects: true,
  percentFloor: 40,
  maximum: 600,
  closeMargin: 30,
  source: UCT_SOURCE,
});

/** UCT Science: as above, with Mathematics and Physical Sciences doubled, out of 800. */
export const uctFpsScience = bestOfMethod({
  id: 'uct-fps-science',
  universityId: 'uct',
  label: 'FPS (Science)',
  subjectsCounted: 6,
  lifeOrientation: { mode: 'excluded' },
  mustInclude: [ENGLISH],
  includesProgrammeSubjects: true,
  percentFloor: 40,
  weights: { mathematics: 2, 'physical-sciences': 2 },
  maximum: 800,
  closeMargin: 40,
  source: UCT_SOURCE,
});

/**
 * UJ: "The total APS is the sum of the achievement ratings of the six school subjects. Life
 * Orientation is NOT counted." Ratings 7 (80–100%) down to 1 (0–29%). Prospectus p.16 prints a
 * worked example, reproduced in methods.test.ts.
 */
export const ujAps = bestOfMethod({
  id: 'uj-aps',
  universityId: 'uj',
  label: 'APS',
  subjectsCounted: 6,
  table: NSC_LEVEL_TABLE,
  lifeOrientation: { mode: 'excluded' },
  maximum: 42,
  closeMargin: 3,
  source: {
    ...RESEARCHED,
    sourceUrl:
      'https://www.uj.ac.za/wp-content/uploads/2026/04/uj_undergrad_prospectus2027.pdf#page=16',
  },
});

/**
 * Wits: "the best seven subjects including Life Orientation (faculty-specific subjects must be
 * included in the calculation)". 8 points at 90–100% down to 3 at 40–49%, nothing below 40%;
 * English and Mathematics earn 2 more at 60% and above; Life Orientation earns 4/3/2/1 at
 * 90/80/70/60% and nothing below. Wits states no maximum; the table gives 56.
 *
 * OPEN QUESTION for verification: whether the +2 applies to Mathematical Literacy or Technical
 * Mathematics. Until confirmed it applies to English (HL or FAL) and Mathematics only.
 */
const WITS_TABLE: PointsTable = [
  { min: 90, points: 8 },
  { min: 80, points: 7 },
  { min: 70, points: 6 },
  { min: 60, points: 5 },
  { min: 50, points: 4 },
  { min: 40, points: 3 },
];
const WITS_ENGLISH_MATHS_TABLE: PointsTable = [
  { min: 90, points: 10 },
  { min: 80, points: 9 },
  { min: 70, points: 8 },
  { min: 60, points: 7 },
  { min: 50, points: 4 },
  { min: 40, points: 3 },
];
export const witsAps = bestOfMethod({
  id: 'wits-aps',
  universityId: 'wits',
  label: 'APS',
  subjectsCounted: 7,
  table: WITS_TABLE,
  subjectTables: {
    'english-hl': WITS_ENGLISH_MATHS_TABLE,
    'english-fal': WITS_ENGLISH_MATHS_TABLE,
    mathematics: WITS_ENGLISH_MATHS_TABLE,
  },
  lifeOrientation: {
    mode: 'own-table',
    table: [
      { min: 90, points: 4 },
      { min: 80, points: 3 },
      { min: 70, points: 2 },
      { min: 60, points: 1 },
    ],
  },
  mustInclude: [ENGLISH],
  includesProgrammeSubjects: true,
  maximum: 56,
  closeMargin: 3,
  source: { ...RESEARCHED, sourceUrl: 'https://www.wits.ac.za/undergraduate/entry-requirements/' },
});

/** Methods by id. */
export const METHODS: ReadonlyMap<string, ScoreMethod> = new Map(
  [witsAps, ujAps, upAps, uctFps, uctFpsScience, tutAps, ukznAps, ukznMbchbAverage].map((m) => [
    m.id,
    m,
  ]),
);

/** Each university's default method. A programme's `scoreMethod` overrides it. */
export const DEFAULT_METHOD: Readonly<Record<UniversityId, string>> = {
  wits: 'wits-aps',
  uj: 'uj-aps',
  up: 'up-aps',
  uct: 'uct-fps',
  tut: 'tut-aps',
  ukzn: 'ukzn-aps',
};

/** The method a programme is measured on. */
export function methodFor(programme: {
  universityId: UniversityId;
  scoreMethod?: string | undefined;
}): ScoreMethod {
  const id = programme.scoreMethod ?? DEFAULT_METHOD[programme.universityId];
  const method = METHODS.get(id);
  if (!method) throw new RangeError(`No score method ${id}`);
  return method;
}
