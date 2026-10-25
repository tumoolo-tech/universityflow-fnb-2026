import { en } from '@universityflow/content';
import { z } from 'zod';
import { consentLinkPath, onScreenSignup, requireTollFree } from '@/lib/server/demo/phone-signup';
import { sendOrQueueGuardianSms } from '@/lib/server/guardian-sms';
import { handler, json, parseBody, requireSignedIn } from '@/lib/server/http';
import { getServices } from '@/lib/server/services';

const Body = z.object({
  name: z.string().trim().min(2).max(80),
  phone: z.string().min(9).max(20),
  relationship: z.enum(['parent', 'legal-guardian', 'other-caregiver']),
});

/**
 * Asks a guardian for consent by SMS (POPIA s35; planning.md §8.1). A number that replied STOP
 * is never asked (409 `guardian-opted-out`, A12-04), and at night the SMS waits for 07:00
 * (`queuedUntil`), like every message we start.
 *
 * Judge demo mode sends no SMS: not found there (its made-up learners' consent is a recorded
 * synthetic one, demo.md), unless its on-screen sign-up is on (a hackathon exception). Then the
 * made-up guardian's number must be a toll-free 080 one, nothing is sent, and the link comes back
 * for the screen to show, so a judge can open it and agree as the made-up guardian. The request
 * is recorded as any is: the learner's data still waits for that yes (hard rule 5).
 */
export const POST = handler(async (request: Request) => {
  const services = await getServices();
  const onScreen = onScreenSignup(services);
  const { studentId } = await requireSignedIn(request);
  const guardian = await parseBody(request, Body);
  if (onScreen) requireTollFree(guardian.phone);
  const { store, sms, jobs, config } = services;
  const { token, guardianPhone, consentId } = await store.requestGuardianConsent(
    studentId,
    guardian,
    en.consent.version,
  );
  if (onScreen) return json({ ok: true, demoConsentLink: consentLinkPath(token) });
  const { queuedUntil } = await sendOrQueueGuardianSms(
    { store, sms, jobs, publicUrl: config.publicUrl },
    { consentId, studentId, token, guardianPhone },
    new Date(),
  );
  return json(queuedUntil ? { ok: true, queuedUntil: queuedUntil.toISOString() } : { ok: true });
});
