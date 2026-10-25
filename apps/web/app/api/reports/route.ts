import { validateMarks } from '@universityflow/admissions';
import { REPORT_KINDS, reportAboveGrade } from '@universityflow/catalogue';
import { confirmedMarksSchema } from '@universityflow/documents';
import { z } from 'zod';
import { HttpError, handler, json, parseBody, requireReady } from '@/lib/server/http';
import { type RecheckOutcome, recheckAfterConfirm } from '@/lib/server/rechecks';
import { getServices } from '@/lib/server/services';

const Body = z.object({
  kind: z.enum(REPORT_KINDS),
  marks: confirmedMarksSchema,
  documentId: z.uuid().nullable().optional(),
});

const HOUR_MS = 60 * 60 * 1000;
/**
 * Confirmations a learner may make (A1-12). A year has at most four reports; these leave room for many
 * corrections, not for a script re-confirming marks to fill the queue with re-checks.
 */
const REPORTS_PER_HOUR = 10;
const REPORTS_PER_DAY = 24;

/**
 * The learner confirms their marks. Only now do they reach any calculation (hard rule 6), and
 * only now can a June or September report trigger a re-check (Phase 4c).
 */
export const POST = handler(async (request: Request) => {
  const { student, studentId } = await requireReady(request);
  const body = await parseBody(request, Body);
  try {
    validateMarks(body.marks);
  } catch {
    throw new HttpError(400, 'invalid');
  }
  // A report from a grade above the learner's is mislabelled (A1-35): a Grade 10 report saved as
  // Grade 11 or 12 would be scored as "Qualify now". The learner is told to check the report type
  // or their grade.
  if (reportAboveGrade(body.kind, (await student.profile())?.grade ?? null)) {
    throw new HttpError(409, 'state', 'report-above-grade');
  }
  if (body.documentId) {
    // Only a report can be a report's source (A1-31): a letter or a proof is refused, as offers
    // and registrations refuse a document of the wrong kind.
    const document = await student.document(body.documentId);
    if (document.kind !== 'grade-11-report') throw new HttpError(400, 'invalid');
  }
  const { store } = await getServices();
  if (
    !(await store.allow('report', studentId, REPORTS_PER_HOUR, HOUR_MS)) ||
    !(await store.allow('report-day', studentId, REPORTS_PER_DAY, 24 * HOUR_MS))
  ) {
    throw new HttpError(429, 'rate-limited');
  }
  const id = await student.saveConfirmedReport({
    kind: body.kind,
    marks: body.marks,
    documentId: body.documentId ?? null,
  });
  // The marks are saved whatever happens next: a failed re-check must not tell the learner their
  // confirmation failed. It is reported by name only (hard rule 4).
  let recheck: RecheckOutcome['status'] | 'failed';
  try {
    const { catalogue, jobs, offeredChannels } = await getServices();
    recheck = (
      await recheckAfterConfirm(
        student,
        { id, kind: body.kind },
        { catalogue: catalogue(), jobs, offeredChannels },
      )
    ).status;
  } catch (error) {
    console.error('recheck failed:', error instanceof Error ? error.name : 'unknown');
    recheck = 'failed';
  }
  // Final matric results (Phase 5a): every offer still open and not final is checked again on
  // them. The check itself runs when the offers are read (lib/server/offers.ts), from these same
  // confirmed marks; here the learner is only told how many there are, so the app can take them
  // to My offers.
  const offersToCheck =
    body.kind === 'grade-12-final'
      ? (await student.offers()).filter((o) => o.status !== 'declined' && o.kind !== 'final').length
      : 0;
  return json({ reportId: id, recheck, offersToCheck });
});
