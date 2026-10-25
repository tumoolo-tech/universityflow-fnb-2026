/**
 * Opting out in one word (planning.md §7.1): "STOP" on every channel, effective at once.
 *
 * The English words are the ones SMS carriers and WhatsApp providers already treat as an
 * opt-out, so a learner who uses any of them is heard. The words in other South African
 * languages are a **starting set that must be reviewed by first-language speakers before
 * launch**, like the crisis phrases in packages/agent/src/crisis.ts: each is marked
 * `reviewed: false` until a speaker signs it off.
 *
 * Matching is deliberately generous, because a missed STOP does harm and an extra one doesn't
 * (WhatsApp's policy asks us to honour every opt-out request, audit A12-05): case, punctuation
 * and spacing are ignored, and a message that *starts* with STOP or UNSUBSCRIBE ("Stop please",
 * "STOP!!") counts too. In a short message, STOP or UNSUBSCRIBE anywhere counts ("Please stop",
 * "Asseblief stop", "unsub"), and so do plain phrases ("Remove me", "No more messages", "Don't
 * message me"), except "can't stop …" and "stop worrying" and the like. The other words count
 * only on their own, since they are ordinary words inside a sentence.
 *
 * A learner in distress is still heard: the inbound route runs the crisis check on every
 * message, STOP or not.
 */

export type StopLanguage = 'en' | 'af' | 'zu' | 'xh' | 'st' | 'tn';

export interface StopWord {
  readonly word: string;
  readonly language: StopLanguage;
  /** Has a first-language speaker confirmed this word means "stop sending me messages"? */
  readonly reviewed: boolean;
  readonly note?: string;
}

export const STOP_WORDS: ReadonlyArray<StopWord> = [
  { word: 'STOP', language: 'en', reviewed: true, note: 'also used in Afrikaans' },
  { word: 'STOPALL', language: 'en', reviewed: true },
  { word: 'UNSUBSCRIBE', language: 'en', reviewed: true },
  { word: 'UNSUB', language: 'en', reviewed: true },
  { word: 'CANCEL', language: 'en', reviewed: true },
  { word: 'END', language: 'en', reviewed: true },
  { word: 'QUIT', language: 'en', reviewed: true },
  { word: 'OPT OUT', language: 'en', reviewed: true },
  { word: 'HOU OP', language: 'af', reviewed: false, note: '"stop" (Afrikaans)' },
  { word: 'YEKA', language: 'zu', reviewed: false, note: '"leave it / stop" (isiZulu, isiXhosa)' },
  { word: 'MISA', language: 'zu', reviewed: false, note: '"stop" (isiZulu)' },
  { word: 'YIMA', language: 'xh', reviewed: false, note: '"stop" (isiXhosa)' },
  { word: 'KHAOTSA', language: 'st', reviewed: false, note: '"stop" (Sesotho)' },
  { word: 'EMA', language: 'st', reviewed: false, note: '"stop / wait" (Sesotho, Setswana)' },
  { word: 'EMISA', language: 'tn', reviewed: false, note: '"stop" (Setswana)' },
];

/** Words that opt out even with more after them. */
const LEADING = new Set(['STOP', 'STOPALL', 'UNSUBSCRIBE', 'UNSUB']);
/** Every word with its spaces taken out, so "OPTOUT" and "OPT OUT" both match. */
const EXACT = new Set(STOP_WORDS.map((w) => w.word.replace(/ /g, '')));

/**
 * A short message (this many words or fewer) is an opt-out when it has STOP or UNSUBSCRIBE
 * anywhere in it, or one of `PHRASES` (audit A12-05: "Please stop", "Remove me"). A longer one
 * is more likely to be a learner talking about something else, so only the rules above apply.
 */
export const SHORT_MESSAGE_WORDS = 10;
/** Opt-out words wherever they stand in a short message. STOP has its own rule (`stopsHere`). */
const ANYWHERE = new Set(['STOPALL', 'UNSUBSCRIBE', 'UNSUB', 'OPTOUT']);
/** "can't stop", "cannot stop", "don't stop": not a request to stop messaging. */
const NEGATIONS = new Set(['T', 'CANT', 'CANNOT', 'NOT', 'NEVER', 'DONT', 'WONT']);
/** "stop sending", "stop texting" are about us; "stop worrying", "stop thinking" are not. */
const ABOUT_MESSAGES = new Set([
  'SENDING',
  'MESSAGING',
  'TEXTING',
  'SMSING',
  'CONTACTING',
  'REMINDING',
  'SPAMMING',
  'BUGGING',
  'WHATSAPPING',
]);
const MESSAGES = '(?:MESSAGES?|MSGS?|TEXTS?|SMS|SMSES|SMSS|REMINDERS?|NOTIFICATIONS?|WHATSAPPS?)';
const CONTACT = '(?:MESSAGE|MSG|TEXT|SMS|CONTACT|WHATSAPP|REMIND|SEND)';
/** Phrases asking us to stop, matched on the normalised text of a short message. */
const PHRASES: ReadonlyArray<RegExp> = [
  /\bREMOVE ME\b/,
  /\bTAKE ME OFF\b/,
  /\bOPT ME OUT\b/,
  /\bOPT OUT\b/,
  new RegExp(`\\bNO MORE ${MESSAGES}\\b`),
  new RegExp(`\\b(?:DON T|DONT|DO NOT) ${CONTACT} ME\\b`),
];

/** Whether the STOP at `i` asks us to stop, rather than being part of another sentence. */
function stopsHere(words: ReadonlyArray<string>, i: number): boolean {
  const before = words[i - 1];
  const after = words[i + 1];
  if (before !== undefined && NEGATIONS.has(before)) return false;
  if (after?.endsWith('ING') && !ABOUT_MESSAGES.has(after)) return false;
  return true;
}

/** Upper case, letters and single spaces only. */
export function normaliseKeyword(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z]+/g, ' ')
    .trim();
}

/** True when a learner's message asks us to stop messaging them on that channel. */
export function isStopMessage(text: string): boolean {
  if (typeof text !== 'string') return false;
  const normal = normaliseKeyword(text.slice(0, 200));
  if (normal === '') return false;
  if (EXACT.has(normal.replace(/ /g, ''))) return true;
  const words = normal.split(' ');
  if (LEADING.has(words[0] as string)) return true;
  if (words.length > SHORT_MESSAGE_WORDS) return false;
  if (words.some((word, i) => ANYWHERE.has(word) || (word === 'STOP' && stopsHere(words, i)))) {
    return true;
  }
  return PHRASES.some((phrase) => phrase.test(normal));
}
