import 'server-only';
import { assessAll, type ProgrammeResult } from '@universityflow/admissions';
import { APPLICATION_CHECKLIST, targetIntakeFor } from '@universityflow/agent';
import type { ApplicationWindow, CatalogueView, University } from '@universityflow/catalogue';
import type { ApplicationStatus, StudentStore } from '@universityflow/db';
import { scored } from './scored';

/**
 * Stage 2: the learner's shortlist grouped into one application per university, each with its
 * window, fee, programmes, status and checklist. Facts from the catalogue; progress from the
 * learner's own records.
 */

export interface ApplicationSummary {
  readonly university: University;
  readonly window: ApplicationWindow | null;
  readonly programmes: ReadonlyArray<ProgrammeResult>;
  readonly status: ApplicationStatus;
  readonly reference: string | null;
  readonly checklist: ReadonlyArray<{ item: string; done: boolean }>;
}

export async function applicationSummaries(
  student: StudentStore,
  view: CatalogueView,
  today = new Date(),
): Promise<{ applications: ApplicationSummary[]; targetIntake: number }> {
  const [shortlist, records, report, profile] = await Promise.all([
    student.shortlist(),
    student.applications(),
    student.latestReport(),
    student.profile(),
  ]);
  const results = report ? assessAll(view, scored(report)) : null;
  const all = results
    ? [...results.qualifyNow, ...results.onTrack, ...results.close, ...results.planB]
    : [];
  const programmeIds = new Set(shortlist.map((s) => s.programmeId));
  const universityIds = new Set(
    view.programmes.filter((p) => programmeIds.has(p.id)).map((p) => p.universityId),
  );

  const universities = view.universities.filter((u) => universityIds.has(u.id));
  // Every university's checklist at once: one wait for the database, not one per university (the
  // judge demo's slow home, 2026-10-25, where each wait is a round trip to London).
  const checklists = await Promise.all(
    universities.map((u) => student.checklist(`application:${u.id}`)),
  );
  const applications: ApplicationSummary[] = [];
  for (const [i, university] of universities.entries()) {
    const record = records.find((r) => r.universityId === university.id);
    const done = new Map((checklists[i] ?? []).map((c) => [c.item, c.doneAt !== null]));
    applications.push({
      university,
      window: view.windows.find((w) => w.universityId === university.id) ?? null,
      programmes: all.filter(
        (r) => r.universityId === university.id && programmeIds.has(r.programmeId),
      ),
      status: record?.status ?? 'planning',
      reference: record?.reference ?? null,
      checklist: APPLICATION_CHECKLIST.map((item) => ({ item, done: done.get(item) ?? false })),
    });
  }
  return { applications, targetIntake: targetIntakeFor(profile?.grade ?? null, today) };
}
