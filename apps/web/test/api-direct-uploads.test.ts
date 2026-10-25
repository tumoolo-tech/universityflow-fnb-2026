import type { MemoryDirectUploads } from '@universityflow/documents';
import { describe, expect, it, vi } from 'vitest';
import { agreeAsAdult } from './adult-consent';
import { Browser } from './harness';

/**
 * Direct-to-storage uploads (open finding 3) over the real route handlers and database, with
 * S3 replaced by its stand-in: `MemoryDirectUploads` signs tickets and enforces their policy the
 * way S3 does, and `receive` plays the browser's post to the bucket.
 */

vi.mock('next/headers', async () => (await import('./harness')).nextHeaders);

const fake = vi.hoisted(() => ({ uploads: null as MemoryDirectUploads | null }));
vi.mock('../lib/server/services', async (importOriginal) => {
  const real = await importOriginal<typeof import('../lib/server/services')>();
  const { MemoryDirectUploads } = await import('@universityflow/documents');
  return {
    ...real,
    getServices: async () => {
      const services = await real.getServices();
      fake.uploads ??= new MemoryDirectUploads();
      return { ...services, files: fake.uploads.store, uploads: fake.uploads };
    },
  };
});

const routes = {
  requestPin: (await import('../app/api/auth/request-pin/route')).POST,
  verifyPin: (await import('../app/api/auth/verify-pin/route')).POST,
  dob: (await import('../app/api/me/date-of-birth/route')).POST,
  me: await import('../app/api/me/route'),
  documents: await import('../app/api/documents/route'),
  intent: (await import('../app/api/documents/uploads/route')).POST,
  complete: (await import('../app/api/documents/uploads/[id]/route')).POST,
  outbox: (await import('../app/api/dev/outbox/route')).GET,
};

let n = 3_000_000;
/** A synthetic number, built at runtime (hard rule 4). */
const phone = () => `082${String(n++).padStart(7, '0')}`;

async function signedIn() {
  const browser = new Browser();
  const number = phone();
  await browser.json(routes.requestPin, '/api/auth/request-pin', { json: { phone: number } });
  const { body } = await browser.json<{ messages: Array<{ to: string; body: string }> }>(
    routes.outbox,
    '/api/dev/outbox',
  );
  const pin = body.messages
    .find((m) => m.to === `+27${number.slice(1)}`)
    ?.body.match(/\b(\d{6})\b/)?.[1];
  await browser.json(routes.verifyPin, '/api/auth/verify-pin', { json: { phone: number, pin } });
  return browser;
}

async function adult() {
  const browser = await signedIn();
  await browser.json(routes.dob, '/api/me/date-of-birth', { json: { dateOfBirth: '2000-02-02' } });
  await agreeAsAdult(browser);
  return browser;
}

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);

interface Ticket {
  uploadId: string;
  url: string;
  fields: Record<string, string>;
  expiresAt: string;
}

async function ticket(browser: Browser, contentType = 'image/jpeg', size = JPEG.length) {
  return browser.json<Ticket>(routes.intent, '/api/documents/uploads', {
    json: { contentType, size },
  });
}

function complete(browser: Browser, uploadId: string) {
  return browser.json<{
    documentId?: string;
    draft?: { rows: unknown[] } | null;
    sample?: boolean;
    error?: string;
    detail?: string | null;
  }>(routes.complete, `/api/documents/uploads/${uploadId}`, {
    method: 'POST',
    params: { id: uploadId },
  });
}

const uploads = () => {
  if (!fake.uploads) throw new Error('services not created yet');
  return fake.uploads;
};

describe('direct uploads: ticket → post to storage → complete', () => {
  it('reads a file posted straight to storage into a draft, kept at a key no ticket can write', async () => {
    const browser = await adult();
    const issued = await ticket(browser);
    expect(issued.status).toBe(200);
    const incoming = issued.body.fields['key'] ?? '';
    expect(incoming).toMatch(/^incoming-[0-9a-f]{32}$/);
    expect(new Date(issued.body.expiresAt).getTime()).toBeGreaterThan(Date.now());

    await uploads().receive(issued.body.fields, JPEG);
    const done = await complete(browser, issued.body.uploadId);
    expect(done.status).toBe(200);
    expect(done.body.sample).toBe(true);
    expect(done.body.draft?.rows.length).toBeGreaterThan(5);

    // The checked file moved to its own key; the landing key is gone.
    expect(await uploads().inspect(incoming)).toBeNull();
    const listed = await browser.json<{ documents: Array<{ id: string; status: string }> }>(
      routes.documents.GET,
      '/api/documents',
    );
    expect(listed.body.documents).toEqual([
      expect.objectContaining({ id: done.body.documentId, status: 'extracted' }),
    ]);
    expect(JSON.stringify(listed.body)).not.toMatch(/incoming-|doc-/);
  });

  it('reads an offer letter the same way, when the completion names it (Phase 5a)', async () => {
    const browser = await adult();
    const issued = await ticket(browser);
    await uploads().receive(issued.body.fields, JPEG);
    const id = issued.body.uploadId;
    // An unknown kind is refused before the upload is claimed, so it can still be completed.
    const refused = await browser.json(routes.complete, `/api/documents/uploads/${id}?kind=x`, {
      method: 'POST',
      params: { id },
    });
    expect(refused.status).toBe(400);
    const done = await browser.json<{ letter: { kind: string } | null; candidates: string[] }>(
      routes.complete,
      `/api/documents/uploads/${id}?kind=acceptance-letter`,
      { method: 'POST', params: { id } },
    );
    expect(done.status).toBe(200);
    expect(done.body.letter?.kind).toBe('provisional');
    expect(done.body.candidates).toContain('uj-beng-civil');
  });

  it('reads a proof of registration the same way, when the completion names it (Phase 5c)', async () => {
    const browser = await adult();
    const issued = await ticket(browser);
    await uploads().receive(issued.body.fields, JPEG);
    const id = issued.body.uploadId;
    const done = await browser.json<{
      registration: { modules: Array<{ code: string }> } | null;
      sample: boolean;
    }>(routes.complete, `/api/documents/uploads/${id}?kind=proof-of-registration`, {
      method: 'POST',
      params: { id },
    });
    expect(done.status).toBe(200);
    expect(done.body.sample).toBe(true);
    expect(done.body.registration?.modules.map((m) => m.code)).toEqual([
      'TEST101',
      'TEST102',
      'TEST103',
    ]);
  });

  it('runs the magic-byte checks on what arrived, and deletes a file that fails them', async () => {
    const browser = await adult();
    // The type field matches the policy, but the bytes are not a JPEG.
    const html = new TextEncoder().encode('<html><script>x</script></html>');
    const issued = await ticket(browser, 'image/jpeg', html.length);
    await uploads().receive(issued.body.fields, html);
    const done = await complete(browser, issued.body.uploadId);
    expect(done).toMatchObject({
      status: 400,
      body: { error: 'upload', detail: 'unsupported-type' },
    });
    expect(await uploads().inspect(issued.body.fields['key'] ?? '')).toBeNull();
    const listed = await browser.json<{ documents: unknown[] }>(
      routes.documents.GET,
      '/api/documents',
    );
    expect(listed.body.documents).toEqual([]);
  });

  it('refuses a real file of another type than the one declared', async () => {
    const browser = await adult();
    const pdf = new TextEncoder().encode('%PDF-1.7 synthetic');
    const issued = await ticket(browser, 'image/jpeg', pdf.length);
    // A browser that lies about the type in the form is refused by storage's policy...
    await expect(
      uploads().receive({ ...issued.body.fields, 'Content-Type': 'application/pdf' }, pdf),
    ).rejects.toThrow();
    // ...and one that keeps the declared type field is refused by the magic bytes.
    await uploads().receive(issued.body.fields, pdf);
    expect((await complete(browser, issued.body.uploadId)).body).toMatchObject({
      error: 'upload',
      detail: 'unsupported-type',
    });
  });

  it('completes an upload once only', async () => {
    const browser = await adult();
    const issued = await ticket(browser);
    await uploads().receive(issued.body.fields, JPEG);
    expect((await complete(browser, issued.body.uploadId)).status).toBe(200);
    expect((await complete(browser, issued.body.uploadId)).status).toBe(404);
  });

  it('says so when nothing arrived', async () => {
    const browser = await adult();
    const issued = await ticket(browser);
    expect(await complete(browser, issued.body.uploadId)).toMatchObject({
      status: 409,
      body: { error: 'upload', detail: 'not-received' },
    });
  });

  it("never completes another learner's upload", async () => {
    const owner = await adult();
    const other = await adult();
    const issued = await ticket(owner);
    await uploads().receive(issued.body.fields, JPEG);
    expect((await complete(other, issued.body.uploadId)).status).toBe(404);
    expect((await complete(owner, issued.body.uploadId)).status).toBe(200);
  });

  it('answers not found for an id that is not one', async () => {
    const browser = await adult();
    expect((await complete(browser, 'not-a-uuid')).status).toBe(404);
    expect((await complete(browser, '00000000-0000-4000-8000-000000000000')).status).toBe(404);
  });

  it('refuses a type it cannot read, or a file over 10 MB, before issuing a ticket', async () => {
    const browser = await adult();
    expect((await ticket(browser, 'text/html')).body).toMatchObject({
      error: 'upload',
      detail: 'unsupported-type',
    });
    expect((await ticket(browser, 'image/jpeg', 10 * 1024 * 1024 + 1)).body).toMatchObject({
      error: 'upload',
      detail: 'too-large',
    });
    expect(
      (
        await browser.json(routes.intent, '/api/documents/uploads', {
          json: { contentType: 'image/jpeg', size: -1 },
        })
      ).status,
    ).toBe(400);
  });

  it('signs the ticket for exactly the declared size', async () => {
    const browser = await adult();
    const issued = await ticket(browser, 'image/jpeg', JPEG.length - 1);
    await expect(uploads().receive(issued.body.fields, JPEG)).rejects.toThrow();
  });
});

describe('direct uploads: the same guards as any upload', () => {
  it('refuses another site (CSRF)', async () => {
    const browser = await adult();
    const result = await browser.json(routes.intent, '/api/documents/uploads', {
      json: { contentType: 'image/jpeg', size: 10 },
      origin: 'https://evil.example',
    });
    expect(result).toMatchObject({ status: 403, body: { error: 'forbidden' } });
    const done = await browser.json(
      routes.complete,
      '/api/documents/uploads/00000000-0000-4000-8000-000000000000',
      {
        method: 'POST',
        params: { id: '00000000-0000-4000-8000-000000000000' },
        origin: 'https://evil.example',
      },
    );
    expect(done.status).toBe(403);
  });

  it('refuses a signed-out request', async () => {
    expect((await ticket(new Browser())).status).toBe(401);
  });

  it('refuses a minor before a guardian consents (hard rule 5)', async () => {
    const browser = await signedIn();
    await browser.json(routes.dob, '/api/me/date-of-birth', {
      json: { dateOfBirth: '2010-05-05' },
    });
    expect(await ticket(browser)).toMatchObject({ status: 403, body: { error: 'consent' } });
  });

  it('counts against the same daily upload quota', async () => {
    const browser = await adult();
    const statuses: number[] = [];
    for (let i = 0; i < 21; i++) statuses.push((await ticket(browser)).status);
    expect(statuses.slice(0, 20).every((s) => s === 200)).toBe(true);
    expect(statuses[20]).toBe(429);
  });

  it('deletes a file left by an upload never completed when the account is deleted', async () => {
    const browser = await adult();
    const issued = await ticket(browser);
    await uploads().receive(issued.body.fields, JPEG);
    const key = issued.body.fields['key'] ?? '';
    expect(await uploads().inspect(key)).not.toBeNull();
    expect((await browser.call(routes.me.DELETE, '/api/me', { method: 'DELETE' })).status).toBe(
      200,
    );
    expect(await uploads().inspect(key)).toBeNull();
  });
});
