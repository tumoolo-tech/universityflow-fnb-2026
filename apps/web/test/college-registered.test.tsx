// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { type College, collegeViewOf, registrationCheck } from '@universityflow/catalogue';
import { DHET_COLLEGE_LIST } from '@universityflow/catalogue/colleges';
import { colleges as words } from '@universityflow/content';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CollegeRegistered } from '../app/colleges/registered/college-registered';

/**
 * "Is this college registered?" (planning.md §19.1): open to anyone, a plain GET form, words from
 * packages/content, DHET's own links. A yes only for a whole listed name; a plain warning for any
 * other; "can't check yet" while nobody has verified our copy of the list. Synthetic records.
 */

vi.mock('@/lib/server/session', () => ({ currentStudent: async () => null }));

const COLLEGE: College = {
  sourceUrl: 'https://www.dhet.gov.za/list.pdf',
  academicYear: 2026,
  id: 'example',
  type: 'public-tvet-college',
  dhetName: 'Example TVET College',
  province: 'Gauteng',
  site: {
    sourceUrl: 'https://www.example-college.edu.za/',
    academicYear: 2027,
    name: 'Example College',
    abbreviations: ['EXC'],
    website: 'https://www.example-college.edu.za/',
    domains: ['example-college.edu.za'],
    mainTown: null,
    applyUrl: null,
  },
};
const TODAY = new Date('2026-10-24T10:00:00Z');
const preview = collegeViewOf({ colleges: [COLLEGE], programmes: [] }, TODAY, {
  includeDrafts: true,
});
const production = collegeViewOf({ colleges: [COLLEGE], programmes: [] }, TODAY, {
  includeDrafts: false,
});

function show(view = preview, query: string | null = null) {
  return render(
    <CollegeRegistered
      view={view}
      query={query}
      check={query === null ? null : registrationCheck(view, query)}
    />,
  );
}

describe('/colleges/registered', () => {
  afterEach(cleanup);

  it('asks for a name in a plain GET form that works without JavaScript', () => {
    const { container } = show();
    expect(screen.getByRole('heading', { level: 1, name: words.check.title })).toBeTruthy();
    const form = container.querySelector('form');
    expect(form?.getAttribute('method')).toBe('get');
    expect(form?.getAttribute('action')).toBe('/colleges/registered');
    const box = screen.getByRole('searchbox', { name: words.check.label });
    expect(box.getAttribute('name')).toBe('name');
    expect(box.getAttribute('aria-describedby')).toBe('college-name-hint');
  });

  it("says yes for a listed name, with DHET's name and province and the college's own site", () => {
    show(preview, 'example fet college');
    expect(screen.getByText(words.check.listed('Example College'))).toBeTruthy();
    expect(screen.getByText(words.check.listedAs('Example TVET College', 'Gauteng'))).toBeTruthy();
    expect(screen.getByRole('link', { name: /College website/ }).getAttribute('href')).toBe(
      'https://www.example-college.edu.za/',
    );
  });

  it('warns plainly, never a yes, for a name that only looks like one on the list', () => {
    show(preview, 'Example Private College');
    expect(screen.queryByText(words.check.listed('Example College'))).toBeNull();
    expect(screen.getByRole('alert').textContent).toContain(
      words.check.notFound('Example Private College'),
    );
    expect(screen.getByText(words.check.notFoundWarning)).toBeTruthy();
  });

  it('offers listed names that share the words only as "did you mean", never as a match', () => {
    show(preview, 'Example');
    expect(screen.getByText(words.check.similar)).toBeTruthy();
    expect(screen.getByText('Example TVET College (Gauteng)')).toBeTruthy();
  });

  it("says it can't check yet in production while no college record is verified (no false no)", () => {
    show(production, 'Example TVET College');
    expect(screen.getByText(words.check.unavailable)).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it("always links DHET's own pages, and labels preview data", () => {
    show();
    const links = screen.getAllByRole('link').map((a) => a.getAttribute('href'));
    expect(links).toContain(DHET_COLLEGE_LIST.tvetCollegesPage);
    expect(links).toContain(DHET_COLLEGE_LIST.registersPage);
    expect(screen.getByText(words.check.draftNotice)).toBeTruthy();
  });
});
