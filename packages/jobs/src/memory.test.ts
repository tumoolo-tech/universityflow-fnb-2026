import { describe } from 'vitest';
import { jobSchedulerContract } from './jobs.contract';
import { MemoryJobScheduler } from './memory';

describe('MemoryJobScheduler meets the job scheduler contract', () => {
  jobSchedulerContract(async () => {
    let now = new Date('2026-10-13T08:00:00Z');
    const scheduler = new MemoryJobScheduler({ clock: () => now });
    return {
      scheduler,
      // One instance holds the jobs, so two "servers" are the same object, called at once.
      runners: [scheduler, scheduler],
      now: () => now,
      advance(ms) {
        now = new Date(now.getTime() + ms);
      },
    };
  });
});
