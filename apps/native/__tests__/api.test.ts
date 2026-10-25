import { en } from '@universityflow/content/app';
import { fetch } from 'expo/fetch';
import { ApiError, api, errorMessage, streamChat } from '../lib/api';
import { ConfigError, DEV_API_URL } from '../lib/config';
import { onSessionChange, readToken, saveToken } from '../lib/session';
import type { ChatEvent } from '../lib/types';
import { ndjson, serve } from '../test-utils/fake-api';

describe('the API client', () => {
  it('says it is the app, sends no cookies, and adds the bearer token when signed in', async () => {
    await saveToken('tok-1');
    const calls = serve({ 'GET /api/me': { json: { ready: true } } });
    expect(await api('/api/me')).toEqual({ ready: true });
    expect(calls[0]?.url).toBe(`${DEV_API_URL}/api/me`);
    expect(calls[0]?.headers).toMatchObject({
      'x-uf-client': 'native',
      authorization: 'Bearer tok-1',
      accept: 'application/json',
    });
    expect(calls[0]?.credentials).toBe('omit');
  });

  it('sends no Authorization header before sign-in, and JSON with its content type', async () => {
    const calls = serve({
      'POST /api/auth/request-pin': { json: { phoneMasked: '082 *** 0001' } },
    });
    const phone = ['082', '000', '0001'].join(''); // synthetic, built at runtime (hard rule 4)
    await api('/api/auth/request-pin', { json: { phone } });
    expect(calls[0]?.headers['authorization']).toBeUndefined();
    expect(calls[0]?.headers['content-type']).toBe('application/json');
    expect(calls[0]?.body).toEqual({ phone });
  });

  it.each([
    ['pin', 400, en.auth.errors.pin],
    ['phone', 400, en.auth.errors.phone],
    ['expired', 400, en.auth.errors.expired],
    ['rate-limited', 429, en.auth.errors.rateLimited],
    // A5-09 (A1-37): a number locked by wrong PINs is told so, not "wait a few minutes".
    ['pin-locked', 429, en.auth.errors.pinLocked],
    ['consent', 403, en.errors.consent],
    ['consent-outdated', 403, en.errors.consentOutdated],
    ['sms-unavailable', 503, en.errors.smsUnavailable],
    ['guardian-opted-out', 409, en.errors.guardianOptedOut],
    ['not-found', 404, en.errors.notFound],
    ['server', 500, en.errors.generic],
    ['something-new', 418, en.errors.generic],
  ])('turns {error: %s} into the content string', async (code, status, sentence) => {
    serve({ 'GET /x': { status, json: { error: code, detail: null } } });
    const error = await api('/x').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe(code);
    expect(errorMessage(error)).toBe(sentence);
  });

  it('explains a consent that does not cover offer letters and proofs (A11-13)', async () => {
    serve({
      'GET /x': {
        status: 403,
        json: { error: 'consent-outdated', detail: 'university-documents' },
      },
    });
    const error = await api('/x').catch((e: unknown) => e);
    expect(errorMessage(error)).toBe(en.errors.consentOutdatedDocuments);
  });

  it('explains an ID or student number refused in a condition or module (A11-17)', async () => {
    serve({ 'GET /x': { status: 409, json: { error: 'state', detail: 'personal-number' } } });
    const error = await api('/x').catch((e: unknown) => e);
    expect(errorMessage(error)).toBe(en.offers.errors['personal-number']);
  });

  it('explains a date of birth under 13 (A11-24)', async () => {
    serve({ 'GET /x': { status: 409, json: { error: 'state', detail: 'too-young' } } });
    const error = await api('/x').catch((e: unknown) => e);
    expect(errorMessage(error)).toBe(en.errors.tooYoung);
  });

  it('explains a report from a grade above the learner’s (A1-35)', async () => {
    serve({ 'GET /x': { status: 409, json: { error: 'state', detail: 'report-above-grade' } } });
    const error = await api('/x').catch((e: unknown) => e);
    expect(errorMessage(error)).toBe(en.errors.reportAboveGrade);
  });

  it('treats an error without a JSON body as a server error', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 502,
      json: async () => {
        throw new SyntaxError('html');
      },
    });
    const error = await api('/x').catch((e: unknown) => e);
    expect((error as ApiError).code).toBe('server');
  });

  it('says "offline" when the request never reaches the server', async () => {
    (fetch as jest.Mock).mockRejectedValueOnce(new TypeError('Network request failed'));
    const error = await api('/x').catch((e: unknown) => e);
    expect(errorMessage(error)).toBe(en.errors.offline);
  });

  describe('in a release build with no API URL (A7-05)', () => {
    const dev = __DEV__;
    const url = process.env['EXPO_PUBLIC_UF_API_URL'];
    const runtime = globalThis as unknown as { __DEV__: boolean };
    beforeEach(() => {
      runtime.__DEV__ = false;
      delete process.env['EXPO_PUBLIC_UF_API_URL'];
    });
    afterEach(() => {
      runtime.__DEV__ = dev;
      if (url !== undefined) process.env['EXPO_PUBLIC_UF_API_URL'] = url;
    });

    it('fails as a configuration error, never as "you’re offline", and sends nothing', async () => {
      const calls = serve({ 'GET /api/me': { json: { ready: true } } });
      const error = await api('/api/me').catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ConfigError);
      expect(errorMessage(error)).not.toBe(en.errors.offline);
      expect(errorMessage(error)).toBe(en.errors.appConfig);
      expect(calls).toHaveLength(0);
    });

    it('streamChat fails the same way', async () => {
      const error = await streamChat('hi', () => undefined).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ConfigError);
      expect(errorMessage(error)).toBe(en.errors.appConfig);
    });
  });

  it('on a 401 forgets the token and signs the app out', async () => {
    await saveToken('revoked');
    const seen: boolean[] = [];
    const off = onSessionChange((signedIn) => seen.push(signedIn));
    serve({ 'GET /api/me': { status: 401, json: { error: 'signed-out', detail: null } } });
    const error = await api('/api/me').catch((e: unknown) => e);
    off();
    expect(errorMessage(error)).toBe(en.errors.signedOut);
    expect(await readToken()).toBeNull();
    expect(seen).toEqual([false]);
  });

  it('keeps the token on any other error', async () => {
    await saveToken('fine');
    serve({ 'GET /api/results': { status: 403, json: { error: 'consent', detail: null } } });
    await api('/api/results').catch(() => undefined);
    expect(await readToken()).toBe('fine');
  });

  it('never puts the token in an error', async () => {
    await saveToken('tok-secret');
    serve({ 'GET /x': { status: 500, json: { error: 'server' } } });
    const error = (await api('/x').catch((e: unknown) => e)) as ApiError;
    expect(JSON.stringify({ ...error, message: error.message })).not.toContain('tok-secret');
  });
});

describe('streamChat', () => {
  it('posts the message and delivers each event as its line completes', async () => {
    await saveToken('tok');
    const body = ndjson(
      { type: 'text', delta: 'Hel' },
      { type: 'text', delta: 'lo' },
      { type: 'done', crisis: false },
    );
    const calls = serve({
      'POST /api/chat': { chunks: [body.slice(0, 7), body.slice(7, 40), body.slice(40)] },
    });
    const events: ChatEvent[] = [];
    await streamChat('hi', (e) => events.push(e));
    expect(calls[0]?.body).toEqual({ message: 'hi' });
    expect(calls[0]?.headers['authorization']).toBe('Bearer tok');
    expect(events).toEqual([
      { type: 'text', delta: 'Hel' },
      { type: 'text', delta: 'lo' },
      { type: 'done', crisis: false },
    ]);
  });

  it('passes on an error event', async () => {
    serve({ 'POST /api/chat': { chunks: [ndjson({ type: 'error' })] } });
    const events: ChatEvent[] = [];
    await streamChat('hi', (e) => events.push(e));
    expect(events).toEqual([{ type: 'error' }]);
  });

  it('throws the mapped error when the server refuses the message', async () => {
    serve({ 'POST /api/chat': { status: 429, json: { error: 'rate-limited' } } });
    const error = await streamChat('hi', () => undefined).catch((e: unknown) => e);
    expect(errorMessage(error)).toBe(en.auth.errors.rateLimited);
  });
});
