import { en } from '@universityflow/content';
import type { Metadata } from 'next';
import { offersResponse } from '@/lib/server/offers';
import { getServices } from '@/lib/server/services';
import { readyStudent } from '@/lib/server/session';
import { OffersView } from './offers-view';

export const metadata: Metadata = { title: en.offers.title };

/**
 * Stage 4: the learner's offers (Phase 5a). Each card is built by the same code as the agent's
 * offers tool (hard rule 2); an offer is added only once the learner confirms it (hard rule 6).
 */
export default async function OffersPage() {
  const signed = await readyStudent();
  const { catalogue, offeredChannels, uploads } = await getServices();
  const data = await offersResponse(signed.student, catalogue(), offeredChannels);
  return <OffersView initial={data} direct={uploads !== null} />;
}
