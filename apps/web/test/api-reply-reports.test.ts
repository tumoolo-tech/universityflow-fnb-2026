import { afterEach, describe, expect, it, vi } from 'vitest';
import { agreeAsAdult } from './adult-consent';
import { Browser } from './harness';
import { expectNoPhoneNumber, withoutIds } from './no-phone';

vi.mock('next/headers', async () => (await import('./harness')).nextHeaders);

/**
 * A10-35: "Report this reply". The chat's last event names the stored reply, so a reply that has
 * just streamed in can be reported; the history says which replies are reported; a report is ids
 * and a fixed reason, and a person is told (the stand-in logs ids only, hard rule 4).
 */

const routes = {
  requestPin: (await import('../app/api/auth/request-pin/route')).POST,
  verifyPin: (await import('../app/api/auth/verify-pin/route')).POST,
  dob: (await import('../app/api/me/date-of-birth/route')).POST,
  chat: await import('../app/api/chat/route'),
  report: (await import('../app/api/chat/messages/[id]/report/route')).POST,
  outbox: (await import('../app/api/dev/outbox/route')).GET,
};

let n = 4_100_000;
const phone = () => `082${String(n++).padStart(7, '0')}`;

afterEach(() => {
  vi.restoreAllMocks();
});

async function adult() {
  const browser = new Browser();
  const number = phone();
  await browser.json(routes.requestPin, '/api/auth/request-pin', { json: { phone: number } });
  const { body } = await browser.json<{ messages: Array<{ to: string; body: string }> }>(
    routes.outbox,
    '/api/dev/outbox',
  );
  const pin = body.messages.find((m) => m.to === `+27${number.slice(1)}`)?.body.match(/\d{6}/)?.[0];
  await browser.json(routes.verifyPin, '/api/auth/verify-pin', { json: { phone: number, pin } });
  await browser.json(routes.dob, '/api/me/date-of-birth', { json: { dateOfBirth: '2000-02-02' } });
  await agreeAsAdult(browser);
  return browser;
}

/** One chat turn; returns the stored reply's id from the last event. */
async function reply(browser: Browser, message = 'What should I study?'): Promise<string> {
  const response = await browser.call(routes.chat.POST, '/api/chat', {
    json: { message },
  });
  const events = (await response.text())
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line) as { type: string; messageId?: string });
  const done = events.at(-1);
  expect(done?.type).toBe('done');
  expect(done?.messageId).toMatch(/^[0-9a-f-]{36}$/);
  return done?.messageId as string;
}

const report = (browser: Browser, id: string, reason: unknown) =>
  browser.json(routes.report, `/api/chat/messages/${id}/report`, {
    json: { reason },
    params: { id },
  });

describe('report this reply (A10-35)', () => {
  it('reports a reply once, tells a person by id only, and the history marks it', async () => {
    const browser = await adult();
    const id = await reply(browser);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    expect(await report(browser, id, 'harmful')).toMatchObject({
      status: 200,
      body: { status: 'reported' },
    });
    const lines = warn.mock.calls
      .map((c) => String(c[0]))
      .filter((l) => l.startsWith('reply-report'));
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain(id);
    expect(lines[0]).toContain('harmful');
    expect(withoutIds(lines[0] ?? '')).not.toMatch(/study/i);
    expectNoPhoneNumber(lines[0] ?? '');

    expect(await report(browser, id, 'wrong')).toMatchObject({
      status: 200,
      body: { status: 'already-reported' },
    });
    const { body } = await browser.json<{
      messages: Array<{ id: string; role: string; reported: boolean }>;
    }>(routes.chat.GET, '/api/chat');
    expect(body.messages.find((m) => m.id === id)?.reported).toBe(true);
    expect(body.messages.filter((m) => m.role === 'student').every((m) => !m.reported)).toBe(true);
  });

  it('refuses an unknown reason, the learner’s own message and another learner’s reply', async () => {
    const browser = await adult();
    const id = await reply(browser);
    expect((await report(browser, id, 'rude')).status).toBe(400);
    const { body } = await browser.json<{ messages: Array<{ id: string; role: string }> }>(
      routes.chat.GET,
      '/api/chat',
    );
    const own = body.messages.find((m) => m.role === 'student')?.id as string;
    expect(await report(browser, own, 'harmful')).toMatchObject({
      status: 409,
      body: { error: 'state' },
    });
    const other = await adult();
    expect((await report(other, id, 'harmful')).status).toBe(404);
  });

  it('A10-49: tells the person which provider and model wrote the reported reply', async () => {
    const browser = await adult();
    const id = await reply(browser);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await report(browser, id, 'wrong');
    const [line] = warn.mock.calls
      .map((c) => String(c[0]))
      .filter((l) => l.startsWith('reply-report'));
    // No key in the tests: the scripted stand-in answered.
    expect(line).toContain('written by local sample-chat-model');
  });

  it('A10-49: a crisis reply, which no model wrote, is reported as the system’s', async () => {
    const browser = await adult();
    const id = await reply(browser, 'I want to kill myself');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await report(browser, id, 'other');
    const [line] = warn.mock.calls
      .map((c) => String(c[0]))
      .filter((l) => l.startsWith('reply-report'));
    expect(line).toContain('written by the system (no model)');
    expect(withoutIds(line ?? '')).not.toMatch(/kill/i);
  });

  it('allows 20 reports a day, then refuses', async () => {
    const browser = await adult();
    const missing = (i: number) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`;
    for (let i = 0; i < 20; i++)
      expect((await report(browser, missing(i), 'other')).status).toBe(404);
    expect((await report(browser, missing(20), 'other')).status).toBe(429);
  });
});
