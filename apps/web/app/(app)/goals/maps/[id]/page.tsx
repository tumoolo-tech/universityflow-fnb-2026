import { en } from '@universityflow/content';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { HttpError } from '@/lib/server/http';
import { ownMap, planMapView, planWordsAllowed } from '@/lib/server/plan-maps';
import { planCopy, templateCopy } from '@/lib/server/plan-maps-copy';
import { getServices } from '@/lib/server/services';
import { readyStudent } from '@/lib/server/session';
import { PlanMapPage } from './plan-map-view';

export const metadata: Metadata = { title: en.planMaps.title };

/**
 * One of the learner's plan maps (docs/design/plan-maps-proposal.md §4, D10: its own page, the map
 * needs the width). The list is rendered here, so the map is there without JavaScript; the page's
 * client code receives its words as props (the launch standard). Another learner's map is not
 * found (row-level security).
 */
export default async function PlanMapRoute({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const signed = await readyStudent();
  const { id } = await params;
  const { catalogue } = await getServices();
  let record: Awaited<ReturnType<typeof ownMap>>;
  try {
    record = await ownMap(signed.student, id);
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) notFound();
    throw error;
  }
  const map = await planMapView(signed.student, catalogue(), record, await planWordsAllowed());
  return (
    <PlanMapPage
      map={map}
      copy={planCopy()}
      template={templateCopy(map.templateId)}
      justCreated={(await searchParams)['new'] === '1'}
    />
  );
}
