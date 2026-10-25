import { config } from 'zod/v4/core';

/**
 * Runs in the browser before the app becomes interactive.
 *
 * The catalogue's zod schemas also validate in the browser, under a CSP with no 'unsafe-eval'
 * (audit finding 2). Zod compiles its faster validators with `Function()`, and even its probe
 * for that ability is reported as a CSP violation, so the browser runs zod without it. The
 * server keeps the compiled validators: turning them off there slows a cold start by seconds.
 *
 * Only `config` is imported: `import { z } from 'zod'` put all of zod and its ~40 locales into
 * every page's first JavaScript (audit A4-01; scripts/ci/root-chunk-budget.mjs). The setting
 * lives on `globalThis`, so it reaches every copy of zod in the bundle.
 */
config({ jitless: true });
