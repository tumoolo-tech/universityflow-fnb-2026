import {
  type CollegeProgrammeType,
  type CollegeView,
  closingNotice,
  collegeName,
  isDraft,
  reportGrade,
} from '@universityflow/catalogue';
import { marksBasis, type ScoredReport } from './basis';
import { nscPass } from './pass-type';

/**
 * Plan B with public TVET colleges (planning.md §19.1): the colleges' programmes beside the
 * universities' courses. Pure and React-Native-safe (hard rule 11), and the one place a college
 * verdict is decided (hard rule 2).
 *
 * **Code decides only what the quoted rule makes machine-readable.** A college prints its entry
 * rule in its own words; `entryRule` turns a quote into a rule only when the whole quote is made
 * of parts it recognises ("Grade 9 pass", "Grade 12", "NSC", and alternatives no school learner
 * holds, like "N3" or "or equivalent"). A subject, a percentage, an age, a test or anything else
 * leaves it unread: the learner sees "Check the entry rule" with the college's words and link,
 * never a guessed verdict. A quote marked `entryQuoteIncomplete` is never read at all.
 *
 * NC(V) starts after Grade 9, so it is shown on a Grade 10 report too; N4–N6 starts after matric,
 * so only on the reports universities admit on. A programme a national teach-out (a DHET
 * circular) has closed to first-year students is never offered.
 */

/** What code can check in a printed rule: a school grade passed, or the NSC. */
export interface EntryRule {
  /** The lowest school grade (9–11) whose pass meets the rule; null when no grade alternative. */
  readonly passedGrade: 9 | 10 | 11 | null;
  /** Whether the NSC (Grade 12, matric) meets the rule. */
  readonly nsc: boolean;
}

/** Words before or after the rule itself that say nothing about it. */
const PREFIXES = [
  /^(?:minimum\s+)?(?:entry|admission)\s+requirements?\s*:?\s*/,
  /^requirements?\s*:\s*/,
  /^report 191 \(nated\)\s+/,
  /^n4\s*[:-]\s*/,
  /^to enter level 2\s*-\s*/,
  /^level 2\s*-\s*/,
  /^l2\s*-\s*/,
  /^candidates must have\s+/,
];
const SUFFIXES = [/\s+to start at nc\(v\) l2$/, /\s+for n4 admission$/, /\s+for n4$/];

/** Other routes in: a school learner holds none of them, so they never meet a rule for one. */
const OTHER_ROUTES = new Set([
  'equivalent',
  'equivalent qualification',
  'better',
  'higher',
  'n3',
  'nqf4',
  'nqf6',
  'nqf level 1',
  'nqf level 1 equivalent',
  'level 4',
  'nc(v) level 4',
  'nc(v) level 4 certificate',
  'nc(v) l4',
  'technical senior certificate',
  'aet level 4',
  'abet level 4',
]);

const NSC_WORDS = new Set([
  'nsc',
  'matric',
  'matric (grade 12)',
  'national senior certificate',
  'national senior certificate (grade 12)',
  'national senior certificate nqf level 4',
  'grade 12 (nsc)',
  'grade 12 national senior certificate',
]);

/** "Grade 9", "Grade 9 pass", "passed Grade 9", "a pass in Grade 9", "Grade 9 certificate"… */
const GRADE =
  /^(?:minimum\s+)?(?:pass(?:ed)?\s+|pass\s+in\s+)?grade\s?0?(9|1[0-2])(?:\s+(?:pass|certificate))?$/;

function part(raw: string): { grade: number } | 'nsc' | 'other' | null {
  const text = raw.replace(/^(?:or\s+)?(?:(?:a|an|any|any other)\s+)?/, '').trim();
  if (OTHER_ROUTES.has(text)) return 'other';
  if (NSC_WORDS.has(text)) return 'nsc';
  const grade = GRADE.exec(text);
  if (!grade) return null;
  const n = Number(grade[1]);
  return n === 12 ? 'nsc' : { grade: n };
}

/** The rule a quote states, when code can read all of it; null when a person must. */
export function entryRule(quote: string | null): EntryRule | null {
  if (quote === null) return null;
  let text = quote
    .toLowerCase()
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.\s]+$/, '');
  for (const p of PREFIXES) text = text.replace(p, '');
  for (const s of SUFFIXES) text = text.replace(s, '');
  const parts = text
    .replace(/\s+and\/or\s+/g, ' or ')
    .split(/\s*,\s*|\s*\/\s*|\s+or\s+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map(part);
  if (parts.length === 0 || parts.includes(null)) return null;
  const grades = parts.flatMap((p) => (p !== null && typeof p === 'object' ? [p.grade] : []));
  const nsc = parts.includes('nsc');
  const passedGrade = grades.length === 0 ? null : (Math.min(...grades) as 9 | 10 | 11);
  return passedGrade === null && !nsc ? null : { passedGrade, nsc };
}

/** `meets-minimum`: the learner meets the printed rule. `check-rule`: a person reads it. */
export type CollegeVerdict = 'meets-minimum' | 'check-rule';

export interface CollegeOption {
  readonly programmeId: string;
  readonly collegeId: string;
  /** The college's own name (DHET's when its site couldn't be read). */
  readonly collegeName: string;
  /** The first abbreviation the college prints, or its name: what its mark is drawn from. */
  readonly collegeShortName: string;
  readonly province: string;
  readonly mainTown: string | null;
  readonly type: CollegeProgrammeType;
  /** DHET's name, or OTHER (then `nameAtCollege` is the one to show). */
  readonly programme: string;
  readonly nameAtCollege: string;
  readonly campuses: ReadonlyArray<string> | null;
  readonly verdict: CollegeVerdict;
  readonly rule: EntryRule | null;
  readonly entryQuote: string | null;
  readonly entryQuoteUrl: string | null;
  readonly sourceUrl: string;
  readonly applyUrl: string | null;
  readonly website: string | null;
  readonly academicYear: number;
  readonly yearPrinted: number | null;
  /** True while nobody has verified the record (only ever shown outside production). */
  readonly draft: boolean;
}

export interface CollegeOptions {
  readonly options: ReadonlyArray<CollegeOption>;
  /** Programmes left out because a national teach-out closed them, per circular. */
  readonly closed: ReadonlyArray<{ circular: string; count: number; sourceUrl: string }>;
  /** How many college programmes were checked, so "nothing found" can't hide an empty list. */
  readonly checked: number;
  readonly includesDrafts: boolean;
}

/** South Africa's calendar year at `at` (SAST, UTC+2). */
function sastYear(at: Date): number {
  return new Date(at.getTime() + 2 * 3_600_000).getUTCFullYear();
}

function verdictFor(rule: EntryRule | null, report: ScoredReport): CollegeVerdict | 'not-yet' {
  if (rule === null) return 'check-rule';
  const grade = reportGrade(report.kind);
  if (rule.passedGrade !== null && grade > rule.passedGrade) return 'meets-minimum';
  if (rule.nsc && marksBasis(report.kind) === 'admission' && nscPass(report.marks) !== 'none') {
    return 'meets-minimum';
  }
  return 'not-yet';
}

/**
 * The college programmes for a learner's Plan B, from their confirmed report. The earliest intake
 * a learner can start is next year's, so a teach-out closing that year leaves the programme out.
 */
export function collegeOptions(
  view: CollegeView,
  report: ScoredReport,
  today: Date,
): CollegeOptions {
  const intakeYear = sastYear(today) + 1;
  const progress = marksBasis(report.kind) === 'progress';
  const colleges = new Map(view.colleges.map((c) => [c.id, c]));
  const closed = new Map<string, { circular: string; count: number; sourceUrl: string }>();
  const options: CollegeOption[] = [];
  let checked = 0;
  for (const p of view.programmes) {
    const college = colleges.get(p.collegeId);
    if (!college?.site) continue;
    if (progress && p.type !== 'ncv') continue;
    checked++;
    const notice = closingNotice(p, view.notices, intakeYear);
    if (notice) {
      const entry = closed.get(notice.id) ?? {
        circular: notice.circular,
        count: 0,
        sourceUrl: notice.sourceUrl,
      };
      closed.set(notice.id, { ...entry, count: entry.count + 1 });
      continue;
    }
    const rule = p.entryQuoteIncomplete ? null : entryRule(p.entryQuote);
    const verdict = verdictFor(rule, report);
    if (verdict === 'not-yet') continue;
    options.push({
      programmeId: p.id,
      collegeId: college.id,
      collegeName: collegeName(college),
      collegeShortName: college.site.abbreviations[0] ?? collegeName(college),
      province: college.province,
      mainTown: college.site.mainTown,
      type: p.type,
      programme: p.programme,
      nameAtCollege: p.nameAtCollege,
      campuses: p.campuses,
      verdict,
      rule,
      entryQuote: p.entryQuote,
      entryQuoteUrl: p.entryQuoteUrl,
      sourceUrl: p.sourceUrl,
      applyUrl: college.site.applyUrl,
      website: college.site.website,
      academicYear: p.academicYear,
      yearPrinted: p.yearPrinted,
      draft: isDraft(p) || isDraft(college) || isDraft(college.site),
    });
  }
  const rank = (v: CollegeVerdict) => (v === 'meets-minimum' ? 0 : 1);
  options.sort(
    (a, b) =>
      rank(a.verdict) - rank(b.verdict) ||
      a.collegeName.localeCompare(b.collegeName) ||
      a.nameAtCollege.localeCompare(b.nameAtCollege),
  );
  return { options, closed: [...closed.values()], checked, includesDrafts: view.includesDrafts };
}
