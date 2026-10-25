import { fireEvent, render, within } from '@testing-library/react-native';
import { type SubjectMark, schoolRecord } from '@universityflow/admissions';
import { subject } from '@universityflow/catalogue/client';
import { en } from '@universityflow/content/app';
import { useRouter } from 'expo-router';
import ResultsScreen from '../app/results';
import { saveToken } from '../lib/session';
import { serve } from '../test-utils/fake-api';

/** The school record on My results, in the app (planning.md §18.7 C2). Synthetic marks only. */

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

function response(record: unknown) {
  return {
    report: { kind: 'grade-11-june', confirmedAt: '2027-07-01T10:00:00Z' },
    shortlist: [],
    results: {
      basis: 'progress',
      passProjected: 'bachelor',
      qualifyNow: [],
      onTrack: [],
      close: [],
      planB: [],
      checked: 0,
      includesDrafts: false,
    },
    ...(record === undefined ? {} : { record }),
  };
}

beforeEach(async () => {
  await saveToken('tok');
});

describe('My school record (app)', () => {
  it('shows every confirmed report, its date, who entered it and the pass its marks give', async () => {
    serve({ 'GET /api/results': { json: response(RECORD) } });
    const screen = await render(<ResultsScreen />);
    const card = within(await screen.findByTestId('school-record'));
    expect(card.getByRole('header', { name: t.title })).toBeTruthy();
    for (const r of RECORD.reports) {
      const column = within(card.getByTestId(`record-report-${r.kind}`));
      expect(column.getByText(en.reportKinds[r.kind])).toBeTruthy();
      expect(column.getByText(t.source.learner)).toBeTruthy();
      expect(column.getByText(`${t.pass}: ${en.passTypes[r.pass]}`)).toBeTruthy();
    }
  });

  it('labels every mark with its report, level and who entered it, for a screen reader too', async () => {
    serve({ 'GET /api/results': { json: response(RECORD) } });
    const screen = await render(<ResultsScreen />);
    const card = within(await screen.findByTestId('school-record'));
    let marks = 0;
    for (const row of RECORD.rows) {
      row.marks.forEach((m, i) => {
        const report = RECORD.reports[i];
        if (!m || !report) return;
        marks += 1;
        const label = t.markLabel(
          en.reportKinds[report.kind],
          subject(row.subject).name,
          m.percent,
          m.level,
          t.source[m.source],
        );
        expect(label).toContain(t.source.learner);
        const mark = within(card.getByLabelText(label));
        expect(mark.getByText(t.percent(m.percent))).toBeTruthy();
        expect(mark.getByText(t.level(m.level))).toBeTruthy();
      });
    }
    expect(marks).toBe(6);
    // Level boundaries as the record gave them: 29% is level 1, 30% level 2, 80% level 7.
    expect(card.getByLabelText(/Mathematics, final Grade 10 report: 29%, level 1/)).toBeTruthy();
    expect(card.getByLabelText(/Mathematics, Grade 11 June report: 30%, level 2/)).toBeTruthy();
  });

  it('gives the change since the first report, the key to the levels, and how to correct a mark', async () => {
    serve({ 'GET /api/results': { json: response(RECORD) } });
    const screen = await render(<ResultsScreen />);
    const card = within(await screen.findByTestId('school-record'));
    expect(card.getByText(`${t.changeHeading}: ${t.change(9)}`)).toBeTruthy();
    expect(card.getAllByText(`${t.changeHeading}: ${t.noChange}`)).toHaveLength(2);
    expect(card.getByText(t.levelRange(7, 80, 100))).toBeTruthy();
    expect(card.getByText(t.levelRange(1, 0, 29))).toBeTruthy();
    await fireEvent.press(card.getByRole('button', { name: t.correctLink }));
    expect(useRouter().push).toHaveBeenCalledWith('/upload');
  });

  it('shows no record when the server sends none, or an empty one', async () => {
    serve({ 'GET /api/results': { json: response(undefined) } });
    const screen = await render(<ResultsScreen />);
    expect(await screen.findByText(t.resultsLeadInterim)).toBeTruthy();
    expect(screen.queryByTestId('school-record')).toBeNull();
    await screen.unmount();
    serve({ 'GET /api/results': { json: response(schoolRecord([])) } });
    const empty = await render(<ResultsScreen />);
    expect(await empty.findByText(t.resultsLeadInterim)).toBeTruthy();
    expect(empty.queryByTestId('school-record')).toBeNull();
  });
});
