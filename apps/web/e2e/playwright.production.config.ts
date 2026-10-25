import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';
import { rehearsalEnv } from './production-rehearsal-env';

const PORT = 3102;
/** apps/web: the server and its .data folder live there, as in the main run. */
const WEB = fileURLToPath(new URL('..', import.meta.url));

// Everything the server prints, for the "no unhandled server error" check (A1-10).
process.env['UF_E2E_SERVER_LOG'] ??= resolve(WEB, `.data/e2e-production-server-${Date.now()}.log`);

/**
 * The production rehearsal (e2e/production-rehearsal.spec.ts) against a production build
 * configured as the launch will be, with the stand-ins in place of the owner's accounts
 * (e2e/production-rehearsal-env.ts). Its own config and port, so the main run keeps its own
 * environment (catalogue drafts, the CV preview) and never sees this spec.
 *
 * Build first (with no NEXT_PUBLIC_UF_DEMO_* set), then:
 * `pnpm --filter @universityflow/web exec playwright test -c e2e/playwright.production.config.ts`
 */
export default defineConfig({
  testDir: '.',
  testMatch: 'production-rehearsal.spec.ts',
  // Pays the fresh database's one-time migration before the first journey (gotcha 47).
  globalSetup: './warm-up.ts',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  retries: process.env['CI'] ? 1 : 0,
  reporter: process.env['CI'] ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'phone', use: { ...devices['Pixel 7'] } }],
  webServer: {
    command: `node e2e/serve.mjs ${PORT}`,
    url: `http://localhost:${PORT}`,
    cwd: WEB,
    reuseExistingServer: false,
    timeout: 120_000,
    env: rehearsalEnv(PORT, Date.now()),
  },
});
