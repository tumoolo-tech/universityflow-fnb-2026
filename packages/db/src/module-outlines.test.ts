import {
  type ConfirmedModuleOutline,
  holdsMobileNumber,
  looksLikePersonalNumber,
} from '@universityflow/documents';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type Database, rowsOf } from './client';
import { ConsentOutdatedError, InvalidStateError, NotFoundError } from './errors';
import {
  holdsPersonalNumber,
  MODULE_OUTLINES_ADULT_CONSENT_VERSION,
  MODULE_OUTLINES_CONSENT_VERSION,
} from './store';
import { signIn, syntheticPhone, testDatabase, testStore } from './testing';

/**
 * Confirmed module outlines (Phase 6b, migration 0040; docs/plans/phase-6-proposal.md D3, D9,
 * D10). A module outline goes whole to the AI provider outside South Africa and names lecturers,
 * so the consent that covers the learner must name it: guardian v4 or the adult agreement adult-v3
 * (docs/legal/consent-v4-draft.md, C9), neither live yet. The database itself refuses an outline
 * upload, and an outline read from one, under older wording, as 0021 does for letters; an outline
 * the learner types by hand needs only consent. The outline is stored per learner, module and
 * year; its file goes once it is confirmed (D10); export and deletion include it. Every value here
 * is synthetic.
 */

let database: Database;
beforeAll(async () => {
  database = await testDatabase();
});
afterAll(async () => {
  await database.close();
});

/** A synthetic mobile number, built at runtime (hard rule 4). */
const mobile = () => ['082', '555', '0123'].join(' ');

const OUTLINE: ConfirmedModuleOutline = {
  moduleCode: 'DEMO1001',
  moduleName: 'Sample module 1 (demo)',
  academicYear: 2027,
  term: 'S1',
  components: {
    status: 'confirmed',
    items: [
      { name: 'Test 1', kind: 'test', weight: 40, subminimum: null },
      { name: 'Final exam', kind: 'exam', weight: 60, subminimum: 40 },
    ],
    dpRequirement: { percent: 40, quote: 'A year mark of 40%.' },
    examSubminimum: 40,
    supplementaryQuote: null,
  },
  dates: { status: 'confirmed', items: [{ label: 'Test 1', date: '2027-03-15' }] },
  books: {
    status: 'confirmed',
    items: [
      {
        role: 'prescribed',
        title: 'Sample Studies',
        authors: null,
        edition: null,
        isbn: '9780306406157',
      },
    ],
  },
  people: {
    status: 'confirmed',
    items: [
      {
        name: 'Dr A. Sample (made-up)',
        role: 'Lecturer',
        email: 'a.sample@example.org',
        phone: null,
        office: 'Room S-101',
        consultationTimes: 'Tuesdays 10:00 to 12:00',
      },
    ],
  },
};

const upload = () => ({
  kind: 'module-outline',
  storageKey: `outline-${crypto.randomUUID()}`,
  mimeType: 'application/pdf',
  sizeBytes: 10,
});

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

async function adultUnder(version: string) {
  const { store } = testStore(database);
  const { studentId } = await signIn(store, syntheticPhone());
  await store.setDateOfBirth(studentId, '2000-01-15');
  await store.consentAsAdult(studentId, version);
  return { store, studentId, student: store.forStudent(studentId) };
}

/** Writes as the database owner, past every check in the store. */
function raw(statement: string) {
  return database.exec(statement);
}

const insertOutline = (
  studentId: string,
  outline: object,
  fromDocument = false,
  code = 'RAW1001',
) =>
  raw(
    `insert into module_outlines (student_id, module_code, academic_year, outline, from_document, confirmed_at, updated_at)
     values ('${studentId}', '${code}', 2027, '${JSON.stringify(outline).replaceAll("'", "''")}'::jsonb, ${fromDocument}, now(), now())`,
  );

const stored = ({
  moduleCode: _c,
  academicYear: _y,
  documentId: _d,
  ...rest
}: ConfirmedModuleOutline) => rest;

describe('the consent wording that names module outlines (D9)', () => {
  it('is guardian v4 and adult-v3', () => {
    expect(MODULE_OUTLINES_CONSENT_VERSION).toBe(4);
    expect(MODULE_OUTLINES_ADULT_CONSENT_VERSION).toBe(3);
  });

  it('refuses an outline upload under guardian v3 and adult-v2, in the store and in the database', async () => {
    for (const { studentId, student } of [
      await minorUnder('v3-2026-10'),
      await adultUnder('adult-v2-2026-10'),
    ]) {
      await expect(student.addDocument(upload())).rejects.toThrow(ConsentOutdatedError);
      await expect(student.addDocument(upload())).rejects.toMatchObject({
        purpose: 'module-outlines',
      });
      await expect(
        raw(
          `insert into documents (student_id, kind, storage_key, mime_type, size_bytes)
           values ('${studentId}', 'module-outline', 'raw-${crypto.randomUUID()}', 'application/pdf', 10)`,
        ),
      ).rejects.toThrow(/consent/i);
      // A letter is still covered by v3 and adult-v2.
      expect(await student.addDocument({ ...upload(), kind: 'acceptance-letter' })).toMatchObject({
        kind: 'acceptance-letter',
      });
    }
  });

  it('accepts one under guardian v4 and adult-v3', async () => {
    for (const { student } of [
      await minorUnder('v4-2026-11'),
      await adultUnder('adult-v3-2026-11'),
    ]) {
      expect(await student.addDocument(upload())).toMatchObject({ kind: 'module-outline' });
    }
  });

  it('an outline read from a document needs it too; one typed by hand needs only consent', async () => {
    const { studentId, student } = await adultUnder('adult-v2-2026-10');
    await expect(insertOutline(studentId, stored(OUTLINE), true)).rejects.toThrow(/consent/i);
    await insertOutline(studentId, stored(OUTLINE), false);
    const typed = await student.saveModuleOutline({ ...OUTLINE, moduleCode: 'DEMO1002' });
    expect(typed.fileKey).toBeNull();
    // Naming a document at all asks the consent question first, whatever the document is.
    await expect(
      student.saveModuleOutline({ ...OUTLINE, documentId: crypto.randomUUID() }),
    ).rejects.toThrow(ConsentOutdatedError);
  });

  it('a document can’t be turned into an outline afterwards under older wording', async () => {
    const { student } = await adultUnder('adult-v2-2026-10');
    const report = await student.addDocument({ ...upload(), kind: 'grade-11-report' });
    await expect(
      raw(`update documents set kind = 'module-outline' where id = '${report?.id}'`),
    ).rejects.toThrow(/consent/i);
  });
});

describe('saving a confirmed outline', () => {
  it('keeps it per module and year, replacing that one on a second confirm', async () => {
    const { student } = await adultUnder('adult-v3-test');
    const first = await student.saveModuleOutline(OUTLINE);
    const again = await student.saveModuleOutline({
      ...OUTLINE,
      moduleCode: 'demo1001',
      moduleName: null,
    });
    expect(again.id).toBe(first.id);
    await student.saveModuleOutline({ ...OUTLINE, academicYear: 2028 });
    const outlines = await student.moduleOutlines();
    expect(outlines.map((o) => [o.moduleCode, o.academicYear])).toEqual([
      ['DEMO1001', 2027],
      ['DEMO1001', 2028],
    ]);
    expect(outlines[0]?.outline.moduleName).toBeNull();
    expect(outlines[0]?.fromDocument).toBe(false);
  });

  it('deletes the outline’s file once it is confirmed (D10), and marks it read from a document', async () => {
    const { student } = await adultUnder('adult-v3-test');
    const document = await student.addDocument(upload());
    const saved = await student.saveModuleOutline({ ...OUTLINE, documentId: document?.id ?? null });
    expect(saved.fileKey).toBe(document?.storageKey);
    expect(await student.documents()).toEqual([]);
    const [outline] = await student.moduleOutlines();
    expect(outline?.fromDocument).toBe(true);
  });

  it('refuses another kind of document as its source', async () => {
    const { student } = await adultUnder('adult-v3-test');
    const report = await student.addDocument({ ...upload(), kind: 'grade-11-report' });
    await expect(
      student.saveModuleOutline({ ...OUTLINE, documentId: report?.id ?? null }),
    ).rejects.toThrow(InvalidStateError);
    await expect(
      student.saveModuleOutline({ ...OUTLINE, documentId: crypto.randomUUID() }),
    ).rejects.toThrow(NotFoundError);
  });

  it('refuses weights that don’t add up, a mobile number and a student number (hard rules 4, 6; D3)', async () => {
    const { student } = await adultUnder('adult-v3-test');
    const components = OUTLINE.components.status === 'confirmed' ? OUTLINE.components : null;
    const person = OUTLINE.people.status === 'confirmed' ? OUTLINE.people.items[0] : null;
    for (const bad of [
      {
        ...OUTLINE,
        components: {
          ...components,
          items: [{ name: 'Test 1', kind: 'test', weight: 30, subminimum: null }],
        },
      },
      { ...OUTLINE, people: { status: 'confirmed', items: [{ ...person, phone: mobile() }] } },
      { ...OUTLINE, moduleName: 'Student no 2027123' },
    ]) {
      await expect(
        student.saveModuleOutline(bad as unknown as ConfirmedModuleOutline),
      ).rejects.toThrow(InvalidStateError);
    }
    expect(await student.moduleOutlines()).toEqual([]);
  });

  it('the database refuses them too, whatever the code above does', async () => {
    const { studentId } = await adultUnder('adult-v3-test');
    const body = stored(OUTLINE);
    const components = body.components.status === 'confirmed' ? body.components : null;
    const person = body.people.status === 'confirmed' ? body.people.items[0] : null;
    for (const [what, bad] of [
      [
        'weights',
        {
          ...body,
          components: {
            ...components,
            items: [{ name: 'Test', kind: 'test', weight: 30, subminimum: null }],
          },
        },
      ],
      [
        'a mobile number',
        {
          ...body,
          people: {
            status: 'confirmed',
            items: [{ ...person, consultationTimes: `Call ${mobile()}` }],
          },
        },
      ],
      ['a student number', { ...body, moduleName: 'Student no 2027123' }],
      [
        'an ISBN that isn’t one',
        {
          ...body,
          books: {
            status: 'confirmed',
            items: [
              { role: 'prescribed', title: 'X', authors: null, edition: null, isbn: '12345' },
            ],
          },
        },
      ],
      ['an unknown section', { ...body, classList: ['Sample Student A'] }],
      ['an unknown status', { ...body, dates: { status: 'maybe' } }],
    ] as const) {
      await expect(insertOutline(studentId, bad), what).rejects.toThrow();
    }
    // Not in the outline is a valid answer for every section; an ISBN is not a personal number.
    const none = { status: 'not-in-outline' };
    await insertOutline(studentId, { ...body, components: none, dates: none, people: none });
  });

  it('holds the same personal-number and mobile rules as packages/documents', async () => {
    const samples = [
      'Student no 2027123',
      `Call ${mobile()}`,
      'Tuesdays 10:00 to 12:00',
      'Test 1 on 2027-03-15 (20%)',
      ['9001', '0150', '0908', '7'].join(''),
    ];
    for (const text of samples) {
      const [row] = rowsOf<{ personal: boolean; mobile: boolean }>(
        await database.db.execute(
          sql`select uf_holds_personal_number(${text}) as personal, uf_holds_mobile_number(${text}) as mobile`,
        ),
      );
      expect(row, text).toEqual({
        personal: looksLikePersonalNumber(text),
        mobile: holdsMobileNumber(text),
      });
      expect(holdsPersonalNumber(text), text).toBe(looksLikePersonalNumber(text));
    }
  });
});

describe('another learner, consent, export and deletion', () => {
  it('another learner never sees or deletes one (row-level security)', async () => {
    const owner = await adultUnder('adult-v3-test');
    const other = await adultUnder('adult-v3-test');
    const { id } = await owner.student.saveModuleOutline(OUTLINE);
    expect(await other.student.moduleOutlines()).toEqual([]);
    await expect(other.student.deleteModuleOutline(id)).rejects.toThrow(NotFoundError);
    expect(await owner.student.moduleOutlines()).toHaveLength(1);
  });

  it('nothing is read or written for a minor before a guardian consents (hard rule 5)', async () => {
    const { store } = testStore(database);
    const { studentId } = await signIn(store, syntheticPhone());
    await store.setDateOfBirth(studentId, '2010-03-03');
    const student = store.forStudent(studentId);
    await expect(student.moduleOutlines()).rejects.toThrow(/consent/i);
    await expect(student.saveModuleOutline(OUTLINE)).rejects.toThrow(/consent/i);
  });

  it('the learner deletes one; the export carries them; deleting the account takes them', async () => {
    const { studentId, student } = await adultUnder('adult-v3-test');
    const { id } = await student.saveModuleOutline(OUTLINE);
    await student.saveModuleOutline({ ...OUTLINE, moduleCode: 'DEMO1002' });
    await student.deleteModuleOutline(id);
    const exported = await student.exportAll();
    expect(exported.personal?.moduleOutlines.map((o) => o.moduleCode)).toEqual(['DEMO1002']);
    await student.deleteAccount();
    const [row] = rowsOf<{ n: number }>(
      await database.db.execute(
        sql`select count(*)::int as n from module_outlines where student_id = ${studentId}::uuid`,
      ),
    );
    expect(row?.n).toBe(0);
  });
});
