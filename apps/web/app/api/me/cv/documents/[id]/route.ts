import { deleteWithRetry, ownCv, signedPdfLink } from '@/lib/server/cv';
import { cvOn } from '@/lib/server/cv-routes';
import { handler, json, requireReady, requireSignedIn } from '@/lib/server/http';

/**
 * One of the learner's CVs: its text, gaps and ATS numbers, and, once ready, a link to its PDF
 * that works for 60 seconds (§10.3), so the app can open it in the system viewer and a browser
 * can download it, without a cookie and without the link outliving the moment. An under-18 may
 * download their own PDF (D6). Another learner's CV is simply not there (404).
 *
 * DELETE (A11-38; D13: "the CVs until the learner deletes them"): the CV, its PDF in our files,
 * its share links (dead at once) and its report. For any signed-in learner, with or without
 * consent: a learner can always take their data back. A CV still being made is 409 `cv-busy`.
 * Mmereko keeps nothing to delete: its copy goes at collection or within the day (§7.2). The
 * PDF's delete is tried again on a storage blip (CV5-02), so the row's going first leaves no file.
 */

type Params = { params: Promise<{ id: string }> };

export const GET = handler(async (request: Request, { params }: Params) => {
  const services = await cvOn();
  const { student } = await requireReady(request);
  const { id } = await params;
  const document = await ownCv(student, id);
  const pdf =
    document.status === 'ready' && document.hasPdf
      ? signedPdfLink(services.config.publicUrl, services.config.authSecret, id, new Date())
      : null;
  return json({ document, pdf });
});

export const DELETE = handler(async (request: Request, { params }: Params) => {
  const services = await cvOn();
  const { student } = await requireSignedIn(request);
  const { id } = await params;
  const { fileKey } = await student.deleteCvDocument(id);
  if (fileKey) await deleteWithRetry(services.files, fileKey);
  return json({ deleted: true });
});
