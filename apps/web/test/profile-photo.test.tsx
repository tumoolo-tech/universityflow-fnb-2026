// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { en } from '@universityflow/content';
import {
  CENTRED_CROP,
  cropBox,
  type ProfileLook as Look,
  MAX_PHOTO_BYTES,
  zoomCrop,
} from '@universityflow/ui';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { ProfileLook } = await import('../app/(app)/me/profile-look');

/**
 * The profile photo on the web's About me card (profile-look-proposal §5.3): offered only when
 * the server's switch is on; a JPEG or PNG of up to 2 MB, a HEIC refused with a clear message;
 * cropped to a square by keyboard, buttons or the slider; sent with its crop box; shown black and
 * white in place of the avatar, which stays the default and the fallback.
 */

const t = en.profilePhoto;
const css = readFileSync(resolve(__dirname, '../app/globals.css'), 'utf8');
const LOOK: Look = { theme: 'ocean', avatar: 'initials', taglineId: null, badgeIds: [] };

interface Sent {
  method: string;
  path: string;
  body: BodyInit | null | undefined;
}

function serve(
  reply: (sent: Sent) => Response = () => Response.json({ photo: { version: 'v2' } }),
) {
  const sent: Sent[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (path: string, init: RequestInit = {}) => {
      const call = { method: init.method ?? 'GET', path, body: init.body };
      sent.push(call);
      return reply(call);
    }),
  );
  return sent;
}

beforeEach(() => {
  vi.stubGlobal(
    'URL',
    Object.assign(URL, { createObjectURL: () => 'blob:photo', revokeObjectURL: () => undefined }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const card = (photo: { version: string | null } | null) => (
  <ProfileLook name="Thando Mokoena" grade={11} initial={LOOK} photo={photo} />
);

async function openPicker() {
  fireEvent.click(screen.getByRole('button', { name: en.profileLook.open }));
}

function fileInput(container: HTMLElement) {
  return container.querySelector('input[type="file"]') as HTMLInputElement;
}

function pick(container: HTMLElement, file: File) {
  fireEvent.change(fileInput(container), { target: { files: [file] } });
}

/** The chosen photo "loads" in the crop, as the browser would report its size. */
function loaded(width = 1200, height = 800) {
  const img = screen.getByTestId('photo-crop').querySelector('img') as HTMLImageElement;
  Object.defineProperty(img, 'naturalWidth', { value: width });
  Object.defineProperty(img, 'naturalHeight', { value: height });
  fireEvent.load(img);
  return img;
}

/** The photo's part of the picker. */
const photoGroup = () => within(screen.getByRole('group', { name: t.heading }));

const jpeg = (bytes = 10) => new File([new Uint8Array(bytes)], 'me.jpg', { type: 'image/jpeg' });

describe('the switch', () => {
  it('off: no photo is offered, and the avatar stays', async () => {
    const { container } = render(card(null));
    await openPicker();
    expect(screen.queryByText(t.add)).toBeNull();
    expect(fileInput(container)).toBeNull();
    expect(container.querySelector('[data-avatar="card"]')).toBeTruthy();
    expect(container.querySelector('[data-avatar="photo"]')).toBeNull();
  });

  it('on with no photo: offers one, and the avatar is the default', async () => {
    const { container } = render(card({ version: null }));
    await openPicker();
    expect(screen.getByText(t.add)).toBeTruthy();
    expect(screen.getByText(t.types)).toBeTruthy();
    expect(fileInput(container).accept).toBe('image/jpeg,image/png');
    expect(container.querySelector('[data-avatar="card"]')).toBeTruthy();
    expect(screen.queryByRole('button', { name: t.remove })).toBeNull();
  });
});

describe('past matric, at university (the owner’s report, 2026-10-23)', () => {
  it('with no grade sticker, the photo is still offered and sent', async () => {
    const sent = serve();
    const { container } = render(
      <ProfileLook name="Thando Mokoena" grade={null} initial={LOOK} photo={{ version: null }} />,
    );
    expect(container.querySelector('.uf-look-sticker')).toBeNull();
    await openPicker();
    expect(screen.getByText(t.add)).toBeTruthy();
    pick(container, jpeg());
    loaded();
    fireEvent.click(screen.getByRole('button', { name: t.save }));
    await waitFor(() => expect(photoGroup().getByRole('status').textContent).toBe(t.saved));
    expect(sent.map((s) => `${s.method} ${s.path}`)).toEqual(['POST /api/me/photo']);
    expect(container.querySelector('[data-avatar="photo"]')).toBeTruthy();
  });
});

describe('choosing a photo', () => {
  it('refuses a HEIC, a file over 2 MB and anything not a JPEG or PNG, before sending', async () => {
    const sent = serve();
    const { container } = render(card({ version: null }));
    await openPicker();
    pick(container, new File([new Uint8Array(4)], 'IMG_0001.HEIC', { type: 'image/heic' }));
    expect(screen.getByRole('alert').textContent).toBe(t.errors['heic-unsupported']);
    pick(container, new File([new Uint8Array(4)], 'IMG_0002.heic', { type: '' }));
    expect(screen.getByRole('alert').textContent).toBe(t.errors['heic-unsupported']);
    pick(container, jpeg(MAX_PHOTO_BYTES + 1));
    expect(screen.getByRole('alert').textContent).toBe(t.errors['too-large']);
    pick(container, new File([new Uint8Array(4)], 'me.gif', { type: 'image/gif' }));
    expect(screen.getByRole('alert').textContent).toBe(t.errors['unsupported-type']);
    expect(screen.queryByTestId('photo-crop')).toBeNull();
    expect(sent).toEqual([]);
  });

  it('crops by keyboard, buttons and the slider, then sends the photo with its crop box', async () => {
    const sent = serve();
    const { container } = render(card({ version: null }));
    await openPicker();
    const file = jpeg();
    pick(container, file);
    const area = screen.getByRole('group', { name: t.cropArea });
    expect(area.tabIndex).toBe(0);
    const img = loaded(1200, 800);
    expect(img.style.height).toBe('100%');

    const slider = screen.getByLabelText(t.zoom) as HTMLInputElement;
    expect(slider.value).toBe('1');
    fireEvent.click(screen.getByRole('button', { name: t.zoomIn }));
    expect(slider.value).toBe('1.25');
    fireEvent.keyDown(area, { key: '+' });
    expect(slider.value).toBe('1.5');
    fireEvent.keyDown(area, { key: '-' });
    fireEvent.change(slider, { target: { value: '1.5' } });
    expect(slider.value).toBe('1.5');
    const before = img.style.left;
    fireEvent.keyDown(area, { key: 'ArrowRight' });
    expect(img.style.left).not.toBe(before);
    fireEvent.click(screen.getByRole('button', { name: t.moveLeft }));
    expect(Number.parseFloat(img.style.left)).toBeCloseTo(Number.parseFloat(before));
    fireEvent.click(screen.getByRole('button', { name: t.moveDown }));
    fireEvent.click(screen.getByRole('button', { name: t.moveUp }));

    fireEvent.click(screen.getByRole('button', { name: t.save }));
    await waitFor(() => expect(photoGroup().getByRole('status').textContent).toBe(t.saved));
    const post = sent.find((s) => s.method === 'POST');
    expect(post?.path).toBe('/api/me/photo');
    const body = post?.body as FormData;
    expect(body.get('file')).toBeInstanceOf(File);
    expect((body.get('file') as File).size).toBe(file.size);
    // The learner's own file name never leaves the browser.
    expect((body.get('file') as File).name).toBe('photo.jpg');
    const expected = cropBox(zoomCrop(CENTRED_CROP, 2, 1200, 800), 1200, 800);
    const crop = JSON.parse(String(body.get('crop'))) as typeof expected;
    for (const k of ['x', 'y', 'size'] as const) expect(crop[k]).toBeCloseTo(expected[k]);
    // The card shows the new photo at once, in the avatar's place.
    const shown = container.querySelector('[data-avatar="photo"]') as HTMLImageElement;
    expect(shown.getAttribute('src')).toBe('/api/me/photo?v=v2');
    expect(container.querySelector('[data-avatar="card"]')).toBeNull();
  });

  it('says why the server refused it, in its own words', async () => {
    serve(() => Response.json({ error: 'upload', detail: 'heic-unsupported' }, { status: 400 }));
    const { container } = render(card({ version: null }));
    await openPicker();
    pick(container, jpeg());
    loaded();
    fireEvent.click(screen.getByRole('button', { name: t.save }));
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toBe(t.errors['heic-unsupported']),
    );
  });

  it('cancel goes back without sending anything', async () => {
    const sent = serve();
    const { container } = render(card({ version: null }));
    await openPicker();
    pick(container, jpeg());
    fireEvent.click(screen.getByRole('button', { name: t.cancel }));
    expect(screen.queryByTestId('photo-crop')).toBeNull();
    expect(sent).toEqual([]);
  });
});

describe('a photo on the card', () => {
  it('shows black and white in the avatar’s place, as decoration (the name is said)', () => {
    const { container } = render(card({ version: 'v1' }));
    const shown = container.querySelector('[data-avatar="photo"]') as HTMLImageElement;
    expect(shown.getAttribute('alt')).toBe('');
    expect(shown.getAttribute('src')).toBe('/api/me/photo?v=v1');
    expect(shown.className).toContain('uf-look-photo');
    expect(css).toMatch(/\.uf-look-figure \.uf-look-photo \{[^}]*filter: grayscale\(1\)/);
    // The theme's spotlight behind it.
    expect(css).toMatch(/\.uf-look-figure \.uf-look-photo \{[^}]*var\(--look-soft\)/);
  });

  it('is on the page before any script runs', () => {
    const html = renderToStaticMarkup(card({ version: 'v1' }));
    expect(html).toContain('src="/api/me/photo?v=v1"');
  });

  it('“Remove photo” takes it off in one tap, and the avatar comes back', async () => {
    const sent = serve(() => Response.json({ photo: null }));
    const { container } = render(card({ version: 'v1' }));
    await openPicker();
    expect(screen.getByText(t.change)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: t.remove }));
    await waitFor(() => expect(photoGroup().getByRole('status').textContent).toBe(t.removed));
    expect(sent.map((s) => `${s.method} ${s.path}`)).toEqual(['DELETE /api/me/photo']);
    expect(container.querySelector('[data-avatar="photo"]')).toBeNull();
    expect(container.querySelector('[data-avatar="card"]')).toBeTruthy();
  });
});

describe('keyboard focus (A2-29, WCAG 2.4.3)', () => {
  const fileButton = (container: HTMLElement) => fileInput(container);

  it('Save and Cancel close the crop: focus goes to the photo button, never to <body>', async () => {
    serve();
    const { container } = render(card({ version: null }));
    await openPicker();
    pick(container, jpeg());
    const cancel = screen.getByRole('button', { name: t.cancel });
    cancel.focus();
    fireEvent.click(cancel);
    await waitFor(() => expect(document.activeElement).toBe(fileButton(container)));

    pick(container, jpeg());
    loaded();
    const save = screen.getByRole('button', { name: t.save });
    save.focus();
    fireEvent.click(save);
    await waitFor(() => expect(photoGroup().getByRole('status').textContent).toBe(t.saved));
    await waitFor(() => expect(document.activeElement).toBe(fileButton(container)));
  });

  it('“Remove photo” goes: focus goes to the photo button', async () => {
    serve(() => Response.json({ photo: null }));
    const { container } = render(card({ version: 'v1' }));
    await openPicker();
    const remove = screen.getByRole('button', { name: t.remove });
    remove.focus();
    fireEvent.click(remove);
    await waitFor(() => expect(photoGroup().getByRole('status').textContent).toBe(t.removed));
    await waitFor(() => expect(document.activeElement).toBe(fileButton(container)));
  });

  it('a zoom button at its limit keeps focus (aria-disabled, not disabled)', async () => {
    const { container } = render(card({ version: null }));
    await openPicker();
    pick(container, jpeg());
    loaded();
    const zoomIn = screen.getByRole('button', { name: t.zoomIn }) as HTMLButtonElement;
    zoomIn.focus();
    for (let i = 0; i < 20; i++) fireEvent.click(zoomIn);
    expect(zoomIn.disabled).toBe(false);
    expect(zoomIn.getAttribute('aria-disabled')).toBe('true');
    expect(document.activeElement).toBe(zoomIn);
    const zoomOut = screen.getByRole('button', { name: t.zoomOut }) as HTMLButtonElement;
    expect(zoomOut.getAttribute('aria-disabled')).toBe('false');
  });
});

describe('the crop’s zoom and touch (A2-41, A2-42)', () => {
  it('says the zoom as a percentage, not a bare number (A2-42)', async () => {
    const { container } = render(card({ version: null }));
    await openPicker();
    pick(container, jpeg());
    loaded();
    const slider = screen.getByRole('slider', { name: t.zoom });
    expect(slider.getAttribute('aria-valuetext')).toBe(t.zoomValue(100));
    fireEvent.click(screen.getByRole('button', { name: t.zoomIn }));
    expect(slider.getAttribute('aria-valuetext')).toBe(t.zoomValue(125));
    expect(t.zoomValue(125)).toBe('125%');
  });

  it('lets a thumb on the photo scroll the page up and down, and still drag it sideways (A2-41)', () => {
    // A browser fixes a touch's action when the finger lands, before any handler runs, so the
    // crop's touch-action is one fixed value: `pan-y`. The page scrolls vertically under a thumb;
    // a sideways drag still moves the photo; the buttons and slider do every move (2.5.7).
    const crop = /\.uf-photo-crop \{([^}]*)\}/.exec(css)?.[1] ?? '';
    expect(crop).toMatch(/touch-action: pan-y;/);
    expect(css).not.toMatch(/\.uf-photo-crop[^{]*\{[^}]*touch-action: none/);
  });
});

describe('motion (hard rule 9)', () => {
  it('adds no animation of its own; the photo’s entrance is the card’s, off under reduced motion', () => {
    const block = css.slice(css.indexOf('/* agent-2:'), css.indexOf('/* end agent-2 */'));
    expect(block.length).toBeGreaterThan(100);
    expect(block).not.toMatch(/animation|transition/);
    const reduced = css.slice(
      css.indexOf('@media (prefers-reduced-motion: reduce) {\n    .uf-look-line'),
    );
    expect(reduced).toMatch(/\.uf-look-rise,/);
    const { container } = render(card({ version: 'v1' }));
    expect(container.querySelector('[data-avatar="photo"]')?.className).toContain('uf-look-rise');
  });
});
