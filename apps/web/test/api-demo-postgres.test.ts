import { type Database, openDatabase } from '@universityflow/db';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Browser } from './harness';

/**
 * The judge demo on a shared Postgres (Supabase, the owner's decision of 2026-10-23;
 * docs/deploy/demo.md), as Vercel runs it: several function instances, each with its own
 * services and pool, on one database. Gated like packages/db's real-Postgres suite: runs when
 * TEST_DATABASE_URL points at a scratch server (through a transaction pooler such as PgBouncer,
 * to stand for Supabase's). Each run makes its own database and drops it.
 *
 * Seen live on 2026-10-23 without one: each instance had its own embedded database in /tmp, so a
 * judge who picked a learner was sent back to sign-in on the next request.
 */

vi.mock('next/headers', async () => (await import('./harness')).nextHeaders);

const url = process.env['TEST_DATABASE_URL'];
const GLOBAL = globalThis as typeof globalThis & { __ufServices?: unknown };

type Services = Awaited<ReturnType<typeof import('../lib/server/services').createServices>>;

describe.skipIf(!url)('the judge demo on a shared Postgres, instance by instance', () => {
  const name = `uf_demo_${Date.now()}`;
  let admin: Database;
  let instances: Services[] = [];
  let routes: {
    start: typeof import('../app/api/demo/start/route').POST;
    sampleReport: typeof import('../app/api/demo/sample-report/route').POST;
    me: typeof import('../app/api/me/route');
  };

  /** The next request lands on this instance. */
  const on = (instance: Services | undefined) => {
    GLOBAL.__ufServices = Promise.resolve(instance);
    return instance as Services;
  };

  beforeAll(async () => {
    admin = openDatabase(url ?? '');
    await admin.exec(`create database ${name}`);
    const demoUrl = new URL(url ?? '');
    demoUrl.pathname = `/${name}`;
    Object.assign(process.env, {
      UF_DEPLOYMENT: 'demo',
      UF_DEMO_PROJECT: '1',
      AUTH_SECRET: 'demo-test-secret-that-is-long-enough-0123456789',
      DATABASE_URL: demoUrl.toString(),
      UF_DEMO_DATABASE: 'synthetic',
    });
    routes = {
      start: (await import('../app/api/demo/start/route')).POST,
      sampleReport: (await import('../app/api/demo/sample-report/route')).POST,
      me: await import('../app/api/me/route'),
    };
  });

  afterAll(async () => {
    GLOBAL.__ufServices = null;
    await Promise.all(instances.map((instance) => instance.database.close()));
    await admin?.exec(`drop database if exists ${name} with (force)`);
    await admin?.close();
  });

  it('three instances cold-start at once on the new database, each migrating as it starts', async () => {
    const { readConfig } = await import('../lib/server/config');
    const { createServices } = await import('../lib/server/services');
    const config = readConfig();
    expect(config.filesInDatabase).toBe(true);
    instances = await Promise.all([1, 2, 3].map(() => createServices(config)));
    expect(instances).toHaveLength(3);
  });

  it('a judge who picks a learner on one instance is still signed in on the next', async () => {
    const browser = new Browser();
    on(instances[0]);
    const started = await browser.json(routes.start, '/api/demo/start', {
      json: { persona: 'demo-grade-11' },
      headers: { 'x-forwarded-for': '203.0.113.10' },
    });
    expect(started.status).toBe(200);
    on(instances[1]);
    const me = await browser.call(routes.me.GET, '/api/me');
    expect(me.status).toBe(200);
  });

  it('two judges start the same learner at the same moment, on two instances: two private copies', async () => {
    const { cloneDemoPersona } = await import('../lib/server/demo/personas');
    const [a, b] = [on(instances[0]), instances[2] as Services];
    const ids = await Promise.all([
      cloneDemoPersona(a.store, 'demo-grade-11'),
      cloneDemoPersona(b.store, 'demo-grade-11'),
    ]);
    expect(new Set(ids).size).toBe(2);
    const tokens = await Promise.all([
      a.store.openDemoSession(ids[0] as string),
      b.store.openDemoSession(ids[1] as string),
    ]);
    expect(await b.store.sessionStudent(tokens[0])).toBe(ids[0]);
    expect(await a.store.sessionStudent(tokens[1])).toBe(ids[1]);
  });

  it('a sample report stored on one instance is read on another, and the 24-hour sweep deletes every copy with its files', async () => {
    const browser = new Browser();
    const first = on(instances[0]);
    const started = await browser.json(routes.start, '/api/demo/start', {
      json: { persona: 'demo-grade-12' },
      headers: { 'x-forwarded-for': '203.0.113.11' },
    });
    expect(started.status).toBe(200);
    const put = vi.spyOn(first.files, 'put');
    const report = await browser.json(routes.sampleReport, '/api/demo/sample-report', {
      method: 'POST',
    });
    expect(report.status).toBe(200);
    const [key] = put.mock.calls.map(([k]) => k);
    put.mockRestore();
    const other = instances[1] as Services;
    expect((await other.files.get(key as string))?.mimeType).toBe('application/pdf');

    const { sweepOldCopies } = await import('../lib/server/demo/core');
    const count = async (table: string) => {
      const result = await other.database.db.execute(`select count(*)::int as n from ${table}`);
      return (result as unknown as { rows: Array<{ n: number }> }).rows[0]?.n;
    };
    expect(await count('students')).toBeGreaterThan(0);
    expect(await count('stored_files')).toBeGreaterThan(0);
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(Date.now() + 25 * 60 * 60 * 1000));
    try {
      // Two instances sweep at once, as two judges starting at the same moment would.
      for (let i = 0; i < 5 && (await count('students')); i++) {
        await Promise.all([sweepOldCopies(other), sweepOldCopies(instances[2] as Services)]);
      }
    } finally {
      vi.useRealTimers();
    }
    expect(await count('students')).toBe(0);
    expect(await count('stored_files')).toBe(0);
    expect(await other.files.get(key as string)).toBeNull();
  });
});
