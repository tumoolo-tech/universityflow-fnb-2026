import {
  type ExamPaper,
  examSubjects,
  nscExamYear,
  nscSessionSlots,
  paperSlot,
  papersFor,
  suppressionExamYears,
} from '@universityflow/catalogue';
import type { PaperSlot, PaperSlotSource } from '@universityflow/messaging';
import type { ExamInputs } from './messaging';

/** The two timetables the paper source reads. Keep them apart: they answer different questions. */
export interface TimetablePapers {
  /**
   * The papers a learner may be **shown**: the catalogue view's (`catalogueView(...).examPapers`),
   * verified only in production, drafts only in preview (`UF_CATALOGUE_PREVIEW=1`). Only these
   * open an exam period (up to one message a day), so an unchecked date never lets more through.
   */
  readonly shown: () => ReadonlyArray<ExamPaper>;
  /**
   * Every sourced paper, drafts included (`examPapersForSuppression()`), used **only to stay
   * quiet**. Never filter this on verification (A12-01): a draft date can only make us quieter,
   * and nothing read from it is ever shown to a learner (hard rule 3).
   */
  readonly forSuppression: () => ReadonlyArray<ExamPaper>;
}

/**
 * The reminder pipeline's papers (planning.md §11, Phase 4b): the NSC timetable matched to the
 * subjects the learner writes, so no message reaches them during a paper.
 *
 * Staying quiet is fail-safe, so suppression errs wide (audit A12):
 * - every sourced paper holds a message, verified or not (A12-01);
 * - in the exam year for the learner's grade **and** the grade after, since a grade typed at
 *   sign-up goes stale every January (A12-02);
 * - with no subjects we know of (no confirmed report, or every subject removed), every NSC
 *   session of those years (A12-03).
 * Anything beyond the shown papers of their own exam year is `holdOnly`: it holds messages but
 * never opens an exam period. A learner whose data may not be processed has no papers here, and
 * no messages either.
 */
export class TimetablePaperSlots implements PaperSlotSource {
  readonly #inputs: { examInputs(studentId: string): Promise<ExamInputs | null> };
  readonly #papers: TimetablePapers;

  constructor(
    inputs: { examInputs(studentId: string): Promise<ExamInputs | null> },
    papers: TimetablePapers,
  ) {
    this.#inputs = inputs;
    this.#papers = papers;
  }

  async slotsFor(studentId: string, from: Date, to: Date): Promise<ReadonlyArray<PaperSlot>> {
    const inputs = await this.#inputs.examInputs(studentId);
    if (!inputs) return [];
    const subjects = examSubjects(inputs.confirmedSubjects, inputs.choices);

    // Papers we would show them, in their own exam year (at either end of a window that can
    // straddle a new year): these are their papers, and they open an exam period.
    const ownYears = new Set([nscExamYear(inputs.grade, from), nscExamYear(inputs.grade, to)]);
    const shown = this.#papers.shown();
    const firm =
      subjects.length === 0
        ? []
        : [...ownYears].flatMap((year) => papersFor(shown, subjects, year)).map(paperSlot);

    // Everything we stay quiet for: every sourced paper of theirs, or every session when we
    // don't know their subjects, in every year they may be writing.
    const quiet = this.#papers.forSuppression();
    const held = [...suppressionExamYears(inputs.grade, from, to)].flatMap((year) =>
      subjects.length === 0
        ? nscSessionSlots(quiet, year)
        : papersFor(quiet, subjects, year).map(paperSlot),
    );

    const key = (s: PaperSlot) => `${s.startsAt.getTime()}:${s.endsAt.getTime()}`;
    const slots = new Map<string, PaperSlot>();
    for (const s of firm) slots.set(key(s), s);
    for (const s of held) {
      if (!slots.has(key(s))) slots.set(key(s), { ...s, holdOnly: true });
    }
    return [...slots.values()]
      .filter((s) => s.endsAt >= from && s.startsAt <= to)
      .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  }
}
