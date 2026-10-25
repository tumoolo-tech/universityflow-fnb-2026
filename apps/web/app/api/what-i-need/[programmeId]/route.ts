import { whatINeedFor } from '@universityflow/admissions';
import { HttpError, handler, json, requireReady } from '@/lib/server/http';
import { scored } from '@/lib/server/scored';
import { getServices } from '@/lib/server/services';

/**
 * "What I need per subject" for one programme, from the learner's latest confirmed report only
 * (hard rule 6), computed by packages/admissions (hard rule 2). A programme the learner may not
 * see (unknown, or unverified outside preview) is not found.
 */
export const GET = handler(
  async (request: Request, { params }: { params: Promise<{ programmeId: string }> }) => {
    const { student } = await requireReady(request);
    const { programmeId } = await params;
    if (!/^[a-z0-9-]{3,80}$/.test(programmeId)) throw new HttpError(404, 'not-found');
    const report = await student.latestReport();
    if (!report) return json({ report: null, result: null });
    const { catalogue } = await getServices();
    const result = whatINeedFor(catalogue(), programmeId, scored(report));
    if (!result) throw new HttpError(404, 'not-found');
    return json({
      report: { kind: report.kind, confirmedAt: report.confirmedAt.toISOString() },
      result,
    });
  },
);
