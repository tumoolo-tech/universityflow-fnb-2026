import { HttpError, handler, json } from '@/lib/server/http';
import { getServices } from '@/lib/server/services';

/**
 * Local development only: the SMS messages the stand-in "sent", so a developer (and the E2E
 * tests) can read a PIN or a consent link. Gone the moment a real SMS provider is connected.
 */
export const GET = handler(async () => {
  const { outbox, devChannels, config } = await getServices();
  if (!outbox || config.production || config.demo) throw new HttpError(404, 'not-found');
  const other = devChannels ? [...devChannels.whatsapp.all(), ...devChannels.push.all()] : [];
  return json({
    messages: outbox.all().map((m) => ({ to: m.to, body: m.body, at: m.at.toISOString() })),
    // What the WhatsApp and push stand-ins "sent" (SMS stays in `messages`, as before).
    channels: other.map((m) => ({
      channel: m.channel,
      to: m.to,
      body: m.text,
      template: m.template,
      at: m.at.toISOString(),
    })),
  });
});
