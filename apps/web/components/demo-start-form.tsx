'use client';

import { type FormEvent, useEffect, useState } from 'react';
import { Button } from './ui';

/**
 * One persona card's "Try as …" (the judge demo's slow start, 2026-10-25). Still a plain form
 * posting to /api/demo/start, so the first press works before any script has loaded; with script,
 * the press says at once that the learner's copy is being made (on the button, and to a screen
 * reader through a status line that is always there), and a second press is ignored, so one
 * impatient judge doesn't make two copies. Back from the next page (the browser's page cache), the
 * button is as it was. No animation: the words change, nothing moves (hard rule 9).
 */
export function DemoStartForm({
  persona,
  label,
  startingLabel,
  startingNote,
}: {
  persona: string;
  /** "Try as Thandi". */
  label: string;
  /** On the button while the copy is made. */
  startingLabel: string;
  /** Said once by the status line: how long, and to keep the page open. */
  startingNote: string;
}) {
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    const back = (event: PageTransitionEvent) => {
      if (event.persisted) setStarting(false);
    };
    window.addEventListener('pageshow', back);
    return () => window.removeEventListener('pageshow', back);
  }, []);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    if (starting) {
      event.preventDefault();
      return;
    }
    setStarting(true);
  };

  return (
    <form action="/api/demo/start" method="post" onSubmit={submit} aria-busy={starting}>
      <input type="hidden" name="persona" value={persona} />
      <Button type="submit" className="w-full" aria-disabled={starting || undefined}>
        {starting ? startingLabel : label}
      </Button>
      <p role="status" className={starting ? 'pt-2 text-sm text-muted' : 'text-sm text-muted'}>
        {starting ? startingNote : ''}
      </p>
    </form>
  );
}
