#!/usr/bin/env node
/**
 * PLACEHOLDER app artwork for apps/native (Phase 4d), generated from the design tokens: the
 * brand green with a "UF" monogram drawn from plain shapes (no font, so the output is the same on
 * every machine), nothing downloaded. **The owner replaces these with the final artwork before
 * the first store submission** (docs/store/release-checklist.md); apps/native/assets/README.md
 * says so too.
 *
 *   node scripts/assets/generate-app-icons.mjs
 *
 * Writes, into apps/native/assets/:
 * - icon.png (1024², opaque: the App Store refuses transparency)
 * - adaptive-icon.png (1024², transparent foreground; Android draws the brand colour behind it)
 * - splash-icon.png (1024², the monogram on a rounded tile; the splash screen is the canvas colour)
 * - notification-icon.png (96², white on transparent, as Android requires)
 *
 * And the web app's icons into apps/web/app/ (A4-09), the same artwork as icon.png. Next serves
 * them at /favicon.ico and /icon.png and links both from every page:
 * - favicon.ico (one 32² PNG in an ICO container)
 * - icon.png (192²)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const out = join(root, 'apps', 'native', 'assets');

/** A colour from packages/tokens, read from its source so there is one place it is defined. */
function token(name) {
  const source = readFileSync(join(root, 'packages', 'tokens', 'src', 'index.ts'), 'utf8');
  const match = source.match(new RegExp(`\\b${name}: '(#[0-9A-Fa-f]{6})'`));
  if (!match) throw new Error(`No colour token ${name}`);
  return match[1];
}

const BRAND = token('brand');
const ON_BRAND = token('onBrand');

/**
 * "UF" on a 1024 canvas, scaled about the centre: a U (two strokes and an arc) and an F (three
 * bars), 84 units thick, 420 tall.
 */
function monogram(colour, scale = 1) {
  const t = `translate(512 512) scale(${scale}) translate(-512 -512)`;
  return `<g transform="${t}" fill="${colour}">
    <path d="M284 302 V582 A98 98 0 0 0 480 582 V302" fill="none" stroke="${colour}" stroke-width="84"/>
    <path d="M582 302 H782 V386 H666 V474 H752 V552 H666 V722 H582 Z"/>
  </g>`;
}

const svg = (body, size = 1024) =>
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 1024 1024">${body}</svg>`,
  );

const files = {
  'icon.png': svg(`<rect width="1024" height="1024" fill="${BRAND}"/>${monogram(ON_BRAND)}`),
  // Android crops the adaptive foreground to its middle two thirds: keep the monogram inside.
  'adaptive-icon.png': svg(monogram(ON_BRAND, 0.62)),
  'splash-icon.png': svg(
    `<rect x="112" y="112" width="800" height="800" rx="176" fill="${BRAND}"/>${monogram(ON_BRAND, 0.78)}`,
  ),
  'notification-icon.png': svg(monogram('#FFFFFF', 1.1), 96), // check-ignore: Android requires white
};

for (const [name, source] of Object.entries(files)) {
  const size = name === 'notification-icon.png' ? 96 : 1024;
  let image = sharp(source).resize(size, size);
  if (name === 'icon.png') image = image.flatten({ background: BRAND }).removeAlpha();
  await image.png({ compressionLevel: 9 }).toFile(join(out, name));
  console.log(`wrote apps/native/assets/${name}`);
}

const web = join(root, 'apps', 'web', 'app');
const webIcon = (size, { rgba = false } = {}) => {
  const image = sharp(files['icon.png']).resize(size, size).flatten({ background: BRAND });
  // A PNG inside an ICO must be RGBA (opaque here), or decoders refuse it.
  return (rgba ? image.ensureAlpha(1) : image.removeAlpha())
    .png({ compressionLevel: 9 })
    .toBuffer();
};

// ICO: an ICONDIR (reserved, type 1 = icon, one image), one ICONDIRENTRY, then the PNG itself.
const png32 = await webIcon(32, { rgba: true });
const header = Buffer.alloc(22);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(1, 4);
header.writeUInt8(32, 6); // width
header.writeUInt8(32, 7); // height
header.writeUInt8(0, 8); // no palette
header.writeUInt8(0, 9); // reserved
header.writeUInt16LE(1, 10); // colour planes
header.writeUInt16LE(32, 12); // bits per pixel
header.writeUInt32LE(png32.length, 14); // image size
header.writeUInt32LE(22, 18); // image offset
writeFileSync(join(web, 'favicon.ico'), Buffer.concat([header, png32]));
console.log('wrote apps/web/app/favicon.ico');
writeFileSync(join(web, 'icon.png'), await webIcon(192));
console.log('wrote apps/web/app/icon.png');
