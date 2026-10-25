import { fireEvent, render, within } from '@testing-library/react-native';
import type { WhatINeedResult } from '@universityflow/admissions';
import { en } from '@universityflow/content/app';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Linking } from 'react-native';
import WhatINeedScreen from '../app/what-i-need/[programmeId]';
import { ArtifactCard } from '../components/artifact-card';
import { ProgrammeCard } from '../components/programme-card';
import { blockerText } from '../components/what-i-need';
import { saveToken } from '../lib/session';
import { serve } from '../test-utils/fake-api';
import { programme } from '../test-utils/fixtures';

/** A plan as the server returns it: synthetic, computed by packages/admissions there. */
function result(overrides: Partial<WhatINeedResult['plan']> = {}, draft = false): WhatINeedResult {
  return {
    programmeId: 'uj-bcom-accounting',
    universityId: 'uj',
    universityName: 'UJ',
    name: 'BCom Accounting',
    sourceUrl: 'https://www.uj.ac.za/',
    methodSourceUrl: 'https://www.uj.ac.za/',
    academicYear: 2027,
    draft,
    plan: {
      status: 'reachable',
      verdictNow: 'close',
      subjects: [
        {
          subject: 'mathematics',
          current: 55,
          target: 60,
          gap: 5,
          reasons: ['subject-minimum'],
          requiredByProgramme: true,
        },
        {
          subject: 'english-hl',
          current: 70,
          target: 70,
          gap: 0,
          reasons: [],
          requiredByProgramme: true,
        },
      ],
      totalGap: 5,
      score: {
        methodId: 'uj-aps',
        label: 'APS',
        unit: 'points',
        maximum: 42,
        required: 28,
        now: 27,
        atTarget: 28,
      },
      pass: { required: 'bachelor', now: 'bachelor', atTarget: 'bachelor' },
      blockers: [],
      ...overrides,
    },
  };
}

const report = { kind: 'grade-12-june', confirmedAt: '2027-07-01T10:00:00Z' };

beforeEach(async () => {
  await saveToken('tok');
  (useLocalSearchParams as jest.Mock).mockReturnValue({ programmeId: 'uj-bcom-accounting' });
});

describe('What I need (Phase 4c)', () => {
  it('shows each subject now and what to aim for, as the server computed it', async () => {
    const calls = serve({
      'GET /api/what-i-need/uj-bcom-accounting': { json: { report, result: result() } },
    });
    const screen = await render(<WhatINeedScreen />);
    const maths = within(await screen.findByTestId('target-mathematics'));
    expect(
      maths.getByText(`${en.whatINeed.row('Mathematics', 55, 60)} (${en.whatINeed.gapValue(5)})`),
    ).toBeTruthy();
    expect(maths.getByText(en.whatINeed.reasons['subject-minimum'])).toBeTruthy();
    expect(
      within(screen.getByTestId('target-english-hl')).getByText(
        en.whatINeed.row('English Home Language', 70, 70),
      ),
    ).toBeTruthy();
    expect(
      screen.getByText(`${en.whatINeed.statuses.reachable} ${en.whatINeed.totalGap(5)}`),
    ).toBeTruthy();
    expect(screen.getByText(en.whatINeed.howChosen)).toBeTruthy();
    expect(screen.queryByTestId('what-i-need-draft')).toBeNull();
    expect(calls[0]?.headers['authorization']).toBe('Bearer tok');
  });

  it('labels a draft (hard rule 3)', async () => {
    serve({
      'GET /api/what-i-need/uj-bcom-accounting': { json: { report, result: result({}, true) } },
    });
    const screen = await render(<WhatINeedScreen />);
    expect(await screen.findByTestId('what-i-need-draft')).toHaveTextContent(en.common.draftBadge);
    expect(screen.getByText(en.common.draftNotice)).toBeTruthy();
  });

  it('says plainly when no marks would do it', async () => {
    serve({
      'GET /api/what-i-need/uj-bcom-accounting': {
        json: {
          report,
          result: result({
            status: 'unreachable',
            blockers: [{ kind: 'subject-not-taken', subjects: ['mathematics'] }],
          }),
        },
      },
    });
    const screen = await render(<WhatINeedScreen />);
    const blockers = within(await screen.findByTestId('what-i-need-blockers'));
    expect(blockers.getByText(en.whatINeed.statuses.unreachable)).toBeTruthy();
    expect(
      blockers.getByText(`• ${en.whatINeed.blockers.subjectNotTaken('Mathematics')}`),
    ).toBeTruthy();
  });

  it('says so when the learner already qualifies', async () => {
    serve({
      'GET /api/what-i-need/uj-bcom-accounting': {
        json: { report, result: result({ status: 'qualifies', totalGap: 0 }) },
      },
    });
    const screen = await render(<WhatINeedScreen />);
    expect(await screen.findByText(en.whatINeed.statuses.qualifies)).toBeTruthy();
  });

  it('with no confirmed report, offers the upload in the app (A2-08)', async () => {
    serve({
      'GET /api/what-i-need/uj-bcom-accounting': { json: { report: null, result: null } },
    });
    const screen = await render(<WhatINeedScreen />);
    expect(await screen.findByText(en.results.noReport)).toBeTruthy();
    // The one empty state (docs/design "One rhythm"): its sentence and one button to the upload.
    expect(screen.getByTestId('empty-state')).toBeTruthy();
    expect(screen.queryByText(en.results.uploadOnWeb)).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: en.documents.uploadReport }));
    expect(useRouter().push).toHaveBeenCalledWith('/upload');
  });

  it('links the course and its scoring method to their official sources (A2-09)', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    serve({
      'GET /api/what-i-need/uj-bcom-accounting': {
        json: {
          report,
          result: { ...result(), methodSourceUrl: 'https://www.uj.ac.za/aps' },
        },
      },
    });
    const screen = await render(<WhatINeedScreen />);
    await fireEvent.press(
      await screen.findByRole('link', {
        name: `${en.common.officialSource}: BCom Accounting`,
      }),
    );
    expect(open).toHaveBeenLastCalledWith('https://www.uj.ac.za/');
    await fireEvent.press(screen.getByRole('link', { name: en.breakdown.method }));
    expect(open).toHaveBeenLastCalledWith('https://www.uj.ac.za/aps');
    open.mockRestore();
  });

  it('names the course in each card’s "What I need" button, for screen readers (A3-06)', async () => {
    const screen = await render(<ProgrammeCard result={programme({ programmeId: 'p-close' })} />);
    const button = screen.getByTestId('what-i-need-p-close');
    expect(button.props.accessibilityLabel).toBe(`${en.whatINeed.open}: BSc Engineering`);
    expect(screen.getByText(en.whatINeed.open)).toBeTruthy();
  });

  it('an unknown course says so, and a failure can be retried', async () => {
    serve({
      'GET /api/what-i-need/uj-bcom-accounting': {
        status: 404,
        json: { error: 'not-found', detail: null },
      },
    });
    const screen = await render(<WhatINeedScreen />);
    expect(await screen.findByText(en.whatINeed.notFound)).toBeTruthy();

    serve({
      'GET /api/what-i-need/uj-bcom-accounting': {
        status: 403,
        json: { error: 'consent', detail: null },
      },
    });
    const again = await render(<WhatINeedScreen />);
    expect(await again.findByText(en.errors.consent)).toBeTruthy();
    serve({ 'GET /api/what-i-need/uj-bcom-accounting': { json: { report, result: result() } } });
    await fireEvent.press(again.getByRole('button', { name: en.common.tryAgain }));
    expect(await again.findByTestId('target-mathematics')).toBeTruthy();
  });

  it('opens from a results card', async () => {
    const screen = await render(<ProgrammeCard result={programme({ programmeId: 'p-close' })} />);
    await fireEvent.press(screen.getByTestId('what-i-need-p-close'));
    expect(useRouter().push).toHaveBeenCalledWith('/what-i-need/p-close');
  });

  it('shows the chat artifact as a titled summary', async () => {
    const screen = await render(
      <ArtifactCard
        artifact={{
          kind: 'what-i-need',
          result: result(),
          reportKind: 'grade-12-june',
          confirmedAt: report.confirmedAt,
        }}
      />,
    );
    const card = within(screen.getByTestId('artifact-what-i-need'));
    expect(card.getByText(`${en.whatINeed.title}: BCom Accounting`)).toBeTruthy();
    expect(
      card.getByText(`${en.whatINeed.statuses.reachable} ${en.whatINeed.totalGap(5)}`),
    ).toBeTruthy();
  });

  it('words every blocker from packages/content', () => {
    expect(blockerText({ kind: 'not-enough-subjects', needed: 4, available: 3 }, 'APS')).toBe(
      en.whatINeed.blockers.notEnoughSubjects(4, 3),
    );
    expect(blockerText({ kind: 'no-home-language' }, 'APS')).toBe(
      en.whatINeed.blockers.noHomeLanguage,
    );
    expect(blockerText({ kind: 'no-english' }, 'APS')).toBe(en.whatINeed.blockers.noEnglish);
    expect(blockerText({ kind: 'score-out-of-reach', best: 35, required: 40 }, 'APS')).toBe(
      en.whatINeed.blockers.scoreOutOfReach('APS', 35, 40),
    );
  });
});
