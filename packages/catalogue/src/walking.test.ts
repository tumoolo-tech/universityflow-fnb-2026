import { describe, expect, it } from 'vitest';
import {
  appleWalkingLink,
  MAX_LINK_LENGTH,
  type MapLocation,
  streetViewLink,
  walkingLink,
} from './basics';

/**
 * "Walk there" and "See it" (planning.md §11, Phase 5e-1): links that hand the destination to the
 * phone's own maps app, which finds "here" itself. Property tests over generated locations, with a
 * seeded generator so a failure can be replayed (no extra dependency).
 */

/** A small seeded generator (mulberry32): the same seed gives the same locations. */
function random(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Characters a published building name or a hostile string could hold. */
const ALPHABET = [
  ...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
  ...' ,.-’\'"&=?#/%+;:@()[]{}<>\\|',
  'é',
  'ñ',
  'ŋ',
  '–',
  '🏫',
  '\n',
  '\t',
];

function generatedLocations(count: number, seed = 20261019): MapLocation[] {
  const next = random(seed);
  const pick = <T>(items: ReadonlyArray<T>): T => items[Math.floor(next() * items.length)] as T;
  const text = (max: number) => {
    let s = '';
    const length = 3 + Math.floor(next() * max);
    for (let i = 0; i < length; i += 1) s += pick(ALPHABET);
    // A query is published text: never blank once trimmed.
    return s.trim().length >= 3 ? s : `Hall ${s}`;
  };
  const coordinates = () => ({
    lat: Number((-35 + next() * 13).toFixed(6)),
    lng: Number((16 + next() * 17).toFixed(6)),
  });
  return Array.from({ length: count }, () => {
    const shape = Math.floor(next() * 3);
    if (shape === 0) return { query: text(next() < 0.1 ? 3000 : 120) };
    if (shape === 1) return { coordinates: coordinates() };
    return { query: text(120), coordinates: coordinates() };
  });
}

const LOCATIONS = generatedLocations(400);
const destinationOf = (l: MapLocation) =>
  l.coordinates ? `${l.coordinates.lat},${l.coordinates.lng}` : (l.query?.trim() ?? '');

/** Every way a maps link could carry a starting point: none may appear. */
const ORIGIN_PARAMS = ['origin', 'origin_place_id', 'saddr', 'source', 'sll', 'start'];

describe('walking and Street View links: properties over generated locations', () => {
  it('generates every shape, including some too long to link', () => {
    expect(LOCATIONS.some((l) => l.query && !l.coordinates)).toBe(true);
    expect(LOCATIONS.some((l) => l.coordinates && !l.query)).toBe(true);
    expect(LOCATIONS.some((l) => l.coordinates && l.query)).toBe(true);
    expect(LOCATIONS.some((l) => walkingLink(l) === null)).toBe(true);
  });

  it.each([
    ['Google walking', walkingLink, 'https://www.google.com/maps/dir/', 'destination'],
    ['Apple walking', appleWalkingLink, 'https://maps.apple.com/directions', 'destination'],
  ] as const)(
    '%s: the destination only, walking, encoded, within the limit',
    (_n, build, base, param) => {
      for (const location of LOCATIONS) {
        const link = build(location);
        const expected = destinationOf(location);
        if (link === null) {
          // Only a link that would be too long is withheld (each base is under 100 characters).
          expect(encodeURIComponent(expected).length).toBeGreaterThan(MAX_LINK_LENGTH - 100);
          continue;
        }
        expect(link.length).toBeLessThanOrEqual(MAX_LINK_LENGTH);
        expect(link.startsWith(`${base}?`)).toBe(true);
        const url = new URL(link);
        expect(url.searchParams.get(param)).toBe(expected);
        for (const origin of ORIGIN_PARAMS) expect(url.searchParams.has(origin)).toBe(false);
        // Nothing unencoded: no space, no newline, no second "#" or "?".
        expect(link).not.toMatch(/[\s#]/);
        expect(link.indexOf('?')).toBe(link.lastIndexOf('?'));
        if (build === walkingLink) {
          expect(url.searchParams.get('api')).toBe('1');
          expect(url.searchParams.get('travelmode')).toBe('walking');
          expect(url.searchParams.get('dir_action')).toBe('navigate');
        } else {
          expect(url.searchParams.get('mode')).toBe('walking');
        }
      }
    },
  );

  it('Street View: only with coordinates, at them, never a search or an origin', () => {
    for (const location of LOCATIONS) {
      const link = streetViewLink(location);
      if (!location.coordinates) {
        expect(link).toBeNull();
        continue;
      }
      expect(link).not.toBeNull();
      const url = new URL(link as string);
      expect(`${url.origin}${url.pathname}`).toBe('https://www.google.com/maps/@');
      expect(url.searchParams.get('api')).toBe('1');
      expect(url.searchParams.get('map_action')).toBe('pano');
      expect(url.searchParams.get('viewpoint')).toBe(
        `${location.coordinates.lat},${location.coordinates.lng}`,
      );
      for (const origin of ORIGIN_PARAMS) expect(url.searchParams.has(origin)).toBe(false);
      expect(url.searchParams.has('query')).toBe(false);
      expect((link as string).length).toBeLessThanOrEqual(MAX_LINK_LENGTH);
    }
  });

  it('no location published: no link of any kind', () => {
    expect(walkingLink(undefined)).toBeNull();
    expect(appleWalkingLink(undefined)).toBeNull();
    expect(streetViewLink(undefined)).toBeNull();
  });

  it('a location with nothing to go to is refused, as the maps link refuses it', () => {
    expect(() => walkingLink({})).toThrow(RangeError);
    expect(() => appleWalkingLink({ query: '  ' })).toThrow(RangeError);
  });
});

describe('walking and Street View links: examples', () => {
  const at = { query: 'Test Hall & Co, Testville', coordinates: { lat: -26.19, lng: 28.03 } };

  it('Google walking directions, coordinates first (they can’t match the wrong building)', () => {
    expect(walkingLink(at)).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=-26.19%2C28.03&travelmode=walking&dir_action=navigate',
    );
    expect(walkingLink({ query: 'Test Hall & Co, Testville' })).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=Test%20Hall%20%26%20Co%2C%20Testville&travelmode=walking&dir_action=navigate',
    );
  });

  it('Apple walking directions (iOS 18.4 and later)', () => {
    expect(appleWalkingLink(at)).toBe(
      'https://maps.apple.com/directions?destination=-26.19%2C28.03&mode=walking',
    );
    expect(appleWalkingLink({ query: 'Test Hall' })).toBe(
      'https://maps.apple.com/directions?destination=Test%20Hall&mode=walking',
    );
  });

  it('Street View of the spot', () => {
    expect(streetViewLink(at)).toBe(
      'https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=-26.19%2C28.03',
    );
    expect(streetViewLink({ query: 'Test Hall' })).toBeNull();
  });

  it('withholds a link longer than 2,048 characters rather than send a cut one', () => {
    expect(MAX_LINK_LENGTH).toBe(2048);
    const long = { query: `Test Hall ${'a'.repeat(2100)}` };
    expect(walkingLink(long)).toBeNull();
    expect(appleWalkingLink(long)).toBeNull();
    // Right at the limit still links.
    const base = walkingLink({ query: 'abc' }) as string;
    const fits = { query: 'a'.repeat(MAX_LINK_LENGTH - base.length + 3) };
    expect(walkingLink(fits)?.length).toBe(MAX_LINK_LENGTH);
    expect(walkingLink({ query: `${fits.query}a` })).toBeNull();
  });
});
