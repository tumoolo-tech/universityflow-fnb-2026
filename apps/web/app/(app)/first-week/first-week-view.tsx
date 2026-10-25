'use client';

import type { FirstWeekArtifact } from '@universityflow/agent';
import { type FirstWeekStep, firstWeek } from '@universityflow/content';
import { useRef, useState } from 'react';
import { FirstWeekCard } from '@/components/campus';
import { Notice } from '@/components/ui';
import { api, errorMessage } from '@/lib/client/api';
import type { FirstWeekResponse } from '@/lib/server/campus';

/**
 * The checklist with its boxes: each tick is saved at once, and said when saved. The box being
 * saved keeps keyboard focus (A3-12): it is never `disabled`, and a press while a save runs does
 * nothing (A3-01).
 */
export function FirstWeekView({ initial }: { initial: FirstWeekArtifact }) {
  const [checklist, setChecklist] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const inFlight = useRef(false);

  async function toggle(step: FirstWeekStep, done: boolean) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      const next = await api<FirstWeekResponse>('/api/first-week', {
        method: 'PUT',
        json: { universityId: checklist.universityId, step, done },
      });
      if (next.checklist) setChecklist(next.checklist);
      setStatus(firstWeek.saved);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {error ? <Notice tone="danger">{error}</Notice> : null}
      <p role="status" className="sr-only">
        {status ?? ''}
      </p>
      <FirstWeekCard artifact={checklist} onToggle={(s, d) => void toggle(s, d)} busy={busy} />
    </div>
  );
}
