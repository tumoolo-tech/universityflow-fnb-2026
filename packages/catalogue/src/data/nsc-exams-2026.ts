import type { ExamPaper } from '../exams';
import type { SubjectId } from '../subjects';

/**
 * The October/November 2026 NSC final examination timetable.
 *
 * DRAFT: researched on 2026-10-13. The source is the Department of Basic Education's own
 * timetable ("OCTOBER/NOVEMBER 2026 NATIONAL SENIOR CERTIFICATE (NSC) EXAMINATIONS TIMETABLE",
 * Chief Directorate: National Assessment and Public Examinations), approved by the Council of
 * Education Ministers on 23 January 2026, as republished unchanged by the KwaZulu-Natal Department
 * of Education. The DBE's own copy (education.gov.za, Publications, item 9548) refused automated
 * access; the Eastern Cape's Assessment Instruction 19 of 2026 carries the same annexure and was
 * read against this one entry for entry.
 *
 * The timetable prints a session (09:00 or 14:00) and a duration; end times are computed. Only
 * the subjects the first cohort is most likely to write are here: add others from the same
 * source. Life Orientation has no final written paper (its Common Assessment Task is on 1
 * September), so it has none.
 *
 * The first cohort writes in October/November **2027**. That timetable is not published yet:
 * nothing here is for them, and nothing must be invented for them (open question 19).
 */

const SOURCE = {
  sourceUrl:
    'https://www.kzneducation.gov.za/wp-content/uploads/2026/08/Oct-Nov-2026-NSC-TIMETABLE.pdf',
  academicYear: 2026,
} as const;

function paper(
  subjectId: SubjectId,
  n: 1 | 2 | 3,
  date: string,
  session: 'morning' | 'afternoon',
  durationMinutes: number,
  note?: string,
): ExamPaper {
  return {
    ...SOURCE,
    id: `nsc-2026-${subjectId}-p${n}`,
    examination: 'nsc-final',
    subjectId,
    paper: n,
    date,
    session,
    startsAt: session === 'morning' ? '09:00' : '14:00',
    durationMinutes,
    ...(note ? { note } : {}),
  };
}

const ELECTION_NOTE =
  'Scheduled for 2 November in the timetable, but a Western Cape Education statement of 6 October 2026 says no exams are written from 2 to 5 November (local government elections). Confirm with the DBE.';

export const nscFinal2026: ExamPaper[] = [
  paper('computer-applications-technology', 1, '2026-10-13', 'morning', 180),
  paper('information-technology', 1, '2026-10-14', 'morning', 180),
  paper('english-hl', 3, '2026-10-15', 'morning', 180),
  paper('english-fal', 3, '2026-10-15', 'morning', 150),
  paper('economics', 1, '2026-10-16', 'morning', 120),
  paper('isizulu-hl', 3, '2026-10-19', 'morning', 180),
  paper('agricultural-sciences', 1, '2026-10-19', 'afternoon', 150),
  paper('afrikaans-hl', 3, '2026-10-20', 'morning', 180),
  paper('afrikaans-fal', 3, '2026-10-20', 'morning', 150),
  paper('history', 1, '2026-10-20', 'afternoon', 180),
  paper('information-technology', 2, '2026-10-21', 'afternoon', 180),
  paper('accounting', 1, '2026-10-22', 'morning', 120),
  paper('engineering-graphics-and-design', 1, '2026-10-22', 'afternoon', 180),
  paper('mathematics', 1, '2026-10-23', 'morning', 180),
  paper('mathematical-literacy', 1, '2026-10-23', 'morning', 180),
  paper('technical-mathematics', 1, '2026-10-23', 'morning', 180),
  paper('mathematics', 2, '2026-10-26', 'morning', 180),
  paper('mathematical-literacy', 2, '2026-10-26', 'morning', 180),
  paper('technical-mathematics', 2, '2026-10-26', 'morning', 180),
  paper('engineering-graphics-and-design', 2, '2026-10-27', 'afternoon', 180),
  paper('english-hl', 1, '2026-10-28', 'morning', 120),
  paper('english-fal', 1, '2026-10-28', 'morning', 120),
  paper('accounting', 2, '2026-10-28', 'afternoon', 120),
  paper('geography', 1, '2026-10-29', 'morning', 180),
  paper('computer-applications-technology', 2, '2026-10-29', 'afternoon', 180),
  paper('physical-sciences', 1, '2026-10-30', 'morning', 180),
  paper('tourism', 1, '2026-10-30', 'afternoon', 180),
  paper('physical-sciences', 2, '2026-11-02', 'morning', 180, ELECTION_NOTE),
  paper('isizulu-hl', 1, '2026-11-06', 'morning', 120),
  paper('consumer-studies', 1, '2026-11-06', 'afternoon', 180),
  paper('isizulu-hl', 2, '2026-11-10', 'morning', 150),
  paper('afrikaans-hl', 1, '2026-11-11', 'morning', 120),
  paper('afrikaans-fal', 1, '2026-11-11', 'morning', 120),
  paper('business-studies', 1, '2026-11-11', 'afternoon', 120),
  paper('geography', 2, '2026-11-12', 'morning', 180),
  paper('life-sciences', 1, '2026-11-13', 'morning', 150),
  paper('life-sciences', 2, '2026-11-16', 'morning', 150),
  paper('agricultural-sciences', 2, '2026-11-17', 'afternoon', 150),
  paper('business-studies', 2, '2026-11-18', 'morning', 120),
  paper('english-hl', 2, '2026-11-19', 'morning', 150),
  paper('english-fal', 2, '2026-11-19', 'morning', 150),
  paper('history', 2, '2026-11-19', 'afternoon', 180),
  paper('afrikaans-hl', 2, '2026-11-20', 'morning', 150),
  paper('afrikaans-fal', 2, '2026-11-20', 'morning', 150),
  paper('economics', 2, '2026-11-20', 'afternoon', 120),
];
