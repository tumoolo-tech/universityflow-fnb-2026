import 'server-only';
import {
  type ChannelOptions,
  ExpoPushChannel,
  type InboundVerifier,
  type MessageChannel,
} from '@universityflow/messaging';

/**
 * The live WhatsApp and push channels, by the names `UF_WHATSAPP_PROVIDER` and
 * `UF_PUSH_PROVIDER` select. Each channel extends `GuardedChannel` (so it keeps the address,
 * template, length and opt-out checks) and passes the channel contract
 * (`@universityflow/messaging/contract`) before it is listed here (D8). SMS needs no entry: its
 * channel wraps the live SMS sender from sms-providers.ts.
 *
 * A WhatsApp adapter also brings its inbound half (A5-02): a verifier for the provider's webhooks
 * that passes the inbound contract (`@universityflow/messaging/inbound-contract`), so a learner's
 * STOP and replies reach us. Without it, readConfig and createServices refuse to start. Push has
 * no inbound half: a learner turns it off in the app or the phone's settings, never by reply.
 *
 * WhatsApp is empty on purpose: the owner chooses the provider (Meta's Cloud API or a BSP). Until
 * then live mode doesn't offer it, and refuses to start if it is named without an adapter.
 */

/** What a channel adapter is given besides the environment. */
export interface ChannelAdapterContext extends ChannelOptions {
  /** Forget an address the provider says no longer exists (a push token for a removed app). */
  readonly forgetAddress: (address: string) => Promise<void>;
}

export type ChannelAdapterFactory = (
  env: Record<string, string | undefined>,
  context: ChannelAdapterContext,
) => MessageChannel;

export interface WhatsAppAdapter {
  readonly channel: ChannelAdapterFactory;
  /** The provider's inbound webhooks, for /api/messaging/whatsapp/inbound: STOP, replies, reports. */
  readonly inbound: (env: Record<string, string | undefined>) => InboundVerifier;
}

export const WHATSAPP_ADAPTERS: Readonly<Record<string, WhatsAppAdapter>> = {};

/**
 * `UF_PUSH_PROVIDER=expo`: Expo's push service over HTTPS (packages/messaging, expo-push.ts).
 * Needs `EXPO_ACCESS_TOKEN`, with Expo's "enhanced push security" turned on for the project
 * (A5-03, A11-06): without it, anyone holding a learner's push token could put any text on a
 * minor's lock screen under our name. readConfig refuses live mode without it; the adapter refuses
 * too, for a Config built by hand. A notification passes through Expo and Apple or Google, outside
 * South Africa, which is why it carries only a template's variable-free text
 * (docs/audits/A11-privacy-popia.md).
 */
export const PUSH_ADAPTERS: Readonly<Record<string, ChannelAdapterFactory>> = {
  expo: (env, context) => {
    const accessToken = env['EXPO_ACCESS_TOKEN'];
    if (!accessToken) {
      throw new Error('UF_PUSH_PROVIDER=expo needs EXPO_ACCESS_TOKEN (A5-03)');
    }
    return new ExpoPushChannel({
      gate: context.gate,
      ...(context.clock ? { clock: context.clock } : {}),
      accessToken,
      forgetAddress: context.forgetAddress,
    });
  },
};
