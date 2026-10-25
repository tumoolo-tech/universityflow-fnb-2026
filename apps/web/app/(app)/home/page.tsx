import { en } from '@universityflow/content';
import type { Metadata } from 'next';
import { ComingNext, showsComingNext } from '@/components/coming-next';
import { Dashboard } from '@/components/dashboard';
import { homeData } from '@/lib/server/home';
import { getServices } from '@/lib/server/services';
import { readyStudent } from '@/lib/server/session';

export const metadata: Metadata = { title: en.dashboard.title };

/**
 * The signed-in home (docs/design/README.md): where sign-in lands. The learner's stage, their own
 * numbers and next step, worked out by the same code as the pages each card links to (hard rule 2).
 * Once a university student's first week is behind them, what's coming next for their years.
 */
export default async function HomePage() {
  const signed = await readyStudent();
  const { catalogue } = await getServices();
  const data = await homeData(signed.student, catalogue(), new Date(), signed.account);
  return (
    <div className="flex flex-col gap-6">
      <Dashboard data={data} />
      {showsComingNext(data) ? <ComingNext /> : null}
    </div>
  );
}
