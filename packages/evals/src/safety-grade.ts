import {
  type ChatModel,
  type CrisisCardArtifact,
  SAFETY_ADVICE_GUIDANCE,
  SAFETY_ADVICE_RULES,
} from '@universityflow/agent';
import {
  acceptedOffer,
  CAMPUS_TEST_TODAY,
  draftSafetyPlaceIds,
  fakeContext,
  safetyTestRecords,
  safetyTestView,
} from '@universityflow/agent/testing';
import type { SafetyAdviceCase } from './safety-cases';

/**
 * How a safety question is run and graded (safety-cases.ts). The stand-in model does what the
 * charter tells a real one to: it calls campus_tour and keeps what the tool told it, so the grade
 * is about what code gives the model, deterministically.
 */

/** A day UJ's drafts (read 2026-10-17, 90 days) are current: the real-catalogue cases. */
const REAL_TODAY = new Date('2026-11-02T08:00:00Z');

export class AsksCampusTour implements ChatModel {
  readonly isSample = true;
  readonly writer = { provider: 'local', model: 'scripted-test-model' } as const;
  calls = 0;
  context = '';
  system = '';
  tour: { content: string; isError: boolean } | null = null;
  async respond(request: Parameters<ChatModel['respond']>[0]) {
    this.calls++;
    this.context = request.context;
    this.system = request.system;
    this.tour = await request.callTool('campus_tour', {});
    const text = 'Here is what the university itself says, and who to call.';
    request.onText(text);
    return { text, refused: false };
  }
}

export function safetyContext(testCase: SafetyAdviceCase) {
  const { universityId, records } = testCase.safetyAdvice;
  return fakeContext({
    offers: [acceptedOffer(universityId)],
    today: records === 'test' ? CAMPUS_TEST_TODAY : REAL_TODAY,
    ...(records === 'test' ? { catalogue: safetyTestView(true) } : {}),
  });
}

interface ToldAboutSafety {
  readonly safety_advice?: {
    readonly rules?: string;
    readonly notes?: ReadonlyArray<{ quote: string; unverified_preview: boolean }>;
    readonly who_to_call?: ReadonlyArray<{ name: string; number: string }>;
    readonly none_stored?: string;
  };
}

/** Why a safety case fails, or null. */
export function safetyReason(
  testCase: SafetyAdviceCase,
  model: AsksCampusTour,
  visible: ReadonlyArray<{ id: string; quote: string; verifiedOn?: string | undefined }>,
  card: CrisisCardArtifact | undefined,
): string | null {
  if (model.calls === 0) return 'the model was never reached for a safety question';
  if (!model.system.includes(SAFETY_ADVICE_GUIDANCE.guidance)) {
    return 'the model was not told never to judge a place';
  }
  if (!model.tour || model.tour.isError) return 'campus_tour gave the model nothing';
  const advice = (JSON.parse(model.tour.content) as ToldAboutSafety).safety_advice;
  if (advice?.rules !== SAFETY_ADVICE_RULES)
    return 'the tool did not give the rule with the advice';
  const notes = advice.notes ?? [];
  const calls = advice.who_to_call ?? [];
  // Stored notes only: every quote is a visible record's, word for word.
  const stored = new Map(visible.map((a) => [a.quote, a]));
  if (notes.some((n) => !stored.has(n.quote))) return 'gave advice that is not a stored note';
  const expired = safetyTestRecords().safetyAdvice.filter(
    (a) => !visible.some((v) => v.id === a.id),
  );
  if (notes.some((n) => expired.some((e) => e.quote === n.quote))) {
    return 'gave a note the learner may not see';
  }
  if (notes.some((n) => n.unverified_preview !== !stored.get(n.quote)?.verifiedOn)) {
    return 'a draft note was not flagged as preview';
  }
  if (testCase.safetyAdvice.notes === 'none') {
    if (notes.length > 0) return 'showed safety advice it had none';
    if (!/does not mean anywhere is safe/.test(advice.none_stored ?? '')) {
      return 'did not say that no advice is not a promise of safety';
    }
  } else {
    if (notes.length === 0) return 'missing the stored safety advice';
    const numbers = calls.map((c) => c.number);
    if (!numbers.includes('10111') || !numbers.includes('112')) {
      return 'the emergency numbers were missing';
    }
    if (calls.length < 3) return 'campus security was missing';
  }
  // Never a draft security place, whether in who_to_call or on a card (the test records hold one
  // beside the verified line; the view never returns the real catalogue's drafts at all).
  const drafts = draftSafetyPlaceIds();
  const draftNames = new Set(
    safetyTestRecords()
      .places.filter((p) => drafts.has(p.id))
      .map((p) => p.name),
  );
  if (calls.some((c) => draftNames.has(c.name))) return 'a draft security line was given';
  if (card?.campus?.lines.some((l) => drafts.has(l.id))) return 'a draft campus line was shown';
  return null;
}
