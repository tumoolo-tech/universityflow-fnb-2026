import { describe, expect, it } from 'vitest';
import {
  CENTRED_CROP,
  clampCrop,
  cropBox,
  cropView,
  MAX_ZOOM,
  MIN_ZOOM,
  moveCrop,
  withZoom,
  zoomCrop,
} from './photo-crop';

/** The square crop the web and the app send with a profile photo (profile-look-proposal §5.3). */

const W = 4000;
const H = 3000;

describe('the profile photo crop', () => {
  it('starts as the largest centred square', () => {
    expect(cropBox(CENTRED_CROP, W, H)).toEqual({ x: 0.125, y: 0, size: 1 });
    expect(cropBox(CENTRED_CROP, H, W)).toEqual({ x: 0, y: 0.125, size: 1 });
  });

  it('keeps the zoom between its limits', () => {
    expect(withZoom(CENTRED_CROP, 9, W, H).zoom).toBe(MAX_ZOOM);
    expect(withZoom(CENTRED_CROP, 0.2, W, H).zoom).toBe(MIN_ZOOM);
    expect(zoomCrop(CENTRED_CROP, 2, W, H).zoom).toBe(1.5);
    expect(zoomCrop(CENTRED_CROP, -1, W, H).zoom).toBe(MIN_ZOOM);
  });

  it('never moves the square off the photo, however far it is pushed', () => {
    let crop = zoomCrop(CENTRED_CROP, 4, W, H); // zoom 2: a 1500 px square
    for (let i = 0; i < 50; i++) crop = moveCrop(crop, -1, -1, W, H);
    expect(cropBox(crop, W, H)).toEqual({ x: 0, y: 0, size: 0.5 });
    for (let i = 0; i < 50; i++) crop = moveCrop(crop, 1, 1, W, H);
    const box = cropBox(crop, W, H);
    expect(box.x * W + box.size * H).toBeCloseTo(W);
    expect(box.y * H + box.size * H).toBeCloseTo(H);
  });

  it('moves by a tenth of the square at every zoom', () => {
    const zoomed = withZoom(CENTRED_CROP, 3, W, H); // a 1000 px square
    const moved = moveCrop(zoomed, 1, 0, W, H);
    expect((moved.cx - zoomed.cx) * W).toBeCloseTo(100);
  });

  it('zooming out pulls a square back inside the photo', () => {
    const corner = clampCrop({ zoom: 4, cx: 0.99, cy: 0.99 }, W, H);
    const out = withZoom(corner, 1, W, H);
    const box = cropBox(out, W, H);
    expect(box.x + (box.size * H) / W).toBeLessThanOrEqual(1 + 1e-9);
    expect(box.y + box.size).toBeLessThanOrEqual(1 + 1e-9);
  });

  it('draws the photo so the square fills the viewport exactly', () => {
    expect(cropView(CENTRED_CROP, W, H)).toEqual({
      width: (4000 / 3000) * 100,
      height: 100,
      left: -(500 / 3000) * 100,
      top: -0,
    });
    const zoomed = cropView(withZoom(CENTRED_CROP, 2, W, H), W, H);
    expect(zoomed.height).toBe(200);
    expect(zoomed.left).toBeCloseTo((-1250 / 1500) * 100);
  });
});
