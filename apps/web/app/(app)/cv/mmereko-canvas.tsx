'use client';

import type { cvMmereko } from '@universityflow/content';
import { type SyntheticEvent, useEffect, useId, useRef, useState } from 'react';
import { Button, ButtonLink, Card } from '@/components/ui';
import { MMEREKO_FRAME_ALLOW, MMEREKO_FRAME_SANDBOX } from '@/lib/mmereko-canvas';

/** The canvas's words, as props (the launch standard: copy reaches a client component as props). */
export type MmerekoCanvasCopy = { readonly [K in keyof typeof cvMmereko]: string };

/**
 * "Open Mmereko" on My CV (the owner's decision of 2026-10-24): a real button that opens
 * Mmereko's own site in a full-screen modal dialog over the page. The server renders this only for
 * a learner 18 or over or at university, with the switch on (page.tsx).
 *
 * - Nothing about the learner goes to Mmereko: its sign-in page, no query, no message, no prefill.
 *   The frame is made only once the dialog opens, so a visit to My CV asks Mmereko for nothing.
 * - The frame is sandboxed (lib/mmereko-canvas.ts: no top navigation) and sends no referrer.
 * - "Open in a new tab" is always there: another account's sign-in or an email link may not
 *   finish inside a frame.
 * - Focus moves to Close on opening and back to the button on closing; Esc closes (the browser's
 *   own `cancel`, and a keydown for the rest); the page behind doesn't scroll. No animation.
 */
export function MmerekoCanvas({
  copy,
  loginUrl,
  siteUrl,
}: {
  copy: MmerekoCanvasCopy;
  loginUrl: string;
  siteUrl: string;
}) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const openerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const separateId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!open || !dialog) return;
    if (!dialog.open) dialog.showModal();
    closeRef.current?.focus();
    const root = document.documentElement;
    const before = root.style.overflow;
    root.style.overflow = 'hidden';
    return () => {
      root.style.overflow = before;
    };
  }, [open]);

  function shut() {
    const dialog = dialogRef.current;
    if (dialog?.open) dialog.close();
    setOpen(false);
    openerRef.current?.focus();
  }

  function onCancel(event: SyntheticEvent<HTMLDialogElement>) {
    // Esc: closed here, so the state, the scroll and the focus follow it.
    event.preventDefault();
    shut();
  }

  return (
    <Card aria-labelledby={`${titleId}-card`} className="flex flex-col items-start gap-3">
      <h2 id={`${titleId}-card`} className="text-lg">
        {copy.title}
      </h2>
      <p className="text-muted">{copy.lead}</p>
      <Button ref={openerRef} onClick={() => setOpen(true)}>
        {copy.open}
      </Button>
      <dialog
        ref={dialogRef}
        className="uf-mmereko-canvas"
        aria-labelledby={titleId}
        aria-describedby={separateId}
        onCancel={onCancel}
        onClose={() => {
          if (open) shut();
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            shut();
          }
        }}
      >
        <div className="uf-mmereko-canvas-bar">
          <div className="flex min-w-0 flex-col gap-1">
            <h2 id={titleId} className="text-lg">
              {copy.title}
            </h2>
            <p id={separateId} className="text-sm">
              {copy.separate}{' '}
              <a href={siteUrl} target="_blank" rel="noopener noreferrer">
                {copy.siteLink}
              </a>
            </p>
            <p className="text-sm text-muted">{copy.newTabHint}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ButtonLink href={loginUrl} variant="secondary" newTab>
              {copy.newTab}
            </ButtonLink>
            <Button ref={closeRef} variant="secondary" onClick={shut}>
              {copy.close}
            </Button>
          </div>
        </div>
        {open ? (
          <iframe
            className="uf-mmereko-canvas-frame"
            src={loginUrl}
            title={copy.frameTitle}
            referrerPolicy="no-referrer"
            sandbox={MMEREKO_FRAME_SANDBOX}
            allow={MMEREKO_FRAME_ALLOW}
          />
        ) : null}
      </dialog>
    </Card>
  );
}
