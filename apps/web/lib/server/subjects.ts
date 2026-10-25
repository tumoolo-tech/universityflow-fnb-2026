import 'server-only';
import {
  type HigherBarReason,
  scorable,
  subjectDoors,
  swapChoices,
  trySwap,
} from '@universityflow/admissions';
import {
  type CatalogueView,
  isSubjectId,
  type Programme,
  type SubjectId,
  type SubjectOption,
  subject,
} from '@universityflow/catalogue';
import type { ConfirmedReport } from '@universityflow/db';
import type {
  SubjectsBar,
  SubjectsCourse,
  SubjectsHigherReason,
  SubjectsResponse,
} from '@universityflow/ui';

/**
 * My subjects (G10-4): what the subjects on the learner's latest confirmed report keep open
 * (hard rule 6: only subjects the learner confirmed), worked out by `subjectDoors` from the
 * courses the learner may see (hard rule 3). The page, the home's card and the app all read this;
 * its shape is in `@universityflow/ui`. It decides nothing: it puts the admissions answers into
 * names (subjects, full university names) for the two apps.
 */

export type { SubjectsCourse, SubjectsResponse } from '@universityflow/ui';

export interface SubjectsOptions {
  /** The learner's goal course id, if any: shown only when the learner may see the course. */
  readonly goalId?: string | null | undefined;
  /** "Try a different subject" (`?drop=&take=`): anything `trySwap` doesn't offer is ignored. */
  readonly drop?: string | null | undefined;
  readonly take?: string | null | undefined;
}

const nameOf = (id: string) => (isSubjectId(id) ? subject(id).name : id);
const namesOf = (ids: ReadonlyArray<string>) => ids.map(nameOf);

const bar = (option: SubjectOption): SubjectsBar => ({
  subjects: namesOf(option.subjects),
  level: option.minLevel ?? null,
  percent: option.minPercent ?? null,
});

const reason = (r: HigherBarReason): SubjectsHigherReason =>
  r.kind === 'score'
    ? { kind: 'score', subject: nameOf(r.subject), score: r.score, otherwise: r.otherwise }
    : { kind: 'option', yours: bar(r.yours), lowest: bar(r.lowest) };

function goalStatus(
  closed: boolean,
  higherBar: ReadonlyArray<Programme>,
  id: string,
): 'open' | 'higher-bar' | 'closed' {
  if (closed) return 'closed';
  return higherBar.some((p) => p.id === id) ? 'higher-bar' : 'open';
}

export function subjectsResponse(
  view: CatalogueView,
  latest: ConfirmedReport | null,
  options: SubjectsOptions = {},
): SubjectsResponse {
  if (!latest) return { report: null, subjects: [], doors: null };
  const ids: SubjectId[] = latest.marks.map((m) => m.subject).filter(isSubjectId);
  const doors = subjectDoors(view, ids);
  const university = new Map(view.universities.map((u) => [u.id, u.name]));
  const shortName = new Map(view.universities.map((u) => [u.id, u.shortName]));
  // What I need shows exactly the courses `scorable` returns (`whatINeedFor`): link only those.
  const linkable = new Set(scorable(view).map((p) => p.id));
  const course = (p: Programme): SubjectsCourse => ({
    id: p.id,
    name: p.name,
    universityId: p.universityId,
    universityName: university.get(p.universityId) ?? '',
    universityShortName: shortName.get(p.universityId) ?? '',
    linkable: linkable.has(p.id),
  });
  const missing = new Map(doors.closedCourses.map((c) => [c.programme.id, c.missing]));
  const choices = swapChoices(doors, ids);
  const swap = options.drop && options.take ? trySwap(view, ids, options.drop, options.take) : null;
  const goal = options.goalId ? view.programmes.find((p) => p.id === options.goalId) : undefined;
  const goalMissing = goal ? missing.get(goal.id) : undefined;

  return {
    report: { kind: latest.kind },
    subjects: ids
      .map((id) => ({ id, name: nameOf(id) }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    doors: {
      status: doors.status,
      checked: doors.checked,
      open: doors.open,
      closed: doors.closed,
      draft: doors.draft,
      byUniversity: doors.byUniversity
        .map((u) => ({
          id: u.universityId,
          name: university.get(u.universityId) ?? u.universityId,
          shortName: shortName.get(u.universityId) ?? u.universityId,
          checked: u.checked,
          closed: u.closed,
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
      groups: doors.groups.map((g) => {
        const key = g.subjects.join('|');
        return {
          subjects: namesOf(g.subjects),
          programmes: g.programmes.map((p) => ({
            ...course(p),
            alsoNeeds: (missing.get(p.id) ?? [])
              .filter((needed) => needed.join('|') !== key)
              .map(namesOf),
          })),
        };
      }),
      higherBar: doors.higherBarReasons.map((h) => ({
        ...course(h.programme),
        reasons: h.reasons.map(reason),
      })),
      goal: goal
        ? {
            course: course(goal),
            status: goalStatus(goalMissing !== undefined, doors.higherBar, goal.id),
            needs: (goalMissing ?? []).map(namesOf),
          }
        : null,
      swap: {
        drop: choices.drop.map((id) => ({ id, name: nameOf(id) })),
        take: choices.take.map((id) => ({ id, name: nameOf(id) })),
      },
      whatIf: swap
        ? {
            drop: { id: swap.drop, name: nameOf(swap.drop) },
            take: { id: swap.take, name: nameOf(swap.take) },
            checked: swap.doors.checked,
            closed: swap.doors.closed,
            opened: swap.opened.map(course),
            closes: swap.closes.map(course),
          }
        : null,
    },
  };
}
