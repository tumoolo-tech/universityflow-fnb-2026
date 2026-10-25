import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { RAW_CATALOGUE } from '@universityflow/catalogue';
import { describe, expect, it } from 'vitest';
import {
  COURSE_ART,
  COURSE_ART_FORMATS,
  COURSE_ART_WIDTHS,
  COURSE_FIELDS,
  courseArt,
  courseField,
} from '../lib/course-art';

/**
 * The course cards' pictures (cards8): which picture a course gets, and that every picture is on
 * disk, small, credited, and one the owner may use.
 */

const ART = join(__dirname, '..', 'public', 'course-art');
/** Performance budget per file (CLAUDE.md launch standard): a card's picture never costs more. */
const MAX_BYTES = { 400: 30 * 1024, 800: 60 * 1024 } as const;

describe('course field', () => {
  it.each(RAW_CATALOGUE.programmes.map((p) => [p.id, p] as const))(
    'gives %s a field of its own, not the default',
    (_id, programme) => {
      expect(courseField(programme)).not.toBe('general');
    },
  );

  it.each([...new Set(RAW_CATALOGUE.programmes.map((p) => p.faculty))])(
    'gives the faculty "%s" a field of its own',
    (faculty) => {
      expect(courseField({ name: '', faculty })).not.toBe('general');
    },
  );

  it.each([
    ['Bachelor of Arts', 'Humanities', 'arts'],
    ['Bachelor of Social Work', 'Humanities', 'social'],
    ['Bachelor of Arts or Social Science (Extended Programme)', 'Humanities', 'social'],
    ['Bachelor of Science in Engineering in Civil Engineering', 'Engineering', 'engineering'],
    ['Bachelor of Medicine and Bachelor of Surgery (MBChB)', 'Health Sciences', 'health'],
    ['Bachelor of Nursing Science', 'Health Sciences', 'health'],
    ['Bachelor of Laws (LLB)', 'Commerce, Law and Management', 'law'],
    ['Bachelor of Accounting Science (Chartered Accountant route)', 'Commerce', 'commerce'],
    ['Diploma in Hospitality Management', 'Management Sciences', 'commerce'],
    ['Bachelor of Education in Foundation Phase Teaching', 'Education', 'education'],
    [
      'Bachelor of Science in Computer Science',
      'Engineering, Built Environment and Information Technology',
      'computing',
    ],
    ['Bachelor of Science (four-year programme): Geoinformatics, Geology', 'Science', 'science'],
  ] as const)('reads "%s" (%s) as %s', (name, faculty, field) => {
    expect(courseField({ name, faculty })).toBe(field);
  });

  it('falls back to its faculty, then to the neutral picture for a field it doesn’t know', () => {
    expect(courseField({ name: 'Bachelor of Something New', faculty: 'Law' })).toBe('law');
    expect(courseField({ name: 'Higher Certificate', faculty: 'Unknown' })).toBe('general');
  });
});

describe('course art files', () => {
  it('names a picture for every field, the default included', () => {
    expect(Object.keys(COURSE_ART).sort()).toEqual([...COURSE_FIELDS].sort());
  });

  it('uses only the owner’s Unsplash downloads, never a photo of a real learner or a campus', () => {
    for (const { source, unsplashId } of Object.values(COURSE_ART)) {
      expect(source).toMatch(/-unsplash\.jpg$/);
      expect(source).toContain(unsplashId);
    }
    const sources = Object.values(COURSE_ART).map((a) => a.source);
    expect(new Set(sources).size).toBe(sources.length);
  });

  it.each(
    COURSE_FIELDS.flatMap((field) =>
      COURSE_ART_WIDTHS.flatMap((width) =>
        COURSE_ART_FORMATS.map((format) => [`${field}-${width}.${format}`, width] as const),
      ),
    ),
  )('ships %s within its budget', (name, width) => {
    const path = join(ART, name);
    expect(existsSync(path), name).toBe(true);
    expect(statSync(path).size).toBeLessThanOrEqual(MAX_BYTES[width]);
  });

  it('ships nothing else but the credits', () => {
    const expected = COURSE_FIELDS.flatMap((field) =>
      COURSE_ART_WIDTHS.flatMap((w) => COURSE_ART_FORMATS.map((f) => `${field}-${w}.${f}`)),
    );
    expect(readdirSync(ART).sort()).toEqual([...expected, 'CREDITS.md'].sort());
  });

  it('credits every photographer and links every photo in CREDITS.md', () => {
    const credits = readFileSync(join(ART, 'CREDITS.md'), 'utf8');
    for (const { photographer, unsplashId } of Object.values(COURSE_ART)) {
      expect(credits).toContain(photographer);
      expect(credits).toContain(`https://unsplash.com/photos/${unsplashId}`);
    }
  });

  it('points a card at same-origin static files, AVIF first then WebP', () => {
    const art = courseArt({ name: 'Bachelor of Arts', faculty: 'Humanities' });
    expect(art.field).toBe('arts');
    expect(art.avifSrcSet).toBe('/course-art/arts-400.avif 400w, /course-art/arts-800.avif 800w');
    expect(art.webpSrcSet).toBe('/course-art/arts-400.webp 400w, /course-art/arts-800.webp 800w');
    expect(art.src).toBe('/course-art/arts-800.webp');
  });
});
