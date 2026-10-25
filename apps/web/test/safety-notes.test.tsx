// @vitest-environment jsdom

import { cleanup, render, screen, within } from '@testing-library/react';
import { campusTour, firstWeek, type SafetyNoteView } from '@universityflow/agent';
import { campusTestView, SAFETY_TEST_NOTES, safetyTestView } from '@universityflow/agent/testing';
import { en } from '@universityflow/content';
import { afterEach, describe, expect, it } from 'vitest';
import { CampusTour, FirstWeekCard } from '../components/campus';
import { SafetyNotes } from '../components/safety-notes';
import { formatDate } from '../lib/client/api';

/** Safety notes on the web (Phase 5e-3), over synthetic records (packages/agent/testing). */

afterEach(cleanup);

const t = en.safetyNotes;
const tourOf = (includeDrafts: boolean) => {
  const tour = campusTour(safetyTestView(includeDrafts), 'wits', 'chosen');
  if (!tour) throw new Error('fixture');
  return tour;
};
const noteOf = (id: string) => {
  const tour = tourOf(true);
  const all = [
    ...(tour.universitySafetyNotes ?? []),
    ...tour.campuses.flatMap((c) => c.safetyNotes ?? []),
  ];
  const note = all.find((n) => n.id === id);
  if (!note) throw new Error('fixture');
  return note;
};

describe('SafetyNotes', () => {
  it('quotes the university as a blockquote, with its area, days, dates and source', () => {
    render(
      <SafetyNotes notes={[noteOf(SAFETY_TEST_NOTES.campus)]} universityName="Wits" title="Test" />,
    );
    const quote = screen.getByText('Test campus advice, quoted exactly.').closest('blockquote');
    expect(quote?.className.split(' ')).toEqual(
      expect.arrayContaining(['border-l-rule', 'border-line-strong']),
    );
    expect(screen.getByText(t.says('Wits'))).toBeTruthy();
    expect(screen.getByText(t.when('Monday to Friday', '18:00 – 06:00'))).toBeTruthy();
    expect(screen.getByText(t.lastChecked(formatDate('2027-11-30')))).toBeTruthy();
    expect(screen.getByText(t.publishedOn(formatDate('2027-11-01')))).toBeTruthy();
    const source = screen.getByRole('link', { name: new RegExp(en.common.officialSource) });
    expect(source.getAttribute('href')).toBe('https://www.wits.ac.za/test-safety/');
  });

  it('says what to do for the kind of note, and the area only in the university’s words', () => {
    render(
      <SafetyNotes
        notes={[noteOf(SAFETY_TEST_NOTES.university)]}
        universityName="Wits"
        title="Test"
      />,
    );
    expect(screen.getByRole('heading', { name: 'Test' })).toBeTruthy();
    expect(screen.getByText(t.whatToDo['incident-advisory'])).toBeTruthy();
    expect(screen.getByText(t.area('Test Park / Test Hill'))).toBeTruthy();
  });

  it('gives three one-tap calls, each named: campus security, 10111 and 112', () => {
    render(
      <SafetyNotes notes={[noteOf(SAFETY_TEST_NOTES.campus)]} universityName="Wits" title="Test" />,
    );
    const calls = screen.getAllByRole('link', { name: /^Call / });
    expect(calls.map((a) => a.getAttribute('href'))).toEqual([
      'tel:0110000000',
      'tel:10111',
      'tel:112',
    ]);
    expect(
      screen.getByRole('link', { name: 'Call 011 000 0000: Test security security, Test Campus' }),
    ).toBeTruthy();
    expect(
      screen.getByRole('link', { name: 'Call 10111: South African Police Service' }),
    ).toBeTruthy();
    expect(
      screen.getByRole('link', { name: 'Call 112: Emergency from a cell phone' }),
    ).toBeTruthy();
  });

  it('lists notes as a list, and labels a draft (preview) as not checked', () => {
    render(
      <SafetyNotes notes={[noteOf(SAFETY_TEST_NOTES.draft)]} universityName="Wits" title="Test" />,
    );
    const list = screen.getByRole('list', { name: 'Test' });
    expect(within(list).getAllByRole('listitem').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(en.common.draftBadge)).toBeTruthy();
    expect(screen.getByText(t.notCheckedYet)).toBeTruthy();
    expect(screen.queryByText(/^Last checked/)).toBeNull();
  });

  it('never shows a note without campus security to call, or without the emergency lines', () => {
    const note = noteOf(SAFETY_TEST_NOTES.campus);
    const broken: SafetyNoteView[] = [
      { ...note, id: 'no-security', security: [] },
      { ...note, id: 'no-emergency', emergency: [] },
    ];
    const { container } = render(<SafetyNotes notes={broken} universityName="Wits" title="Test" />);
    expect(container.textContent).toBe('');
  });
});

describe('the campus tour and the first-week checklist', () => {
  it('say "No warning here doesn’t mean it’s safe." on every tour, with notes or none', () => {
    render(<CampusTour artifact={tourOf(false)} />);
    expect(screen.getByText(t.noWarning)).toBeTruthy();
    cleanup();
    const plain = campusTour(campusTestView(false), 'wits', 'chosen');
    if (!plain) throw new Error('fixture');
    render(<CampusTour artifact={plain} />);
    expect(screen.getByText(t.noWarning)).toBeTruthy();
    expect(screen.queryByRole('blockquote')).toBeNull();
  });

  it('show the university-wide notes once and each campus’s with its campus, never as a map', () => {
    const { container } = render(<CampusTour artifact={tourOf(false)} />);
    expect(screen.getAllByText('Test university-wide advice, quoted exactly.')).toHaveLength(1);
    const campus = within(screen.getByRole('region', { name: 'Test Campus, Testville' }));
    expect(campus.getByText('Test campus advice, quoted exactly.')).toBeTruthy();
    expect(campus.getByRole('heading', { name: t.campusTitle('Test Campus') })).toBeTruthy();
    expect(screen.getByRole('heading', { name: t.wholeUniversity })).toBeTruthy();
    expect(screen.queryByText('Test expired advice, quoted exactly.')).toBeNull();
    expect(container.querySelector('svg, canvas, iframe, img')).toBeNull();
  });

  it('show every note in the first-week checklist, beside the safety guidance', () => {
    const list = firstWeek(safetyTestView(false), 'wits', 'chosen', [], null, 2028);
    if (!list) throw new Error('fixture');
    render(<FirstWeekCard artifact={list} />);
    expect(screen.getByRole('heading', { name: t.title('Wits') })).toBeTruthy();
    expect(screen.getByText('Test campus advice, quoted exactly.')).toBeTruthy();
    expect(screen.getByText('Test university-wide advice, quoted exactly.')).toBeTruthy();
    expect(screen.getByText(t.noWarning)).toBeTruthy();
  });
});
