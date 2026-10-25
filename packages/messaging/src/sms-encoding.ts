/**
 * How an SMS is billed (audits A1-14, A12-07). A message whose every character is in the GSM 03.38
 * alphabet goes as GSM-7: 160 characters in one segment, 153 per segment once it is split. One
 * character outside it (a curly apostrophe, an emoji) sends the **whole** message as UCS-2: 70 in
 * one segment, 67 per segment after that. Providers bill per segment, so the encoding, not the
 * character count, decides the cost.
 *
 * Pure functions: nothing here sees a number, and nothing is logged (hard rule 4).
 */

/** GSM 03.38's basic alphabet, one septet each (the escape character itself left out). */
const GSM7_BASIC = new Set(
  '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà',
);
/** The extension table: each costs two septets (an escape, then the character). */
const GSM7_EXTENSION = new Set('\f^{}\\[~]|€');

/** One segment on its own, and each segment of a split (concatenated) message. */
export const GSM7_SINGLE = 160;
export const GSM7_PART = 153;
export const UCS2_SINGLE = 70;
export const UCS2_PART = 67;

/** We never send more than this many segments. */
export const SMS_MAX_SEGMENTS = 3;

export type SmsEncoding = 'gsm7' | 'ucs2';

export interface SmsSize {
  readonly encoding: SmsEncoding;
  /** Septets for GSM-7; UTF-16 code units for UCS-2. */
  readonly units: number;
  /** Billed segments; 0 for an empty text. */
  readonly segments: number;
}

/** True when every character can go as GSM-7. */
export function isGsm7(text: string): boolean {
  for (const ch of text) {
    if (!GSM7_BASIC.has(ch) && !GSM7_EXTENSION.has(ch)) return false;
  }
  return true;
}

/**
 * The encoding a provider will use and the segments it will bill. Exact at the edges: an escaped
 * GSM-7 character, or a UCS-2 surrogate pair, is never split across two segments, so a long
 * message can take one more segment than its length alone suggests.
 */
export function smsSize(text: string): SmsSize {
  const gsm = isGsm7(text);
  const costs: number[] = [];
  for (const ch of text) {
    if (gsm) costs.push(GSM7_EXTENSION.has(ch) ? 2 : 1);
    else costs.push(ch.length); // 2 for a character outside the Basic Multilingual Plane
  }
  const units = costs.reduce((a, b) => a + b, 0);
  const single = gsm ? GSM7_SINGLE : UCS2_SINGLE;
  const part = gsm ? GSM7_PART : UCS2_PART;
  const encoding: SmsEncoding = gsm ? 'gsm7' : 'ucs2';
  if (units === 0) return { encoding, units, segments: 0 };
  if (units <= single) return { encoding, units, segments: 1 };
  let segments = 1;
  let room = part;
  for (const cost of costs) {
    if (cost > room) {
      segments += 1;
      room = part;
    }
    room -= cost;
  }
  return { encoding, units, segments };
}

export function smsSegments(text: string): number {
  return smsSize(text).segments;
}

/**
 * Typography that has a plain GSM-7 twin. `packages/content` writes curly quotes and real dashes,
 * which read better in the apps and on WhatsApp; on SMS each of them would send the whole message
 * as UCS-2 and double its cost, so the SMS channel swaps them for their plain forms.
 */
const PLAIN: Readonly<Record<string, string>> = {
  '‘': "'", // ‘
  '’': "'", // ’
  '‚': "'", // ‚
  '‛': "'", // ‛
  '′': "'", // ′
  '“': '"', // “
  '”': '"', // ”
  '„': '"', // „
  '‟': '"', // ‟
  '″': '"', // ″
  '‐': '-', // ‐
  '‑': '-', // non-breaking hyphen
  '‒': '-', // ‒
  '–': '-', // –
  '—': '-', // —
  '―': '-', // ―
  '−': '-', // −
  '…': '...', // …
  ' ': ' ', // no-break space
  ' ': ' ', // thin space
  ' ': ' ', // narrow no-break space
};
const TYPOGRAPHY = new RegExp(`[${Object.keys(PLAIN).join('')}]`, 'g');

/**
 * Swaps typography for its GSM-7 twin. Nothing else changes: a learner's name with a letter
 * outside GSM-7 is sent as they wrote it, as UCS-2, and billed for what it costs.
 */
export function toGsm7Typography(text: string): string {
  return text.replace(TYPOGRAPHY, (ch) => PLAIN[ch] ?? ch);
}

/**
 * A reply as it goes back on `channel`: on SMS with its typography made GSM-7, like every SMS we
 * send (the STOP confirmation, the crisis reply); anywhere else exactly as written. The words
 * never change, reviewed ones included.
 */
export function replyForChannel(channel: string, text: string): string;
export function replyForChannel(channel: string, text: string | null): string | null;
export function replyForChannel(channel: string, text: string | null): string | null {
  return channel === 'sms' && text !== null ? toGsm7Typography(text) : text;
}
