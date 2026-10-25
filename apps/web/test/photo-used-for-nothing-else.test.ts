import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { catalogueView } from '@universityflow/catalogue';
import { MemoryCvEngine } from '@universityflow/cv';
import {
  type Database,
  migrate,
  openDatabase,
  PostgresJobScheduler,
  Store,
} from '@universityflow/db';
import { MemoryFileStore } from '@universityflow/documents';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { cvJobHandlers, scheduleCvDocument } from '../lib/server/cv';

vi.mock('server-only', () => ({}));

/**
 * "As long as the picture is not used for anything else" (the owner's condition, 2026-10-23; A11-31).
 * The learner's photo is shown to them alone, on their About me card. These tests fail the day any
 * other path picks it up:
 *
 * 1. Only the photo's own code reads it: the store's photo methods, /api/me/photo, /api/me and the
 *    About me page (whether there is one), the learner's export and the account deletion. Any
 *    other file naming the photo's key, its store methods or its route fails here. (A grep guard:
 *    a new caller must be added below on purpose, where a reviewer sees it.)
 * 2. The places it must never reach name nothing of it: the AI (packages/agent, the agent's
 *    context, the document readers), My CV and Mmereko (packages/cv, the CV jobs, the recruiter
 *    share page), jobs and messaging (packages/jobs, packages/messaging), the guardian's consent
 *    page, and the home.
 * 3. Behaviour: a learner with a photo makes a CV; the envelope Mmereko receives, and every job
 *    payload, carry nothing of the photo.
 *
 * The chat, the agent's context and the logs are proven in api-profile-photo.test.ts ("never sent
 * to the AI"), deletion with the account and on a guardian's withdrawal there and in
 * api-photo-consent.test.ts.
 */

const ROOT = join(import.meta.dirname, '..', '..', '..');

/** Source files under `dir` (relative to the repo), tests, E2E and builds left out. */
function sources(dir: string): string[] {
  const out: string[] = [];
  const walk = (path: string) => {
    for (const name of readdirSync(path)) {
      if (
        ['node_modules', '.next', '.turbo', 'coverage', 'e2e', '__tests__', 'test'].includes(name)
      )
        continue;
      const full = join(path, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.(ts|tsx|mjs)$/.test(name) && !/\.(test|spec|contract)\.tsx?$/.test(name))
        out.push(relative(ROOT, full).split(sep).join('/'));
    }
  };
  walk(join(ROOT, dir));
  return out;
}

const ALL = [
  ...sources('apps/web/app'),
  ...sources('apps/web/lib'),
  ...sources('apps/web/components'),
  ...sources('apps/native/app'),
  ...sources('apps/native/components'),
  ...sources('apps/native/lib'),
  ...readdirSync(join(ROOT, 'packages'))
    .filter((p) => existsSync(join(ROOT, 'packages', p, 'src')))
    .flatMap((p) => sources(`packages/${p}/src`)),
];

/** The photo's key, its store methods, its route: what reading or keeping the photo needs. */
const PHOTO_USE =
  /\b(photoKey|heldPhotoKey|setPhoto|removePhoto|photoAllowed|exportedPhoto|newPhotoKey|photoState|photoAccess|servablePhotoKey|PHOTO_LIVE)\b|photo_key|\/api\/me\/photo/;

/** Every file allowed to touch the photo, and why. Adding one is a decision a reviewer sees. */
const ALLOWED: Readonly<Record<string, string>> = {
  'packages/db/src/schema.ts': 'the column',
  'packages/db/src/store.ts': 'the photo methods, account deletion, a guardian’s withdrawal',
  'packages/db/src/photo.ts': 'the consent rule (0037)',
  'packages/db/src/index.ts': 'exports',
  'packages/db/src/migrations/0029_profile_photo.ts': 'the column',
  'packages/db/src/migrations/0037_profile_photo_consent.ts': 'the consent rule',
  'apps/web/lib/server/profile-photo.ts': 'the server side: state, access, the export',
  'apps/web/lib/server/keys.ts': 'makes a new key',
  'apps/web/lib/server/config.ts': 'the switch (a comment names the route)',
  'apps/web/app/api/me/photo/route.ts': 'upload, serve to its owner, remove',
  'apps/web/app/api/me/route.ts': 'whether a photo is offered, its version',
  'apps/web/app/api/me/export/route.ts': 'the learner’s own export (POPIA s23)',
  'apps/web/app/(app)/me/page.tsx': 'About me: whether a photo is offered',
  'apps/web/app/(app)/me/profile-photo.tsx': 'About me: the learner’s own photo control',
  'apps/native/lib/photo.ts': 'the app’s About me: the learner’s own photo',
};

/** Where the photo must never go, whatever the code around it does. */
const NEVER = [
  'packages/agent/src',
  'packages/cv/src',
  'packages/jobs/src',
  'packages/messaging/src',
  'apps/web/app/cv',
  'apps/web/app/api/me/cv',
  'apps/web/app/consent',
  'apps/web/app/api/chat',
  'apps/web/app/api/documents',
  'apps/web/lib/server/agent-context.ts',
  'apps/web/lib/server/cv.ts',
  'apps/web/lib/server/cv-routes.ts',
  'apps/web/lib/server/home.ts',
];
const PHOTO_WORDS = /profile[ -]?photo|profilePhoto|hasPhoto|photoKey|photo_key|\/api\/me\/photo/i;

describe('only the photo’s own code reads it (grep guard)', () => {
  it('finds the source files to check (the guard can’t pass on an empty list)', () => {
    expect(ALL.length).toBeGreaterThan(200);
    expect(ALL).toContain('apps/web/app/api/me/photo/route.ts');
    expect(ALL).toContain('packages/agent/src/index.ts');
  });

  it('no file outside the allowed list names the photo’s key, its store methods or its route', () => {
    const users = ALL.filter((f) => PHOTO_USE.test(readFileSync(join(ROOT, f), 'utf8')));
    expect(users.filter((f) => !(f in ALLOWED))).toEqual([]);
    // And the list holds no stale entry, so it stays a true picture of who reads it.
    expect(Object.keys(ALLOWED).filter((f) => !users.includes(f))).toEqual([]);
  });

  it('the AI, My CV, jobs, messaging, the share page, the consent page and the home name nothing of it', () => {
    const checked = ALL.filter((f) => NEVER.some((n) => f === n || f.startsWith(`${n}/`)));
    expect(checked).toContain('apps/web/app/cv/s/[token]/route.ts');
    expect(checked).toContain('apps/web/lib/server/agent-context.ts');
    const named = checked.filter((f) => PHOTO_WORDS.test(readFileSync(join(ROOT, f), 'utf8')));
    expect(named).toEqual([]);
  });

  it('proves itself: the guard notices a new reader', () => {
    expect(PHOTO_USE.test('const key = await student.photoKey(access);')).toBe(true);
    expect(PHOTO_USE.test('select photo_key from profiles')).toBe(true);
    expect(PHOTO_USE.test("fetch('/api/me/photo')")).toBe(true);
    expect(PHOTO_USE.test('setPhotoVersion(next)')).toBe(false);
    expect(PHOTO_WORDS.test('const { hasPhoto } = profile;')).toBe(true);
  });
});

describe('a learner with a photo makes a CV: Mmereko and the jobs get nothing of it', () => {
  const PREVIEW = { preview: true } as const;
  const now = new Date('2026-10-23T08:00:00Z');
  const clock = () => now;
  let database: Database;
  let store: Store;
  beforeAll(async () => {
    database = openDatabase('pglite:memory');
    await migrate(database);
    store = new Store(database, { secret: 'x'.repeat(48), clock });
  });
  afterAll(async () => {
    await database.close();
  });

  it('the envelope and every job payload carry no key, version or picture', async () => {
    const number = `+2782${String(6_370_001).padStart(7, '0')}`;
    const challenge = await store.requestOtp(number);
    if (challenge.review) throw new Error('unexpected');
    const { studentId } = await store.verifyOtp(number, challenge.code);
    await store.setDateOfBirth(studentId, '2000-01-15');
    await store.consentAsAdult(studentId, 'adult-v3-test');
    const student = store.forStudent(studentId);
    await student.updateProfile({ displayName: 'Thandi', schoolName: 'Example High School' });
    const photoKey = `photo-${'ab'.repeat(16)}`;
    await student.setPhoto(photoKey);
    expect(await student.photoKey()).toBe(photoKey);

    await student.cvOptIn(
      { version: 'cv-optin-v1', purposes: ['cv.draft', 'cv.tailor', 'cv.ats'] },
      PREVIEW,
    );
    await student.saveCvSelection(
      {
        surname: 'Example',
        label: null,
        summary: null,
        email: null,
        phone: null,
        city: null,
        region: null,
        includeSchool: true,
        subjectIds: [],
        includeOffer: false,
        moduleCodes: [],
        entryIds: [],
      },
      PREVIEW,
    );
    const engine = new MemoryCvEngine({ clock });
    const scheduler = new PostgresJobScheduler(database, { clock });
    const scheduled = vi.spyOn(scheduler, 'schedule');
    const doc = await student.requestCvDocument({ kind: 'draft' }, PREVIEW);
    await scheduleCvDocument(scheduler, doc.id);
    const sent = vi.spyOn(engine, 'createDraft');
    await scheduler.runDue(
      cvJobHandlers({
        store,
        engine,
        files: new MemoryFileStore(),
        scheduler,
        catalogue: () => catalogueView(now, { includeDrafts: true }),
        access: PREVIEW,
        clock,
      }),
    );
    expect(sent).toHaveBeenCalledTimes(1);
    const envelope = JSON.stringify(sent.mock.calls[0]);
    expect(envelope).toContain('Thandi'); // the CV was made from the profile…
    expect(envelope).not.toContain(photoKey); // …with nothing of the photo
    expect(envelope).not.toMatch(/photo|hasPhoto|image\/jpeg|avatar/i);

    // Every job scheduled on the way (the submit, its polls, the expiry): ids only.
    const payloads = JSON.stringify(
      scheduled.mock.calls.map(([options]) => ({
        kind: options.kind.name,
        payload: options.payload,
      })),
    );
    expect(payloads).toContain('cv.submit');
    expect(payloads).toContain('cv.poll');
    expect(payloads).not.toContain(photoKey);
    expect(payloads).not.toMatch(/photo/i);
  });
});
