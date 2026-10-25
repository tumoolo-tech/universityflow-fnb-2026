import 'server-only';
import {
  acceptedUniversity,
  arrivalYear,
  type CampusTourArtifact,
  campusTour,
  campusUniversity,
  type FirstWeekArtifact,
  firstWeek,
  isUniversityId,
} from '@universityflow/agent';
import { type CatalogueView, sastDateOf, type UniversityId } from '@universityflow/catalogue';
import type { MessagingChannel, StudentStore } from '@universityflow/db';
import type { JobScheduler } from '@universityflow/jobs';
import { HttpError } from './http';
import { asAgentOffers } from './offers';
import { eveningOf, replaceLearnerReminder } from './reminders';

/**
 * The campus tour and the first-week checklist for the web pages and the app's API (planning.md
 * §11, Phase 5b), built by the same code as the agent's `campus_tour` and `first_week` tools
 * (packages/agent/src/campus.ts), so the chat and the screens agree.
 *
 * Which university: the learner's accepted offer's, or one they chose to look around (`?university=`).
 * Never assumed: with neither, the answer is the list of universities to choose from.
 */

/** A university the learner may choose to look around. */
export interface UniversityOption {
  readonly id: UniversityId;
  readonly name: string;
}

export interface CampusResponse {
  /** Null until the learner accepts an offer or chooses a university. */
  readonly tour: CampusTourArtifact | null;
  /** The accepted offer's university, if any. */
  readonly accepted: UniversityId | null;
  readonly options: ReadonlyArray<UniversityOption>;
}

export interface FirstWeekResponse {
  readonly checklist: FirstWeekArtifact | null;
  readonly accepted: UniversityId | null;
  readonly options: ReadonlyArray<UniversityOption>;
}

/** The `?university=` a request names: a catalogue id, or nothing; anything else is refused. */
export function chosenUniversity(value: string | null | undefined): UniversityId | null {
  if (value === null || value === undefined || value === '') return null;
  if (!isUniversityId(value)) throw new HttpError(400, 'invalid');
  return value;
}

function options(view: CatalogueView): UniversityOption[] {
  return view.universities.map((u) => ({ id: u.id, name: u.shortName }));
}

export async function campusResponse(
  student: StudentStore,
  view: CatalogueView,
  chosen: UniversityId | null,
): Promise<CampusResponse> {
  const offers = asAgentOffers(await student.offers());
  const choice = campusUniversity(offers, chosen);
  return {
    tour: choice ? campusTour(view, choice.universityId, choice.basis) : null,
    accepted: acceptedUniversity(offers),
    options: options(view),
  };
}

export async function firstWeekResponse(
  student: StudentStore,
  view: CatalogueView,
  chosen: UniversityId | null,
  now = new Date(),
): Promise<FirstWeekResponse> {
  const offers = asAgentOffers(await student.offers());
  const choice = campusUniversity(offers, chosen);
  const accepted = offers.find((o) => o.status === 'accepted');
  return {
    checklist: choice
      ? firstWeek(
          view,
          choice.universityId,
          choice.basis,
          await student.firstWeekSteps(choice.universityId),
          choice.basis === 'accepted-offer' ? (accepted?.programmeId ?? null) : null,
          // The calendar for the year the learner arrives, never another year's (A13-02).
          arrivalYear(now, choice.universityId, await student.registration()),
        )
      : null,
    accepted: acceptedUniversity(offers),
    options: options(view),
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;
/** Mid-January, when accommodation deposit scams peak (planning.md §8.6). */
const MOVE_IN_DAY = '01-15';

/**
 * When the two safety notifications are due after an offer is accepted at `now`: the first at the
 * next 18:00 SAST, the second at 18:00 SAST on the coming 15 January (this year's while it is
 * still ahead). The pipeline still moves either if it lands somewhere it may not go.
 */
export function safetyReminderTimes(now: Date): { accepted: Date; moveIn: Date } {
  const today = sastDateOf(now);
  const tonight = eveningOf(today);
  const accepted = tonight > now ? tonight : new Date(tonight.getTime() + DAY_MS);
  const year = Number(today.slice(0, 4));
  const thisYear = eveningOf(`${year}-${MOVE_IN_DAY}`);
  return { accepted, moveIn: thisYear > now ? thisYear : eveningOf(`${year + 1}-${MOVE_IN_DAY}`) };
}

/**
 * Safety and scam guidance once the learner accepts an offer (planning.md §8.6): two push
 * notifications, never SMS or WhatsApp (owner's decision 4), and only when push is offered and the
 * learner turned it on. Each replaces one still waiting from the same template, so accepting again
 * never stacks them. Consent, cadence and quiet hours are the pipeline's, at send time.
 */
export async function scheduleSafetyReminders(
  student: StudentStore,
  jobs: JobScheduler,
  offered: ReadonlyArray<MessagingChannel>,
  now = new Date(),
): Promise<number> {
  if (!offered.includes('push')) return 0;
  const prefs = await student.messagingPreferences();
  if (!prefs.channels.some((c) => c.channel === 'push' && c.optedIn)) return 0;
  const times = safetyReminderTimes(now);
  await replaceLearnerReminder(student, jobs, {
    templateId: 'safety.offer-accepted',
    channel: 'push',
    desiredAt: times.accepted,
  });
  await replaceLearnerReminder(student, jobs, {
    templateId: 'safety.move-in',
    channel: 'push',
    desiredAt: times.moveIn,
  });
  return 2;
}
