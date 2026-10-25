// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { en } from '@universityflow/content';
import type { ProfileLook as Look } from '@universityflow/ui';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { ProfileLook } = await import('../app/(app)/me/profile-look');

/**
 * A HACKATHON EXCEPTION (UF_DEMO_REAL_PHOTOS, demo only): beside the SAMPLE pictures, the visitor
 * may upload their own photo, with a plain line saying it is deleted with their demo copy and
 * used for nothing else. The samples stay. Without the switch the picker is unchanged
 * (demo-photo-picker.test.tsx).
 */

const t = en.profilePhoto;
const d = en.demo;
const LOOK: Look = { theme: 'ocean', avatar: 'initials', taglineId: null, badgeIds: [] };
const SAMPLES = ['sample-1', 'sample-2', 'sample-3', 'sample-4', 'sample-5', 'sample-6'];

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

function demoCard(realUploads: 'copy' | 'account') {
  const view = render(
    <ProfileLook
      name="Thando Mokoena"
      grade={11}
      initial={LOOK}
      photo={{ version: null, samples: [...SAMPLES], realUploads }}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: en.profileLook.open }));
  return view;
}

describe('a visitor’s own photo in the demo (hackathon exception)', () => {
  it('offers an upload beside the samples, with the line for a 24-hour copy', () => {
    const { container } = demoCard('copy');
    expect(
      within(screen.getByRole('group', { name: d.samplePhotosLegend })).getAllByRole('radio'),
    ).toHaveLength(6);
    const own = within(screen.getByRole('group', { name: d.realPhotoLegend }));
    expect(own.getByText(d.realPhotoLead)).toBeTruthy();
    expect(own.getByText(t.types)).toBeTruthy();
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input.accept).toBe('image/jpeg,image/png');
  });

  it('says 30 days on a judge’s own sign-up account', () => {
    demoCard('account');
    expect(screen.getByText(d.realPhotoLeadAccount)).toBeTruthy();
    expect(screen.queryByText(d.realPhotoLead)).toBeNull();
  });

  it('sends the file with its crop, as anywhere', async () => {
    const sent: Array<{ path: string; body: unknown }> = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string, init: RequestInit = {}) => {
        sent.push({ path, body: init.body });
        return Response.json({ photo: { version: 'v2' } });
      }),
    );
    const { container } = demoCard('copy');
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [new File([new Uint8Array(10)], 'me.jpg', { type: 'image/jpeg' })] },
    });
    const img = screen.getByTestId('photo-crop').querySelector('img') as HTMLImageElement;
    Object.defineProperty(img, 'naturalWidth', { value: 800 });
    Object.defineProperty(img, 'naturalHeight', { value: 800 });
    fireEvent.load(img);
    fireEvent.click(screen.getByRole('button', { name: t.save }));
    await waitFor(() => expect(sent).toHaveLength(1));
    const body = sent[0]?.body as FormData;
    expect(sent[0]?.path).toBe('/api/me/photo');
    expect(body.get('file')).toBeInstanceOf(File);
    expect(body.has('sample')).toBe(false);
  });
});
