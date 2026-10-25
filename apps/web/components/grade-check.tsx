'use client';

import { common, dashboard } from '@universityflow/content';
import { useId, useRef, useState } from 'react';
import { api, errorMessage } from '@/lib/client/api';
import { useFocusAfter } from '@/lib/client/focus';
import { Button, ButtonLink, Card, Notice } from './ui';

/**
 * "Are you in Grade N now?" on the home each January, once a new school year moved the grade up
 * (G10-1). Yes records it afresh (PATCH /api/me), so it isn't asked again this year; No goes to
 * About me, where the grade can be changed. After Yes the buttons give way to "Saved", which takes
 * focus, so a keyboard or screen-reader learner hears it worked and keeps their place (A3-29).
 * Nothing else on the home depends on it, so the page isn't reloaded; the next visit has no card.
 */
export function GradeCheck({ grade }: { grade: number }) {
  const t = dashboard.gradeCheck;
  const titleId = useId();
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const savedRef = useRef<HTMLParagraphElement>(null);
  const focusAfter = useFocusAfter();

  async function confirm() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await api('/api/me', { method: 'PATCH', json: { grade } });
      setSaved(true);
      focusAfter(() => savedRef.current);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card aria-labelledby={titleId} className="flex flex-col gap-3">
      <h2 id={titleId} className="text-lg">
        {t.title(grade)}
      </h2>
      <p className="text-muted">{t.lead}</p>
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {saved ? (
        <p ref={savedRef} role="status" tabIndex={-1} className="font-medium">
          {common.saved}
        </p>
      ) : (
        <div className="flex flex-wrap gap-3">
          <Button onClick={confirm} aria-disabled={busy}>
            {t.yes(grade)}
          </Button>
          <ButtonLink href="/me#grade" variant="secondary">
            {t.change}
          </ButtonLink>
        </div>
      )}
    </Card>
  );
}
