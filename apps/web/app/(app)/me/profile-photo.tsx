'use client';

import { demo as d, profilePhoto as t } from '@universityflow/content';
import {
  CENTRED_CROP,
  cropBox,
  cropView,
  MAX_PHOTO_BYTES,
  MAX_ZOOM,
  MIN_ZOOM,
  moveCrop,
  PHOTO_PICK_TYPES,
  type PhotoCrop,
  withZoom,
  ZOOM_STEP,
  zoomCrop,
} from '@universityflow/ui';
import { type KeyboardEvent, type PointerEvent, useEffect, useId, useRef, useState } from 'react';
import { Button, FileButton, Notice, StatusLine } from '@/components/ui';
import { ApiError, api, errorMessage } from '@/lib/client/api';
import { useFocusAfter } from '@/lib/client/focus';
import { useStatus } from '@/lib/client/status';

/**
 * The profile photo in "Make it yours" (docs/design/profile-look-proposal.md §5.3): only when the
 * server's switch is on (the page passes no `photo` otherwise). The learner picks a JPEG or PNG
 * of up to 2 MB, then crops it to a square here: a zoom slider, zoom and move buttons, the arrow
 * keys and + and − on the photo itself, or dragging. The photo is sent as chosen with the crop box;
 * the server applies it, makes it black and white and drops its metadata. Nothing moves on its
 * own, so there is no animation to turn off (hard rule 9).
 *
 * In a judge demo (`samples`, owner's decision 2026-10-23) there is no file input: "Choose a
 * sample photo" offers made-up SAMPLE pictures as radio buttons, and the chosen one is cropped
 * the same way and sent as its id with the crop. No real photo leaves the browser there.
 */

type Refusal = keyof typeof t.errors;

/** The server's refusal as words, or the app's usual sentence for anything else. */
function photoError(error: unknown): string {
  // The learner's consent doesn't name the photo yet (A11-31, migration 0037).
  if (error instanceof ApiError && error.detail === 'photo-consent') return t.consentNeeded;
  if (error instanceof ApiError && error.code === 'upload' && error.detail) {
    if (error.detail === 'demo-sample-photo-only') return d.samplePhotoOnly;
    if (Object.hasOwn(t.errors, error.detail)) return t.errors[error.detail as Refusal];
  }
  return errorMessage(error);
}

/** Where the picker shows a sample picture (served only on a demo). */
const samplePictureUrl = (sample: string) =>
  `/api/demo/sample-photos/${encodeURIComponent(sample)}`;

/** What a sample shows, in words, by its id. */
function sampleDescription(sample: string): string {
  const words: Readonly<Record<string, string>> = d.samplePhotos;
  return words[sample] ?? '';
}

/** The photo being cropped: a file the learner picked, or a demo's sample picture. */
type Picked =
  | { url: string; file: File; sample?: never }
  | { url: string; sample: string; file?: never };

/** What the browser can tell before sending: a HEIC can't be opened by the server (see documents). */
function refusal(file: File): Refusal | null {
  if (file.size === 0) return 'empty';
  if (/^image\/hei[cf]/.test(file.type) || /\.hei[cf]$/i.test(file.name)) return 'heic-unsupported';
  if (!(PHOTO_PICK_TYPES as ReadonlyArray<string>).includes(file.type)) return 'unsupported-type';
  if (file.size > MAX_PHOTO_BYTES) return 'too-large';
  return null;
}

const MOVES: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

export function ProfilePhoto({
  version,
  onChange,
  samples = null,
  realUploads = null,
}: {
  /** The current photo's version, or null for none. */
  version: string | null;
  /** The new version after a save, or null after "Remove photo". */
  onChange: (version: string | null) => void;
  /** A judge demo's SAMPLE pictures, by id: chosen from these, never a file (but see below). */
  samples?: ReadonlyArray<string> | null;
  /**
   * A judge demo under UF_DEMO_REAL_PHOTOS (a hackathon exception): the visitor may also upload
   * their own photo, deleted with their 24-hour `copy` or their 30-day sign-up `account`.
   */
  realUploads?: 'copy' | 'account' | null;
}) {
  const id = useId();
  const [picked, setPicked] = useState<Picked | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const [crop, setCrop] = useState<PhotoCrop>(CENTRED_CROP);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useStatus();
  const viewport = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);
  // Save, Cancel and "Remove photo" take away the button that was pressed: focus goes to the
  // photo button that replaces them, never to <body> (WCAG 2.4.3, A2-29).
  const photoButton = useRef<HTMLInputElement>(null);
  const focusAfter = useFocusAfter();
  const backToPhotoButton = () => focusAfter(() => photoButton.current);

  // The chosen photo is shown from memory only, and let go when it is no longer shown.
  useEffect(() => () => (picked?.file ? URL.revokeObjectURL(picked.url) : undefined), [picked]);

  function choose(file: File | undefined) {
    setError(null);
    setStatus('');
    if (!file) return;
    const refused = refusal(file);
    if (refused) {
      setError(t.errors[refused]);
      return;
    }
    setSize(null);
    setCrop(CENTRED_CROP);
    setPicked({ file, url: URL.createObjectURL(file) });
  }

  /** A demo: "Use this photo" crops the chosen sample, as a picked file would be. */
  function cropSample() {
    setError(null);
    setStatus('');
    if (!chosen) return;
    setSize(null);
    setCrop(CENTRED_CROP);
    setPicked({ sample: chosen, url: samplePictureUrl(chosen) });
  }

  function cancel() {
    setPicked(null);
    setSize(null);
    setError(null);
    backToPhotoButton();
  }

  const w = size?.width ?? 1;
  const h = size?.height ?? 1;
  const zoom = (steps: number) => setCrop((c) => zoomCrop(c, steps, w, h));
  const move = (dx: number, dy: number) => setCrop((c) => moveCrop(c, dx, dy, w, h));

  function onKey(event: KeyboardEvent<HTMLDivElement>) {
    const step = MOVES[event.key];
    if (step) move(step[0], step[1]);
    else if (event.key === '+' || event.key === '=') zoom(1);
    else if (event.key === '-' || event.key === '−') zoom(-1);
    else return;
    event.preventDefault();
  }

  // Dragging moves the photo with the pointer: a drag of the whole square is ten steps. On a touch
  // screen only sideways drags reach here; up and down scroll the page (`touch-action: pan-y`, A2-41).
  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture?.(event.pointerId);
    drag.current = { x: event.clientX, y: event.clientY };
  }
  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const from = drag.current;
    const side = viewport.current?.getBoundingClientRect().width ?? 0;
    if (!from || side === 0) return;
    drag.current = { x: event.clientX, y: event.clientY };
    // The photo follows the finger, so the square moves the other way.
    const steps = (px: number) => (-px / side) * 10;
    move(steps(event.clientX - from.x), steps(event.clientY - from.y));
  }
  const endDrag = () => {
    drag.current = null;
  };

  async function save() {
    if (!picked || !size || busy) return;
    setBusy(true);
    setError(null);
    try {
      const body = new FormData();
      body.set('crop', JSON.stringify(cropBox(crop, size.width, size.height)));
      if (picked.file) {
        body.set('file', picked.file, picked.file.type === 'image/png' ? 'photo.png' : 'photo.jpg');
      } else {
        body.set('sample', picked.sample);
      }
      const { photo } = await api<{ photo: { version: string } }>('/api/me/photo', {
        method: 'POST',
        body,
      });
      onChange(photo.version);
      setPicked(null);
      setStatus(t.saved);
      backToPhotoButton();
    } catch (e) {
      setError(photoError(e));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await api('/api/me/photo', { method: 'DELETE' });
      onChange(null);
      setStatus(t.removed);
      backToPhotoButton();
    } catch (e) {
      setError(photoError(e));
    } finally {
      setBusy(false);
    }
  }

  const view = size ? cropView(crop, size.width, size.height) : null;
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-1 font-medium">{t.heading}</legend>
      <p className="text-sm text-muted">{t.lead}</p>
      {/* A real photo: only the learner sees it, used for nothing else (A11-31). */}
      {samples ? null : <p className="text-sm">{t.onlyYou}</p>}
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {picked ? (
        <div className="flex flex-col gap-3">
          <p className="font-medium">{t.cropTitle}</p>
          <p className="text-sm text-muted" id={`${id}-crop-lead`}>
            {t.cropLead}
          </p>
          {/* biome-ignore lint/a11y/useSemanticElements: a focusable picture that takes keys, not a set of form fields */}
          <div
            ref={viewport}
            role="group"
            // biome-ignore lint/a11y/noNoninteractiveTabindex: the crop takes the arrow keys and + and −, so it must be reachable
            tabIndex={0}
            aria-label={t.cropArea}
            aria-describedby={`${id}-crop-lead`}
            className="uf-photo-crop"
            data-testid="photo-crop"
            onKeyDown={onKey}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          >
            {/* biome-ignore lint/performance/noImgElement: a local object URL, never optimised or cached */}
            <img
              src={picked.url}
              alt=""
              draggable={false}
              onLoad={(e) =>
                setSize({
                  width: e.currentTarget.naturalWidth,
                  height: e.currentTarget.naturalHeight,
                })
              }
              style={
                view
                  ? {
                      width: `${view.width}%`,
                      height: `${view.height}%`,
                      left: `${view.left}%`,
                      top: `${view.top}%`,
                    }
                  : { visibility: 'hidden' }
              }
            />
          </div>
          <label className="flex flex-col gap-1" htmlFor={`${id}-zoom`}>
            <span className="font-medium">{t.zoom}</span>
            <input
              id={`${id}-zoom`}
              type="range"
              min={MIN_ZOOM}
              max={MAX_ZOOM}
              step={ZOOM_STEP}
              value={crop.zoom}
              // Said as "125%", not "1.25" (A2-42).
              aria-valuetext={t.zoomValue(Math.round(crop.zoom * 100))}
              onChange={(e) => setCrop((c) => withZoom(c, Number(e.target.value), w, h))}
              className="uf-photo-zoom"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            {/* At a limit: `aria-disabled`, never `disabled`, so the pressed button keeps focus (A3-12, A2-29). */}
            <Button
              variant="secondary"
              onClick={() => zoom(-1)}
              aria-disabled={crop.zoom <= MIN_ZOOM}
            >
              {t.zoomOut}
            </Button>
            <Button
              variant="secondary"
              onClick={() => zoom(1)}
              aria-disabled={crop.zoom >= MAX_ZOOM}
            >
              {t.zoomIn}
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => move(-1, 0)}>
              {t.moveLeft}
            </Button>
            <Button variant="secondary" onClick={() => move(1, 0)}>
              {t.moveRight}
            </Button>
            <Button variant="secondary" onClick={() => move(0, -1)}>
              {t.moveUp}
            </Button>
            <Button variant="secondary" onClick={() => move(0, 1)}>
              {t.moveDown}
            </Button>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => void save()} aria-disabled={busy || !size}>
              {busy ? t.saving : t.save}
            </Button>
            <Button variant="quiet" onClick={cancel}>
              {t.cancel}
            </Button>
          </div>
        </div>
      ) : samples ? (
        <div className="flex flex-col gap-3">
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 font-medium">{d.samplePhotosLegend}</legend>
            <p className="text-sm text-muted">{d.samplePhotosLead}</p>
            <div className="uf-sample-photos">
              {samples.map((sample, i) => (
                <label key={sample} className="uf-sample-photo">
                  {/* biome-ignore lint/performance/noImgElement: a small drawn picture from our own route, never optimised */}
                  <img src={samplePictureUrl(sample)} alt="" width={512} height={512} />
                  <span className="flex items-center gap-2">
                    <input
                      // Focus comes back here after Save, Cancel or "Remove photo" (WCAG 2.4.3).
                      ref={chosen === sample || (!chosen && i === 0) ? photoButton : undefined}
                      type="radio"
                      name={`${id}-sample`}
                      value={sample}
                      checked={chosen === sample}
                      onChange={() => setChosen(sample)}
                      aria-label={d.samplePhotoName(i + 1, sampleDescription(sample))}
                    />
                    <span className="text-sm">{d.samplePhotoShort(i + 1)}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="flex flex-wrap items-center gap-3">
            {/* With nothing chosen: `aria-disabled`, never `disabled`, so it keeps focus (A3-12). */}
            <Button variant="secondary" onClick={cropSample} aria-disabled={!chosen}>
              {d.useSamplePhoto}
            </Button>
            {version ? (
              <Button variant="quiet" onClick={() => void remove()} aria-disabled={busy}>
                {t.remove}
              </Button>
            ) : null}
          </div>
          {realUploads ? (
            // The visitor's own photo (UF_DEMO_REAL_PHOTOS, a hackathon exception), beside the samples.
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 font-medium">{d.realPhotoLegend}</legend>
              <p className="text-sm">
                {realUploads === 'account' ? d.realPhotoLeadAccount : d.realPhotoLead}
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <FileButton
                  variant="secondary"
                  label={t.choose}
                  accept={PHOTO_PICK_TYPES.join(',')}
                  aria-describedby={`${id}-own-types`}
                  onChange={(e) => {
                    choose(e.target.files?.[0]);
                    e.target.value = '';
                  }}
                />
                <p id={`${id}-own-types`} className="w-full text-sm text-muted">
                  {t.types}
                </p>
              </div>
            </fieldset>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <FileButton
            ref={photoButton}
            variant="secondary"
            label={version ? t.change : t.add}
            accept={PHOTO_PICK_TYPES.join(',')}
            aria-describedby={`${id}-types`}
            onChange={(e) => {
              choose(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
          {version ? (
            <Button variant="quiet" onClick={() => void remove()} aria-disabled={busy}>
              {t.remove}
            </Button>
          ) : null}
          <p id={`${id}-types`} className="w-full text-sm text-muted">
            {t.types}
          </p>
        </div>
      )}
      <StatusLine said={status} />
    </fieldset>
  );
}

/** The photo on the card: black and white, in the theme's spotlight. Decoration (the name is said). */
export function PhotoFigure({ version }: { version: string }) {
  return (
    // biome-ignore lint/performance/noImgElement: a private, per-learner image (no-store): never through the optimiser
    <img
      src={`/api/me/photo?v=${encodeURIComponent(version)}`}
      alt=""
      width={512}
      height={512}
      data-avatar="photo"
      className="uf-look-photo uf-look-rise"
    />
  );
}
