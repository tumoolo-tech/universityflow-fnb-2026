'use client';

import type { CvReportReason } from '@universityflow/content';
import Link from 'next/link';
import { type FormEvent, useId, useRef, useState } from 'react';
import { Button, Notice } from '@/components/ui';
import { api } from '@/lib/client/api';
import type { CvKit } from './cv-view';

/**
 * "Report this CV" under a fitted CV's preview (A10-58; design §11, the pattern of "Report this
 * reply", A10-35): a quiet button that opens a short form in place (no pop-up), a reason from the
 * fixed list and never free text (hard rule 4). After sending, a thank-you takes the form's place
 * and focus; "harmful or upsetting" adds where to find someone now. Its words, and so its reasons
 * (one for each of CV_REPORT_REASONS, packages/content's test), come as props.
 */
export function CvReport({
  documentId,
  reported,
  kit,
  onReported,
}: {
  documentId: string;
  reported: boolean;
  kit: CvKit;
  onReported: (id: string) => void;
}) {
  const t = kit.copy.report;
  const [state, setState] = useState<'closed' | 'open' | 'sent'>('closed');
  const [reason, setReason] = useState<CvReportReason | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const openRef = useRef<HTMLButtonElement>(null);
  const firstRef = useRef<HTMLInputElement>(null);
  const sentRef = useRef<HTMLDivElement>(null);
  const name = useId();

  if (reported && state !== 'sent') return <p className="text-sm text-muted">{t.reported}</p>;

  async function send(event: FormEvent) {
    event.preventDefault();
    if (!reason || busy) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/api/me/cv/documents/${documentId}/report`, {
        method: 'POST',
        json: { reason },
      });
      setState('sent');
      onReported(documentId);
      kit.focusAfter(() => sentRef.current);
    } catch {
      setError(t.error);
    } finally {
      setBusy(false);
    }
  }

  if (state === 'sent') {
    return (
      <div ref={sentRef} role="status" tabIndex={-1} className="text-sm">
        <p>{t.sent}</p>
        {reason === 'harmful' ? (
          <p>
            {t.helpLead}{' '}
            <Link href="/help" className="inline-flex min-h-11 items-center">
              {t.help}
            </Link>
          </p>
        ) : null}
      </div>
    );
  }

  if (state === 'closed') {
    return (
      <button
        ref={openRef}
        type="button"
        className="inline-flex min-h-11 items-center self-start text-sm text-muted underline hover:text-ink"
        onClick={() => {
          setState('open');
          kit.focusAfter(() => firstRef.current);
        }}
      >
        {t.open}
      </button>
    );
  }

  return (
    <form onSubmit={send} className="flex flex-col gap-2 rounded-md border border-line p-3 text-sm">
      <fieldset className="flex flex-col">
        <legend className="mb-1 font-medium">{t.question}</legend>
        {(Object.keys(t.reasons) as CvReportReason[]).map((r, i) => (
          <label key={r} className="flex min-h-11 cursor-pointer items-center gap-3">
            <input
              ref={i === 0 ? firstRef : undefined}
              type="radio"
              name={name}
              value={r}
              checked={reason === r}
              onChange={() => setReason(r)}
              className="size-5 shrink-0 accent-brand"
            />
            {t.reasons[r]}
          </label>
        ))}
      </fieldset>
      {error ? <Notice tone="danger">{error}</Notice> : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" aria-disabled={!reason || busy}>
          {t.send}
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            setState('closed');
            setError(null);
            kit.focusAfter(() => openRef.current);
          }}
        >
          {t.cancel}
        </Button>
      </div>
    </form>
  );
}
