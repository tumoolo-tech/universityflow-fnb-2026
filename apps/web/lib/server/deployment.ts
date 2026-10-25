import 'server-only';

/**
 * A staging site says so with UF_DEPLOYMENT=staging (render.yaml, docs/deploy/README.md). Kept
 * apart from config.ts so the root layout can read it without loading the providers. The banner
 * and `noindex` read this; `readConfig` enforces what staging may be (synthetic data only).
 */
export function isStaging(env: Record<string, string | undefined> = process.env): boolean {
  return env['UF_DEPLOYMENT'] === 'staging';
}

/**
 * Judge demo mode says so with UF_DEPLOYMENT=demo (docs/deploy/demo.md): its own project, made-up
 * learners only, phone sign-in off. The banner, the persona picker and `noindex` read this;
 * `readConfig` enforces what a demo may be (`checkDemo`).
 */
export function isDemo(env: Record<string, string | undefined> = process.env): boolean {
  return env['UF_DEPLOYMENT'] === 'demo';
}
