/**
 * The signed-in home's rules (docs/design/README.md): pure functions over records the app already
 * has, so the page only shows what code decided (hard rule 2: code decides, the AI explains).
 * Nothing here reads the database, the catalogue or the clock: the caller passes them in. Plain
 * TypeScript with no DOM or Node (hard rule 11): the web's home and the app's use the same rules,
 * and `HomeData` is what `GET /api/home` returns.
 */

import { REPORT_KINDS, type ReportKind, reportGrade } from '@universityflow/catalogue/client';
import { dashboard, moduleCard } from '@universityflow/content/app';
import type { OfferCardArtifact } from './artifacts';
import type { ProfileLook } from './profile-look';

/** Where the learner is on the journey: the dashboard's subtitle, sections and cards follow it. */
export type LearnerStage = 'grade-10' | 'grade-11' | 'matric' | 'university';

/**
 * `university` once they have accepted an offer or confirmed a registration; else `matric` in
 * Grade 12; `grade-10` (Stage 0, G10-4) in Grade 10 or 9; else `grade-11` (Grade 11, or a grade
 * not given). The grade is the current one (`profile()`, G10-1). A held or declined offer is not
 * a place, so it changes nothing.
 */
export function learnerStage(input: {
  readonly grade: number | null;
  readonly offers: ReadonlyArray<{ readonly status: string }>;
  readonly registered: boolean;
}): LearnerStage {
  if (input.registered || input.offers.some((o) => o.status === 'accepted')) return 'university';
  if (input.grade === 12) return 'matric';
  if (input.grade !== null && input.grade <= 10) return 'grade-10';
  return 'grade-11';
}

/**
 * Where a university student is in their degree (A2-66; planning.md §3: arriving is Stages 4–5,
 * the years after it Stages 6–8). `arriving`: a first year, or a year of study not given; `final`:
 * the course's last year or past it, by the catalogue's duration; `middle`: every other year, and
 * any later year whose course's duration is unknown (never a guessed "final").
 */
export type UniversityYear = 'arriving' | 'middle' | 'final';

export function universityYear(input: {
  /** From the learner's confirmed registration (student-provided). */
  readonly yearOfStudy: number | null;
  /** The registered course's `durationYears` in the catalogue view the learner may see. */
  readonly durationYears: number | null;
}): UniversityYear {
  const { yearOfStudy, durationYears } = input;
  if (yearOfStudy === null || yearOfStudy <= 1) return 'arriving';
  if (durationYears !== null && yearOfStudy >= durationYears) return 'final';
  return 'middle';
}

/** Which welcome the empty chat shows: a school report only means something before university. */
export type ChatWelcome = 'school' | 'arriving' | 'later-years';

export function chatWelcome(stage: LearnerStage, year: UniversityYear | null): ChatWelcome {
  if (stage !== 'university') return 'school';
  return year === 'middle' || year === 'final' ? 'later-years' : 'arriving';
}

/** A second or later year at university (A2-66): past the arrival's first weeks. */
function laterYear(year: UniversityYear | null | undefined): boolean {
  return year === 'middle' || year === 'final';
}

export type { ReportKind };

/** The order the school year runs in (`REPORT_KINDS`): the chart's x-axis. */
export const REPORT_ORDER: ReadonlyArray<ReportKind> = REPORT_KINDS;

/** Reports below Grade 12 that are not the year's final one (§18.7 C2): on the axis only if held. */
const INTERIM_BELOW_12: ReadonlyArray<ReportKind> = [
  'grade-10-june',
  'grade-11-june',
  'grade-11-september',
];

/**
 * The chart's x-axis for these points: the school year from Grade 11, and from Grade 10 only for
 * a learner who confirmed a Grade 10 report, so a Grade 11 learner's chart doesn't open on an
 * empty year. A June or September report below Grade 12 is on it only when the learner confirmed
 * one, so the axis never fills with reports most learners never add.
 */
export function chartKinds(points: ReadonlyArray<MarksPoint>): ReadonlyArray<ReportKind> {
  const held = new Set(points.map((p) => p.kind));
  const fromGrade10 = points.some((p) => reportGrade(p.kind) === 10);
  return REPORT_ORDER.filter((k) => {
    if (INTERIM_BELOW_12.includes(k)) return held.has(k);
    return fromGrade10 || reportGrade(k) !== 10;
  });
}

export interface MarksPoint {
  readonly kind: ReportKind;
  /** The average of every confirmed mark on the report, rounded to a whole percent. */
  readonly average: number;
  /** The report's marks, by subject id. */
  readonly marks: ReadonlyArray<{ readonly subject: string; readonly percent: number }>;
}

/**
 * One point per kind of report the learner confirmed (hard rule 6: confirmed reports only), the
 * newest of each kind (a second one is a correction), in the order the school year runs. A report
 * with no marks is left out, never plotted at 0.
 */
export function marksOverTime(
  reports: ReadonlyArray<{
    readonly kind: string;
    readonly confirmedAt: Date;
    readonly marks: ReadonlyArray<{ readonly subject: string; readonly percent: number }>;
  }>,
): MarksPoint[] {
  const newest = new Map<string, (typeof reports)[number]>();
  for (const r of reports) {
    const seen = newest.get(r.kind);
    if (!seen || r.confirmedAt > seen.confirmedAt) newest.set(r.kind, r);
  }
  const points: MarksPoint[] = [];
  for (const kind of REPORT_ORDER) {
    const r = newest.get(kind);
    if (!r || r.marks.length === 0) continue;
    const sum = r.marks.reduce((n, m) => n + m.percent, 0);
    points.push({
      kind,
      average: Math.round(sum / r.marks.length),
      marks: [...r.marks].sort((a, b) => a.subject.localeCompare(b.subject)),
    });
  }
  return points;
}

/** Calendar days from one YYYY-MM-DD to another (negative when `to` is earlier). */
export function daysBetween(from: string, to: string): number {
  const day = (iso: string) => Date.parse(`${iso.slice(0, 10)}T00:00:00Z`);
  return Math.round((day(to) - day(from)) / 86_400_000);
}

/**
 * Days until registration opens (while that is ahead and published), else until it closes; null
 * with no published calendar or once it has closed. Never a guessed date.
 */
export function registrationCountdown(
  calendar: { readonly registration: { readonly from: string | null; readonly to: string } } | null,
  today: string,
): { readonly days: number; readonly phase: 'opens' | 'closes' } | null {
  if (!calendar) return null;
  const { from, to } = calendar.registration;
  if (from && daysBetween(today, from) > 0)
    return { days: daysBetween(today, from), phase: 'opens' };
  const closes = daysBetween(today, to);
  return closes >= 0 ? { days: closes, phase: 'closes' } : null;
}

export interface NextActionInput {
  readonly stage: LearnerStage;
  /** At university, where in the degree; null before it. */
  readonly universityYear: UniversityYear | null;
  /** Today in South Africa (YYYY-MM-DD): an application whose window has closed is skipped. */
  readonly today: string;
  readonly hasReport: boolean;
  readonly shortlisted: number;
  readonly hasGoal: boolean;
  readonly applications: ReadonlyArray<{
    readonly universityId: string;
    readonly universityName: string;
    readonly done: number;
    readonly total: number;
    /** The published closing day, or null when none is published. */
    readonly closesOn: string | null;
  }>;
  /** Null when there is no checklist (no accepted offer's university in the catalogue). */
  readonly firstWeek: { readonly done: number; readonly total: number } | null;
  /** Null before a registration is confirmed. */
  readonly modules: { readonly confirmed: number; readonly toFix: number } | null;
}

export type NextAction =
  | { readonly id: 'add-report'; readonly href: '/documents' }
  | { readonly id: 'shortlist'; readonly href: '/results' }
  | { readonly id: 'goal'; readonly href: '/goals' }
  | { readonly id: 'checklist'; readonly href: string; readonly universityName: string }
  | { readonly id: 'chat'; readonly href: '/chat' }
  | { readonly id: 'study'; readonly href: '/goals#practice' }
  | { readonly id: 'first-week'; readonly href: '/first-week' }
  | { readonly id: 'modules'; readonly href: '/modules' }
  | { readonly id: 'fix-modules'; readonly href: '/modules' }
  | { readonly id: 'campus'; readonly href: '/campus' }
  | { readonly id: 'plan'; readonly href: '/goals' };

/**
 * The one next step the home suggests, in the order the journey needs them. In Grade 10 there is
 * nothing to shortlist or apply for yet: a report, a goal, then practice towards it (G10-4).
 * In a second or later year at university, never the first week or the arrival's campus tour:
 * this year's modules, then the plan maps for the rest of the degree (A2-66). An application
 * whose published window has closed is never the next step (A2-69).
 */
export function nextAction(input: NextActionInput): NextAction {
  if (input.stage === 'grade-10') {
    if (!input.hasReport) return { id: 'add-report', href: '/documents' };
    if (!input.hasGoal) return { id: 'goal', href: '/goals' };
    return { id: 'study', href: '/goals#practice' };
  }
  if (input.stage === 'university') return universityNext(input);
  if (!input.hasReport) return { id: 'add-report', href: '/documents' };
  if (input.shortlisted === 0) return { id: 'shortlist', href: '/results' };
  if (!input.hasGoal) return { id: 'goal', href: '/goals' };
  const open = input.applications.find(
    (a) => a.done < a.total && (a.closesOn === null || daysBetween(input.today, a.closesOn) >= 0),
  );
  if (open) {
    return {
      id: 'checklist',
      href: `/applications/${open.universityId}`,
      universityName: open.universityName,
    };
  }
  return { id: 'chat', href: '/chat' };
}

/** At university: an arrival's first week comes first; a later year starts at the modules. */
function universityNext(input: NextActionInput): NextAction {
  const later = laterYear(input.universityYear);
  if (!later && input.firstWeek && input.firstWeek.done < input.firstWeek.total) {
    return { id: 'first-week', href: '/first-week' };
  }
  if (!input.modules) return { id: 'modules', href: '/modules' };
  if (input.modules.toFix > 0) return { id: 'fix-modules', href: '/modules' };
  return later ? { id: 'plan', href: '/goals' } : { id: 'campus', href: '/campus' };
}

export type JourneyStepId =
  | 'report'
  | 'subjects'
  | 'study'
  | 'shortlist'
  | 'goal'
  | 'applications'
  | 'funding'
  | 'offer'
  | 'first-week'
  | 'modules'
  | 'plan'
  /** Stage 6 (Phase 6c): each confirmed module's card and mark calculator. */
  | 'semester';

export interface JourneyStep {
  readonly id: JourneyStepId;
  readonly href: string;
  /** `current`: the first step not done; the ones after it are `todo`, unless done already. */
  readonly status: 'done' | 'current' | 'todo';
}

/**
 * The home's journey strip (docs/design/README.md): the stage's steps, each done or not from the
 * learner's own records. Funding has no record to tell, so it is never "done": it becomes the
 * current step once the applications are. At university there is no record of the campus tour,
 * so the strip is the offer, the first week and the confirmed modules.
 *
 * In Grade 10 (Stage 0, G10-4): report, subjects, goal, study. The subjects check runs on the
 * confirmed report, so it is done once there is one. Study (My goal's practice until the studios,
 * S2) has no record, so like Funding it becomes the current step last.
 *
 * In a second or later year (A2-66): this year's modules, then the plan for the rest of the
 * degree (My plan maps, on My goal). The offer and the first week are an arrival's: a later-year
 * student is never sent back to them. The plan has no record of being done, like Funding.
 */
export function journeySteps(input: {
  readonly stage: LearnerStage;
  /** At university, where in the degree; null (or absent) is an arrival. */
  readonly universityYear?: UniversityYear | null;
  readonly hasReport: boolean;
  readonly shortlisted: number;
  readonly hasGoal: boolean;
  readonly applications: ReadonlyArray<{ readonly done: number; readonly total: number }>;
  readonly offerAccepted: boolean;
  readonly firstWeek: { readonly done: number; readonly total: number } | null;
  readonly modulesConfirmed: boolean;
}): JourneyStep[] {
  // Stage 6 (Phase 6c), once modules are confirmed: each module's card opens from My modules. It
  // has no record of being done, like Funding.
  const semester: Array<[JourneyStepId, string, boolean]> = input.modulesConfirmed
    ? [['semester', '/modules', false]]
    : [];
  const steps: Array<[JourneyStepId, string, boolean]> =
    input.stage === 'grade-10'
      ? [
          ['report', '/documents', input.hasReport],
          ['subjects', '/subjects', input.hasReport],
          ['goal', '/goals', input.hasGoal],
          ['study', '/goals#practice', false],
        ]
      : input.stage === 'university' && laterYear(input.universityYear)
        ? [['modules', '/modules', input.modulesConfirmed], ...semester, ['plan', '/goals', false]]
        : input.stage === 'university'
          ? [
              ['offer', '/offers', input.offerAccepted],
              [
                'first-week',
                '/first-week',
                input.firstWeek !== null && input.firstWeek.done >= input.firstWeek.total,
              ],
              ['modules', '/modules', input.modulesConfirmed],
              ...semester,
            ]
          : [
              ['report', '/documents', input.hasReport],
              ['shortlist', '/results', input.shortlisted > 0],
              ['goal', '/goals', input.hasGoal],
              [
                'applications',
                '/applications',
                input.applications.length > 0 && input.applications.every((a) => a.done >= a.total),
              ],
              ['funding', '/funding', false],
            ];
  const current = steps.findIndex(([, , done]) => !done);
  return steps.map(([id, href, done], index) => ({
    id,
    href,
    status: done ? 'done' : index === current ? 'current' : 'todo',
  }));
}

/** The journey strip for a learner's home, from what `GET /api/home` returns. */
export function homeJourney(data: HomeData): JourneyStep[] {
  return journeySteps({
    stage: data.stage,
    universityYear: data.universityYear?.group ?? null,
    hasReport: data.qualify !== null || data.marks.length > 0,
    shortlisted: data.shortlist.length,
    hasGoal: data.goalProgrammeId !== null,
    applications: data.applications,
    offerAccepted: data.offers.some((o) => o.status === 'accepted'),
    firstWeek: data.firstWeek,
    modulesConfirmed: data.modules !== null,
  });
}

/** A step's name, the same whatever its state: the state is said beside it in words. */
export function journeyStepName(step: JourneyStep): string {
  // Stage 6's words are the module card's own section (Phase 6c), not the dashboard's.
  if (step.id === 'semester') return moduleCard.journeyStep;
  return dashboard.journey.steps[step.id];
}

/** Which group of My results a shortlisted course is in; `onTrack` on Grade 10 marks (G10-3). */
export type Verdict = 'qualifyNow' | 'onTrack' | 'close' | 'planB';

export interface ShortlistRow {
  readonly programmeId: string;
  readonly name: string;
  readonly universityName: string;
  /** Null with no report to check it against. */
  readonly verdict: Verdict | null;
  readonly draft: boolean;
}

export interface ApplicationRow {
  readonly universityId: string;
  readonly universityName: string;
  readonly status: string;
  readonly done: number;
  readonly total: number;
  readonly closesOn: string | null;
}

/**
 * The signed-in home's data (apps/web/lib/server/home.ts builds it; the web's page and the app's
 * home render it). A number with nothing behind it is null: never a 0 that isn't true.
 */
export interface HomeData {
  readonly stage: LearnerStage;
  /** What the learner asked to be called; null when they didn't say. Never logged (rule 4). */
  readonly name: string | null;
  /**
   * From the latest confirmed report; null without one. On Grade 10 marks `now` and `planB` are
   * always 0 and `onTrack` counts what they would meet (G10-3); otherwise `onTrack` is 0.
   */
  readonly qualify: {
    readonly basis: 'admission' | 'progress';
    readonly now: number;
    readonly onTrack: number;
    readonly close: number;
    readonly planB: number;
    /**
     * Courses the marks were checked against. 0 (no course the learner may see, e.g. before any
     * is verified): the card says it can't check yet, never "0 qualify" (A1-41).
     */
    readonly checked: number;
  } | null;
  /** Days to the next verified paper they write; null when there is none (drafts never count). */
  readonly nextPaperDays: number | null;
  /**
   * Grade 10 only (G10-4): what the subjects on the latest confirmed report keep open
   * (`subjectDoors`). Null at other stages, or with no confirmed report.
   */
  readonly subjects: {
    readonly status: 'unknown' | 'open' | 'some-closed';
    readonly checked: number;
    readonly closed: number;
    readonly draft: boolean;
  } | null;
  /** "Are you in Grade N now?": a new school year moved the grade up (G10-1). Else null. */
  readonly gradeCheck: { readonly grade: number } | null;
  /**
   * The 18th birthday (YYYY-MM-DD) in the next 30 days, while a guardian's consent still covers
   * the learner: from then they must agree in their own name, and reminders pause (A11-25). Else
   * null.
   */
  readonly turningEighteen: { readonly on: string } | null;
  readonly goalProgrammeId: string | null;
  readonly shortlist: ReadonlyArray<ShortlistRow>;
  readonly applications: ReadonlyArray<ApplicationRow>;
  /**
   * University stage only (A2-66): where in the degree (`universityYear`) and the year of study
   * from the confirmed registration. `draft`: the course record whose duration made it "final" is
   * not yet verified, so the page labels it. Null before university.
   */
  readonly universityYear: {
    readonly group: UniversityYear;
    readonly yearOfStudy: number | null;
    readonly draft: boolean;
  } | null;
  /** University stage. */
  readonly offers: ReadonlyArray<OfferCardArtifact>;
  readonly registration: { readonly days: number; readonly phase: 'opens' | 'closes' } | null;
  readonly firstWeek: { readonly done: number; readonly total: number } | null;
  /** `checked`: compared with a curriculum record; otherwise no verdict, so nothing "to fix". */
  readonly modules: {
    readonly confirmed: number;
    readonly toFix: number;
    readonly checked: boolean;
  } | null;
  readonly marks: ReadonlyArray<MarksPoint>;
  /** The name of every subject on the chart's reports, for its table. */
  readonly subjectNames: Readonly<Record<string, string>>;
  /**
   * The header's About me avatar (docs/design/profile-look-proposal.md §2.1): the theme and the
   * avatar only. The tagline and words stay on About me: the home is for the next step.
   */
  readonly look: Pick<ProfileLook, 'theme' | 'avatar'>;
  readonly next: NextAction;
}
