import 'server-only';
import {
  deleteQueuedFile,
  type FileDeletionParts,
  type ModuleOutlineRecord,
  type StudentStore,
  scheduleFileDeletion,
} from '@universityflow/db';
import {
  type ConfirmedModuleOutline,
  confirmedModuleOutlineSchema,
} from '@universityflow/documents';
import type { JobScheduler } from '@universityflow/jobs';
import { HttpError } from './http';
import { likelyAcademicYear } from './registration';

/**
 * Module outlines for the web page and the app's API (Phase 6b). Nothing read from an outline is
 * used until the learner confirms it part by part (hard rule 6); the file goes once they do (D10).
 */

export interface OutlinesResponse {
  /** The learner's confirmed outlines, by year and module. */
  readonly outlines: ReadonlyArray<ModuleOutlineRecord>;
  /** Their latest confirmed registration's year and modules, to start the form with; or null. */
  readonly registration: {
    readonly academicYear: number;
    readonly modules: ReadonlyArray<{ readonly code: string; readonly name: string | null }>;
  } | null;
  /** The academic year an outline confirmed now is most likely for, when there is no registration. */
  readonly defaultYear: number;
}

export async function outlinesResponse(
  student: StudentStore,
  now = new Date(),
): Promise<OutlinesResponse> {
  const [outlines, registration] = await Promise.all([
    student.moduleOutlines(),
    student.registration(),
  ]);
  return {
    outlines,
    registration: registration
      ? {
          academicYear: registration.academicYear,
          modules: registration.modules.map((m) => ({ code: m.code, name: m.name })),
        }
      : null,
    defaultYear: likelyAcademicYear(now),
  };
}

/**
 * The confirmed outline from a request body. Refused, never repaired: weights that don't add up
 * to 100 say so (`weights-dont-add-up`), two parts with one name too (`duplicate-component-names`,
 * A1-81: the module card's rules would refuse it), and an ID or student number, a mobile number
 * or a personal email is `personal-number`; anything else is invalid.
 */
export function confirmedOutline(body: unknown): ConfirmedModuleOutline {
  const parsed = confirmedModuleOutlineSchema.safeParse(body);
  if (parsed.success) return parsed.data;
  const messages = new Set(parsed.error.issues.map((i) => i.message));
  if (messages.has('weights-dont-add-up')) {
    throw new HttpError(400, 'invalid', 'weights-dont-add-up');
  }
  if (messages.has('duplicate-component-names')) {
    throw new HttpError(400, 'invalid', 'duplicate-component-names');
  }
  if (['personal-number', 'mobile-number', 'personal-email'].some((m) => messages.has(m))) {
    throw new HttpError(409, 'state', 'personal-number');
  }
  throw new HttpError(400, 'invalid');
}

/**
 * D10 after the save (A1-88): deletes the outline's file now and forgets it; when storage fails,
 * a `file.delete` job carrying only the queue row's id tries again, retried. Never throws: the
 * outline is saved, so the learner gets it whatever storage does. If even the job can't be put
 * on the schedule, the key stays queued in the database (`file_deletions`) for the owner, and the
 * log says so with the queue id and the error's name only (hard rule 4).
 */
export async function deleteOutlineFile(
  parts: FileDeletionParts & { readonly jobs: JobScheduler },
  fileDeletionId: string,
  now = new Date(),
): Promise<void> {
  try {
    await deleteQueuedFile(parts, fileDeletionId);
    return;
  } catch {
    // Storage failed: the job retries it.
  }
  try {
    await scheduleFileDeletion(parts.jobs, fileDeletionId, now);
  } catch (error) {
    console.error(
      `file.delete ${fileDeletionId}: could not schedule (${(error as Error)?.name ?? 'Error'})`,
    );
  }
}
