import { en } from '@universityflow/content';
import type { Metadata } from 'next';
import { outlinesResponse } from '@/lib/server/module-outlines';
import { getServices } from '@/lib/server/services';
import { readyStudent } from '@/lib/server/session';
import { OutlineView } from './outline-view';

export const metadata: Metadata = { title: en.moduleOutline.title };

/**
 * Stage 6: module outlines (Phase 6b). Nothing read from an outline is used until the learner
 * checks it part by part (hard rule 6); the file goes once they do (D10).
 */
export default async function ModuleOutlinePage() {
  const signed = await readyStudent();
  const { uploads, config } = await getServices();
  const data = await outlinesResponse(signed.student);
  return <OutlineView initial={data} direct={uploads !== null} demo={config.demo} />;
}
