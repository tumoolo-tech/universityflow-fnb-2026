import 'server-only';
import { assessDistress, type CrisisCampusLines, crisisCard } from '@universityflow/agent';
import type { Helpline } from '@universityflow/catalogue';
import { crisisSmsWords, en, messageText } from '@universityflow/content';

/**
 * The crisis protocol on WhatsApp and SMS (planning.md §4.3, audit A10-05). A learner's reply to
 * a reminder gets the same deterministic check as a chat message, and the same answer in the
 * shape a text message can carry: the reviewed words, then the verified helplines the chat
 * crisis card would show, or what to do when none are verified yet.
 *
 * **Never silent, and bounded in cost (audit A10-15).** Help is never refused, so a reply that
 * needs help skips the inbound rate limit. Instead, each sender gets the full reply
 * `CRISIS_FULL_REPLIES.max` times an hour per channel; every crisis message after that still gets
 * an answer, the shortest one: a line and the single most relevant verified helpline, in one SMS
 * segment. A sender can't make us spend more than they spend sending to us, and the owner gets
 * one alert per sender's window (ids and counts only).
 *
 * The message text is only read here; it is never stored or logged (hard rule 4).
 */

/** Three SMS segments: long enough for help, short enough not to arrive as a wall. */
export const CRISIS_SMS_MAX = 459;
/** How many lines a text message can carry: the most relevant, then an emergency number. */
const MAX_LINES = 3;

/** Full replies per sender, per channel, per window; after that, the one-segment reply. */
export const CRISIS_FULL_REPLIES = { max: 3, windowMs: 60 * 60 * 1000 } as const;

/** The per-sender limiter (the store's `allow`): counts only when it allows; keys by an HMAC. */
export interface CrisisLimiter {
  allow(action: string, key: string, max: number, windowMs: number): Promise<boolean>;
}

/**
 * The reply for a learner's inbound message, or null when it raises no distress. `campus`: the
 * sender's own campus lines (Phase 5b), verified only, when they have an accepted offer.
 */
export function crisisReply(
  text: string,
  helplines: ReadonlyArray<Helpline>,
  campus?: CrisisCampusLines,
): string | null {
  const distress = assessDistress(text);
  if (distress.level === 'none') return null;
  return fullReply(distress, helplines, campus);
}

/**
 * The help for an inbound message from `sender` on `channel`, or null when it raises no distress
 * (and then it costs nothing: no count is taken). Full while the sender has full replies left in
 * the window; the one-segment reply after that, never nothing.
 */
export async function crisisHelp(
  message: { text: string; sender: string; channel: string },
  deps: {
    helplines: ReadonlyArray<Helpline>;
    limiter: CrisisLimiter;
    /**
     * The sender's own campus lines (Phase 5b): verified clinic, counselling and security at the
     * university of their accepted offer, or undefined. Asked only when the message needs help,
     * and never allowed to stop the reply: if it fails, the reply goes without them.
     */
    campus?: () => Promise<CrisisCampusLines | undefined>;
  },
): Promise<string | null> {
  const distress = assessDistress(message.text);
  if (distress.level === 'none') return null;
  const { max, windowMs } = CRISIS_FULL_REPLIES;
  const action = `crisis-reply-${message.channel}`;
  if (await deps.limiter.allow(action, message.sender, max, windowMs)) {
    let campus: CrisisCampusLines | undefined;
    try {
      campus = await deps.campus?.();
    } catch {
      campus = undefined;
    }
    return fullReply(distress, deps.helplines, campus);
  }
  // One alert per sender per window: the first capped reply takes the only slot.
  if (await deps.limiter.allow(`${action}-capped`, message.sender, 1, windowMs)) {
    console.warn(
      `crisis-reply capped: a sender on ${message.channel} had ${max} full help replies within ${windowMs / 60_000} minutes; further replies in this window are one segment`,
    );
  }
  return shortReply(distress, deps.helplines);
}

type Distress = ReturnType<typeof assessDistress>;

function fullReply(
  distress: Distress,
  helplines: ReadonlyArray<Helpline>,
  campus?: CrisisCampusLines,
): string {
  const base = helplineReply(distress, helplines);
  // The learner's own campus lines (Phase 5b) come after the helplines, each only while the whole
  // reply still fits: they never push a helpline out. Only lines with a number to call.
  const lines = (crisisCard(helplines, distress.topics, campus).campus?.lines ?? []).filter(
    (l) => l.phone !== null,
  );
  let reply = base;
  for (const line of lines) {
    const next = `${reply}\n${messageText.crisis.line(`${line.name} (${line.campusName})`, en.crisis.call(line.phone ?? ''))}`;
    if (next.length > CRISIS_SMS_MAX) break;
    reply = next;
  }
  return reply;
}

function helplineReply(distress: Distress, helplines: ReadonlyArray<Helpline>): string {
  const card = crisisCard(helplines, distress.topics);
  // "These lines are free…" only when a verified support line follows (audit A10-11).
  const words = crisisSmsWords(card.cover ?? 'none');
  const lead = distress.level === 'crisis' ? words.reply : words.concernReply;
  const chosen = card.helplines;
  if (chosen.length === 0) return `${lead} ${en.crisis.noVerifiedNumbers}`;

  const isEmergency = (h: (typeof chosen)[number]) =>
    helplines.find((x) => x.id === h.id)?.topics.every((t) => t === 'emergency') ?? false;
  const support = chosen.filter((h) => !isEmergency(h));
  const emergency = chosen.find(isEmergency);
  const picked = [...support.slice(0, emergency ? MAX_LINES - 1 : MAX_LINES)];
  if (emergency) picked.push(emergency);

  const lines = picked.map((h) => {
    const first = h.numbers[0];
    const how = first ? en.crisis[first.kind](first.value) : '';
    return messageText.crisis.line(h.name, how);
  });
  // Drop the least relevant support line until it fits; the first line and the emergency stay.
  while (lines.length > 1 && [lead, ...lines].join('\n').length > CRISIS_SMS_MAX) {
    lines.splice(lines.length > 2 ? lines.length - 2 : 1, 1);
  }
  return [lead, ...lines].join('\n');
}

/**
 * The one-segment reply: the short words and the single most relevant verified helpline, or the
 * "no verified numbers" fallback. If a helpline's name would push it past one segment (a long
 * name, or a character outside GSM-7), the name goes first, then the words: the number always
 * stays.
 */
function shortReply(distress: Distress, helplines: ReadonlyArray<Helpline>): string {
  const lead =
    distress.level === 'crisis'
      ? messageText.crisis.short.reply
      : messageText.crisis.short.concernReply;
  const first = crisisCard(helplines, distress.topics).helplines[0];
  const number = first?.numbers[0];
  if (!first || !number) return `${lead} ${en.crisis.noVerifiedNumbers}`;
  const how = en.crisis[number.kind](number.value);
  const candidates = [`${lead}\n${messageText.crisis.line(first.name, how)}`, `${lead}\n${how}`];
  return candidates.find((c) => smsSegments(c) === 1) ?? how;
}

/** GSM 03.38's basic set (one septet each) and its extension table (two each). */
const GSM_BASIC = new Set(
  '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà',
);
const GSM_EXTENSION = new Set('^{}\\[~]|€\f');

/**
 * How many SMS segments a text costs: 160 GSM-7 septets in one, 153 a segment when split; any
 * other character makes the whole text UCS-2, 70 UTF-16 units in one, 67 a segment when split.
 */
function smsSegments(text: string): number {
  const chars = [...text];
  if (chars.every((c) => GSM_BASIC.has(c) || GSM_EXTENSION.has(c))) {
    const septets = chars.reduce((n, c) => n + (GSM_EXTENSION.has(c) ? 2 : 1), 0);
    return septets <= 160 ? 1 : Math.ceil(septets / 153);
  }
  return text.length <= 70 ? 1 : Math.ceil(text.length / 67);
}
