import { campusSafetyLines } from '@universityflow/agent';
import { campusTestView, draftSafetyPlaceIds } from '@universityflow/agent/testing';
import { catalogueView } from '@universityflow/catalogue';
import { messageText } from '@universityflow/content';
import { describe, expect, it } from 'vitest';
import { CRISIS_SMS_MAX, crisisHelp, crisisReply } from '../lib/server/crisis-reply';

/**
 * The SMS and WhatsApp crisis reply's campus lines (Phase 5b, planning.md §4.3): after the
 * helplines, the sender's own campus security, clinic and counselling, verified only, each only
 * while the reply still fits three SMS. Synthetic campus records (packages/agent/testing).
 */

const helplines = catalogueView(new Date('2026-10-14T08:00:00Z'), {
  includeDrafts: true,
}).helplines;
const allow = { allow: async () => true };
const sender = `+2782${'0'.repeat(6)}3`;

describe('the crisis reply’s campus lines', () => {
  it('come after every helpline, with the number to call, and fit three SMS', () => {
    const campus = campusSafetyLines(campusTestView(true), 'wits');
    const without = crisisReply('i want to die', helplines) as string;
    const reply = crisisReply('i want to die', helplines, campus) as string;
    expect(reply.startsWith(without)).toBe(true);
    expect(reply.length).toBeLessThanOrEqual(CRISIS_SMS_MAX);
    const added = reply.slice(without.length).split('\n').filter(Boolean);
    expect(added.length).toBeGreaterThan(0);
    expect(added[0]).toBe(
      messageText.crisis.line('Test security security (Test Campus)', 'Call 011 000 0000'),
    );
  });

  it('never carry a draft, and nothing is added without them', () => {
    const preview = campusSafetyLines(campusTestView(true), 'wits');
    const reply = crisisReply('i want to die', helplines, preview) as string;
    for (const id of draftSafetyPlaceIds()) expect(reply).not.toContain(id);
    expect(reply).not.toMatch(/draft-clinic|Draft Campus/);
    expect(crisisReply('i want to die', helplines, undefined)).toBe(
      crisisReply('i want to die', helplines),
    );
  });

  it('are asked for only when help is needed, and a failure never stops the reply', async () => {
    let asked = 0;
    const campus = async () => {
      asked++;
      return campusSafetyLines(campusTestView(true), 'wits');
    };
    expect(
      await crisisHelp(
        { text: 'see you tomorrow', sender, channel: 'sms' },
        { helplines, limiter: allow, campus },
      ),
    ).toBeNull();
    expect(asked).toBe(0);
    const reply = await crisisHelp(
      { text: 'i want to die', sender, channel: 'sms' },
      { helplines, limiter: allow, campus },
    );
    expect(asked).toBe(1);
    expect(reply).toContain('Test Campus');
    const broken = await crisisHelp(
      { text: 'i want to die', sender, channel: 'sms' },
      { helplines, limiter: allow, campus: () => Promise.reject(new Error('down')) },
    );
    expect(broken).toBe(crisisReply('i want to die', helplines));
  });
});
