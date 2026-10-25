// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { en } from '@universityflow/content';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * The menu's "Sign out" goes where the server says (the demo: back to the picker), else to the
 * landing page as before.
 */

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/home',
}));
let answer: Record<string, unknown> = { ok: true };
vi.mock('@/lib/client/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/client/api')>()),
  api: async () => answer,
}));

const { SignOutButton } = await import('../app/(app)/nav');

afterEach(() => {
  cleanup();
  push.mockReset();
});

describe('SignOutButton', () => {
  it('on a demo, goes back to the picker the server names', async () => {
    answer = { ok: true, next: '/demo' };
    render(<SignOutButton />);
    fireEvent.click(screen.getByRole('button', { name: en.nav.signOut }));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/demo'));
  });

  it('elsewhere, to the landing page as before', async () => {
    answer = { ok: true };
    render(<SignOutButton />);
    fireEvent.click(screen.getByRole('button', { name: en.nav.signOut }));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/'));
  });

  it('never follows a "next" that leaves the site', async () => {
    answer = { ok: true, next: 'https://evil.example/' };
    render(<SignOutButton />);
    fireEvent.click(screen.getByRole('button', { name: en.nav.signOut }));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/'));
  });
});
