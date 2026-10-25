#!/usr/bin/env node
/**
 * The course cards' pictures (cards8), made from the owner's Unsplash downloads:
 *
 *   node scripts/assets/generate-course-art.mjs [folder with the originals]
 *
 * The originals stay out of git (the owner keeps them in the main checkout's photos/course-cards/,
 * the default folder; photos/ is git-ignored). Which photo each field uses, and its photographer,
 * is apps/web/lib/course-art.ts (read here directly: Node strips its types). For every field it
 * writes, into
 * apps/web/public/course-art/, a 2:1 crop at 400 and 800 px wide, as AVIF and WebP, each under
 * the budget test/course-art.test.ts holds (encode-card-art.mjs). Re-run after changing a photo;
 * then update CREDITS.md beside them.
 */
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  COURSE_ART,
  COURSE_ART_FORMATS,
  COURSE_ART_WIDTHS,
} from '../../apps/web/lib/course-art.ts';
import { encodeCardArt } from './encode-card-art.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
await encodeCardArt(COURSE_ART, {
  from: resolve(process.argv[2] ?? join(root, 'photos', 'course-cards')),
  out: join(root, 'apps', 'web', 'public', 'course-art'),
  widths: COURSE_ART_WIDTHS,
  formats: COURSE_ART_FORMATS,
});
