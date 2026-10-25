import { en } from '@universityflow/content';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { applicationSummaries } from '@/lib/server/applications';
import { getServices } from '@/lib/server/services';
import { readyStudent } from '@/lib/server/session';
import { PackView } from './pack-view';

export const metadata: Metadata = { title: en.applications.pack };

/** Stage 2: one university's application pack. */
export default async function PackPage({ params }: { params: Promise<{ university: string }> }) {
  const { university } = await params;
  const signed = await readyStudent();
  const { catalogue } = await getServices();
  const { applications, targetIntake } = await applicationSummaries(signed.student, catalogue());
  const application = applications.find((a) => a.university.id === university);
  if (!application) notFound();
  return <PackView application={application} targetIntake={targetIntake} />;
}
