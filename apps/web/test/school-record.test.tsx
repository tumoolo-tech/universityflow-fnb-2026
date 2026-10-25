// @vitest-environment jsdom

import { cleanup, render, screen, within } from '@testing-library/react';
import { type SubjectMark, schoolRecord } from '@universityflow/admissions';
import { subject } from '@universityflow/catalogue/client';
import { en } from '@universityflow/content';
import { afterEach, describe, expect, it } from 'vitest';
import { SchoolRecordSection } from '../components/school-record';

/** The school record on My results, web (planning.md §18.7 C2). Synthetic marks (hard rule 4). */

const t = en.schoolRecord;

const GRADE_10: ReadonlyArray<SubjectMark> = [
  { subject: 'english-hl', percent: 61 },
  { subject: 'mathematics', percent: 29 },
  { subject: 'life-sciences', percent: 80 },
];
const GRADE_11: ReadonlyArray<SubjectMark> = [
  { subject: 'english-hl', percent: 70 },
  { subject: 'mathematics', percent: 30 },
  { subject: 'physical-sciences', percent: 79 },
];

const RECORD = schoolRecord([
  { kind: 'grade-10-final', confirmedAt: new Date('2026-12-01T10:00:00Z'), marks: GRADE_10 },
  { kind: 'grade-11-june', confirmedAt: new Date('2027-07-01T10:00:00Z'), marks: GRADE_11 },
]);

afterEach(cleanup);

describe('SchoolRecordSection', () => {
  it('lets a keyboard reach the table when it scrolls sideways on a phone (axe scrollable-region-focusable)', () => {
    render(<SchoolRecordSection record={RECORD} />);
    const scroller = screen.getByRole('region', { name: t.caption });
    expect(scroller.getAttribute('tabindex')).toBe('0');
    expect(within(scroller).getByRole('table')).toBeTruthy();
  });

  it('shows nothing before a report is confirmed', () => {
    const { container } = render(<SchoolRecordSection record={schoolRecord([])} />);
    expect(container.innerHTML).toBe('');
  });

  it('puts every confirmed report side by side, oldest first', () => {
    render(<SchoolRecordSection record={RECORD} />);
    const section = screen.getByRole('region', { name: t.title });
    const headers = within(section)
      .getAllByRole('columnheader')
      .map((h) => h.textContent ?? '');
    expect(headers[0]).toBe(t.subject);
    expect(headers[1]).toContain(en.reportKinds['grade-10-final']);
    expect(headers[2]).toContain(en.reportKinds['grade-11-june']);
    expect(headers[3]).toBe(t.changeHeading);
  });

  it('shows each mark with its achievement level, and an empty cell where a report has none', () => {
    render(<SchoolRecordSection record={RECORD} />);
    const row = (id: Parameters<typeof subject>[0]) =>
      screen.getByRole('rowheader', { name: subject(id).name }).closest('tr') as HTMLElement;
    const maths = within(row('mathematics')).getAllByRole('cell');
    expect(maths[0]?.textContent).toBe(`${t.percent(29)}${t.level(1)}`);
    expect(maths[1]?.textContent).toBe(`${t.percent(30)}${t.level(2)}`);
    expect(maths[2]?.textContent).toBe(t.change(1));
    const physics = within(row('physical-sciences')).getAllByRole('cell');
    expect(physics[0]?.textContent).toBe(t.noMark);
    expect(physics[1]?.textContent).toBe(`${t.percent(79)}${t.level(6)}`);
    expect(physics[2]?.textContent).toBe(t.noChange);
    const life = within(row('life-sciences')).getAllByRole('cell');
    expect(life[0]?.textContent).toBe(`${t.percent(80)}${t.level(7)}`);
  });

  it('says who entered every mark: each mark’s column says "Entered by you"', () => {
    render(<SchoolRecordSection record={RECORD} />);
    const table = screen.getByRole('table');
    const headers = within(table).getAllByRole('columnheader');
    let marks = 0;
    // Every subject's row: not the header row, nor the pass row at the end.
    for (const tr of within(table).getAllByRole('row').slice(1, -1)) {
      within(tr)
        .getAllByRole('cell')
        .forEach((cell, i) => {
          if (cell.textContent === t.noMark || i >= RECORD.reports.length) return;
          marks += 1;
          // Column i + 1: the first column is the subject.
          expect(headers[i + 1]?.textContent).toContain(t.source.learner);
        });
    }
    expect(marks).toBe(RECORD.rows.flatMap((r) => r.marks).filter(Boolean).length);
  });

  it('gives the pass each report’s marks would earn, the key to the levels and how to correct a mark', () => {
    render(<SchoolRecordSection record={RECORD} />);
    const passRow = screen.getByRole('rowheader', { name: t.pass }).closest('tr') as HTMLElement;
    expect(
      within(passRow)
        .getAllByRole('cell')
        .map((c) => c.textContent),
    ).toEqual([
      en.passTypes[RECORD.reports[0]?.pass ?? 'none'],
      en.passTypes[RECORD.reports[1]?.pass ?? 'none'],
      '',
    ]);
    expect(screen.getByText(t.levelRange(7, 80, 100))).toBeTruthy();
    expect(screen.getByText(t.levelRange(1, 0, 29))).toBeTruthy();
    expect(screen.getByRole('link', { name: t.correctLink }).getAttribute('href')).toBe(
      '/documents',
    );
  });
});
