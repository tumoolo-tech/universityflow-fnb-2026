import 'server-only';
import { type CatalogueView, isDraft, programmeById } from '@universityflow/catalogue';
import type { RegistrationRecord, StudentStore } from '@universityflow/db';
import { type HomeData, type LearnerStage, learnerStage, universityYear } from '@universityflow/ui';

/**
 * Where the learner is (A2-66): their stage (`learnerStage`), and at university where in the
 * degree (`universityYear`), so the home, the chat's welcome and Applications speak to a second
 * or final year as one, never as an arriving or school learner. The year of study is the
 * learner's own (their confirmed registration); the course's duration is the catalogue's, read
 * from the view this learner may see (hard rules 2 and 3), so with no record the year is never
 * called "final".
 */
export interface LearnerPlace {
  readonly stage: LearnerStage;
  readonly universityYear: HomeData['universityYear'];
}

export function placeFrom(
  view: CatalogueView,
  input: {
    readonly grade: number | null;
    readonly offers: ReadonlyArray<{ readonly status: string }>;
    readonly registration: Pick<RegistrationRecord, 'programmeId' | 'yearOfStudy'> | null;
  },
): LearnerPlace {
  const stage = learnerStage({
    grade: input.grade,
    offers: input.offers,
    registered: input.registration !== null,
  });
  if (stage !== 'university') return { stage, universityYear: null };
  const yearOfStudy = input.registration?.yearOfStudy ?? null;
  const programme = input.registration
    ? programmeById(view, input.registration.programmeId)
    : undefined;
  const group = universityYear({ yearOfStudy, durationYears: programme?.durationYears ?? null });
  return {
    stage,
    universityYear: {
      group,
      yearOfStudy,
      // Only "final" rests on the catalogue: say so when its record is not yet verified.
      draft: group === 'final' && programme !== undefined && isDraft(programme),
    },
  };
}

/** The same, read from the learner's own records. */
export async function learnerPlace(
  student: StudentStore,
  view: CatalogueView,
): Promise<LearnerPlace> {
  const [profile, offers, registration] = await Promise.all([
    student.profile(),
    student.offers(),
    student.registration(),
  ]);
  return placeFrom(view, { grade: profile?.grade ?? null, offers, registration });
}
