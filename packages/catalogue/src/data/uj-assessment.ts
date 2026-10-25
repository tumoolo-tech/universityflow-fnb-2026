import type { UniversityAssessment } from '../assessment';

/**
 * University of Johannesburg (UJ): how marks work (Phase 6a). Schema: `packages/catalogue/src/assessment.ts`.
 *
 * DRAFT, and EMPTY on purpose: uj.ac.za refused every automated fetch on 2026-10-24 (HTTP 403,
 * as in Phase 5e-2). A person reads the 2026 Academic Regulations in a browser and fills this in;
 * until then a UJ learner's card is built from their own module outline only, and says so.
 * Never add `verifiedOn`/`verifiedBy`.
 */
export const ujAssessment: UniversityAssessment = {
  rules: [
    {
      sourceUrl: 'https://www.uj.ac.za/wp-content/uploads/2025/12/academic-regulations-2026.pdf',
      academicYear: 2026,
      id: 'uj-general-rules',
      universityId: 'uj',
      title: 'Academic Regulations 2026',
      unread:
        'uj.ac.za refused automated access (HTTP 403) on 2026-10-24 for this PDF (found by search, not opened), https://www.uj.ac.za/about/policies-and-regulations/ and https://www.uj.ac.za/about/academic-calendar-and-regulations: needs a person in a browser to read the assessment regulations (exam admission and semester mark, subminimum, supplementary) and the 2027 academic calendar.',
    },
  ],
  modules: [],
  calendars: [],
};
