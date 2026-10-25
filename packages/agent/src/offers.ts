import {
  finalCheck,
  isFinalOffer,
  type OfferKind,
  replyByDaysLeft,
  type SubjectMark,
} from '@universityflow/admissions';
import { type CatalogueView, isDraft } from '@universityflow/catalogue';
import type { OfferCardArtifact } from '@universityflow/ui';

/**
 * The offer card (Phase 5a), built from tested code only (hard rule 2): the agent's `offers`
 * tool, the web page and the app's API all use this, so the chat and the screens can't disagree.
 */

/** An offer as the learner recorded it (packages/db `OfferRecord`, the parts the card needs). */
export interface AgentOffer {
  readonly id: string;
  readonly universityId: string;
  readonly programmeId: string;
  readonly kind: OfferKind;
  readonly status: 'held' | 'accepted' | 'declined';
  readonly source: 'letter' | 'learner';
  readonly replyBy: string | null;
  readonly conditions: ReadonlyArray<string>;
  readonly reminder: { readonly status: string; readonly desiredAt: Date } | null;
}

/** The learner's confirmed final NSC results (a confirmed `grade-12-final` report), or null. */
export interface FinalResults {
  readonly confirmedAt: Date;
  readonly marks: ReadonlyArray<SubjectMark>;
}

/** The report kind that holds a learner's final NSC results. */
export const FINAL_RESULTS_KIND = 'grade-12-final';

/**
 * One offer's card. The programme comes from the catalogue view (null when the learner may no
 * longer see it, hard rule 3); the re-check runs only on confirmed final results (hard rule 6),
 * and never for a final offer, which needs none.
 */
export function offerCard(
  view: CatalogueView,
  offer: AgentOffer,
  finalResults: FinalResults | null,
  now: Date,
): OfferCardArtifact {
  const programme = view.programmes.find((p) => p.id === offer.programmeId) ?? null;
  const university = view.universities.find((u) => u.id === offer.universityId);
  const checksFinal = !isFinalOffer(offer.kind);
  const check =
    checksFinal && finalResults && programme
      ? finalCheck(view, programme.id, finalResults.marks)
      : null;
  return {
    kind: 'offer-card',
    id: offer.id,
    offerKind: offer.kind,
    status: offer.status,
    source: offer.source,
    universityId: offer.universityId,
    universityName: university?.shortName ?? offer.universityId.toUpperCase(),
    programme: programme
      ? {
          id: programme.id,
          name: programme.name,
          faculty: programme.faculty,
          sourceUrl: programme.sourceUrl,
          academicYear: programme.academicYear,
          draft: isDraft(programme) || (check?.result?.draft ?? false),
        }
      : null,
    replyBy: offer.replyBy,
    daysLeft: offer.replyBy ? replyByDaysLeft(offer.replyBy, now) : null,
    conditions: [...offer.conditions],
    reminderAt:
      offer.reminder?.status === 'scheduled' ? offer.reminder.desiredAt.toISOString() : null,
    checksFinal,
    finalCheck:
      checksFinal && finalResults
        ? {
            confirmedAt: finalResults.confirmedAt.toISOString(),
            status: check?.status ?? 'unavailable',
            shortfalls: check?.status === 'not-met' ? (check.result?.shortfalls ?? []) : [],
            planB: (check?.planB ?? []).map((r) => ({
              programmeId: r.programmeId,
              name: r.name,
              universityName: r.universityName,
              qualification: r.qualification,
              draft: r.draft,
            })),
          }
        : null,
  };
}

/** The learner's final results, from their latest confirmed report when it is the final one. */
export function finalResultsFrom(
  report: {
    readonly kind: string;
    readonly confirmedAt: Date;
    readonly marks: ReadonlyArray<SubjectMark>;
  } | null,
): FinalResults | null {
  return report?.kind === FINAL_RESULTS_KIND
    ? { confirmedAt: report.confirmedAt, marks: report.marks }
    : null;
}
