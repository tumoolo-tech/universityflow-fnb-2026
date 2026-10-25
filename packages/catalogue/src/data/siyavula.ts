import type { PracticeResource } from '../practice';
import type { SubjectId } from '../subjects';

/**
 * Siyavula's free Grade 10–12 open textbooks, practice and past papers (planning.md §3, Stage 3).
 *
 * DRAFT: researched on 2026-10-13 from Siyavula's own site only. No record carries `verifiedOn`
 * or `verifiedBy`: a person opens each link, checks it is still free, and adds them (hard rule 3).
 *
 * - **Textbooks** are free to read online, no account. The catalogue page
 *   (https://www.siyavula.com/read) lists every book below. Mathematics, Physical Sciences,
 *   Mathematical Literacy and Life Sciences are released under CC BY 3.0 (the read pages link
 *   creativecommons.org/licenses/by/3.0; the branded editions are CC BY-ND 3.0); the Computer
 *   Applications Technology and Information Technology books are "provided by MTN and are under a
 *   closed copyright license", still free to read. Siyavula lists no Grade 11 or 12 book for
 *   Mathematical Literacy or Life Sciences.
 * - **Practice** for Mathematics and Physical Sciences is free for learners ("Always FREE! Sign up
 *   as a learner", https://www.siyavula.com/products/learners; "Learners practise on Siyavula for
 *   free!", https://www.siyavula.com/pricing; the paid plans there are for teachers and schools).
 *   It needs an account, and Siyavula's terms ask learners under 18 for a parent's or guardian's
 *   consent. Its per-chapter links (`/dashboard/select-chapter/…`) need a login, so we link the
 *   learner page instead.
 * - **Past papers**: "Free past exam papers for Mathematics and Physical Sciences"
 *   (https://www.siyavula.com/products/past-papers). The page names no grades.
 *
 * Linking: Siyavula's terms (https://www.siyavula.com/info/terms-and-conditions) say nothing
 * against linking to its pages. We link only; we never copy its content, use its logo or imply a
 * partnership. "Endorsed by the Department of Basic Education" is Siyavula's own claim (on /read);
 * the DBE lists the Grade 10–12 Mathematics and Physical Sciences books as learning and teaching
 * support material, without that word. Neither claim is shown to learners.
 */

const ACCESSED = '2026-10-13';
const READ = 'https://www.siyavula.com/read';

function textbook(
  subjectId: SubjectId,
  path: string,
  grade: 10 | 11 | 12,
  title: string,
  licence: PracticeResource['licence'],
  note?: string,
): PracticeResource {
  return {
    sourceUrl: READ,
    academicYear: 2026,
    id: `siyavula-${subjectId}-grade-${grade}-textbook`,
    provider: 'siyavula',
    kind: 'textbook',
    subjectId,
    grades: [grade],
    title,
    url: `https://www.siyavula.com/read/za/${path}/grade-${grade}`,
    access: 'free',
    licence,
    accessedOn: ACCESSED,
    ...(note ? { note } : {}),
  };
}

const MTN = 'Free to read; MTN-provided, closed copyright: link only, never copy.';

export const siyavulaResources: PracticeResource[] = [
  textbook('mathematics', 'mathematics', 10, 'Mathematics Grade 10', 'cc-by-3.0'),
  textbook('mathematics', 'mathematics', 11, 'Mathematics Grade 11', 'cc-by-3.0'),
  textbook('mathematics', 'mathematics', 12, 'Mathematics Grade 12', 'cc-by-3.0'),
  textbook('physical-sciences', 'physical-sciences', 10, 'Physical Sciences Grade 10', 'cc-by-3.0'),
  textbook('physical-sciences', 'physical-sciences', 11, 'Physical Sciences Grade 11', 'cc-by-3.0'),
  textbook('physical-sciences', 'physical-sciences', 12, 'Physical Sciences Grade 12', 'cc-by-3.0'),
  textbook(
    'mathematical-literacy',
    'mathematical-literacy',
    10,
    'Mathematical Literacy Grade 10',
    'cc-by-3.0',
    'Siyavula lists no Grade 11 or 12 Mathematical Literacy book.',
  ),
  textbook(
    'life-sciences',
    'life-sciences',
    10,
    'Life Sciences Grade 10',
    'cc-by-3.0',
    'Siyavula lists no Grade 11 or 12 Life Sciences book.',
  ),
  textbook(
    'computer-applications-technology',
    'computer-applications-technology',
    10,
    'Computer Applications Technology Grade 10',
    'closed-copyright',
    MTN,
  ),
  textbook(
    'computer-applications-technology',
    'computer-applications-technology',
    11,
    'Computer Applications Technology Grade 11',
    'closed-copyright',
    MTN,
  ),
  textbook(
    'computer-applications-technology',
    'computer-applications-technology',
    12,
    'Computer Applications Technology Grade 12',
    'closed-copyright',
    MTN,
  ),
  textbook(
    'information-technology',
    'information-technology',
    10,
    'Information Technology Grade 10',
    'closed-copyright',
    MTN,
  ),
  textbook(
    'information-technology',
    'information-technology',
    11,
    'Information Technology Grade 11',
    'closed-copyright',
    MTN,
  ),
  textbook(
    'information-technology',
    'information-technology',
    12,
    'Information Technology Grade 12',
    'closed-copyright',
    MTN,
  ),
  {
    sourceUrl: 'https://www.siyavula.com/pricing',
    academicYear: 2026,
    id: 'siyavula-mathematics-practice',
    provider: 'siyavula',
    kind: 'practice',
    subjectId: 'mathematics',
    grades: [10, 11, 12],
    title: 'Siyavula Practice: Mathematics',
    url: 'https://www.siyavula.com/products/learners',
    access: 'free-with-account',
    licence: 'site-terms',
    accessedOn: ACCESSED,
    note: 'Free for learners with unlimited questions (pricing page: paid plans are for teachers). Grades from the site menu. Per-chapter practice links need a login.',
  },
  {
    sourceUrl: 'https://www.siyavula.com/pricing',
    academicYear: 2026,
    id: 'siyavula-physical-sciences-practice',
    provider: 'siyavula',
    kind: 'practice',
    subjectId: 'physical-sciences',
    grades: [10, 11, 12],
    title: 'Siyavula Practice: Physical Sciences',
    url: 'https://www.siyavula.com/products/learners',
    access: 'free-with-account',
    licence: 'site-terms',
    accessedOn: ACCESSED,
    note: 'Free for learners with unlimited questions (pricing page: paid plans are for teachers). Grades from the site menu. Per-chapter practice links need a login.',
  },
  {
    sourceUrl: 'https://www.siyavula.com/products/past-papers',
    academicYear: 2026,
    id: 'siyavula-mathematics-past-papers',
    provider: 'siyavula',
    kind: 'past-papers',
    subjectId: 'mathematics',
    grades: [12],
    title: 'Siyavula past papers: Mathematics',
    url: 'https://www.siyavula.com/products/past-papers',
    access: 'free-with-account',
    licence: 'site-terms',
    accessedOn: ACCESSED,
    note: 'The page names no grades: Grade 12 is assumed (NSC past papers). It shows Sign up and Log in but does not say an account is needed. Check both.',
  },
  {
    sourceUrl: 'https://www.siyavula.com/products/past-papers',
    academicYear: 2026,
    id: 'siyavula-physical-sciences-past-papers',
    provider: 'siyavula',
    kind: 'past-papers',
    subjectId: 'physical-sciences',
    grades: [12],
    title: 'Siyavula past papers: Physical Sciences',
    url: 'https://www.siyavula.com/products/past-papers',
    access: 'free-with-account',
    licence: 'site-terms',
    accessedOn: ACCESSED,
    note: 'The page names no grades: Grade 12 is assumed (NSC past papers). It shows Sign up and Log in but does not say an account is needed. Check both.',
  },
];
