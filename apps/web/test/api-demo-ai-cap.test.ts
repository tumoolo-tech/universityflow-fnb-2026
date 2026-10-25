import { en } from '@universityflow/content';
import type { Store } from '@universityflow/db';
import { describe, expect, it, vi } from 'vitest';
import { Browser } from './harness';

/**
 * Judge demo mode's optional daily AI cap (UF_DEMO_AI_DAILY_CAP, owner's change of 2026-10-23: off
 * unless set). Over it, a kind line and then the scripted stand-in; the crisis check and care stay
 * on, and a crisis message is never held back by the cap or counted against it.
 */

process.env['UF_DEPLOYMENT'] = 'demo';
process.env['UF_DEMO_PROJECT'] = '1';
process.env['AUTH_SECRET'] = 'demo-test-secret-that-is-long-enough-0123456789';
process.env['UF_DEMO_AI_DAILY_CAP'] = '2';

vi.mock('next/headers', async () => (await import('./harness')).nextHeaders);

let n = 7_300_000;
const phone = () => `+2782${String(n++).padStart(7, '0')}`;

vi.mock('../lib/server/demo/personas', async () => {
  const { en: content } = await import('@universityflow/content');
  const { DEMO_PERSONA_IDS } = await import('../lib/server/demo/types');
  return {
    DEMO_PERSONAS: DEMO_PERSONA_IDS.map((id) => ({ id, ...content.demoPersonas.personas[id] })),
    cloneDemoPersona: async (store: Store) => {
      const number = phone();
      const challenge = await store.requestOtp(number);
      if (challenge.review) throw new Error('unexpected');
      const { studentId } = await store.verifyOtp(number, challenge.code);
      await store.setDateOfBirth(studentId, '2006-03-14');
      await store.consentAsAdult(studentId, content.adultConsent.version);
      return studentId;
    },
  };
});

const routes = {
  start: (await import('../app/api/demo/start/route')).POST,
  chat: (await import('../app/api/chat/route')).POST,
  history: (await import('../app/api/chat/route')).GET,
};

let ip = 1;
async function judge() {
  const browser = new Browser();
  const started = await browser.call(routes.start, '/api/demo/start', {
    json: { persona: 'demo-grade-11' },
    headers: { 'x-forwarded-for': `192.0.2.${ip++}` },
  });
  expect(started.status).toBe(200);
  return browser;
}

/** The reply's text, from the streamed events. */
async function say(browser: Browser, message: string) {
  const response = await browser.call(routes.chat, '/api/chat', { json: { message } });
  expect(response.status).toBe(200);
  const events = (await response.text())
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line) as { type: string; delta?: string; crisis?: boolean });
  return {
    text: events.flatMap((e) => (e.type === 'text' ? [e.delta ?? ''] : [])).join(''),
    crisis: events.find((e) => e.type === 'done')?.crisis ?? false,
  };
}

describe('the demo’s daily AI cap (UF_DEMO_AI_DAILY_CAP=2)', () => {
  it('within the cap, no kind line; over it, the kind line first, then the stand-in', async () => {
    const browser = await judge();
    expect((await say(browser, 'What can I study?')).text).not.toContain(en.demo.aiCapLine);
    expect((await say(browser, 'And with maths?')).text).not.toContain(en.demo.aiCapLine);
    const over = await say(browser, 'What about funding?');
    expect(over.text.startsWith(en.demo.aiCapLine)).toBe(true);
    expect(over.text.length).toBeGreaterThan(en.demo.aiCapLine.length + 5);
    // The cap is across the whole demo: another judge is over it too.
    const other = await judge();
    expect((await say(other, 'Hello')).text.startsWith(en.demo.aiCapLine)).toBe(true);
    // And the stored reply carries the line, so the history reads the same.
    const { body } = await browser.json<{ messages: Array<{ role: string; content: string }> }>(
      routes.history,
      '/api/chat',
    );
    expect(body.messages.at(-1)?.content.startsWith(en.demo.aiCapLine)).toBe(true);
  });

  it('a crisis message gets the crisis reply, never the kind line, even over the cap', async () => {
    const browser = await judge();
    const reply = await say(browser, 'I want to kill myself');
    expect(reply.crisis).toBe(true);
    expect(reply.text).not.toContain(en.demo.aiCapLine);
  });
});
