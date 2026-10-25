import { describe, expect, it } from 'vitest';
import { crisisSmsWords, crisisWords } from './crisis';
import { en } from './en';
import { messageText } from './messages';

/** Audit A10-11: the crisis words promise only what the lines shown can keep. */
describe('crisisWords', () => {
  const ROUND_THE_CLOCK = /day and night|any time|24/i;
  const LINES = /these lines/i;

  it('claims round-the-clock help only when every support line shown says 24 hours', () => {
    expect(crisisWords('all-day').reply).toBe(en.crisis.reply);
    expect(crisisWords('all-day').cardLead).toBe(en.crisis.cardLead);
    for (const cover of ['set-hours', 'none'] as const) {
      const words = crisisWords(cover);
      expect(words.reply, cover).not.toMatch(ROUND_THE_CLOCK);
      expect(words.concernReply, cover).not.toMatch(ROUND_THE_CLOCK);
      expect(words.cardLead ?? '', cover).not.toMatch(ROUND_THE_CLOCK);
    }
  });

  it('with no support line, mentions no line and has no card lead', () => {
    const words = crisisWords('none');
    expect(words.reply).toBe(en.crisis.replyNoLines);
    expect(words.reply).not.toMatch(LINES);
    expect(words.concernReply).not.toMatch(LINES);
    expect(words.cardLead).toBeNull();
    const sms = crisisSmsWords('none');
    expect(sms.reply).not.toMatch(LINES);
    expect(sms.concernReply).not.toMatch(LINES);
  });

  it('keeps the danger line in every crisis reply', () => {
    for (const cover of ['all-day', 'set-hours', 'none'] as const) {
      expect(crisisWords(cover).reply, cover).toMatch(/If you are in danger, call an emergency/);
    }
  });

  it('a card stored before A10-11 (no cover) promises no hours, and "these lines" only with lines', () => {
    expect(crisisWords(undefined, 0).reply).toBe(en.crisis.replyNoLines);
    expect(crisisWords(undefined, 0).cardLead).toBeNull();
    expect(crisisWords(undefined, 3).reply).toBe(en.crisis.replySetHours);
    expect(crisisWords(undefined, 3).cardLead).toBe(en.crisis.cardLeadSetHours);
  });

  it('on SMS, "these lines" only when lines follow', () => {
    expect(crisisSmsWords('all-day').reply).toBe(messageText.crisis.reply);
    expect(crisisSmsWords('set-hours').concernReply).toBe(messageText.crisis.concernReply);
  });
});
