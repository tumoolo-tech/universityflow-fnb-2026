import 'server-only';
import type { InboundVerifier, SmsSender } from '@universityflow/messaging';

/**
 * The live SMS adapters, by the name `UF_SMS_PROVIDER` selects. Each one sends (an `SmsSender`
 * that passes the SMS contract, packages/messaging/src/sms.contract.ts) **and** receives: an
 * inbound verifier for the provider's webhooks that passes the inbound contract
 * (`@universityflow/messaging/inbound-contract`), so a learner's STOP reaches us (A5-02). Both
 * before it is listed here (D8). Whatever sends is wrapped in the SMS budgets by services.ts.
 *
 * An adapter without its inbound half never starts: readConfig and createServices refuse it,
 * because every SMS we send tells the learner they can reply STOP (POPIA s69, ECTA s45).
 *
 * Empty on purpose: the owner hasn't chosen the provider yet, so `UF_PROVIDERS=live` refuses to
 * start, naming the missing adapter, rather than fall back to a stand-in.
 */
export interface SmsAdapter {
  readonly sender: (env: Record<string, string | undefined>) => SmsSender;
  /** The provider's inbound webhooks, for /api/messaging/sms/inbound: STOP, replies, reports. */
  readonly inbound: (env: Record<string, string | undefined>) => InboundVerifier;
}

export const SMS_ADAPTERS: Readonly<Record<string, SmsAdapter>> = {};

/** The adapters in `registry` that bring an inbound verifier (A5-02). */
export function receivingAdapters(
  registry: Readonly<Record<string, { readonly inbound?: unknown }>>,
): string[] {
  return Object.entries(registry)
    .filter(([, adapter]) => typeof adapter.inbound === 'function')
    .map(([name]) => name);
}
