import { en } from '@universityflow/content';
import { MemoryCvEngine } from '@universityflow/cv';
import type { CvDocumentRecord } from '@universityflow/db';
import type { PlanMapsResponse, PlanMapView, PlanNode } from '@universityflow/ui';
import { isValidElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Browser } from './harness';

/**
 * Three HACKATHON EXCEPTIONS on the judge demo (the owner, 2026-10-24; docs/deploy/demo.md), end
 * to end through the route handlers with the real seed on a demo store:
 *
 * - My CV on the built-in stand-in engine (UF_CV=1; never Mmereko, D14). A demo has no job
 *   runner, so the stand-in's jobs run at once, in the request (lib/server/demo/cv-inline.ts):
 *   "Make my CV" is ready on the next read, nothing waits in the job queue, and no webhook is
 *   needed. A made-up learner opts in themselves (the data layer's gate is untouched: the preview
 *   stands in for the wording only, never the opt-in or the age rules); an adult may make a share
 *   link, an under-18 may not (drafts only, §9.3).
 * - Plan-map words (UF_MINDMAP_WORDS=1): a made-up learner's words save, and the crisis check
 *   reads every save.
 * - Read aloud: off without the ElevenLabs key, as before (the key itself is never used here).
 */

process.env['UF_DEPLOYMENT'] = 'demo';
process.env['UF_DEMO_PROJECT'] = '1';
process.env['AUTH_SECRET'] = 'demo-test-secret-that-is-long-enough-0123456789';
process.env['UF_CV'] = '1';
process.env['UF_MINDMAP_WORDS'] = '1';

vi.mock('next/headers', async () => (await import('./harness')).nextHeaders);

const routes = {
  start: (await import('../app/api/demo/start/route')).POST,
  switchLearner: (await import('../app/api/demo/switch/route')).POST,
  optIn: await import('../app/api/me/cv/opt-in/route'),
  selection: await import('../app/api/me/cv/selection/route'),
  drafts: (await import('../app/api/me/cv/drafts/route')).POST,
  tailorings: (await import('../app/api/me/cv/tailorings/route')).POST,
  documents: (await import('../app/api/me/cv/documents/route')).GET,
  document: await import('../app/api/me/cv/documents/[id]/route'),
  confirm: (await import('../app/api/me/cv/documents/[id]/confirm/route')).POST,
  report: (await import('../app/api/me/cv/documents/[id]/report/route')).POST,
  shares: await import('../app/api/me/cv/shares/route'),
  pdf: (await import('../app/api/cv/pdf/[id]/route')).GET,
  maps: (await import('../app/api/me/plan-maps/route')).GET,
  map: await import('../app/api/me/plan-maps/[id]/route'),
  node: await import('../app/api/me/plan-maps/[id]/nodes/[nodeId]/route'),
  speech: (await import('../app/api/speech/route')).GET,
};
const { getServices } = await import('../lib/server/services');

let ip = 0;
async function start(persona: string): Promise<Browser> {
  const browser = new Browser();
  ip += 1;
  const started = await browser.json(routes.start, '/api/demo/start', {
    json: { persona },
    headers: { 'x-forwarded-for': `203.0.113.${150 + ip}` },
  });
  expect(started.status).toBe(200);
  return browser;
}

const SELECTION = {
  surname: null,
  label: null,
  summary: null,
  email: null,
  phone: null,
  city: null,
  region: null,
  includeSchool: true,
  subjectIds: [],
  includeOffer: false,
  moduleCodes: [],
  entryIds: [],
};

/** Opts in (the learner's own press) and ticks their school: ready to make a CV. */
async function readyForCv(browser: Browser) {
  const opted = await browser.json(routes.optIn.POST, '/api/me/cv/opt-in', { json: {} });
  expect(opted.status).toBe(200);
  const ticked = await browser.json<{ ready: boolean; missing: string[] }>(
    routes.selection.PUT,
    '/api/me/cv/selection',
    { method: 'PUT', json: SELECTION },
  );
  expect(ticked.status).toBe(200);
  expect(ticked.body.missing).toEqual([]);
  expect(ticked.body.ready).toBe(true);
}

async function documents(browser: Browser) {
  const list = await browser.json<{ documents: CvDocumentRecord[] }>(
    routes.documents,
    '/api/me/cv/documents',
  );
  expect(list.status).toBe(200);
  return list.body.documents;
}

/** Jobs of the CV's kinds still waiting in the database's queue (none on a demo). */
async function cvJobsWaiting(): Promise<number> {
  const { database } = await getServices();
  const result = await database.db.execute(
    `select count(*)::int as n from jobs where kind like 'cv.%' and status = 'pending'`,
  );
  return Number((result as unknown as { rows: Array<{ n: number }> }).rows[0]?.n ?? 0);
}

describe('My CV on the judge demo: the built-in stand-in, never Mmereko (D14)', () => {
  it('the engine is the in-process stand-in, and no Mmereko setting exists', async () => {
    const services = await getServices();
    expect(services.config).toMatchObject({ demo: true, cv: true, cvProvider: null });
    expect(services.config.mmereko).toBeNull();
    expect(services.cv).toBeInstanceOf(MemoryCvEngine);
  });

  it('an adult made-up learner makes a CV, opens it, fits one to a job, reports it, shares one and deletes one', async () => {
    const browser = await start('demo-final-year');
    await readyForCv(browser);

    // "Make my CV": 202, and ready on the next read (the stand-in ran in the request).
    const made = await browser.json<{ document: CvDocumentRecord }>(
      routes.drafts,
      '/api/me/cv/drafts',
      { json: {} },
    );
    expect(made.status).toBe(202);
    const [draft] = await documents(browser);
    expect(draft?.id).toBe(made.body.document.id);
    expect(draft?.status).toBe('ready');
    expect(draft?.hasPdf).toBe(true);
    expect(draft?.markdown).toContain('Kagiso');
    expect(await cvJobsWaiting()).toBe(0);

    // The preview's PDF, through the 60-second link.
    const opened = await browser.json<{ pdf: { url: string } | null }>(
      routes.document.GET,
      `/api/me/cv/documents/${draft?.id}`,
      { params: { id: draft?.id ?? '' } },
    );
    expect(opened.status).toBe(200);
    const link = new URL(opened.body.pdf?.url ?? 'http://x/');
    const pdf = await browser.call(routes.pdf, `${link.pathname}${link.search}`, {
      params: { id: draft?.id ?? '' },
    });
    expect(pdf.status).toBe(200);
    expect(pdf.headers.get('content-type')).toBe('application/pdf');

    // "Fit it to a job", on the stand-in: ready at once, with its ATS numbers.
    const fitted = await browser.json<{ document: CvDocumentRecord }>(
      routes.tailorings,
      '/api/me/cv/tailorings',
      {
        json: {
          advert: {
            title: 'Junior developer',
            company: 'Example Company',
            text: 'We need Python and teamwork.',
          },
        },
      },
    );
    expect(fitted.status).toBe(202);
    const tailored = (await documents(browser)).find((d) => d.id === fitted.body.document.id);
    expect(tailored?.status).toBe('ready');
    expect(tailored?.atsCoverage).not.toBeNull();

    // "Report this CV" on the fitted one.
    const reported = await browser.json(
      routes.report,
      `/api/me/cv/documents/${tailored?.id}/report`,
      { json: { reason: 'untrue' }, params: { id: tailored?.id ?? '' } },
    );
    expect(reported.status).toBe(200);
    expect(reported.body).toEqual({ status: 'reported' });

    // 18+: a share link for a CV checked line by line.
    const confirmed = await browser.json(
      routes.confirm,
      `/api/me/cv/documents/${draft?.id}/confirm`,
      { json: {}, params: { id: draft?.id ?? '' } },
    );
    expect(confirmed.status).toBe(200);
    const optedShare = await browser.json(routes.optIn.POST, '/api/me/cv/opt-in', {
      json: { share: true },
    });
    expect(optedShare.status).toBe(200);
    const shared = await browser.json<{ url: string }>(routes.shares.POST, '/api/me/cv/shares', {
      json: { documentId: draft?.id },
    });
    expect(shared.status).toBe(201);
    expect(shared.body.url).toMatch(/\/cv\/s\//);

    // Delete one.
    const deleted = await browser.json(
      routes.document.DELETE,
      `/api/me/cv/documents/${tailored?.id}`,
      { method: 'DELETE', params: { id: tailored?.id ?? '' } },
    );
    expect(deleted.status).toBe(200);
    expect((await documents(browser)).map((d) => d.id)).toEqual([draft?.id]);
    expect(await cvJobsWaiting()).toBe(0);
  }, 120_000);

  it('an under-18 made-up learner makes drafts, but never a share link (§9.3)', async () => {
    const browser = await start('demo-grade-11');
    await readyForCv(browser);
    const made = await browser.json(routes.drafts, '/api/me/cv/drafts', { json: {} });
    expect(made.status).toBe(202);
    const [draft] = await documents(browser);
    expect(draft?.status).toBe('ready');
    const state = await browser.json<{ canShare: boolean }>(routes.optIn.GET, '/api/me/cv/opt-in');
    expect(state.body.canShare).toBe(false);
    const share = await browser.json(routes.optIn.POST, '/api/me/cv/opt-in', {
      json: { share: true },
    });
    expect(share.status).toBeGreaterThanOrEqual(400);
  }, 120_000);

  it('"Stop using Mmereko" deletes the CVs; nothing waits in the job queue', async () => {
    const browser = await start('demo-second-year');
    await readyForCv(browser);
    await browser.json(routes.drafts, '/api/me/cv/drafts', { json: {} });
    expect(await documents(browser)).toHaveLength(1);
    const stopped = await browser.json<{ deleted: { cvs: number } }>(
      routes.optIn.DELETE,
      '/api/me/cv/opt-in',
      { method: 'DELETE' },
    );
    expect(stopped.status).toBe(200);
    expect(stopped.body.deleted.cvs).toBe(1);
    expect(await cvJobsWaiting()).toBe(0);
  }, 120_000);
});

/** Every string in a server component's tree. */
function textsOf(node: unknown, into: string[] = []): string[] {
  if (typeof node === 'string') into.push(node);
  else if (Array.isArray(node)) for (const child of node) textsOf(child, into);
  else if (isValidElement<Record<string, unknown>>(node)) {
    for (const value of Object.values(node.props)) textsOf(value, into);
  }
  return into;
}

describe('My CV’s page on the judge demo', () => {
  it('says plainly that the CVs come from a stand-in, never Mmereko', async () => {
    const browser = await start('demo-first-year');
    browser.enter();
    const CvPage = (await import('../app/(app)/cv/page')).default;
    const tree = await CvPage();
    expect(textsOf(tree)).toContain(en.demoPersonas.cvStandIn);
    // And tells the island so, so it says nothing of an AI fitting a CV (cv-page.test.tsx).
    expect(initialOf(tree)?.standIn).toBe(true);
  }, 120_000);
});

/** The `initial` prop of the page's client island, wherever it sits in the tree. */
function initialOf(node: unknown): { standIn?: boolean } | null {
  if (Array.isArray(node)) {
    for (const child of node) {
      const hit = initialOf(child);
      if (hit) return hit;
    }
    return null;
  }
  if (!isValidElement<Record<string, unknown>>(node)) return null;
  if (node.props['initial']) return node.props['initial'] as { standIn?: boolean };
  for (const value of Object.values(node.props)) {
    const hit = initialOf(value);
    if (hit) return hit;
  }
  return null;
}

describe('plan-map words on the judge demo, the crisis check on every save', () => {
  it('a made-up learner writes in their map, and crisis words bring the card', async () => {
    const browser = await start('demo-grade-10');
    const list = await browser.json<PlanMapsResponse>(routes.maps, '/api/me/plan-maps');
    expect(list.body.wordsAllowed).toBe(true);
    const id = list.body.maps[0]?.id ?? '';
    const read = await browser.json<{ map: PlanMapView }>(
      routes.map.GET,
      `/api/me/plan-maps/${id}`,
      {
        params: { id },
      },
    );
    expect(read.body.map.wordsAllowed).toBe(true);
    const part = read.body.map.nodes.find((n) => n.parentId !== null);
    if (!part) throw new Error('no part');
    const save = (body: Record<string, unknown>) =>
      browser.json<{ node: PlanNode; care: { level: string } | null }>(
        routes.node.PUT,
        `/api/me/plan-maps/${id}/nodes/${part.id}`,
        { method: 'PUT', json: body, params: { id, nodeId: part.id } },
      );
    const words = await save({ text: 'Pass maths with 70%' });
    expect(words.status).toBe(200);
    expect(words.body.node.text).toBe('Pass maths with 70%');
    expect(words.body.care).toBeNull();
    const crisis = await save({
      status: 'not-achieved',
      whyNot: 'I failed because I wanted to die that year',
    });
    expect(crisis.status).toBe(200);
    expect(crisis.body.care?.level).toBe('crisis');
  }, 120_000);
});

describe('Read aloud on the judge demo', () => {
  it('is off without the ElevenLabs key, exactly as before', async () => {
    const browser = await start('demo-first-year');
    const speech = await browser.json<{ available: boolean }>(routes.speech, '/api/speech');
    expect(speech.status).toBe(200);
    expect(speech.body.available).toBe(false);
    expect((await getServices()).voice).toBeNull();
  }, 120_000);
});
