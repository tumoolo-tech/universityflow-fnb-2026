import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

const PORT = 3101;
/** apps/web: the server and its .data folder live there, as in the main run. */
const WEB = fileURLToPath(new URL('..', import.meta.url));

// Everything the server prints, for the "no unhandled server error" check (A1-10).
process.env['UF_E2E_SERVER_LOG'] ??= resolve(WEB, `.data/e2e-demo-server-${Date.now()}.log`);

/**
 * Judge demo mode's journey (e2e/demo.spec.ts) against a production build in demo mode
 * (UF_DEPLOYMENT=demo, docs/deploy/demo.md). Its own config and port, so the main E2E run
 * (apps/web/playwright.config.ts) keeps its own environment and never sees this spec. It lives in
 * e2e/ with the rest of the end-to-end tooling.
 *
 * Build first, then: `pnpm --filter @universityflow/web exec playwright test -c e2e/playwright.demo.config.ts`
 */
export default defineConfig({
  testDir: '.',
  // demo.spec.ts, and demo-features.spec.ts (the hackathon exceptions of 2026-10-24).
  testMatch: /demo(-features)?\.spec\.ts$/,
  // Pays the fresh database's one-time migration before the journey (gotcha 47).
  globalSetup: './demo-warm-up.ts',
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
    env: {
      UF_DEPLOYMENT: 'demo',
      UF_DEMO_PROJECT: '1',
      AUTH_SECRET: 'e2e-demo-auth-secret-for-local-runs-only-0123456789',
      DATABASE_URL: `pglite:./.data/e2e-demo-${Date.now()}`,
      UF_FILE_STORE_DIR: './.data/e2e-demo-files',
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
      // The judges' real sign-up on its local stand-in (no Firebase): a hackathon exception.
      UF_DEMO_SIGNUP: 'fake',
      // The on-screen phone sign-up OFF (a hackathon exception): this run proves the demo without
      // it is exactly as before (playwright.demo-phone.config.ts runs it ON).
      UF_DEMO_PHONE_SIGNUP: '',
      NEXT_PUBLIC_FIREBASE_API_KEY: '',
      NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: '',
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: '',
      NEXT_PUBLIC_UF_MAIN_URL: '',
      // Hackathon exceptions of 2026-10-24 (demo-features.spec.ts): My CV on the built-in stand-in
      // (never Mmereko: no UF_CV_PROVIDER) and plan-map words. Read aloud stays off (no key above).
      UF_CV: '1',
      UF_CV_PROVIDER: '',
      UF_MINDMAP_WORDS: '1',
      // "Open Mmereko" on My CV (2026-10-24), at its default address.
      UF_CV_MMEREKO_CANVAS: '1',
      MMEREKO_APP_URL: '',
    },
  },
});
