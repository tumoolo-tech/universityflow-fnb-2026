import { campusSafetyLines, isUniversityId } from '@universityflow/agent';
import { messageText } from '@universityflow/content';
import {
  checkInboundEvent,
  INBOUND_CHANNELS,
  type InboundChannel,
  type InboundEvent,
  isStopMessage,
  type MessageChannel,
  replyForChannel,
} from '@universityflow/messaging';
import { readCappedText } from '@/lib/server/capped-body';
import { crisisHelp } from '@/lib/server/crisis-reply';
import { HttpError, handler, json } from '@/lib/server/http';
import { getServices } from '@/lib/server/services';

/**
 * Inbound webhooks for SMS and WhatsApp (planning.md §11, Phase 4a): a learner's message (STOP,
 * or a reply that opens WhatsApp's 24-hour window) or a delivery report. Locally from the
 * stand-ins; live, from the provider, through its adapter's own verifier (A5-02): a learner's
 * STOP is heard the same way in both.
 *
 * - **Signed or refused.** The channel's verifier (`services.inbound`) must accept the request:
 *   the stand-ins' HMAC (`x-uf-signature`, keyed by UF_MESSAGING_WEBHOOK_SECRET, over the channel
 *   and the body), or the provider's own signature. A forged, unsigned, altered or stale request,
 *   or one signed for the other channel, is refused before anything is read or written (A5-06).
 * - **Once only** (A5-06). A request already seen inside its verifier's window is refused: a
 *   captured request can't be replayed to open a WhatsApp window or repeat a reply.
 * - **STOP works at once** and is confirmed with one message on the same channel
 *   (`channel.sendReply`, A12-12): at any hour, even though the learner has just opted out, and
 *   never counted as a reminder. The response echoes the reply for the dev tools and tests; it is
 *   not an instruction to the provider, so a live adapter must not send it a second time. The
 *   answer is the same whether or not the number has an account, so the endpoint can't be used to
 *   find out who uses UniversityFlow.
 * - **Crisis-checked** (planning.md §4.3, audit A10-05). Every other message gets the same
 *   deterministic check as a chat message; crisis or distress is answered on the same channel
 *   with the reviewed words and the verified helplines (lib/server/crisis-reply.ts).
 * - **Rate-limited** per sender (keyed by an HMAC, never the number itself), except STOP and a
 *   message that needs help.
 * - **Nothing personal is logged** (hard rule 4): no body, no number, not even in errors.
 *
 * A channel that isn't offered, or has no verifier, doesn't exist here (404).
 */

const MAX_BODY_BYTES = 8 * 1024;
const INBOUND_PER_SENDER = { max: 30, windowMs: 10 * 60 * 1000 };

/**
 * Sends the reply on the channel (A12-12): a reply to their own message, so it goes even to
 * someone who has just said STOP, at any hour, and is never a reminder (no cadence slot, no cap).
 * If it can't go (an outage, a spent SMS budget), the STOP or the message still counts: the
 * webhook answers 200 either way, so the provider doesn't post it again, and only the error's
 * name is logged (hard rule 4).
 */
async function sendReply(channel: MessageChannel, to: string, text: string, receivedAt: Date) {
  try {
    await channel.sendReply({ to, text, receivedAt });
  } catch (error) {
    console.error(`inbound ${channel.name}: reply not sent (${(error as Error)?.name ?? 'Error'})`);
  }
}

export const POST = handler(
  async (request: Request, context: { params: Promise<{ channel: string }> }) => {
    const { channel: name } = await context.params;
    const services = await getServices();
    const known = (INBOUND_CHANNELS as readonly string[]).includes(name);
    const channel = known ? services.channels[name as InboundChannel] : undefined;
    const verifier = known ? services.inbound[name as InboundChannel] : undefined;
    if (!channel || !verifier || verifier.channel !== name) {
      throw new HttpError(404, 'not-found');
    }

    // Read up to the cap and no further, with or without a content-length (A5-19).
    const raw = await readCappedText(request, MAX_BODY_BYTES);
    if (raw === null) throw new HttpError(400, 'invalid');
    let verified: { readonly replayKey: string } | null;
    try {
      verified = verifier.verify(
        { url: request.url, headers: request.headers, body: raw },
        new Date(),
      );
    } catch {
      // The contract says a verifier never throws; if one does, the request still isn't trusted.
      verified = null;
    }
    if (!verified?.replayKey) throw new HttpError(401, 'forbidden');

    let body: InboundEvent;
    try {
      // Checked again whatever the adapter returned: only these fields, an SA number.
      body = checkInboundEvent(verifier.parse(raw));
    } catch {
      throw new HttpError(400, 'invalid');
    }

    // Seen before, inside the window its signature is good for: a replay (A5-06). Counted as it
    // is checked, under one lock, so two copies racing in can't both pass.
    if (
      !(await services.store.allow(
        `inbound-seen-${channel.name}`,
        verified.replayKey,
        1,
        verifier.replayWindowMs,
      ))
    ) {
      throw new HttpError(401, 'forbidden');
    }

    // STOP is never rate-limited: an objection always gets through. Every message, STOP or not,
    // gets the crisis check (planning.md §4.3, audit A10-05), since plain-words STOP (A12-05) can
    // share a short message with distress, and help is never rate-limited either.
    const stop = body.type === 'message' && isStopMessage(body.text);
    const help =
      body.type === 'message'
        ? await crisisHelp(
            { text: body.text, sender: body.from, channel: channel.name },
            {
              helplines: services.catalogue().helplines,
              limiter: services.store,
              // The sender's own campus lines, verified only, when their accepted offer can be
              // read under their consent (Phase 5b). Only ids cross the database boundary.
              campus: async () => {
                const id = await services.messaging.acceptedOfferUniversity(body.from);
                return campusSafetyLines(services.catalogue(), isUniversityId(id) ? id : null);
              },
            },
          )
        : null;
    const sender = body.type === 'message' ? body.from : body.receiptId;
    const { max, windowMs } = INBOUND_PER_SENDER;
    const exempt = stop || help !== null;
    if (
      !exempt &&
      !(await services.store.allow(`inbound-${channel.name}`, sender, max, windowMs))
    ) {
      throw new HttpError(429, 'rate-limited');
    }

    if (body.type === 'status') {
      // The category billed is a WhatsApp thing (A12-09); on SMS it means nothing and is ignored.
      await services.messaging.recordDelivery(
        channel.name,
        body.receiptId,
        body.status,
        channel.name === 'whatsapp' ? body.category : undefined,
      );
      await channel.recordStatus(body.receiptId, body.status);
      return json({ ok: true });
    }

    const now = new Date();
    const result = await services.messaging.receiveInbound({
      channel: channel.name,
      from: body.from,
      stop,
      at: now,
    });
    if (result !== 'unknown') await channel.noteInbound(body.from, now);
    // The reply goes back on the channel it arrived on. Help is given whether or not the number
    // has an account, so it reveals none. On SMS, GSM-7 (A1-14). A STOP is recorded for any number
    // (the suppression list, A12-04), so its confirmation is true for every number too. Help comes
    // first when a STOP shares its message with distress; the STOP still holds. One reply at most.
    const reply = replyForChannel(channel.name, help ?? (stop ? messageText.stopConfirmed : null));
    if (reply !== null) await sendReply(channel, body.from, reply, now);
    return json({ ok: true, reply });
  },
);
