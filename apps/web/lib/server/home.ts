import 'server-only';
import { assessAll, type ProgrammeResult } from '@universityflow/admissions';
import { offerCard } from '@universityflow/agent';
import {
  type CatalogueView,
  isDraft,
  isSubjectId,
  programmeById,
  sastDateOf,
  subject,
} from '@universityflow/catalogue';
import {
  type Account,
  eighteenthBirthdaySoon,
  type StudentStore,
  sastDate,
} from '@universityflow/db';
import {
  type ApplicationRow,
  type HomeData,
  marksOverTime,
  nextAction,
  registrationCountdown,
  resolveLook,
  type ShortlistRow,
  type Verdict,
} from '@universityflow/ui';
import { applicationSummaries } from './applications';
import { firstWeekResponse } from './campus';
import { buildExams } from './goals';
import { placeFrom } from './learner-place';
import { asAgentOffers } from './offers';
import { registrationResponseFrom } from './registration';
import { scored } from './scored';
import { subjectsResponse } from './subjects';

/**
 * The signed-in home (docs/design/README.md): the learner's own numbers and lists, built by the
 * same server code as Results, Applications, My goal, My offers, First week and My modules, from
 * the records the app already has. No AI. A number with nothing behind it is null, and the page
 * leaves it out or says "not yet": never a 0 that isn't true. Its shape (`HomeData`) is in
 * `@universityflow/ui`, so the mobile app reads the same thing from `GET /api/home`.
 */

export type { HomeData } from '@universityflow/ui';

const REPORTS_FOR_THE_CHART = 12;

/** Only a minor covered by a guardian's consent (A11-25): that consent ends on the birthday. */
function turningEighteen(
  account: Pick<Account, 'dateOfBirth' | 'consentStatus'> | undefined,
  now: Date,
): HomeData['turningEighteen'] {
  if (account?.consentStatus !== 'granted' || !account.dateOfBirth) return null;
  const on = eighteenthBirthdaySoon(account.dateOfBirth, sastDate(now));
  return on ? { on } : null;
}

export async function homeData(
  student: StudentStore,
  view: CatalogueView,
  now = new Date(),
  /** The signed-in account: its date of birth and consent decide the 18th-birthday notice. */
  account?: Pick<Account, 'dateOfBirth' | 'consentStatus'>,
): Promise<HomeData> {
  const [profile, offerRecords, registration, reports, shortlisted, goal, choices] =
    await Promise.all([
      student.profile(),
      student.offers(),
      student.registration(),
      student.recentReports(REPORTS_FOR_THE_CHART),
      student.shortlist(),
      student.goal(),
      student.examSubjectChoices(),
    ]);
  const { stage, universityYear } = placeFrom(view, {
    grade: profile?.grade ?? null,
    offers: offerRecords,
    registration,
  });
  const latest = reports[0] ?? null;
  const results = latest ? assessAll(view, scored(latest)) : null;

  const verdictOf = new Map<string, [Verdict, ProgrammeResult]>();
  if (results) {
    for (const group of ['qualifyNow', 'onTrack', 'close', 'planB'] as const) {
      for (const r of results[group]) verdictOf.set(r.programmeId, [group, r]);
    }
  }
  const universityName = new Map(view.universities.map((u) => [u.id, u.shortName]));
  const shortlist: ShortlistRow[] = [];
  for (const { programmeId } of shortlisted) {
    const found = verdictOf.get(programmeId);
    if (found) {
      const [verdict, r] = found;
      shortlist.push({
        programmeId,
        name: r.name,
        universityName: universityName.get(r.universityId) ?? r.universityName,
        verdict,
        draft: r.draft,
      });
      continue;
    }
    // Not in the view the learner may see: left out (hard rule 3).
    const programme = programmeById(view, programmeId);
    if (!programme) continue;
    shortlist.push({
      programmeId,
      name: programme.name,
      universityName: universityName.get(programme.universityId) ?? '',
      verdict: null,
      draft: isDraft(programme),
    });
  }

  const university = stage === 'university';
  // Applications are two years away in Grade 10 (G10-4): Stage 0's home has no application tiles.
  const applications: ApplicationRow[] =
    university || stage === 'grade-10'
      ? []
      : (await applicationSummaries(student, view, now)).applications.map((a) => ({
          universityId: a.university.id,
          universityName: a.university.shortName,
          status: a.status,
          done: a.checklist.filter((c) => c.done).length,
          total: a.checklist.length,
          closesOn: a.window?.closesOn ?? null,
        }));
  const doors = stage === 'grade-10' ? subjectsResponse(view, latest).doors : null;

  const exams = university
    ? null
    : buildExams({ report: latest, profile, choices }, view, now).countdown;
  const nextPaper = exams?.papers.find((p) => !p.draft && p.daysLeft >= 0) ?? null;

  const checklist = university
    ? (await firstWeekResponse(student, view, null, now)).checklist
    : null;
  const firstWeek = checklist
    ? {
        done: checklist.steps.filter((s) => s.doneAt !== null).length,
        total: checklist.steps.length,
      }
    : null;
  const myModules = registration
    ? registrationResponseFrom(
        view,
        { record: registration, offers: offerRecords, channel: null },
        now,
      ).modules
    : null;
  const modules = myModules
    ? {
        confirmed: myModules.registered.length,
        toFix: myModules.status === 'checked' ? myModules.differences.length : 0,
        checked: myModules.status === 'checked',
      }
    : null;

  const data = {
    stage,
    name: profile?.displayName?.trim() || null,
    qualify: results
      ? {
          basis: results.basis,
          now: results.qualifyNow.length,
          onTrack: results.onTrack.length,
          close: results.close.length,
          planB: results.planB.length,
          checked: results.checked,
        }
      : null,
    nextPaperDays: nextPaper?.daysLeft ?? null,
    subjects: doors
      ? { status: doors.status, checked: doors.checked, closed: doors.closed, draft: doors.draft }
      : null,
    gradeCheck:
      !university && profile?.gradeCheckDue && profile.grade !== null
        ? { grade: profile.grade }
        : null,
    turningEighteen: turningEighteen(account, now),
    goalProgrammeId: goal && programmeById(view, goal.programmeId) ? goal.programmeId : null,
    shortlist,
    applications,
    universityYear,
    offers: university ? asAgentOffers(offerRecords).map((o) => offerCard(view, o, null, now)) : [],
    registration: checklist ? registrationCountdown(checklist.calendar, sastDateOf(now)) : null,
    firstWeek,
    modules,
    marks: marksOverTime(reports),
  };
  const subjectNames: Record<string, string> = {};
  for (const point of data.marks) {
    for (const m of point.marks)
      subjectNames[m.subject] = isSubjectId(m.subject) ? subject(m.subject).name : m.subject;
  }
  const { theme, avatar } = resolveLook(profile);
  return {
    ...data,
    subjectNames,
    look: { theme, avatar },
    next: nextAction({
      stage,
      universityYear: universityYear?.group ?? null,
      today: sastDateOf(now),
      hasReport: latest !== null,
      shortlisted: shortlist.length,
      hasGoal: data.goalProgrammeId !== null,
      applications,
      firstWeek,
      modules,
    }),
  };
}
