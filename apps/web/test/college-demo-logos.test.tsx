// @vitest-environment jsdom

import { existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanup, render, screen } from '@testing-library/react';
import type { CollegeOption } from '@universityflow/admissions';
import { RAW_COLLEGES } from '@universityflow/catalogue/colleges';
import { colleges as words } from '@universityflow/content';
import { afterEach, describe, expect, it } from 'vitest';
import { CollegeCard } from '../components/college-card';
import { DemoBanner } from '../components/demo-banner';
import { DEMO_COLLEGE_LOGOS } from '../lib/demo-logos';

/**
 * The colleges' own logos on the judge demo only (the hackathon exception, as the universities'):
 * shown only when the demo's switch passes them in; everywhere else our neutral mark. Every file
 * is named by a college the catalogue holds, small, and listed in lib/demo-logos.ts.
 */

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = resolve(WEB, 'public/demo-logos/colleges');

const OPTION: CollegeOption = {
  programmeId: 'boland-ncv-tourism',
  collegeId: 'boland',
  collegeName: 'Boland College',
  collegeShortName: 'Boland College',
  province: 'Western Cape',
  mainTown: 'Stellenbosch',
  type: 'ncv',
  programme: 'Tourism',
  nameAtCollege: 'Tourism',
  campuses: null,
  verdict: 'check-rule',
  rule: null,
  entryQuote: null,
  entryQuoteUrl: null,
  sourceUrl: 'https://bolandcollege.com/what-to-study/',
  applyUrl: null,
  website: 'https://bolandcollege.com/',
  academicYear: 2027,
  yearPrinted: null,
  draft: true,
};

describe('college logos on the judge demo', () => {
  afterEach(cleanup);

  it('draws our neutral mark without the demo switch', () => {
    const { container } = render(<CollegeCard options={[OPTION]} demoLogos={null} />);
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('.uf-university-mark')).not.toBeNull();
  });

  it("draws the college's own logo when the demo passes its logos in", () => {
    const { container } = render(<CollegeCard options={[OPTION]} demoLogos={DEMO_COLLEGE_LOGOS} />);
    expect(container.querySelector('img')?.getAttribute('src')).toBe(
      '/demo-logos/colleges/boland.webp',
    );
  });

  it('says on the banner that the colleges’ logos are for the demo only, not affiliated', () => {
    render(<DemoBanner demo logos mainUrl={null} />);
    expect(screen.getByText(words.demoLogosNotice)).toBeTruthy();
  });

  it('lists exactly the files in the folder, each a college the catalogue holds, small enough', () => {
    const files = readdirSync(DIR).sort();
    const listed = Object.values(DEMO_COLLEGE_LOGOS)
      .map((l) => l.src.replace('/demo-logos/colleges/', ''))
      .sort();
    expect(listed).toEqual(files);
    const ids = new Set(RAW_COLLEGES.colleges.map((c) => c.id));
    for (const [id, logo] of Object.entries(DEMO_COLLEGE_LOGOS)) {
      expect(ids.has(id)).toBe(true);
      expect(logo.src).toMatch(new RegExp(`^/demo-logos/colleges/${id}\\.(svg|png|webp)$`));
      const file = resolve(WEB, `public${logo.src}`);
      expect(existsSync(file)).toBe(true);
      expect(statSync(file).size).toBeLessThanOrEqual(30 * 1024);
    }
  });
});
