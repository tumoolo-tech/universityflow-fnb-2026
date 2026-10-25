import type { FullConfig } from '@playwright/test';

/**
 * Runs once before the demo journey (playwright.demo.config.ts): one demo start from a TEST-NET-2
 * address pays the fresh database's migration (gotcha 47), so no step of the journey measures it.
 * The main run's warm-up asks for a PIN, which a demo refuses (404), so the demo has its own.
 */
export default async function warmUp(config: FullConfig): Promise<void> {
  const base = config.projects[0]?.use.baseURL;
  if (!base) throw new Error('playwright.demo.config.ts sets no baseURL');
  const response = await fetch(`${base}/api/demo/start`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: base,
      'x-forwarded-for': '198.51.100.2',
    },
    body: JSON.stringify({ persona: 'demo-grade-11' }),
  });
  if (!response.ok) throw new Error(`The demo warm-up start failed: ${response.status}`);
}
