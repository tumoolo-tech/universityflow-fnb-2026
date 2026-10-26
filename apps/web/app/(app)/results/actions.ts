'use server';

import { learnerResults } from '@/lib/server/results';
import { readyStudent } from '@/lib/server/session';
import { isCollapsedGroup, type LoadedGroup, resultsGroups } from './results-groups';

/**
 * A collapsed group's cards (Plan B, or a Grade 10 learner's colleges' group), fetched when the
 * learner opens it (audit A4-19): the page no longer carries 45 college cards nobody has asked
 * for. The cards are the same server-rendered ones the page draws, computed again here by
 * packages/admissions from the learner's own confirmed report (hard rule 2); the browser gets
 * them as rendered React, never the catalogue's data.
 *
 * The one server action in the app. It takes one word, checked against the two groups that may
 * be asked for, and answers only a signed-in, consented learner (readyStudent), with their own
 * results: there is nothing to pass in that could name another learner.
 */
export async function loadResultsGroup(groupId: string): Promise<LoadedGroup> {
  if (!isCollapsedGroup(groupId)) throw new Error('Not a group that loads on demand');
  const signed = await readyStudent();
  const learner = await learnerResults(signed);
  if (!learner) return { cards: [] };
  const { cardsOf } = resultsGroups({
    results: learner.results,
    shortlist: new Set(learner.shortlist),
    colleges: learner.colleges,
  });
  return { cards: cardsOf(groupId) };
}
