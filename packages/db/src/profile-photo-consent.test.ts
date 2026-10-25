import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from './client';
import { rowsOf } from './client';
import { ConsentRequiredError, PhotoConsentError } from './errors';
import { PHOTO_ADULT_CONSENT_VERSION, PHOTO_CONSENT_VERSION } from './photo';
import { signIn, syntheticPhone, testDatabase, testStore } from './testing';

/**
 * A11-31 (migration 0037). The profile photo was held back only by a server switch. Now the
 * database itself refuses to keep a learner's photo, and the store refuses to serve one, unless the
 * consent that covers the learner names the photo: their guardian's at v4 or later for a minor, or
 * their own agreement at adult-v3 or later for an adult (docs/legal/consent-v4-draft.md, C5; owed
 * legal review, not live). The owner's preview (`uf.profile_photo`, UF_PROFILE_PHOTO while the live
 * wording is older) stands in for the wording only, never for consent itself. Removing a photo is
 * always allowed (A11-32). A photo kept under older wording is never served, and goes when the
 * learner removes it, when their guardian withdraws, or with the account; the learner's own export
 * still includes it (POPIA s23: what is held is theirs).
 */

let database: Database;
beforeAll(async () => {
  database = await testDatabase();
});
afterAll(async () => {
  await database.close();
});

const LIVE = { preview: false } as const;
const PREVIEW = { preview: true } as const;

let next = 0x37_0000;
/** A storage key of the shape the app makes, synthetic. */
const key = () => `photo-${(next++).toString(16).padStart(32, '0')}`;

/** A minor whose guardian agreed to `version` of the consent wording. */
async function minorUnder(version: string) {
  const h = testStore(database);
  const { studentId } = await signIn(h.store, syntheticPhone());
  await h.store.setDateOfBirth(studentId, '2010-03-03');
  const { token } = await h.store.requestGuardianConsent(
    studentId,
    { name: 'Test Guardian', phone: syntheticPhone(), relationship: 'parent' },
    version,
  );
  await h.store.grantConsent(token);
  return { ...h, studentId, token, student: h.store.forStudent(studentId) };
}

/** An adult who agreed in their own name to `version` of the wording. */
async function adultUnder(version: string) {
  const h = testStore(database);
  const { studentId } = await signIn(h.store, syntheticPhone());
  await h.store.setDateOfBirth(studentId, '2000-01-15');
  await h.store.consentAsAdult(studentId, version);
  return { ...h, studentId, student: h.store.forStudent(studentId) };
}

/** The stored key, read as the database owner (past every check). */
async function storedKey(studentId: string) {
  const [row] = rowsOf<{ photo_key: string | null }>(
    await database.db.execute(
      sql`select photo_key from profiles where student_id = ${studentId}::uuid`,
    ),
  );
  return row?.photo_key ?? null;
}

/** Writes a key as the database owner, past the store. */
function rawSet(studentId: string, value: string | null, preview = false) {
  const set = value === null ? 'null' : `'${value}'`;
  const flag = preview ? `select set_config('uf.profile_photo', 'preview', true);` : '';
  return database.exec(
    `begin; ${flag}
     insert into profiles (student_id, photo_key) values ('${studentId}', ${set})
       on conflict (student_id) do update set photo_key = ${set};
     commit;`,
  );
}

describe('A11-31: the photo needs consent wording that names it (0037)', () => {
  it('the versions that first name it: guardian v4 and adult-v3', () => {
    expect(PHOTO_CONSENT_VERSION).toBe(4);
    expect(PHOTO_ADULT_CONSENT_VERSION).toBe(3);
  });

  it('refuses a minor under guardian v3 a photo, in the store and in the database itself', async () => {
    const { studentId, student } = await minorUnder('v3-2026-10');
    expect(await student.photoAllowed(LIVE)).toBe(false);
    await expect(student.setPhoto(key(), LIVE)).rejects.toThrow(PhotoConsentError);
    await expect(rawSet(studentId, key())).rejects.toThrow(/consent/i);
    await database.exec('rollback');
    expect(await storedKey(studentId)).toBeNull();
  });

  it('refuses an adult under adult-v2 a photo, in the store and in the database itself', async () => {
    const { studentId, student } = await adultUnder('adult-v2-2026-10');
    expect(await student.photoAllowed(LIVE)).toBe(false);
    await expect(student.setPhoto(key(), LIVE)).rejects.toThrow(PhotoConsentError);
    await expect(rawSet(studentId, key())).rejects.toThrow(/consent/i);
    await database.exec('rollback');
    expect(await storedKey(studentId)).toBeNull();
  });

  it('keeps and serves it under guardian v4 and under adult-v3', async () => {
    for (const { student } of [
      await minorUnder('v4-2027-01'),
      await adultUnder('adult-v3-2027-01'),
    ]) {
      expect(await student.photoAllowed(LIVE)).toBe(true);
      const photo = key();
      expect(await student.setPhoto(photo, LIVE)).toBeNull();
      expect(await student.photoKey(LIVE)).toBe(photo);
    }
  });

  it('reads the version the guardian agreed to, whatever else is set', async () => {
    const { studentId, student } = await minorUnder('v4-2027-01');
    // The same grant, recorded at v3: the wording on record decides, not a switch.
    await database.exec(
      `update guardian_consents set consent_version = 'v3-2026-10' where student_id = '${studentId}'`,
    );
    expect(await student.photoAllowed(LIVE)).toBe(false);
    await expect(rawSet(studentId, key())).rejects.toThrow(/consent/i);
    await database.exec('rollback');
  });

  it('a guardian’s v4 stops covering a learner at 18: they agree in their own name first', async () => {
    const { studentId } = await minorUnder('v4-2027-01');
    // The same learner, now an adult on a guardian's consent (consent_status still 'granted').
    await database.exec(
      `update students set date_of_birth = '2000-01-15' where id = '${studentId}'`,
    );
    await expect(rawSet(studentId, key())).rejects.toThrow(/consent/i);
    await database.exec('rollback');
  });

  it('never before consent at all, whatever the preview says (hard rule 5)', async () => {
    const h = testStore(database);
    const { studentId } = await signIn(h.store, syntheticPhone());
    await h.store.setDateOfBirth(studentId, '2010-03-03');
    const student = h.store.forStudent(studentId);
    await expect(student.photoAllowed(PREVIEW)).rejects.toThrow(ConsentRequiredError);
    await expect(student.setPhoto(key(), PREVIEW)).rejects.toThrow(ConsentRequiredError);
    await expect(rawSet(studentId, key(), true)).rejects.toThrow(/consent/i);
    await database.exec('rollback');
  });

  it('the owner’s preview stands in for the wording, for its own transaction only', async () => {
    const { studentId, student } = await adultUnder('adult-v2-2026-10');
    expect(await student.photoAllowed(PREVIEW)).toBe(true);
    const photo = key();
    await student.setPhoto(photo, PREVIEW);
    expect(await student.photoKey(PREVIEW)).toBe(photo);
    // The flag is local to a transaction: the next one, without it, is refused.
    await rawSet(studentId, key(), true);
    await expect(rawSet(studentId, key())).rejects.toThrow(/consent/i);
    await database.exec('rollback');
  });
});

describe('a photo kept under older wording (0037’s rule for what is there already)', () => {
  /** An adult-v2 learner whose photo was kept in the owner's preview before 0037. */
  async function keptInPreview() {
    const learner = await adultUnder('adult-v2-2026-10');
    const photo = key();
    await learner.student.setPhoto(photo, PREVIEW);
    return { ...learner, photo };
  }

  it('is never served without wording that names it, though it is still held', async () => {
    const { studentId, student, photo } = await keptInPreview();
    expect(await student.photoKey(LIVE)).toBeNull();
    expect(await storedKey(studentId)).toBe(photo);
  });

  it('is in the learner’s own export (what is held is theirs), never its key in the profile', async () => {
    const { student, photo } = await keptInPreview();
    expect(await student.heldPhotoKey()).toBe(photo);
    const exported = await student.exportAll();
    expect(exported.personal?.profile).toMatchObject({ hasPhoto: true });
    expect(JSON.stringify(exported)).not.toContain(photo);
  });

  it('can be replaced only under wording that names it, and always removed (A11-32)', async () => {
    const { studentId, student, photo } = await keptInPreview();
    await expect(student.setPhoto(key(), LIVE)).rejects.toThrow(PhotoConsentError);
    // Clearing it is never refused, even by the database owner's own write.
    await rawSet(studentId, null);
    await rawSet(studentId, photo, true);
    expect(await student.removePhoto()).toBe(photo);
    expect(await storedKey(studentId)).toBeNull();
  });

  it('goes with the account', async () => {
    const { student, photo } = await keptInPreview();
    expect(await student.deleteAccount()).toEqual([photo]);
  });
});

describe('a guardian’s withdrawal deletes the photo', () => {
  it('clears it in the same transaction and hands back its key, so the file goes too', async () => {
    const { store, studentId, token, student } = await minorUnder('v4-2027-01');
    const photo = key();
    await student.setPhoto(photo, LIVE);
    const withdrawn = await store.withdrawConsent(token);
    expect(withdrawn.fileKeys).toEqual([photo]);
    expect(withdrawn.jobIds).toEqual([]);
    expect(await storedKey(studentId)).toBeNull();
  });

  it('hands back no key when there was no photo', async () => {
    const { store, token } = await minorUnder('v4-2027-01');
    expect((await store.withdrawConsent(token)).fileKeys).toEqual([]);
  });
});
