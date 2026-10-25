import 'server-only';
import { programmeCandidates } from '@universityflow/admissions';
import type { CatalogueView } from '@universityflow/catalogue';
import type { StudentStore } from '@universityflow/db';
import {
  draftFromExtraction,
  draftFromLetter,
  draftFromModuleOutline,
  draftFromRegistration,
  type FileStore,
  type LetterReader,
  type ModuleOutlineReader,
  ReaderUnavailableError,
  type RegistrationReader,
  type ReportReader,
  type UploadType,
} from '@universityflow/documents';
import { z } from 'zod';
import { HttpError, json } from './http';

/**
 * The documents a learner can upload to be read: a report (the default), an offer letter, or a
 * proof of registration.
 */
export const ReadableKind = z.enum([
  'grade-11-report',
  'acceptance-letter',
  'proof-of-registration',
  // Phase 6b: a module outline, confirmed through /api/module-outlines.
  'module-outline',
]);
export type ReadableKind = z.infer<typeof ReadableKind>;

/** The kind an upload names (a form field or a query parameter), the report when it names none. */
export function readableKind(value: unknown): ReadableKind {
  if (value === null || value === undefined || value === '') return 'grade-11-report';
  const parsed = ReadableKind.safeParse(value);
  if (!parsed.success) throw new HttpError(400, 'invalid');
  return parsed.data;
}

export interface Readers {
  readonly report: ReportReader;
  readonly letter: LetterReader;
  readonly registration: RegistrationReader;
  readonly outline: ModuleOutlineReader;
}

/** Every reader, from the app's services. */
export const readersOf = (services: {
  readonly reader: ReportReader;
  readonly letterReader: LetterReader;
  readonly registrationReader: RegistrationReader;
  readonly outlineReader: ModuleOutlineReader;
}): Readers => ({
  report: services.reader,
  letter: services.letterReader,
  registration: services.registrationReader,
  outline: services.outlineReader,
});

/**
 * Records an accepted upload and reads it into a draft, for both upload paths (through our
 * server, and direct to storage). The draft is never used for anything until the learner
 * confirms it: a report through /api/reports, a letter through /api/offers, a proof of
 * registration through /api/registration, a module outline through /api/module-outlines (hard
 * rule 6).
 *
 * A letter's programme is matched to the catalogue by code (`programmeCandidates`), as a short
 * list the learner chooses from; never by the AI, and never silently. A proof of registration's
 * student number, ID number, name, address and fees are never read (its schema has no place for
 * them), so the stored draft holds none of them.
 *
 * A letter or a proof is recorded, and so read, only under consent wording that names them
 * (audit A11-13: the data layer refuses it otherwise); a module outline likewise (D9, migration
 * 0040). A refused file is deleted from storage
 * again before the refusal reaches the learner: nothing is kept that no consent covers.
 */
export async function recordAndRead(
  student: StudentStore,
  readers: Readers,
  file: { storageKey: string; mimeType: UploadType; bytes: Uint8Array },
  kind: ReadableKind,
  catalogue: () => CatalogueView,
  files: Pick<FileStore, 'delete'>,
): Promise<Response> {
  let document: Awaited<ReturnType<StudentStore['addDocument']>>;
  try {
    document = await student.addDocument({
      kind,
      storageKey: file.storageKey,
      mimeType: file.mimeType,
      sizeBytes: file.bytes.length,
    });
  } catch (error) {
    await files.delete(file.storageKey);
    throw error;
  }
  if (!document) throw new HttpError(500, 'server');

  try {
    if (kind === 'acceptance-letter') {
      const letter = draftFromLetter(await readers.letter.read(file));
      const candidates = programmeCandidates(catalogue(), {
        university: letter.universityAsPrinted,
        programme: letter.programmeAsPrinted,
      });
      const sample = readers.letter.isSample;
      await student.setExtraction(document.id, { letter, sample }, 'extracted');
      return json({ documentId: document.id, letter, candidates, sample });
    }
    if (kind === 'proof-of-registration') {
      const registration = draftFromRegistration(await readers.registration.read(file));
      const sample = readers.registration.isSample;
      await student.setExtraction(document.id, { registration, sample }, 'extracted');
      return json({ documentId: document.id, registration, sample });
    }
    if (kind === 'module-outline') {
      // A lecturer's personal mobile number or email, a class list and any student number are
      // never in the draft (D3): the schema has no place for them, or the draft drops them.
      const outline = draftFromModuleOutline(await readers.outline.read(file));
      const sample = readers.outline.isSample;
      await student.setExtraction(document.id, { outline, sample }, 'extracted');
      return json({ documentId: document.id, outline, sample });
    }
    const extracted = await readers.report.read(file);
    const draft = draftFromExtraction(extracted);
    const sample = readers.report.isSample;
    await student.setExtraction(document.id, { draft, sample }, 'extracted');
    return json({ documentId: document.id, draft, sample });
  } catch (error) {
    if (!(error instanceof ReaderUnavailableError)) throw error;
    await student.setExtraction(document.id, null, 'failed');
    if (kind === 'acceptance-letter') {
      return json({ documentId: document.id, letter: null, candidates: [], sample: false });
    }
    if (kind === 'proof-of-registration') {
      return json({ documentId: document.id, registration: null, sample: false });
    }
    if (kind === 'module-outline') {
      return json({ documentId: document.id, outline: null, sample: false });
    }
    return json({ documentId: document.id, draft: null, sample: false });
  }
}
