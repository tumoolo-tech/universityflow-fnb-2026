import { en } from '@universityflow/content';
import type { Metadata } from 'next';
import { CampusTour } from '@/components/campus';
import { Page } from '@/components/ui';
import { campusResponse, chosenUniversity } from '@/lib/server/campus';
import { getServices } from '@/lib/server/services';
import { readyStudent } from '@/lib/server/session';
import { UniversityChooser } from './university-chooser';

export const metadata: Metadata = { title: en.campus.title };

/**
 * Stage 4: My campus (Phase 5b). The accepted offer's university, or one the learner chose to look
 * around (`?university=`); never assumed. Built by the same code as the agent's campus_tour tool.
 */
export default async function CampusPage({
  searchParams,
}: {
  searchParams: Promise<{ university?: string | string[] }>;
}) {
  const signed = await readyStudent();
  const { university } = await searchParams;
  let chosen = null;
  try {
    chosen = chosenUniversity(typeof university === 'string' ? university : null);
  } catch {
    // An unknown university in the address: show the choice instead.
  }
  const { catalogue } = await getServices();
  const data = await campusResponse(signed.student, catalogue(), chosen);
  return (
    <Page title={en.campus.title} lead={en.campus.lead}>
      {data.tour ? <CampusTour artifact={data.tour} /> : null}
      <UniversityChooser
        path="/campus"
        options={data.options}
        current={data.tour?.universityId ?? null}
        hasTour={data.tour !== null}
      />
    </Page>
  );
}
