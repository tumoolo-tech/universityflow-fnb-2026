import 'server-only';
import {
  acceptedUniversity,
  assessCare,
  assessWithPrevious,
  type CrisisCampusLines,
  campusSafetyLines,
  crisisCard,
} from '@universityflow/agent';
import type { CatalogueView, Helpline } from '@universityflow/catalogue';
import type { StudentStore } from '@universityflow/db';
import type { WrittenCare } from '@/components/written-care';
import { asAgentOffers } from './offers';

/**
 * Words a learner just saved in their own hand (a plan map's part and its reflections, D3; the
 * profile's goal in their words, D9), read by the same deterministic crisis check as the chat
 * (planning.md §4.3, `assessDistress`). The words are saved anyway: refusing a learner's honest
 * reflection would punish them for it. The answer carries the crisis card, built by the same code
 * as the chat's from the lines the learner may see (verified only, outside a preview), with their
 * own campus lines when they have an accepted offer, and the page shows it at once.
 *
 * Nothing about the check is stored or logged (hard rule 4): no column, no audit row, no log line.
 * The words are only read here.
 */

/** The answer's shape, shared with the panel that shows it (components/written-care.tsx). */
export type { WrittenCare };

export interface WrittenWords {
  /** What the words were written under (a template stop's heading, or the part's own words). */
  readonly heading?: string | null;
  /** Every field as it now stands: the part's words, what got in the way, what to try. */
  readonly texts: ReadonlyArray<string | null | undefined>;
}

const joined = (words: WrittenWords) =>
  words.texts.filter((t): t is string => typeof t === 'string' && t.trim() !== '').join(' ');

/**
 * The care for `words`, or null. The heading is read before the words, as the chat reads a
 * message with the one before it (`assessWithPrevious`): "I just want to" over "die" is one
 * sentence.
 */
export function writtenCare(
  words: WrittenWords,
  helplines: ReadonlyArray<Helpline>,
  campus?: CrisisCampusLines,
): WrittenCare | null {
  const text = joined(words);
  if (text === '') return null;
  const distress = assessWithPrevious(words.heading?.trim() || undefined, text);
  if (distress.level !== 'none') {
    return { level: distress.level, card: crisisCard(helplines, distress.topics, campus) };
  }
  return assessCare(text).length > 0 ? { level: 'setback' } : null;
}

/**
 * `writtenCare` for a signed-in learner: their campus lines are asked for only when the words
 * need the card, and never allowed to stop it (without them, the card goes without them).
 */
export async function careForStudent(
  student: StudentStore,
  view: CatalogueView,
  words: WrittenWords,
): Promise<WrittenCare | null> {
  const care = writtenCare(words, view.helplines);
  if (care === null || care.level === 'setback') return care;
  let campus: CrisisCampusLines | undefined;
  try {
    campus = campusSafetyLines(view, acceptedUniversity(asAgentOffers(await student.offers())));
  } catch {
    campus = undefined;
  }
  return campus ? writtenCare(words, view.helplines, campus) : care;
}
