/**
 * `@universityflow/catalogue/colleges`: the public TVET colleges' records and their one view.
 *
 * Its own entry, so the college data (50 colleges, about 800 programmes) loads only where it is
 * read: the web app's server. The catalogue's main entry carries the schemas and functions
 * (colleges.ts) but no college record, and the phone app and the browser never load this file
 * (scripts/ci/client-chunks.mjs looks for its text in every client chunk).
 */
import { type CollegeRecords, type CollegeView, collegeViewOf } from './colleges';
import { COLLEGE_RECORDS } from './data/colleges/index';

export { DHET_COLLEGE_LIST } from './data/colleges/index';

/** Every college record, drafts included. For tests and the verification checklists only. */
export const RAW_COLLEGES: CollegeRecords = COLLEGE_RECORDS;

/**
 * The colleges a learner may see on `today`: verified records only, drafts too in preview (the
 * web app refuses drafts in production), exactly as `catalogueView` is for universities.
 */
export function collegeView(
  today: Date,
  options: { readonly includeDrafts: boolean },
): CollegeView {
  return collegeViewOf(COLLEGE_RECORDS, today, options);
}
