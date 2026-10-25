import { en } from '@universityflow/content';
import type { Browser, CallOptions } from './harness';

/**
 * An adult agrees in their own name, as the onboarding step does (A7-04): after the date of
 * birth, before chat, uploads or anything else. Call it after `vi.mock('next/headers', …)`.
 */
export async function agreeAsAdult(browser: Browser, options: CallOptions = {}) {
  const { POST } = await import('../app/api/me/adult-consent/route');
  const result = await browser.json(POST, '/api/me/adult-consent', {
    ...options,
    json: { version: en.adultConsent.version },
  });
  if (result.status !== 200) throw new Error(`adult consent refused: ${result.status}`);
  return result;
}
