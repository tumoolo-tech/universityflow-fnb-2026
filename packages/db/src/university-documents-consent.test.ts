import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from './client';
import { ConsentOutdatedError } from './errors';
import {
  type NewOffer,
  type NewRegistration,
  UNIVERSITY_DOCUMENTS_ADULT_CONSENT_VERSION,
  UNIVERSITY_DOCUMENTS_CONSENT_VERSION,
} from './store';
import { signIn, syntheticPhone, testDatabase, testStore } from './testing';

/**
 * Audit A11-13 (High). An offer letter or a proof of registration goes whole to the AI provider
 * outside South Africa, with whatever is printed on it (an ID or student number, a home address,
 * fees). Guardian consent before v3 and adult agreement before adult-v2 never named them. So the
 * database itself (migration 0021) refuses those uploads, and an offer or registration read from
 * one, unless the learner's recorded consent covers them; the store says so first, with a reason
 * the app can explain. A report, an offer in the learner's own word and modules typed by hand are
 * unaffected.
 */

let database: Database;
beforeAll(async () => {
  database = await testDatabase();
});
afterAll(async () => {
  await database.close();
});

const KINDS = ['acceptance-letter', 'proof-of-registration'] as const;

const OFFER: NewOffer = {
  universityId: 'uj',
  programmeId: 'uj-beng-civil',
  kind: 'provisional',
  replyBy: null,
  conditions: [],
};

const REGISTRATION: NewRegistration = {
  universityId: 'up',
  programmeId: 'up-bsc-test',
  academicYear: 2027,
  yearOfStudy: 1,
  modules: [{ code: 'TEST101', name: null, term: null, credits: null }],
};

const upload = (kind: string) => ({
  kind,
  storageKey: `${kind}-${crypto.randomUUID()}`,
  mimeType: 'application/pdf',
  sizeBytes: 10,
});

/** A minor whose guardian agreed to `version` of the consent wording. */
async function minorUnder(version: string) {
  const { store } = testStore(database);
  const { studentId } = await signIn(store, syntheticPhone());
  await store.setDateOfBirth(studentId, '2010-03-03');
  const { token } = await store.requestGuardianConsent(
    studentId,
    { name: 'Test Guardian', phone: syntheticPhone(), relationship: 'parent' },
    version,
  );
  await store.grantConsent(token);
  return { store, studentId, student: store.forStudent(studentId) };
}

/** An adult who agreed in their own name to `version` of the wording. */
async function adultUnder(version: string) {
  const { store } = testStore(database);
  const { studentId } = await signIn(store, syntheticPhone());
  await store.setDateOfBirth(studentId, '2000-01-15');
  await store.consentAsAdult(studentId, version);
  return { store, studentId, student: store.forStudent(studentId) };
}

/** Inserts a document as the database owner, past every check in the store. */
function rawInsert(studentId: string, kind: string) {
  return database.exec(
    `insert into documents (student_id, kind, storage_key, mime_type, size_bytes)
     values ('${studentId}', '${kind}', 'raw-${crypto.randomUUID()}', 'application/pdf', 10)`,
  );
}

describe('A11-13: letters and proofs need consent wording that names them', () => {
  it('the versions that first named them', () => {
    expect(UNIVERSITY_DOCUMENTS_CONSENT_VERSION).toBe(3);
    expect(UNIVERSITY_DOCUMENTS_ADULT_CONSENT_VERSION).toBe(2);
  });

  it('refuses a minor under guardian v2 both uploads, in the store and in the database itself', async () => {
    const { studentId, student } = await minorUnder('v2-2026-10');
    for (const kind of KINDS) {
      await expect(student.addDocument(upload(kind)), kind).rejects.toThrow(ConsentOutdatedError);
      await expect(student.addDocument(upload(kind)), kind).rejects.toMatchObject({
        purpose: 'university-documents',
      });
      await expect(rawInsert(studentId, kind), kind).rejects.toThrow(/consent/i);
    }
    // A report is covered by v2, as before.
    expect(await student.addDocument(upload('grade-11-report'))).toMatchObject({
      kind: 'grade-11-report',
    });
    expect(await student.documents()).toHaveLength(1);
  });

  it('refuses an adult under adult-v1 both uploads, in the store and in the database itself', async () => {
    const { studentId, student } = await adultUnder('adult-v1-2026-10');
    for (const kind of KINDS) {
      await expect(student.addDocument(upload(kind)), kind).rejects.toThrow(ConsentOutdatedError);
      await expect(rawInsert(studentId, kind), kind).rejects.toThrow(/consent/i);
    }
  });

  it('accepts both under guardian v3 and under adult-v2', async () => {
    for (const { studentId, student } of [
      await minorUnder('v3-2026-10'),
      await adultUnder('adult-v2-2026-10'),
    ]) {
      for (const kind of KINDS) {
        expect(await student.addDocument(upload(kind))).toMatchObject({ kind });
        await rawInsert(studentId, kind);
      }
    }
  });

  it('a document can’t be turned into a letter or proof afterwards', async () => {
    const { student } = await minorUnder('v2-2026-10');
    const report = await student.addDocument(upload('grade-11-report'));
    await expect(
      database.exec(`update documents set kind = 'acceptance-letter' where id = '${report?.id}'`),
    ).rejects.toThrow(/consent/i);
  });

  it('an offer or registration from a letter or proof needs it too; the learner’s own word does not', async () => {
    // A letter and a proof uploaded before this rule existed: simulated by uploading them under
    // v3 and then setting the recorded version back to v2.
    const { studentId, student } = await minorUnder('v3-2026-10');
    const letter = await student.addDocument(upload('acceptance-letter'));
    const proof = await student.addDocument(upload('proof-of-registration'));
    await database.exec(
      `update guardian_consents set consent_version = 'v2-2026-10' where student_id = '${studentId}'`,
    );
    await expect(student.addOffer({ ...OFFER, documentId: letter?.id ?? null })).rejects.toThrow(
      ConsentOutdatedError,
    );
    await expect(
      student.saveRegistration({ ...REGISTRATION, documentId: proof?.id ?? null }),
    ).rejects.toThrow(ConsentOutdatedError);
    // In the database itself.
    await expect(
      database.exec(
        `insert into offers (student_id, university_id, programme_id, kind, source, document_id, created_at, updated_at)
         values ('${studentId}', 'uj', 'uj-beng-civil', 'final', 'letter', '${letter?.id}', now(), now())`,
      ),
    ).rejects.toThrow(/consent/i);
    await expect(
      database.exec(
        `insert into registrations (student_id, university_id, programme_id, academic_year, modules, document_id, confirmed_at, updated_at)
         values ('${studentId}', 'up', 'up-bsc-test', 2027, '[{"code":"TEST101"}]', '${proof?.id}', now(), now())`,
      ),
    ).rejects.toThrow(/consent/i);
    // Their own word, and modules typed by hand, are not read from a document.
    await student.addOffer(OFFER);
    await student.saveRegistration(REGISTRATION);
    expect(await student.offers()).toHaveLength(1);
    // Deleting the document still works (the foreign keys set null).
    await student.deleteDocument(letter?.id ?? '');
  });

  it('asks an adult who agreed to adult-v1 to agree again; the new agreement covers the uploads', async () => {
    const { store, studentId, student } = await adultUnder('adult-v1-2026-10');
    expect((await store.account(studentId)).needsAdultConsent).toBe(true);
    await store.consentAsAdult(studentId, 'adult-v2-2026-10');
    expect((await store.account(studentId)).needsAdultConsent).toBe(false);
    expect(await student.addDocument(upload('acceptance-letter'))).toMatchObject({
      kind: 'acceptance-letter',
    });
  });
});
