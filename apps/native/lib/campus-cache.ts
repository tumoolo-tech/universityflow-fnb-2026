import { File, Paths } from 'expo-file-system';
import type { CampusResponse } from './types';

/**
 * The last good My campus, kept on the phone so campus security and the clinic can be reached
 * with no data (audit A7-17): arrival week, on a prepaid bundle that has run out, is when a
 * first-year most needs them, and planning.md §11 5b treats them as safety facts.
 *
 * What it holds: the server's campus response (public catalogue records, each with its draft
 * flag, a university id and the list of universities) and when it was saved. Nothing about the
 * learner beyond which university, so it is a file in the app's own documents folder, not the
 * secure store (whose values are limited in size on some platforms; a response is about 10 KB
 * today and grows with every verified place). It goes with the session: `clearToken` forgets it
 * at sign-out, account deletion and a 401.
 *
 * Which response it keeps: the accepted offer's university once there is one (looking around
 * another university doesn't replace it), else the last university looked around. Each such
 * fetch replaces it, so a record re-verified or withdrawn on the server changes here too.
 */

export interface SavedCampus {
  /** When it was saved, as an ISO instant. */
  readonly savedAt: string;
  readonly response: CampusResponse;
}

const NAME = 'uf-campus-last-good.json';
const VERSION = 1;

function file(): File {
  return new File(Paths.document, NAME);
}

/** Whether a response is the one worth keeping (see above). */
function worthKeeping(response: CampusResponse): boolean {
  if (!response.tour) return false;
  return response.accepted === null || response.tour.universityId === response.accepted;
}

/** Keeps `response` as the last good one, if it is worth keeping. Never throws. */
export async function rememberCampus(response: CampusResponse): Promise<void> {
  if (!worthKeeping(response)) return;
  const saved = { version: VERSION, savedAt: new Date().toISOString(), response };
  try {
    const target = file();
    if (!target.exists) target.create();
    target.write(JSON.stringify(saved));
  } catch {
    // A full disk or an unwritable folder: the screen works as before, without the copy.
  }
}

/** The last good response, or null when none is kept (or what is kept can't be read). */
export async function savedCampus(): Promise<SavedCampus | null> {
  try {
    const source = file();
    if (!source.exists) return null;
    const parsed = JSON.parse(await source.text()) as {
      version?: unknown;
      savedAt?: unknown;
      response?: Partial<CampusResponse> | null;
    };
    const { response } = parsed;
    if (
      parsed.version !== VERSION ||
      typeof parsed.savedAt !== 'string' ||
      !response ||
      !response.tour ||
      !Array.isArray(response.options)
    ) {
      forgetCampus();
      return null;
    }
    return { savedAt: parsed.savedAt, response: response as CampusResponse };
  } catch {
    return null;
  }
}

/** Forgets the copy (sign-out, account deletion, a 401). Never throws. */
export function forgetCampus(): void {
  try {
    const target = file();
    if (target.exists) target.delete();
  } catch {
    // Nothing kept, nothing to forget.
  }
}
