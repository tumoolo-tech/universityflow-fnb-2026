/**
 * Plain values the records use and the screens show. No zod and no records here: browsers and
 * the phone app load this through `@universityflow/catalogue/client` (audit A4-02).
 */

export const PROVINCES = [
  'Eastern Cape',
  'Free State',
  'Gauteng',
  'KwaZulu-Natal',
  'Limpopo',
  'Mpumalanga',
  'North West',
  'Northern Cape',
  'Western Cape',
] as const;

/** A number a person can dial: digits only, with a leading + kept. */
export function dialable(value: string): string {
  return value.replace(/[^\d+]/g, '');
}

/** What a place on campus is for (planning.md §11, Phase 5b), so the tour can group by need. */
export const PLACE_KINDS = [
  'registration-venue',
  'library',
  'computer-lab',
  'food',
  'clinic',
  'counselling',
  'security',
  'financial-aid',
  'disability-unit',
  'residence-office',
  'transport',
  'other',
] as const;
export type PlaceKind = (typeof PLACE_KINDS)[number];

/**
 * Safety records: a learner may need these in a crisis, so they are treated like helplines. The
 * catalogue view returns one only once a person has verified it, even in preview mode, and the
 * owner re-checks them every release (planning.md §11, Phase 5b, decision 5).
 */
export const SAFETY_PLACE_KINDS = ['clinic', 'counselling', 'security'] as const;
export type SafetyPlaceKind = (typeof SAFETY_PLACE_KINDS)[number];

export function isSafetyPlaceKind(kind: PlaceKind): kind is SafetyPlaceKind {
  return (SAFETY_PLACE_KINDS as ReadonlyArray<PlaceKind>).includes(kind);
}

/**
 * Where a place is, for "open in maps": what to search for, coordinates, or both, as the
 * university publishes them. A validated place always has at least one.
 */
export interface MapLocation {
  readonly query?: string | undefined;
  readonly coordinates?: { readonly lat: number; readonly lng: number } | undefined;
}

/**
 * The "open in maps" link for a place (owner's decision 2: link out, no embedded map, no tiles).
 *
 * A Google Maps URL (`https://www.google.com/maps/search/?api=1&query=…`) is Google's documented
 * cross-platform link: on Android it opens the Maps app, on an iPhone the Google Maps app when
 * installed and the browser otherwise, and on a computer the browser. It needs no API key, adds
 * no script, tile or CSP origin to our pages, and is a plain `https` link, so it works from the
 * web app, the phone app (Linking.openURL) and a WhatsApp or SMS message alike. Coordinates win
 * over the search text when both are given: they can't match the wrong building.
 */
export function mapsLink(location: MapLocation): string;
/** No location published (A13-11): no link, rather than a search for a guess. */
export function mapsLink(location: MapLocation | undefined): string | null;
export function mapsLink(location: MapLocation | undefined): string | null {
  if (location === undefined) return null;
  const { coordinates, query } = location;
  const search = coordinates ? `${coordinates.lat},${coordinates.lng}` : query?.trim();
  if (!search) throw new RangeError('A map location needs a search query or coordinates');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(search)}`;
}

/**
 * The same place as an Apple Maps link, for the phone app on an iPhone (audit A7-18): Apple's
 * documented `https://maps.apple.com/` link opens the Maps app every iPhone has, where the Google
 * link opens Google's website in Safari when Google Maps isn't installed. With coordinates the
 * pin goes there (`ll`) and `name` labels it; without, Maps searches the text. `mapsLink` stays
 * the link for Android, the web and messages. The app chooses between them; nothing here knows
 * which platform it runs on (hard rule 11).
 */
export function appleMapsLink(location: MapLocation, name?: string): string;
/** No location published (A13-11): no link. */
export function appleMapsLink(location: MapLocation | undefined, name?: string): string | null;
export function appleMapsLink(location: MapLocation | undefined, name?: string): string | null {
  if (location === undefined) return null;
  const { coordinates } = location;
  const query = location.query?.trim();
  if (coordinates) {
    const ll = `${coordinates.lat},${coordinates.lng}`;
    const label = name?.trim() || query || ll;
    return `https://maps.apple.com/?ll=${encodeURIComponent(ll)}&q=${encodeURIComponent(label)}`;
  }
  if (!query) throw new RangeError('A map location needs a search query or coordinates');
  return `https://maps.apple.com/?q=${encodeURIComponent(query)}`;
}

/**
 * The longest link we hand to a maps app, a browser or a message: 2,048 characters, the limit
 * older browsers and many link handlers keep to. A longer one is withheld, never cut (a cut link
 * points somewhere else); the integrity checks flag the record so a person shortens it.
 */
export const MAX_LINK_LENGTH = 2048;

/** What a directions link goes to: coordinates when published (they can't match the wrong building), else the text. */
function destination(location: MapLocation): string {
  const { coordinates, query } = location;
  const to = coordinates ? `${coordinates.lat},${coordinates.lng}` : query?.trim();
  if (!to) throw new RangeError('A map location needs a search query or coordinates');
  return encodeURIComponent(to);
}

const withinLimit = (link: string): string | null => (link.length <= MAX_LINK_LENGTH ? link : null);

/**
 * "Walk there" (planning.md §11, Phase 5e-1): Google's documented directions link, walking, with
 * `dir_action=navigate` so the phone's maps app starts turn-by-turn guidance, spoken and screen-
 * reader friendly. **Only the destination**: never an origin, so the maps app finds "here" itself
 * and our app and server never see where the learner is. No key, no script, no permission.
 * Null without a published location, or when the link would be over `MAX_LINK_LENGTH`.
 */
export function walkingLink(location: MapLocation | undefined): string | null {
  if (location === undefined) return null;
  return withinLimit(
    `https://www.google.com/maps/dir/?api=1&destination=${destination(location)}&travelmode=walking&dir_action=navigate`,
  );
}

/**
 * The same walk in Apple Maps, which the app offers beside Google's on an iPhone (owner's choice,
 * 2026-10-19). Apple's `directions` link, iOS 18.4 and later; destination only, never a source.
 */
export function appleWalkingLink(location: MapLocation | undefined): string | null {
  if (location === undefined) return null;
  return withinLimit(
    `https://maps.apple.com/directions?destination=${destination(location)}&mode=walking`,
  );
}

/**
 * "See it": Google Street View at the place's published coordinates, so the entrance looks
 * familiar before the learner arrives. Google's on every phone (Apple's Look Around has no South
 * African coverage). Only with coordinates: Street View has no search, and a guessed spot is
 * worse than none. Null otherwise.
 */
export function streetViewLink(location: MapLocation | undefined): string | null {
  const coordinates = location?.coordinates;
  if (!coordinates) return null;
  const viewpoint = encodeURIComponent(`${coordinates.lat},${coordinates.lng}`);
  return withinLimit(`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${viewpoint}`);
}

/**
 * When a registered module runs, as a proof of registration prints it: first or second semester,
 * the whole year, or a quarter (term) for universities that teach in blocks.
 */
export const MODULE_TERMS = ['S1', 'S2', 'Y', 'Q1', 'Q2', 'Q3', 'Q4'] as const;
export type ModuleTerm = (typeof MODULE_TERMS)[number];

/**
 * When a curriculum offers a module: a `ModuleTerm`, or `either` for a module the rule book
 * offers in both semesters, where the learner may take it in S1 or S2.
 */
export const OFFERED_TERMS = [...MODULE_TERMS, 'either'] as const;
export type OfferedTerm = (typeof OFFERED_TERMS)[number];

/** Whether a module offered in `offered` may be taken in `term`. */
export function offeredIn(offered: OfferedTerm, term: ModuleTerm): boolean {
  return offered === term || (offered === 'either' && (term === 'S1' || term === 'S2'));
}

/**
 * A module code as compared: upper case, no spaces ("comp 1011" and "COMP1011" are the same
 * module). Nothing else is changed: a hyphen or a letter suffix is part of the code.
 */
export function normaliseModuleCode(code: string): string {
  return code.replace(/\s+/g, '').toUpperCase();
}
