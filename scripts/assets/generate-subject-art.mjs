#!/usr/bin/env node
/**
 * The school subjects' own pictures (cards9), made from the owner's Unsplash downloads:
 *
 *   node scripts/assets/generate-subject-art.mjs [folder with the originals]
 *
 * The same as generate-course-art.mjs, for apps/web/lib/subject-pictures.ts into
 * apps/web/public/subject-art/ (a subject that borrows a course field's picture needs no file of
 * its own). Re-run after changing a photo; then update CREDITS.md beside them.
 */
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { COURSE_ART_FORMATS, COURSE_ART_WIDTHS } from '../../apps/web/lib/course-art.ts';
import { SUBJECT_PICTURES } from '../../apps/web/lib/subject-pictures.ts';
import { encodeCardArt } from './encode-card-art.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
await encodeCardArt(SUBJECT_PICTURES, {
  from: resolve(process.argv[2] ?? join(root, 'photos', 'subject-cards')),
  out: join(root, 'apps', 'web', 'public', 'subject-art'),
  widths: COURSE_ART_WIDTHS,
  formats: COURSE_ART_FORMATS,
});
