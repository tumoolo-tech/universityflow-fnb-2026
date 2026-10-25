import { z } from 'zod';
import { assertSameOrigin, HttpError, handler, json } from '@/lib/server/http';
import { getServices } from '@/lib/server/services';

/**
 * Local development only: runs the scheduled jobs that are due (reminders), so they reach the
 * dev outbox the way a cron or the hosted scheduler would deliver them. `{ "at": "<ISO time>" }`
 * runs as if it were that time (a reminder at 10:00 can be seen arriving at night). Never in
 * production, and never in live mode, where the hosted scheduler runs its own jobs.
 */

const Body = z.object({ at: z.iso.datetime({ offset: true }).optional() }).strict();

export const POST = handler(async (request: Request) => {
  assertSameOrigin(request);
  const { devRunDue, config } = await getServices();
  if (!devRunDue || config.production || config.demo) throw new HttpError(404, 'not-found');
  const raw = await request.text();
  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(raw.trim() === '' ? {} : JSON.parse(raw));
  } catch {
    throw new HttpError(400, 'invalid');
  }
  const report = await devRunDue(body.at ? new Date(body.at) : undefined);
  return json({
    completed: report.completed.length,
    retrying: report.retrying.length,
    failed: report.failed.length,
  });
});
