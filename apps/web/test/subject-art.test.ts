import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { RAW_CATALOGUE } from '@universityflow/catalogue';
import { SUBJECTS } from '@universityflow/catalogue/client';
import { describe, expect, it } from 'vitest';
import {
  COURSE_ART,
  COURSE_ART_FORMATS,
  COURSE_ART_WIDTHS,
  COURSE_FIELDS,
  moduleArt,
  programmeArt,
} from '../lib/course-art';
import { SUBJECT_ART, SUBJECTS_AWAITING_PICTURE, subjectArt } from '../lib/subject-art';
import { SUBJECT_PICTURES } from '../lib/subject-pictures';

/**
 * The pictures on more cards (cards9): every school subject on My subjects, every offer on My
 * offers, and what Phase 6's module cards will use. Which picture each gets, and that every new
 * picture is on disk, small, credited and one the owner may use.
 */

const ART = join(__dirname, '..', 'public', 'subject-art');
/** The same per-file budget as the course cards' pictures (test/course-art.test.ts). */
const MAX_BYTES = { 400: 30 * 1024, 800: 60 * 1024 } as const;
const PICTURES = Object.keys(SUBJECT_PICTURES);

describe('subject picture', () => {
  it.each(SUBJECTS.map((s) => [s.id] as const))(
    'gives %s a picture of its own or lists it as awaiting one',
    (id) => {
      const mapped = id in SUBJECT_ART;
      const awaiting = SUBJECTS_AWAITING_PICTURE.includes(id);
      // Exactly one: a subject is never silently left on the default.
      expect(mapped !== awaiting).toBe(true);
    },
  );

  it('lists as awaiting only real subjects, each once', () => {
    const ids = new Set<string>(SUBJECTS.map((s) => s.id));
    for (const id of SUBJECTS_AWAITING_PICTURE) expect(ids.has(id)).toBe(true);
    expect(new Set(SUBJECTS_AWAITING_PICTURE).size).toBe(SUBJECTS_AWAITING_PICTURE.length);
  });

  it.each([
    ['mathematics', '/subject-art/mathematics-800.webp'],
    ['mathematical-literacy', '/subject-art/mathematical-literacy-800.webp'],
    ['life-sciences', '/subject-art/life-sciences-800.webp'],
    ['physical-sciences', '/course-art/science-800.webp'],
    ['information-technology', '/course-art/computing-800.webp'],
    ['geography', '/course-art/social-800.webp'],
    ['accounting', '/course-art/engineering-800.webp'],
    ['economics', '/course-art/commerce-800.webp'],
    ['visual-arts', '/course-art/arts-800.webp'],
    ['english-hl', '/course-art/general-800.webp'],
    ['isizulu-fal', '/course-art/general-800.webp'],
  ] as const)('shows %s with %s', (id, src) => {
    expect(subjectArt(id).src).toBe(src);
  });

  it('falls back to the neutral library for a subject awaiting a picture, or one it doesn’t know', () => {
    expect(subjectArt('history').src).toBe('/course-art/general-800.webp');
    expect(subjectArt('not-a-subject').src).toBe('/course-art/general-800.webp');
  });

  it('points at same-origin static files, AVIF first then WebP', () => {
    const art = subjectArt('mathematics');
    expect(art.avifSrcSet).toBe(
      '/subject-art/mathematics-400.avif 400w, /subject-art/mathematics-800.avif 800w',
    );
    expect(art.webpSrcSet).toBe(
      '/subject-art/mathematics-400.webp 400w, /subject-art/mathematics-800.webp 800w',
    );
  });

  it('every subject picture is used by a subject, and every course field it borrows exists', () => {
    const used = new Set<string>();
    for (const key of Object.values(SUBJECT_ART)) {
      if ('picture' in key) used.add(key.picture);
      else expect(COURSE_FIELDS).toContain(key.field);
    }
    expect([...used].sort()).toEqual([...PICTURES].sort());
  });
});

describe('offer and module pictures', () => {
  it('gives an offer its course’s field picture, by programme', () => {
    const civil = RAW_CATALOGUE.programmes.find((p) => p.id === 'uj-beng-civil');
    if (!civil) throw new Error('fixture programme missing');
    expect(programmeArt(civil).src).toBe('/course-art/engineering-800.webp');
  });

  it('falls back to the neutral library when the catalogue no longer holds the course', () => {
    expect(programmeArt(null).src).toBe('/course-art/general-800.webp');
  });

  it('gives a module its programme’s field picture (Phase 6 module cards)', () => {
    expect(moduleArt({ programme: { name: 'Bachelor of Laws (LLB)', faculty: 'Law' } }).src).toBe(
      '/course-art/law-800.webp',
    );
    expect(moduleArt({ programme: null }).src).toBe('/course-art/general-800.webp');
  });
});

describe('subject art files', () => {
  it('uses only the owner’s Unsplash downloads, none a course card already uses', () => {
    const courseSources = new Set(Object.values(COURSE_ART).map((a) => a.source));
    const sources = Object.values(SUBJECT_PICTURES).map((a) => a.source);
    for (const { source, unsplashId } of Object.values(SUBJECT_PICTURES)) {
      expect(source).toMatch(/-unsplash\.jpg$/);
      expect(source).toContain(unsplashId);
      expect(courseSources.has(source)).toBe(false);
    }
    expect(new Set(sources).size).toBe(sources.length);
  });

  it.each(
    PICTURES.flatMap((name) =>
      COURSE_ART_WIDTHS.flatMap((width) =>
        COURSE_ART_FORMATS.map((format) => [`${name}-${width}.${format}`, width] as const),
      ),
    ),
  )('ships %s within its budget', (name, width) => {
    const path = join(ART, name);
    expect(existsSync(path), name).toBe(true);
    expect(statSync(path).size).toBeLessThanOrEqual(MAX_BYTES[width]);
  });

  it('ships nothing else but the credits', () => {
    const expected = PICTURES.flatMap((name) =>
      COURSE_ART_WIDTHS.flatMap((w) => COURSE_ART_FORMATS.map((f) => `${name}-${w}.${f}`)),
    );
    expect(readdirSync(ART).sort()).toEqual([...expected, 'CREDITS.md'].sort());
  });

  it('credits every photographer and links every photo in CREDITS.md', () => {
    const credits = readFileSync(join(ART, 'CREDITS.md'), 'utf8');
    for (const { photographer, unsplashId } of Object.values(SUBJECT_PICTURES)) {
      expect(credits).toContain(photographer);
      expect(credits).toContain(`https://unsplash.com/photos/${unsplashId}`);
    }
  });
});
