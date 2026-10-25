import type { CollegeView } from '@universityflow/catalogue';
import { collegeView } from '@universityflow/catalogue/colleges';
import { getServices } from './services';

/**
 * The public TVET colleges a page may show (planning.md §19.1), read on the server only: the
 * college data never reaches a browser chunk (scripts/ci/client-chunks.mjs) or the phone app.
 * The same gate as the universities' catalogue: drafts only where `UF_CATALOGUE_PREVIEW=1`,
 * which production refuses (config.ts). Built once per UTC day, as the catalogue view is.
 */

const views = new Map<string, CollegeView>();

export function collegesFor(today: Date, includeDrafts: boolean): CollegeView {
  const key = `${today.toISOString().slice(0, 10)}|${includeDrafts}`;
  let view = views.get(key);
  if (!view) {
    view = collegeView(today, { includeDrafts });
    if (views.size >= 4) views.delete(views.keys().next().value as string);
    views.set(key, view);
  }
  return view;
}

export async function colleges(today = new Date()): Promise<CollegeView> {
  const { config } = await getServices();
  return collegesFor(today, config.catalogueDrafts);
}
