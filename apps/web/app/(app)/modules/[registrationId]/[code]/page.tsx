import { common, moduleCard } from '@universityflow/content';
import { calculatorWords, moduleCardView } from '@universityflow/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { MarkCalculator } from '@/components/mark-calculator';
import { ModuleCard } from '@/components/module-card';
import { Page } from '@/components/ui';
import { formatDate } from '@/lib/client/api';
import { HttpError } from '@/lib/server/http';
import { moduleCardData } from '@/lib/server/module-card';
import { getServices } from '@/lib/server/services';
import { readyStudent } from '@/lib/server/session';

export const metadata: Metadata = { title: moduleCard.pageTitle };

/**
 * Stage 6: one confirmed module's card (Phase 6c), opened from a My modules row. Rendered on the
 * server from `moduleCardView`; the mark calculator is the only client component, given the
 * resolved scheme (never catalogue records) and its words as props. Only a module on the learner's
 * own confirmed registration has a card: anything else is not found.
 */
export default async function ModuleCardPage({
  params,
}: {
  params: Promise<{ registrationId: string; code: string }>;
}) {
  const { registrationId, code } = await params;
  const signed = await readyStudent();
  const { catalogue, config } = await getServices();
  let decoded: string;
  try {
    decoded = decodeURIComponent(code);
  } catch {
    notFound();
  }
  const data = await moduleCardData(
    signed.student,
    catalogue(),
    { registrationId, code: decoded },
    { demo: config.demo },
  ).catch((error: unknown) => {
    if (error instanceof HttpError && error.status === 404) notFound();
    throw error;
  });
  const view = moduleCardView(data, formatDate);
  const title = view.name ? `${view.code}: ${view.name}` : view.code;
  return (
    <Page title={title} lead={`${view.universityName} · ${view.subtitle}`}>
      <p>
        <Link href="/modules" className="inline-flex min-h-11 items-center">
          {moduleCard.back}
        </Link>
      </p>
      <ModuleCard
        view={view}
        calculator={
          <MarkCalculator
            scheme={data.scheme}
            words={calculatorWords()}
            initial={{ marks: data.marks, target: data.target }}
            saveUrl={`/api/modules/${data.registrationId}/${encodeURIComponent(data.module.code)}`}
            sample={data.sample}
            savingLabel={common.saving}
          />
        }
      />
    </Page>
  );
}
