import {
  appleMapsLink,
  appleWalkingLink,
  type CatalogueView,
  campusesOf,
  facultyOfficeFor,
  isDraft,
  mapsLink,
  type Place,
  type PlaceKind,
  placesOn,
  programmeById,
  registrationCalendarFor,
  safetyPlacesOn,
  sastDateOf,
  streetViewLink,
  UNIVERSITY_IDS,
  type UniversityId,
  universityById,
  walkingLink,
} from '@universityflow/catalogue';
import {
  FIRST_WEEK_STEPS,
  type FirstWeekStep,
  PLACE_NEED_IDS,
  PLACE_NEEDS,
  type PlaceNeed,
} from '@universityflow/content';
import type {
  CampusBasis,
  CampusPlaceView,
  CampusTourArtifact,
  CrisisCampusLines,
  FirstWeekArtifact,
} from '@universityflow/ui';
import type { AgentOffer } from './offers';
import { safetyNoteViews } from './safety-notes';

/**
 * The campus tour, the first-week checklist and the crisis card's campus lines (planning.md §11,
 * Phase 5b), built from the catalogue view only (hard rules 2 and 3): the agent's `campus_tour`
 * and `first_week` tools, the web pages and the app's API all use these, so they can't disagree.
 *
 * Which university: the one whose offer the learner accepted, or one the learner chose to look
 * around. Never assumed.
 */

export function isUniversityId(value: unknown): value is UniversityId {
  return typeof value === 'string' && (UNIVERSITY_IDS as ReadonlyArray<string>).includes(value);
}

/** The university of the learner's accepted offer, or null (at most one is accepted, 5a). */
export function acceptedUniversity(offers: ReadonlyArray<AgentOffer>): UniversityId | null {
  const accepted = offers.find((o) => o.status === 'accepted');
  return accepted && isUniversityId(accepted.universityId) ? accepted.universityId : null;
}

/**
 * The university the tour and the checklist are about: the one the learner chose to look around,
 * else their accepted offer's. Null when neither: the caller asks, never guesses.
 */
export function campusUniversity(
  offers: ReadonlyArray<AgentOffer>,
  chosen: UniversityId | null | undefined,
): { readonly universityId: UniversityId; readonly basis: CampusBasis } | null {
  const accepted = acceptedUniversity(offers);
  if (chosen && chosen !== accepted) return { universityId: chosen, basis: 'chosen' };
  return accepted ? { universityId: accepted, basis: 'accepted-offer' } : null;
}

/** Which need a kind of place answers (content's `PLACE_NEEDS`). */
export function needOf(kind: PlaceKind): PlaceNeed {
  for (const need of PLACE_NEED_IDS) {
    if ((PLACE_NEEDS[need] as ReadonlyArray<string>).includes(kind)) return need;
  }
  return 'support';
}

function placeView(place: Place): CampusPlaceView {
  return {
    id: place.id,
    kind: place.kind,
    name: place.name,
    // Null when the source prints none (A13-11): no "where" line and no maps link, never a guess.
    where: place.where ?? null,
    hours: place.hours ?? null,
    phone: place.phone ?? null,
    mapsUrl: mapsLink(place.location),
    appleMapsUrl: appleMapsLink(place.location, place.name),
    // Walk there, See it and the step-free route (5e-1): built here from the published record,
    // never by the AI, and carrying only the destination. Null when nothing is published.
    walkUrl: walkingLink(place.location),
    appleWalkUrl: appleWalkingLink(place.location),
    streetViewUrl: streetViewLink(place.location),
    accessibleWalkUrl: walkingLink(place.accessibleEntrance?.location),
    accessibleAppleWalkUrl: appleWalkingLink(place.accessibleEntrance?.location),
    accessibleEntrance: place.accessibleEntrance?.description ?? null,
    arrivalNote: place.arrivalNote ?? null,
    sourceUrl: place.sourceUrl,
    draft: isDraft(place),
  };
}

/**
 * The campus tour of one university, or null when the catalogue the learner may see doesn't hold
 * it. Its campuses and places come from the view: drafts only in preview (labelled), safety places
 * only once verified (the view's own gate). No campus is "not checked yet", said honestly.
 */
export function campusTour(
  view: CatalogueView,
  universityId: UniversityId,
  basis: CampusBasis,
): CampusTourArtifact | null {
  const university = universityById(view, universityId);
  if (!university) return null;
  const campuses = campusesOf(view, universityId).map((campus) => {
    const places = placesOn(view, campus.id);
    return {
      id: campus.id,
      name: campus.name,
      city: campus.city,
      mapUrl: campus.mapUrl ?? null,
      virtualTourUrl: campus.virtualTourUrl ?? null,
      sourceUrl: campus.sourceUrl,
      draft: isDraft(campus),
      needs: PLACE_NEED_IDS.map((need) => ({
        need,
        places: places.filter((p) => needOf(p.kind) === need).map(placeView),
      })).filter((n) => n.places.length > 0),
      safetyNotes: safetyNoteViews(view, universityId, campus.id),
    };
  });
  return {
    kind: 'campus-tour',
    universityId,
    universityName: university.shortName,
    basis,
    campuses,
    beforeYouArrive: basis === 'accepted-offer',
    includesDrafts: view.includesDrafts,
    universitySafetyNotes: safetyNoteViews(view, universityId, null),
  };
}

/** A step the learner ticked, as packages/db keeps it. */
export interface TickedStep {
  readonly step: string;
  readonly doneAt: Date;
}

/** The last month of a year's first-year registration: from the month after, it is over. */
const LAST_REGISTRATION_MONTH = 2;

/**
 * The academic year a learner arrives at `universityId` (A13-02): the year of their confirmed
 * registration there, when they have one; otherwise the next intake. South African universities
 * register first-years in January and February, so until the end of February (SAST) the next
 * intake is this year's, and from March it is next year's (an offer accepted then is for next
 * year).
 */
export function arrivalYear(
  now: Date,
  universityId: string,
  registration: { readonly universityId: string; readonly academicYear: number } | null,
): number {
  if (registration?.universityId === universityId) return registration.academicYear;
  const [year, month] = sastDateOf(now).split('-').map(Number) as [number, number];
  return month > LAST_REGISTRATION_MONTH ? year + 1 : year;
}

/**
 * The first-week checklist for one university, or null when the catalogue the learner may see
 * doesn't hold it. Steps from content; dates from the registration calendar for `academicYear`,
 * the year the learner arrives (`arrivalYear`): another year's calendar is never shown, and with
 * none the dates are "not published" rather than a guess. The faculty office of the accepted
 * offer's programme when there is one.
 */
export function firstWeek(
  view: CatalogueView,
  universityId: UniversityId,
  basis: CampusBasis,
  ticked: ReadonlyArray<TickedStep>,
  programmeId: string | null,
  academicYear: number,
): FirstWeekArtifact | null {
  const university = universityById(view, universityId);
  if (!university) return null;
  const done = new Map(ticked.map((t) => [t.step, t.doneAt]));
  const calendar = registrationCalendarFor(view, universityId, academicYear);
  const programme = programmeId ? programmeById(view, programmeId) : undefined;
  const office =
    programme && programme.universityId === universityId
      ? facultyOfficeFor(view, programme)
      : undefined;
  return {
    kind: 'first-week',
    universityId,
    universityName: university.shortName,
    basis,
    steps: FIRST_WEEK_STEPS.map((id: FirstWeekStep) => ({
      id,
      doneAt: done.get(id)?.toISOString() ?? null,
    })),
    calendar: calendar
      ? {
          registration: {
            from: calendar.firstYearRegistration.from ?? null,
            to: calendar.firstYearRegistration.to,
          },
          orientation: calendar.orientation
            ? { from: calendar.orientation.from, to: calendar.orientation.to }
            : null,
          changeDeadlines: calendar.changeDeadlines.map((d) => ({
            appliesTo: d.appliesTo,
            lastDay: d.lastDay,
          })),
          academicYear: calendar.academicYear,
          sourceUrl: calendar.sourceUrl,
          draft: isDraft(calendar),
        }
      : null,
    facultyOffice: office
      ? {
          faculty: office.faculty,
          where: office.where,
          hours: office.hours ?? null,
          phone: office.phone ?? null,
          email: office.email ?? null,
          contactUrl: office.contactUrl,
          sourceUrl: office.sourceUrl,
          draft: isDraft(office),
        }
      : null,
    includesDrafts: view.includesDrafts,
    safetyNotes: [
      ...safetyNoteViews(view, universityId, null),
      ...campusesOf(view, universityId).flatMap((c) => safetyNoteViews(view, universityId, c.id)),
    ],
  };
}

/** Security first: in a crisis it is the line most likely to need to be reached fast. */
const SAFETY_ORDER = { security: 0, clinic: 1, counselling: 2 } as const;

/**
 * The crisis card's campus lines (planning.md §4.3): the verified clinic, counselling and security
 * places on every campus of the learner's accepted offer's university. **Verified only, even in
 * preview mode**: the view never returns a draft safety place, and this checks again, so a draft
 * line can't reach a learner in distress whatever the view does. Undefined when there is none.
 */
export function campusSafetyLines(
  view: CatalogueView,
  universityId: UniversityId | null,
): CrisisCampusLines | undefined {
  if (!universityId) return undefined;
  const university = universityById(view, universityId);
  if (!university) return undefined;
  const lines = campusesOf(view, universityId).flatMap((campus) =>
    safetyPlacesOn(view, campus.id)
      .filter((p) => !isDraft(p))
      .sort((a, b) => SAFETY_ORDER[a.kind] - SAFETY_ORDER[b.kind])
      .map((p) => ({
        id: p.id,
        kind: p.kind,
        name: p.name,
        campusName: campus.name,
        where: p.where ?? null,
        hours: p.hours ?? null,
        phone: p.phone ?? null,
        walkUrl: walkingLink(p.location),
        appleWalkUrl: appleWalkingLink(p.location),
      })),
  );
  return lines.length > 0 ? { universityName: university.shortName, lines } : undefined;
}
