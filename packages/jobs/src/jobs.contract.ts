import { randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';
import {
  defineJobKind,
  type EntityId,
  entityId,
  InvalidJobError,
  InvalidJobPayloadError,
} from './payload';
import {
  handle,
  JOB_LEASE_MS,
  JobConflictError,
  type JobHandler,
  type JobRunner,
  type JobScheduler,
} from './scheduler';

/**
 * The contract every job scheduler meets (D8). The stand-ins run it now (memory here, Postgres
 * in packages/db); the hosted scheduler runs the same suite when the owner connects it, with a
 * harness whose clock is real and whose runner waits, so the stand-ins can't promise what the
 * real service doesn't do.
 */
export interface JobSchedulerHarness {
  readonly scheduler: JobScheduler;
  /**
   * Runners over the same jobs, as separate servers would be. The stand-ins pass two, to race
   * them. Each `runDue` lets every job due by `now()` run.
   */
  readonly runners: readonly [JobRunner, ...JobRunner[]];
  now(): Date;
  advance(ms: number): void;
}

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;

/** A kind used only by the contract. */
export const CONTRACT_REMINDER = defineJobKind('contract.reminder', ['reminderId', 'studentId']);
const OTHER = defineJobKind('contract.other', ['reminderId']);

const newId = (): EntityId => entityId(randomUUID());
const payload = () => ({ reminderId: newId(), studentId: newId() });

/** Handlers that record each run, by job id. */
function recorder(fail: (attempt: number) => boolean = () => false) {
  const runs: Array<{ jobId: string; attempt: number; payload: unknown }> = [];
  const handlers: JobHandler[] = [
    handle(CONTRACT_REMINDER, async (p, context) => {
      runs.push({ jobId: context.jobId, attempt: context.attempt, payload: p });
      if (fail(context.attempt)) throw new Error('handler failed');
    }),
  ];
  return { runs, handlers, count: (id: string) => runs.filter((r) => r.jobId === id).length };
}

// Built at runtime: no real-looking number in source (hard rule 4).
const PHONE = `+27${'82'}${'0000123'}`;
const LOCAL_PHONE = `0${'82'}${'0000123'}`;

export function jobSchedulerContract(make: () => Promise<JobSchedulerHarness>): void {
  it('schedules a job for a time and shows it pending, IDs and all', async () => {
    const h = await make();
    const p = payload();
    const runAt = new Date(h.now().getTime() + 3 * DAY);
    const job = await h.scheduler.schedule({ kind: CONTRACT_REMINDER, payload: p, runAt });
    expect(job.id).toMatch(/\S/);
    expect(job.created).toBe(true);
    expect(job.runAt.getTime()).toBe(runAt.getTime());
    expect(await h.scheduler.get(job.id)).toEqual({
      id: job.id,
      kind: 'contract.reminder',
      payload: p,
      runAt,
      status: 'pending',
      attempts: 0,
    });
  });

  it('does not run a job before its time, runs it at its time, and only once', async () => {
    const h = await make();
    const r = recorder();
    const p = payload();
    const { id } = await h.scheduler.schedule({
      kind: CONTRACT_REMINDER,
      payload: p,
      runAt: new Date(h.now().getTime() + 3 * DAY),
    });

    h.advance(3 * DAY - MINUTE);
    await h.runners[0].runDue(r.handlers);
    expect(r.count(id)).toBe(0);
    expect((await h.scheduler.get(id))?.status).toBe('pending');

    h.advance(MINUTE);
    expect((await h.runners[0].runDue(r.handlers)).completed).toEqual([id]);
    expect(r.runs).toEqual([{ jobId: id, attempt: 1, payload: p }]);

    h.advance(DAY);
    await h.runners[0].runDue(r.handlers);
    expect(r.count(id)).toBe(1);
    expect(await h.scheduler.get(id)).toMatchObject({ status: 'done', attempts: 1 });
  });

  it('runs a job scheduled with a delay once the delay has passed', async () => {
    const h = await make();
    const r = recorder();
    const start = h.now().getTime();
    const job = await h.scheduler.schedule({
      kind: CONTRACT_REMINDER,
      payload: payload(),
      delayMs: 2 * DAY,
    });
    expect(job.runAt.getTime()).toBe(start + 2 * DAY);
    h.advance(2 * DAY - 1);
    await h.runners[0].runDue(r.handlers);
    expect(r.count(job.id)).toBe(0);
    h.advance(1);
    await h.runners[0].runDue(r.handlers);
    expect(r.count(job.id)).toBe(1);
  });

  it('runs a job whose time has already passed on the next pass, earliest first', async () => {
    const h = await make();
    const r = recorder();
    const at = (ms: number) => new Date(h.now().getTime() + ms);
    const later = await h.scheduler.schedule({
      kind: CONTRACT_REMINDER,
      payload: payload(),
      runAt: at(-MINUTE),
    });
    const earlier = await h.scheduler.schedule({
      kind: CONTRACT_REMINDER,
      payload: payload(),
      runAt: at(-DAY),
    });
    const report = await h.runners[0].runDue(r.handlers);
    expect(report.completed).toEqual([earlier.id, later.id]);
  });

  it('runs at most `limit` jobs in a pass, and the rest on the next', async () => {
    const h = await make();
    const r = recorder();
    for (let i = 0; i < 3; i++) {
      await h.scheduler.schedule({ kind: CONTRACT_REMINDER, payload: payload(), delayMs: 0 });
    }
    expect((await h.runners[0].runDue(r.handlers, { limit: 2 })).completed).toHaveLength(2);
    expect((await h.runners[0].runDue(r.handlers, { limit: 2 })).completed).toHaveLength(1);
    await expect(h.runners[0].runDue(r.handlers, { limit: 0 })).rejects.toThrow(InvalidJobError);
  });

  it('never runs a job cancelled before it was due', async () => {
    const h = await make();
    const r = recorder();
    const { id } = await h.scheduler.schedule({
      kind: CONTRACT_REMINDER,
      payload: payload(),
      delayMs: 3 * DAY,
    });
    h.advance(DAY);
    expect(await h.scheduler.cancel(id)).toBe(true);
    h.advance(3 * DAY);
    await h.runners[0].runDue(r.handlers);
    expect(r.count(id)).toBe(0);
    expect((await h.scheduler.get(id))?.status).toBe('cancelled');
  });

  it('cancels safely: twice, after the job ran, and for an unknown or malformed id', async () => {
    const h = await make();
    const r = recorder();
    const { id } = await h.scheduler.schedule({
      kind: CONTRACT_REMINDER,
      payload: payload(),
      delayMs: 0,
    });
    const ran = await h.scheduler.schedule({
      kind: CONTRACT_REMINDER,
      payload: payload(),
      runAt: new Date(h.now().getTime() + MINUTE),
    });
    expect(await h.scheduler.cancel(id)).toBe(true);
    expect(await h.scheduler.cancel(id)).toBe(false);
    h.advance(MINUTE);
    await h.runners[0].runDue(r.handlers);
    expect(await h.scheduler.cancel(ran.id)).toBe(false);
    expect((await h.scheduler.get(ran.id))?.status).toBe('done');
    expect(await h.scheduler.cancel(randomUUID())).toBe(false);
    expect(await h.scheduler.cancel('not-a-job')).toBe(false);
    expect(await h.scheduler.cancel('')).toBe(false);
    expect(await h.scheduler.get(randomUUID())).toBeNull();
    expect(await h.scheduler.get('not-a-job')).toBeNull();
  });

  it('refuses a payload holding anything but its IDs, without repeating it (hard rule 4)', async () => {
    const h = await make();
    const r = recorder();
    const good = payload();
    const refused: Array<[string, unknown]> = [
      ['a phone number', { ...good, studentId: PHONE }],
      ['a local phone number', { ...good, studentId: LOCAL_PHONE }],
      ['a name', { ...good, studentId: 'Thandi Synthetic' }],
      ['free text', { ...good, reminderId: 'Your NBT is on Saturday, good luck!' }],
      ['an email address', { ...good, studentId: 'learner@example.com' }],
      ['an ID number', { ...good, studentId: '0000000000000' }],
      ['an upper-case UUID', { ...good, studentId: good.studentId.toUpperCase() }],
      ['an extra field', { ...good, phone: PHONE }],
      ['a missing field', { reminderId: good.reminderId }],
      ['a nested object', { ...good, studentId: { id: good.studentId } }],
      ['a number', { ...good, studentId: 42 }],
      ['null', null],
      ['an array', [good.reminderId, good.studentId]],
      ['a string', good.reminderId],
      ['a class instance', Object.assign(new Date(), good)],
    ];
    for (const [label, bad] of refused) {
      const attempt = h.scheduler.schedule({
        kind: CONTRACT_REMINDER,
        payload: bad as never,
        delayMs: 0,
      });
      await expect(attempt, label).rejects.toThrow(InvalidJobPayloadError);
      const message = await attempt.catch((e: Error) => e.message);
      expect(message, label).not.toContain(PHONE);
      expect(message, label).not.toContain('Thandi');
      expect(message, label).not.toContain('phone');
    }
    expect((await h.runners[0].runDue(r.handlers)).completed).toEqual([]);
  });

  it('refuses an idempotency key that could hold personal data', async () => {
    const h = await make();
    const id = newId();
    for (const key of [
      `reminder:${PHONE}`,
      `reminder:${LOCAL_PHONE}`,
      'reminder:Thandi Synthetic',
      'reminder:learner@example.com',
      'reminder:0000000000000',
      '',
      'x'.repeat(201),
    ]) {
      await expect(
        h.scheduler.schedule({
          kind: CONTRACT_REMINDER,
          payload: payload(),
          delayMs: 0,
          idempotencyKey: key,
        }),
        key,
      ).rejects.toThrow(InvalidJobPayloadError);
    }
    const ok = await h.scheduler.schedule({
      kind: CONTRACT_REMINDER,
      payload: payload(),
      delayMs: 0,
      idempotencyKey: `deadline:${id}:2027-03-01`,
    });
    expect(ok.created).toBe(true);
  });

  it('refuses a time that is not one, and attempts out of range', async () => {
    const h = await make();
    const now = h.now();
    const base = { kind: CONTRACT_REMINDER, payload: payload() };
    for (const bad of [
      {},
      { runAt: now, delayMs: 0 },
      { delayMs: -1 },
      { delayMs: Number.NaN },
      { delayMs: Number.POSITIVE_INFINITY },
      { runAt: new Date('not a date') },
      { delayMs: 0, maxAttempts: 0 },
      { delayMs: 0, maxAttempts: 11 },
      { delayMs: 0, maxAttempts: 1.5 },
    ]) {
      await expect(
        h.scheduler.schedule({ ...base, ...bad } as never),
        JSON.stringify(bad),
      ).rejects.toThrow(InvalidJobError);
    }
  });

  it('makes one job of one idempotency key, even when scheduled at the same moment', async () => {
    const h = await make();
    const r = recorder();
    const p = payload();
    const key = `deadline:${p.reminderId}`;
    const options = { kind: CONTRACT_REMINDER, payload: p, delayMs: DAY, idempotencyKey: key };
    const jobs = await Promise.all(Array.from({ length: 5 }, () => h.scheduler.schedule(options)));
    expect(new Set(jobs.map((j) => j.id)).size).toBe(1);
    expect(jobs.filter((j) => j.created)).toHaveLength(1);
    // Still the same job later on, and it keeps its first time.
    h.advance(MINUTE);
    const again = await h.scheduler.schedule({ ...options, delayMs: 2 * DAY });
    expect(again).toEqual({ id: jobs[0]?.id, runAt: jobs[0]?.runAt, created: false });

    h.advance(DAY);
    await h.runners[0].runDue(r.handlers);
    expect(r.runs).toHaveLength(1);
  });

  it('refuses an idempotency key reused for a different job', async () => {
    const h = await make();
    const p = payload();
    const key = `deadline:${p.reminderId}`;
    await h.scheduler.schedule({
      kind: CONTRACT_REMINDER,
      payload: p,
      delayMs: 0,
      idempotencyKey: key,
    });
    await expect(
      h.scheduler.schedule({
        kind: CONTRACT_REMINDER,
        payload: { ...p, studentId: newId() },
        delayMs: 0,
        idempotencyKey: key,
      }),
    ).rejects.toThrow(JobConflictError);
    await expect(
      h.scheduler.schedule({
        kind: OTHER,
        payload: { reminderId: p.reminderId },
        delayMs: 0,
        idempotencyKey: key,
      }),
    ).rejects.toThrow(JobConflictError);
  });

  it('retries a job whose handler throws, later rather than at once, then succeeds', async () => {
    const h = await make();
    const r = recorder((attempt) => attempt === 1);
    const errors: unknown[] = [];
    const { id } = await h.scheduler.schedule({
      kind: CONTRACT_REMINDER,
      payload: payload(),
      delayMs: 0,
    });
    const first = await h.runners[0].runDue(r.handlers, { onError: (e) => errors.push(e) });
    expect(first.retrying).toEqual([id]);
    expect(errors).toHaveLength(1);
    expect(await h.scheduler.get(id)).toMatchObject({ status: 'pending', attempts: 1 });
    await h.runners[0].runDue(r.handlers);
    expect(r.count(id)).toBe(1);

    h.advance(60 * MINUTE);
    expect((await h.runners[0].runDue(r.handlers)).completed).toEqual([id]);
    expect(r.runs.map((run) => run.attempt)).toEqual([1, 2]);
    expect(await h.scheduler.get(id)).toMatchObject({ status: 'done', attempts: 2 });
  });

  it('gives a job up after its last attempt', async () => {
    const h = await make();
    const r = recorder(() => true);
    const { id } = await h.scheduler.schedule({
      kind: CONTRACT_REMINDER,
      payload: payload(),
      delayMs: 0,
      maxAttempts: 2,
    });
    await h.runners[0].runDue(r.handlers, {
      onError: () => {
        throw new Error('a broken error reporter changes nothing');
      },
    });
    h.advance(60 * MINUTE);
    expect((await h.runners[0].runDue(r.handlers)).failed).toEqual([id]);
    h.advance(DAY);
    await h.runners[0].runDue(r.handlers);
    expect(r.count(id)).toBe(2);
    expect(await h.scheduler.get(id)).toMatchObject({ status: 'failed', attempts: 2 });
    expect(await h.scheduler.cancel(id)).toBe(false);
  });

  it('gives up a job no handler knows, without running anything', async () => {
    const h = await make();
    const r = recorder();
    const { id } = await h.scheduler.schedule({
      kind: OTHER,
      payload: { reminderId: newId() },
      delayMs: 0,
    });
    expect((await h.runners[0].runDue(r.handlers)).failed).toEqual([id]);
    expect(r.runs).toEqual([]);
    expect((await h.scheduler.get(id))?.status).toBe('failed');
  });

  it('lets runners racing for the same due jobs run each exactly once', async () => {
    const h = await make();
    const r = recorder();
    const ids: string[] = [];
    for (let i = 0; i < 6; i++) {
      ids.push(
        (await h.scheduler.schedule({ kind: CONTRACT_REMINDER, payload: payload(), delayMs: 0 }))
          .id,
      );
    }
    const reports = await Promise.all(
      [...h.runners, ...h.runners].map((runner) => runner.runDue(r.handlers)),
    );
    expect(reports.flatMap((report) => report.completed).sort()).toEqual([...ids].sort());
    for (const id of ids) expect(r.count(id)).toBe(1);
  });

  it('hands a job to another runner when its runner stalls, and ignores the stalled one later', async () => {
    const h = await make();
    const s = stalling();
    const r = recorder();
    const { id } = await h.scheduler.schedule({
      kind: CONTRACT_REMINDER,
      payload: payload(),
      delayMs: 0,
    });
    const first = h.runners[0].runDue(s.handlers);
    await s.waitFor(1);
    expect(await h.scheduler.get(id)).toMatchObject({ status: 'running', attempts: 1 });

    // Within the lease, nobody else takes it.
    h.advance(JOB_LEASE_MS - 1);
    await h.runners.at(-1)?.runDue(r.handlers);
    expect(r.count(id)).toBe(0);

    // After it, another runner does.
    h.advance(1);
    const second = h.runners.at(-1)?.runDue(s.handlers);
    await s.waitFor(2);
    expect(s.runs.map((run) => run.attempt)).toEqual([1, 2]);
    expect(await h.scheduler.get(id)).toMatchObject({ status: 'running', attempts: 2 });

    // The stalled first run fails at last: recorded, that would send the job back for a retry
    // while the second run still has it. It records nothing.
    s.runs[0]?.settle(false);
    await first;
    expect(await h.scheduler.get(id)).toMatchObject({ status: 'running', attempts: 2 });

    s.runs[1]?.settle(true);
    await second;
    expect(await h.scheduler.get(id)).toMatchObject({ status: 'done', attempts: 2 });
  });

  it('gives a job up when its runner stalls on its last attempt, and ignores that runner later', async () => {
    const h = await make();
    const s = stalling();
    const r = recorder();
    const { id } = await h.scheduler.schedule({
      kind: CONTRACT_REMINDER,
      payload: payload(),
      delayMs: 0,
      maxAttempts: 1,
    });
    const first = h.runners[0].runDue(s.handlers);
    await s.waitFor(1);
    h.advance(JOB_LEASE_MS);
    await h.runners.at(-1)?.runDue(r.handlers);
    expect(r.runs).toEqual([]);
    expect(await h.scheduler.get(id)).toMatchObject({ status: 'failed', attempts: 1 });

    s.runs[0]?.settle(true);
    await first;
    expect((await h.scheduler.get(id))?.status).toBe('failed');
  });
}

/** A handler whose runs stall until the test settles them, as a runner that hangs or dies. */
function stalling() {
  const runs: Array<{ attempt: number; settle: (ok: boolean) => void }> = [];
  let notify: () => void = () => undefined;
  const handlers: JobHandler[] = [
    handle(
      CONTRACT_REMINDER,
      (_payload, context) =>
        new Promise<void>((resolve, reject) => {
          runs.push({
            attempt: context.attempt,
            settle: (ok) => (ok ? resolve() : reject(new Error('stalled run failed'))),
          });
          notify();
        }),
    ),
  ];
  async function waitFor(count: number): Promise<void> {
    while (runs.length < count) await new Promise<void>((resolve) => (notify = resolve));
  }
  return { runs, handlers, waitFor };
}
