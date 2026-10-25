// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { en } from '@universityflow/content';
import type { ProfileLook as Look } from '@universityflow/ui';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { ProfileLook } = await import('../app/(app)/me/profile-look');

/**
 * The profile photo in the judge demo (owner's decision, 2026-10-23): "Choose a sample photo", a
 * set of radio buttons over made-up SAMPLE pictures, in place of the file input. The crop and
 * zoom work as for a real photo; what is sent is the sample's id and the crop, never a file.
 */

const t = en.profilePhoto;
const d = en.demo;
const css = readFileSync(resolve(__dirname, '../app/globals.css'), 'utf8');
const LOOK: Look = { theme: 'ocean', avatar: 'initials', taglineId: null, badgeIds: [] };
const SAMPLES = ['sample-1', 'sample-2', 'sample-3', 'sample-4', 'sample-5', 'sample-6'] as const;

interface Sent {
  method: string;
  path: string;
  body: BodyInit | null | undefined;
}

function serve(reply: () => Response = () => Response.json({ photo: { version: 'v2' } })) {
  const sent: Sent[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (path: string, init: RequestInit = {}) => {
      sent.push({ method: init.method ?? 'GET', path, body: init.body });
      return reply();
    }),
  );
  return sent;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function demoCard(version: string | null = null) {
  const view = render(
    <ProfileLook
      name="Thando Mokoena"
      grade={11}
      initial={LOOK}
      photo={{ version, samples: [...SAMPLES] }}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: en.profileLook.open }));
  return view;
}

const samples = () => within(screen.getByRole('group', { name: d.samplePhotosLegend }));

function loaded() {
  const img = screen.getByTestId('photo-crop').querySelector('img') as HTMLImageElement;
  Object.defineProperty(img, 'naturalWidth', { value: 512 });
  Object.defineProperty(img, 'naturalHeight', { value: 512 });
  fireEvent.load(img);
  return img;
}

describe('the sample picker', () => {
  it('replaces the file input with named radio buttons, one per sample', async () => {
    const { container } = await demoCard();
    expect(container.querySelector('input[type="file"]')).toBeNull();
    expect(screen.queryByText(t.types)).toBeNull();
    const radios = samples().getAllByRole('radio');
    expect(radios).toHaveLength(SAMPLES.length);
    SAMPLES.forEach((id, i) => {
      const name = d.samplePhotoName(i + 1, d.samplePhotos[id]);
      expect(name).toMatch(/^Sample photo \d: /);
      const radio = samples().getByRole('radio', { name });
      expect((radio as HTMLInputElement).value).toBe(id);
      // The picture beside it is decoration: its words are the radio's name.
      const img = radio.closest('label')?.querySelector('img') as HTMLImageElement;
      expect(img.getAttribute('src')).toBe(`/api/demo/sample-photos/${id}`);
      expect(img.getAttribute('alt')).toBe('');
    });
    // Its own name group: the arrow keys move between them (the browser's radio group).
    expect(new Set(radios.map((r) => (r as HTMLInputElement).name)).size).toBe(1);
    expect(screen.getByText(d.samplePhotosLead)).toBeTruthy();
  });

  it('"Use this photo" waits for a choice, and keeps focus while it waits', async () => {
    const sent = serve();
    await demoCard();
    const use = screen.getByRole('button', { name: d.useSamplePhoto });
    expect(use.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(use);
    expect(screen.queryByTestId('photo-crop')).toBeNull();
    expect(sent).toHaveLength(0);
  });

  it('crops the chosen sample as a photo and sends its id with the crop, never a file', async () => {
    const sent = serve();
    await demoCard();
    fireEvent.click(
      samples().getByRole('radio', { name: d.samplePhotoName(2, d.samplePhotos['sample-2']) }),
    );
    fireEvent.click(screen.getByRole('button', { name: d.useSamplePhoto }));
    const img = loaded();
    expect(img.getAttribute('src')).toBe('/api/demo/sample-photos/sample-2');
    fireEvent.click(screen.getByRole('button', { name: t.zoomIn }));
    fireEvent.click(screen.getByRole('button', { name: t.save }));
    await screen.findByText(t.saved);
    const post = sent.find((s) => s.method === 'POST');
    expect(post?.path).toBe('/api/me/photo');
    const body = post?.body as FormData;
    expect(body.get('sample')).toBe('sample-2');
    expect(body.has('file')).toBe(false);
    const crop = JSON.parse(String(body.get('crop'))) as { x: number; y: number; size: number };
    expect(crop.size).toBeLessThan(1);
    // The card shows the kept photo.
    expect(document.querySelector('[data-avatar="photo"]')).toBeTruthy();
  });

  it('says the demo’s sentence when the server refuses a file', async () => {
    serve(() =>
      Response.json({ error: 'upload', detail: 'demo-sample-photo-only' }, { status: 400 }),
    );
    await demoCard();
    fireEvent.click(samples().getAllByRole('radio')[0] as HTMLElement);
    fireEvent.click(screen.getByRole('button', { name: d.useSamplePhoto }));
    loaded();
    fireEvent.click(screen.getByRole('button', { name: t.save }));
    expect(await screen.findByText(d.samplePhotoOnly)).toBeTruthy();
  });

  it('Cancel goes back to the picker; "Remove photo" is there once a sample is kept', async () => {
    serve();
    await demoCard('v1');
    expect(screen.getByRole('button', { name: t.remove })).toBeTruthy();
    fireEvent.click(samples().getAllByRole('radio')[3] as HTMLElement);
    fireEvent.click(screen.getByRole('button', { name: d.useSamplePhoto }));
    fireEvent.click(screen.getByRole('button', { name: t.cancel }));
    expect(screen.getByRole('group', { name: d.samplePhotosLegend })).toBeTruthy();
  });
});

describe('its look', () => {
  it('wraps to the width of a 360px phone, and nothing in it moves', () => {
    const block = css.slice(css.indexOf('/* demo-photos:'), css.indexOf('/* end demo-photos */'));
    expect(block.length).toBeGreaterThan(0);
    expect(block).toMatch(
      /\.uf-sample-photos\s*\{[^}]*grid-template-columns:\s*repeat\(auto-fill,\s*minmax\(/,
    );
    expect(block).not.toMatch(/transition|animation/);
    // Design values from tokens only (hard rule 8).
    expect(block).not.toMatch(/#[0-9a-f]{3,8}\b|\d+px/i);
  });
});
