import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

const PORT = 3102;
/** apps/web: the server and its .data folder live there, as in the main run. */
const WEB = fileURLToPath(new URL('..', import.meta.url));

// Everything the server prints, for the "no unhandled server error" check (A1-10).
process.env['UF_E2E_SERVER_LOG'] ??= resolve(WEB, `.data/e2e-demo-phone-server-${Date.now()}.log`);

/**
 * The judge demo's on-screen phone sign-up (e2e/demo-phone-signup.spec.ts): a HACKATHON EXCEPTION
 * the owner approved on 2026-10-24 (`UF_DEMO_PHONE_SIGNUP=onscreen`, docs/deploy/demo.md), against
 * a production build in demo mode with the switch ON. Its own config and port, so the demo's main
 * journey (playwright.demo.config.ts, the switch OFF) keeps proving that turning it off restores
 * the demo exactly.
 *
 * Build first, then: `pnpm --filter @universityflow/web exec playwright test -c e2e/playwright.demo-phone.config.ts`
 * (`pnpm --filter @universityflow/web test:e2e:demo` runs both demo configs).
 */
export default defineConfig({
  testDir: '.',
  testMatch: 'demo-phone-signup.spec.ts',
  // Pays the fresh database's one-time migration before the journey (gotcha 47).
  globalSetup: './demo-warm-up.ts',
  timeout: 90_000,
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
    env: {
      UF_DEPLOYMENT: 'demo',
      UF_DEMO_PROJECT: '1',
      AUTH_SECRET: 'e2e-demo-phone-auth-secret-for-local-runs-only-0123456789',
      DATABASE_URL: `pglite:./.data/e2e-demo-phone-${Date.now()}`,
      UF_FILE_STORE_DIR: './.data/e2e-demo-phone-files',
      UF_PROVIDERS: 'local',
      UF_CATALOGUE_PREVIEW: '1',
      UF_PUBLIC_URL: `http://localhost:${PORT}`,
      // The stand-ins only, whatever this shell has set: a demo refuses the rest.
      ANTHROPIC_API_KEY: '',
      GEMINI_API_KEY: '',
      ELEVENLABS_API_KEY: '',
      ELEVENLABS_VOICE_ID: '',
      UF_MESSAGING_WEBHOOK_SECRET: '',
      UF_CATALOGUE_E2E_FIXTURES: '',
      UF_LOCAL_PRODUCTION_BUILD: '',
      // The on-screen phone sign-up, ON (a hackathon exception), beside the judges' own sign-up
      // on its local stand-in, as the live demo may have both.
      UF_DEMO_PHONE_SIGNUP: 'onscreen',
      UF_DEMO_SIGNUP: 'fake',
      NEXT_PUBLIC_FIREBASE_API_KEY: '',
      NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: '',
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: '',
      NEXT_PUBLIC_UF_MAIN_URL: '',
    },
  },
});
