import type {
  CollegeOption,
  CollegeOptions,
  ProgrammeResult,
  Results,
} from '@universityflow/admissions';
import { CollegeCard } from '@/components/college-card';
import { ProgrammeCard } from '@/components/programme-card';
import type { GroupId, ListedInstitution, ListedProgramme, LoadedCard } from './results-list';
import { ShortlistButton } from './shortlist-button';

export type { GroupId, LoadedGroup, LoadGroup } from './results-list';

/** Plan B and the colleges' group start collapsed: their cards are fetched when opened (A4-19). */
export const COLLAPSED_GROUPS: ReadonlyArray<GroupId> = ['plan-b', 'colleges'];

export function isCollapsedGroup(id: string): id is GroupId {
  return (COLLAPSED_GROUPS as ReadonlyArray<string>).includes(id);
}

export interface ResultsGroupsInput {
  readonly results: Results;
  readonly shortlist: ReadonlySet<string>;
  /** The public TVET colleges' courses for this report (packages/admissions). Absent: none. */
  readonly colleges?: CollegeOptions | undefined;
  readonly universities?: ReadonlyArray<{ id: string; name: string }> | undefined;
}

/**
 * How /results is grouped, and each group's cards: one place, used by the page's server view
 * (the groups, the filter's institutions and the shown groups' cards) and by its server action
 * (a collapsed group's cards, when the learner opens it), so both agree. Admission facts come
 * from packages/admissions alone (hard rule 2); this only arranges them.
 */
export function resultsGroups(input: ResultsGroupsInput): {
  readonly groups: ReadonlyArray<{ id: GroupId; items: ReadonlyArray<ListedProgramme> }>;
  readonly institutions: ReadonlyArray<ListedInstitution>;
  /** The cards of one group, in the group's order. */
  readonly cardsOf: (id: GroupId) => LoadedCard[];
} {
  const { results, shortlist } = input;
  // On Grade 10 marks, and Grade 11's June and September ones, there is no Qualify now and no
  // Plan B: one On track group (G10-3, §18.7 C2).
  const grade10 = results.basis === 'progress';
  const courses: Array<{ id: GroupId; list: ReadonlyArray<ProgrammeResult> }> = grade10
    ? [
        { id: 'on-track', list: results.onTrack },
        { id: 'close', list: results.close },
      ]
    : [
        { id: 'qualify-now', list: results.qualifyNow },
        { id: 'close', list: results.close },
        { id: 'plan-b', list: results.planB },
      ];
  const listed = (r: ProgrammeResult): ListedProgramme => ({
    id: r.programmeId,
    institutionId: r.universityId,
    institutionType: 'university',
    text: `${r.name} ${r.faculty}`.toLowerCase(),
  });
  const courseCard = (r: ProgrammeResult): LoadedCard => ({
    id: r.programmeId,
    card: (
      <ProgrammeCard
        key={r.programmeId}
        result={r}
        action={
          <ShortlistButton programmeId={r.programmeId} initial={shortlist.has(r.programmeId)} />
        }
      />
    ),
  });

  // Public TVET colleges (planning.md §19.1): one card per college, its courses inside, in the
  // order packages/admissions sorted them. In Plan B on an admission report; their own group on a
  // Grade 10 one (NC(V) starts after Grade 9).
  const byCollege = new Map<string, CollegeOption[]>();
  for (const o of input.colleges?.options ?? []) {
    byCollege.set(o.collegeId, [...(byCollege.get(o.collegeId) ?? []), o]);
  }
  const collegeItems: ListedProgramme[] = [];
  const collegeCards: LoadedCard[] = [];
  const institutions: ListedInstitution[] = (input.universities ?? []).map((u) => ({
    ...u,
    type: 'university' as const,
  }));
  for (const [collegeId, options] of byCollege) {
    const [first] = options;
    if (!first) continue;
    const id = `college-${collegeId}`;
    collegeCards.push({
      id,
      card: <CollegeCard key={id} options={options} entries={input.colleges?.entries} />,
    });
    collegeItems.push({
      id,
      institutionId: collegeId,
      institutionType: 'public-tvet-college',
      text: [first.collegeName, first.collegeShortName, first.mainTown ?? '', first.province]
        .concat(options.map((o) => `${o.nameAtCollege} ${o.programme}`))
        .join(' ')
        .toLowerCase(),
    });
    institutions.push({ id: collegeId, name: first.collegeName, type: 'public-tvet-college' });
  }

  const groups = courses.map(({ id, list }) => ({
    id,
    items: id === 'plan-b' ? [...list.map(listed), ...collegeItems] : list.map(listed),
  }));
  if (grade10 && collegeItems.length > 0) groups.push({ id: 'colleges', items: collegeItems });

  const cardsOf = (id: GroupId): LoadedCard[] => {
    const own = courses.find((g) => g.id === id)?.list.map(courseCard) ?? [];
    if (id === 'plan-b') return [...own, ...collegeCards];
    if (id === 'colleges') return grade10 ? collegeCards : [];
    return own;
  };
  return { groups, institutions, cardsOf };
}
