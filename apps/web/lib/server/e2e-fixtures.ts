import 'server-only';
import type { CatalogueRecords, Curriculum } from '@universityflow/catalogue';

/**
 * Synthetic catalogue records for the E2E journeys only (`UF_CATALOGUE_E2E_FIXTURES=1`, which
 * readConfig refuses in production). Nothing here is a fact about a real programme: the module
 * codes start with TEST and the names say "Sample", matching the local stand-in proof of
 * registration (documents' `SAMPLE_REGISTRATION`). Every record is a draft (no `verifiedOn`), so
 * the catalogue view shows it only in preview mode, labelled as unverified.
 *
 * Why it exists: the registration journey needs a first-year curriculum, and the catalogue holds
 * none it can rely on for a stable test (curricula are drafted from rule books and change). The
 * faculty office and the registration calendar the journey shows are the catalogue's own drafts.
 */

/** The programme the journey accepts an offer for and registers in. */
export const E2E_REGISTRATION_PROGRAMME = 'up-bsc-computer-science';

/**
 * Four compulsory modules; the stand-in proof registers the first three, so the check finds
 * exactly one missing module (TEST104, second semester).
 */
export const E2E_CURRICULUM: Curriculum = {
  sourceUrl: 'https://www.up.ac.za/yearbooks',
  academicYear: 2027,
  programmeId: E2E_REGISTRATION_PROGRAMME,
  yearOfStudy: 1,
  modules: [
    { code: 'TEST101', name: 'Sample module one', semester: 'S1', credits: 16, compulsory: true },
    { code: 'TEST102', name: 'Sample module two', semester: 'S1', credits: 16, compulsory: true },
    { code: 'TEST103', name: 'Sample module three', semester: 'S2', credits: 16, compulsory: true },
    { code: 'TEST104', name: 'Sample module four', semester: 'S2', credits: 16, compulsory: true },
  ],
  electiveGroups: [],
  totalCredits: { min: 48, max: 64 },
  note: 'SYNTHETIC E2E FIXTURE: not a real curriculum.',
};

/** The records with the fixtures in place of any curriculum for the journey's programme. */
export function withE2eFixtures(records: CatalogueRecords): CatalogueRecords {
  return {
    ...records,
    curricula: [
      ...records.curricula.filter((c) => c.programmeId !== E2E_REGISTRATION_PROGRAMME),
      E2E_CURRICULUM,
    ],
  };
}
