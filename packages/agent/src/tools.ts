import {
  assessAll,
  assessOne,
  isFinalOffer,
  marksBasis,
  type RegistrationDifference,
  whatINeedFor,
} from '@universityflow/admissions';
import {
  examGrade,
  type Helpline,
  isDraft,
  isSubjectId,
  type ReportKind,
  reportGrade,
  type SubjectId,
  UNIVERSITY_IDS,
  type UniversityId,
} from '@universityflow/catalogue';
import { crisisWords, type HelplineCover } from '@universityflow/content';
import type {
  Artifact,
  CrisisCampusLines,
  CrisisCardArtifact,
  GoalCardArtifact,
  OfferCardArtifact,
} from '@universityflow/ui';
import { z } from 'zod';
import {
  acceptedUniversity,
  arrivalYear,
  campusSafetyLines,
  campusTour,
  campusUniversity,
  firstWeek,
} from './campus';
import { NSFAS_DECIDES } from './charter';
import type { AgentContext } from './context';
import type { DistressTopic } from './crisis';
import { examCountdown, goalCard } from './goals';
import { myModules } from './modules';
import { finalResultsFrom, offerCard } from './offers';
import { practicePlan } from './practice';
import { safetyAdviceForModel, tourSafetyNotes } from './safety-notes';

/**
 * The agent's tools (planning.md §4.4). Each is a tested function over the catalogue, the
 * calculators and the learner's own data. The model chooses when to call one; the code decides
 * the answer (hard rule 2). Inputs are validated before anything runs.
 *
 * A tool returns two things: compact facts for the model to explain, and the artifacts the
 * learner sees. The model never builds an artifact itself.
 */

export interface ToolResult {
  /** JSON-serialisable facts for the model. */
  readonly forModel: unknown;
  readonly artifacts: ReadonlyArray<Artifact>;
}

export interface Tool<I extends z.ZodType = z.ZodType> {
  readonly name: string;
  readonly description: string;
  readonly input: I;
  run(context: AgentContext, input: z.infer<I>): Promise<ToolResult>;
}

/** Items on every application checklist, in order. Labels live in packages/content. */
export const APPLICATION_CHECKLIST = [
  'certified-id',
  'grade-11-report',
  'proof-of-residence',
  'guardian-id',
  'fee-paid',
  'choices-ordered',
  'nbt-booked',
  'residence-applied',
  'submitted',
] as const;

const NO_REPORT = {
  forModel: {
    status: 'no-confirmed-report',
    instruction:
      'The learner has not confirmed any marks yet. Ask them to upload their latest school report or type their marks in. Do not guess their marks.',
  },
  artifacts: [],
} as const satisfies ToolResult;

/** Said with every result on Grade 10 marks (G10-3): what the code decided, for the model to keep. */
const GRADE_10_NOTE =
  'These are Grade 10 marks. No university admits on them, so nothing here is something the learner qualifies for: on_track means their marks today would meet the published minimums. Say "on track", never "you qualify". Their final Grade 11 report is the first that universities use.';

/** The same, on a Grade 11 June or September report (§18.7 C2): marks no university admits on. */
const INTERIM_NOTE =
  'These are Grade 11 June or September marks. Universities admit on the final Grade 11 report, not these, so nothing here is something the learner qualifies for: on_track means their marks today would meet the published minimums. Say "on track", never "you qualify".';

/** The note, for any tool's facts that carry a verdict on this report (A10-32). */
function grade10Note(report: { kind: ReportKind } | null) {
  if (!report || marksBasis(report.kind) !== 'progress') return {};
  return reportGrade(report.kind) === 10
    ? { grade_10_marks: GRADE_10_NOTE }
    : { interim_marks: INTERIM_NOTE };
}

function define<I extends z.ZodType>(tool: Tool<I>): Tool<I> {
  return tool;
}

export const myResults = define({
  name: 'my_results',
  description:
    "Checks the learner's confirmed marks against every programme in the catalogue and returns the programmes they qualify for (on Grade 10 marks or a Grade 11 June or September report, the ones they are on track for), the ones they are close to (with exactly what to improve), and Plan B options. Use it whenever the learner asks what they can study, what they qualify for, or how their marks compare.",
  input: z.object({}),
  async run(context) {
    const report = await context.latestReport();
    if (!report) return NO_REPORT;
    const results = assessAll(context.catalogue, report);
    const brief = (list: typeof results.qualifyNow) =>
      list.slice(0, 12).map((r) => ({
        programme_id: r.programmeId,
        university: r.universityName,
        name: r.name,
        score: `${r.score}/${r.scoreMaximum} ${r.scoreLabel}`,
        required: r.requiredScore,
        gap: r.scoreGap,
        to_improve: r.shortfalls.map((s) => ({
          subject: s.subject ?? s.subjects.join(' or '),
          now: s.percent,
          needs: s.targetPercent,
        })),
      }));
    return {
      forModel: {
        report: report.kind,
        ...grade10Note(report),
        projected_pass: results.passProjected,
        qualify_now: { count: results.qualifyNow.length, top: brief(results.qualifyNow) },
        ...(results.basis === 'progress'
          ? { on_track: { count: results.onTrack.length, top: brief(results.onTrack) } }
          : {}),
        close: { count: results.close.length, top: brief(results.close) },
        plan_b: { count: results.planB.length, top: brief(results.planB) },
        programmes_checked: results.checked,
        unverified_preview_data: results.includesDrafts,
      },
      artifacts: [
        {
          kind: 'results-card',
          reportKind: report.kind,
          confirmedAt: report.confirmedAt.toISOString(),
          marks: report.marks.map((m) => ({ subject: m.subject, percent: m.percent })),
          passProjected: results.passProjected,
        },
        { kind: 'course-explorer', results },
      ],
    };
  },
});

export const programmeDetails = define({
  name: 'programme_details',
  description:
    "Explains one programme for this learner: their score on that university's scale, line by line, each subject requirement and how far they are from it, the NSC pass needed, NBT, closing date and the university's own selection notes. Use a programme_id from my_results or search_programmes.",
  input: z.object({ programme_id: z.string().min(3).max(80) }),
  async run(context, input) {
    const report = await context.latestReport();
    if (!report) return NO_REPORT;
    const detail = assessOne(context.catalogue, input.programme_id, report);
    if (!detail) {
      return {
        forModel: { status: 'unknown-programme', programme_id: input.programme_id },
        artifacts: [],
      };
    }
    const { result, breakdown } = detail;
    return {
      forModel: {
        programme: result.name,
        university: result.universityName,
        report: report.kind,
        ...grade10Note(report),
        verdict: result.verdict,
        score: breakdown.total,
        scale: `${breakdown.label}, out of ${breakdown.maximum}`,
        required: result.requiredScore,
        to_improve: result.shortfalls,
        pass_required: result.passRequired,
        pass_projected: result.passProjected,
        nbt: result.nbt,
        closes_on: result.closesOn,
        university_says: result.selection,
        source: result.sourceUrl,
        academic_year: result.academicYear,
        unverified_preview_data: result.draft,
      },
      artifacts: [{ kind: 'score-breakdown', result, breakdown }],
    };
  },
});

export const whatINeed = define({
  name: 'what_i_need',
  description:
    "For one programme, the mark each of the learner's subjects needs so they would meet every published minimum (subject minimums, the matric pass and the university's own score), from their latest confirmed report. Says plainly when no marks would do it, and why. Use it when the learner asks what they need, what to aim for, or how to get into a course. Explain the plan it returns; never work out marks yourself.",
  input: z
    .object({
      programme_id: z
        .string()
        .min(3)
        .max(80)
        .regex(/^[a-z0-9-]+$/),
    })
    .strict(),
  async run(context, input) {
    const report = await context.latestReport();
    if (!report) return NO_REPORT;
    const result = whatINeedFor(context.catalogue, input.programme_id, report);
    if (!result) {
      return {
        forModel: { status: 'unknown-programme', programme_id: input.programme_id },
        artifacts: [],
      };
    }
    const { plan } = result;
    return {
      forModel: {
        programme: result.name,
        university: result.universityName,
        report: report.kind,
        ...grade10Note(report),
        status: plan.status,
        verdict_now: plan.verdictNow,
        subjects_to_raise: plan.subjects
          .filter((s) => s.gap > 0)
          .map((s) => ({ subject: s.subject, now: s.current, aim_for: s.target, why: s.reasons })),
        total_points_to_gain: plan.totalGap,
        score: `${plan.score.now} now, ${plan.score.atTarget} at these marks, out of ${plan.score.maximum} ${plan.score.label}`,
        score_required: plan.score.required,
        pass: { required: plan.pass.required, now: plan.pass.now, at_target: plan.pass.atTarget },
        why_not_possible: plan.blockers,
        rule: 'Subject minimums first, then the pass, then the score, raising the subject closest to its next level first. One way to get there, not the only one.',
        unverified_preview_data: result.draft,
      },
      artifacts: [
        {
          kind: 'what-i-need',
          result,
          reportKind: report.kind,
          confirmedAt: report.confirmedAt.toISOString(),
        },
      ],
    };
  },
});

export const searchProgrammes = define({
  name: 'search_programmes',
  description:
    'Finds programmes in the catalogue by words in their name or faculty (e.g. "engineering", "nursing", "law"), optionally at one university. Returns ids to use with programme_details.',
  input: z.object({
    query: z.string().max(80).optional(),
    university_id: z.enum(UNIVERSITY_IDS).optional(),
  }),
  async run(context, input) {
    const words = (input.query ?? '').toLowerCase().split(/\s+/).filter(Boolean);
    const found = context.catalogue.programmes.filter(
      (p) =>
        (!input.university_id || p.universityId === input.university_id) &&
        words.every((w) => `${p.name} ${p.faculty}`.toLowerCase().includes(w)),
    );
    return {
      forModel: {
        count: found.length,
        programmes: found.slice(0, 25).map((p) => ({
          programme_id: p.id,
          university: p.universityId,
          name: p.name,
          qualification: p.qualification,
        })),
        unverified_preview_data: found.slice(0, 25).some(isDraft),
      },
      artifacts: [],
    };
  },
});

export const deadlines = define({
  name: 'deadlines',
  description:
    "Application opening and closing dates, earlier faculty deadlines and fees for the launch universities. If the dates are for an earlier intake than the learner's, say so clearly.",
  input: z.object({ university_ids: z.array(z.enum(UNIVERSITY_IDS)).max(6).optional() }),
  async run(context, input) {
    const ids = new Set<UniversityId>(input.university_ids ?? UNIVERSITY_IDS);
    const windows = context.catalogue.windows
      .filter((w) => ids.has(w.universityId))
      .map((w) => ({
        ...w,
        universityName:
          context.catalogue.universities.find((u) => u.id === w.universityId)?.shortName ??
          w.universityId,
      }));
    return {
      forModel: {
        learner_intake: context.targetIntake,
        windows: windows.map((w) => ({
          university: w.universityName,
          intake: w.academicYear,
          dates_are_for_an_earlier_intake: w.academicYear < context.targetIntake,
          opens: w.opensOn,
          closes: w.closesOn,
          earlier: w.earlierClosings,
          fee_rand: w.feeZar,
          source: w.sourceUrl,
        })),
        unverified_preview_data: windows.some(isDraft),
      },
      artifacts: [{ kind: 'deadlines', windows, targetIntake: context.targetIntake }],
    };
  },
});

export const applicationPack = define({
  name: 'application_pack',
  description:
    "Everything the learner needs to apply to one university: the application window, fee, how to apply (the university's own portal or the CAO), their shortlisted programmes there with NBT needs, and their document checklist.",
  input: z.object({ university_id: z.enum(UNIVERSITY_IDS) }),
  async run(context, input) {
    const university = context.catalogue.universities.find((u) => u.id === input.university_id);
    if (!university) return { forModel: { status: 'not-available' }, artifacts: [] };
    const window = context.catalogue.windows.find((w) => w.universityId === university.id) ?? null;
    const shortlisted = new Set(await context.shortlist());
    const report = await context.latestReport();
    const results = report ? assessAll(context.catalogue, report) : null;
    const programmes = results
      ? [...results.qualifyNow, ...results.onTrack, ...results.close, ...results.planB].filter(
          (r) => r.universityId === university.id && shortlisted.has(r.programmeId),
        )
      : [];
    const done = new Map(
      (await context.checklist(`application:${university.id}`)).map((c) => [c.item, c.done]),
    );
    const checklist = APPLICATION_CHECKLIST.map((item) => ({
      item,
      done: done.get(item) ?? false,
    }));
    return {
      forModel: {
        university: university.name,
        route: university.applicationRoute,
        apply_url: university.applyUrl,
        window,
        learner_intake: context.targetIntake,
        shortlisted_here: programmes.map((p) => p.name),
        checklist_done: checklist.filter((c) => c.done).map((c) => c.item),
        checklist_open: checklist.filter((c) => !c.done).map((c) => c.item),
        unverified_preview_data:
          isDraft(university) ||
          (window !== null && isDraft(window)) ||
          programmes.some((p) => p.draft),
      },
      artifacts: [
        {
          kind: 'application-pack',
          university,
          window,
          programmes,
          checklist,
          targetIntake: context.targetIntake,
        },
      ],
    };
  },
});

export const fundingOverview = define({
  name: 'funding_overview',
  description:
    'NSFAS: the application window, the published criteria (household income threshold, SASSA), the documents to prepare, the N+ rule, and the learner’s own document checklist.',
  input: z.object({}),
  async run(context) {
    const nsfas = context.catalogue.nsfas;
    const done = new Map((await context.checklist('funding:nsfas')).map((c) => [c.item, c.done]));
    const checklist = (nsfas?.documents ?? []).map((_, i) => ({
      item: `document-${i}`,
      done: done.get(`document-${i}`) ?? false,
    }));
    return {
      forModel: nsfas
        ? {
            opens: nsfas.opensOn,
            closes: nsfas.closesOn,
            intake: nsfas.academicYear,
            income_threshold_rand: nsfas.incomeThresholdZar,
            income_threshold_disability_rand: nsfas.incomeThresholdDisabilityZar,
            sassa: nsfas.sassaNote,
            documents: nsfas.documents,
            n_plus_rule: nsfas.nPlusRule,
            apply_url: nsfas.applyUrl,
            rule: NSFAS_DECIDES,
            unverified_preview_data: isDraft(nsfas),
          }
        : { status: 'not-available' },
      artifacts: [{ kind: 'funding', nsfas, checklist }],
    };
  },
});

export const addToShortlist = define({
  name: 'add_to_shortlist',
  description:
    "Adds a programme to the learner's shortlist when they ask for it. Never add one they didn't ask for.",
  input: z.object({ programme_id: z.string().min(3).max(80) }),
  async run(context, input) {
    if (!context.catalogue.programmes.some((p) => p.id === input.programme_id)) {
      return { forModel: { status: 'unknown-programme' }, artifacts: [] };
    }
    await context.addToShortlist(input.programme_id);
    return { forModel: { status: 'added', programme_id: input.programme_id }, artifacts: [] };
  },
});

export const remember = define({
  name: 'remember',
  description:
    'Saves something the learner wants remembered: a goal in their own words, a preference, or a note. The learner can see and delete every note. Never store ID numbers, passwords, health details or anything about other people.',
  input: z.object({
    kind: z.enum(['goal', 'preference', 'note']),
    body: z.string().trim().min(2).max(280),
  }),
  async run(context, input) {
    await context.remember(input.kind, input.body);
    return { forModel: { status: 'remembered' }, artifacts: [] };
  },
});

/** What the model is told about a goal card: the verdict and gaps code decided (hard rule 2). */
function goalFacts(card: GoalCardArtifact, report: { kind: ReportKind } | null) {
  const r = card.result;
  return {
    programme_id: card.programme.id,
    programme: card.programme.name,
    university: card.programme.universityName,
    unverified_preview_data: card.programme.draft,
    ...(r ? grade10Note(report) : {}),
    verdict: r ? r.verdict : card.hasMarks ? 'not-available' : 'no-confirmed-marks',
    score: r ? `${r.score}/${r.scoreMaximum} ${r.scoreLabel}` : null,
    required: r?.requiredScore ?? null,
    to_improve:
      r?.shortfalls.map((s) => ({
        subject: s.subject ?? s.subjects.join(' or '),
        now: s.percent,
        needs: s.targetPercent,
      })) ?? [],
    application_pack_university_id: card.programme.universityId,
  };
}

export const setGoal = define({
  name: 'set_goal',
  description:
    "Sets the learner's goal: the one programme they are aiming for (they can change it any time). Only when the learner clearly asks for that programme; find its id with search_programmes or my_results first. It also goes on their shortlist. Returns the goal card with where they stand for it now.",
  input: z.object({
    programme_id: z
      .string()
      .min(3)
      .max(80)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  }),
  async run(context, input) {
    const report = await context.latestReport();
    const card = goalCard(context.catalogue, input.programme_id, report);
    if (!card) return { forModel: { status: 'unknown-programme' }, artifacts: [] };
    await context.setGoal(input.programme_id);
    // A goal is on the shortlist, so its application pack exists.
    await context.addToShortlist(input.programme_id);
    return { forModel: { status: 'goal-set', ...goalFacts(card, report) }, artifacts: [card] };
  },
});

export const showGoal = define({
  name: 'show_goal',
  description:
    "Shows the learner's goal (their target programme) and where they stand for it now, from their confirmed marks: qualify (on track, on Grade 10 marks or a Grade 11 June or September report), close (with exactly what to improve) or not yet. Use it when they ask about their goal or how close they are.",
  input: z.object({}).strict(),
  async run(context) {
    const id = await context.goal();
    if (!id) {
      return {
        forModel: {
          status: 'no-goal',
          instruction:
            'The learner has not chosen a goal yet. Offer to help them pick one programme to aim for.',
        },
        artifacts: [],
      };
    }
    const report = await context.latestReport();
    const card = goalCard(context.catalogue, id, report);
    if (!card) return { forModel: { status: 'goal-not-available' }, artifacts: [] };
    return { forModel: { status: 'goal', ...goalFacts(card, report) }, artifacts: [card] };
  },
});

export const examCountdownTool = define({
  name: 'exam_countdown',
  description:
    "The learner's next NSC exam papers, from the official timetable matched to the subjects they write, with the days left to each. If the timetable for their exam year isn't published yet, say so: never guess a date.",
  input: z.object({ limit: z.int().min(1).max(20).optional() }).strict(),
  async run(context, input) {
    const [report, profile, choices] = await Promise.all([
      context.latestReport(),
      context.profile(),
      context.examChoices(),
    ]);
    const countdown = examCountdown({
      view: context.catalogue,
      now: context.today,
      grade: examGrade(profile?.grade ?? null, report?.kind ?? null),
      confirmedSubjects: report?.marks.map((m) => m.subject) ?? [],
      choices,
      ...(input.limit ? { limit: input.limit } : {}),
    });
    return {
      forModel: {
        exam_year: countdown.examYear,
        timetable_published: countdown.timetablePublished,
        subjects_matched: countdown.subjectCount,
        unverified_preview_data: countdown.papers.some((p) => p.draft),
        papers: countdown.papers.map((p) => ({
          subject: p.subjectName,
          paper: p.paper,
          date: p.date,
          starts: p.startsAt,
          days_left: p.daysLeft,
          note: p.note,
        })),
      },
      artifacts: [countdown],
    };
  },
});

const REASON_FOR_MODEL = {
  asked: 'the learner asked about it',
  'goal-to-raise': 'what_i_need says this mark must rise for their goal',
  'goal-requires': 'their goal programme names this subject',
  weakest: 'one of their lowest confirmed marks',
} as const;

export const practiceForTool = define({
  name: 'practice_for',
  description:
    'Free, curriculum-aligned practice and open textbooks (Siyavula) for the subjects that matter: the one the learner asks about, or else the subjects their goal depends on (those what_i_need says must rise first), or else their weakest confirmed marks. Returns links only, from checked records. Use it when the learner asks what to study or practise, or after a bad result. Never recommend a website or book from memory, and never do their schoolwork for them.',
  input: z
    .object({
      subject_id: z
        .string()
        .max(60)
        .refine((s) => isSubjectId(s), 'Unknown NSC subject')
        .optional(),
    })
    .strict(),
  async run(context, input) {
    const [report, profile, goal] = await Promise.all([
      context.latestReport(),
      context.profile(),
      context.goal(),
    ]);
    const artifact = practicePlan({
      view: context.catalogue,
      grade: examGrade(profile?.grade ?? null, report?.kind ?? null),
      goalProgrammeId: goal,
      confirmedReport: report,
      ...(input.subject_id ? { subjectId: input.subject_id as SubjectId } : {}),
    });
    if (artifact.basis === 'none') {
      return {
        forModel: {
          status: 'nothing-to-choose-from',
          instruction:
            'The learner has no goal and no confirmed marks yet. Ask which subject they want to practise, or offer to set a goal or confirm their marks first. Do not suggest resources from memory.',
        },
        artifacts: [],
      };
    }
    return {
      forModel: {
        chosen_from: artifact.basis,
        goal: artifact.goal ? `${artifact.goal.name} (${artifact.goal.universityName})` : null,
        subjects: artifact.subjects.map((s) => ({
          subject: s.subjectName,
          why: REASON_FOR_MODEL[s.reason],
          resources: s.resources.map((r) => ({ title: r.title, kind: r.kind, access: r.access })),
          none_yet: s.resources.length === 0,
        })),
        notes:
          'Everything here is free. Siyavula Practice needs a free account, and Siyavula asks learners under 18 for a parent’s or guardian’s OK to sign up. The panel has the links; do not repeat them. For the marks to aim for, use what_i_need.',
        unverified_preview_data: artifact.subjects.some((s) => s.resources.some((r) => r.draft)),
      },
      artifacts: [artifact],
    };
  },
});

/** What the model is told about offers, every time (planning.md §8.5). */
export const OFFER_RULES =
  'Only an offer whose kind is "final" is a place. Never say or imply "you\'re in", "you got in" or "you have a place" about a provisional, conditional or waitlist offer: say what kind it is and what it still depends on (provisional: the final matric results; conditional: the conditions in the letter; waitlist: a place opening up). Never interpret or restate the conditions: the panel shows them in the university\'s own words, and the university\'s admissions office explains them. If a final-results check is not met, care first, then the Plan B options it lists. A met check never makes an offer final or a place, and a not-met check never means the offer is gone: say what its `means` says, and that the university decides.';

/**
 * What a final-results check means, sent with its status (audit A10-22): the code decides
 * eligibility on the published minimums only (packages/admissions offers.ts), never a place.
 */
const FINAL_CHECK_MEANS = {
  met: 'Eligible on the published minimums only. This is not a place and does not make the offer final: the university still decides, and the conditions in the letter still apply. Never say the place is confirmed.',
  'not-met':
    'On the published minimums the final results fall short, so this offer may fall away. It is not gone: the university decides, and its admissions office can say where the learner stands. Care first, then the Plan B options listed.',
  unavailable:
    "The check could not be run, as the programme's published requirements are not available: say nothing about whether the results meet them, and point the learner to the university's admissions office.",
} as const satisfies Record<NonNullable<OfferCardArtifact['finalCheck']>['status'], string>;

/** Whether a card holds preview data: its programme, or any Plan B option (audit A10-24). */
function isPreview(card: OfferCardArtifact): boolean {
  return (card.programme?.draft ?? false) || (card.finalCheck?.planB.some((p) => p.draft) ?? false);
}

/** What the model is told about the learner's offers: facts from code, never the letter's words. */
export function offersForModel(cards: ReadonlyArray<OfferCardArtifact>) {
  return {
    count: cards.length,
    offers: cards.map((c) => ({
      offer_id: c.id,
      university: c.universityName,
      programme: c.programme?.name ?? 'not in the catalogue the learner can see',
      kind: c.offerKind,
      is_a_place: isFinalOffer(c.offerKind),
      learner_status: c.status,
      reply_by: c.replyBy,
      days_left_to_reply: c.daysLeft,
      reply_by_reminder: c.reminderAt ? 'scheduled' : 'none',
      // The letter's words stay in the panel, as quoted (A10-12): never handed to the model.
      conditions_in_letter: c.conditions.length,
      final_results_check: c.finalCheck
        ? {
            status: c.finalCheck.status,
            means: FINAL_CHECK_MEANS[c.finalCheck.status],
            plan_b: c.finalCheck.planB.map((p) => `${p.name} (${p.universityName})`),
          }
        : c.checksFinal
          ? 'final results not confirmed yet'
          : 'not needed for a final offer',
      unverified_preview_data: isPreview(c),
    })),
    rules: OFFER_RULES,
    unverified_preview_data: cards.some(isPreview),
  };
}

export const offersTool = define({
  name: 'offers',
  description:
    "The offers the learner recorded (from a letter they checked, or their own word): what kind each is (provisional, conditional, final or waiting list), whether they accepted or declined it, the date to reply by and the days left, whether a reply-by reminder is set, and, once their final matric results are confirmed, whether those results meet the programme's published requirements (with Plan B options if not). Use it whenever the learner says they got in, got an offer or a letter, or asks about accepting, conditions or replying.",
  input: z.object({}).strict(),
  async run(context) {
    const [offers, report] = await Promise.all([context.offers(), context.latestReport()]);
    if (offers.length === 0) {
      return {
        forModel: {
          status: 'no-offers',
          instruction:
            'The learner has not recorded an offer. If they say they got in or got an offer, congratulate them warmly without calling it a place, then ask them to add it under My offers or upload the letter, so its kind and reply-by date are kept straight. Never record an offer yourself.',
          rules: OFFER_RULES,
        },
        artifacts: [],
      };
    }
    const finalResults = finalResultsFrom(report);
    const cards = offers.map((o) => offerCard(context.catalogue, o, finalResults, context.today));
    return { forModel: offersForModel(cards), artifacts: cards };
  },
});

/** What the model is told about a registration check, every time (planning.md §11, Phase 5c). */
export const MODULE_RULES =
  'Only the differences listed are real: never add one, never say yourself that a module is fine, missing or wrong, and never invent a module code, a deadline or an office. If status is not "checked", give no verdict at all: say plainly why (no published curriculum for the year they registered for, or the course is not available; never check against another year’s rule book) and point the learner to their faculty office. The faculty office has the final word on every registration. The panel shows who to see, the message the learner can send and the last day to change: refer to it, never rewrite the message or add to it, and never ask for or repeat a student number.';

/** How the model is told about one difference: catalogue facts only, never the learner's words. */
function differenceFacts(d: RegistrationDifference) {
  switch (d.kind) {
    case 'missing-compulsory':
      return { kind: d.kind, module: `${d.module.code} ${d.module.name}` };
    case 'wrong-semester':
      return {
        kind: d.kind,
        module: `${d.module.code} ${d.module.name}`,
        registered_in: d.registered.semester,
        offered_in: d.module.semester ?? 'term not printed in the rule book',
      };
    case 'elective-group-unsatisfied':
      return { kind: d.kind, group: d.group.label, short: d.short };
    case 'credits-short':
      return { kind: d.kind, registered: d.registered, minimum: d.min };
    case 'credits-over':
      return { kind: d.kind, registered: d.registered, maximum: d.max };
    // A code the learner typed is shown in the panel, never handed to the model (A10-12).
    case 'not-in-curriculum':
    case 'registered-twice':
      return { kind: d.kind, module: 'shown in the panel' };
  }
}

export const compareRegistrationTool = define({
  name: 'compare_registration',
  description:
    "Checks the modules the learner confirmed from their proof of registration against their course's published first-year curriculum: what is missing, in the wrong semester, not in the curriculum, registered twice, an elective group not satisfied, or credits short or over; who to see (the faculty office); and the last day to change their registration. Use it whenever the learner asks about their modules or registration. Explain the code's verdict; never decide one yourself.",
  input: z.object({}).strict(),
  async run(context) {
    const registration = await context.registration();
    if (!registration) {
      return {
        forModel: {
          status: 'no-registration',
          instruction:
            'The learner has not confirmed a registration. Ask them to upload their proof of registration under My modules, or type their modules in, after they register. Never check modules yourself.',
          rules: MODULE_RULES,
        },
        artifacts: [],
      };
    }
    const artifact = myModules(context.catalogue, registration, context.today);
    const { next } = artifact.deadlines;
    return {
      forModel: {
        status: artifact.status,
        programme: artifact.programme
          ? `${artifact.programme.name} (${artifact.programme.universityName})`
          : 'not in the catalogue the learner can see',
        academic_year: artifact.academicYear,
        curriculum_year: artifact.curriculum?.academicYear ?? null,
        verdict:
          artifact.status === 'checked'
            ? artifact.differences.length === 0
              ? 'matches the curriculum'
              : 'has differences'
            : 'no verdict',
        differences: artifact.differences.map((d) => differenceFacts(d.difference)),
        who_to_see: artifact.office
          ? { faculty_office: artifact.office.faculty, where: artifact.office.where }
          : 'no faculty office record: the university’s registration venue or student service centre',
        change_deadline: next
          ? { last_day: next.lastDay, days_left: next.daysLeft, applies_to: next.appliesTo }
          : 'none published for this year',
        terms_with_no_published_deadline: artifact.deadlines.unpublishedTerms,
        change_deadline_reminder: artifact.reminderAt ? 'scheduled' : 'none',
        suggested_message: artifact.message ? 'in the panel, for the learner to copy' : 'none',
        rules: MODULE_RULES,
        unverified_preview_data: artifact.includesDrafts,
      },
      artifacts: [artifact],
    };
  },
});

const TOPIC_ORDER: DistressTopic[] = [
  'suicide',
  'abuse',
  'child',
  'substance',
  'distress',
  'emergency',
];

/** What the model is told about the tour and the checklist, every time (hard rules 2 and 3). */
export const CAMPUS_RULES =
  "The panel shows every place, room, hour, phone number and date, from checked records. Never give a building, room, phone number, opening hours or a date from memory, and never guess one the panel doesn't have: say it isn't checked yet and point to the university's own website. Never write a map, directions or Street View link: the panel's Walk there and See it buttons have them. Never assume which university the learner is going to: it is the one whose offer they accepted, or one they asked to look around.";

const ASK_WHICH_UNIVERSITY = {
  status: 'no-university',
  instruction:
    'The learner has not accepted an offer and did not say which university to look at. Ask which university they want to explore (or suggest they record and accept their offer under My offers). Never assume one.',
  rules: CAMPUS_RULES,
} as const;

const universityInput = z.object({ university_id: z.enum(UNIVERSITY_IDS).optional() }).strict();

export const campusTourTool = define({
  name: 'campus_tour',
  description:
    "The campus tour for the university whose offer the learner accepted, or one they ask to look around: its campuses and the places on each, grouped by need (registration, financial aid, clinic, counselling, security, library, computer labs, food, transport, residence, disability unit), each with where it is, hours, phone, an 'open in maps' link, 'Walk there' (walking directions in the phone's maps app), 'See it' (Street View) and, where published, a step-free route and an arrival note, each readable aloud, plus the university's own campus map and virtual tour, and the university's own safety advice, quoted and dated, with campus security and emergency numbers to call. Once an offer is accepted it also has 'Before you arrive' safety and scam guidance. Use it when the learner asks where something is on campus, about getting around, about arriving, or whether a place, route or area near campus is safe.",
  input: universityInput,
  async run(context, input) {
    const choice = campusUniversity(await context.offers(), input.university_id);
    if (!choice) return { forModel: ASK_WHICH_UNIVERSITY, artifacts: [] };
    const tour = campusTour(context.catalogue, choice.universityId, choice.basis);
    if (!tour) return { forModel: { status: 'not-available', rules: CAMPUS_RULES }, artifacts: [] };
    const draft =
      tour.campuses.some((c) => c.draft || c.needs.some((n) => n.places.some((p) => p.draft))) ||
      tourSafetyNotes(tour).some((n) => n.draft);
    return {
      forModel: {
        university: tour.universityName,
        because:
          tour.basis === 'accepted-offer' ? 'the offer they accepted' : 'they asked to look around',
        not_checked_yet: tour.campuses.length === 0,
        campuses: tour.campuses.map((c) => ({
          campus: c.name,
          city: c.city,
          has_official_map: c.mapUrl !== null,
          has_virtual_tour: c.virtualTourUrl !== null,
          places_by_need: Object.fromEntries(
            c.needs.map((n) => [n.need, n.places.map((p) => p.name)]),
          ),
        })),
        before_you_arrive_safety_guidance: tour.beforeYouArrive,
        safety_advice: safetyAdviceForModel(tour),
        rules: CAMPUS_RULES,
        unverified_preview_data: draft,
      },
      artifacts: [tour],
    };
  },
});

export const firstWeekTool = define({
  name: 'first_week',
  description:
    "The learner's first-week checklist for the university whose offer they accepted, or one they name: register, get the student card, find the faculty office, set up university email and the learning site, check modules, find the clinic and save campus security's number, sort out NSFAS or other funding, check in to residence. Says which steps they have ticked, and the registration, orientation and change-of-modules dates from the university's calendar when it is checked. Use it when the learner asks what to do when they arrive, about registration or their first week.",
  input: universityInput,
  async run(context, input) {
    const offers = await context.offers();
    const choice = campusUniversity(offers, input.university_id);
    if (!choice) return { forModel: ASK_WHICH_UNIVERSITY, artifacts: [] };
    const accepted = offers.find((o) => o.status === 'accepted');
    const year = arrivalYear(context.today, choice.universityId, await context.registration());
    const checklist = firstWeek(
      context.catalogue,
      choice.universityId,
      choice.basis,
      await context.firstWeekSteps(choice.universityId),
      choice.basis === 'accepted-offer' ? (accepted?.programmeId ?? null) : null,
      year,
    );
    if (!checklist) {
      return { forModel: { status: 'not-available', rules: CAMPUS_RULES }, artifacts: [] };
    }
    const { calendar } = checklist;
    return {
      forModel: {
        university: checklist.universityName,
        because:
          checklist.basis === 'accepted-offer' ? 'the offer they accepted' : 'they asked about it',
        steps_done: checklist.steps.filter((s) => s.doneAt).map((s) => s.id),
        steps_open: checklist.steps.filter((s) => !s.doneAt).map((s) => s.id),
        arrival_year: year,
        dates: calendar
          ? {
              academic_year: calendar.academicYear,
              first_year_registration_from: calendar.registration.from ?? 'not published',
              first_year_registration_to: calendar.registration.to,
              orientation: calendar.orientation,
              last_day_to_change_modules: calendar.changeDeadlines,
            }
          : `not published or not checked yet for ${year}: never give another year's dates; point to the university website and their offer letter`,
        faculty_office: checklist.facultyOffice ? 'in the panel' : 'none checked yet',
        my_modules:
          'The check-modules step links to My modules, where they compare their registration.',
        rules: CAMPUS_RULES,
        unverified_preview_data:
          (calendar?.draft ?? false) || (checklist.facultyOffice?.draft ?? false),
      },
      artifacts: [checklist],
    };
  },
});

/**
 * The learner's own campus lines for the crisis card: verified only (campusSafetyLines). Never
 * lets a failure to read their offers stop the card: without them, the card has no campus lines.
 */
export async function campusLinesFor(
  context: AgentContext,
): Promise<CrisisCampusLines | undefined> {
  try {
    return campusSafetyLines(context.catalogue, acceptedUniversity(await context.offers()));
  } catch {
    return undefined;
  }
}

/**
 * Verified helplines for the topics raised, most relevant first; emergency numbers always. With
 * an accepted offer, the learner's own campus clinic, counselling and security, verified only.
 */
export function crisisCard(
  helplines: ReadonlyArray<Helpline>,
  topics: ReadonlyArray<DistressTopic>,
  campus?: CrisisCampusLines,
): CrisisCardArtifact {
  const wanted = new Set<DistressTopic>([...topics, 'distress', 'emergency']);
  const rank = (h: Helpline) =>
    Math.min(...h.topics.filter((t) => wanted.has(t)).map((t) => TOPIC_ORDER.indexOf(t)));
  const chosen = helplines
    .filter((h) => h.topics.some((t) => wanted.has(t)))
    .sort((a, b) => rank(a) - rank(b));
  return {
    kind: 'crisis-card',
    helplines: chosen.map(({ id, name, numbers, hours, purpose }) => ({
      id,
      name,
      numbers,
      hours,
      purpose,
    })),
    cover: helplineCover(chosen),
    ...(campus && campus.lines.length > 0 ? { campus } : {}),
  };
}

/** A record's `hours` says it is open around the clock ("24 hours", "24 hours, every day", "24/7"). */
const ALL_DAY = /\b24 ?(?:hours?\b|hrs?\b|\/ ?7\b)/i;

/**
 * What the lines shown can promise (audit A10-11). Emergency numbers are an emergency service,
 * not the "people trained to help" the reply talks about, so only support lines count: with none,
 * the reply points to someone the learner trusts; "day and night" only when every one says so.
 */
export function helplineCover(shown: ReadonlyArray<Helpline>): HelplineCover {
  // The police line is an emergency service too, though it is also offered for abuse.
  const support = shown.filter((h) => !h.topics.includes('emergency'));
  if (support.length === 0) return 'none';
  return support.every((h) => ALL_DAY.test(h.hours)) ? 'all-day' : 'set-hours';
}

/** The fixed crisis reply for a card: it promises only what the card's lines can keep. */
export function crisisReply(card: CrisisCardArtifact): string {
  return crisisWords(card.cover, card.helplines.length).reply;
}

export const crisisCardTool = define({
  name: 'crisis_card',
  description:
    'Shows the learner verified helplines (call or SMS) for distress, suicidal thoughts, abuse or substance problems, and emergencies. Use it whenever the learner seems to be struggling emotionally, even if they don’t ask.',
  input: z.object({
    topics: z
      .array(z.enum(['suicide', 'distress', 'abuse', 'substance', 'emergency', 'child']))
      .max(6),
  }),
  async run(context, input) {
    const card = crisisCard(
      context.catalogue.helplines,
      input.topics,
      await campusLinesFor(context),
    );
    const shown = context.catalogue.helplines.filter((h) =>
      card.helplines.some((c) => c.id === h.id),
    );
    return {
      forModel: {
        shown: card.helplines.map((h) => h.name),
        // Campus lines are verified only, so they never make the card a preview.
        campus_lines: card.campus?.lines.map((l) => `${l.name} (${l.campusName})`) ?? [],
        unverified_preview_data: shown.some(isDraft),
      },
      artifacts: [card],
    };
  },
});

export const TOOLS: ReadonlyArray<Tool> = [
  myResults,
  programmeDetails,
  whatINeed,
  searchProgrammes,
  deadlines,
  applicationPack,
  fundingOverview,
  addToShortlist,
  remember,
  setGoal,
  showGoal,
  examCountdownTool,
  practiceForTool,
  offersTool,
  campusTourTool,
  firstWeekTool,
  compareRegistrationTool,
  crisisCardTool,
] as ReadonlyArray<Tool>;

export class ToolInputError extends Error {
  override readonly name = 'ToolInputError';
}

/** Validates a model's tool call and runs it. Unknown tools and bad inputs never run. */
export async function runTool(
  context: AgentContext,
  name: string,
  rawInput: unknown,
): Promise<ToolResult> {
  const tool = TOOLS.find((t) => t.name === name);
  if (!tool) throw new ToolInputError(`Unknown tool ${name}`);
  const parsed = tool.input.safeParse(rawInput ?? {});
  if (!parsed.success) throw new ToolInputError(`Invalid input for ${name}`);
  return tool.run(context, parsed.data);
}
