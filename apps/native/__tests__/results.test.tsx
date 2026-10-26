import { fireEvent, render, within } from '@testing-library/react-native';
import { en } from '@universityflow/content/app';
import { useRouter } from 'expo-router';
import ResultsScreen from '../app/results';
import { saveToken } from '../lib/session';
import { serve } from '../test-utils/fake-api';
import { programme } from '../test-utils/fixtures';

const report = { kind: 'grade-11-final', confirmedAt: '2026-10-01T10:00:00Z' };

function results(overrides: Record<string, unknown> = {}) {
  return {
    report,
    shortlist: [],
    results: {
      basis: 'admission',
      passProjected: 'bachelor',
      qualifyNow: [programme({ programmeId: 'p-qualify', name: 'BSc Computer Science' })],
      onTrack: [],
      close: [
        programme({
          programmeId: 'p-close',
          name: 'BSc Engineering',
          verdict: 'close',
          score: 38,
          requiredScore: 42,
          scoreGap: 4,
          shortfalls: [
            {
              subjects: ['mathematics'],
              kind: 'subject',
              count: 1,
              targetPercent: 70,
              percent: 64,
              subject: 'mathematics',
              shortBy: 6,
            },
            {
              subjects: [],
              kind: 'other-subjects',
              count: 2,
              targetPercent: 50,
              percent: null,
              subject: null,
              shortBy: null,
            },
          ],
          draft: true,
        }),
      ],
      planB: [
        programme({
          programmeId: 'p-planb',
          name: 'Extended BSc',
          qualification: 'extended-degree',
          requiredScore: null,
          passRequired: 'bachelor',
          passMet: false,
        }),
      ],
      checked: 3,
      includesDrafts: false,
      ...overrides,
    },
  };
}

beforeEach(async () => {
  await saveToken('tok');
});

describe('My results', () => {
  it('groups programmes into Qualify now, Close and Plan B, as the server did', async () => {
    serve({ 'GET /api/results': { json: results() } });
    const screen = await render(<ResultsScreen />);
    const qualify = await screen.findByTestId('section-qualify-now');
    expect(within(qualify).getByText(`${en.results.groups.qualifyNow} (1)`)).toBeTruthy();
    expect(screen.getByText(`${en.results.groups.close} (1)`)).toBeTruthy();
    expect(screen.getByText(`${en.results.groups.planB} (1)`)).toBeTruthy();
    expect(screen.getByRole('header', { name: 'BSc Computer Science' })).toBeTruthy();
    expect(screen.getByRole('header', { name: 'BSc Engineering' })).toBeTruthy();
    expect(screen.getByRole('header', { name: 'Extended BSc' })).toBeTruthy();
  });

  it('on Grade 10 marks shows On track and Close, never Qualify now or Plan B (G10-3)', async () => {
    const grade10 = results({
      basis: 'progress',
      qualifyNow: [],
      planB: [],
      onTrack: [
        programme({
          programmeId: 'p-on-track',
          name: 'BSc Computer Science',
          verdict: 'on-track',
        }),
      ],
    });
    serve({
      'GET /api/results': {
        json: { ...grade10, report: { ...report, kind: 'grade-10-final' } },
      },
    });
    const screen = await render(<ResultsScreen />);
    const onTrack = await screen.findByTestId('section-on-track');
    expect(within(onTrack).getByText(`${en.results.groups.onTrack} (1)`)).toBeTruthy();
    expect(screen.getByText(en.results.leadGrade10)).toBeTruthy();
    expect(screen.queryByTestId('section-qualify-now')).toBeNull();
    expect(screen.queryByTestId('section-plan-b')).toBeNull();
    expect(screen.queryByText(new RegExp(en.results.groups.qualifyNow))).toBeNull();
  });

  it('shows each card’s score, the gap and exactly what to improve', async () => {
    serve({ 'GET /api/results': { json: results() } });
    const screen = await render(<ResultsScreen />);
    const card = within(await screen.findByTestId('programme-p-close'));
    // Whose scale, its most, and the course's minimum (RT-03): never "38 of 56 · Needs APS 42".
    expect(card.getByText(en.results.scoreOn('Wits', 'APS', 38, 56))).toBeTruthy();
    expect(card.getByText(en.results.asksAtLeast(42))).toBeTruthy();
    expect(card.queryByText(en.results.yourScore('APS', 38, 56))).toBeNull();
    expect(card.getByText(`• ${en.results.pointsShort(4, 'APS')}`)).toBeTruthy();
    expect(card.getByText(`• ${en.results.improve('Mathematics', 64, 70)}`)).toBeTruthy();
    expect(card.getByText(`• ${en.results.improveOthers(2, 50)}`)).toBeTruthy();

    const planB = within(screen.getByTestId('programme-p-planb'));
    expect(planB.getByText(en.results.noMinimum)).toBeTruthy();
    expect(planB.getByText(`• ${en.results.passNeeded(en.passTypes.bachelor)}`)).toBeTruthy();
  });

  it('labels every draft programme, and only those (hard rule 3)', async () => {
    serve({ 'GET /api/results': { json: results() } });
    const screen = await render(<ResultsScreen />);
    expect(await screen.findByTestId('draft-p-close')).toHaveTextContent(en.common.draftBadge);
    expect(screen.queryByTestId('draft-p-qualify')).toBeNull();
    expect(screen.queryByTestId('draft-p-planb')).toBeNull();
    expect(screen.queryByTestId('drafts-notice')).toBeNull();
  });

  it('warns above the list whenever the results include drafts', async () => {
    serve({ 'GET /api/results': { json: results({ includesDrafts: true }) } });
    const screen = await render(<ResultsScreen />);
    expect(await screen.findByTestId('drafts-notice')).toHaveTextContent(en.common.draftNotice, {
      exact: false,
    });
  });

  it('shows “Since your June report…” when the current report moved courses (Phase 4c)', async () => {
    serve({
      'GET /api/results': { json: results() },
      'GET /api/rechecks': {
        json: {
          recheck: {
            reportKind: 'grade-12-september',
            previousKind: 'grade-12-june',
            createdAt: '2027-09-20T08:00:00Z',
            includesDrafts: false,
            moves: [
              {
                programmeId: 'p-close',
                name: 'BSc Engineering',
                universityName: 'Wits',
                from: 'close',
                to: 'qualify-now',
                direction: 'up',
              },
            ],
          },
        },
      },
    });
    const screen = await render(<ResultsScreen />);
    const card = within(await screen.findByTestId('recheck-card'));
    expect(card.getByText(en.recheck.title(en.reportKinds['grade-12-june']))).toBeTruthy();
    expect(card.getByText(`${en.recheck.up} (1)`)).toBeTruthy();
    expect(
      card.getByText(
        `• Wits: BSc Engineering, ${en.recheck.move(en.recheck.standings.close, en.recheck.standings['qualify-now'])}`,
      ),
    ).toBeTruthy();
  });

  it('shows no re-check card when there is none, or it fails to load', async () => {
    serve({
      'GET /api/results': { json: results() },
      'GET /api/rechecks': { json: { recheck: null } },
    });
    const screen = await render(<ResultsScreen />);
    expect(await screen.findByTestId('section-qualify-now')).toBeTruthy();
    expect(screen.queryByTestId('recheck-card')).toBeNull();
  });

  it('with no report yet, leads to the report upload in the app', async () => {
    serve({ 'GET /api/results': { json: { report: null, results: null } } });
    const screen = await render(<ResultsScreen />);
    expect(await screen.findByText(en.results.noReport)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: en.documents.uploadReport }));
    expect(useRouter().push).toHaveBeenCalledWith('/upload');
  });

  it('explains a consent refusal with the content string', async () => {
    serve({ 'GET /api/results': { status: 403, json: { error: 'consent', detail: null } } });
    const screen = await render(<ResultsScreen />);
    expect(await screen.findByText(en.errors.consent)).toBeTruthy();
    expect(screen.getByRole('button', { name: en.common.tryAgain })).toBeTruthy();
  });
});
