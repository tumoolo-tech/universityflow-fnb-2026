import { isDraft } from '@universityflow/catalogue';
import { en } from '@universityflow/content';
import type { Metadata } from 'next';
import { EmptyState, Page } from '@/components/ui';
import { getServices } from '@/lib/server/services';
import { readyStudent } from '@/lib/server/session';
import { FundingView } from './funding-view';

export const metadata: Metadata = { title: en.funding.title };

/** Stage 2: NSFAS, first-class (planning.md §9). */
export default async function FundingPage() {
  const signed = await readyStudent();
  const { catalogue } = await getServices();
  const nsfas = catalogue().nsfas;
  const done = new Set(
    (await signed.student.checklist('funding:nsfas')).filter((c) => c.doneAt).map((c) => c.item),
  );
  if (!nsfas) {
    return (
      <Page title={en.funding.title} lead={en.funding.lead}>
        <EmptyState>{en.common.unknown}</EmptyState>
      </Page>
    );
  }
  return <FundingView nsfas={nsfas} draft={isDraft(nsfas)} done={[...done]} />;
}
