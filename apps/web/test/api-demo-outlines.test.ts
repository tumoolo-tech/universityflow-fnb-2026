import { en } from '@universityflow/content';
import type { Store } from '@universityflow/db';
import { describe, expect, it, vi } from 'vitest';
import { Browser } from './harness';

/**
 * The judge demo's SAMPLE module outline (Phase 6b), through the route handlers with a real
 * embedded database: "Use a sample module outline" reads the generator's SAMPLE outline exactly
 * as an upload is read, and the judge confirms it part by part. The made-up university learner
 * satisfies the consent gate only through its own made-up record (the DRAFT adult-v3, hackathon
 * exception I); a learner under the live wording is refused, on the demo as anywhere (D9). Only
 * the generator's SAMPLE PDFs are taken, as for reports.
 */

process.env['UF_DEPLOYMENT'] = 'demo';
process.env['UF_DEMO_PROJECT'] = '1';
process.env['AUTH_SECRET'] = 'demo-test-secret-that-is-long-enough-0123456789';

vi.mock('next/headers', async () => (await import('./harness')).nextHeaders);

let n = 7_400_000;
/** A synthetic number, built at runtime (hard rule 4). */
const phone = () => `+2782${String(n++).padStart(7, '0')}`;

/**
 * The seed stands in here, as in api-demo.test.ts: an adult made through the store's own methods,
 * with the draft wording for a university year (as personas.ts records it) and the live wording
 * for any other.
 */
vi.mock('../lib/server/demo/personas', async () => {
  const { en: content } = await import('@universityflow/content');
  const { DEMO_PERSONA_IDS } = await import('../lib/server/demo/types');
  const { DEMO_DRAFT_ADULT_CONSENT_VERSION } = await import('../lib/server/demo/outline-consent');
  return {
    DEMO_PERSONAS: DEMO_PERSONA_IDS.map((id) => ({ id, ...content.demoPersonas.personas[id] })),
    cloneDemoPersona: async (store: Store, id: string) => {
      const number = phone();
      const challenge = await store.requestOtp(number);
      if (challenge.review) throw new Error('unexpected');
      const { studentId } = await store.verifyOtp(number, challenge.code);
      await store.setDateOfBirth(studentId, '2006-03-14');
      const university = id === 'demo-second-year';
      await store.consentAsAdult(
        studentId,
        university ? DEMO_DRAFT_ADULT_CONSENT_VERSION : content.adultConsent.version,
      );
      if (university) {
        await store.forStudent(studentId).saveRegistration({
          universityId: 'wits',
          programmeId: 'wits-bcom',
          academicYear: 2026,
          yearOfStudy: 2,
          modules: [
            { code: 'DEMO2001', name: 'Sample module 1 (demo)', term: 'S2', credits: null },
          ],
        });
      }
      return studentId;
    },
  };
});

const routes = {
  start: (await import('../app/api/demo/start/route')).POST,
  sampleOutline: (await import('../app/api/demo/sample-outline/route')).POST,
  documents: (await import('../app/api/documents/route')).POST,
  outlines: await import('../app/api/module-outlines/route'),
};

let ip = 1;
async function start(persona: string) {
  const browser = new Browser();
  const { status } = await browser.json(routes.start, '/api/demo/start', {
    json: { persona },
    headers: { 'x-forwarded-for': `203.0.113.${ip++}` },
  });
  expect(status).toBe(200);
  return browser;
}

type Draft = {
  moduleCode: string;
  moduleName: string | null;
  academicYear: number;
  term: string | null;
  components: Array<{
    name: string;
    kind: string | null;
    weight: number;
    subminimum: number | null;
  }>;
  weightsTotal: number;
  dpPercent: number | null;
  dpQuote: string | null;
  examSubminimum: number | null;
  supplementaryQuote: string | null;
  people: Array<Record<string, unknown>>;
};

describe('the demo’s SAMPLE module outline', () => {
  it('a university learner attaches it, checks it and saves it, end to end', async () => {
    const browser = await start('demo-second-year');
    const read = await browser.json<{ documentId: string; outline: Draft; sample: boolean }>(
      routes.sampleOutline,
      '/api/demo/sample-outline',
      { method: 'POST' },
    );
    expect(read.status).toBe(200);
    const { outline, documentId } = read.body;
    // The second year's sample: the first module on their made-up registration.
    expect(outline.moduleCode).toBe('DEMO2001');
    expect(outline.weightsTotal).toBe(100);
    expect(outline.people[0]).toMatchObject({ email: 'a.sample@example.org', phone: null });
    expect(JSON.stringify(outline)).not.toContain('Sample Student');

    const saved = await browser.json<{
      outlines: Array<{ moduleCode: string; fromDocument: boolean }>;
    }>(routes.outlines.PUT, '/api/module-outlines', {
      method: 'PUT',
      json: {
        moduleCode: outline.moduleCode,
        moduleName: outline.moduleName,
        academicYear: outline.academicYear,
        term: outline.term,
        components: {
          status: 'confirmed',
          items: outline.components.map((c) => ({
            name: c.name,
            kind: c.kind ?? 'other',
            weight: c.weight,
            subminimum: c.subminimum,
          })),
          dpRequirement: { percent: outline.dpPercent, quote: outline.dpQuote },
          examSubminimum: outline.examSubminimum,
          supplementaryQuote: outline.supplementaryQuote,
        },
        dates: { status: 'not-in-outline' },
        books: { status: 'not-in-outline' },
        people: { status: 'not-in-outline' },
        documentId,
      },
    });
    expect(saved.status).toBe(200);
    expect(saved.body.outlines).toEqual([
      expect.objectContaining({ moduleCode: 'DEMO2001', fromDocument: true }),
    ]);
  });

  it('a learner under the live wording is refused it, on the demo as anywhere (D9)', async () => {
    const browser = await start('demo-grade-12');
    const read = await browser.json(routes.sampleOutline, '/api/demo/sample-outline', {
      method: 'POST',
    });
    expect(read).toMatchObject({
      status: 403,
      body: { error: 'consent-outdated', detail: 'module-outlines' },
    });
    expect(en.adultConsent.version).not.toMatch(/^adult-v3/);
  });

  it('the demo takes only the generator’s SAMPLE PDF as an outline upload', async () => {
    const browser = await start('demo-second-year');
    const form = new FormData();
    form.append(
      'file',
      new Blob([new TextEncoder().encode('%PDF-1.4 a real-looking outline')], {
        type: 'application/pdf',
      }),
      'outline.pdf',
    );
    form.append('kind', 'module-outline');
    expect(
      await browser.json(routes.documents, '/api/documents', { method: 'POST', body: form }),
    ).toMatchObject({ status: 400, body: { error: 'upload', detail: 'demo-sample-only' } });
  });
});
