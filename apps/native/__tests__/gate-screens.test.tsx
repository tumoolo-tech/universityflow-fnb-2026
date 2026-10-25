import { render, waitFor } from '@testing-library/react-native';
import { Stack } from 'expo-router';
import { Children, isValidElement, type ReactNode } from 'react';
import { Gate } from '../components/gate';
import { AuthProvider } from '../lib/auth';
import { saveToken } from '../lib/session';
import { serve } from '../test-utils/fake-api';

/**
 * Every screen under app/ is declared in the gate, inside the signed-in guard or, for the few that
 * must work signed out, inside the signed-out one (A7-13). expo-router adds a screen nobody
 * declared to the stack unguarded: My campus and First week were reachable signed out, and a 401
 * there left the learner stranded instead of back at sign-in.
 */

/** Files under app/ that are not screens: the layout and the deep-link rewriter. */
const NOT_SCREENS = new Set(['_layout', '+native-intent']);
/** The only screens a signed-out learner may see. */
const PUBLIC = ['sign-in'];

// The app's tsconfig has React Native's types, not Node's: the little of `fs` this reads.
declare const __dirname: string;
const { readdirSync } = require('node:fs') as {
  readdirSync(
    path: string,
    options: { withFileTypes: true },
  ): Array<{ name: string; isDirectory(): boolean }>;
};
const APP = `${__dirname}/../app`;

/** Route names as expo-router derives them: the path under app/, without the extension. */
function routesOnDisk(under = ''): string[] {
  return readdirSync(`${APP}/${under}`, { withFileTypes: true }).flatMap((entry) => {
    const path = under ? `${under}/${entry.name}` : entry.name;
    if (entry.isDirectory()) return routesOnDisk(path);
    if (!/\.tsx?$/.test(entry.name)) return [];
    const name = path.replace(/\.tsx?$/, '');
    return NOT_SCREENS.has(name) ? [] : [name];
  });
}

/** The screens the gate declares, by guard: what the mocked Stack was last given. */
function declared(): { signedIn: string[]; signedOut: string[] } {
  const calls = (Stack as unknown as jest.Mock).mock.calls;
  const props = calls.at(-1)?.[0] as { children?: ReactNode } | undefined;
  const result = { signedIn: [] as string[], signedOut: [] as string[] };
  for (const group of Children.toArray(props?.children)) {
    if (!isValidElement<{ guard: boolean; children?: ReactNode }>(group)) continue;
    const names = Children.toArray(group.props.children).flatMap((screen) =>
      isValidElement<{ name: string }>(screen) ? [screen.props.name] : [],
    );
    (group.props.guard ? result.signedIn : result.signedOut).push(...names);
  }
  return result;
}

beforeEach(async () => {
  (Stack as unknown as jest.Mock).mockClear();
  await saveToken('tok');
  serve({ 'GET /api/me': { json: { ready: true } } });
});

describe('the auth gate declares every screen (A7-13)', () => {
  it('finds the screens on disk', () => {
    expect(routesOnDisk()).toEqual(expect.arrayContaining(['index', 'campus', 'first-week']));
    expect(routesOnDisk()).toContain('what-i-need/[programmeId]');
  });

  it('puts every screen but sign-in behind the signed-in guard, and sign-in behind the other', async () => {
    await render(
      <AuthProvider>
        <Gate />
      </AuthProvider>,
    );
    await waitFor(() => expect(declared().signedIn.length).toBeGreaterThan(0));
    const { signedIn, signedOut } = declared();
    expect(signedOut).toEqual(PUBLIC);
    const missing = routesOnDisk().filter(
      (route) => !signedIn.includes(route) && !PUBLIC.includes(route),
    );
    expect(missing).toEqual([]);
    expect(signedIn).toEqual(expect.arrayContaining(['campus', 'first-week']));
    // Nothing declared that doesn't exist (a renamed file would leave a stale guard).
    const onDisk = new Set(routesOnDisk());
    expect([...signedIn, ...signedOut].filter((name) => !onDisk.has(name))).toEqual([]);
  });
});
