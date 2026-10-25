/**
 * Cropping a profile photo to a square (docs/design/profile-look-proposal.md §5.3), shared by the
 * web and the app so both send the server the same thing: the photo as chosen, and a crop box in
 * fractions of it. The server applies the box (packages/documents profile-photo.ts), so the app
 * needs no image-editing module. Pure arithmetic, React-Native-safe (hard rule 11).
 *
 * The crop is a square of side `min(width, height) / zoom`, centred at (`cx`, `cy`), each a
 * fraction of the photo's width and height. It always stays inside the photo.
 */

/** The most a learner may send (packages/documents checks the same, by the bytes). */
export const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
/** What the browser and the app offer to send. HEIC is refused before sending (see the server). */
export const PHOTO_PICK_TYPES = ['image/jpeg', 'image/png'] as const;

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 4;
/** One press of "Zoom in" or "Zoom out", and one step of the slider. */
export const ZOOM_STEP = 0.25;
/** One press of a move button or an arrow key: a tenth of the square's side. */
export const MOVE_STEP = 0.1;

export interface PhotoCrop {
  readonly zoom: number;
  /** The square's centre, as fractions of the photo's width and height. */
  readonly cx: number;
  readonly cy: number;
}

/** What the server is sent: the square's top-left corner (fractions of width and height) and its side (a fraction of the shorter edge). */
export interface CropBox {
  readonly x: number;
  readonly y: number;
  readonly size: number;
}

export const CENTRED_CROP: PhotoCrop = { zoom: MIN_ZOOM, cx: 0.5, cy: 0.5 };

const between = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));

function side(crop: PhotoCrop, width: number, height: number): number {
  return Math.min(width, height) / crop.zoom;
}

/** The crop pulled back inside the photo, with the zoom between its limits. */
export function clampCrop(crop: PhotoCrop, width: number, height: number): PhotoCrop {
  const zoom = between(crop.zoom, MIN_ZOOM, MAX_ZOOM);
  const half = side({ ...crop, zoom }, width, height) / 2;
  return {
    zoom,
    cx: between(crop.cx * width, half, width - half) / width,
    cy: between(crop.cy * height, half, height - half) / height,
  };
}

/** Zooms by `steps` (negative to zoom out), about the square's centre. */
export function zoomCrop(crop: PhotoCrop, steps: number, width: number, height: number): PhotoCrop {
  return clampCrop({ ...crop, zoom: crop.zoom + steps * ZOOM_STEP }, width, height);
}

/** Sets the zoom (the slider), about the square's centre. */
export function withZoom(crop: PhotoCrop, zoom: number, width: number, height: number): PhotoCrop {
  return clampCrop({ ...crop, zoom }, width, height);
}

/**
 * Moves the square by `dx`, `dy` steps (right and down are positive), each a tenth of its side,
 * so a step is the same on the screen at every zoom.
 */
export function moveCrop(
  crop: PhotoCrop,
  dx: number,
  dy: number,
  width: number,
  height: number,
): PhotoCrop {
  const step = side(crop, width, height) * MOVE_STEP;
  return clampCrop(
    { ...crop, cx: crop.cx + (dx * step) / width, cy: crop.cy + (dy * step) / height },
    width,
    height,
  );
}

/** The box the server applies. */
export function cropBox(crop: PhotoCrop, width: number, height: number): CropBox {
  const c = clampCrop(crop, width, height);
  const s = side(c, width, height);
  return {
    x: (c.cx * width - s / 2) / width,
    y: (c.cy * height - s / 2) / height,
    size: 1 / c.zoom,
  };
}

/**
 * Where to draw the whole photo inside a square viewport so the viewport shows exactly the crop:
 * percentages of the viewport's side (web: CSS `%`; app: multiply by the viewport's size).
 */
export function cropView(
  crop: PhotoCrop,
  width: number,
  height: number,
): { width: number; height: number; left: number; top: number } {
  const c = clampCrop(crop, width, height);
  const s = side(c, width, height);
  return {
    width: (width / s) * 100,
    height: (height / s) * 100,
    left: (-(c.cx * width - s / 2) / s) * 100,
    top: (-(c.cy * height - s / 2) / s) * 100,
  };
}
