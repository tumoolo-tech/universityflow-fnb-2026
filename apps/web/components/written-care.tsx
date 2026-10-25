'use client';

import type { CrisisCardArtifact } from '@universityflow/agent';
import { useEffect, useRef } from 'react';
import { CrisisCard } from '@/components/crisis-card';
import { Button, ButtonLink } from '@/components/ui';

/**
 * What a save of the learner's own words answers when they need care (D3, D9;
 * lib/server/plan-care.ts): the words are saved anyway. For a crisis, the reviewed lead and the
 * crisis card, whose title ("Talk to someone now") takes focus at once; for a concern, the softer
 * lead, the card and the companion (the chat opens empty: the words are not sent). A setback gets
 * one kind line. No animation (M7). It stays until the learner says they have seen it.
 */

export type WrittenCare =
  | { readonly level: 'crisis' | 'concern'; readonly card: CrisisCardArtifact }
  /** A hard moment that isn't distress (a setback, giving up on the goal): one kind line. */
  | { readonly level: 'setback' };

/** Its words, from `en.planMaps.care`, as props (the launch standard). */
export interface CareWords {
  readonly crisisLead: string;
  readonly concernLead: string;
  readonly companion: string;
  readonly seen: string;
  readonly setback: string;
}

export function WrittenCarePanel({
  care,
  words,
  onSeen,
}: {
  care: WrittenCare;
  words: CareWords;
  onSeen: () => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (care.level === 'setback') return;
    const heading = box.current?.querySelector<HTMLElement>('h2');
    if (!heading) return;
    heading.tabIndex = -1;
    heading.focus();
  }, [care]);

  if (care.level === 'setback') return <p className="text-muted">{words.setback}</p>;
  return (
    <div ref={box} className="uf-map-care flex flex-col gap-3">
      <p className="font-medium">
        {care.level === 'crisis' ? words.crisisLead : words.concernLead}
      </p>
      {/* Its title, "Talk to someone now", is where focus goes. */}
      <CrisisCard artifact={care.card} />
      <div className="flex flex-wrap gap-2">
        {care.level === 'concern' ? (
          <ButtonLink href="/chat" variant="secondary">
            {words.companion}
          </ButtonLink>
        ) : null}
        <Button variant="secondary" onClick={onSeen}>
          {words.seen}
        </Button>
      </div>
    </div>
  );
}
