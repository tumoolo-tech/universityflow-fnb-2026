import { en } from '@universityflow/content';
import type { Metadata } from 'next';
import { getServices } from '@/lib/server/services';
import { readyStudent } from '@/lib/server/session';
import { subjectsResponse } from '@/lib/server/subjects';
import { SubjectsView } from './subjects-view';

export const metadata: Metadata = { title: en.subjects.title };

const one = (value: string | string[] | undefined) => (typeof value === 'string' ? value : null);

/**
 * My subjects (G10-4): which courses the subjects on the learner's confirmed report keep open,
 * worked out by code from the catalogue (hard rule 2), never by the AI. The university filter
 * (`?university=`) and the what-if (`?drop=&take=`) are GET forms, so the page needs no
 * JavaScript; neither is saved.
 */
export default async function SubjectsPage({
  searchParams,
}: {
  searchParams: Promise<{
    university?: string | string[];
    drop?: string | string[];
    take?: string | string[];
  }>;
}) {
  const signed = await readyStudent();
  const { catalogue } = await getServices();
  const params = await searchParams;
  const [report, goal] = await Promise.all([signed.student.latestReport(), signed.student.goal()]);
  const data = subjectsResponse(catalogue(), report, {
    goalId: goal?.programmeId ?? null,
    drop: one(params.drop),
    take: one(params.take),
  });
  return <SubjectsView data={data} university={one(params.university)} />;
}
