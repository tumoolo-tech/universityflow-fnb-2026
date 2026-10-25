import { readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * After `expo export`: fails if the export carries a font over 100 KB (A4-05). The app uses the
 * system font, so a large font in the export is a dependency's, shipped to every phone for
 * nothing (the Material Symbols font once added 944 KB to Android). Reads the export's
 * metadata.json, so it checks every platform that was exported.
 *
 *   node scripts/check-export.mjs [exportDir]   (default: dist)
 */

export const FONT_LIMIT_BYTES = 100 * 1024;
const FONT_EXTENSIONS = new Set(['ttf', 'otf', 'woff', 'woff2']);

/** Every font asset in the export over the limit, as `platform: path (size)`. */
export function largeFonts(exportDir) {
  const metadata = JSON.parse(readFileSync(join(exportDir, 'metadata.json'), 'utf8'));
  const found = [];
  for (const [platform, files] of Object.entries(metadata.fileMetadata ?? {})) {
    for (const asset of files.assets ?? []) {
      if (!FONT_EXTENSIONS.has(String(asset.ext).toLowerCase())) continue;
      const path = String(asset.path).replace(/\\/g, '/');
      const size = statSync(join(exportDir, path)).size;
      if (size > FONT_LIMIT_BYTES) found.push(`${platform}: ${path} (${asset.ext}, ${size} bytes)`);
    }
  }
  return found;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const exportDir = resolve(process.argv[2] ?? 'dist');
  const found = largeFonts(exportDir);
  if (found.length > 0) {
    console.error(
      `The export ships ${found.length} font(s) over ${FONT_LIMIT_BYTES / 1024} KB (A4-05):\n  ${found.join('\n  ')}`,
    );
    process.exit(1);
  }
  console.log('Export check: no font over 100 KB.');
}
