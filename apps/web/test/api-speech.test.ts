import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { agreeAsAdult } from './adult-consent';
import { Browser, type CallOptions } from './harness';

/**
 * Read aloud's route (owner's choice of 2026-10-22: ElevenLabs only), over the real route handlers
 * and an embedded database, with the fake voice in ElevenLabs' place: no test calls ElevenLabs.
 *
 * GET /api/speech says whether Read aloud is offered; GET /api/speech/<place id> is a place's
 * audio. Signed in and consent-ready only; the place's id is the only input; a per-learner limit.
 */

vi.mock('next/headers', async () => (await import('./harness')).nextHeaders);

const { readConfig } = await import('../lib/server/config');
const { createServices } = await import('../lib/server/services');
const { FakeVoice } = await import('../lib/server/voice');
const { QUOTAS } = await import('../lib/server/http');
const { placeText } = await import('../lib/server/read-aloud');

type Global = { __ufServices?: unknown };
const voice = new FakeVoice();
const withVoice = createServices(readConfig(), { voice });
const withoutVoice = createServices(readConfig(), { voice: null });
(globalThis as Global).__ufServices = withVoice;

const routes = {
  requestPin: (await import('../app/api/auth/request-pin/route')).POST,
  verifyPin: (await import('../app/api/auth/verify-pin/route')).POST,
  dob: (await import('../app/api/me/date-of-birth/route')).POST,
  outbox: (await import('../app/api/dev/outbox/route')).GET,
  status: await import('../app/api/speech/route'),
  audio: await import('../app/api/speech/[place]/route'),
};

let n = 4_300_000;
/** A synthetic number, built at runtime (hard rule 4). */
const phone = () => `082${String(n++).padStart(7, '0')}`;
const NATIVE: CallOptions = { origin: null, headers: { 'x-uf-client': 'native' } };

async function signIn(options: CallOptions = {}) {
  const browser = new Browser();
  const number = phone();
  await browser.json(routes.requestPin, '/api/auth/request-pin', {
    ...options,
    json: { phone: number },
  });
  const { body } = await browser.json<{ messages: Array<{ to: string; body: string }> }>(
    routes.outbox,
    '/api/dev/outbox',
  );
  const pin = body.messages
    .filter((m) => m.to === `+27${number.slice(1)}`)
    .at(-1)
    ?.body.match(/\d{6}/)?.[0];
  const verified = await browser.json<{ token?: string }>(
    routes.verifyPin,
    '/api/auth/verify-pin',
    {
      ...options,
      json: { phone: number, pin },
    },
  );
  const call: CallOptions = verified.body.token
    ? { bearer: verified.body.token, origin: null }
    : {};
  return { browser, call };
}

/** An adult learner who has agreed (consent-ready). */
async function ready(options: CallOptions = {}) {
  const learner = await signIn(options);
  await learner.browser.json(routes.dob, '/api/me/date-of-birth', {
    ...learner.call,
    json: { dateOfBirth: '2000-02-02' },
  });
  await agreeAsAdult(learner.browser, learner.call);
  return learner;
}

type Learner = Awaited<ReturnType<typeof signIn>>;
const audio = ({ browser, call }: Learner, place: string, extra: CallOptions = {}) =>
  browser.call(routes.audio.GET, `/api/speech/${encodeURIComponent(place)}`, {
    ...call,
    ...extra,
    params: { place },
  });
const status = ({ browser, call }: Learner) =>
  browser.json<{ available: boolean }>(routes.status.GET, '/api/speech', call);

/** A place every learner may see in the preview catalogue the tests run on. */
let PLACE = '';
beforeAll(async () => {
  const view = (await withVoice).catalogue();
  PLACE = view.places.find((p) => placeText(view, p.id) !== null)?.id ?? '';
  expect(PLACE).not.toBe('');
});

describe('GET /api/speech: whether Read aloud is offered', () => {
  it('yes with a voice, to a signed-in learner; never to a stranger', async () => {
    expect((await new Browser().json(routes.status.GET, '/api/speech')).status).toBe(401);
    const learner = await ready();
    expect(await status(learner)).toEqual({ status: 200, body: { available: true } });
  });
});

describe('GET /api/speech/<place>: a place’s audio', () => {
  it('is the voice’s MP3 of the place’s catalogue text, cached, on the web and in the app', async () => {
    const before = voice.spoken.length;
    const web = await ready();
    const response = await audio(web, PLACE);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('audio/mpeg');
    expect(response.headers.get('accept-ranges')).toBe('bytes');
    expect(response.headers.get('cache-control')).toMatch(/private/);
    expect(new Uint8Array(await response.arrayBuffer()).byteLength).toBeGreaterThan(0);
    const view = (await withVoice).catalogue();
    expect(voice.spoken.slice(before)).toEqual([placeText(view, PLACE)]);

    // The app, with its bearer token: the same audio, from the cache.
    const app = await ready(NATIVE);
    expect((await audio(app, PLACE)).status).toBe(200);
    expect(voice.spoken.length).toBe(before + 1);
  });

  it('serves a byte range, as Safari and the phones ask for audio', async () => {
    const learner = await ready();
    const whole = new Uint8Array(await (await audio(learner, PLACE)).arrayBuffer());
    const part = await audio(learner, PLACE, { headers: { range: 'bytes=0-1' } });
    expect(part.status).toBe(206);
    expect(part.headers.get('content-range')).toBe(`bytes 0-1/${whole.byteLength}`);
    expect(new Uint8Array(await part.arrayBuffer())).toEqual(whole.slice(0, 2));
    const tail = await audio(learner, PLACE, { headers: { range: 'bytes=2-' } });
    expect(new Uint8Array(await tail.arrayBuffer())).toEqual(whole.slice(2));
    const outside = await audio(learner, PLACE, { headers: { range: 'bytes=999-' } });
    expect(outside.status).toBe(416);
  });

  it('signed in and consent-ready only (hard rule 5), and the voice is never asked otherwise', async () => {
    const before = voice.spoken.length;
    expect(
      (
        await new Browser().call(routes.audio.GET, `/api/speech/${PLACE}`, {
          params: { place: PLACE },
        })
      ).status,
    ).toBe(401);
    const notReady = await signIn();
    const refused = await audio(notReady, PLACE);
    expect(refused.status).toBe(403);
    expect(voice.spoken.length).toBe(before);
  });

  it('takes a place id and nothing else: no text, no other parameter, no body', async () => {
    const before = voice.spoken.length;
    const learner = await ready();
    const { browser, call } = learner;
    // Text of its own, in the query: refused, and nothing is spoken.
    const withText = await browser.call(routes.audio.GET, `/api/speech/${PLACE}?text=My%20marks`, {
      ...call,
      params: { place: PLACE },
    });
    expect(withText.status).toBe(400);
    // Words where the id goes: not an id, so not found.
    for (const place of ['My name is Test', 'wits test', '../me', 'WITS-TEST', '']) {
      expect((await audio(learner, place)).status, place).toBe(404);
    }
    // An id that names no place the learner may see.
    expect((await audio(learner, 'wits-nowhere-at-all')).status).toBe(404);
    expect(voice.spoken.length).toBe(before);
    // There is no way to post text: the route answers GET only.
    expect(Object.keys(routes.audio).filter((k) => /^[A-Z]+$/.test(k))).toEqual(['GET']);
    expect(Object.keys(routes.status).filter((k) => /^[A-Z]+$/.test(k))).toEqual(['GET']);
  });

  it(`allows ${QUOTAS.speech.max} an hour per learner, then refuses (429)`, async () => {
    const learner = await ready();
    for (let i = 0; i < QUOTAS.speech.max; i++) {
      const response = await audio(learner, PLACE);
      expect(response.status, `request ${i + 1}`).toBe(200);
      await response.arrayBuffer();
    }
    expect((await audio(learner, PLACE)).status).toBe(429);
    // Another learner is unaffected.
    expect((await audio(await ready(), PLACE)).status).toBe(200);
  });
});

describe('without an ElevenLabs key: no Read aloud at all', () => {
  beforeAll(() => {
    (globalThis as Global).__ufServices = withoutVoice;
  });
  afterAll(() => {
    (globalThis as Global).__ufServices = withVoice;
  });

  it('says it isn’t offered, and has no audio to give', async () => {
    const learner = await ready();
    expect(await status(learner)).toEqual({ status: 200, body: { available: false } });
    expect((await audio(learner, PLACE)).status).toBe(404);
  });
});
