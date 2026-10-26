import { ConfigError, readCronSecret } from '@/lib/server/config';
import { requireDemo } from '@/lib/server/demo/core';
import { cronAuthorised, runDemoSweep, SweepFailedError } from '@/lib/server/demo/sweep';
import { HttpError, handler, json } from '@/lib/server/http';

/** A run keeps to a 40 s budget (demo/sweep.ts), so this is never reached. */
export const maxDuration = 60;

/**
 * Judge demo mode: the SCHEDULED sweep (A11-61, docs/deploy/demo.md "The scheduled sweep"). A
 * Vercel cron (apps/web/vercel.json) calls this with `Authorization: Bearer <CRON_SECRET>`, and it
 * runs every deletion the demo's words promise, then answers the counts (never an id).
 *
 * Not found anywhere but a demo, before the secret is looked at, so nothing about it can be
 * probed elsewhere. On a demo: 503 "not set up" (and the variable's name in the log) while
 * CRON_SECRET is unset; 401 for anything but the secret, compared in constant time; 503 when a
 * sweep failed, after the others ran (the cron's log shows it; Vercel never retries, the next run
 * tries again). A GET with no cookie and no body, so the same-origin check has nothing to guard.
 */
export const GET = handler(async (request: Request) => {
  const services = await requireDemo();
  const secret = readCronSecret();
  if (!secret) {
    throw new ConfigError(
      'The scheduled sweep needs CRON_SECRET set in the demo project (docs/deploy/demo.md, "The scheduled sweep"); until then only the lazy sweep runs',
    );
  }
  if (!cronAuthorised(request.headers.get('authorization'), secret)) {
    throw new HttpError(401, 'signed-out');
  }
  try {
    return json(await runDemoSweep(services));
  } catch (error) {
    if (error instanceof SweepFailedError) throw new HttpError(503, 'state', 'demo-sweep-failed');
    throw error;
  }
});
