import 'server-only';
import { randomInt } from 'node:crypto';
import { APPLICATION_CHECKLIST } from '@universityflow/agent';
import { RAW_CATALOGUE } from '@universityflow/catalogue';
import { demoPersonas, en, FIRST_WEEK_STEPS, type FirstWeekStep } from '@universityflow/content';
import {
  type ApplicationStatus,
  type OfferKind,
  type RegistrationModuleRow,
  type ReportKind,
  type Store,
  type StudentStore,
  sastDate,
} from '@universityflow/db';
import {
  type ResultsPeriod,
  type SampleResultsFile,
  sampleResultsFileSchema,
} from '@universityflow/documents';
import sampleResults from '@universityflow/documents/fixtures/sample-results.json';
import {
  type AvatarId,
  type BadgeId,
  type PlanTemplateId,
  type TaglineId,
  type ThemeId,
  templateSeed,
} from '@universityflow/ui';
import { likelyAcademicYear } from '../registration';
import { seedDemoModuleCard } from './module-cards';
import { DEMO_DRAFT_ADULT_CONSENT_VERSION } from './outline-consent';
import { type DemoPersonaCard, type DemoPersonaId, isDemoPersonaId } from './types';

/**
 * The judges' demo personas (UF_DEPLOYMENT=demo): six made-up learners, one for each part of the
 * journey, each cloned into a brand-new private student for every judge who picks one.
 *
 * `cloneDemoPersona` creates the student through the store's own methods only: a sign-in that
 * creates the account (and is signed straight out: the demo signs the judge in itself), the date
 * of birth, then consent before anything else, as a learner would give it: for a minor, a guardian
 * record granted through the consent link's own method; for an adult, their own agreement (hard
 * rule 5: the database refuses everything else until then). Every row-level security policy and
 * audit row applies as it does for a real learner. Nothing is logged (hard rule 4).
 *
 * Everything is synthetic and the same on every clone (only the ids, the times and the two
 * cellphone numbers differ):
 * - marks from tools/results-generator's sample learners (packages/documents' fixture), confirmed
 *   as the learner's own (hard rule 6: no document is read, so there is nothing to misread);
 * - courses, universities and first-week steps from the catalogue and content (hard rule 2);
 * - module rows from a curriculum record where the catalogue has one, and otherwise rows labelled
 *   "Sample module n (demo)" with no credits: never a real-looking code (UJ has no curriculum
 *   record yet, and no university's later years do);
 * - plan maps with ticks and target months only: no words (a judge writes their own when the
 *   demo's words switch is on, a hackathon exception of 2026-10-24);
 * - a made-up school ("Sample High School (demo)"), so My CV has an education line;
 * - the two cellphone numbers (the account's, and a minor's guardian's) built at runtime, random,
 *   and never messaged: the demo has no phone sign-in and sends no SMS.
 */

type ApplicationItem = (typeof APPLICATION_CHECKLIST)[number];

interface PersonaSeed {
  /** Their age today; with `birthday` (MM-DD), the date of birth is worked out from the clock. */
  readonly age: number;
  readonly birthday: string;
  /** The school grade they are in, or null once school is behind them. */
  readonly grade: number | null;
  readonly universityId?: string;
  readonly look: {
    readonly theme: ThemeId;
    readonly avatar: AvatarId;
    readonly taglineId: TaglineId;
    readonly badgeIds: ReadonlyArray<BadgeId>;
  };
  /** A generator learner, and which of their reports to confirm as which kind. */
  readonly sample?: {
    readonly examNumber: string;
    readonly reports: ReadonlyArray<readonly [ResultsPeriod, ReportKind]>;
  };
  readonly goal?: string;
  readonly shortlist?: ReadonlyArray<string>;
  readonly applications?: ReadonlyArray<{
    readonly universityId: string;
    readonly status: ApplicationStatus;
    readonly done: ReadonlyArray<ApplicationItem>;
  }>;
  /** How many of the NSFAS documents are ticked as ready. */
  readonly nsfasReady?: number;
  readonly offers?: ReadonlyArray<{
    readonly programmeId: string;
    readonly kind: OfferKind;
    readonly status: 'held' | 'accepted' | 'declined';
  }>;
  /**
   * `arriving`: the year a registration confirmed today is for (next year from October,
   * registration.ts); `current`: this year, for a student already in their second or later year.
   */
  readonly registration?: {
    readonly programmeId: string;
    readonly year: 'arriving' | 'current';
    readonly yearOfStudy: number;
    readonly sampleModules: number;
  };
  readonly firstWeek?: ReadonlyArray<FirstWeekStep>;
  readonly planMap: {
    readonly templateId: PlanTemplateId;
    readonly linksGoal: boolean;
    /** Template stops (slot keys) ticked Achieved. */
    readonly achieved: ReadonlyArray<string>;
    /** A template stop given a target month: December of this year. */
    readonly byDecember?: string;
  };
}

const SEEDS: Readonly<Record<DemoPersonaId, PersonaSeed>> = {
  // Thabo: Stage 0. Strong marks, Mathematics but no Physical Sciences: My subjects shows the
  // doors that closes, and its what-if shows what another subject would open.
  'demo-grade-10': {
    age: 15,
    birthday: '05-14',
    grade: 10,
    look: {
      theme: 'ocean',
      avatar: 'icon:headphones',
      taglineId: 'small-steps',
      badgeIds: ['future-coder', 'music-lover', 'asks-questions'],
    },
    sample: { examNumber: 'SAMPLE-BX9FEC', reports: [['grade-10-september', 'grade-10-final']] },
    goal: 'wits-bsc-computer-science',
    planMap: {
      templateId: 'staircase',
      linksGoal: true,
      achieved: ['where-i-am-now'],
      byDecember: 'finish-grade-10',
    },
  },
  // Naledi: Grade 11 in October, so her newest final report is Grade 10's: what she is on track
  // for and what is close (never "Qualify now" on Grade 10 marks, G10-3), a goal, a shortlist.
  'demo-grade-11': {
    age: 16,
    birthday: '08-02',
    grade: 11,
    look: {
      theme: 'jacaranda',
      avatar: 'icon:protea',
      taglineId: 'dream-plan-do',
      badgeIds: ['future-accountant', 'first-in-family', 'team-player'],
    },
    sample: { examNumber: 'SAMPLE-FXL7JB', reports: [['grade-10-final', 'grade-10-final']] },
    goal: 'uj-bcom-accounting',
    shortlist: ['uj-bcom-accounting', 'wits-bcom', 'uj-dip-accountancy'],
    planMap: {
      templateId: 'the-road',
      linksGoal: true,
      achieved: ['where-i-am-now'],
      byDecember: 'grades-10-11',
    },
  },
  // Amahle: matric. Her Grade 11 final and this year's June and September reports: Qualify now,
  // Close and Plan B; Wits' application submitted (it closed on 30 September), UJ's under way
  // (open until 31 October: a next step a judge can act on, A2-62); NSFAS papers getting ready.
  'demo-grade-12': {
    age: 17,
    birthday: '03-09',
    grade: 12,
    look: {
      theme: 'sunrise',
      avatar: 'pattern:rays',
      taglineId: 'hard-things',
      badgeIds: ['future-coder', 'night-owl', 'never-gives-up'],
    },
    sample: {
      examNumber: 'SAMPLE-FGBFYY',
      reports: [
        ['grade-11-final', 'grade-11-final'],
        ['grade-12-june', 'grade-12-june'],
        ['grade-12-september', 'grade-12-september'],
      ],
    },
    goal: 'wits-bsc-computer-science',
    shortlist: [
      'wits-bsc-computer-science',
      'uj-bsc-it-computer-science',
      'wits-bcom',
      'uj-bsc-it-computer-science-extended',
    ],
    applications: [
      { universityId: 'wits', status: 'submitted', done: [...APPLICATION_CHECKLIST] },
      {
        universityId: 'uj',
        status: 'in-progress',
        done: [
          'certified-id',
          'grade-11-report',
          'proof-of-residence',
          'guardian-id',
          'choices-ordered',
        ],
      },
    ],
    nsfasReady: 2,
    planMap: {
      templateId: 'six-stops',
      linksGoal: true,
      achieved: ['grade-10', 'grade-11'],
      byDecember: 'matric',
    },
  },
  // Lerato: matric nearly done, a place at UJ accepted (Wits' offer declined) and her first-year
  // registration confirmed; the first week half ticked, the campus tour ahead.
  'demo-first-year': {
    age: 18,
    birthday: '01-20',
    grade: 12,
    universityId: 'uj',
    look: {
      theme: 'protea',
      avatar: 'icon:compass',
      taglineId: 'how-far',
      badgeIds: ['future-coder', 'first-in-family', 'team-player'],
    },
    sample: {
      examNumber: 'SAMPLE-XLVLUH',
      reports: [
        ['grade-11-final', 'grade-11-final'],
        ['grade-12-june', 'grade-12-june'],
        ['grade-12-september', 'grade-12-september'],
      ],
    },
    goal: 'uj-bsc-it-computer-science',
    offers: [
      { programmeId: 'uj-bsc-it-computer-science', kind: 'final', status: 'accepted' },
      { programmeId: 'wits-bsc-computer-science', kind: 'final', status: 'declined' },
    ],
    registration: {
      programmeId: 'uj-bsc-it-computer-science',
      year: 'arriving',
      yearOfStudy: 1,
      sampleModules: 6,
    },
    firstWeek: ['register', 'student-card', 'email-and-lms'],
    planMap: {
      templateId: 'staircase',
      linksGoal: true,
      achieved: ['where-i-am-now', 'finish-grade-10', 'finish-grade-11', 'get-in'],
      byDecember: 'write-matric',
    },
  },
  // Sipho: second year at Wits, his first week long behind him.
  'demo-second-year': {
    age: 20,
    birthday: '04-27',
    grade: null,
    universityId: 'wits',
    look: {
      theme: 'fynbos',
      avatar: 'pattern:waves',
      taglineId: 'keep-going',
      badgeIds: ['future-accountant', 'early-bird', 'likes-helping'],
    },
    offers: [{ programmeId: 'wits-bcom', kind: 'final', status: 'accepted' }],
    registration: {
      programmeId: 'wits-bcom',
      year: 'current',
      yearOfStudy: 2,
      sampleModules: 6,
    },
    firstWeek: FIRST_WEEK_STEPS,
    planMap: {
      templateId: 'six-stops',
      linksGoal: false,
      achieved: ['grade-10', 'grade-11', 'matric', 'applying', 'first-year'],
    },
  },
  // Kagiso: final year at UCT, the road behind him nearly all ticked.
  'demo-final-year': {
    age: 21,
    birthday: '02-11',
    grade: null,
    universityId: 'uct',
    look: {
      theme: 'mono',
      avatar: 'icon:telescope',
      taglineId: 'curious',
      badgeIds: ['future-scientist', 'bookworm', 'never-gives-up'],
    },
    offers: [{ programmeId: 'uct-bsc-computer-science', kind: 'final', status: 'accepted' }],
    registration: {
      programmeId: 'uct-bsc-computer-science',
      year: 'current',
      yearOfStudy: 3,
      sampleModules: 5,
    },
    firstWeek: FIRST_WEEK_STEPS,
    planMap: {
      templateId: 'the-road',
      linksGoal: false,
      achieved: ['where-i-am-now', 'grades-10-11', 'matric-done', 'accepted', 'first-year-passed'],
      byDecember: 'graduated',
    },
  },
};

/** A persona's card for the picker, with the ids the demo needs beside it. */
export interface DemoPersona extends DemoPersonaCard {
  /** The catalogue university of a university-year persona. */
  readonly universityId?: string;
  /** The generator learner whose SAMPLE statements fit this persona ("Use a sample report"). */
  readonly sampleExamNumber?: string;
}

const IDS = Object.keys(SEEDS) as DemoPersonaId[];

function universityName(id: string): string {
  const university = RAW_CATALOGUE.universities.find((u) => u.id === id);
  if (!university) throw new Error(`Not a catalogue university: ${id}`);
  return university.name;
}

export const DEMO_PERSONAS: ReadonlyArray<DemoPersona> = IDS.map((id) => {
  const seed = SEEDS[id];
  const words = demoPersonas.personas[id];
  return {
    id,
    name: words.name,
    stage: words.stage,
    tryThis: words.tryThis,
    ...(seed.universityId
      ? { university: universityName(seed.universityId), universityId: seed.universityId }
      : {}),
    ...(seed.sample ? { sampleExamNumber: seed.sample.examNumber } : {}),
  };
});

export function demoPersona(id: DemoPersonaId): DemoPersona {
  const persona = DEMO_PERSONAS.find((p) => p.id === id);
  if (!persona) throw new Error('Not a demo persona');
  return persona;
}

// ── The seed's inputs, checked ───────────────────────────────────────────────────────────────

let fixture: SampleResultsFile | null = null;

/** The generator's file, refused unless it is a sample file (packages/documents' own schema). */
function sampleFile(): SampleResultsFile {
  fixture ??= sampleResultsFileSchema.parse(sampleResults);
  return fixture;
}

function sampleMarks(examNumber: string, period: ResultsPeriod) {
  const report = sampleFile()
    .learners.find((l) => l.examNumber === examNumber)
    ?.reports.find((r) => r.period === period);
  if (!report) throw new Error(`No sample report ${period} for ${examNumber}`);
  return report.subjects.map((s) => ({ subject: s.subject, percent: s.percent }));
}

function programme(id: string) {
  const found = RAW_CATALOGUE.programmes.find((p) => p.id === id);
  if (!found) throw new Error(`Not a catalogue programme: ${id}`);
  return found;
}

/** Rows labelled as samples: where the catalogue has no curriculum, nothing real-looking. */
function sampleModules(yearOfStudy: number, count: number): RegistrationModuleRow[] {
  return Array.from({ length: count }, (_, i) => ({
    code: `DEMO${yearOfStudy}${String(i + 1).padStart(3, '0')}`,
    name: demoPersonas.sampleModule(i + 1),
    term: i < Math.ceil(count / 2) ? 'S1' : 'S2',
    credits: null,
  }));
}

/** The date of birth that makes them `age` today (SAST), on their `birthday` (MM-DD). */
function dateOfBirth(age: number, birthday: string, today: string): string {
  const year = Number(today.slice(0, 4)) - age - (today.slice(5) < birthday ? 1 : 0);
  return `${year}-${birthday}`;
}

/**
 * A synthetic cellphone number, built at runtime (hard rule 4; the `no-real-pii` guard rejects a
 * literal). The store accepts mobile numbers only, so it has a mobile prefix; it is random, and
 * the demo never sends it anything.
 */
function syntheticPhone(): string {
  return `+2782${String(randomInt(0, 10_000_000)).padStart(7, '0')}`;
}

/**
 * A brand-new account, through the ordinary sign-in methods, signed straight out. A number that
 * is already someone's (or the store-review number) is never used: another is drawn.
 */
async function newStudent(store: Store): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const phone = syntheticPhone();
    const challenge = await store.requestOtp(phone);
    if (challenge.review) continue;
    const signed = await store.verifyOtp(phone, challenge.code);
    await store.signOut(signed.token);
    if (signed.isNewStudent && !signed.review) return signed.studentId;
  }
  throw new Error('Could not create a demo student');
}

async function consent(store: Store, studentId: string, seed: PersonaSeed, today: string) {
  const status = await store.setDateOfBirth(studentId, dateOfBirth(seed.age, seed.birthday, today));
  if (status === 'pending') {
    const { token } = await store.requestGuardianConsent(
      studentId,
      { name: demoPersonas.guardianName, phone: syntheticPhone(), relationship: 'parent' },
      en.consent.version,
    );
    await store.grantConsent(token, en.consent.version);
  } else {
    // demo-outline-consent: a HACKATHON EXCEPTION (2026-10-24, hackathon-undo-pr.md I): the
    // university years record the DRAFT adult-v3, which names module outlines (outline-consent.ts).
    await store.consentAsAdult(
      studentId,
      seed.registration ? DEMO_DRAFT_ADULT_CONSENT_VERSION : en.adultConsent.version,
    );
    // end demo-outline-consent
  }
}

/**
 * Runs independent seed writes at the same time and waits for every one of them to end, then
 * raises the first failure, if any. The demo's database is a continent away from its functions
 * (docs/deploy/demo.md), so a learner's thirty-odd writes one after another took 20 to 40 seconds;
 * at the same time, over the pool's connections, they take a fraction of that. Waiting for all
 * before raising means nothing is still writing when a failed clone is deleted.
 */
export async function together(tasks: ReadonlyArray<Promise<unknown>>): Promise<void> {
  const settled = await Promise.allSettled(tasks);
  const failed = settled.find((s): s is PromiseRejectedResult => s.status === 'rejected');
  if (failed) throw failed.reason;
}

async function planMap(student: StudentStore, seed: PersonaSeed['planMap'], today: string) {
  const map = await student.createPlanMap({
    templateId: seed.templateId,
    linksGoal: seed.linksGoal,
    parts: templateSeed(seed.templateId),
  });
  const node = (key: string) => {
    const found = map.nodes.find((n) => n.slotId === `slot:${key}`);
    if (!found) throw new Error(`No stop ${key} in ${seed.templateId}`);
    return found.id;
  };
  const words = { words: false };
  // Each save locks the map first (plan-maps.ts), so the database takes them one at a time.
  await together([
    ...seed.achieved.map((key) =>
      student.savePlanNode(map.id, node(key), { status: 'achieved' }, words),
    ),
    ...(seed.byDecember
      ? [
          student.savePlanNode(
            map.id,
            node(seed.byDecember),
            { targetMonth: `${today.slice(0, 4)}-12` },
            words,
          ),
        ]
      : []),
  ]);
}

async function university(student: StudentStore, seed: PersonaSeed, now: Date, today: string) {
  // Offers, the registration, its module's card and the first-week ticks are rows of their own.
  const tasks: Array<Promise<unknown>> = [offers(student, seed)];
  if (seed.universityId) {
    const universityId = seed.universityId;
    for (const step of seed.firstWeek ?? []) {
      tasks.push(student.setFirstWeekStep(universityId, step, true));
    }
  }
  const registration = seed.registration;
  if (registration) {
    const { universityId } = programme(registration.programmeId);
    const academicYear =
      registration.year === 'arriving' ? likelyAcademicYear(now) : Number(today.slice(0, 4));
    const modules = sampleModules(registration.yearOfStudy, registration.sampleModules);
    tasks.push(
      student.saveRegistration({
        universityId,
        programmeId: registration.programmeId,
        academicYear,
        yearOfStudy: registration.yearOfStudy,
        modules,
      }),
    );
    // Phase 6c: the first module's card from the SAMPLE outline, with made-up marks.
    const first = modules[0];
    if (first) {
      tasks.push(
        seedDemoModuleCard(student, {
          academicYear,
          yearOfStudy: registration.yearOfStudy,
          code: first.code,
        }),
      );
    }
  }
  await together(tasks);
}

/** Offers one after another (the list keeps their order), then each one's answer together. */
async function offers(student: StudentStore, seed: PersonaSeed) {
  const made: Array<{ id: string; status: 'held' | 'accepted' | 'declined' }> = [];
  for (const offer of seed.offers ?? []) {
    const { universityId } = programme(offer.programmeId);
    const id = await student.addOffer({
      universityId,
      programmeId: offer.programmeId,
      kind: offer.kind,
      replyBy: null,
      conditions: [],
    });
    made.push({ id, status: offer.status });
  }
  await together(
    made.map(({ id, status }) =>
      status === 'accepted'
        ? student.acceptOffer(id)
        : status === 'declined'
          ? student.declineOffer(id)
          : Promise.resolve(),
    ),
  );
}

async function school(student: StudentStore, seed: PersonaSeed) {
  // Reports one after another: "the latest report" is the last confirmed. The shortlist likewise:
  // each one's rank is the next after the last. Applications and ticks are rows of their own.
  const reports = async () => {
    for (const [period, kind] of seed.sample?.reports ?? []) {
      const examNumber = seed.sample?.examNumber ?? '';
      await student.saveConfirmedReport({ kind, marks: sampleMarks(examNumber, period) });
    }
  };
  const goalAndShortlist = async () => {
    if (seed.goal) await student.setGoal(programme(seed.goal).id);
    for (const id of seed.shortlist ?? []) await student.addToShortlist(programme(id).id);
    // A goal is on the shortlist, as /api/me/goal and the agent keep it, so the goal card's
    // application-pack link opens a pack (A2-61).
    if (seed.goal && !seed.shortlist?.includes(seed.goal)) {
      await student.addToShortlist(programme(seed.goal).id);
    }
  };
  const applications = (seed.applications ?? []).map(async (application) => {
    await student.updateApplication(application.universityId, { status: application.status });
    await together(
      application.done.map((item) =>
        student.setChecklistItem(`application:${application.universityId}`, item, true),
      ),
    );
  });
  const documents = RAW_CATALOGUE.nsfas?.documents.length ?? 0;
  const nsfas = Array.from({ length: Math.min(seed.nsfasReady ?? 0, documents) }, (_, i) =>
    student.setChecklistItem('funding:nsfas', `document-${i}`, true),
  );
  await together([reports(), goalAndShortlist(), ...applications, ...nsfas]);
}

/**
 * Clones persona `id` into a new private student and returns its id. `now` must be the store's
 * clock (the default, the real time, in the app). If any step fails, the half-made student is
 * deleted and the error is raised.
 */
export async function cloneDemoPersona(
  store: Store,
  id: DemoPersonaId,
  now: Date = new Date(),
): Promise<string> {
  if (!isDemoPersonaId(id)) throw new Error('Not a demo persona');
  const seed = SEEDS[id];
  const persona = demoPersona(id);
  const today = sastDate(now);
  const studentId = await newStudent(store);
  const student = store.forStudent(studentId);
  try {
    // Consent first: until it is recorded the database refuses every other write (hard rule 5).
    await consent(store, studentId, seed, today);
    // The profile, school, university and the plan map touch different rows: at the same time
    // (`together`), once consent is recorded.
    await together([
      student.updateProfile({
        displayName: persona.name,
        // A made-up school, so My CV has an education line (a hackathon exception, 2026-10-24).
        schoolName: demoPersonas.schoolName,
        ...(seed.grade === null ? {} : { grade: seed.grade }),
        theme: seed.look.theme,
        avatar: seed.look.avatar,
        taglineId: seed.look.taglineId,
        badgeIds: [...seed.look.badgeIds],
      }),
      school(student, seed),
      university(student, seed, now, today),
      planMap(student, seed.planMap, today),
    ]);
    return studentId;
  } catch (error) {
    await student.deleteAccount().catch(() => undefined);
    throw error;
  }
}
