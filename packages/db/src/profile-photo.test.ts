import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Database } from './client';
import { rowsOf } from './client';
import { ConsentRequiredError } from './errors';
import type { Store } from './store';
import { signIn, syntheticPhone, testDatabase, testStore } from './testing';

/**
 * An adult who agreed in their own name to wording that names the photo (adult-v3, migration
 * 0037; a test version, as the live wording is still adult-v2).
 */
async function photoAdult(store: Store) {
  const session = await signIn(store);
  await store.setDateOfBirth(session.studentId, '2000-01-15');
  await store.consentAsAdult(session.studentId, 'adult-v3-test');
  return session;
}

/**
 * The profile photo in the data layer (migration 0029, profile-look-proposal §5.3): one key per
 * learner, which never leaves the server; replacing or removing it hands back the old key so the
 * file goes too; it goes with the account; nothing before consent (hard rule 5); and one learner
 * never reaches another's.
 */

let database: Database;
let h: ReturnType<typeof testStore>;

beforeAll(async () => {
  database = await testDatabase();
});
afterAll(async () => {
  await database.close();
});
beforeEach(() => {
  h = testStore(database);
});

let next = 0;
/** A storage key of the shape the app makes (`photo-` and 32 hex digits), synthetic. */
const key = () => `photo-${(next++).toString(16).padStart(32, '0')}`;

describe('the profile photo (0029)', () => {
  it('keeps one photo, says only whether there is one, and hands back the key it replaces', async () => {
    const { studentId } = await photoAdult(h.store);
    const student = h.store.forStudent(studentId);
    expect(await student.photoKey()).toBeNull();
    const first = key();
    expect(await student.setPhoto(first)).toBeNull();
    expect(await student.photoKey()).toBe(first);
    const profile = await student.profile();
    expect(profile).toMatchObject({ hasPhoto: true });
    // The key itself never comes out with the profile (it would reach the browser and the app).
    expect(JSON.stringify(profile)).not.toContain(first);
    expect(profile).not.toHaveProperty('photoKey');

    const second = key();
    expect(await student.setPhoto(second)).toBe(first);
    expect(await student.photoKey()).toBe(second);
    // Saving the rest of the profile leaves the photo alone, and doesn't show its key either.
    const updated = await student.updateProfile({ displayName: 'Synthetic' });
    expect(JSON.stringify(updated)).not.toContain(second);
    expect(await student.photoKey()).toBe(second);
  });

  it('removes it in one go, and says there was nothing to remove the second time', async () => {
    const { studentId } = await photoAdult(h.store);
    const student = h.store.forStudent(studentId);
    const photo = key();
    await student.setPhoto(photo);
    expect(await student.removePhoto()).toBe(photo);
    expect(await student.photoKey()).toBeNull();
    expect(await student.profile()).toMatchObject({ hasPhoto: false });
    expect(await student.removePhoto()).toBeNull();
  });

  it('records each change in the access history, by id only', async () => {
    const { studentId } = await photoAdult(h.store);
    const student = h.store.forStudent(studentId);
    const photo = key();
    await student.setPhoto(photo);
    await student.removePhoto();
    const { accessHistory } = await student.exportAll();
    const actions = accessHistory.map((a) => a.action);
    expect(actions).toContain('profile.photo-set');
    expect(actions).toContain('profile.photo-removed');
    expect(JSON.stringify(accessHistory)).not.toContain(photo);
  });

  it('exports that there is a photo, never its key', async () => {
    const { studentId } = await photoAdult(h.store);
    const student = h.store.forStudent(studentId);
    const photo = key();
    await student.setPhoto(photo);
    const exported = await student.exportAll();
    expect(exported.personal?.profile).toMatchObject({ hasPhoto: true });
    expect(JSON.stringify(exported)).not.toContain(photo);
  });

  it('goes with the account: its key is returned so the file is deleted too', async () => {
    const { studentId } = await photoAdult(h.store);
    const student = h.store.forStudent(studentId);
    await student.addDocument({
      kind: 'grade-11-report',
      storageKey: 'doc-photo-test-1',
      mimeType: 'image/png',
      sizeBytes: 5,
    });
    const photo = key();
    await student.setPhoto(photo);
    expect((await student.deleteAccount()).sort()).toEqual(['doc-photo-test-1', photo].sort());
  });

  it('is deleted with the account even after consent is withdrawn', async () => {
    const { studentId } = await signIn(h.store, syntheticPhone(901));
    await h.store.setDateOfBirth(studentId, '1999-01-01');
    const student = h.store.forStudent(studentId);
    // An adult who agreed, set a photo, and whose consent row is then gone: the key is still found.
    await h.store.consentAsAdult(studentId, 'adult-v3-test');
    const photo = key();
    await student.setPhoto(photo);
    await database.exec(
      `update students set adult_consent_version = null, adult_consented_at = null where id = '${studentId}'`,
    );
    expect(await student.mayProcess()).toBe(false);
    expect(await student.deleteAccount()).toEqual([photo]);
  });

  it('touches nothing before a guardian consents (hard rule 5)', async () => {
    const { studentId } = await signIn(h.store, syntheticPhone(902));
    await h.store.setDateOfBirth(studentId, '2010-03-03');
    const student = h.store.forStudent(studentId);
    await expect(student.setPhoto(key())).rejects.toThrow(ConsentRequiredError);
    await expect(student.photoKey()).rejects.toThrow(ConsentRequiredError);
    // Removing is the one thing allowed (A11-32): nothing to remove here, and nothing is refused.
    expect(await student.removePhoto()).toBeNull();
  });

  it('can always be removed, after consent is withdrawn or has lapsed too (A11-32)', async () => {
    const { studentId } = await signIn(h.store, syntheticPhone(903));
    await h.store.setDateOfBirth(studentId, '1999-01-01');
    await h.store.consentAsAdult(studentId, 'adult-v3-test');
    const student = h.store.forStudent(studentId);
    const photo = key();
    await student.setPhoto(photo);
    await database.exec(
      `update students set adult_consent_version = null, adult_consented_at = null where id = '${studentId}'`,
    );
    expect(await student.mayProcess()).toBe(false);
    // Still nothing else: the photo can't be read or replaced without consent.
    await expect(student.photoKey()).rejects.toThrow(ConsentRequiredError);
    await expect(student.setPhoto(key())).rejects.toThrow(ConsentRequiredError);
    expect(await student.removePhoto()).toBe(photo);
    const [row] = rowsOf<{ photo_key: string | null }>(
      await database.db.execute(
        sql`select photo_key from profiles where student_id = ${studentId}::uuid`,
      ),
    );
    expect(row?.photo_key).toBeNull();
    expect(await student.removePhoto()).toBeNull();
    // Another learner's photo is never touched by it.
    const other = await photoAdult(h.store);
    const theirs = key();
    await h.store.forStudent(other.studentId).setPhoto(theirs);
    expect(await student.removePhoto()).toBeNull();
    expect(await h.store.forStudent(other.studentId).photoKey()).toBe(theirs);
  });

  it('never reaches another learner’s photo, even from raw SQL', async () => {
    const a = await photoAdult(h.store);
    const b = await photoAdult(h.store);
    const photo = key();
    await h.store.forStudent(b.studentId).setPhoto(photo);
    expect(await h.store.forStudent(a.studentId).photoKey()).toBeNull();
    // A's own remove leaves B's photo where it is.
    expect(await h.store.forStudent(a.studentId).removePhoto()).toBeNull();
    expect(await h.store.forStudent(b.studentId).photoKey()).toBe(photo);
    const seen = await h.database.db.transaction(async (tx) => {
      await tx.execute(sql`select set_config('uf.student_id', ${a.studentId}, true)`);
      await tx.execute(sql`set local role uf_app`);
      return rowsOf<{ n: number }>(
        await tx.execute(
          sql`select count(*)::int as n from profiles where photo_key is not null and student_id = ${b.studentId}::uuid`,
        ),
      );
    });
    expect(seen[0]?.n).toBe(0);
  });

  it('holds only a key the app made, at the database', async () => {
    const { studentId } = await photoAdult(h.store);
    const student = h.store.forStudent(studentId);
    await student.updateProfile({ displayName: 'Synthetic' });
    for (const value of [`'../other/file'`, `'doc-0123'`, `'photo-Thando.jpg'`, `''`]) {
      await expect(
        database.exec(`update profiles set photo_key = ${value} where student_id = '${studentId}'`),
        value,
      ).rejects.toThrow();
    }
    await expect(student.setPhoto('photo-not-hex')).rejects.toThrow();
  });
});
