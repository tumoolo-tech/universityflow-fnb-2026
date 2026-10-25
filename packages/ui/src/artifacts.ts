import type {
  ChangeDeadlines,
  FinalCheck,
  OfferKind,
  PassOutcome,
  ProgrammeResult,
  RegistrationComparison,
  RegistrationDifference,
  Results,
  ScoreBreakdown,
  WhatINeedResult,
} from '@universityflow/admissions';
import type {
  ApplicationWindow,
  Helpline,
  ModuleTerm,
  Nsfas,
  OfferedTerm,
  PlaceKind,
  PracticeAccess,
  PracticeKind,
  RegistrationCalendar,
  SafetyPlaceKind,
  SubjectId,
  University,
  UniversityId,
} from '@universityflow/catalogue';
import type { FirstWeekStep, PlaceNeed } from '@universityflow/content';
import type { SafetyNoteView } from './safety-notes';

/**
 * The panels the chat opens beside a conversation (planning.md §3). Tools build them from tested
 * code; the interface renders each by `kind`. The model never writes one, and never writes HTML
 * (planning.md §16.3).
 *
 * Each carries the data it shows, so a conversation reopened later shows what the learner saw.
 */

export interface ResultsCardArtifact {
  readonly kind: 'results-card';
  readonly reportKind: string;
  readonly confirmedAt: string;
  readonly marks: ReadonlyArray<{ subject: string; percent: number }>;
  readonly passProjected: PassOutcome;
}

export interface CourseExplorerArtifact {
  readonly kind: 'course-explorer';
  readonly results: Results;
}

export interface ScoreBreakdownArtifact {
  readonly kind: 'score-breakdown';
  readonly result: ProgrammeResult;
  readonly breakdown: ScoreBreakdown;
}

/**
 * "What I need per subject" for one programme (Phase 4c): the target mark per subject, computed
 * by packages/admissions from the learner's latest confirmed report (hard rules 2 and 6).
 */
export interface WhatINeedArtifact {
  readonly kind: 'what-i-need';
  readonly result: WhatINeedResult;
  /** The confirmed report the plan starts from. */
  readonly reportKind: string;
  readonly confirmedAt: string;
}

export interface CrisisCardArtifact {
  readonly kind: 'crisis-card';
  readonly helplines: ReadonlyArray<
    Pick<Helpline, 'id' | 'name' | 'numbers' | 'hours' | 'purpose'>
  >;
  /**
   * What the support lines shown can promise (content's `HelplineCover`, audit A10-11): open
   * 24 hours, set hours, or no support line at all. Absent on cards stored before A10-11.
   */
  readonly cover?: 'none' | 'all-day' | 'set-hours';
  /**
   * The learner's own campus lines (Phase 5b, planning.md §4.3): the **verified** clinic,
   * counselling and security places at the university whose offer they accepted. Never a draft,
   * even in preview mode. Absent without an accepted offer, or when none is verified yet.
   */
  readonly campus?: CrisisCampusLines;
}

/** One campus safety place on the crisis card, as its verified catalogue record holds it. */
export interface CampusSafetyLine {
  readonly id: string;
  readonly kind: SafetyPlaceKind;
  readonly name: string;
  readonly campusName: string;
  /** Null when the source prints no building (A13-11): the line then shows no "where". */
  readonly where: string | null;
  readonly hours: string | null;
  /** As printed (digits and spaces); dial it with `dialable`. */
  readonly phone: string | null;
  /**
   * "Walk there" (Phase 5e-1), as on the campus tour: Google's and Apple's walking directions to
   * the published location. Optional, so a crisis card saved before them still renders.
   */
  readonly walkUrl?: string | null;
  readonly appleWalkUrl?: string | null;
}

export interface CrisisCampusLines {
  readonly universityName: string;
  readonly lines: ReadonlyArray<CampusSafetyLine>;
}

export interface DeadlinesArtifact {
  readonly kind: 'deadlines';
  readonly windows: ReadonlyArray<ApplicationWindow & { universityName: string }>;
  /** The intake the learner is applying for, so last cycle's dates are labelled as such. */
  readonly targetIntake: number;
}

export interface ApplicationPackArtifact {
  readonly kind: 'application-pack';
  readonly university: University;
  readonly window: ApplicationWindow | null;
  readonly programmes: ReadonlyArray<ProgrammeResult>;
  readonly checklist: ReadonlyArray<{ item: string; done: boolean }>;
  readonly targetIntake: number;
}

export interface FundingArtifact {
  readonly kind: 'funding';
  readonly nsfas: Nsfas | null;
  readonly checklist: ReadonlyArray<{ item: string; done: boolean }>;
}

/**
 * The learner's goal (planning.md §3, Stage 3): one target programme, and where they stand for it
 * now, as packages/admissions decided it from their confirmed marks (hard rule 2).
 */
export interface GoalCardArtifact {
  readonly kind: 'goal-card';
  readonly programme: {
    readonly id: string;
    readonly name: string;
    readonly faculty: string;
    readonly universityId: UniversityId;
    readonly universityName: string;
    readonly sourceUrl: string;
    readonly academicYear: number;
    /** True while the record (or its score method) is unverified: preview only, labelled. */
    readonly draft: boolean;
  };
  /** The learner's current verdict for it, or null when they have no confirmed marks yet. */
  readonly result: ProgrammeResult | null;
  /**
   * Whether the learner has confirmed marks. A verdict can be missing even then, while the
   * university's score method is unverified (hard rule 3).
   */
  readonly hasMarks: boolean;
}

/** One paper on the countdown. */
export interface CountdownPaper {
  readonly id: string;
  readonly subjectId: SubjectId;
  readonly subjectName: string;
  readonly paper: number;
  /** The day it is written (YYYY-MM-DD, South Africa). */
  readonly date: string;
  /** Start time, SAST, as the timetable prints it. */
  readonly startsAt: string;
  readonly durationMinutes: number;
  readonly session: 'morning' | 'afternoon';
  /** South African calendar days from today: 0 is today. */
  readonly daysLeft: number;
  readonly note: string | null;
  readonly sourceUrl: string;
  readonly draft: boolean;
}

/**
 * The learner's next NSC papers and the days left to each (planning.md §3, Stage 3). From the
 * sourced timetable matched to the subjects they write; drafts only in preview, labelled.
 */
export interface ExamCountdownArtifact {
  readonly kind: 'exam-countdown';
  /** The year the learner writes their final NSC exams. */
  readonly examYear: number;
  /** Whether any timetable for that year is in the catalogue the learner may see. */
  readonly timetablePublished: boolean;
  /** How many subjects the papers were matched from (0: nothing confirmed or chosen yet). */
  readonly subjectCount: number;
  readonly papers: ReadonlyArray<CountdownPaper>;
  readonly includesDrafts: boolean;
}

/** Why a subject is on the practice list. */
export type PracticeReason =
  /** The learner asked about it. */
  | 'asked'
  /** "What I need" says this mark must rise for their goal. */
  | 'goal-to-raise'
  /** Their goal programme names this subject in its requirements. */
  | 'goal-requires'
  /** One of their lowest confirmed marks (no goal yet). */
  | 'weakest';

/** One free resource, as its sourced catalogue record holds it. */
export interface PracticeLink {
  readonly id: string;
  readonly kind: PracticeKind;
  readonly title: string;
  readonly url: string;
  readonly grades: ReadonlyArray<number>;
  readonly access: PracticeAccess;
  readonly sourceUrl: string;
  /** True while unverified: preview only, labelled (hard rule 3). */
  readonly draft: boolean;
}

export interface PracticeSubject {
  readonly subjectId: SubjectId;
  readonly subjectName: string;
  readonly reason: PracticeReason;
  /** Empty when the catalogue has no free practice for it yet. */
  readonly resources: ReadonlyArray<PracticeLink>;
}

/**
 * Free practice for the subjects that matter to the learner (planning.md §3, Stage 3): chosen
 * from their goal and "what I need", or their weakest confirmed marks. Links only, from verified
 * catalogue records; no admission fact (no mark to aim for: that is the what-i-need artifact).
 */
export interface PracticeArtifact {
  readonly kind: 'practice';
  /** How the subjects were chosen; `none` when there is nothing to choose from yet. */
  readonly basis: 'asked' | 'goal' | 'weakest' | 'none';
  readonly goal: {
    readonly programmeId: string;
    readonly name: string;
    readonly universityName: string;
  } | null;
  readonly subjects: ReadonlyArray<PracticeSubject>;
  readonly includesDrafts: boolean;
}

/**
 * The January re-check of an offer (Phase 5a): the programme's published requirements run again
 * by packages/admissions on the learner's confirmed final results, with Stage 1's Plan B when they
 * aren't met. Never about the letter's own conditions, which are shown as quoted.
 */
export interface OfferFinalCheck {
  /** When the learner confirmed the final results it was run on. */
  readonly confirmedAt: string;
  readonly status: FinalCheck['status'];
  /** What falls short, from the same code as My results. Empty when met or unavailable. */
  readonly shortfalls: ProgrammeResult['shortfalls'];
  readonly planB: ReadonlyArray<{
    readonly programmeId: string;
    readonly name: string;
    readonly universityName: string;
    readonly qualification: ProgrammeResult['qualification'];
    readonly draft: boolean;
  }>;
}

/**
 * One offer the learner holds (planning.md §11, Phase 5a): what kind it is in plain words (from
 * packages/content, never "you're in" unless it is final, §8.5), the conditions as quoted, the
 * reply-by countdown, and, once final results are confirmed, the January re-check.
 */
export interface OfferCardArtifact {
  readonly kind: 'offer-card';
  readonly id: string;
  readonly offerKind: OfferKind;
  readonly status: 'held' | 'accepted' | 'declined';
  readonly source: 'letter' | 'learner';
  readonly universityId: string;
  readonly universityName: string;
  /** Null when the catalogue the learner may see no longer holds it (hard rule 3). */
  readonly programme: {
    readonly id: string;
    readonly name: string;
    readonly faculty: string;
    readonly sourceUrl: string;
    readonly academicYear: number;
    /** True while unverified: preview only, labelled. */
    readonly draft: boolean;
  } | null;
  /** YYYY-MM-DD, as the learner confirmed it. */
  readonly replyBy: string | null;
  /** South African days until it; negative once passed. Null without a date. */
  readonly daysLeft: number | null;
  /** As quoted from the letter. */
  readonly conditions: ReadonlyArray<string>;
  /** When the reply-by reminder is due, while one is waiting. */
  readonly reminderAt: string | null;
  /** Whether the January re-check applies: every kind but a final offer. */
  readonly checksFinal: boolean;
  /** The re-check, once final results are confirmed; null until then. */
  readonly finalCheck: OfferFinalCheck | null;
}

/**
 * How the tour and the checklist chose their university (Phase 5b): the learner's accepted offer,
 * or one the learner picked to look around. Never assumed.
 */
export type CampusBasis = 'accepted-offer' | 'chosen';

/** One place on a campus, as its catalogue record holds it (hard rule 3). */
export interface CampusPlaceView {
  readonly id: string;
  readonly kind: PlaceKind;
  readonly name: string;
  /** Null when the source prints no building (A13-11): the card then shows no "where" line. */
  readonly where: string | null;
  readonly hours: string | null;
  /** As printed; dial it with `dialable`. */
  readonly phone: string | null;
  /**
   * The "open in maps" link (`mapsLink`, owner's decision 2: link out, no map tiles). Null when
   * no location is published (A13-11): then there is no "Open in maps" link at all.
   */
  readonly mapsUrl: string | null;
  /**
   * The same place in Apple Maps (`appleMapsLink`), which the app opens on an iPhone (A7-18).
   * Optional: a card saved in a chat before it existed has only `mapsUrl`, which still works.
   * Null, like `mapsUrl`, when no location is published.
   */
  readonly appleMapsUrl?: string | null;
  /**
   * "Walk there" (Phase 5e-1): walking directions from wherever the learner stands, in Google Maps
   * (`walkingLink`) and Apple Maps (`appleWalkingLink`, offered beside it on an iPhone). Built by
   * code from the published location: the AI never writes one. Destination only, so no location
   * of the learner's ever reaches us. Null without a published location. The 5e fields are
   * optional: a card saved in a chat before them still renders, without them.
   */
  readonly walkUrl?: string | null;
  readonly appleWalkUrl?: string | null;
  /** "See it": Google Street View at the published coordinates (`streetViewLink`); null without them. */
  readonly streetViewUrl?: string | null;
  /** "Step-free route": walking directions to the published accessible entrance; null without one. */
  readonly accessibleWalkUrl?: string | null;
  readonly accessibleAppleWalkUrl?: string | null;
  /** The accessible entrance's published description ("East door, by the ramp"), or null. */
  readonly accessibleEntrance?: string | null;
  /** The last metres (Phase 5e-4), as the disability unit or a walk-through puts them, or null. */
  readonly arrivalNote?: string | null;
  readonly sourceUrl: string;
  /** True while unverified: preview only, labelled. A safety place is never a draft here. */
  readonly draft: boolean;
}

export interface CampusView {
  readonly id: string;
  readonly name: string;
  readonly city: string;
  /** The university's own campus map and virtual tour, when it publishes them (Q14: links). */
  readonly mapUrl: string | null;
  readonly virtualTourUrl: string | null;
  readonly sourceUrl: string;
  readonly draft: boolean;
  /** Places grouped by need, in content's `PLACE_NEED_IDS` order; empty needs left out. */
  readonly needs: ReadonlyArray<{
    readonly need: PlaceNeed;
    readonly places: ReadonlyArray<CampusPlaceView>;
  }>;
  /** The university's safety notes for this campus (5e-3). Optional: older saved cards lack it. */
  readonly safetyNotes?: ReadonlyArray<SafetyNoteView>;
}

/**
 * The campus tour (planning.md §11, Phase 5b): the university's campuses and the places on each,
 * grouped by need. Text first, links out (Q14). Built from the catalogue view only: drafts in
 * preview, labelled; safety places only once verified. An empty `campuses` is "not checked yet".
 */
export interface CampusTourArtifact {
  readonly kind: 'campus-tour';
  readonly universityId: UniversityId;
  readonly universityName: string;
  readonly basis: CampusBasis;
  readonly campuses: ReadonlyArray<CampusView>;
  /** "Before you arrive" (§8.6): shown once the learner has accepted an offer here. */
  readonly beforeYouArrive: boolean;
  readonly includesDrafts: boolean;
  /** The university's safety notes for every campus (5e-3), shown once. Optional, as above. */
  readonly universitySafetyNotes?: ReadonlyArray<SafetyNoteView>;
}

/** One step of the first-week checklist, and whether the learner ticked it. */
export interface FirstWeekStepView {
  readonly id: FirstWeekStep;
  /** When the learner ticked it, or null. */
  readonly doneAt: string | null;
}

/**
 * The first-week checklist (planning.md §11, Phase 5b): steps from content, dates from the
 * university's registration calendar (null when the catalogue has none the learner may see), and
 * the learner's own progress (packages/db, migration 0019).
 */
export interface FirstWeekArtifact {
  readonly kind: 'first-week';
  readonly universityId: UniversityId;
  readonly universityName: string;
  readonly basis: CampusBasis;
  readonly steps: ReadonlyArray<FirstWeekStepView>;
  readonly calendar: {
    /** `from` is null when the university publishes only the closing date: never guessed. */
    readonly registration: { readonly from: string | null; readonly to: string };
    readonly orientation: { readonly from: string; readonly to: string } | null;
    readonly changeDeadlines: ReadonlyArray<{
      readonly appliesTo: RegistrationCalendar['changeDeadlines'][number]['appliesTo'];
      readonly lastDay: string;
    }>;
    readonly academicYear: number;
    readonly sourceUrl: string;
    readonly draft: boolean;
  } | null;
  /** The faculty office of the accepted offer's programme, when the catalogue has one. */
  readonly facultyOffice: {
    readonly faculty: string;
    readonly where: string;
    readonly hours: string | null;
    readonly phone: string | null;
    readonly email: string | null;
    readonly contactUrl: string;
    readonly sourceUrl: string;
    readonly draft: boolean;
  } | null;
  readonly includesDrafts: boolean;
  /** Every safety note the tour shows, beside the safety guidance (5e-3). Optional, as above. */
  readonly safetyNotes?: ReadonlyArray<SafetyNoteView>;
}

/** One module the learner confirmed, and whether the curriculum lists or allows it. */
export interface RegisteredModuleRow {
  readonly code: string;
  readonly name: string | null;
  readonly term: ModuleTerm | null;
  readonly credits: number | null;
  /**
   * Whether the curriculum lists it, or allows it as an open elective (`openElective`). Null when
   * there is no curriculum to look it up in.
   */
  readonly inCurriculum: boolean | null;
  /** Present when it isn't listed but counts against the curriculum's open elective credits (A1-27). */
  readonly openElective?: true;
}

/** One module the curriculum lists, and whether the learner is registered for it. */
export interface ExpectedModuleRow {
  readonly code: string;
  /** Other codes the rule book lists it under (e.g. ECO1010S for ECO1010F); absent when none. */
  readonly alternativeCodes?: ReadonlyArray<string>;
  readonly name: string;
  /** Absent when the rule book prints no term: shown as such, never guessed. */
  readonly semester?: OfferedTerm;
  readonly credits: number;
  readonly compulsory: boolean;
  readonly registered: boolean;
}

/** One difference the registration check found, and its explanation from content. */
export interface ModuleDifference {
  readonly difference: RegistrationDifference;
  readonly text: string;
}

/**
 * My modules (planning.md §11, Phase 5c): the modules the learner confirmed against their
 * programme's published first-year curriculum. Every difference is `compareRegistration`'s, from
 * packages/admissions; who to see is the faculty office record; the last day to change is the
 * registration calendar's (never guessed); the suggested message is a content template filled by
 * code. **No verdict without a curriculum record**: `status` says why there is none.
 */
export interface MyModulesArtifact {
  readonly kind: 'my-modules';
  readonly registrationId: string;
  /** The year the learner registered for. */
  readonly academicYear: number;
  readonly yearOfStudy: number | null;
  readonly confirmedAt: string;
  /** Null when the catalogue the learner may see no longer holds it (hard rule 3). */
  readonly programme: {
    readonly id: string;
    readonly name: string;
    readonly faculty: string;
    readonly universityId: UniversityId;
    readonly universityName: string;
    readonly sourceUrl: string;
    readonly academicYear: number;
    readonly draft: boolean;
  } | null;
  /**
   * `checked`: compared with a curriculum record. Otherwise no verdict at all: no programme in
   * the view, no curriculum record for it, or a year of study the records don't cover.
   */
  readonly status: 'checked' | 'no-programme' | 'no-curriculum' | 'not-first-year';
  /** The curriculum checked against, when there was one. */
  readonly curriculum: {
    readonly academicYear: number;
    readonly sourceUrl: string;
    readonly draft: boolean;
  } | null;
  readonly registered: ReadonlyArray<RegisteredModuleRow>;
  /** The curriculum's modules; empty without a curriculum. */
  readonly expected: ReadonlyArray<ExpectedModuleRow>;
  /**
   * `compareRegistration`'s differences, in its order, each with its plain explanation (content's
   * wording for its kind, filled by code). Empty unless `checked`.
   */
  readonly differences: ReadonlyArray<ModuleDifference>;
  readonly credits: RegistrationComparison['credits'] | null;
  /** The programme's faculty office, when the catalogue has one the learner may see. */
  readonly office: {
    readonly faculty: string;
    readonly where: string;
    readonly contactUrl: string;
    readonly email: string | null;
    readonly phone: string | null;
    readonly hours: string | null;
    readonly sourceUrl: string;
    readonly draft: boolean;
  } | null;
  /** The last day to change, from the registration calendar for `academicYear` (or none). */
  readonly deadlines: ChangeDeadlines & {
    readonly sourceUrl: string | null;
    readonly draft: boolean;
  };
  /** When the change-deadline reminder is due, while one is waiting. */
  readonly reminderAt: string | null;
  /** The message the learner can copy, filled by code from content; null with nothing to fix. */
  readonly message: string | null;
  /** True when anything shown is unverified: preview only, labelled. */
  readonly includesDrafts: boolean;
}

export type Artifact =
  | ResultsCardArtifact
  | CourseExplorerArtifact
  | ScoreBreakdownArtifact
  | WhatINeedArtifact
  | CrisisCardArtifact
  | DeadlinesArtifact
  | ApplicationPackArtifact
  | FundingArtifact
  | GoalCardArtifact
  | ExamCountdownArtifact
  | PracticeArtifact
  | OfferCardArtifact
  | CampusTourArtifact
  | FirstWeekArtifact
  | MyModulesArtifact;

export type ArtifactKind = Artifact['kind'];
