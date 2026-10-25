/**
 * The judge demo's on-screen phone sign-up (a HACKATHON EXCEPTION the owner approved on
 * 2026-10-24; docs/deploy/demo.md "Hackathon exceptions", docs/deploy/hackathon-undo-pr.md).
 * `UF_DEMO_PHONE_SIGNUP=onscreen`, on a demo deployment only (`readConfig` refuses it anywhere
 * else): judges sign up as a new learner the way a real learner does (number, PIN, date of birth,
 * consent, onboarding), on made-up details. Nothing is sent: the PIN is shown on the screen that
 * asked for it, and a minor's guardian link too. Only made-up toll-free numbers (080…) are taken,
 * never a cellphone, and every account is deleted 24 hours after it was made. Unset, the demo is
 * exactly as before (phone sign-in answers 404).
 *
 * No `server-only` and no Node built-ins: config.ts and the pages read this file.
 */

export const DEMO_PHONE_SIGNUP_VARIABLE = 'UF_DEMO_PHONE_SIGNUP';

/** The page judges sign up on. */
export const DEMO_PHONE_SIGNUP_PATH = '/demo/new-learner';

/** The detail of a refused number (any number that isn't a toll-free 080 one). */
export const DEMO_080_ONLY = 'demo-080-only';

/** The detail of a made-up 080 number another browser already made an account with. */
export const DEMO_080_TAKEN = 'demo-080-taken';

export class DemoPhoneSignupConfigError extends Error {
  override readonly name = 'DemoPhoneSignupConfigError';
}

/** Whether the switch is set to `onscreen`. Throws for any other value: never half-meant. */
export function readDemoPhoneSignup(env: Record<string, string | undefined>): boolean {
  const value = env[DEMO_PHONE_SIGNUP_VARIABLE];
  if (value === undefined || value.trim() === '') return false;
  if (value !== 'onscreen') {
    throw new DemoPhoneSignupConfigError(
      'UF_DEMO_PHONE_SIGNUP must be onscreen (the PIN shown on screen, nothing sent), or unset',
    );
  }
  return true;
}

/** For pages: on only on a demo with the switch set exactly; never on a malformed value. */
export function demoPhoneSignupOn(env: Record<string, string | undefined>): boolean {
  if (env['UF_DEPLOYMENT'] !== 'demo') return false;
  try {
    return readDemoPhoneSignup(env);
  } catch {
    return false;
  }
}
