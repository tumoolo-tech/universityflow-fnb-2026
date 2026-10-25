import { describe, expect, it } from 'vitest';
import { en } from './en';

function walk(value: unknown, path: string[] = []): Array<[string, unknown]> {
  if (typeof value === 'string' || typeof value === 'function') return [[path.join('.'), value]];
  if (Array.isArray(value)) return value.flatMap((v, i) => walk(v, [...path, String(i)]));
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([k, v]) => walk(v, [...path, k]));
  }
  return [];
}

describe('en', () => {
  it('names the product', () => {
    expect(en.app.name).toBe('UniversityFlow');
  });

  it('has no empty strings', () => {
    for (const [path, text] of walk(en)) {
      if (typeof text === 'string') expect(text.trim(), path).not.toBe('');
    }
  });

  it('formats every template without leaving a placeholder behind', () => {
    for (const [path, value] of walk(en)) {
      if (typeof value !== 'function') continue;
      const args = Array.from({ length: value.length }, (_, i) => (i === 0 ? 'X' : 1));
      const out = (value as (...a: unknown[]) => unknown)(...args);
      expect(typeof out, path).toBe('string');
      expect(out as string, path).not.toMatch(/undefined|\{|\}/);
    }
  });

  it('never promises admission (planning.md §8.5)', () => {
    for (const [path, text] of walk(en)) {
      if (typeof text !== 'string') continue;
      expect(text, path).not.toMatch(
        /guaranteed? (you )?(a place|admission|acceptance)|you will (get in|be accepted)/i,
      );
    }
  });

  it('starts at Grade 10 (G10-5): the front door, the wordmark, the tagline, the sidebar group', () => {
    expect(en.home.headline).toBe('From Grade 10 to graduation');
    expect(en.home.wordmark).toBe('Grade 10');
    expect(en.home.strapline).toBe('to university');
    expect(en.app.tagline).toMatch(/^From Grade 10\b/);
    expect(en.nav.groups.before).toBe('School');
    for (const [path, value] of walk(en.home)) {
      expect(String(value), path).not.toMatch(/Grade 11/);
    }
  });

  it('says it is an AI, not a person, at the start of every chat and under the message box (A10-31)', () => {
    // Anthropic's Usage Policy (from 12 November 2026) and its guidance for products minors use.
    expect(en.chat.welcome(null)).toMatch(/\bAI\b.*\bnot a person\b/);
    expect(en.chat.welcome('Sipho')).toMatch(/\bAI\b.*\bnot a person\b/);
    expect(en.chat.welcomeLead).toMatch(/\bAI\b.*\bnot a person\b/);
    expect(en.chat.disclaimer).toMatch(/\bAI\b/);
    // A Grade 10 learner can't apply yet: the welcome promises no applications (A10-36).
    expect(en.chat.welcomeLead).not.toMatch(/apply for/);
  });

  // A2-66 (DEMO-walk): the chat asked a second-year student to upload a school report.
  it('welcomes a university student as one: an AI, and no school report or applications (A2-66)', () => {
    for (const lead of [en.chat.welcomeLeadArriving, en.chat.welcomeLeadLaterYears]) {
      expect(lead).toMatch(/\bAI\b.*\bnot a person\b/);
      expect(lead).not.toMatch(/school report|apply for|applications/i);
    }
    expect(en.chat.welcomeLeadLaterYears).not.toMatch(/first week/i);
    // One note per starter, as the school starters have.
    expect(en.chat.startersUniversity).toHaveLength(en.chat.starterNotesUniversity.length);
    for (const starter of en.chat.startersUniversity) {
      expect(starter).not.toMatch(/my marks|applications/i);
    }
  });

  it('asks for the latest school report, never a Grade 11 one: it is wrong in Grade 10 and matric (G10-5)', () => {
    for (const [path, value] of walk(en)) {
      const text = typeof value === 'function' ? String(value('X', 1)) : String(value);
      expect(text, path).not.toMatch(/\b(add|upload) (my|your|their) Grade 11 report/i);
    }
  });

  it('never says "you’re in", anywhere (planning.md §8.5, Phase 5a)', () => {
    for (const [path, value] of walk(en)) {
      const text = typeof value === 'function' ? String(value('X', 1)) : String(value);
      expect(text, path).not.toMatch(/\byou[’']re in\b|\byou got in\b|place is yours/i);
    }
  });

  it('says plainly that only a final offer is a place (§8.5)', () => {
    for (const kind of ['provisional', 'conditional', 'waitlist'] as const) {
      expect(en.offers.kinds[kind], kind).not.toMatch(/final|accept|place/i);
      expect(en.offers.explain[kind], kind).toMatch(
        /not a place yet|isn’t an offer of a place yet/,
      );
    }
    expect(en.offers.kinds.final).toMatch(/final/i);
    expect(en.offers.explain.final).toMatch(/final/);
  });

  it('formats rand amounts the South African way', () => {
    expect(en.common.rand(350000)).toMatch(/^R350\s000$/);
  });
});

/**
 * Audit A11-01: consent must name every purpose and every processor (POPIA ss 18, 34-35, 72).
 * Reminders reach a phone through companies outside our control, some outside South Africa.
 */
describe('consent names messaging and who processes it (A11-01)', () => {
  const PROCESSORS = [/SMS company/, /WhatsApp/, /Meta/, /Expo/, /Apple/, /Google/];

  it('the guardian consent says reminders go by SMS, WhatsApp and app notification', () => {
    const whatWeDo = en.consent.whatWeDo.join(' ');
    expect(whatWeDo).toMatch(/reminders?/i);
    expect(whatWeDo).toMatch(/SMS/);
    expect(whatWeDo).toMatch(/WhatsApp/);
    expect(whatWeDo).toMatch(/app notification/);
  });

  it('the guardian consent names every processor, and that they are outside South Africa', () => {
    const whatWeKeep = en.consent.whatWeKeep.join(' ');
    for (const name of PROCESSORS) expect(whatWeKeep).toMatch(name);
    expect(whatWeKeep).toMatch(/outside South Africa/);
  });

  it('the wording changed, so the version did: v2 or later', () => {
    expect(en.consent.version).toMatch(/^v([2-9]|\d{2,})-/);
  });

  it('the learner’s opt-in screens name the processors too', () => {
    for (const name of PROCESSORS) expect(en.me.messages.lead).toMatch(name);
    for (const name of [/Expo/, /Apple/, /Google/]) expect(en.notifications.lead).toMatch(name);
  });

  it('a minor whose guardian agreed to the old wording is told why reminders can’t start', () => {
    expect(en.errors.consentOutdated).toMatch(/guardian/);
  });
});

/**
 * Audit A7-04: an adult is told, and agrees, before their chats and reports go to the AI
 * provider (App Store 5.1.2(i), POPIA s 18).
 */
describe('the adult consent (A7-04)', () => {
  it('discloses the AI provider outside South Africa, and every messaging processor', () => {
    const text = [...en.adultConsent.whatWeDo, ...en.adultConsent.whatWeKeep].join(' ');
    expect(text).toMatch(/AI provider/);
    expect(text).toMatch(/outside South Africa/);
    for (const name of [/WhatsApp/, /Expo/, /Apple/, /Google/]) expect(text).toMatch(name);
  });

  it('asks for an explicit yes, and has a version to record', () => {
    expect(en.adultConsent.agree).toMatch(/I agree/);
    expect(en.adultConsent.version).toMatch(/^adult-v\d+-/);
  });
});

/**
 * Audit A11-13: offer letters and proofs of registration are new purposes and new categories (an
 * ID or student number, a home address and fees printed on them), sent whole to the AI provider
 * outside South Africa (POPIA ss 13, 18, 72). Both consents name them, and both versions moved:
 * packages/db refuses those uploads under guardian consent below v3 or adult agreement below
 * adult-v2.
 */
describe('consent names offer letters and proofs of registration (A11-13)', () => {
  const both = [
    ['guardian', en.consent],
    ['adult', en.adultConsent],
  ] as const;

  it.each(both)('the %s consent says what is read from them, and what is kept', (_, c) => {
    const whatWeDo = c.whatWeDo.join(' ');
    expect(whatWeDo).toMatch(/offer letter/i);
    expect(whatWeDo).toMatch(/proof of registration/i);
    expect(whatWeDo).toMatch(/check every/i);
    const whatWeKeep = c.whatWeKeep.join(' ');
    expect(whatWeKeep).toMatch(/offers/);
    expect(whatWeKeep).toMatch(/modules/);
  });

  it.each(both)(
    'the %s consent says the whole document goes to the AI provider, with what is printed on it',
    (_, c) => {
      const whatWeKeep = c.whatWeKeep.join(' ');
      expect(whatWeKeep).toMatch(/AI provider/);
      expect(whatWeKeep).toMatch(/outside South Africa/);
      expect(whatWeKeep).toMatch(/whole/);
      for (const detail of [/ID number/, /student number/, /address/, /fees/]) {
        expect(whatWeKeep).toMatch(detail);
      }
      // And how long the file itself is kept: only what is true today (A11-14 is open).
      expect(whatWeKeep).toMatch(/original file/);
    },
  );

  it('the wording changed, so the versions did: guardian v3 and adult-v2 or later', () => {
    expect(en.consent.version).toMatch(/^v([3-9]|\d{2,})-/);
    expect(en.adultConsent.version).toMatch(/^adult-v([2-9]|\d{2,})-/);
  });

  it('a minor whose guardian agreed to the old wording is told why the letter can’t be read', () => {
    expect(en.errors.consentOutdatedDocuments).toMatch(/guardian/);
    expect(en.errors.consentOutdatedDocuments).toMatch(/offer letters/);
    expect(en.errors.consentOutdatedDocuments).toMatch(/proofs of registration/);
  });
});
