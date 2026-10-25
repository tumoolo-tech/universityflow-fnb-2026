import { cvEngineContract } from '@universityflow/cv/contract';
import { describe, vi } from 'vitest';
import { mmerekoFromEnv } from '../lib/server/mmereko';

/**
 * The CV engine contract against Mmereko's sandbox (docs/design/mmereko-api-proposal.md §6.1,
 * §6.3): the run that decides whether the adapter joins `CV_ADAPTERS` (D8). Opt-in only, never in
 * CI by default: set `UF_MMEREKO_SANDBOX_CONTRACT=1` with the sandbox's own `MMEREKO_*` values.
 * The sandbox holds synthetic data only (the agreement forbids real learner data there), and so do
 * the contract's fixtures. Webhooks to us can't be observed from here, so the webhook case is
 * covered by the local fake (mmereko.test.ts) and the sandbox's own `duplicate-webhook` run.
 */

vi.mock('server-only', () => ({}));

const enabled = process.env['UF_MMEREKO_SANDBOX_CONTRACT'] === '1';

describe.skipIf(!enabled)('the Mmereko adapter against Mmereko’s sandbox', () => {
  cvEngineContract(async () => {
    const engine = mmerekoFromEnv(process.env);
    return {
      engine,
      // The sandbox finishes jobs by itself (canned, deterministic): wait for it.
      async finish(jobId, learnerRef) {
        const until = Date.now() + 60_000;
        while (Date.now() < until) {
          const job = await engine.getJob(jobId, learnerRef);
          if (job.status !== 'queued' && job.status !== 'running') return;
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
        throw new Error('The sandbox did not finish the job within a minute');
      },
      webhooks: null,
      webhookSecret: process.env['MMEREKO_WEBHOOK_SECRET'] ?? '',
      now: () => new Date(),
      simulateRateLimit: null,
    };
  });
});
