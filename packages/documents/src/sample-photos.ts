import sharp from 'sharp';
import {
  InvalidPhotoError,
  PHOTO_EDGE,
  PHOTO_QUALITY,
  type PhotoCropBox,
  type PreparedPhoto,
  prepareProfilePhoto,
} from './profile-photo';

/**
 * The judge demo's SAMPLE profile photos (owner's decision, 2026-10-23; docs/deploy/demo.md).
 * A demo takes no real photo, so no real person's picture is ever stored: a judge picks one of
 * these instead. Each is drawn here, in code, from flat shapes (a ground, a body, a head, hair):
 * an illustration of nobody, never a photograph and never an AI-made face. Each carries a dark
 * plate with "SAMPLE" in the bottom-right corner, drawn as lines so it needs no font.
 *
 * They are rendered by `sharp` (librsvg) when asked: the demo serves the colour picture to the
 * picker (`samplePhotoPng`) and keeps one through the same pipeline as an upload
 * (`prepareSamplePhoto`): the judge's crop, 512 × 512, black and white, no metadata. The mark is
 * stamped again after the crop, so no crop can take it off. Server-only: `sharp` is native.
 */

export const SAMPLE_PHOTO_IDS = [
  'sample-1',
  'sample-2',
  'sample-3',
  'sample-4',
  'sample-5',
  'sample-6',
] as const;

export type SamplePhotoId = (typeof SAMPLE_PHOTO_IDS)[number];

export function isSamplePhotoId(value: unknown): value is SamplePhotoId {
  return typeof value === 'string' && (SAMPLE_PHOTO_IDS as ReadonlyArray<string>).includes(value);
}

/** Where the mark sits, in pixels of a 512 × 512 picture. */
export const SAMPLE_MARK_BOX = { left: 358, top: 460, width: 142, height: 40 } as const;

/** "SAMPLE" in strokes, each letter in a 16 × 24 cell. */
const LETTERS = [
  'M16 0H0V12H16V24H0', // S
  'M0 24V0H16V24M0 12H16', // A
  'M0 24V0L8 12L16 0V24', // M
  'M0 24V0H16V12H0', // P
  'M0 0V24H16', // L
  'M16 0H0V24H16M0 12H12', // E
];

/** The plate and its letters, on a transparent 512 × 512. */
function markShapes(): string {
  const { left, top, width, height } = SAMPLE_MARK_BOX;
  const letters = LETTERS.map(
    (d, i) => `<path transform="translate(${left + 8 + i * 22} ${top + 8})" d="${d}"/>`,
  ).join('');
  return (
    `<rect x="${left}" y="${top}" width="${width}" height="${height}" rx="6" fill="#111111"/>` +
    `<g fill="none" stroke="#ffffff" stroke-width="4" stroke-linecap="square">${letters}</g>`
  );
}

const svg = (body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${PHOTO_EDGE}" height="${PHOTO_EDGE}" viewBox="0 0 512 512">${body}</svg>`;

interface Figure {
  readonly ground: string;
  readonly jacket: string;
  readonly skin: string;
  readonly hair: string;
  /** Anything on top: glasses, a headwrap, a cap, curls. */
  readonly extra: string;
}

/** The six figures. Plain shapes; the words for each are in packages/content (`demo.samplePhotos`). */
const FIGURES: Record<SamplePhotoId, Figure> = {
  // A figure in a blue jacket on a yellow ground.
  'sample-1': {
    ground: '#f2c94c',
    jacket: '#2f5fb3',
    skin: '#8d5a3b',
    hair: '#1d1410',
    extra: '<path d="M196 168Q256 104 316 168L316 150Q256 92 196 150Z" fill="#1d1410"/>',
  },
  // Round glasses and a green jumper on a pink ground.
  'sample-2': {
    ground: '#f4a7b9',
    jacket: '#2e8b57',
    skin: '#c68863',
    hair: '#3b2416',
    extra:
      '<g fill="none" stroke="#111111" stroke-width="6"><circle cx="230" cy="200" r="18"/><circle cx="282" cy="200" r="18"/><path d="M248 200H264"/></g>',
  },
  // A red hoodie on a teal ground.
  'sample-3': {
    ground: '#3aa6a0',
    jacket: '#c0392b',
    skin: '#5c3a26',
    hair: '#0f0b08',
    extra:
      '<path d="M160 250Q160 110 256 110Q352 110 352 250L330 250Q330 140 256 140Q182 140 182 250Z" fill="#c0392b"/>',
  },
  // A headband and an orange top on a purple ground.
  'sample-4': {
    ground: '#6c4ab6',
    jacket: '#e67e22',
    skin: '#a0674b',
    hair: '#2a1a12',
    extra: '<path d="M176 170Q256 60 336 170Q296 136 256 136Q216 136 176 170Z" fill="#f1c40f"/>',
  },
  // Short curls and a purple jacket on a mint ground.
  'sample-5': {
    ground: '#9ee6c3',
    jacket: '#7d3c98',
    skin: '#e0ac86',
    hair: '#221a14',
    extra:
      '<g fill="#221a14"><circle cx="206" cy="150" r="22"/><circle cx="240" cy="132" r="24"/><circle cx="276" cy="132" r="24"/><circle cx="308" cy="150" r="22"/></g>',
  },
  // A cap and a grey blazer on a coral ground.
  'sample-6': {
    ground: '#ff7f6e',
    jacket: '#5d6d7e',
    skin: '#704530',
    hair: '#1a120d',
    extra:
      '<path d="M184 166Q186 112 256 110Q326 112 328 166Z" fill="#1f3a5f"/><path d="M300 160H370Q366 176 300 176Z" fill="#1f3a5f"/>',
  },
};

/** The drawing, with its mark: an SVG string, no font, no image, no link. */
export function samplePhotoSvg(id: SamplePhotoId): string {
  const f = FIGURES[id];
  return svg(
    `<rect width="512" height="512" fill="${f.ground}"/>` +
      // Shoulders and body.
      `<path d="M96 512Q96 330 256 318Q416 330 416 512Z" fill="${f.jacket}"/>` +
      // Neck and head.
      `<rect x="232" y="250" width="48" height="76" rx="18" fill="${f.skin}"/>` +
      `<ellipse cx="256" cy="200" rx="72" ry="84" fill="${f.skin}"/>` +
      // Hair across the top of the head.
      `<path d="M184 196Q178 112 256 112Q334 112 328 196Q316 150 256 146Q196 150 184 196Z" fill="${f.hair}"/>` +
      f.extra +
      markShapes(),
  );
}

/** The colour picture, 512 × 512, for the picker. */
export async function samplePhotoPng(id: SamplePhotoId): Promise<Uint8Array> {
  return new Uint8Array(
    await sharp(Buffer.from(samplePhotoSvg(id)))
      .png()
      .toBuffer(),
  );
}

/**
 * A sample kept as a profile photo: the judge's crop through the upload pipeline
 * (`prepareProfilePhoto`), then the mark stamped again so it is always there.
 */
export async function prepareSamplePhoto(
  id: SamplePhotoId,
  box: PhotoCropBox,
): Promise<PreparedPhoto> {
  if (!isSamplePhotoId(id)) throw new InvalidPhotoError('unreadable');
  const cropped = await prepareProfilePhoto(await samplePhotoPng(id), box);
  const stamped = await sharp(cropped.bytes)
    .composite([{ input: Buffer.from(svg(markShapes())) }])
    .greyscale()
    .toColourspace('b-w')
    .jpeg({ quality: PHOTO_QUALITY })
    .toBuffer();
  return { bytes: new Uint8Array(stamped), mimeType: 'image/jpeg' };
}
