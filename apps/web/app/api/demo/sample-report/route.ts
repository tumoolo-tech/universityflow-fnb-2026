import { requireDemo } from '@/lib/server/demo/core';
import { SAMPLE_STATEMENTS, type SampleStatementKey } from '@/lib/server/demo/sample-statements';
import { readersOf, recordAndRead } from '@/lib/server/documents';
import { HttpError, handler, QUOTAS, requireReady } from '@/lib/server/http';
import { newStorageKey } from '@/lib/server/keys';

export const maxDuration = 60;

/** The learner's grade picks the statement; after school, a final Grade 12 one. */
function statementFor(profile: { grade: number | null; schoolFinished: boolean } | null) {
  if (profile?.schoolFinished) return 'school-finished';
  const grade = profile?.grade;
  const key = `grade-${grade}`;
  return (key in SAMPLE_STATEMENTS ? key : 'grade-11') as SampleStatementKey;
}

/**
 * Judge demo mode: "Use a sample report" (docs/deploy/demo.md). Attaches one of the results
 * generator's SAMPLE statements for the learner's grade and reads it exactly as an upload is read
 * (the same reader, the same draft, the same confirm step: hard rule 6), within the upload quota.
 */
export const POST = handler(async (request: Request) => {
  const services = await requireDemo();
  const { store, files, catalogue } = services;
  const { student, studentId } = await requireReady(request);
  if (!(await store.allow('upload', studentId, QUOTAS.upload.max, QUOTAS.upload.windowMs))) {
    throw new HttpError(429, 'rate-limited');
  }
  const statement = SAMPLE_STATEMENTS[statementFor(await student.profile())];
  const bytes = Uint8Array.from(Buffer.from(statement.base64, 'base64'));
  const storageKey = newStorageKey();
  await files.put(storageKey, { bytes, mimeType: 'application/pdf' });
  return recordAndRead(
    student,
    readersOf(services),
    { storageKey, mimeType: 'application/pdf', bytes },
    'grade-11-report',
    catalogue,
    files,
  );
});
