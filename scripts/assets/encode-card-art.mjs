/**
 * How a card's picture is made from one of the owner's Unsplash downloads (cards8, shared with
 * cards9): a 2:1 crop at every width, as AVIF and WebP, each under the budget the tests hold (30 KB
 * at 400, 60 KB at 800): the quality steps down until it fits. EXIF and other metadata are dropped.
 * Used by generate-course-art.mjs and generate-subject-art.mjs.
 */
import { mkdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

/** Under the tests' budget, with a little room: 26 KB at 400 px, 54 KB at 800 px. */
const TARGET = { 400: 26 * 1024, 800: 54 * 1024 };
const START = { avif: 50, webp: 70 };

/**
 * @param {Record<string, { source: string }>} pictures name -> the original's file name
 * @param {{ from: string, out: string, widths: readonly number[], formats: readonly string[] }} where
 */
export async function encodeCardArt(pictures, { from, out, widths, formats }) {
  mkdirSync(out, { recursive: true });
  for (const [name, { source }] of Object.entries(pictures)) {
    for (const width of widths) {
      for (const format of formats) {
        const file = join(out, `${name}-${width}.${format}`);
        for (let quality = START[format]; ; quality -= 5) {
          if (quality < 20) throw new Error(`${file} won't fit ${TARGET[width]} bytes`);
          await sharp(join(from, source))
            .rotate()
            .resize(width, width / 2, { fit: 'cover', position: sharp.strategy.attention })
            [format]({ quality, effort: 6 })
            .toFile(file);
          const size = statSync(file).size;
          if (size <= TARGET[width]) {
            console.log(`${name}-${width}.${format}  q${quality}  ${(size / 1024).toFixed(1)} KB`);
            break;
          }
        }
      }
    }
  }
}
