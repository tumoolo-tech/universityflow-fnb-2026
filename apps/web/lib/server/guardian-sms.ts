import 'server-only';
import { en } from '@universityflow/content';
import type { Store } from '@universityflow/db';
import {
  defineJobKind,
  entityId,
  handle,
  type JobHandler,
  type JobScheduler,
} from '@universityflow/jobs';
import { isQuietHour, nextSendableAt, type SmsSender } from '@universityflow/messaging';

/**
 * The guardian consent SMS (POPIA s35; planning.md §8.1) keeps quiet hours like every message we
 * start (audit A12-04): asked for between 21:00 and 07:00 South African time, it is queued on the
 * job scheduler until 07:00 rather than sent at night. The job carries ids only (hard rule 4);
 * at 07:00 the store issues a fresh link for the request, if it is still open and the number
 * hasn't since replied STOP, and only then is the SMS sent.
 */

export const GUARDIAN_CONSENT_SMS = defineJobKind('guardian.consent-sms', [
  'consentId',
  'studentId',
]);

/** A queued SMS that fails at 07:00 is retried a few times, then given up. */
const GUARDIAN_SMS_ATTEMPTS = 3;

export interface GuardianSms {
  readonly store: Store;
  readonly sms: SmsSender;
  readonly publicUrl: string;
}

const bodyFor = (publicUrl: string, token: string) =>
  en.onboarding.smsToGuardian(`${publicUrl}/consent/${token}`);

/**
 * Sends a new request's SMS now, or outside quiet hours queues it for 07:00 and says when it will
 * go. The request itself was already recorded (and the number checked against STOP) by
 * `store.requestGuardianConsent`.
 */
export async function sendOrQueueGuardianSms(
  parts: GuardianSms & { readonly jobs: JobScheduler },
  request: {
    readonly consentId: string;
    readonly studentId: string;
    readonly token: string;
    readonly guardianPhone: string;
  },
  now: Date,
): Promise<{ queuedUntil: Date | null }> {
  if (!isQuietHour(now)) {
    await parts.sms.send({
      to: request.guardianPhone,
      body: bodyFor(parts.publicUrl, request.token),
    });
    return { queuedUntil: null };
  }
  const runAt = nextSendableAt(now);
  await parts.jobs.schedule({
    kind: GUARDIAN_CONSENT_SMS,
    payload: { consentId: entityId(request.consentId), studentId: entityId(request.studentId) },
    runAt,
    idempotencyKey: `guardian-sms:${request.consentId}`,
    maxAttempts: GUARDIAN_SMS_ATTEMPTS,
  });
  return { queuedUntil: runAt };
}

/** The `guardian.consent-sms` handler: at 07:00, a fresh link to a request still open. */
export function guardianSmsHandler(
  parts: GuardianSms & { readonly scheduler: JobScheduler; readonly clock?: () => Date },
): JobHandler {
  const clock = parts.clock ?? (() => new Date());
  return handle(GUARDIAN_CONSENT_SMS, async ({ consentId, studentId }) => {
    const now = clock();
    // A runner that wakes early (or a retry that lands at night) waits for the morning again.
    if (isQuietHour(now)) {
      await parts.scheduler.schedule({
        kind: GUARDIAN_CONSENT_SMS,
        payload: { consentId, studentId },
        runAt: nextSendableAt(now),
        idempotencyKey: `guardian-sms:${consentId}:${nextSendableAt(now).getTime()}`,
        maxAttempts: GUARDIAN_SMS_ATTEMPTS,
      });
      return;
    }
    const link = await parts.store.guardianLinkToSend(consentId);
    if (!link) return;
    await parts.sms.send({ to: link.guardianPhone, body: bodyFor(parts.publicUrl, link.token) });
  });
}
