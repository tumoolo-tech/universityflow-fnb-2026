import { bursariesFor, isDraft, sastDateOf } from '@universityflow/catalogue';
import { en } from '@universityflow/content';
import type { Metadata } from 'next';
import { BursaryList } from '@/components/bursary-list';
import { EmptyState, Page } from '@/components/ui';
import { getServices } from '@/lib/server/services';
import { readyStudent } from '@/lib/server/session';
import { FundingView } from './funding-view';

export const metadata: Metadata = { title: en.funding.title };

/** Stage 2: NSFAS, first-class (planning.md §9), and other bursaries beside it (§3). */
export default async function FundingPage() {
  const signed = await readyStudent();
  const { catalogue } = await getServices();
  const view = catalogue();
  const nsfas = view.nsfas;
  const done = new Set(
    (await signed.student.checklist('funding:nsfas')).filter((c) => c.doneAt).map((c) => c.item),
  );
  // Whether each window is open is the catalogue's to decide; `draft` is worked out here so the
  // catalogue's zod stays out of the browser (A4-02).
  const bursaries = bursariesFor(view.bursaries ?? [], new Date()).map((entry) => ({
    ...entry,
    draft: isDraft(entry.bursary),
  }));
  // Today in South Africa, for every card's days left (RT-05).
  const today = sastDateOf(new Date());
  const others = bursaries.length > 0 ? <BursaryList entries={bursaries} today={today} /> : null;
  if (!nsfas) {
    return (
      <Page title={en.funding.title} lead={en.funding.lead}>
        <EmptyState>{en.common.unknown}</EmptyState>
        {others}
      </Page>
    );
  }
  return (
    // The page's own rhythm (Page's gap-6) between NSFAS and the bursaries after it.
    <div className="flex flex-col gap-6">
      <FundingView nsfas={nsfas} draft={isDraft(nsfas)} done={[...done]} today={today} />
      {others}
    </div>
  );
}
