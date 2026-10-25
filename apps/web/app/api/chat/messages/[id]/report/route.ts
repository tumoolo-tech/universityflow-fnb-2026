import { REPLY_REPORT_REASONS } from '@universityflow/content';
import { z } from 'zod';
import { HttpError, handler, json, parseBody, QUOTAS, requireReady } from '@/lib/server/http';
import { getServices } from '@/lib/server/services';

const Body = z.object({ reason: z.enum(REPLY_REPORT_REASONS) }).strict();

/**
 * The learner reports one of the AI's replies (A10-35): ids and a reason, stored once, and a
 * person is told. Another learner's reply is not found; their own message is not a reply (409).
 */
export const POST = handler(
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { student, studentId } = await requireReady(request);
    const { id } = await params;
    if (!z.uuid().safeParse(id).success) throw new HttpError(404, 'not-found');
    const { reason } = await parseBody(request, Body);
    const { store, replyReportAlerts } = await getServices();
    const quota = QUOTAS.replyReport;
    if (!(await store.allow('reply-report', studentId, quota.max, quota.windowMs))) {
      throw new HttpError(429, 'rate-limited');
    }
    const { status, writtenBy } = await student.reportReply(id, reason);
    // The person told sees which provider wrote the reply (A10-49); the learner doesn't need to.
    if (status === 'reported') {
      replyReportAlerts.reported({ studentId, messageId: id, reason, writtenBy });
    }
    return json({ status });
  },
);
