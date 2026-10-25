// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { en } from '@universityflow/content';
import type { ProfileLook as Look } from '@universityflow/ui';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { ProfileLook } = await import('../app/(app)/me/profile-look');

/**
 * The photo's words for learners from Grade 10 on the web's About me card (A11-31; the owner's
 * "not used for anything else"): beside the upload, plainly, only you see it and it is used for
 * nothing else; and when the learner's consent doesn't name the photo yet, a sentence that says
 * who must agree, not a generic error. The judge demo's sample picker is unchanged.
 */

const t = en.profilePhoto;
const LOOK: Look = { theme: 'ocean', avatar: 'initials', taglineId: null, badgeIds: [] };

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

const open = () => fireEvent.click(screen.getByRole('button', { name: en.profileLook.open }));

describe('the photo’s words (A11-31)', () => {
  it('says beside the upload that only the learner sees it and it is used for nothing else', () => {
    render(
      <ProfileLook name="Thando Mokoena" grade={10} initial={LOOK} photo={{ version: null }} />,
    );
    open();
    expect(screen.getByText(t.onlyYou)).toBeTruthy();
  });

  it('is not shown where no photo is offered', () => {
    render(<ProfileLook name="Thando Mokoena" grade={10} initial={LOOK} photo={null} />);
    open();
    expect(screen.queryByText(t.onlyYou)).toBeNull();
  });

  it('says who must agree when the consent doesn’t name the photo yet', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({ error: 'consent-outdated', detail: 'photo-consent' }, { status: 403 }),
      ),
    );
    const { container } = render(
      <ProfileLook name="Thando Mokoena" grade={10} initial={LOOK} photo={{ version: null }} />,
    );
    open();
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [new File([new Uint8Array(10)], 'me.jpg', { type: 'image/jpeg' })] },
    });
    const img = screen.getByTestId('photo-crop').querySelector('img') as HTMLImageElement;
    Object.defineProperty(img, 'naturalWidth', { value: 1200 });
    Object.defineProperty(img, 'naturalHeight', { value: 800 });
    fireEvent.load(img);
    fireEvent.click(screen.getByRole('button', { name: t.save }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe(t.consentNeeded));
  });
});
