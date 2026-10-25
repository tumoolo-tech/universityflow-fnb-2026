import { describe, expect, it } from 'vitest';
import { en } from './en';
import {
  APP_SCREENS,
  InvalidTemplateError,
  isMessageTemplateId,
  isWhatsAppCategory,
  MESSAGE_CHANNELS,
  MESSAGE_TEMPLATE_IDS,
  MESSAGE_TEMPLATES,
  type MessageTemplate,
  type MessageTemplateId,
  messageText,
  renderMessage,
  TEMPLATE_VARIABLE_MAX_LENGTH,
  TEMPLATE_VARIABLES,
  type TemplateVariables,
  WHATSAPP_CATEGORIES,
  type WhatsAppCategory,
} from './messages';

const templates = Object.values(MESSAGE_TEMPLATES) as MessageTemplate[];

/** Every variable at its longest. */
function longest(template: MessageTemplate): Record<string, string> {
  return Object.fromEntries(
    template.variables.map((v) => [v, 'x'.repeat(TEMPLATE_VARIABLE_MAX_LENGTH[v])]),
  );
}

describe('message templates', () => {
  it('are keyed by their own id', () => {
    for (const [key, template] of Object.entries(MESSAGE_TEMPLATES)) expect(template.id).toBe(key);
    expect(MESSAGE_TEMPLATE_IDS.length).toBe(templates.length);
  });

  it('are fixed text: no placeholder in any body, and only allowed variables (A11-02)', () => {
    const allowed = new Set<string>(TEMPLATE_VARIABLES);
    for (const t of templates) {
      expect(t.body, t.id).not.toMatch(/[{}]/);
      for (const v of t.variables) expect(allowed.has(v), `${t.id}: ${v}`).toBe(true);
    }
  });

  it('take no personal data at all, only the catalogue entry a reminder is about (hard rule 4)', () => {
    expect(TEMPLATE_VARIABLES).toEqual(['universityName', 'subjectName']);
  });

  it('hold no admission facts: no digits, amounts, dates or scores (hard rule 2)', () => {
    for (const t of templates) {
      expect(t.body, t.id).not.toMatch(/\d/);
      expect(t.body, t.id).not.toMatch(/\bR\s?\d|\bAPS\b|points|closes? on|deadline is|fee/i);
      expect(t.body, t.id).not.toMatch(
        /\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/i,
      );
      expect(t.body, t.id).not.toMatch(/guarantee|you will (get in|be accepted)/i);
    }
  });

  it('are honest WhatsApp utility messages that every listed channel accepts', () => {
    for (const t of templates) {
      expect(t.whatsappCategory, t.id).toBe('utility');
      expect(t.channels.length, t.id).toBeGreaterThan(0);
      for (const c of t.channels) expect(MESSAGE_CHANNELS).toContain(c);
    }
  });

  it('fit one push notification and three SMS segments, with every variable at its longest', () => {
    for (const t of templates) {
      for (const channel of MESSAGE_CHANNELS) {
        const text = renderMessage(t.id as MessageTemplateId, longest(t), channel);
        expect(text.length, `${t.id} on ${channel}`).toBeLessThanOrEqual(240);
      }
    }
  });
});

describe('renderMessage', () => {
  it('checks the variables and sends the fixed text', () => {
    expect(renderMessage('reminder.study', { subjectName: 'Mathematics' })).toBe(
      'UniversityFlow: this is the study reminder you asked for. Time for a little practice today. You’ve got this.',
    );
  });

  it('refuses an unknown template, an undeclared variable, a missing one, or an unsafe value', () => {
    expect(() => renderMessage('nope' as MessageTemplateId, {})).toThrow(InvalidTemplateError);
    expect(() => renderMessage('reminder.check-in', { subjectName: 'Maths' })).toThrow(
      /no variable subjectName/,
    );
    expect(() => renderMessage('reminder.study', {})).toThrow(/needs subjectName/);
    expect(() => renderMessage('reminder.study', { subjectName: '  ' })).toThrow(/needs/);
    expect(() => renderMessage('reminder.study', { subjectName: 'x'.repeat(61) })).toThrow(
      InvalidTemplateError,
    );
    expect(() => renderMessage('reminder.study', { subjectName: 'a\nb' })).toThrow(
      InvalidTemplateError,
    );
    expect(() => renderMessage('reminder.study', { subjectName: '{x}' })).toThrow(
      InvalidTemplateError,
    );
  });

  it("never repeats a refused value in its error (it could be someone's data)", () => {
    let message = '';
    try {
      renderMessage('reminder.study', { subjectName: `Secret${'x'.repeat(60)}` });
    } catch (error) {
      message = String(error);
    }
    expect(message).toMatch(/InvalidTemplateError/);
    expect(message).not.toContain('Secret');
  });

  it('knows its own ids', () => {
    expect(isMessageTemplateId('reminder.check-in')).toBe(true);
    expect(isMessageTemplateId('toString')).toBe(false);
    expect(isMessageTemplateId(3)).toBe(false);
  });

  it('recheck.changed only says there is an update: no course, university, subject or result', () => {
    const t = MESSAGE_TEMPLATES['recheck.changed'];
    expect(t.variables).toEqual([]);
    expect(t.learnerSchedulable).toBe(false);
    expect(t.body).not.toMatch(/qualif|close|plan b|degree|diploma|level|mark|%|\d/i);
    expect(renderMessage('recheck.changed', {})).toMatch(/^UniversityFlow: we checked/);
  });

  it('offer.reply-by says only that an added place needs an answer: no kind, date or name (5a)', () => {
    const t = MESSAGE_TEMPLATES['offer.reply-by'];
    expect(t.learnerSchedulable).toBe(false);
    expect(t.opens).toBe('offers');
    for (const text of [t.body, t.pushBody]) {
      // Never "you're in", never which kind of offer, never a date or the university (A11-02).
      expect(text).not.toMatch(/you[’']re in|accepted|provisional|conditional|final|waitlist/i);
      expect(text).not.toMatch(/\d|offer/i);
    }
    expect(renderMessage('offer.reply-by', { universityName: 'University of Johannesburg' })).toBe(
      t.body,
    );
  });

  it('registration.change-deadline says only that the registration needs a change: no module, course or date (5c)', () => {
    const t = MESSAGE_TEMPLATES['registration.change-deadline'];
    expect(t.learnerSchedulable).toBe(false);
    expect(t.opens).toBe('modules');
    expect(t.whatsappCategory).toBe('utility');
    for (const text of [t.body, t.pushBody]) {
      // No module code, course, university, date or number of anything (A11-02, hard rule 2).
      expect(text).not.toMatch(/\d|module|course|curriculum|semester|faculty|credit/i);
    }
    expect(
      renderMessage('registration.change-deadline', { universityName: 'University of Pretoria' }),
    ).toBe(t.body);
  });

  it('offer.registration-day says only that it is nearly time to register: no university, course, date or offer (5d, A1-33)', () => {
    const t = MESSAGE_TEMPLATES['offer.registration-day'];
    expect(t.learnerSchedulable).toBe(false);
    // The first-week checklist is where the registration dates are.
    expect(t.opens).toBe('first-week');
    expect(t.whatsappCategory).toBe('utility');
    // Every channel, like the reply-by reminder (owner's decision, 2026-10-17).
    expect([...t.channels]).toEqual(['sms', 'whatsapp', 'push']);
    expect(t.smsSegments).toBe(1);
    for (const text of [t.body, t.pushBody]) {
      // Never which university or course, never a date, never the kind of offer (A11-02, rule 2).
      expect(text).not.toMatch(/\d|offer|accepted|provisional|conditional|final|waitlist/i);
      expect(text).not.toMatch(/course|programme|faculty|campus|opens on|closes on/i);
      expect(text).toMatch(/regist/i);
    }
    // One SMS segment, plain GSM-7 (no curly apostrophe), "Reply STOP to stop." included.
    const sms = renderMessage('offer.registration-day', { universityName: 'x'.repeat(80) }, 'sms');
    expect(sms).toMatch(/^[A-Za-z .,:'-]+$/);
    expect(sms.length).toBeLessThanOrEqual(160);
    expect(
      renderMessage('offer.registration-day', { universityName: 'University of Pretoria' }),
    ).toBe(t.body);
  });

  it('puts nothing personal on a lock screen: push sends the variable-free pushBody (Phase 4d)', () => {
    for (const t of templates) {
      // No placeholder, no digit, nothing the learner told us, no catalogue name.
      expect(t.pushBody, t.id).not.toMatch(/[{}\d]/);
      expect(t.pushBody.length, t.id).toBeLessThanOrEqual(160);
      // A quick check; the full list, derived from the catalogue, is
      // packages/messaging/src/lock-screen.test.ts (A11-09).
      expect(t.pushBody, t.id).not.toMatch(
        /\b(wits|uj|up|uct|tut|ukzn|university of|mathematics|physical sciences|hi )/i,
      );
      expect(APP_SCREENS, t.id).toContain(t.opens);
      const text = renderMessage(t.id as MessageTemplateId, longest(t), 'push');
      expect(text, t.id).toBe(t.pushBody);
      expect(text, t.id).not.toContain('xxxx');
    }
    expect(renderMessage('reminder.study', { subjectName: 'Mathematics' }, 'push')).not.toMatch(
      /Mathematics/,
    );
    expect(messageText.pushTitle).toBe('UniversityFlow');
  });

  it('checks the variables on push too, so a bad one is refused on every channel alike', () => {
    expect(() => renderMessage('reminder.study', {}, 'push')).toThrow(/needs subjectName/);
    expect(() => renderMessage('reminder.check-in', { subjectName: 'Maths' }, 'push')).toThrow(
      InvalidTemplateError,
    );
  });

  it('names every channel for the learner', () => {
    for (const c of MESSAGE_CHANNELS) expect(messageText.channelNames[c]).toMatch(/\S/);
  });
});

describe('SMS and WhatsApp carry nothing personal, like push (A11-02, A12-13)', () => {
  // What a lock-screen preview would show, and what the SMS provider and Meta would be handed.
  const personal: Record<string, string> = {
    firstName: 'Lebo',
    universityName: 'University of the Witwatersrand',
    subjectName: 'Physical Sciences',
  };

  it('no SMS or WhatsApp rendering holds a learner name, university or subject value', () => {
    for (const t of templates) {
      const real = Object.fromEntries(t.variables.map((v) => [v, personal[v] ?? v]));
      for (const channel of ['sms', 'whatsapp'] as const) {
        for (const variables of [real, longest(t)]) {
          const text = renderMessage(t.id as MessageTemplateId, variables, channel);
          for (const value of Object.values(variables)) {
            expect(text, `${t.id} on ${channel}`).not.toContain(value);
          }
          expect(text, `${t.id} on ${channel}`).not.toMatch(/^Hi |[{}]/);
        }
      }
    }
  });

  it("no template can take the learner's name", () => {
    expect(TEMPLATE_VARIABLES as readonly string[]).not.toContain('firstName');
    const named = { firstName: 'Lebo' } as unknown as TemplateVariables;
    for (const id of MESSAGE_TEMPLATE_IDS) {
      expect(() => renderMessage(id, named, 'sms'), id).toThrow(InvalidTemplateError);
    }
  });
});

describe('every SMS and WhatsApp message says how to stop (A12-10)', () => {
  it('every SMS rendering ends "Reply STOP to stop."', () => {
    for (const t of templates) {
      const text = renderMessage(t.id as MessageTemplateId, longest(t), 'sms');
      expect(text, t.id).toMatch(/ Reply STOP to stop\.$/);
      expect(text.match(/STOP/g), t.id).toHaveLength(1);
    }
    expect(messageText.smsStop).toBe('Reply STOP to stop.');
  });

  it('every WhatsApp template has a "Stop" quick-reply button, and no STOP line in its body', () => {
    for (const t of templates) {
      expect(t.whatsappQuickReplies, t.id).toEqual([messageText.whatsappStopButton]);
      expect(renderMessage(t.id as MessageTemplateId, longest(t), 'whatsapp'), t.id).toBe(t.body);
    }
    expect(messageText.whatsappStopButton).toBe('Stop');
  });

  it('push has no STOP line: it is turned off in the app or the phone', () => {
    for (const t of templates) expect(t.pushBody, t.id).not.toMatch(/stop/i);
  });
});

describe('every WhatsApp message is a utility message by its words (A12-09)', () => {
  // Meta files "unclear", generic or come-back-to-the-app wording as marketing (~12× the cost).
  // A utility template is the learner's own requested reminder or a specific event on their
  // account, and says which.
  const LEARNER_REQUEST = /\bthis is the [a-z -]*reminder you (asked for|set)\b/i;
  const ACCOUNT_EVENT = /\byou added\b/i;
  const GENERIC =
    /next step (is )?waiting|don[’']t miss|check (it )?out|new feature|come back|we miss you|exciting|offer/i;

  it('every WhatsApp body names a learner request or a specific account event', () => {
    for (const t of templates) {
      const text = renderMessage(t.id as MessageTemplateId, longest(t), 'whatsapp');
      expect(LEARNER_REQUEST.test(text) || ACCOUNT_EVENT.test(text), `${t.id}: ${text}`).toBe(true);
      // A reminder a learner sets says it is theirs.
      if (t.learnerSchedulable) expect(text, t.id).toMatch(LEARNER_REQUEST);
      expect(text, t.id).not.toMatch(GENERIC);
    }
  });

  it('a WhatsApp category can be utility or marketing, so a recategorisation can be recorded', () => {
    expect(WHATSAPP_CATEGORIES).toEqual(['utility', 'marketing']);
    const billed: WhatsAppCategory = 'marketing';
    expect(isWhatsAppCategory(billed)).toBe(true);
    expect(isWhatsAppCategory('authentication')).toBe(false);
    // What we ask Meta for stays utility.
    for (const t of templates) expect(t.whatsappCategory, t.id).toBe('utility');
  });
});

describe('the short crisis reply (audit A10-15)', () => {
  // Plain GSM-7 only: one curly apostrophe would send the whole text as UCS-2 (70 a segment).
  const PLAIN = /^[A-Za-z0-9 .,:!?'-]+$/;

  it('is plain GSM-7, and with the "no verified numbers" fallback fits one SMS segment', () => {
    for (const lead of [messageText.crisis.short.reply, messageText.crisis.short.concernReply]) {
      expect(lead).toMatch(PLAIN);
      expect(en.crisis.noVerifiedNumbers).toMatch(PLAIN);
      expect(`${lead} ${en.crisis.noVerifiedNumbers}`.length).toBeLessThanOrEqual(160);
    }
  });
});
