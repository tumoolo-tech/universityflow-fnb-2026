/**
 * The production rehearsal's environment (docs/deploy/production.md, "The rehearsal"): a
 * production build configured as the real launch will be, with the one difference production
 * can't allow on a host: the local stand-ins in place of the owner's accounts.
 *
 * What differs from real production, exactly (test/production-rehearsal.test.ts holds it):
 * - `UF_LOCAL_PRODUCTION_BUILD=1` and `UF_PROVIDERS=local`: the SMS company is the in-memory
 *   outbox (`/api/dev/outbox` shows each PIN and guardian link), files go to a local folder, the
 *   AI is the scripted stand-in, and jobs run from the database's own queue. Real production
 *   refuses all of that ("Production must use live providers"), and on Vercel it ignores the
 *   escape (A5-12).
 * - The database is the embedded one (`pglite:`) unless `UF_REHEARSAL_DATABASE_URL` names a
 *   Postgres: production refuses anything but `postgres://`.
 * - `UF_PUBLIC_URL` is this machine's `http://localhost:<port>`: production needs https.
 *
 * Everything else is as production has it: no catalogue drafts or E2E fixtures, so a learner sees
 * only verified records (none yet: hard rule 3); no owner-preview switch (photo, plan-map words,
 * CV); nothing of the demo's; not staging; a real-length AUTH_SECRET. Each of those is blanked
 * here, whatever the shell running the tests has set.
 */
export function rehearsalEnv(port: number, stamp: number): Record<string, string> {
  return {
    // The stand-ins, on this machine only.
    UF_LOCAL_PRODUCTION_BUILD: '1',
    UF_PROVIDERS: 'local',
    DATABASE_URL:
      process.env['UF_REHEARSAL_DATABASE_URL'] || `pglite:./.data/e2e-production-${stamp}`,
    UF_FILE_STORE_DIR: `./.data/e2e-production-files-${stamp}`,
    UF_PUBLIC_URL: `http://localhost:${port}`,
    // As production has it.
    AUTH_SECRET: 'production-rehearsal-auth-secret-local-runs-only-0123456789',
    ...Object.fromEntries(BLANK_IN_PRODUCTION.map((name) => [name, ''])),
  };
}

/**
 * What production never carries, or doesn't carry yet: each is blanked, so the rehearsal can't
 * pass on a switch production would refuse or a key it doesn't have.
 */
export const BLANK_IN_PRODUCTION = [
  'UF_DEPLOYMENT',
  'UF_CATALOGUE_PREVIEW',
  'UF_CATALOGUE_E2E_FIXTURES',
  'UF_PROFILE_PHOTO',
  'UF_MINDMAP_WORDS',
  'UF_CV',
  'UF_CV_PROVIDER',
  // Needs UF_CV, which production refuses until the wording names Mmereko.
  'UF_CV_MMEREKO_CANVAS',
  'UF_STAGING_PASSWORD',
  'UF_DEMO_PROJECT',
  'UF_DEMO_DATABASE',
  'UF_DEMO_AI_DAILY_CAP',
  'UF_DEMO_SIGNUP',
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  'NEXT_PUBLIC_UF_MAIN_URL',
  'NEXT_PUBLIC_UF_DEMO_URL',
  'NEXT_PUBLIC_UF_DEMO_LOGOS',
  'UF_AI_PROVIDER',
  'GEMINI_API_KEY',
  'ANTHROPIC_API_KEY',
  'ELEVENLABS_API_KEY',
  'ELEVENLABS_VOICE_ID',
  'ELEVENLABS_MODEL_ID',
  'UF_ELEVENLABS_MINORS_APPROVED',
  'UF_MESSAGING_WEBHOOK_SECRET',
  'UF_REVIEW_PHONE',
  'UF_REVIEW_PIN_HASH',
  'UF_REVIEW_UNTIL',
  'UF_DEBUG_ERRORS',
] as const;
