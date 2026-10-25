// @vitest-environment jsdom

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, render, screen } from '@testing-library/react';
import { en } from '@universityflow/content';
import { afterEach, describe, expect, it } from 'vitest';

/**
 * A2-64 (DEMO-walk): there was no not-found page, so a missing page showed Next's built-in one,
 * whose own white box and styles broke the app's theme (axe: color-contrast on the preview strip
 * above it). Our own page: the app's tokens, one heading, and a way home.
 */

afterEach(cleanup);

const PAGE = join(import.meta.dirname, '..', 'app', 'not-found.tsx');

describe('the not-found page', () => {
  it('exists at the app root', () => {
    expect(existsSync(PAGE)).toBe(true);
  });

  it('says so in one heading, with a way home', async () => {
    const NotFound = (await import('../app/not-found')).default;
    render(<NotFound />);
    expect(screen.getByRole('heading', { level: 1, name: en.errors.notFound })).toBeTruthy();
    expect(screen.getByRole('link', { name: en.nav.home }).getAttribute('href')).toBe('/');
    expect(screen.getByRole('main')).toBeTruthy();
  });
});
