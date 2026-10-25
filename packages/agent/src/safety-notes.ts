import {
  type CatalogueView,
  campusesOf,
  isDraft,
  type SafetyAdvice,
  safetyAdviceOn,
  safetyPlacesOn,
  type UniversityId,
} from '@universityflow/catalogue';
import type { CampusTourArtifact, SafetyCallLine, SafetyNoteView } from '@universityflow/ui';

/**
 * A university's safety notes for the campus tour, the first-week checklist and the campus_tour
 * tool (planning.md §11, Phase 5e-3), from the catalogue view only: verified and current (drafts
 * only in preview, labelled). Code decides what is shown; the AI only relays it (hard rule 2).
 *
 * Every note carries campus security to call (verified places only, never a draft, even in
 * preview, as the crisis card's lines) and the police and cell-phone emergency lines from the
 * catalogue's helplines. A note with nobody to call is not shown at all.
 */

/** The national lines every note shows: the police (10111) and 112 from a cell phone. */
export const EMERGENCY_HELPLINE_IDS = ['saps-emergency', 'mobile-emergency'] as const;

/** What the model is told whenever it sees safety advice (charter: SAFETY_ADVICE_GUIDANCE). */
export const SAFETY_ADVICE_RULES =
  "Never say or suggest that a place, street, route, suburb or area is safe or unsafe, dangerous or fine, and never rank or compare places. Only relay the university's own advice in notes, word for word, saying it is the university's and giving its dates, then what to do and who_to_call. If no note is about the place the learner asks about, say the university has published no advice about it here, that this doesn't mean it is safe, and give who_to_call. Never name a street, suburb or business as dangerous from memory or from the news.";

function emergencyLines(view: CatalogueView): SafetyCallLine[] {
  return EMERGENCY_HELPLINE_IDS.flatMap((id) => {
    const line = view.helplines.find((h) => h.id === id);
    const call = line?.numbers.find((n) => n.kind === 'call');
    return line && call ? [{ id, name: line.name, campusName: null, phone: call.value }] : [];
  });
}

/** Verified campus security with a number: one campus's, or every campus's for `null`. */
function securityLines(
  view: CatalogueView,
  universityId: UniversityId,
  campusId: string | null,
): SafetyCallLine[] {
  return campusesOf(view, universityId)
    .filter((c) => campusId === null || c.id === campusId)
    .flatMap((campus) =>
      safetyPlacesOn(view, campus.id)
        .filter((p) => p.kind === 'security' && !isDraft(p) && p.phone !== undefined)
        .map((p) => ({ id: p.id, name: p.name, campusName: campus.name, phone: p.phone ?? '' })),
    );
}

function noteView(
  advice: SafetyAdvice,
  security: SafetyCallLine[],
  emergency: SafetyCallLine[],
): SafetyNoteView {
  const draft = isDraft(advice);
  return {
    id: advice.id,
    kind: advice.kind,
    quote: advice.quote,
    area: advice.area ?? null,
    days: advice.days ?? null,
    hours: advice.hours ?? null,
    publishedOn: advice.publishedOn ?? null,
    checkedOn: draft ? null : (advice.verifiedOn ?? null),
    sourceUrl: advice.sourceUrl,
    draft,
    security,
    emergency,
  };
}

/**
 * The notes for one campus, or for the whole university (`campusId` null), each with its lines
 * to call. Empty when there is no verified campus security or no emergency line to show with them.
 */
export function safetyNoteViews(
  view: CatalogueView,
  universityId: UniversityId,
  campusId: string | null,
): SafetyNoteView[] {
  const security = securityLines(view, universityId, campusId);
  const emergency = emergencyLines(view);
  if (security.length === 0 || emergency.length < EMERGENCY_HELPLINE_IDS.length) return [];
  return safetyAdviceOn(view, universityId, campusId).map((a) => noteView(a, security, emergency));
}

/** Every note a tour shows: the university-wide ones first, then each campus's. */
export function tourSafetyNotes(tour: CampusTourArtifact): SafetyNoteView[] {
  return [
    ...(tour.universitySafetyNotes ?? []),
    ...tour.campuses.flatMap((c) => c.safetyNotes ?? []),
  ];
}

/** What the campus_tour tool tells the model about safety: the stored notes and nobody's verdict. */
export function safetyAdviceForModel(tour: CampusTourArtifact) {
  const campusOf = new Map(
    tour.campuses.flatMap((c) => (c.safetyNotes ?? []).map((n) => [n.id, c.name] as const)),
  );
  const notes = tourSafetyNotes(tour);
  const calls = new Map<string, { name: string; campus: string | null; number: string }>();
  for (const line of notes.flatMap((n) => [...n.security, ...n.emergency])) {
    calls.set(line.id, { name: line.name, campus: line.campusName, number: line.phone });
  }
  return {
    rules: SAFETY_ADVICE_RULES,
    notes: notes.map((n) => ({
      from: tour.universityName,
      campus: campusOf.get(n.id) ?? 'every campus',
      kind: n.kind,
      quote: n.quote,
      area: n.area,
      when: n.days || n.hours ? [n.days, n.hours].filter(Boolean).join(', ') : null,
      university_date: n.publishedOn ?? 'not printed',
      last_checked: n.checkedOn ?? 'not checked yet',
      unverified_preview: n.draft,
    })),
    who_to_call: [...calls.values()],
    ...(notes.length === 0
      ? {
          none_stored:
            "The university has published no safety advice we hold for these campuses. That does not mean anywhere is safe: give who_to_call if there is any, or say to ask the university's campus security.",
        }
      : {}),
  };
}
