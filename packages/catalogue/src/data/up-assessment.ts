import type { UniversityAssessment } from '../assessment';

/**
 * University of Pretoria (UP): how marks work (Phase 6a). Schema: `packages/catalogue/src/assessment.ts`.
 *
 * DRAFT, and EMPTY on purpose: up.ac.za refused every automated fetch on 2026-10-24 (HTTP 403,
 * as in Phase 5e-2). Search snippets showed a supplementary rule for a 40–49% final mark capped at
 * 50% in some faculties, but nobody has read the page, so nothing is recorded (gotcha 40). A person
 * reads the General Academic Regulations in a browser and fills this in; until then a UP learner's
 * card is built from their own module outline only, and says so. Never add `verifiedOn`/`verifiedBy`.
 */
export const upAssessment: UniversityAssessment = {
  rules: [
    {
      sourceUrl:
        'https://www.up.ac.za/yearbooks/2026/rules/document/general-academic-regulations-and-student-rules-2026',
      academicYear: 2026,
      id: 'up-general-rules',
      universityId: 'up',
      title: 'General Academic Regulations and Student Rules 2026',
      unread:
        'up.ac.za refused automated access (HTTP 403) on 2026-10-24 for this page, https://www.up.ac.za/yearbooks/2026/rules-pdf and https://www.up.ac.za/yearbooks: needs a person in a browser to read the examination regulations (pass mark, semester-mark subminimum for exam admission, exam subminimum, supplementary range and result).',
    },
  ],
  modules: [],
  calendars: [],
};
