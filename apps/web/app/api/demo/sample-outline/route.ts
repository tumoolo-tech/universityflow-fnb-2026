import { requireDemo } from '@/lib/server/demo/core';
import { SAMPLE_OUTLINES, type SampleOutlineYear } from '@/lib/server/demo/sample-outlines';
import { readersOf, recordAndRead } from '@/lib/server/documents';
import { HttpError, handler, QUOTAS, requireReady } from '@/lib/server/http';
import { newStorageKey } from '@/lib/server/keys';

export const maxDuration = 60;

/** The learner's year of study picks the outline: their made-up registration's first module. */
function outlineFor(yearOfStudy: number | null | undefined): SampleOutlineYear {
  if (yearOfStudy && yearOfStudy >= 3) return 3;
  return yearOfStudy === 2 ? 2 : 1;
}

/**
 * Judge demo mode: "Use a sample module outline" (Phase 6b). Attaches one of the results
 * generator's SAMPLE module outlines and reads it exactly as an upload is read (the same reader,
 * the same draft, the same part-by-part confirm step: hard rule 6), within the upload quota. The
 * made-up learner's consent must name module outlines, as anyone's must (D9): the demo's
 * university learners record the draft wording (docs/deploy/hackathon-undo-pr.md, I).
 */
export const POST = handler(async (request: Request) => {
  const services = await requireDemo();
  const { store, files, catalogue } = services;
  const { student, studentId } = await requireReady(request);
  if (!(await store.allow('upload', studentId, QUOTAS.upload.max, QUOTAS.upload.windowMs))) {
    throw new HttpError(429, 'rate-limited');
  }
  const registration = await student.registration();
  const base64 = SAMPLE_OUTLINES[outlineFor(registration?.yearOfStudy)];
  const bytes = Uint8Array.from(Buffer.from(base64, 'base64'));
  const storageKey = newStorageKey();
  await files.put(storageKey, { bytes, mimeType: 'application/pdf' });
  return recordAndRead(
    student,
    readersOf(services),
    { storageKey, mimeType: 'application/pdf', bytes },
    'module-outline',
    catalogue,
    files,
  );
});
