import { en } from '@universityflow/content';
import { CV_LIMITS, holdsPersonalNumber as cvHoldsPersonalNumber } from '@universityflow/cv';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type Database, rowsOf } from './client';
import {
  CV_ADULT_CONSENT_VERSION,
  CV_CONSENT_VERSION,
  CV_ENTRY_LIMIT,
  type CvAccess,
  type CvEntryInput,
} from './cv';
import {
  ConsentRequiredError,
  CvBusyError,
  CvConsentError,
  CvShareError,
  NotFoundError,
  PersonalNumberError,
} from './errors';
import { adultConsentVersionNumber, consentVersionNumber, holdsPersonalNumber } from './store';
import { signIn, syntheticPhone, testDatabase, testStore } from './testing';

/**
 * My CV (migration 0035, docs/design/mmereko-api-proposal.md §9, §10.4). Nothing about a learner's
 * CV is written until their consent wording names Mmereko (guardian v4, adult-v3; D8) and they
 * opted in themselves; the store refuses with a reason and the database refuses whatever the code
 * does. Recruiter links only from 18, in the learner's own name (§9.3), in the database. Entries
 * hold no ID or student number (A11-17). Withdrawal and account deletion leave a tombstone with
 * no link to the student (§7.3). Synthetic learners only (hard rule 4).
 */

let database: Database;
beforeAll(async () => {
  database = await testDatabase();
});
afterAll(async () => {
  await database.close();
});

const LIVE: CvAccess = { preview: false };
const PREVIEW: CvAccess = { preview: true };
const BASE_PURPOSES = ['cv.draft', 'cv.tailor', 'cv.ats'] as const;
const OPT_IN = { version: 'cv-optin-v1', purposes: [...BASE_PURPOSES] };

const PROJECT: CvEntryInput = {
  kind: 'project',
  title: 'Campus bus tracker',
  organisation: null,
  role: 'Solo developer',
  startDate: '2027-03',
  endDate: null,
  description: 'Shows when the next bus leaves.',
  highlights: ['Used by my residence'],
  keywords: ['Python'],
  evidence: [{ kind: 'repository', url: 'https://github.com/example-learner/bus', label: null }],
  linkedModules: [],
};

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
  return { store, studentId, student: store.forStudent(studentId), token };
}

async function adultUnder(version: string) {
  const { store } = testStore(database);
  const { studentId } = await signIn(store, syntheticPhone());
  await store.setDateOfBirth(studentId, '2000-01-15');
  await store.consentAsAdult(studentId, version);
  return { store, studentId, student: store.forStudent(studentId) };
}

async function optedInAdult() {
  const learner = await adultUnder('adult-v3-test');
  await learner.student.cvOptIn({ ...OPT_IN, purposes: [...BASE_PURPOSES, 'cv.share'] }, LIVE);
  return learner;
}

/** A ready, confirmed CV, written the way the collect job writes one. */
async function readyCv(learner: Awaited<ReturnType<typeof optedInAdult>>) {
  const doc = await learner.student.requestCvDocument({ kind: 'draft' }, LIVE);
  await learner.student.markCvSubmitted(doc.id, `job-${crypto.randomUUID()}`, LIVE);
  await learner.student.storeCvResult(
    doc.id,
    {
      markdown: '# Thandi Example\n',
      gaps: [],
      ats: null,
      fileKey: `cv-${crypto.randomUUID().replaceAll('-', '')}`,
      sha256: 'a'.repeat(64),
      bytes: 100,
    },
    LIVE,
  );
  await learner.student.confirmCvDocument(doc.id, LIVE);
  return doc.id;
}

/** Runs SQL as the database owner, past every check in the store. */
async function raw(statement: string) {
  return database.exec(statement);
}

async function count(table: string, where: string) {
  const [row] = rowsOf<{ n: number }>(
    await database.db.execute(sql.raw(`select count(*)::int as n from ${table} where ${where}`)),
  );
  return row?.n ?? 0;
}

describe('the wording that names Mmereko (D8)', () => {
  it('is guardian v4 and adult-v3, and the live wording is not bumped by this', () => {
    expect(CV_CONSENT_VERSION).toBe(4);
    expect(CV_ADULT_CONSENT_VERSION).toBe(3);
    expect(consentVersionNumber(en.consent.version)).toBeLessThan(CV_CONSENT_VERSION);
    expect(adultConsentVersionNumber(en.adultConsent.version)).toBeLessThan(
      CV_ADULT_CONSENT_VERSION,
    );
  });

  it('refuses the opt-in under v3 or adult-v2, with a reason', async () => {
    for (const learner of [await minorUnder('v3-test'), await adultUnder('adult-v2-test')]) {
      await expect(learner.student.cvOptIn(OPT_IN, LIVE)).rejects.toBeInstanceOf(CvConsentError);
      expect(await count('cv_links', `student_id = '${learner.studentId}'`)).toBe(0);
    }
  });

  it('takes the opt-in under v4 or adult-v3, and gives each learner their own Mmereko reference', async () => {
    const minor = await minorUnder('v4-test');
    const adult = await adultUnder('adult-v3-test');
    const a = await minor.student.cvOptIn(OPT_IN, LIVE);
    const b = await adult.student.cvOptIn(OPT_IN, LIVE);
    expect(a.purposes).toEqual([...BASE_PURPOSES]);
    const [refs] = rowsOf<{ a: string; b: string }>(
      await database.db.execute(
        sql`select (select learner_ref::text from cv_links where id = ${a.id}::uuid) as a,
                   (select learner_ref::text from cv_links where id = ${b.id}::uuid) as b`,
      ),
    );
    expect(refs?.a).toMatch(/^[0-9a-f-]{36}$/);
    expect(refs?.a).not.toBe(refs?.b);
    expect(refs?.a).not.toBe(minor.studentId);
  });

  it('lets the owner’s preview through under the old wording, and only it', async () => {
    const learner = await minorUnder('v3-test');
    await learner.student.cvOptIn(OPT_IN, PREVIEW);
    await learner.student.addCvEntry(PROJECT, PREVIEW);
    await expect(learner.student.addCvEntry(PROJECT, LIVE)).rejects.toBeInstanceOf(CvConsentError);
  });

  it('refuses entries and CV requests at the database under old wording, whatever the code does', async () => {
    const learner = await minorUnder('v3-test');
    await learner.student.cvOptIn(OPT_IN, PREVIEW);
    await expect(
      raw(
        `insert into cv_entries (student_id, kind, title) values ('${learner.studentId}', 'skill', 'Python')`,
      ),
    ).rejects.toThrow(/consent/);
    await expect(
      raw(`insert into cv_documents (student_id, kind) values ('${learner.studentId}', 'draft')`),
    ).rejects.toThrow(/consent/);
  });

  it('refuses everything without an opt-in, even under v4', async () => {
    const learner = await minorUnder('v4-test');
    await expect(learner.student.addCvEntry(PROJECT, LIVE)).rejects.toBeInstanceOf(CvConsentError);
    await expect(
      raw(
        `insert into cv_entries (student_id, kind, title) values ('${learner.studentId}', 'skill', 'Python')`,
      ),
    ).rejects.toThrow(/consent/);
  });

  it('refuses a guardian’s consent for an adult: from 18 they agree in their own name', async () => {
    const learner = await minorUnder('v4-test');
    await database.exec(
      `update students set date_of_birth = '2000-01-01' where id = '${learner.studentId}'`,
    );
    await expect(learner.student.cvOptIn(OPT_IN, LIVE)).rejects.toBeInstanceOf(
      ConsentRequiredError,
    );
  });
});

describe('the learner’s entries (§3.2)', () => {
  it('keeps an entry as given, and reads it back in order', async () => {
    const { student } = await optedInAdult();
    const saved = await student.addCvEntry(PROJECT, LIVE);
    await student.addCvEntry({ ...PROJECT, kind: 'skill', title: 'Programming' }, LIVE);
    const entries = await student.cvEntries();
    expect(entries.map((e) => e.title)).toEqual(['Campus bus tracker', 'Programming']);
    expect(entries[0]).toMatchObject({ ...PROJECT, id: saved.id, position: 0 });
  });

  it('refuses an ID or student number in the store and in the database (A11-17)', async () => {
    const { student, studentId } = await optedInAdult();
    const id = ['8', '0', '0', '1', '0', '1', '5', '0', '0', '9', '0', '8', '7'].join('');
    await expect(
      student.addCvEntry({ ...PROJECT, description: `My ID ${id}` }, LIVE),
    ).rejects.toBeInstanceOf(PersonalNumberError);
    await expect(
      raw(
        `insert into cv_entries (student_id, kind, title) values ('${studentId}', 'skill', 'student no ${'20'}41777')`,
      ),
    ).rejects.toThrow(/check/);
  });

  it('refuses markup, an http link and a title over its cap, in the database too', async () => {
    const { student, studentId } = await optedInAdult();
    await expect(student.addCvEntry({ ...PROJECT, title: '<b>x</b>' }, LIVE)).rejects.toThrow();
    await expect(
      student.addCvEntry(
        { ...PROJECT, evidence: [{ kind: 'demo', url: 'http://example.org', label: null }] },
        LIVE,
      ),
    ).rejects.toThrow();
    for (const statement of [
      `insert into cv_entries (student_id, kind, title) values ('${studentId}', 'skill', '${'x'.repeat(CV_LIMITS.title + 1)}')`,
      `insert into cv_entries (student_id, kind, title, evidence) values ('${studentId}', 'project', 'x', '[{"kind":"demo","url":"https://localhost/x"}]')`,
      `insert into cv_entries (student_id, kind, title, evidence) values ('${studentId}', 'project', 'x', '[{"kind":"demo","url":"https://192.0.2.1/x"}]')`,
      `insert into cv_entries (student_id, kind, title) values ('${studentId}', 'skill', '<script>')`,
    ]) {
      await expect(raw(statement)).rejects.toThrow(/check/);
    }
  });

  it('keeps at most 40 of a kind', async () => {
    const { student } = await optedInAdult();
    for (let i = 0; i < CV_ENTRY_LIMIT; i++) {
      await student.addCvEntry({ ...PROJECT, kind: 'skill', title: `Skill ${i}` }, LIVE);
    }
    await expect(
      student.addCvEntry({ ...PROJECT, kind: 'skill', title: 'One more' }, LIVE),
    ).rejects.toThrow();
  });

  it('shows no learner another’s entries, and lets none change them (row-level security)', async () => {
    const a = await optedInAdult();
    const b = await optedInAdult();
    const entry = await a.student.addCvEntry(PROJECT, LIVE);
    expect(await b.student.cvEntries()).toEqual([]);
    await expect(
      b.student.updateCvEntry(entry.id, { title: 'Mine now' }, LIVE),
    ).rejects.toBeInstanceOf(NotFoundError);
    await expect(b.student.deleteCvEntry(entry.id)).rejects.toBeInstanceOf(NotFoundError);
    expect((await a.student.cvEntries())[0]?.title).toBe('Campus bus tracker');
  });
});

describe('what goes on the CV (D9, D11)', () => {
  it('starts with nothing ticked, no marks and no contact details', async () => {
    const { student } = await optedInAdult();
    expect(await student.cvSelection()).toMatchObject({
      includeSchool: false,
      subjectIds: [],
      email: null,
      phone: null,
    });
  });

  it('keeps what was ticked and typed, and refuses a phone shaped like an ID number', async () => {
    const { student, studentId } = await optedInAdult();
    const saved = await student.saveCvSelection(
      {
        surname: 'Example',
        label: null,
        summary: null,
        email: 'thandi@example.org',
        phone: `080 ${'555'} ${'0101'}`,
        city: 'Durban',
        region: null,
        includeSchool: true,
        subjectIds: ['mathematics'],
        includeOffer: false,
        moduleCodes: [],
        entryIds: [],
      },
      LIVE,
    );
    expect(saved).toMatchObject({ surname: 'Example', subjectIds: ['mathematics'] });
    await expect(
      raw(`update cv_selections set phone = '9999999999999' where student_id = '${studentId}'`),
    ).rejects.toThrow(/check/);
  });
});

describe('making a CV (§5.3)', () => {
  it('queues one CV at a time, and keeps the advert only until the job ends (D13)', async () => {
    const learner = await optedInAdult();
    const doc = await learner.student.requestCvDocument(
      {
        kind: 'tailored',
        advert: { title: 'Junior developer', company: 'Example', text: 'Python please.' },
      },
      LIVE,
    );
    expect(doc).toMatchObject({
      kind: 'tailored',
      status: 'queued',
      advertTitle: 'Junior developer',
    });
    await expect(learner.student.requestCvDocument({ kind: 'draft' }, LIVE)).rejects.toBeInstanceOf(
      CvBusyError,
    );
    const submission = await learner.student.cvSubmission(doc.id, LIVE);
    expect(submission?.advert).toEqual({
      title: 'Junior developer',
      company: 'Example',
      description: 'Python please.',
    });
    expect(submission?.ageBand).toBe('18-plus');
    await learner.student.markCvSubmitted(doc.id, 'job-1', LIVE);
    await learner.student.storeCvResult(
      doc.id,
      {
        markdown: '# A\n',
        gaps: ['A gap'],
        ats: {
          coveragePct: 50,
          matched: ['python'],
          missing: ['docker'],
          missingMustHaves: [],
          flags: [],
        },
        fileKey: `cv-${'b'.repeat(32)}`,
        sha256: 'c'.repeat(64),
        bytes: 10,
      },
      LIVE,
    );
    const [row] = rowsOf<{ advert_text: string | null; status: string }>(
      await database.db.execute(
        sql`select advert_text, status from cv_documents where id = ${doc.id}::uuid`,
      ),
    );
    expect(row).toEqual({ advert_text: null, status: 'ready' });
    const read = await learner.student.cvDocument(doc.id);
    expect(read).toMatchObject({ status: 'ready', atsCoverage: 50, gaps: ['A gap'] });
    expect(read).not.toHaveProperty('fileKey');
  });

  it('needs the tailoring purpose for a tailored CV', async () => {
    const learner = await adultUnder('adult-v3-test');
    await learner.student.cvOptIn({ ...OPT_IN, purposes: ['cv.draft'] }, LIVE);
    await expect(
      learner.student.requestCvDocument(
        { kind: 'tailored', advert: { title: 'T', company: null, text: 'x' } },
        LIVE,
      ),
    ).rejects.toBeInstanceOf(CvConsentError);
  });

  it('gives a job nothing once the learner’s consent is gone (the job re-checks it)', async () => {
    const learner = await minorUnder('v4-test');
    await learner.student.cvOptIn(OPT_IN, LIVE);
    const doc = await learner.student.requestCvDocument({ kind: 'draft' }, LIVE);
    await learner.store.withdrawConsent(learner.token);
    await expect(learner.student.cvSubmission(doc.id, LIVE)).rejects.toBeInstanceOf(
      ConsentRequiredError,
    );
    // A job can still let the CV go: closing it needs no consent, and drops nothing but the row's state.
    expect(await learner.store.cvJobs().ownerOfDocument(doc.id)).toBe(learner.studentId);
    await learner.store.cvJobs().closeDocument(doc.id, 'consent_required');
    expect(await learner.store.cvJobs().stateOf(doc.id)).toEqual({
      status: 'failed',
      problem: 'consent_required',
      engineJobId: null,
    });
  });

  it('gives the envelope’s consent for a purpose, and the PDF’s key to the signed-link route only once ready', async () => {
    const learner = await optedInAdult();
    const consent = await learner.student.cvConsent('cv.ats', LIVE);
    expect(consent).toMatchObject({ version: 'cv-optin-v1', ageBand: '18-plus' });
    expect(consent.ref).toMatch(/^[0-9a-f-]{36}$/);
    expect(consent.learnerRef).not.toBe(learner.studentId);
    const minor = await minorUnder('v4-test');
    await minor.student.cvOptIn({ ...OPT_IN, purposes: ['cv.draft'] }, LIVE);
    await expect(minor.student.cvConsent('cv.ats', LIVE)).rejects.toBeInstanceOf(CvConsentError);
    const doc = await learner.student.requestCvDocument({ kind: 'draft' }, LIVE);
    expect(await learner.store.cvJobs().fileOf(doc.id)).toBeNull();
    const ready = await readyCv(await optedInAdult());
    expect(await learner.store.cvJobs().fileOf(ready)).toMatch(/^cv-[0-9a-f]{32}$/);
  });

  it('finds a CV by the engine’s job id, for the webhook (ids only)', async () => {
    const learner = await optedInAdult();
    const doc = await learner.student.requestCvDocument({ kind: 'draft' }, LIVE);
    await learner.student.markCvSubmitted(doc.id, 'engine-job-42', LIVE);
    expect(await learner.store.cvJobs().documentForEngineJob('engine-job-42')).toBe(doc.id);
    expect(await learner.store.cvJobs().documentForEngineJob('no-such-job')).toBeNull();
  });
});

describe('recruiter links (§9.3): 18+ only, in the database', () => {
  it('lets an adult under adult-v3 share a CV they checked, and serves it by token until revoked', async () => {
    const learner = await optedInAdult();
    const docId = await readyCv(learner);
    const { share, token } = await learner.student.createCvShare(docId, 30, LIVE);
    expect(token).toMatch(/^[A-Za-z0-9_-]{40,}$/);
    expect(share.viewCount).toBe(0);
    const jobs = learner.store.cvJobs();
    expect(await jobs.openShare(token)).toMatchObject({ documentId: docId });
    expect(await jobs.openShare(token)).not.toBeNull();
    expect((await learner.student.cvShares())[0]?.viewCount).toBe(2);
    await learner.student.revokeCvShare(share.id);
    expect(await jobs.openShare(token)).toBeNull();
    expect(await jobs.openShare('not-a-token')).toBeNull();
  });

  it('refuses a share for anyone under 18, in the store and in the database', async () => {
    const learner = await minorUnder('v4-test');
    // An under-18 can't even opt in to sharing.
    await expect(
      learner.student.cvOptIn({ ...OPT_IN, purposes: [...BASE_PURPOSES, 'cv.share'] }, PREVIEW),
    ).rejects.toBeInstanceOf(CvShareError);
    await expect(
      raw(
        `insert into cv_links (student_id, opted_in_at, consent_version, purposes) values ('${learner.studentId}', now(), 'cv-optin-v1', '{cv.draft,cv.share}')`,
      ),
    ).rejects.toThrow(/adult/);
    await learner.student.cvOptIn(OPT_IN, LIVE);
    const doc = await learner.student.requestCvDocument({ kind: 'draft' }, LIVE);
    await expect(learner.student.createCvShare(doc.id, 30, PREVIEW)).rejects.toBeInstanceOf(
      CvShareError,
    );
    await expect(
      raw(
        `insert into cv_shares (student_id, document_id, token_hash, created_at, expires_at) values ('${learner.studentId}', '${doc.id}', '${'d'.repeat(64)}', now(), now() + interval '30 days')`,
      ),
    ).rejects.toThrow(/adult/);
  });

  it('refuses a share without adult-v3, and for a CV not checked line by line', async () => {
    const old = await adultUnder('adult-v2-test');
    await old.student.cvOptIn({ ...OPT_IN, purposes: [...BASE_PURPOSES, 'cv.share'] }, PREVIEW);
    const doc = await old.student.requestCvDocument({ kind: 'draft' }, PREVIEW);
    await expect(old.student.createCvShare(doc.id, 30, LIVE)).rejects.toBeInstanceOf(CvShareError);
    const learner = await optedInAdult();
    const unchecked = await learner.student.requestCvDocument({ kind: 'draft' }, LIVE);
    await expect(learner.student.createCvShare(unchecked.id, 30, LIVE)).rejects.toBeInstanceOf(
      CvShareError,
    );
  });

  it('keeps a link between 7 and 90 days', async () => {
    const learner = await optedInAdult();
    const docId = await readyCv(learner);
    await expect(learner.student.createCvShare(docId, 6, LIVE)).rejects.toThrow();
    await expect(learner.student.createCvShare(docId, 91, LIVE)).rejects.toThrow();
  });
});

describe('the learner’s rights: export, withdrawal, deletion (§7.3)', () => {
  it('puts every CV table in Download my data, without file keys or token hashes', async () => {
    const learner = await optedInAdult();
    await learner.student.addCvEntry(PROJECT, LIVE);
    const docId = await readyCv(learner);
    await learner.student.createCvShare(docId, 30, LIVE);
    const exported = await learner.student.exportAll();
    const cv = exported.personal?.cv;
    expect(cv?.links).toHaveLength(1);
    expect(cv?.entries).toHaveLength(1);
    expect(cv?.documents).toHaveLength(1);
    expect(cv?.shares).toHaveLength(1);
    const text = JSON.stringify(cv);
    expect(text).not.toContain('fileKey');
    expect(text).not.toContain('tokenHash');
  });

  it('withdrawal switches every link off, deletes the CV data and leaves a tombstone (D15)', async () => {
    const learner = await optedInAdult();
    await learner.student.addCvEntry(PROJECT, LIVE);
    const docId = await readyCv(learner);
    const { token } = await learner.student.createCvShare(docId, 30, LIVE);
    const result = await learner.student.cvWithdraw();
    expect(result.fileKeys).toHaveLength(1);
    expect(result.deletionIds).toHaveLength(1);
    expect(await learner.store.cvJobs().openShare(token)).toBeNull();
    for (const table of ['cv_entries', 'cv_documents', 'cv_shares', 'cv_selections']) {
      expect(await count(table, `student_id = '${learner.studentId}'`)).toBe(0);
    }
    expect(
      await count('cv_links', `student_id = '${learner.studentId}' and withdrawn_at is null`),
    ).toBe(0);
    const deletion = await learner.store.cvJobs().deletion(result.deletionIds[0] as string);
    expect(deletion).toMatchObject({ confirmedAt: null });
    expect(Object.keys(deletion ?? {})).not.toContain('studentId');
    // Opting in again gives a new reference.
    await learner.student.cvOptIn(OPT_IN, LIVE);
    const refs = rowsOf<{ n: number }>(
      await database.db.execute(
        sql`select count(distinct learner_ref)::int as n from cv_links where student_id = ${learner.studentId}::uuid`,
      ),
    );
    expect(refs[0]?.n).toBe(2);
  });

  it('account deletion leaves a tombstone, returns the PDFs’ keys and drops the CV jobs', async () => {
    const learner = await optedInAdult();
    const docId = await readyCv(learner);
    await raw(
      `insert into jobs (kind, payload, run_at, max_attempts, created_at) values ('cv.poll', '{"cvDocumentId":"${docId}"}', now(), 6, now())`,
    );
    const keys = await learner.student.deleteAccount();
    expect(keys.some((k) => k.startsWith('cv-'))).toBe(true);
    expect(await count('jobs', `payload ->> 'cvDocumentId' = '${docId}'`)).toBe(0);
    const pending = await learner.store.cvJobs().deletionsToSchedule();
    expect(pending.length).toBeGreaterThanOrEqual(1);
    expect(await learner.store.cvJobs().deletionsToSchedule()).toEqual([]);
  });

  it('a guardian’s withdrawal stops the CV and sends the deletion to the operator', async () => {
    const learner = await minorUnder('v4-test');
    await learner.student.cvOptIn(OPT_IN, LIVE);
    await learner.store.withdrawConsent(learner.token);
    expect(
      await count('cv_links', `student_id = '${learner.studentId}' and withdrawn_at is null`),
    ).toBe(0);
    expect((await learner.store.cvJobs().deletionsToSchedule()).length).toBeGreaterThanOrEqual(1);
  });
});

describe('one rule for ID and student numbers (A11-17)', () => {
  it('packages/cv and packages/db agree', () => {
    const id = ['8', '0', '0', '1', '0', '1', '5', '0', '0', '9', '0', '8', '7'].join('');
    for (const text of [
      `My ID ${id}`,
      `student number ${'20'}41777`,
      'CSC1A10',
      '78%',
      `ref ${'12'}34567`,
      `${id.slice(0, 6)} ${id.slice(6, 10)} ${id.slice(10)}`,
    ]) {
      expect(cvHoldsPersonalNumber(text)).toBe(holdsPersonalNumber(text));
    }
  });
});
