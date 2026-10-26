// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, render, screen } from '@testing-library/react';
import { en } from '@universityflow/content';
import { afterEach, describe, expect, it } from 'vitest';
import { StagingBanner } from '../components/staging-banner';
import { rootMetadata } from '../lib/server/seo';

/**
 * The staging banner (docs/deploy/README.md): on every page of a staging site, so nobody takes
 * it for the real UniversityFlow or types a real learner's details into it.
 */

afterEach(() => {
  cleanup();
});

describe('StagingBanner', () => {
  it('says plainly that this is staging, with made-up details only', () => {
    render(<StagingBanner staging />);
    const banner = screen.getByRole('note', { name: en.deploy.stagingLabel });
    expect(banner.textContent).toContain(en.deploy.stagingLabel);
    expect(banner.textContent).toContain(en.deploy.stagingNotice);
  });

  it('renders nothing outside staging', () => {
    const { container } = render(<StagingBanner staging={false} />);
    expect(container.innerHTML).toBe('');
  });

  it('is in the root layout, so it is on every page, sign-in included, and staging is not indexed', () => {
    // jsdom gives import.meta.url an http scheme, so the path is built from the folder.
    const layout = readFileSync(join(import.meta.dirname, '../app/layout.tsx'), 'utf8');
    expect(layout).toMatch(/<StagingBanner staging=\{staging\} \/>/);
    expect(layout).toMatch(/isStaging\(\)/);
    // The root metadata (lib/server/seo.ts, A6-02) decides noindex from the deployment.
    expect(layout).toMatch(/generateMetadata\(\): Metadata \{\s*return rootMetadata\(\);/);
    expect(rootMetadata({ UF_DEPLOYMENT: 'staging' }).robots).toEqual({
      index: false,
      follow: false,
    });
  });
});
