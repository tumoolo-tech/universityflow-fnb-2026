import { CV_REPORT_REASONS } from '@universityflow/content';
import { z } from 'zod';
import { logCvReportAlerts } from '@/lib/server/cv-reports';
import { cvOn } from '@/lib/server/cv-routes';
import { HttpError, handler, json, parseBody, QUOTAS, requireReady } from '@/lib/server/http';

const Body = z.object({ reason: z.enum(CV_REPORT_REASONS) }).strict();

/**
 * "Report this CV" (A10-58; docs/design/mmereko-api-proposal.md §11, A10-35's pattern): the
 * learner reports a fitted CV, which an AI wrote, for a person to look at. Ids and a reason,
 * stored once, and a person is told (ids only, hard rule 4). Another learner's CV is not found; a
 * base CV (no AI wrote it) is 409. 404 while UF_CV is off.
 */
export const POST = handler(
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { store } = await cvOn();
    const { student, studentId } = await requireReady(request);
    const { id } = await params;
    if (!z.uuid().safeParse(id).success) throw new HttpError(404, 'not-found');
    const { reason } = await parseBody(request, Body);
    const quota = QUOTAS.cvReport;
    if (!(await store.allow('cv-report', studentId, quota.max, quota.windowMs))) {
      throw new HttpError(429, 'rate-limited');
    }
    const { status } = await student.reportCvDocument(id, reason);
    if (status === 'reported') logCvReportAlerts.reported({ studentId, documentId: id, reason });
    return json({ status });
  },
);
