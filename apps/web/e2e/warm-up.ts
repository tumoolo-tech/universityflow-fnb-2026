import type { FullConfig } from '@playwright/test';

/**
 * Runs once, after the server starts and before the first journey (playwright.config.ts).
 *
 * The first write of a run opens and migrates the fresh embedded database (gotcha 18): 12 s on
 * this machine at migration 0029 while other suites ran (2026-10-23), so whichever journey came
 * first spent its 15 s sign-in wait on it and failed. One PIN request here pays that cost, so no
 * journey's step measures it. The waits stay as they are (gotcha 46).
 */
export default async function warmUp(config: FullConfig): Promise<void> {
  const base = config.projects[0]?.use.baseURL;
  if (!base) throw new Error('playwright.config.ts sets no baseURL');
  // A synthetic number, built at runtime (hard rule 4), and an address from TEST-NET-2 (RFC 5737)
  // that no journey's sign-in uses (they use TEST-NET-3), so no journey's limits are touched.
  const phone = `083${String(Date.now() % 10_000_000).padStart(7, '0')}`;
  const response = await fetch(`${base}/api/auth/request-pin`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: base,
      'x-forwarded-for': '198.51.100.1',
    },
    body: JSON.stringify({ phone }),
  });
  if (!response.ok) throw new Error(`The warm-up PIN request failed: ${response.status}`);
}
