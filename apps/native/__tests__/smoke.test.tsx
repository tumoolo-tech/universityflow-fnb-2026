import { render } from '@testing-library/react-native';
import { achievementLevel } from '@universityflow/admissions';
import { en } from '@universityflow/content/app';
import HomeScreen from '../app/index';
import { ProgrammeCard } from '../components/programme-card';
import { AuthProvider } from '../lib/auth';
import { saveToken } from '../lib/session';
import { serve } from '../test-utils/fake-api';
import { home, me, programme } from '../test-utils/fixtures';

/**
 * RNTL v14's `render` is async (React 19 renders concurrently). A missing `await` surfaces as
 * "`render` function has not been called", pointing at the wrong line (tumo-olo gotcha 1).
 */
describe('HomeScreen', () => {
  it('renders the welcome as the header, from packages/content', async () => {
    await saveToken('tok');
    serve({
      'GET /api/me': { json: me({ consentStatus: 'not-required' }, true) },
      'GET /api/home': { json: home() },
    });
    const screen = await render(
      <AuthProvider>
        <HomeScreen />
      </AuthProvider>,
    );
    expect(await screen.findByRole('header', { name: en.dashboard.welcome('') })).toBeTruthy();
  });
});

// The point of these: they fail if a shared package stops resolving or running under React
// Native.
describe('shared packages under React Native', () => {
  it('runs the shared admissions calculator', () => {
    expect(achievementLevel(80)).toBe(7);
  });

  it('runs the shared catalogue (subject names) inside a component', async () => {
    const screen = await render(
      <ProgrammeCard
        result={programme({
          shortfalls: [
            {
              subjects: ['physical-sciences'],
              kind: 'subject',
              count: 1,
              targetPercent: 60,
              percent: null,
              subject: null,
              shortBy: null,
            },
          ],
        })}
      />,
    );
    expect(screen.getByText(`• ${en.results.improve('Physical Sciences', null, 60)}`)).toBeTruthy();
  });
});
