import 'server-only';

/**
 * HACKATHON EXCEPTION (2026-10-24, docs/deploy/hackathon-undo-pr.md section I): the judge demo's
 * made-up university learners (first year, second year, final year) agree in their own name to
 * the DRAFT adult agreement adult-v3, which names module outlines (docs/legal/consent-v4-draft.md,
 * C9) but is owed legal review and is not live. Only so the judges can upload the SAMPLE module
 * outline end to end. The production gate is unchanged: migration 0040 still refuses an outline
 * under anything older than adult-v3 / guardian v4, for every learner, made-up or not; this only
 * records the draft wording on the demo's own made-up records. Every other learner, on the demo
 * included (the on-screen sign-up), agrees to the live wording.
 *
 * The version names itself a draft for the demo, so it can never be mistaken for the live adult-v3.
 */
export const DEMO_DRAFT_ADULT_CONSENT_VERSION = 'adult-v3-draft-demo-only';
