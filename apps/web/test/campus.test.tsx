// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import {
  campusSafetyLines,
  campusTour,
  crisisCard,
  type FirstWeekArtifact,
  firstWeek,
} from '@universityflow/agent';
import { CAMPUS_TEST_PROGRAMME, campusTestView } from '@universityflow/agent/testing';
import { en, SAFETY_TIPS } from '@universityflow/content';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UniversityChooser } from '../app/(app)/campus/university-chooser';
import { FirstWeekView } from '../app/(app)/first-week/first-week-view';
import { ArtifactView } from '../components/artifacts';
import { CampusTour, FirstWeekCard } from '../components/campus';
import { CrisisCard } from '../components/crisis-card';

/** Phase 5b's components over synthetic campus records (packages/agent/testing). */

afterEach(cleanup);

const preview = campusTestView(true);
const tour = (basis: 'accepted-offer' | 'chosen' = 'accepted-offer') => {
  const t = campusTour(preview, 'wits', basis);
  if (!t) throw new Error('fixture');
  return t;
};
const checklist = (): FirstWeekArtifact => {
  const c = firstWeek(preview, 'wits', 'accepted-offer', [], CAMPUS_TEST_PROGRAMME, 2028);
  if (!c) throw new Error('fixture');
  return c;
};

describe('CampusTour', () => {
  it('groups places by need, each with where, hours, a dialable phone and "open in maps"', () => {
    render(<CampusTour artifact={tour()} />);
    expect(
      screen.getByRole('heading', { name: en.campus.needs['health-and-safety'].title }),
    ).toBeTruthy();
    const security = within(screen.getByTestId('place-wits-test-security'));
    expect(security.getByText(/Ground floor, Test Building/)).toBeTruthy();
    expect(security.getByRole('link', { name: /^Call 011 000 0000/ }).getAttribute('href')).toBe(
      'tel:0110000000',
    );
    const maps = security.getByRole('link', { name: new RegExp(en.campus.openInMaps) });
    expect(maps.getAttribute('href')).toMatch(/^https:\/\/www\.google\.com\/maps\/search\//);
    expect(maps.getAttribute('target')).toBe('_blank');
    expect(
      screen.getAllByRole('link', { name: new RegExp(en.campus.officialMap) }).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByRole('link', { name: new RegExp(en.campus.virtualTour) }).length,
    ).toBeGreaterThan(0);
  });

  it('labels drafts, and shows no media and no embedded map (Q14: text and links)', () => {
    const { container } = render(<CampusTour artifact={tour()} />);
    const library = within(screen.getByTestId('place-wits-test-library'));
    expect(library.getByText(en.common.draftBadge)).toBeTruthy();
    expect(container.querySelector('img, video, iframe, audio')).toBeNull();
  });

  it('"Before you arrive" only for the accepted offer’s university', () => {
    render(<CampusTour artifact={tour()} />);
    expect(screen.getByRole('heading', { name: en.campus.beforeYouArriveTitle })).toBeTruthy();
    for (const tip of SAFETY_TIPS) expect(screen.getByText(en.safety.tips[tip].title)).toBeTruthy();
    cleanup();
    render(<CampusTour artifact={tour('chosen')} />);
    expect(screen.queryByRole('heading', { name: en.campus.beforeYouArriveTitle })).toBeNull();
  });

  it('each place’s maps and source links carry its name, and meet the 44px target (A3-19, A3-20)', () => {
    render(<CampusTour artifact={tour()} />);
    const security = within(screen.getByTestId('place-wits-test-security'));
    const maps = security.getByRole('link', {
      name: new RegExp(`^${en.campus.openInMaps}: Test security security`),
    });
    expect(maps.getAttribute('target')).toBe('_blank');
    const source = security.getByRole('link', {
      name: new RegExp(`^${en.common.officialSource}: Test security security`),
    });
    expect(source.className).toContain('min-h-11');
  });

  it('shows no "where" line and no "open in maps" for a place whose source prints neither (A13-11)', () => {
    const base = tour();
    const unplaced = {
      ...base,
      campuses: base.campuses.map((c) => ({
        ...c,
        needs: c.needs.map((n) => ({
          ...n,
          places: n.places.map((p) =>
            p.id === 'wits-test-security'
              ? { ...p, where: null, mapsUrl: null, appleMapsUrl: null }
              : p,
          ),
        })),
      })),
    };
    render(<CampusTour artifact={unplaced} />);
    const security = screen.getByTestId('place-wits-test-security');
    expect(security.textContent).not.toContain(`${en.campus.where}:`);
    expect(security.textContent).not.toContain(en.campus.openInMaps);
    // Its number and source are still there.
    expect(within(security).getByRole('link', { name: /^Call 011 000 0000/ })).toBeTruthy();
    expect(
      within(security).getByRole('link', { name: new RegExp(`^${en.common.officialSource}`) }),
    ).toBeTruthy();
    // Another place keeps both.
    const clinic = screen.getByTestId('place-wits-test-clinic');
    expect(clinic.textContent).toContain(`${en.campus.where}:`);
    expect(clinic.textContent).toContain(en.campus.openInMaps);
  });

  it('is honest when nothing is checked yet', () => {
    const empty = campusTour(preview, 'uj', 'chosen');
    if (!empty) throw new Error('fixture');
    render(<CampusTour artifact={empty} />);
    expect(screen.getByText(en.campus.notCheckedYet)).toBeTruthy();
  });
});

describe('FirstWeekCard', () => {
  it('lists the steps with their dates, the faculty office and the My modules link', () => {
    render(<FirstWeekCard artifact={checklist()} />);
    for (const step of Object.values(en.firstWeek.steps)) {
      expect(screen.getByText(step.title)).toBeTruthy();
    }
    // Only the closing date is published: no opening date is guessed.
    expect(screen.getByText(/^First-year registration closes:/)).toBeTruthy();
    expect(screen.getByText(/^Orientation:/)).toBeTruthy();
    expect(screen.getByText(/^Last day to change modules \(first semester\):/)).toBeTruthy();
    expect(screen.getByRole('link', { name: en.firstWeek.modulesLink }).getAttribute('href')).toBe(
      '/modules',
    );
    expect(screen.getByText(/Room 1, Test Building/)).toBeTruthy();
    expect(screen.getByTestId('first-week-progress').textContent).toBe(en.firstWeek.progress(0, 8));
  });

  it('ticks a step through its labelled checkbox', () => {
    const onToggle = vi.fn();
    render(<FirstWeekCard artifact={checklist()} onToggle={onToggle} />);
    fireEvent.click(screen.getByRole('checkbox', { name: en.firstWeek.steps.register.title }));
    expect(onToggle).toHaveBeenCalledWith('register', true);
  });

  it('the tick box keeps its size in a narrow row (A3-20), in the brand colour at the goals size (A2-18)', () => {
    render(<FirstWeekCard artifact={checklist()} onToggle={vi.fn()} />);
    const box = screen.getByRole('checkbox', { name: en.firstWeek.steps.register.title });
    expect(box.className).toContain('size-5');
    expect(box.className).toContain('shrink-0');
    expect(box.className).toContain('accent-brand');
  });

  it('says so when the calendar publishes no last day to change modules (gotcha 40)', () => {
    const c = checklist();
    if (!c.calendar) throw new Error('fixture');
    render(<FirstWeekCard artifact={{ ...c, calendar: { ...c.calendar, changeDeadlines: [] } }} />);
    expect(screen.getByText(en.firstWeek.changeDeadlineUnpublished)).toBeTruthy();
  });

  it('says so when the dates aren’t checked yet', () => {
    const none = firstWeek(preview, 'uj', 'chosen', [], null, 2028);
    if (!none) throw new Error('fixture');
    render(<FirstWeekCard artifact={none} />);
    expect(screen.getByText(en.firstWeek.noDates)).toBeTruthy();
  });
});

describe('one card-title size for every Phase 5 artifact (A2-20)', () => {
  it('the campus tour and the first-week card title in text-lg at level 2, like offers and modules', () => {
    render(<CampusTour artifact={tour()} />);
    const tourTitle = screen.getByRole('heading', { level: 2, name: tour().universityName });
    expect(tourTitle.className).toContain('text-lg');
    expect(tourTitle.className).not.toContain('text-xl');
    // A campus is one level down and one size down, and so is a need under it, so a long tour
    // shows where each campus starts.
    const campuses = screen.getAllByRole('heading', { level: 3 });
    expect(campuses.length).toBeGreaterThan(0);
    for (const h of campuses) expect(h.className).not.toMatch(/\btext-(lg|xl)\b/);
    const needs = screen.getAllByRole('heading', { level: 4 });
    expect(needs.length).toBeGreaterThan(0);
    for (const h of needs) expect(h.className).toContain('text-sm');
    cleanup();
    render(<FirstWeekCard artifact={checklist()} />);
    const weekTitle = screen.getByRole('heading', {
      level: 2,
      name: `${en.firstWeek.title}: ${checklist().universityName}`,
    });
    expect(weekTitle.className).toContain('text-lg');
    expect(weekTitle.className).not.toContain('text-xl');
  });
});

describe('the university chooser (owner, 2026-10-21: a dropdown, not a button each)', () => {
  const chooser = () =>
    render(
      <UniversityChooser
        path="/campus"
        options={[
          { id: 'wits', name: 'Wits' },
          { id: 'uj', name: 'UJ' },
          { id: 'up', name: 'UP' },
        ]}
        current="wits"
        hasTour
      />,
    );

  it('is one labelled dropdown of the other universities and one button, not a button each', () => {
    chooser();
    const select = screen.getByRole('combobox', { name: en.campus.universityLabel });
    const choices = within(select)
      .getAllByRole('option')
      .map((o) => o.textContent);
    expect(choices).toEqual([en.common.chooseOne, 'UJ', 'UP']);
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.getByRole('button', { name: en.campus.lookAround })).toBeTruthy();
    expect(screen.queryAllByRole('link')).toHaveLength(0);
  });

  it('works without JavaScript: a GET form to the same page with ?university=', () => {
    chooser();
    const form = screen.getByRole('combobox').closest('form');
    expect(form?.getAttribute('action')).toBe('/campus');
    expect(form?.getAttribute('method')).toBe('get');
    expect(screen.getByRole('combobox').getAttribute('name')).toBe('university');
    // Nothing chosen yet can't be sent: the empty choice is required and can't be picked.
    expect(screen.getByRole('combobox').hasAttribute('required')).toBe(true);
  });
});

describe('FirstWeekView keeps keyboard focus through a tick (A3-12, WCAG 2.4.3)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('stays on the checkbox while it saves and after "Saved"; a second press sends nothing', async () => {
    const ticked = {
      ...checklist(),
      steps: checklist().steps.map((s) =>
        s.id === 'register' ? { ...s, doneAt: '2028-02-02T09:00:00.000Z' } : s,
      ),
    };
    const waiting: Array<() => void> = [];
    const fetch = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          waiting.push(() => resolve(Response.json({ checklist: ticked })));
        }),
    );
    vi.stubGlobal('fetch', fetch);
    render(<FirstWeekView initial={checklist()} />);
    const box = screen.getByRole('checkbox', {
      name: en.firstWeek.steps.register.title,
    }) as HTMLInputElement;
    box.focus();
    fireEvent.click(box);
    expect(box.disabled).toBe(false);
    expect(box.getAttribute('aria-disabled')).toBe('true');
    expect(document.activeElement).toBe(box);
    fireEvent.click(box);
    expect(fetch).toHaveBeenCalledTimes(1);
    waiting.shift()?.();
    expect(await screen.findByText(en.firstWeek.saved)).toBeTruthy();
    expect(box.checked).toBe(true);
    expect(document.activeElement).toBe(box);
  });
});

describe('the crisis card’s campus lines', () => {
  it('shows the verified lines, each dialable, and never a draft', () => {
    const card = crisisCard(preview.helplines, ['suicide'], campusSafetyLines(preview, 'wits'));
    render(<CrisisCard artifact={card} />);
    const campus = within(screen.getByTestId('crisis-campus'));
    expect(campus.getByRole('heading', { name: en.crisis.campusTitle('Wits') })).toBeTruthy();
    expect(campus.getAllByRole('link', { name: /^Call 011 000 0000/ })).toHaveLength(3);
    expect(screen.queryByText(/draft-clinic|Draft Campus/)).toBeNull();
  });

  it('a line whose source prints no building shows its campus alone, no empty "where" (A13-11)', () => {
    const lines = campusSafetyLines(preview, 'wits');
    if (!lines) throw new Error('fixture');
    const unplaced = {
      ...lines,
      lines: lines.lines.map((l) =>
        l.id === 'wits-test-clinic' ? { ...l, where: null, hours: null } : l,
      ),
    };
    render(<CrisisCard artifact={crisisCard(preview.helplines, ['suicide'], unplaced)} />);
    const campus = within(screen.getByTestId('crisis-campus'));
    const item = campus.getByText('Test clinic clinic').closest('li');
    const texts = [...(item?.querySelectorAll('p') ?? [])].map((p) => p.textContent);
    expect(texts).toContain('Test Campus');
    expect(texts.join(' ')).not.toMatch(/Test Campus:|null/);
    expect(campus.getAllByRole('link', { name: /^Call 011 000 0000/ })).toHaveLength(3);
  });

  it('is absent without campus lines', () => {
    render(<CrisisCard artifact={crisisCard(preview.helplines, ['suicide'])} />);
    expect(screen.queryByTestId('crisis-campus')).toBeNull();
  });

  it('the chat renders the tour and the checklist artifacts', () => {
    render(<ArtifactView artifact={tour()} />);
    expect(screen.getByRole('link', { name: new RegExp(en.campus.title) })).toBeTruthy();
    cleanup();
    render(<ArtifactView artifact={checklist()} />);
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
  });
});
