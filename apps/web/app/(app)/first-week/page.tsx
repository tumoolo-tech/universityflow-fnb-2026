import { en } from '@universityflow/content';
import type { Metadata } from 'next';
import { Page } from '@/components/ui';
import { chosenUniversity, firstWeekResponse } from '@/lib/server/campus';
import { getServices } from '@/lib/server/services';
import { readyStudent } from '@/lib/server/session';
import { UniversityChooser } from '../campus/university-chooser';
import { FirstWeekView } from './first-week-view';

export const metadata: Metadata = { title: en.firstWeek.title };

/**
 * Stage 4: the first-week checklist (Phase 5b). Steps from content, dates from the university's
 * registration calendar, progress per learner (migration 0019). Same code as the first_week tool.
 */
export default async function FirstWeekPage({
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
  const data = await firstWeekResponse(signed.student, catalogue(), chosen);
  return (
    <Page title={en.firstWeek.title} lead={en.firstWeek.lead}>
      {data.checklist ? <FirstWeekView initial={data.checklist} /> : null}
      <UniversityChooser
        path="/first-week"
        options={data.options}
        current={data.checklist?.universityId ?? null}
        hasTour={data.checklist !== null}
      />
    </Page>
  );
}
