import { z } from 'zod';
import { MODULE_TERMS, PLACE_KINDS } from './basics';
import { sourced } from './provenance';
import { isUniversitySource, universityId } from './records';

/**
 * Where a first-year learner goes, and when (planning.md §11, Phase 5b and 5c): each university's
 * campuses, the places on them, its faculty offices, and its registration calendar.
 *
 * Every record is `sourced` from the university's **own** site (hard rule 3), carries the academic
 * year it was published for, and is a draft until a person verifies it. Names, buildings, rooms and
 * hours are data, quoted as the university publishes them; the words around them come from
 * `packages/content` (hard rule 8). Nothing here is invented: a field the university doesn't
 * publish is left out, never guessed.
 *
 * Pure data only: the mobile app imports this (hard rule 11).
 */

const isoDate = z.iso.date();
const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'lower-case words joined by hyphens');
const https = z.url({ protocol: /^https$/ });
/**
 * A phone number as the university prints it, in digits a phone can dial once spaces are dropped
 * (`dialable`): "+27 11 717 1000" or "011 717 1000", never "+27 (0)11 …" (as helplines).
 */
const printedNumber = z.string().regex(/^\+?[\d ]{3,20}$/, 'digits and spaces, optional leading +');
/** Opening hours as published, e.g. "Mon–Fri 08:00–16:30; Sat 09:00–13:00". */
const hours = z.string().trim().min(3);

const onOwnSite = (r: { universityId: z.infer<typeof universityId>; sourceUrl: string }) =>
  isUniversitySource(r.universityId, r.sourceUrl);
const OWN_SITE = { message: 'A record cites a page on its university’s own domain' };

export const campusSchema = sourced({
  /** Starts with the university id, e.g. `wits-braamfontein-east`. */
  id: slug,
  universityId,
  /** The campus name as the university prints it. */
  name: z.string().trim().min(2),
  city: z.string().trim().min(2),
  /** The university's own campus map (a page or PDF), when it publishes one. */
  mapUrl: https.optional(),
  /** The university's own virtual tour, when it publishes one (link out; Q14). */
  virtualTourUrl: https.optional(),
})
  .refine(onOwnSite, OWN_SITE)
  .refine((c) => c.id.startsWith(`${c.universityId}-`), {
    message: 'A campus id starts with its university id',
  });
export type Campus = z.infer<typeof campusSchema>;

/**
 * Where a place is, for "open in maps" (`mapsLink`): the text to search for (the building and
 * campus as published, e.g. "Wartenweiler Library, Wits East Campus, Johannesburg"), and/or the
 * coordinates the university publishes. Coordinates must fall inside South Africa, which catches
 * a swapped latitude and longitude.
 */
export const mapLocationSchema = z
  .object({
    query: z.string().trim().min(3).optional(),
    coordinates: z
      .object({ lat: z.number().min(-35).max(-22), lng: z.number().min(16).max(33) })
      .optional(),
  })
  .refine((l) => l.query !== undefined || l.coordinates !== undefined, {
    message: 'A location needs a search query, coordinates, or both',
  });

export const placeSchema = sourced({
  /** Starts with the university id, e.g. `wits-wartenweiler-library`. */
  id: slug,
  /** The campus it is on: a `campus` record's id. */
  campusId: slug,
  kind: z.enum(PLACE_KINDS),
  /** The place's name as published, e.g. "Campus Health and Wellness Centre". */
  name: z.string().trim().min(2),
  /**
   * The building, floor and room as published, e.g. "Ground floor, Senate House". Left out when
   * the source doesn't print one (gotcha 40): the place is then shown without a "where" line.
   */
  where: z.string().trim().min(2).optional(),
  hours: hours.optional(),
  phone: printedNumber.optional(),
  /**
   * The page the phone number comes from, when it isn't `sourceUrl` (A13-11): e.g. a clinic's
   * building from an orientation page and its number from the clinic service's own contacts page.
   * On the university's own domain like every source (the integrity checks hold it to that), and
   * shown next to the number in the verification checklist, so the number is dialled against it.
   */
  phoneSourceUrl: https.optional(),
  /** Where to point a maps app. Left out when nothing is published: then there is no maps link. */
  location: mapLocationSchema.optional(),
  /**
   * The step-free (accessible) entrance, when the university or a person's walk-through with its
   * disability unit records one (planning.md §11, Phase 5e-1): a separate location that becomes
   * the destination of "Step-free route", and a short description as published ("East door, by
   * the ramp"). Never required (gotcha 40): without one, "Walk there" goes to the building.
   */
  accessibleEntrance: z
    .object({
      location: mapLocationSchema,
      description: z.string().trim().min(3).max(200).optional(),
    })
    .optional(),
  /**
   * The last metres (Phase 5e-4): the accessible entrance, a ramp, a lift, steps or a landmark, as
   * the university's disability unit publishes it or a person recorded it on a walk-through.
   * Shown and read aloud as written; verified like a safety fact.
   */
  arrivalNote: z.string().trim().min(10).max(500).optional(),
  /**
   * The page the arrival note comes from, when it isn't `sourceUrl` (e.g. the disability unit's
   * page), on the university's own domain like `phoneSourceUrl` (the integrity checks hold it).
   */
  arrivalSourceUrl: https.optional(),
  /** Something research could not settle, shown to the verifier. */
  note: z.string().min(3).optional(),
})
  .refine((p) => p.phoneSourceUrl === undefined || p.phone !== undefined, {
    message: 'A phone source comes with a phone',
  })
  .refine((p) => p.arrivalSourceUrl === undefined || p.arrivalNote !== undefined, {
    message: 'An arrival source comes with an arrival note',
  });
export type Place = z.infer<typeof placeSchema>;

export const facultyOfficeSchema = sourced({
  /** Starts with the university id, e.g. `wits-science-faculty-office`. */
  id: slug,
  universityId,
  /**
   * The faculty, spelled exactly as the catalogue's programmes spell it (`Programme.faculty`), so
   * a programme finds its office. A test holds every office to a faculty some programme uses.
   */
  faculty: z.string().trim().min(3),
  /** The campus it is on, when the university has several: a `campus` record's id. */
  campusId: slug.optional(),
  /** The building, floor and room as published. */
  where: z.string().trim().min(2),
  /** The faculty's own contact page. */
  contactUrl: https,
  email: z.email().optional(),
  phone: printedNumber.optional(),
  hours: hours.optional(),
})
  .refine(onOwnSite, OWN_SITE)
  .refine((o) => isUniversitySource(o.universityId, o.contactUrl), {
    message: 'A faculty office’s contact page is on its university’s own domain',
  })
  .refine((o) => o.id.startsWith(`${o.universityId}-`), {
    message: 'A faculty office id starts with its university id',
  })
  .refine((o) => o.campusId === undefined || o.campusId.startsWith(`${o.universityId}-`), {
    message: 'A faculty office is on one of its own university’s campuses',
  });
export type FacultyOffice = z.infer<typeof facultyOfficeSchema>;

/** A run of days, first and last inclusive (ISO dates). */
export const dateRangeSchema = z
  .object({ from: isoDate, to: isoDate })
  .refine((r) => r.from <= r.to, { message: 'A date range starts before it ends' });
export type DateRange = z.infer<typeof dateRangeSchema>;

/**
 * First-year registration. Some universities publish only the closing date: then `from` is left
 * out, never filled with a nearby date (a guessed opening date is still a guess).
 */
export const registrationWindowSchema = z
  .object({ from: isoDate.optional(), to: isoDate })
  .refine((r) => r.from === undefined || r.from <= r.to, {
    message: 'A date range starts before it ends',
  });
export type RegistrationWindow = z.infer<typeof registrationWindowSchema>;

/**
 * Which modules a change deadline is for, as published: `all` when the university gives one date,
 * otherwise per semester (S1, S2), for year-long modules (Y), or per quarter.
 */
export const CHANGE_DEADLINE_SCOPES = ['all', ...MODULE_TERMS] as const;

export const registrationCalendarSchema = sourced({
  universityId,
  /** First-year registration, as published (the whole window, all faculties; maybe only its close). */
  firstYearRegistration: registrationWindowSchema,
  /**
   * The last day to add, drop or change modules, as published. Empty when the calendar prints
   * none (gotcha 40: UJ's 2027 calendar prints registration but no change deadline); the screens
   * and the checklist then say it isn't published, and the registration check shows no date.
   */
  changeDeadlines: z.array(
    z.object({ appliesTo: z.enum(CHANGE_DEADLINE_SCOPES), lastDay: isoDate }),
  ),
  /** Orientation (first-year welcome) week, when published. */
  orientation: dateRangeSchema.optional(),
  /** Something research could not settle (e.g. faculties that register on other days). */
  note: z.string().min(3).optional(),
})
  .refine(onOwnSite, OWN_SITE)
  .refine(
    (c) => new Set(c.changeDeadlines.map((d) => d.appliesTo)).size === c.changeDeadlines.length,
    { message: 'One change deadline per scope' },
  )
  .refine(
    (c) =>
      [
        ...(c.firstYearRegistration.from ? [c.firstYearRegistration.from] : []),
        c.firstYearRegistration.to,
        ...(c.orientation ? [c.orientation.from, c.orientation.to] : []),
        ...c.changeDeadlines.map((d) => d.lastDay),
      ].every((d) => {
        const year = Number(d.slice(0, 4));
        return year === c.academicYear || year === c.academicYear - 1;
      }),
    { message: 'Registration dates fall in the academic year (or the end of the year before)' },
  )
  .refine(
    (c) =>
      c.changeDeadlines.every(
        (d) => d.lastDay >= (c.firstYearRegistration.from ?? c.firstYearRegistration.to),
      ),
    // Without a published opening date, the close is the only anchor: a change deadline before
    // registration even closes would be odd enough to need a person's eye.
    { message: 'A change deadline falls after registration opens' },
  );
export type RegistrationCalendar = z.infer<typeof registrationCalendarSchema>;
