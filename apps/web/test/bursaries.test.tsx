// @vitest-environment jsdom

import { existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanup, render, screen, within } from '@testing-library/react';
import type { Artifact } from '@universityflow/agent';
import { bursariesFor, isDraft, RAW_CATALOGUE } from '@universityflow/catalogue';
import { common, funding } from '@universityflow/content';
import { afterEach, describe, expect, it } from 'vitest';
import { ArtifactView } from '../components/artifacts';
import { BursaryList } from '../components/bursary-list';
import { DemoBanner } from '../components/demo-banner';
import { DEMO_FUNDER_LOGOS, DEMO_LOGOS_ON } from '../lib/demo-logos';

/**
 * Bursaries beside NSFAS on /funding (planning.md Â§3 Stage 2): each in the page's own Card, with
 * its window's status as code decided it, its source, and the draft label. The funders' own logos
 * show on the judge demo only, with a "not affiliated" line on the banner (the owner, 2026-10-25).
 */

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = resolve(WEB, 'public/demo-logos/funders');
const RAW = RAW_CATALOGUE.bursaries ?? [];
const TODAY = new Date('2026-10-25T08:00:00Z');
/** The same day in South Africa, as the page passes it in. */
const DAY = '2026-10-25';
const ENTRIES = bursariesFor(RAW, TODAY).map((e) => ({ ...e, draft: isDraft(e.bursary) }));

describe('the bursary list on /funding', () => {
  afterEach(cleanup);

  it('shows every bursary as NSFAS is shown: the deadline first, then the facts, then Apply (RT-05)', () => {
    render(<BursaryList entries={ENTRIES} today={DAY} demoLogos={null} />);
    // Under the list's own h2, each bursary's name is an h3.
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(RAW.length);
    const funza = screen.getByRole('region', { name: 'Funza Lushaka Bursary' });
    // Open from 1 Oct 2026 to 31 Jan 2027: 98 days left on 25 Oct 2026.
    const deadline = within(funza).getByText(funding.daysLeft(98));
    const apply = within(funza).getByRole('link', { name: /^Apply on www\.eservices\.gov\.za/ });
    expect(deadline.compareDocumentPosition(apply) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // The teaching obligation is a fact to scan, not hidden.
    expect(within(funza).getByText(/Teach one year for every year/)).toBeTruthy();
    const links = within(funza)
      .getAllByRole('link')
      .map((a) => a.getAttribute('href'));
    expect(links).toContain('https://www.funzalushaka.doe.gov.za/');
    expect(links).toContain('https://www.eservices.gov.za/');
    expect(within(funza).getByText(common.draftBadge)).toBeTruthy();
  });

  it('says what the funder says about a window without dates, rather than leaving it blank', () => {
    render(<BursaryList entries={ENTRIES} today={DAY} demoLogos={null} />);
    const isfap = screen.getByRole('region', { name: 'ISFAP funding' });
    expect(within(isfap).getByText('The page publishes no opening or closing date.')).toBeTruthy();
    const moshal = screen.getByRole('region', { name: 'Moshal Program scholarship' });
    expect(within(moshal).getByText(funding.bursaryWorkBackNotStated)).toBeTruthy();
  });

  it('draws no funder logo without the demo switch', () => {
    expect(DEMO_LOGOS_ON).toBe(false);
    const { container } = render(<BursaryList entries={ENTRIES} today={DAY} />);
    expect(container.querySelector('img')).toBeNull();
  });

  it('draws the funderâ€™s own logo when the demo passes its logos in', () => {
    const { container } = render(
      <BursaryList entries={ENTRIES} today={DAY} demoLogos={DEMO_FUNDER_LOGOS} />,
    );
    const srcs = [...container.querySelectorAll('img')].map((i) => i.getAttribute('src'));
    expect(srcs).toContain('/demo-logos/funders/sasol.webp');
    // Decorative beside the name: the name is the card's heading.
    for (const img of container.querySelectorAll('img')) expect(img.getAttribute('alt')).toBe('');
  });

  it('says nothing is there when there is nothing to show', () => {
    render(<BursaryList entries={[]} today={DAY} demoLogos={null} />);
    expect(screen.getByText(funding.bursariesNone)).toBeTruthy();
  });
});

describe('the fundersâ€™ logos on the judge demo', () => {
  afterEach(cleanup);

  it('says on the banner that the fundersâ€™ logos are for the demo only, not affiliated', () => {
    render(<DemoBanner demo logos mainUrl={null} />);
    expect(screen.getByText(funding.demoLogosNotice)).toBeTruthy();
  });

  it('leaves the line off without the switch', () => {
    render(<DemoBanner demo logos={false} mainUrl={null} />);
    expect(screen.queryByText(funding.demoLogosNotice)).toBeNull();
  });

  it('lists exactly the files in the folder, each a bursary the catalogue holds, small enough', () => {
    const files = readdirSync(DIR).sort();
    const listed = Object.values(DEMO_FUNDER_LOGOS)
      .map((l) => l.src.replace('/demo-logos/funders/', ''))
      .sort();
    expect(listed).toEqual(files);
    const ids = new Set(RAW.map((b) => b.id));
    for (const [id, logo] of Object.entries(DEMO_FUNDER_LOGOS)) {
      expect(ids.has(id)).toBe(true);
      expect(logo.src).toMatch(new RegExp(`^/demo-logos/funders/${id}\\.(svg|png|webp)$`));
      const file = resolve(WEB, `public${logo.src}`);
      expect(existsSync(file)).toBe(true);
      expect(statSync(file).size).toBeLessThanOrEqual(30 * 1024);
    }
  });
});

describe('the funding card in the chat', () => {
  afterEach(cleanup);

  it('counts the other bursaries when the tool returned some', () => {
    const artifact: Artifact = {
      kind: 'funding',
      nsfas: null,
      checklist: [],
      bursaries: bursariesFor(RAW, TODAY),
    };
    render(<ArtifactView artifact={artifact} />);
    expect(screen.getByText(funding.bursariesCount(RAW.length))).toBeTruthy();
  });

  it('shows no count on a card saved before bursaries were added', () => {
    render(<ArtifactView artifact={{ kind: 'funding', nsfas: null, checklist: [] }} />);
    expect(screen.queryByText(/other bursar/)).toBeNull();
  });
});
