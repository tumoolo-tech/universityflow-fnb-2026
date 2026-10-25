import { crisis } from './en/crisis';
import { messageText } from './messages';

/**
 * What the helplines on a crisis card can promise (audit A10-11), decided by the agent from the
 * verified records (`crisisCard`), never by the words:
 *
 * - `all-day`: at least one support line, and every support line shown says it is open 24 hours.
 * - `set-hours`: at least one support line, but not every one says 24 hours.
 * - `none`: no verified support line (the card is empty, or shows only emergency numbers).
 */
export type HelplineCover = 'none' | 'all-day' | 'set-hours';

/**
 * A card stored before A10-11 carries no cover: it promises nothing about hours, and says "these
 * lines" only when it shows some.
 */
function coverOf(cover: HelplineCover | undefined, linesShown: number): HelplineCover {
  return cover ?? (linesShown > 0 ? 'set-hours' : 'none');
}

/** The crisis words for chat and the card, for what the card's lines can promise. */
export function crisisWords(cover: HelplineCover | undefined, linesShown = 0) {
  const c = coverOf(cover, linesShown);
  return {
    reply:
      c === 'all-day'
        ? crisis.reply
        : c === 'set-hours'
          ? crisis.replySetHours
          : crisis.replyNoLines,
    concernReply: c === 'none' ? crisis.concernReplyNoLines : crisis.concernReply,
    /** Null when there is no support line to describe. */
    cardLead:
      c === 'all-day' ? crisis.cardLead : c === 'set-hours' ? crisis.cardLeadSetHours : null,
  };
}

/** The SMS and WhatsApp leads (`messageText.crisis`), which never claim hours. */
export function crisisSmsWords(cover: HelplineCover) {
  return cover === 'none'
    ? {
        reply: messageText.crisis.replyNoLines,
        concernReply: messageText.crisis.concernReplyNoLines,
      }
    : { reply: messageText.crisis.reply, concernReply: messageText.crisis.concernReply };
}
