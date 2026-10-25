import { ConfigError, logConfigRefusal, readConfig } from '@/lib/server/config';
import { json } from '@/lib/server/http';

export const dynamic = 'force-dynamic';

/**
 * The host's health check (render.yaml `healthCheckPath`; docs/deploy/README.md). 200 when this
 * deployment's configuration would start, 503 when it would refuse, so a host that checks before
 * it switches traffic keeps the last good deploy.
 *
 * It says nothing else: no reason, no variable, no version. It never opens the database: the
 * host calls it every few seconds, a database outage is not fixed by restarting the web service,
 * and a health check that reads the database is one more way in. Database problems show in
 * Sentry and in the pages themselves.
 */
export function GET(): Response {
  try {
    readConfig();
    return json({ status: 'ok' });
  } catch (error) {
    // The body still says nothing; the host's log names why, for the owner (variable names only).
    if (error instanceof ConfigError) logConfigRefusal(error);
    return json({ status: 'unavailable' }, { status: 503 });
  }
}
