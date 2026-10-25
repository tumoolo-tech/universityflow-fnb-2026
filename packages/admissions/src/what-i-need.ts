import {
  type CatalogueView,
  ENGLISH,
  isDraft,
  isHomeLanguage,
  isOptionsRequirement,
  LIFE_ORIENTATION,
  type Programme,
  type RequiredPass,
  type SubjectId,
  type UniversityId,
} from '@universityflow/catalogue';
import { marksBasis, type ScoredReport } from './basis';
import { checkProgramme, minimumScoreFor, requiredGroups } from './eligibility';
import { type SubjectMark, validateMarks } from './marks';
import { meetsPass, nscPass, type PassOutcome } from './pass-type';
import { type ResultVerdict, scorable, shownVerdict } from './results';
import type { ScoreMethod } from './scoring/engine';
import { methodFor } from './universities/methods';

/**
 * "What I need per subject" (planning.md §11, Phase 4c): for one target programme and the
 * learner's confirmed marks, the mark each subject needs for the learner to meet every published
 * minimum. Pure code, like the rest of this package; the agent explains the plan and never works
 * out a mark itself (hard rule 2).
 *
 * **How the plan is built.** Marks only ever go up, never past 100%, in three steps, repeated
 * until the programme's own check (`checkProgramme`) says the learner qualifies:
 *
 * 1. **Subject minimums.** Each unmet requirement raises the subject `checkProgramme` reports as
 *    closest (for "Mathematics 5 or Mathematical Literacy 7", the one the learner takes and is
 *    nearer to) exactly to its minimum. "Any N other subjects" raises the N best of the subjects
 *    not used elsewhere, never Life Orientation.
 * 2. **The NSC pass.** The DBE's rules, applied to the best subjects first: a home language at
 *    40%, two more subjects at 40% and three at 30%, English at 30%, and four 20-credit subjects
 *    (not Life Orientation) at 40% for a diploma pass or 50% for a bachelor's pass.
 * 3. **The minimum score**, under that university's own method (Life Orientation, bonus points,
 *    subjects that must count: all as the method says). One step at a time: of every subject, the
 *    one that needs the **smallest raise to earn the method any more points** goes up to exactly
 *    that mark. Ties go to the step worth more points (UCT Science's doubled subjects), then to
 *    the lower mark (spreading the work rather than piling it on one subject), then to a subject
 *    the programme requires, then alphabetically, so the plan is the same every time. It is a
 *    simple rule a learner can follow, not a promise of the fewest marks in every case.
 *
 * A plan can't be met when no marks would do it: a required subject the learner doesn't take,
 * too few subjects, no home language or English, or a score that 100% in everything wouldn't
 * reach. The plan says which, plainly, and never invents a way round it.
 */

/** Why a subject's target is above its mark, in the order the steps raised it. */
export type TargetReason = 'subject-minimum' | 'other-subjects' | 'pass' | 'score';

export interface SubjectTarget {
  readonly subject: SubjectId;
  /** The confirmed mark. */
  readonly current: number;
  /** The mark to reach: never above 100, never below `current`. */
  readonly target: number;
  /** `target - current`: 0 when the subject is fine as it is. */
  readonly gap: number;
  readonly reasons: ReadonlyArray<TargetReason>;
  /** The programme names this subject in one of its requirements. */
  readonly requiredByProgramme: boolean;
}

/** Why no marks would meet the programme's minimums. */
export type Blocker =
  /** A requirement only subjects the learner doesn't take can meet. */
  | { readonly kind: 'subject-not-taken'; readonly subjects: ReadonlyArray<SubjectId> }
  /** "Any N other subjects", or the NSC pass, needs more subjects than the learner takes. */
  | { readonly kind: 'not-enough-subjects'; readonly needed: number; readonly available: number }
  /** An NSC pass needs a home language at 40%. */
  | { readonly kind: 'no-home-language' }
  /** A higher certificate, diploma or bachelor's pass needs English (the language of teaching). */
  | { readonly kind: 'no-english' }
  /** Even 100% in every subject scores less than the minimum. */
  | { readonly kind: 'score-out-of-reach'; readonly best: number; readonly required: number };

export type PlanStatus =
  /** Every minimum is met already: nothing changes. */
  | 'qualifies'
  /** The same on Grade 10 marks, which no university admits on (G10-3). */
  | 'on-track'
  /** The targets meet every minimum. */
  | 'reachable'
  /** No marks would: see `blockers`. */
  | 'unreachable';

export interface WhatINeedPlan {
  readonly status: PlanStatus;
  /** The verdict on the confirmed marks, as My results shows it. */
  readonly verdictNow: ResultVerdict;
  /** Every subject the learner takes: those that must rise first, biggest gap first. */
  readonly subjects: ReadonlyArray<SubjectTarget>;
  /** Percentage points to gain across all subjects. */
  readonly totalGap: number;
  readonly score: {
    readonly methodId: string;
    readonly label: string;
    readonly unit: 'points' | 'percent';
    readonly maximum: number;
    readonly required: number | null;
    readonly now: number;
    readonly atTarget: number;
  };
  readonly pass: {
    readonly required: RequiredPass;
    readonly now: PassOutcome;
    readonly atTarget: PassOutcome;
  };
  readonly blockers: ReadonlyArray<Blocker>;
}

const MAX_ROUNDS = 6;
const PASS_FLOOR: Readonly<Record<RequiredPass, number | null>> = {
  'higher-certificate': null,
  diploma: 40,
  bachelor: 50,
};

type Targets = Map<SubjectId, number>;

const toMarks = (targets: Targets): SubjectMark[] =>
  [...targets].map(([subject, percent]) => ({ subject, percent }));

/** Highest first; ties alphabetically, so every plan is reproducible. */
const byTargetDescending = (targets: Targets): SubjectId[] =>
  [...targets.keys()].sort(
    (a, b) => (targets.get(b) as number) - (targets.get(a) as number) || a.localeCompare(b),
  );

function namedSubjects(programme: Programme): ReadonlySet<SubjectId> {
  return new Set(
    programme.subjectRequirements
      .filter(isOptionsRequirement)
      .flatMap((r) => r.options.flatMap((o) => o.subjects)),
  );
}

interface Step {
  readonly subject: SubjectId;
  readonly to: number;
  readonly cost: number;
  readonly gain: number;
  readonly required: boolean;
  readonly from: number;
}

/** The order described above: smaller raise, more points, lower mark, required, alphabetical. */
function better(a: Step, b: Step): boolean {
  if (a.cost !== b.cost) return a.cost < b.cost;
  if (a.gain !== b.gain) return a.gain > b.gain;
  if (a.from !== b.from) return a.from < b.from;
  if (a.required !== b.required) return a.required;
  return a.subject.localeCompare(b.subject) < 0;
}

export function whatINeed(
  programme: Programme,
  input: ReadonlyArray<SubjectMark>,
  method: ScoreMethod,
): WhatINeedPlan {
  const current = validateMarks(input);
  const now = checkProgramme(programme, current, method);
  const targets: Targets = new Map(current.map((m) => [m.subject, m.percent]));
  const reasons = new Map<SubjectId, TargetReason[]>();
  const blockers = new Map<string, Blocker>();
  const named = namedSubjects(programme);
  const groups = requiredGroups(programme);
  const required = minimumScoreFor(programme, current);

  const block = (blocker: Blocker) => blockers.set(JSON.stringify(blocker), blocker);
  const raise = (subject: SubjectId, to: number, why: TargetReason) => {
    const mark = Math.min(100, to);
    if ((targets.get(subject) as number) >= mark) return;
    targets.set(subject, mark);
    const list = reasons.get(subject) ?? [];
    if (!list.includes(why)) list.push(why);
    reasons.set(subject, list);
  };
  const scoreOf = (t: Targets) => method.score(toMarks(t), { requiredGroups: groups }).total;

  function meetSubjectMinimums() {
    for (const r of checkProgramme(programme, toMarks(targets), method).requirements) {
      if (r.met) continue;
      if (isOptionsRequirement(r.requirement)) {
        if (r.closest.best)
          raise(r.closest.best.subject, r.closest.targetPercent, 'subject-minimum');
        else {
          block({
            kind: 'subject-not-taken',
            subjects: [...new Set(r.requirement.options.flatMap((o) => o.subjects))],
          });
        }
        continue;
      }
      const { count } = r.requirement.otherSubjects;
      const pool = r.closest.option.subjects;
      if (pool.length < count) {
        block({ kind: 'not-enough-subjects', needed: count, available: pool.length });
      }
      for (const subject of byTargetDescending(targets)
        .filter((s) => pool.includes(s))
        .slice(0, count)) {
        raise(subject, r.closest.targetPercent, 'other-subjects');
      }
    }
  }

  function meetPass() {
    if (meetsPass(nscPass(toMarks(targets)), programme.requiredPass)) return;
    const ranked = byTargetDescending(targets);
    const home = ranked.find(isHomeLanguage);
    if (home) raise(home, 40, 'pass');
    else block({ kind: 'no-home-language' });
    const rest = ranked.filter((s) => s !== home);
    if (rest.length < 5)
      block({ kind: 'not-enough-subjects', needed: 6, available: ranked.length });
    for (const s of rest.slice(0, 2)) raise(s, 40, 'pass');
    for (const s of rest.slice(2, 5)) raise(s, 30, 'pass');
    const english = ranked.find((s) => (ENGLISH as ReadonlyArray<SubjectId>).includes(s));
    if (english) raise(english, 30, 'pass');
    else block({ kind: 'no-english' });
    const floor = PASS_FLOOR[programme.requiredPass];
    if (floor === null) return;
    const credits = byTargetDescending(targets).filter((s) => s !== LIFE_ORIENTATION);
    if (credits.length < 4)
      block({ kind: 'not-enough-subjects', needed: 4, available: credits.length });
    for (const s of credits.slice(0, 4)) raise(s, floor, 'pass');
  }

  function meetScore() {
    if (required === null) return;
    let total = scoreOf(targets);
    if (total >= required) return;
    const best = scoreOf(new Map([...targets.keys()].map((s) => [s, 100])));
    if (best < required) {
      block({ kind: 'score-out-of-reach', best, required });
      return;
    }
    // Each step raises a subject, so the total climbs to at most `best`, which meets `required`.
    while (total < required) {
      let step: Step | null = null;
      for (const subject of byTargetDescending(targets)) {
        const from = targets.get(subject) as number;
        for (let to = from + 1; to <= 100; to++) {
          if (step && to - from > step.cost) break;
          const trial = new Map(targets).set(subject, to);
          const gain = scoreOf(trial) - total;
          if (gain <= 0) continue;
          const candidate = {
            subject,
            to,
            cost: to - from,
            gain,
            required: named.has(subject),
            from,
          };
          if (!step || better(candidate, step)) step = candidate;
          break;
        }
      }
      // With every subject at 100% meeting the minimum, some raise always adds points.
      const chosen = step as Step;
      raise(chosen.subject, chosen.to, 'score');
      // Recomputed, not accumulated: an average's gains are decimals.
      total = scoreOf(targets);
    }
  }

  if (now.verdict !== 'qualifies') {
    for (let round = 0; round < MAX_ROUNDS; round++) {
      meetSubjectMinimums();
      meetPass();
      meetScore();
      if (blockers.size > 0) break;
      if (checkProgramme(programme, toMarks(targets), method).verdict === 'qualifies') break;
    }
  }

  const after = checkProgramme(programme, toMarks(targets), method);
  const subjects = current
    .map(
      (m): SubjectTarget => ({
        subject: m.subject,
        current: m.percent,
        target: targets.get(m.subject) as number,
        gap: (targets.get(m.subject) as number) - m.percent,
        reasons: reasons.get(m.subject) ?? [],
        requiredByProgramme: named.has(m.subject),
      }),
    )
    .sort((a, b) => b.gap - a.gap || b.current - a.current || a.subject.localeCompare(b.subject));

  return {
    status:
      now.verdict === 'qualifies'
        ? 'qualifies'
        : blockers.size === 0 && after.verdict === 'qualifies'
          ? 'reachable'
          : 'unreachable',
    verdictNow: now.verdict,
    subjects,
    totalGap: subjects.reduce((sum, s) => sum + s.gap, 0),
    score: {
      methodId: method.id,
      label: method.label,
      unit: method.unit,
      maximum: method.maximum,
      required,
      now: now.score.total,
      atTarget: after.score.total,
    },
    pass: {
      required: programme.requiredPass,
      now: now.pass.projected,
      atTarget: after.pass.projected,
    },
    blockers: [...blockers.values()],
  };
}

/** One programme's plan, as the agent's tool and both apps show it. */
export interface WhatINeedResult {
  readonly programmeId: string;
  readonly universityId: UniversityId;
  readonly universityName: string;
  readonly name: string;
  readonly plan: WhatINeedPlan;
  readonly sourceUrl: string;
  readonly methodSourceUrl: string;
  readonly academicYear: number;
  /** True while the record or its score method is unverified (only ever shown in preview). */
  readonly draft: boolean;
}

/**
 * The plan for a programme the learner can see, or null when it isn't one. Exactly the
 * programmes `assessAll` scores: a draft record, or a verified record scored by a draft method,
 * only in preview, and labelled (hard rule 3). On Grade 10 marks a met plan is `on-track`, as on
 * My results (G10-3).
 */
export function whatINeedFor(
  view: CatalogueView,
  programmeId: string,
  report: ScoredReport,
): WhatINeedResult | null {
  const programme = scorable(view).find((p) => p.id === programmeId);
  if (!programme) return null;
  const method = methodFor(programme);
  const basis = marksBasis(report.kind);
  const plan = whatINeed(programme, report.marks, method);
  return {
    programmeId: programme.id,
    universityId: programme.universityId,
    universityName:
      view.universities.find((u) => u.id === programme.universityId)?.shortName ??
      programme.universityId,
    name: programme.name,
    plan:
      basis === 'progress'
        ? {
            ...plan,
            status: plan.status === 'qualifies' ? 'on-track' : plan.status,
            verdictNow: shownVerdict(plan.verdictNow, basis),
          }
        : plan,
    sourceUrl: programme.sourceUrl,
    methodSourceUrl: method.source.sourceUrl,
    academicYear: programme.academicYear,
    draft: isDraft(programme) || isDraft(method.source),
  };
}
