import { describe } from 'vitest';
import { cvEngineContract } from './cv-engine.contract';
import { MemoryCvEngine } from './memory';

/** The fake passes the same contract Mmereko's sandbox must (§6.3). */

const SECRET = 'a-test-webhook-secret-of-at-least-32-chars';

describe('MemoryCvEngine meets the CV engine contract', () => {
  cvEngineContract(async () => {
    const engine = new MemoryCvEngine({ webhookSecret: SECRET });
    return {
      engine,
      finish: (jobId) => engine.complete(jobId),
      webhooks: () => engine.webhooks,
      webhookSecret: SECRET,
      now: () => new Date(),
      simulateRateLimit: () => engine.failNext('rate_limited', 429, 30_000),
    };
  });
});
