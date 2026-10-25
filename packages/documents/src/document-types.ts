import { z } from 'zod';

/**
 * The documents a student can hand the agent, one per journey stage (planning.md §3).
 *
 * Each gets its own extraction schema in the phase that needs it; this list is what the upload
 * flow, the extraction prompts and the confirmation step (hard rule 6) all key off.
 */
export const documentType = z.enum([
  'grade-11-report',
  'grade-12-report',
  'acceptance-letter',
  'proof-of-registration',
  'marked-test',
  // Phase 6b: a module outline or study guide (module-outline.ts).
  'module-outline',
]);

export type DocumentType = z.infer<typeof documentType>;
