import { en } from '@universityflow/content';
import type { Metadata } from 'next';
import { goalsPage } from '@/lib/server/goals';
import { planMapsResponse } from '@/lib/server/plan-maps';
import { planCopy, templateChoices } from '@/lib/server/plan-maps-copy';
import { getServices } from '@/lib/server/services';
import { readyStudent } from '@/lib/server/session';
import { GoalsView } from './goals-view';
import { PlanMapsCard } from './plan-maps-card';

export const metadata: Metadata = { title: en.goals.title };

/**
 * Stage 3: the learner's goal (one target programme and where they stand for it) and their exam
 * countdown, and free practice for the subjects that matter, built by the same code as the agent's
 * tools (hard rule 2). My plan maps sit after "Change my goal" (D10), their words as props.
 */
export default async function GoalsPage() {
  const signed = await readyStudent();
  const { catalogue } = await getServices();
  // One read of each record, not one per panel (A4-07).
  const [{ goal, exams, practice }, plans] = await Promise.all([
    goalsPage(signed.student, catalogue()),
    planMapsResponse(signed.student),
  ]);
  return (
    <GoalsView
      goal={goal}
      exams={exams}
      practice={practice}
      plans={
        <PlanMapsCard
          initial={plans}
          copy={planCopy()}
          templates={templateChoices()}
          hasGoal={goal.goalId !== null}
        />
      }
    />
  );
}
