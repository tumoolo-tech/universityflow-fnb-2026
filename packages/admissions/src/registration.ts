import {
  type Curriculum,
  type CurriculumModule,
  type ElectiveGroup,
  type ModuleTerm,
  normaliseModuleCode,
  offeredIn,
} from '@universityflow/catalogue';

/**
 * The registration check (planning.md §11, Phase 5c): a learner's confirmed modules against their
 * programme's published first-year curriculum. Code decides what is missing or wrong; the AI and
 * the screens only explain it (hard rule 2). The result is typed data, never words: the wording,
 * who to see and the suggested message come from `packages/content`.
 *
 * Only ever called with a curriculum record from the catalogue view. A programme with no
 * curriculum gets no check at all, and the learner is told so: never a guess (planning.md §11,
 * definition of done).
 *
 * Every registered module must be one the learner has confirmed (hard rule 6). Module codes are
 * compared after `normaliseModuleCode` (case and spaces); names are never compared, since a
 * proof of registration may abbreviate them. Credits come from the curriculum for a module it
 * lists, and from the registration only for one it doesn't.
 *
 * Pure: no I/O, no clock, React-Native-safe (hard rule 11).
 */

/** One module the learner confirmed from their proof of registration. */
export interface RegisteredModule {
  readonly code: string;
  readonly name?: string | undefined;
  /** When the proof says it runs, if it says. */
  readonly semester?: ModuleTerm | undefined;
  /** The credits the proof gives it, if it does. Used only for a module the curriculum lacks. */
  readonly credits?: number | undefined;
}

/** A registered module the curriculum lists. */
export interface ModuleMatch {
  readonly module: CurriculumModule;
  readonly registered: RegisteredModule;
}

/**
 * Every kind of difference, in the order the result lists them: content keeps one wording per
 * kind, and a test holds it to this list.
 */
export const DIFFERENCE_KINDS = [
  'missing-compulsory',
  'wrong-semester',
  'not-in-curriculum',
  'registered-twice',
  'elective-group-unsatisfied',
  'credits-short',
  'credits-over',
] as const;
export type DifferenceKind = (typeof DIFFERENCE_KINDS)[number];

export type RegistrationDifference =
  /** A compulsory module the learner isn't registered for. */
  | { readonly kind: 'missing-compulsory'; readonly module: CurriculumModule }
  /** Registered for a curriculum module, but in a term the curriculum doesn't offer it in. */
  | {
      readonly kind: 'wrong-semester';
      readonly module: CurriculumModule;
      readonly registered: RegisteredModule & { readonly semester: ModuleTerm };
    }
  /** A registered module the curriculum doesn't list (perhaps a typo, perhaps another programme's). */
  | { readonly kind: 'not-in-curriculum'; readonly registered: RegisteredModule }
  /** The same code more than once: counted once. `registered` holds every occurrence. */
  | {
      readonly kind: 'registered-twice';
      readonly code: string;
      readonly registered: ReadonlyArray<RegisteredModule>;
    }
  /**
   * An elective group not satisfied: how many credits, or how many modules, are still short; or,
   * for a group of alternative sets, the sets as printed, since no one whole set was taken alone.
   */
  | {
      readonly kind: 'elective-group-unsatisfied';
      readonly group: ElectiveGroup;
      /** The group's position in `curriculum.electiveGroups`. */
      readonly groupIndex: number;
      /** The group's modules the learner is registered for. */
      readonly chosen: ReadonlyArray<CurriculumModule>;
      readonly short:
        | { readonly credits: number }
        | { readonly count: number }
        | { readonly oneSetOf: ReadonlyArray<ReadonlyArray<string>> };
    }
  /** Below the published minimum. Only said when every module's credits are known. */
  | {
      readonly kind: 'credits-short';
      readonly registered: number;
      readonly min: number;
      readonly short: number;
    }
  /** Above the published maximum (already over on the credits that are known). */
  | {
      readonly kind: 'credits-over';
      readonly registered: number;
      readonly max: number;
      readonly over: number;
    };

export interface RegistrationComparison {
  readonly programmeId: string;
  /** The rule book's year, so the learner sees which year's curriculum this was checked against. */
  readonly academicYear: number;
  /** Registered modules the curriculum lists, in registration order (each code once). */
  readonly matched: ReadonlyArray<ModuleMatch>;
  /**
   * Registered modules the curriculum doesn't list, counted against its open elective credits
   * (A1-27) in registration order: not differences. Empty when the curriculum allows none.
   */
  readonly openElectives: ReadonlyArray<RegisteredModule>;
  /** Empty when the registration matches the curriculum. Ordered as `DIFFERENCE_KINDS`. */
  readonly differences: ReadonlyArray<RegistrationDifference>;
  readonly credits: {
    /** The credits counted: the curriculum's for listed modules, the proof's for the rest. */
    readonly registered: number;
    /** Codes not in the curriculum whose credits the proof doesn't give: not counted. */
    readonly uncounted: ReadonlyArray<string>;
    readonly min: number;
    readonly max: number;
  };
}

/** Compares a learner's confirmed registration with their programme's curriculum. */
export function compareRegistration(
  registered: ReadonlyArray<RegisteredModule>,
  curriculum: Curriculum,
): RegistrationComparison {
  // Every printed code, alternatives included, to its module (UCT's ECO1010F and ECO1010S).
  const byCode = new Map(
    curriculum.modules.flatMap((m) =>
      [m.code, ...(m.alternativeCodes ?? [])].map(
        (code) => [normaliseModuleCode(code), m] as const,
      ),
    ),
  );
  const { firsts, repeats } = onceEach(registered, byCode);

  const matched: ModuleMatch[] = [];
  const unlisted: RegisteredModule[] = [];
  for (const [code, r] of firsts) {
    const module = byCode.get(code);
    if (module) matched.push({ module, registered: r });
    else unlisted.push(r);
  }
  const taken = new Set(matched.map((m) => normaliseModuleCode(m.module.code)));
  const { open, unknown } = openElectives(unlisted, curriculum.openElectiveCredits?.credits ?? 0);

  const differences: RegistrationDifference[] = [
    ...curriculum.modules
      .filter((module) => module.compulsory && !taken.has(normaliseModuleCode(module.code)))
      .map((module) => ({ kind: 'missing-compulsory' as const, module })),
    ...matched.flatMap(wrongSemester),
    ...unknown.map((r) => ({ kind: 'not-in-curriculum' as const, registered: r })),
    ...[...repeats].map(([code, all]) => ({
      kind: 'registered-twice' as const,
      code,
      registered: all,
    })),
    ...curriculum.electiveGroups.flatMap(
      (group, groupIndex) => groupShortfall(group, groupIndex, byCode, taken) ?? [],
    ),
  ];

  // Credits for a module the curriculum doesn't list (open elective or not) come from the proof.
  const total =
    sum(matched.map((m) => m.module.credits)) +
    sum(unlisted.flatMap((r) => (isCredit(r.credits) ? [r.credits] : [])));
  const uncounted = unlisted.filter((r) => !isCredit(r.credits)).map((r) => r.code);
  const { min, max } = curriculum.totalCredits;
  if (total < min && uncounted.length === 0) {
    differences.push({ kind: 'credits-short', registered: total, min, short: min - total });
  }
  if (total > max) {
    differences.push({ kind: 'credits-over', registered: total, max, over: total - max });
  }

  return {
    programmeId: curriculum.programmeId,
    academicYear: curriculum.academicYear,
    matched,
    openElectives: open,
    differences,
    credits: { registered: total, uncounted, min, max },
  };
}

/**
 * Each module once, in registration order, and every occurrence of one given more than once. A
 * code the curriculum lists is keyed by its module's primary code, so a module registered under
 * two of its codes (ECO1010F and ECO1010S) counts as registered twice.
 */
function onceEach(
  registered: ReadonlyArray<RegisteredModule>,
  byCode: ReadonlyMap<string, CurriculumModule>,
): {
  firsts: Map<string, RegisteredModule>;
  repeats: Map<string, RegisteredModule[]>;
} {
  const firsts = new Map<string, RegisteredModule>();
  const repeats = new Map<string, RegisteredModule[]>();
  for (const r of registered) {
    const own = normaliseModuleCode(r.code);
    const listed = byCode.get(own);
    const code = listed ? normaliseModuleCode(listed.code) : own;
    const first = firsts.get(code);
    if (first === undefined) firsts.set(code, r);
    else repeats.set(code, [...(repeats.get(code) ?? [first]), r]);
  }
  return { firsts, repeats };
}

/**
 * A matched module registered in a term the curriculum doesn't offer it in. None when either side
 * doesn't state a term: the proof gives none, or the rule book prints none for the module.
 */
function wrongSemester({ module, registered }: ModuleMatch): RegistrationDifference[] {
  const { semester } = registered;
  const offered = module.semester;
  if (semester === undefined || offered === undefined || offeredIn(offered, semester)) return [];
  return [{ kind: 'wrong-semester', module, registered: { ...registered, semester } }];
}

/** How far a group is from satisfied, or null when it is. */
function groupShortfall(
  group: ElectiveGroup,
  groupIndex: number,
  byCode: ReadonlyMap<string, CurriculumModule>,
  taken: ReadonlySet<string>,
): RegistrationDifference | null {
  const isTaken = (code: string) => {
    const m = byCode.get(normaliseModuleCode(code));
    return m !== undefined && taken.has(normaliseModuleCode(m.code));
  };
  const chosen = group.from
    .map((code) => byCode.get(normaliseModuleCode(code)))
    .filter((m): m is CurriculumModule => m !== undefined)
    .filter((m) => taken.has(normaliseModuleCode(m.code)));
  const { choose } = group;
  if ('oneSetOf' in choose) {
    // Satisfied by every module of one set and nothing from any other (A13-05): a mixed pair, half
    // a set or both sets is a difference, whatever the credits add up to.
    const whole = choose.oneSetOf.filter((set) => set.every(isTaken));
    const touched = choose.oneSetOf.filter((set) => set.some(isTaken));
    if (whole.length === 1 && touched.length === 1) return null;
    return {
      kind: 'elective-group-unsatisfied',
      group,
      groupIndex,
      chosen,
      short: { oneSetOf: choose.oneSetOf },
    };
  }
  const short =
    'credits' in choose
      ? { credits: Math.max(0, choose.credits - sum(chosen.map((m) => m.credits))) }
      : { count: Math.max(0, choose.count - chosen.length) };
  const missing = 'credits' in short ? short.credits : short.count;
  if (missing === 0) return null;
  return { kind: 'elective-group-unsatisfied', group, groupIndex, chosen, short };
}

/**
 * Splits the registered modules the curriculum doesn't list into open electives and the rest
 * (A1-27). In registration order, each counts as an open elective while open credits remain, and
 * uses its credits from the proof; one whose credits the proof doesn't give uses up whatever is
 * left, since nobody knows how much it takes. With no open credits, every one is "not in the
 * curriculum".
 */
function openElectives(
  unlisted: ReadonlyArray<RegisteredModule>,
  credits: number,
): { open: RegisteredModule[]; unknown: RegisteredModule[] } {
  const open: RegisteredModule[] = [];
  const unknown: RegisteredModule[] = [];
  let left = credits;
  for (const r of unlisted) {
    if (left <= 0) {
      unknown.push(r);
      continue;
    }
    open.push(r);
    left = isCredit(r.credits) ? left - r.credits : 0;
  }
  return { open, unknown };
}

function isCredit(value: number | undefined): value is number {
  return value !== undefined && Number.isFinite(value) && value >= 0;
}

function sum(values: ReadonlyArray<number>): number {
  return values.reduce((a, b) => a + b, 0);
}
