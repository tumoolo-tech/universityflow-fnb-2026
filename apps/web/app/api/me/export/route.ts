import { handler, requireSignedIn } from '@/lib/server/http';
import { exportedPhoto } from '@/lib/server/profile-photo';
import { getServices } from '@/lib/server/services';

/**
 * Everything held about the learner, as a download (planning.md §8.1). With the personal part,
 * the profile photo itself (base64), whether or not the photo switch is on: what is held is theirs.
 * My CV (docs/design/mmereko-api-proposal.md §7.3): the CVs' PDFs from our own files (base64), and
 * what the CV engine still holds for each of the learner's references (normally job records with
 * ids and times only), so the learner's POPIA s23 answer is complete.
 */
export const GET = handler(async (request: Request) => {
  const { student } = await requireSignedIn(request);
  const services = await getServices();
  const data = await student.exportAll();
  const personal = data.personal
    ? {
        ...data.personal,
        profilePhoto: await exportedPhoto(student, services.files),
        cvPdfs: await cvPdfs(student, services),
      }
    : null;
  const cvEngine = await engineExport(data.personal?.cv.links ?? [], services);
  return new Response(JSON.stringify({ ...data, personal, cvEngine }, null, 2), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'content-disposition': 'attachment; filename="universityflow-my-data.json"',
      'cache-control': 'no-store',
    },
  });
});

type Student = Awaited<ReturnType<typeof requireSignedIn>>['student'];
type Services = Awaited<ReturnType<typeof getServices>>;

async function cvPdfs(student: Student, services: Services) {
  const documents = await student.cvDocuments();
  const out: Array<{ documentId: string; pdfBase64: string }> = [];
  for (const doc of documents.filter((d) => d.hasPdf)) {
    const file = await student.cvFile(doc.id);
    const stored = file ? await services.files.get(file.fileKey) : null;
    if (stored)
      out.push({ documentId: doc.id, pdfBase64: Buffer.from(stored.bytes).toString('base64') });
  }
  return out;
}

/** What the engine still holds, per reference; "unavailable" when it can't answer now. */
async function engineExport(
  links: ReadonlyArray<{ readonly learnerRef: string }>,
  services: Services,
) {
  if (!services.cv || links.length === 0) return [];
  const engine = services.cv;
  return Promise.all(
    links.map(async ({ learnerRef }) => {
      try {
        return await engine.exportLearner(learnerRef);
      } catch {
        return { learnerRef, unavailable: true };
      }
    }),
  );
}
