import { assessAll } from '@universityflow/admissions';
import { handler, json, requireReady } from '@/lib/server/http';
import { schoolRecordOf, scored } from '@/lib/server/scored';
import { getServices } from '@/lib/server/services';

/**
 * Every programme checked against the learner's latest confirmed report, and their school record:
 * every report they confirmed, side by side (planning.md §18.7 C2).
 */
export const GET = handler(async (request: Request) => {
  const { student } = await requireReady(request);
  const report = await student.latestReport();
  if (!report) return json({ report: null, results: null });
  const { catalogue } = await getServices();
  const results = assessAll(catalogue(), scored(report));
  return json({
    report,
    results,
    shortlist: (await student.shortlist()).map((s) => s.programmeId),
    record: schoolRecordOf(await student.schoolRecordReports()),
  });
});
