import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getTableColumns, getTableName, is } from 'drizzle-orm';
import { PgTable } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import * as schema from './schema';
import { UNIVERSITY_DOCUMENT_KINDS } from './store';

/**
 * Audit A11-15: the store privacy answers (docs/store/privacy-and-data-safety.md) went stale when
 * Phase 5 added three tables and two document kinds. The page says "re-check whenever a column
 * is added to schema.ts"; this holds it to that. Every table that holds a learner's rows, and
 * every kind of document a learner uploads, is named on the page. So is the one deliberate
 * exception to "no university in an SMS or WhatsApp" (A11-16).
 */

const page = readFileSync(
  join(import.meta.dirname, '..', '..', '..', 'docs', 'store', 'privacy-and-data-safety.md'),
  'utf8',
);

const learnerTables = (Object.values(schema) as unknown[])
  .filter((value): value is PgTable => is(value, PgTable))
  .filter((table) => table === schema.students || 'studentId' in getTableColumns(table))
  .map((table) => getTableName(table));

describe('the store privacy page names what the app keeps (A11-15)', () => {
  it('finds the learner tables to check', () => {
    for (const name of ['students', 'documents', 'offers', 'first_week_steps', 'registrations']) {
      expect(learnerTables).toContain(name);
    }
  });

  it.each(learnerTables)('names the table `%s`', (name) => {
    expect(page).toContain(`\`${name}\``);
  });

  it.each(['grade-11-report', ...UNIVERSITY_DOCUMENT_KINDS])(
    'names the document kind `%s`',
    (kind) => {
      expect(page).toContain(`\`${kind}\``);
    },
  );

  it('says what the AI provider reads, letters and proofs included', () => {
    expect(page).toMatch(/Anthropic[^\n]*offer letters[^\n]*proofs of registration/);
  });

  it('declares the address and the money printed on an uploaded letter or proof', () => {
    expect(page).not.toMatch(/Physical Address \| ❌/);
    expect(page).toMatch(/\| Contact Info \| Physical Address \| ✅/);
    expect(page).toMatch(/\| Financial Info \| Other Financial Info \| ✅/);
  });

  it('names the profile photo (0029): only when switched on, waiting for consent v4, never sent to the AI', () => {
    expect(page).toMatch(/\*\*Profile photo\*\*[^\n]*UF_PROFILE_PHOTO[^\n]*consent v4/);
    expect(page).toMatch(/`profiles`[^\n]*photo/);
    expect(page).toMatch(/profile photo[^\n]*never sent to Anthropic/i);
  });

  it('names My CV (0035): only when switched on, waiting for consent v4, Mmereko as an operator in South Africa', () => {
    expect(page).toMatch(/\*\*My CV\*\*[^\n]*UF_CV[^\n]*consent v4/);
    expect(page).toMatch(/\*\*Mmereko\*\*[^\n]*South Africa/);
    expect(page).toMatch(/`cv_shares`[^\n]*18/);
    expect(page).toMatch(/`cv_deletions`/);
  });

  it('names the campus line in the crisis reply as a deliberate exception (A11-16)', () => {
    expect(page).toMatch(/crisis reply/i);
    expect(page).toMatch(/exception/i);
  });
});
