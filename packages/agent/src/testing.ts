import type { SubjectMark } from '@universityflow/admissions';
import {
  adviceValidity,
  type Campus,
  type CatalogueRecords,
  type CatalogueView,
  catalogueView,
  catalogueViewOf,
  type ExamSubjectChoice,
  type FacultyOffice,
  isDraft,
  isSafetyPlaceKind,
  type Place,
  RAW_CATALOGUE,
  type RegistrationCalendar,
  type ReportKind,
  type SafetyAdvice,
} from '@universityflow/catalogue';
import type { TickedStep } from './campus';
import type { AgentContext } from './context';
import type { ChatModel, ModelRequest, ModelResponse, ReplyWriter } from './model';
import type { AgentRegistration } from './modules';
import type { AgentOffer } from './offers';

/** An in-memory AgentContext over the draft catalogue, for tests and evals. */
export function fakeContext(
  options: {
    marks?: ReadonlyArray<SubjectMark> | null;
    grade?: number | null;
    /** Past matric (A10-38): the grade no longer describes them. */
    schoolFinished?: boolean;
    today?: Date;
    reportKind?: ReportKind;
    choices?: ReadonlyArray<ExamSubjectChoice>;
    offers?: ReadonlyArray<AgentOffer>;
    registration?: AgentRegistration | null;
    /**
     * The catalogue the tools read; the draft catalogue by default. A view of synthetic records
     * (`catalogueViewOf`), e.g. a verified campus clinic.
     */
    catalogue?: CatalogueView;
  } = {},
) {
  const today = options.today ?? new Date('2026-10-13T08:00:00Z');
  const shortlist: string[] = [];
  const firstWeek = new Map<string, TickedStep[]>();
  const goal: { id: string | null } = { id: null };
  const notes: Array<{ kind: string; body: string }> = [];
  const checklists = new Map<string, Map<string, boolean>>();
  const context: AgentContext = {
    today,
    catalogue: options.catalogue ?? catalogueView(today, { includeDrafts: true }),
    targetIntake: 2028,
    async latestReport() {
      return options.marks
        ? { kind: options.reportKind ?? 'grade-11-final', confirmedAt: today, marks: options.marks }
        : null;
    },
    async shortlist() {
      return shortlist;
    },
    async addToShortlist(id) {
      if (!shortlist.includes(id)) shortlist.push(id);
    },
    async checklist(scope) {
      return [...(checklists.get(scope) ?? new Map()).entries()].map(([item, done]) => ({
        item,
        done,
      }));
    },
    async remember(kind, body) {
      notes.push({ kind, body });
    },
    async goal() {
      return goal.id;
    },
    async setGoal(id) {
      goal.id = id;
    },
    async examChoices() {
      return options.choices ?? [];
    },
    async offers() {
      return options.offers ?? [];
    },
    async firstWeekSteps(universityId) {
      return firstWeek.get(universityId) ?? [];
    },
    async registration() {
      return options.registration ?? null;
    },
    async profile() {
      return {
        displayName: 'Thandi',
        grade: options.grade === undefined ? 11 : options.grade,
        schoolFinished: options.schoolFinished ?? false,
        goal: 'civil engineering',
      };
    },
  };
  return {
    context,
    goal,
    shortlist,
    notes,
    tick(scope: string, item: string) {
      const map = checklists.get(scope) ?? new Map<string, boolean>();
      map.set(item, true);
      checklists.set(scope, map);
    },
    /** Ticks a first-week step for a university, as the learner would. */
    tickFirstWeek(universityId: string, step: string, doneAt = today) {
      firstWeek.set(universityId, [...(firstWeek.get(universityId) ?? []), { step, doneAt }]);
    },
  };
}

/**
 * A catalogue with synthetic Phase 5b records at Wits (hard rule 4: made-up names, test pages, a
 * zeroed landline-shaped number), for tests of the tour, the checklist and the crisis card's
 * campus lines. Verified: the university, one campus, its security, clinic and counselling, one
 * food place, the calendar and the Science faculty office. Drafts: a second clinic, a library and
 * a second campus, so a test can prove a draft never reaches a learner, or a crisis card.
 */
export const CAMPUS_TEST_TODAY = new Date('2027-12-01T08:00:00Z');
export const CAMPUS_TEST_PROGRAMME = 'wits-bsc-computer-science';

export function campusTestRecords(): CatalogueRecords {
  const verified = <T extends object>(r: T): T => ({
    ...r,
    verifiedOn: '2027-11-30',
    verifiedBy: 'Test Verifier',
  });
  const source = { sourceUrl: 'https://www.wits.ac.za/test-page/', academicYear: 2028 } as const;
  const wits = RAW_CATALOGUE.universities.find((u) => u.id === 'wits');
  const programme = RAW_CATALOGUE.programmes.find((p) => p.id === CAMPUS_TEST_PROGRAMME);
  if (!wits || !programme) throw new Error('fixture records missing');
  const campus: Campus = {
    ...source,
    id: 'wits-test-campus',
    universityId: 'wits',
    name: 'Test Campus',
    city: 'Testville',
    mapUrl: 'https://www.wits.ac.za/test-map.pdf',
    virtualTourUrl: 'https://www.wits.ac.za/test-tour/',
  };
  const place = (id: string, kind: Place['kind'], campusId = campus.id): Place => ({
    ...source,
    id: `wits-test-${id}`,
    campusId,
    kind,
    name: `Test ${kind} ${id}`,
    where: 'Ground floor, Test Building',
    hours: 'Mon–Fri 08:00–16:00',
    phone: '011 000 0000',
    location: { query: 'Test Building, Test Campus, Testville' },
  });
  const calendar: RegistrationCalendar = {
    ...source,
    universityId: 'wits',
    firstYearRegistration: { to: '2028-02-06' },
    changeDeadlines: [{ appliesTo: 'S1', lastDay: '2028-02-20' }],
    orientation: { from: '2028-01-27', to: '2028-01-31' },
  };
  const office: FacultyOffice = {
    ...source,
    id: 'wits-test-faculty-office',
    universityId: 'wits',
    faculty: programme.faculty,
    where: 'Room 1, Test Building',
    contactUrl: 'https://www.wits.ac.za/test-contact/',
    email: 'office@example.com',
    phone: '011 000 0000',
  };
  return {
    ...RAW_CATALOGUE,
    universities: RAW_CATALOGUE.universities.map((u) => (u.id === 'wits' ? verified(u) : u)),
    programmes: RAW_CATALOGUE.programmes.map((p) => (p.id === programme.id ? verified(p) : p)),
    campuses: [verified(campus), { ...campus, id: 'wits-test-draft-campus', name: 'Draft Campus' }],
    places: [
      verified(place('security', 'security')),
      verified(place('clinic', 'clinic')),
      verified(place('counselling', 'counselling')),
      verified(place('food', 'food')),
      place('draft-clinic', 'clinic'),
      place('library', 'library'),
      place('draft-campus-security', 'security', 'wits-test-draft-campus'),
    ],
    facultyOffices: [verified(office)],
    registrationCalendars: [verified(calendar)],
    curricula: [],
  };
}

/** The draft records' ids in `campusTestRecords`: none may ever reach a crisis card. */
export const CAMPUS_TEST_DRAFT_SAFETY_IDS = [
  'wits-test-draft-clinic',
  'wits-test-draft-campus-security',
] as const;

/**
 * Every draft clinic, counselling and security place, in the real catalogue and the test records:
 * what the red team holds every crisis card against.
 */
export function draftSafetyPlaceIds(): ReadonlySet<string> {
  return new Set(
    [...RAW_CATALOGUE.places, ...campusTestRecords().places]
      .filter((p) => isSafetyPlaceKind(p.kind) && isDraft(p))
      .map((p) => p.id),
  );
}

export function campusTestView(includeDrafts: boolean): CatalogueView {
  return catalogueViewOf(campusTestRecords(), CAMPUS_TEST_TODAY, { includeDrafts });
}

/** The synthetic safety notes in `safetyTestRecords`, by role. */
export const SAFETY_TEST_NOTES = {
  campus: 'wits-test-campus-walk-in-groups',
  university: 'wits-test-university-advisory',
  draft: 'wits-test-draft-advice',
  expired: 'wits-test-expired-advice',
} as const;

/**
 * The campus test records plus synthetic safety notes at Wits (Phase 5e-3), and the police and
 * cell-phone emergency lines verified, as they will be before a learner sees a note. Verified and
 * current on `CAMPUS_TEST_TODAY`: one note on the test campus, one for the whole university. A
 * draft note and an expired verified one beside them, so a test can prove neither reaches a
 * learner. Made-up wording and test pages (hard rule 4); the real UJ notes are left out.
 */
export function safetyTestRecords(): CatalogueRecords {
  const records = campusTestRecords();
  const checked = { verifiedOn: '2027-11-30', verifiedBy: 'Test Verifier' } as const;
  const note = {
    sourceUrl: 'https://www.wits.ac.za/test-safety/',
    academicYear: 2028,
    universityId: 'wits',
    ...adviceValidity('2027-11-20'),
  } as const;
  const advice: SafetyAdvice[] = [
    {
      ...note,
      ...checked,
      id: SAFETY_TEST_NOTES.university,
      kind: 'incident-advisory',
      quote: 'Test university-wide advice, quoted exactly.',
      area: 'Test Park / Test Hill',
    },
    {
      ...note,
      ...checked,
      id: SAFETY_TEST_NOTES.campus,
      campusId: 'wits-test-campus',
      kind: 'walk-in-groups',
      quote: 'Test campus advice, quoted exactly.',
      days: 'Monday to Friday',
      hours: '18:00 – 06:00',
      publishedOn: '2027-11-01',
    },
    {
      ...note,
      id: SAFETY_TEST_NOTES.draft,
      campusId: 'wits-test-campus',
      kind: 'avoid-after-dark',
      quote: 'Test draft advice, quoted exactly.',
    },
    {
      ...note,
      ...checked,
      ...adviceValidity('2027-08-01'),
      id: SAFETY_TEST_NOTES.expired,
      kind: 'general-tip',
      quote: 'Test expired advice, quoted exactly.',
    },
  ];
  return {
    ...records,
    helplines: records.helplines.map((h) =>
      h.id === 'saps-emergency' || h.id === 'mobile-emergency' ? { ...h, ...checked } : h,
    ),
    safetyAdvice: advice,
  };
}

export function safetyTestView(includeDrafts: boolean): CatalogueView {
  return catalogueViewOf(safetyTestRecords(), CAMPUS_TEST_TODAY, { includeDrafts });
}

/** An offer the learner accepted (synthetic), at `universityId`. */
export function acceptedOffer(
  universityId: string,
  programmeId = CAMPUS_TEST_PROGRAMME,
): AgentOffer {
  return {
    id: '00000000-0000-4000-8000-0000000000aa',
    universityId,
    programmeId,
    kind: 'final',
    status: 'accepted',
    source: 'learner',
    replyBy: null,
    conditions: [],
    reminder: null,
  };
}

/** Synthetic marks for a capable learner. */
export const SAMPLE_MARKS: ReadonlyArray<SubjectMark> = [
  { subject: 'isizulu-hl', percent: 74 },
  { subject: 'english-fal', percent: 68 },
  { subject: 'mathematics', percent: 71 },
  { subject: 'physical-sciences', percent: 66 },
  { subject: 'life-sciences', percent: 70 },
  { subject: 'geography', percent: 63 },
  { subject: 'life-orientation', percent: 80 },
];

/** `SAMPLE_MARKS` as a confirmed final Grade 11 report. */
export const SAMPLE_REPORT = { kind: 'grade-11-final', marks: SAMPLE_MARKS } as const;

/**
 * A model that follows a script: each step either calls a tool or answers. Records every
 * request, so a test can check what the model was told.
 */
export class ScriptedModel implements ChatModel {
  readonly isSample = false;
  /** A test's script, no AI (A10-49). */
  readonly writer: ReplyWriter = { provider: 'local', model: 'scripted-test-model' };
  readonly requests: ModelRequest[] = [];
  readonly toolReplies: Array<{ content: string; isError: boolean }> = [];

  constructor(
    private readonly steps: ReadonlyArray<
      { tool: string; input: unknown } | { say: string } | { refuse: true } | { fail: true }
    >,
  ) {}

  async respond(request: ModelRequest): Promise<ModelResponse> {
    this.requests.push(request);
    for (const step of this.steps) {
      if ('tool' in step) this.toolReplies.push(await request.callTool(step.tool, step.input));
      else if ('refuse' in step) return { text: '', refused: true };
      else if ('fail' in step) {
        request.onText('partial');
        throw new Error('network');
      } else {
        request.onText(step.say);
        return { text: step.say, refused: false };
      }
    }
    return { text: '', refused: false };
  }
}
