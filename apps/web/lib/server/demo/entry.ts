import 'server-only';
import { ConfigError, isDemo, logConfigRefusal, readConfig } from '../config';
import { currentStudent } from '../session';

/**
 * The judge demo's ways in (the owner, 2026-10-23, late: "nothing works" on the live demo). Its
 * public pages (the landing page, /sign-in, the picker, the sign-up) must explain rather than
 * crash when the server refuses its configuration: the refusal is logged with its message
 * (variable names only, `logConfigRefusal`) and the page says the demo isn't set up yet. Outside a
 * demo nothing here changes anything: production's pages throw as they always did.
 */

/** The demo's configuration refusal (logged once per call), or null when it would start. */
export function demoConfigRefusal(): ConfigError | null {
  if (!isDemo()) return null;
  try {
    readConfig();
    return null;
  } catch (error) {
    if (!(error instanceof ConfigError)) throw error;
    logConfigRefusal(error);
    return error;
  }
}

/**
 * Whether this browser is signed in. On a demo whose configuration is refused, a stale session
 * cookie can't be read, so it counts as signed out (and the refusal is logged); anywhere else the
 * refusal is thrown as before.
 */
export async function signedInOrRefused(): Promise<boolean> {
  try {
    return Boolean(await currentStudent());
  } catch (error) {
    if (!(error instanceof ConfigError) || !isDemo()) throw error;
    logConfigRefusal(error);
    return false;
  }
}
