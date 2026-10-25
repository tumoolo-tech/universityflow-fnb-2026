// @vitest-environment jsdom

import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanup, render, screen } from '@testing-library/react';
import { universityMark as words } from '@universityflow/content';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';
import { UniversityMark, UniversityName } from '../components/university-mark';
import { DEMO_LOGOS_ON, DEMO_UNIVERSITY_LOGOS } from '../lib/demo-logos';

/**
 * The neutral university mark on the web (the owner's decision, option A, 2026-10-23): our own
 * letters in our own greys beside every university's name, never its logo, which shows only with
 * the university's written permission (none today). Beside the name the mark is decoration.
 */

afterEach(cleanup);

describe('UniversityMark', () => {
  it('draws our letters, hidden from assistive tech, and no logo without permission', () => {
    const { container } = render(<UniversityMark name="UKZN" />);
    const mark = container.querySelector('.uf-university-mark');
    expect(mark?.getAttribute('data-monogram')).toBe('UKZN');
    expect(mark?.getAttribute('aria-hidden')).toBe('true');
    expect(container.querySelector('img')).toBeNull();
  });

  it('keeps the letters out of the text, so the name is read and copied once', () => {
    const { container } = render(<UniversityName name="UJ" />);
    expect(container.textContent).toBe('UJ');
  });

  it('renders on the server, with no client code', () => {
    expect(renderToStaticMarkup(<UniversityName name="Wits" />)).toContain('data-monogram="Wits"');
  });

  it('shows a logo only from the permitted list, decorative beside the name', () => {
    const logos = { UCT: '/logos/uct.png' };
    const { container } = render(<UniversityMark name="UCT" logos={logos} />);
    const img = container.querySelector('img');
    expect(img?.getAttribute('src')).toBe('/logos/uct.png');
    expect(img?.getAttribute('alt')).toBe('');
    expect(container.querySelector('[data-monogram]')).toBeNull();
  });

  it('is named by the university when it stands alone', () => {
    render(<UniversityMark name="TUT" alone />);
    expect(screen.getByRole('img', { name: 'TUT' })).toBeTruthy();
    cleanup();
    render(<UniversityMark name="UCT" alone logos={{ UCT: '/logos/uct.png' }} />);
    expect(screen.getByRole('img', { name: words.logoAlt('UCT') })).toBeTruthy();
  });

  it('shows no demo logo unless the demo switch is on (off in every test build)', () => {
    const { container } = render(<UniversityMark name="Wits" />);
    expect(container.querySelector('img')).toBeNull();
    expect(DEMO_LOGOS_ON).toBe(false);
  });

  it('shows the judge demo its logo on a backing chip, decorative beside the name', () => {
    const { container } = render(<UniversityMark name="Wits" demoLogos={DEMO_UNIVERSITY_LOGOS} />);
    const chip = container.querySelector('.uf-demo-logo');
    expect(chip?.getAttribute('data-backing')).toBe('light');
    expect(chip?.querySelector('img')?.getAttribute('src')).toBe('/demo-logos/wits.svg');
    expect(chip?.querySelector('img')?.getAttribute('alt')).toBe('');
    expect(container.querySelector('[data-monogram]')).toBeNull();
  });

  it('finds the demo logo by the full name too, and puts UCT’s white artwork on a dark chip', () => {
    const { container } = render(
      <UniversityMark name="University of Cape Town" demoLogos={DEMO_UNIVERSITY_LOGOS} />,
    );
    expect(container.querySelector('.uf-demo-logo')?.getAttribute('data-backing')).toBe('dark');
  });

  it('keeps the grey mark for a university the demo has no logo for', () => {
    const { container } = render(<UniversityMark name="SMU" demoLogos={DEMO_UNIVERSITY_LOGOS} />);
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('[data-monogram]')?.getAttribute('data-monogram')).toBe('SMU');
  });

  // Wave 9 (2026-10-24): UJ's and UP's logos, from their own sites, join the other four.
  it.each([
    ['UJ', '/demo-logos/uj.png'],
    ['University of Johannesburg', '/demo-logos/uj.png'],
    ['UP', '/demo-logos/up.webp'],
    ['University of Pretoria', '/demo-logos/up.webp'],
  ])('shows the judge demo %s’s own logo', (name, src) => {
    const { container } = render(<UniversityMark name={name} demoLogos={DEMO_UNIVERSITY_LOGOS} />);
    expect(container.querySelector('.uf-demo-logo img')?.getAttribute('src')).toBe(src);
    expect(container.querySelector('[data-monogram]')).toBeNull();
  });

  it('has a demo logo for each of the six universities, by short and full name', () => {
    for (const [short, full] of [
      ['Wits', 'University of the Witwatersrand'],
      ['UJ', 'University of Johannesburg'],
      ['UP', 'University of Pretoria'],
      ['UCT', 'University of Cape Town'],
      ['TUT', 'Tshwane University of Technology'],
      ['UKZN', 'University of KwaZulu-Natal'],
    ] as const) {
      expect(DEMO_UNIVERSITY_LOGOS[short]).toBeDefined();
      expect(DEMO_UNIVERSITY_LOGOS[full]).toBe(DEMO_UNIVERSITY_LOGOS[short]);
    }
  });

  it('names a demo logo that stands alone by the university', () => {
    render(<UniversityMark name="TUT" alone demoLogos={DEMO_UNIVERSITY_LOGOS} />);
    expect(screen.getByRole('img', { name: words.logoAlt('TUT') })).toBeTruthy();
  });

  it('prefers a permitted logo over the demo one', () => {
    const { container } = render(
      <UniversityMark
        name="UCT"
        logos={{ UCT: '/logos/uct.png' }}
        demoLogos={DEMO_UNIVERSITY_LOGOS}
      />,
    );
    expect(container.querySelector('img')?.getAttribute('src')).toBe('/logos/uct.png');
    expect(container.querySelector('.uf-demo-logo')).toBeNull();
  });

  it('serves every demo logo from our own origin, and each file is there', () => {
    for (const logo of Object.values(DEMO_UNIVERSITY_LOGOS)) {
      expect(logo.src).toMatch(/^\/demo-logos\/[a-z]+\.(svg|png|webp)$/);
      expect(existsSync(resolve(HERE, '..', 'public', logo.src.slice(1)))).toBe(true);
    }
  });

  it('takes the letters from the short name when the full name is shown', () => {
    const { container } = render(
      <UniversityName name="University of the Witwatersrand" short="Wits" />,
    );
    expect(container.querySelector('[data-monogram]')?.getAttribute('data-monogram')).toBe('Wits');
    expect(container.textContent).toBe('University of the Witwatersrand');
  });
});

/**
 * Every place the web names a university as a label (a card's badge, a row, a heading) shows the
 * mark. Select options, sentences and page titles keep the plain name.
 */
const HERE = dirname(fileURLToPath(import.meta.url));
const MARKED = [
  'components/dashboard.tsx',
  'components/programme-card.tsx',
  'components/what-i-need.tsx',
  'components/goals.tsx',
  'components/offers.tsx',
  'components/modules.tsx',
  'components/campus.tsx',
  'components/artifacts.tsx',
  'app/(app)/applications/page.tsx',
  'app/(app)/subjects/subjects-view.tsx',
];

describe('where the web names a university', () => {
  it.each(MARKED)('%s shows the mark', (file) => {
    expect(readFileSync(resolve(HERE, '..', file), 'utf8')).toMatch(/<UniversityName\b/);
  });
});
