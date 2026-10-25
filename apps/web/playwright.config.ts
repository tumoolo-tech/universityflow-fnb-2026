import { resolve } from 'node:path';
import { defineConfig, devices } from '@playwright/test';

const PORT = 3100;

// Everything the server prints, for the journeys' "no unhandled server error" check (A1-10). Set
// once in the runner; the workers inherit it, so they read the file the server writes.
process.env['UF_E2E_SERVER_LOG'] ??= resolve(`.data/e2e-server-${Date.now()}.log`);
// Signs the stand-in inbound webhooks; the messaging journey signs its STOP with it.
process.env['UF_MESSAGING_WEBHOOK_SECRET'] ??= 'e2e-webhook-secret-for-local-runs-only-0001';

/**
 * End-to-end tests run against a production build (`next start`), never `next dev`
 * (tumo-olo lesson). The server uses the local stand-ins and a fresh embedded database, and
 * shows the draft catalogue, so the whole journey runs with no real account.
 */
export default defineConfig({
  testDir: './e2e',
  // Judge demo mode's journey runs only in its own config (e2e/playwright.demo.config.ts), and
  // the production rehearsal in its own (e2e/playwright.production.config.ts), and the demo's
  // on-screen phone sign-up in its own (e2e/playwright.demo-phone.config.ts).
  testIgnore: [
    'demo.spec.ts',
    'demo-features.spec.ts',
    'demo-phone-signup.spec.ts',
    'production-rehearsal.spec.ts',
  ],
  // Pays the fresh database's one-time migration before the first journey (gotcha 18).
  globalSetup: './e2e/warm-up.ts',
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
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      DATABASE_URL: `pglite:./.data/e2e-${Date.now()}`,
      UF_FILE_STORE_DIR: './.data/e2e-files',
      UF_PROVIDERS: 'local',
      // A production build on this machine, allowed to use the stand-ins (never on Vercel).
      UF_LOCAL_PRODUCTION_BUILD: '1',
      UF_CATALOGUE_PREVIEW: '1',
      // The registration journey's synthetic curriculum (lib/server/e2e-fixtures.ts).
      UF_CATALOGUE_E2E_FIXTURES: '1',
      // My CV on the stand-in engine (the owner's preview, never production): e2e/cv.spec.ts.
      UF_CV: '1',
      UF_PUBLIC_URL: `http://localhost:${PORT}`,
      ANTHROPIC_API_KEY: '',
      UF_MESSAGING_WEBHOOK_SECRET: process.env['UF_MESSAGING_WEBHOOK_SECRET'],
    },
  },
});
