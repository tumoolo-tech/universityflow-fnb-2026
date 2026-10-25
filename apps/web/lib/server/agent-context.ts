import 'server-only';
import type { SubjectMark } from '@universityflow/admissions';
import { type AgentContext, targetIntakeFor } from '@universityflow/agent';
import type { CatalogueView } from '@universityflow/catalogue';
import type { StudentStore } from '@universityflow/db';
import { asAgentOffers } from './offers';
import { asAgentRegistration } from './registration';

/**
 * The agent's view of one learner, built on their StudentStore so every read and write still
 * goes through row-level security and the consent check.
 */
export async function agentContext(
  student: StudentStore,
  catalogue: CatalogueView,
  today = new Date(),
): Promise<AgentContext> {
  const profile = await student.profile();
  return {
    today,
    catalogue,
    targetIntake: targetIntakeFor(profile?.grade ?? null, today),
    async latestReport() {
      const report = await student.latestReport();
      if (!report) return null;
      return {
        kind: report.kind,
        confirmedAt: report.confirmedAt,
        // Stored marks were validated as NSC subjects when the learner confirmed them.
        marks: report.marks as ReadonlyArray<SubjectMark>,
      };
    },
    async shortlist() {
      return (await student.shortlist()).map((s) => s.programmeId);
    },
    addToShortlist: (id) => student.addToShortlist(id),
    async checklist(scope) {
      return (await student.checklist(scope)).map((c) => ({
        item: c.item,
        done: c.doneAt !== null,
      }));
    },
    async remember(kind, body) {
      await student.remember(kind, body);
    },
    async goal() {
      return (await student.goal())?.programmeId ?? null;
    },
    async setGoal(programmeId) {
      await student.setGoal(programmeId);
    },
    examChoices: () => student.examSubjectChoices(),
    async offers() {
      return asAgentOffers(await student.offers());
    },
    firstWeekSteps: (universityId) => student.firstWeekSteps(universityId),
    async registration() {
      const record = await student.registration();
      return record ? asAgentRegistration(record) : null;
    },
    async profile() {
      return profile
        ? {
            displayName: profile.displayName,
            grade: profile.grade,
            schoolFinished: profile.schoolFinished,
            goal: profile.goal,
          }
        : null;
    },
  };
}
