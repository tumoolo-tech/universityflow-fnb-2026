import { en } from '@universityflow/content';
import { maskPhone } from '@universityflow/db';
import { SmsBudgetExceededError } from '@universityflow/messaging';
import { z } from 'zod';
import { onScreenPin, onScreenSignup } from '@/lib/server/demo/phone-signup';
import { assertSameOrigin, clientIp, handler, json, parseBody } from '@/lib/server/http';
import { getServices, SMS_AUTH_BUDGET, smsBudgetWindows } from '@/lib/server/services';

const Body = z.object({ phone: z.string().min(9).max(20) });

/**
 * Sends a one-time PIN by SMS. The PIN never appears in a response or a log.
 *
 * The PIN is issued first, so the per-number and per-IP limits are checked and counted under
 * the store's lock before anything is sent. If the SMS then fails (the provider, or the global
 * SMS budget failing closed), the PIN is taken back so the learner isn't left with one they never
 * got and can ask again at once; the per-IP count stays spent (A1-11, `Store.withdrawOtp`).
 *
 * The store-review number (A7-01) has nothing to send: no SMS goes out and no SMS budget is
 * spent. It still passes the same budget gate, so when the budget is spent it fails like every
 * number (A1-22), and otherwise it answers as any number does: neither says which number it is.
 *
 * Judge demo mode has no phone sign-in (a persona picker instead, docs/deploy/demo.md): not found,
 * unless its on-screen sign-up is on (a hackathon exception, `UF_DEMO_PHONE_SIGNUP=onscreen`).
 * Then a made-up 080 number's PIN comes back in the response for the screen to show, and nothing
 * is sent; the same limits apply, and the PIN is never logged.
 */
export const POST = handler(async (request: Request) => {
  const services = await getServices();
  const onScreen = onScreenSignup(services);
  assertSameOrigin(request);
  const { phone } = await parseBody(request, Body);
  if (onScreen) return json(await onScreenPin(services, phone, clientIp(request)));
  const { store, sms, config } = services;
  const challenge = await store.requestOtp(phone, { ip: clientIp(request) });
  try {
    if (challenge.review) {
      const { allowed } = await store.peekBudget(
        SMS_AUTH_BUDGET,
        smsBudgetWindows(config.smsBudget),
      );
      if (!allowed) throw new SmsBudgetExceededError('budget');
    } else {
      await sms.send({ to: challenge.phone, body: en.auth.smsBody(challenge.code) });
    }
  } catch (error) {
    // The send's own error is the one to report; a failed withdrawal leaves an unsent PIN that
    // expires on its own, no worse than before.
    await store.withdrawOtp(challenge).catch(() => undefined);
    throw error;
  }
  return json({ ok: true, phoneMasked: maskPhone(challenge.phone) });
});
