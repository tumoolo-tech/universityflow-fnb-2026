import { en } from '@universityflow/content';
import type { Metadata } from 'next';
import { registrationResponse } from '@/lib/server/registration';
import { getServices } from '@/lib/server/services';
import { readyStudent } from '@/lib/server/session';
import { ModulesView } from './modules-view';

export const metadata: Metadata = { title: en.modules.title };

/**
 * Stage 5: the registration check, My modules (Phase 5c). The check is built by the same code as
 * the agent's compare_registration tool (hard rule 2); nothing is compared until the learner
 * confirms every row (hard rule 6).
 */
export default async function ModulesPage() {
  const signed = await readyStudent();
  const { catalogue, offeredChannels, uploads } = await getServices();
  const data = await registrationResponse(signed.student, catalogue(), offeredChannels);
  return <ModulesView initial={data} direct={uploads !== null} />;
}
