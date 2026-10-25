import { whatINeedFor } from '@universityflow/admissions';
import { en } from '@universityflow/content';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { EmptyState, Page } from '@/components/ui';
import { WhatINeedCard } from '@/components/what-i-need';
import { formatDate } from '@/lib/client/api';
import { scored } from '@/lib/server/scored';
import { getServices } from '@/lib/server/services';
import { readyStudent } from '@/lib/server/session';

export const metadata: Metadata = { title: en.whatINeed.title };

/**
 * "What I need per subject" for one course (Phase 4c), from the learner's latest confirmed
 * report (hard rule 6), computed by packages/admissions (hard rule 2).
 */
export default async function WhatINeedPage({
  params,
}: {
  params: Promise<{ programmeId: string }>;
}) {
  const { programmeId } = await params;
  const signed = await readyStudent();
  const report = await signed.student.latestReport();
  if (!report) {
    return (
      <Page title={en.whatINeed.title} lead={en.whatINeed.lead}>
        <EmptyState action={{ href: '/documents', label: en.results.addReport }}>
          {en.results.noReport}
        </EmptyState>
      </Page>
    );
  }
  const { catalogue } = await getServices();
  const result = whatINeedFor(catalogue(), programmeId, scored(report));
  if (!result) notFound();
  return (
    <Page title={en.whatINeed.title} lead={en.whatINeed.lead}>
      <p className="text-sm text-muted">
        {en.results.reportFrom(
          en.reportKinds[report.kind as keyof typeof en.reportKinds] ?? report.kind,
          formatDate(report.confirmedAt.toISOString()),
        )}
      </p>
      <WhatINeedCard result={result} />
      <Link href="/results" className="inline-flex min-h-11 items-center">
        {en.whatINeed.back}
      </Link>
    </Page>
  );
}
