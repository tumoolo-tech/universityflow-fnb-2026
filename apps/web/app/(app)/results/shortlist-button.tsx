'use client';

import { results } from '@universityflow/content';
import { useState } from 'react';
import { Button } from '@/components/ui';
import { api } from '@/lib/client/api';

/** A programme card's shortlist toggle: the one client island inside a server-rendered card. */
export function ShortlistButton({
  programmeId,
  initial,
}: {
  programmeId: string;
  initial: boolean;
}) {
  const [on, setOn] = useState(initial);

  async function toggle() {
    await api('/api/shortlist', { method: on ? 'DELETE' : 'POST', json: { programmeId } });
    setOn(!on);
  }

  return (
    <Button variant={on ? 'secondary' : 'primary'} onClick={toggle} aria-pressed={on}>
      {on ? results.shortlisted : results.shortlist}
    </Button>
  );
}
