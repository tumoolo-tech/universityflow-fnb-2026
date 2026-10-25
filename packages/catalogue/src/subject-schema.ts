import { z } from 'zod';
import { isSubjectId, type SubjectId } from './subjects';

/** An NSC subject id, for the schemas that hold one. Kept apart so subjects.ts stays zod-free. */
export const subjectId = z.string().refine(isSubjectId, {
  message: 'Unknown NSC subject',
}) as unknown as z.ZodType<SubjectId>;
