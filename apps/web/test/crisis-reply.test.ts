import { catalogueView } from '@universityflow/catalogue';
import { en, messageText } from '@universityflow/content';
import { isGsm7, replyForChannel, smsSegments } from '@universityflow/messaging';
import { describe, expect, it, vi } from 'vitest';
import {
  CRISIS_FULL_REPLIES,
  CRISIS_SMS_MAX,
  crisisHelp,
  crisisReply,
} from '../lib/server/crisis-reply';
import { expectNoPhoneNumber } from './no-phone';

/** The reply with three helplines, and with none verified, in GSM-7 segments on SMS. */
const FULL_CRISIS_SMS_SEGMENTS = 2;
const FALLBACK_CRISIS_SMS_SEGMENTS = 2;

/**
 * The WhatsApp/SMS crisis reply (audit A10-05). No helpline is verified yet, so the route's own
 * test sees the fallback; here the drafts stand in for verified records to prove the numbers
 * arrive, most relevant first, with an emergency number, inside three SMS.
 */

const helplines = catalogueView(new Date('2026-10-14T08:00:00Z'), {
  includeDrafts: true,
}).helplines;

describe('crisisReply', () => {
  it('a crisis gets the reviewed words, a suicide line first and an emergency number', () => {
    const reply = crisisReply('i want to die', helplines) as string;
    expect(reply.startsWith(messageText.crisis.reply)).toBe(true);
    const lines = reply.split('\n').slice(1);
    expect(lines.length).toBeGreaterThanOrEqual(2);
    expect(lines[0]).toMatch(/0800/);
    expect(lines.at(-1)).toMatch(/\b(?:10111|10177|112)\b/);
    expect(reply.length).toBeLessThanOrEqual(CRISIS_SMS_MAX);
    expect(reply).not.toContain(en.crisis.noVerifiedNumbers);
  });

  it('abuse puts an abuse line first; concern gets the gentler words', () => {
    const abuse = crisisReply('my uncle hits me', helplines) as string;
    expect(abuse.split('\n')[1]).toMatch(/Childline|Higher Health/);
    const concern = crisisReply('I feel so hopeless', helplines) as string;
    expect(concern.startsWith(messageText.crisis.concernReply)).toBe(true);
  });

  it('with no verified numbers, says what to do instead, and mentions no line (A10-11)', () => {
    const reply = crisisReply('i want to die', []) as string;
    expect(reply).toBe(`${messageText.crisis.replyNoLines} ${en.crisis.noVerifiedNumbers}`);
    expect(reply).not.toMatch(/these lines/i);
    expect(crisisReply('I feel so hopeless', [])).toBe(
      `${messageText.crisis.concernReplyNoLines} ${en.crisis.noVerifiedNumbers}`,
    );
  });

  it('with only emergency numbers, lists them without calling them free lines (A10-11)', () => {
    const emergency = helplines.filter((h) => h.topics.includes('emergency'));
    const reply = crisisReply('i want to die', emergency) as string;
    expect(reply.startsWith(`${messageText.crisis.replyNoLines}\n`)).toBe(true);
    expect(reply).toMatch(/\b(?:10111|10177|112)\b/);
  });

  it('A1-14: on SMS the full reply is GSM-7, its words unchanged, in at most three segments', () => {
    const full = crisisReply('i want to die', helplines) as string;
    const onSms = replyForChannel('sms', full);
    expect(full.split('\n').length - 1).toBe(3); // three helplines
    expect(isGsm7(onSms)).toBe(true);
    expect(smsSegments(onSms)).toBe(FULL_CRISIS_SMS_SEGMENTS);
    expect(onSms.replace(/'/g, '’')).toBe(full.replace(/'/g, '’'));
    const fallback = replyForChannel('sms', crisisReply('i want to die', []) as string);
    expect(isGsm7(fallback)).toBe(true);
    expect(smsSegments(fallback)).toBe(FALLBACK_CRISIS_SMS_SEGMENTS);
    // WhatsApp carries the typography as written.
    expect(replyForChannel('whatsapp', full)).toBe(full);
  });

  it('an ordinary message gets nothing', () => {
    expect(crisisReply('Thanks, see you tomorrow', helplines)).toBeNull();
  });
});

/** A per-sender limiter with the store's semantics: counted only when allowed. */
function memoryLimiter() {
  const events = new Map<string, number[]>();
  return {
    async allow(action: string, key: string, max: number, windowMs: number) {
      const id = `${action}:${key}`;
      const now = Date.now();
      const recent = (events.get(id) ?? []).filter((t) => t > now - windowMs);
      if (recent.length >= max) return false;
      events.set(id, [...recent, now]);
      return true;
    },
  };
}

describe('crisisHelp: bounded cost, never silent (audit A10-15)', () => {
  // Synthetic numbers, built at runtime (hard rule 4).
  const sender = `+2782${'0'.repeat(6)}1`;
  const other = `+2782${'0'.repeat(6)}2`;

  it('20 crisis messages in an hour: every one answered, the first full, the rest one SMS', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    try {
      const limiter = memoryLimiter();
      const replies: Array<string | null> = [];
      for (let i = 0; i < 20; i++) {
        replies.push(
          await crisisHelp(
            { text: `secret ${i} i want to die`, sender, channel: 'sms' },
            { helplines, limiter },
          ),
        );
      }
      expect(replies.every((r) => typeof r === 'string' && r.length > 0)).toBe(true);
      const full = crisisReply('i want to die', helplines);
      const n = CRISIS_FULL_REPLIES.max;
      expect(replies.slice(0, n)).toEqual(Array(n).fill(full));
      for (const reply of replies.slice(n) as string[]) {
        expect(smsSegments(reply)).toBe(1);
        expect(reply).not.toBe(full);
        // Still help: a verified number (here the drafts stand in for verified records).
        expect(reply).toMatch(/0800/);
      }
      // One alert for this sender in this window, ids and counts only: no words, no number.
      const alerts = warn.mock.calls.filter((c) => String(c[0]).startsWith('crisis-reply'));
      expect(alerts).toHaveLength(1);
      const logged = JSON.stringify([...warn.mock.calls, ...log.mock.calls]);
      expect(logged).not.toContain('secret');
      expect(logged).not.toContain('die');
      expectNoPhoneNumber(logged);

      // A different sender is unaffected.
      expect(
        await crisisHelp(
          { text: 'i want to die', sender: other, channel: 'sms' },
          { helplines, limiter },
        ),
      ).toBe(full);
    } finally {
      warn.mockRestore();
      log.mockRestore();
    }
  });

  it('with no verified numbers, the short reply is the reviewed fallback, in one SMS', async () => {
    const limiter = memoryLimiter();
    const replies: string[] = [];
    for (let i = 0; i < CRISIS_FULL_REPLIES.max + 2; i++) {
      replies.push(
        (await crisisHelp(
          { text: 'i want to die', sender, channel: 'sms' },
          { helplines: [], limiter },
        )) as string,
      );
    }
    const short = replies.at(-1) as string;
    expect(short).toContain(en.crisis.noVerifiedNumbers);
    expect(short.startsWith(messageText.crisis.short.reply)).toBe(true);
    expect(smsSegments(short)).toBe(1);
  });

  it('concern gets the gentler short words; an ordinary message gets nothing and costs nothing', async () => {
    const limiter = memoryLimiter();
    const allow = vi.spyOn(limiter, 'allow');
    expect(
      await crisisHelp(
        { text: 'Thanks, see you tomorrow', sender, channel: 'sms' },
        { helplines, limiter },
      ),
    ).toBeNull();
    expect(allow).not.toHaveBeenCalled();
    let last: string | null = null;
    for (let i = 0; i <= CRISIS_FULL_REPLIES.max; i++) {
      last = await crisisHelp(
        { text: 'I feel so hopeless', sender, channel: 'sms' },
        { helplines, limiter },
      );
    }
    expect(last?.startsWith(messageText.crisis.short.concernReply)).toBe(true);
    expect(smsSegments(last as string)).toBe(1);
  });
});
