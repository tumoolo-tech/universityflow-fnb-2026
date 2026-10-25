'use client';

import { useEffect, useId, useRef, useState } from 'react';
import {
  Button,
  Card,
  Checkbox,
  Field,
  Input,
  Notice,
  StatusLine,
  TextArea,
} from '@/components/ui';
import { type WrittenCare, WrittenCarePanel } from '@/components/written-care';
import { ApiError, api, formatDate } from '@/lib/client/api';
import { cvErrorMessage } from '@/lib/client/cv-errors';
import { fill } from '@/lib/client/fill';
import { useFocusAfter } from '@/lib/client/focus';
import { useStatus } from '@/lib/client/status';
import type { CvCopy } from '@/lib/server/cv-copy';
import { CvDocuments, docName } from './cv-documents';
import { CvEntries } from './cv-entries';
import { CvSelectionCard } from './cv-selection';
import type { CvDocument, CvEntry, CvInitial, CvOptIn, CvSelectionView, CvShare } from './cv-types';
import { pending } from './cv-types';

/**
 * My CV (docs/design/mmereko-api-proposal.md §9, §10.5, §11). Before the learner's own opt-in,
 * only the opt-in card (§9.2's draft wording). After it: what goes on the CV, their projects and
 * skills, Make my CV and Fit it to a job, the list of CVs with their status words, a preview, and
 * Stop using Mmereko with the download offered first (D15). Sharing is offered only to an adult in
 * their own name (D6). Its words come as props (the launch standard).
 *
 * One status line for the page announces every outcome (WCAG 4.1.3); a press that removes its own
 * control moves focus to where the learner is next (A3-01). While a CV is being made the list is
 * read again every few seconds; the only motion is that line's progress dots, which reduced
 * motion removes, leaving the word.
 */

/**
 * Where an error shows: in the card (or the open form) whose press it answers, beside the control,
 * not at the top of a long page a phone has scrolled away from (WCAG 3.3.1; audit CV-A2, A2-43).
 * `page` is the top, for what belongs to no card.
 */
export type CvErrorAt =
  | 'page'
  | 'opt-in'
  | 'what'
  | 'entries'
  | 'entry-form'
  | 'make'
  | 'preview'
  | 'tailor'
  | 'withdraw'
  // The list of CVs: a delete refused (A11-38).
  | 'list';

/**
 * The fields each form shows, by their paths in what it sends (A2-52): a refusal that names one
 * of these goes on that field (`aria-invalid` and the message under it), not in the card.
 */
const FIELDS: Partial<Record<CvErrorAt, ReadonlyArray<RegExp>>> = {
  'entry-form': [
    /^(title|organisation|role|startDate|endDate|description|highlights|keywords|linkedModules)(\.\d+)?$/,
    /^evidence\.\d+\.(url|label)$/,
  ],
  what: [/^(surname|label|summary|email|phone|city|region)$/],
  tailor: [/^advert\.(title|company|text)$/],
};

/** Whether the form in `at` shows the field a refusal names. */
const onField = (at: CvErrorAt, field: string | null): field is string =>
  field !== null && (FIELDS[at] ?? []).some((path) => path.test(field));

/** What every part of the page shares: its words, the status line, errors, and focus. */
export interface CvKit {
  readonly copy: CvCopy;
  /** The judge demo's stand-in makes the CVs: no AI notes (`CvInitial.standIn`). */
  readonly standIn: boolean;
  say(text: string): void;
  /** Shows the error in `at` (one error on the page at a time, announced as an alert). */
  fail(error: unknown, at?: CvErrorAt): void;
  /** The error showing in `at`, or null; null when it shows on one of the form's fields. */
  errorAt(at: CvErrorAt): string | null;
  /**
   * The error to show on the field at `path` in the form `at` (A2-52): the refusal named it, or
   * an item of it (`keywords` for `keywords.2`). Null otherwise.
   */
  fieldError(at: CvErrorAt, path: string): string | null;
  /** Lets go of the error in `at` (a form closed with Cancel, so it doesn't come back with the next). */
  clear(at: CvErrorAt): void;
  focusAfter(find: () => HTMLElement | null | undefined): void;
  /** Opens a CV's PDF through a fresh 60-second link; a refusal shows in `at`. */
  download(id: string, at?: CvErrorAt): Promise<void>;
}

/** The error a card's press got, in the card (A2-43). */
export function CvError({ kit, at }: { kit: CvKit; at: CvErrorAt }) {
  const error = kit.errorAt(at);
  return error ? <Notice tone="danger">{error}</Notice> : null;
}

export function CvView({
  initial,
  copy,
  pollMs = 5000,
  navigate = (url: string) => window.location.assign(url),
}: {
  initial: CvInitial;
  copy: CvCopy;
  /** How often the list is read while a CV is being made. */
  pollMs?: number;
  /** Where a PDF link goes: the browser's location (a test passes its own). */
  navigate?: (url: string) => void;
}) {
  const [optIn, setOptIn] = useState<CvOptIn | null>(initial.optIn);
  const [entries, setEntries] = useState<ReadonlyArray<CvEntry>>(initial.entries);
  const [view, setView] = useState<CvSelectionView>(initial.view);
  const [documents, setDocuments] = useState<ReadonlyArray<CvDocument>>(initial.documents);
  const [shares, setShares] = useState<ReadonlyArray<CvShare>>(initial.shares);
  const [reported, setReported] = useState<ReadonlyArray<string>>(initial.reported ?? []);
  const [status, setStatus] = useStatus();
  const [error, setError] = useState<{
    readonly text: string;
    readonly at: CvErrorAt;
    /** The refused value's path, when the API named it (A2-52). */
    readonly field: string | null;
  } | null>(null);
  const focusAfter = useFocusAfter();
  const whatId = useId();
  const optInId = useId();

  const kit: CvKit = {
    copy,
    standIn: initial.standIn === true,
    say: (text) => {
      setError(null);
      setStatus(text);
    },
    fail: (e, at = 'page') => {
      setStatus('');
      setError({
        text: cvErrorMessage(e, copy.errors),
        at,
        field: e instanceof ApiError ? e.field : null,
      });
    },
    errorAt: (at) => (error?.at === at && !onField(at, error.field) ? error.text : null),
    fieldError: (at, path) =>
      error?.at === at &&
      onField(at, error.field) &&
      (error.field === path || error.field.startsWith(`${path}.`))
        ? error.text
        : null,
    clear: (at) => setError((e) => (e?.at === at ? null : e)),
    focusAfter,
    download: async (id, at = 'page') => {
      try {
        const { pdf } = await api<{ pdf: { url: string } | null }>(`/api/me/cv/documents/${id}`);
        if (pdf) navigate(pdf.url);
      } catch (e) {
        kit.fail(e, at);
      }
    },
  };

  // While a CV is being made, read the list again; say when one is ready or couldn't be made.
  const waiting = documents.some(pending);
  const latest = useRef(documents);
  latest.current = documents;
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs again on each new list (every read sets one); its words and status line are the page's own.
  useEffect(() => {
    if (!waiting) return;
    const timer = setTimeout(async () => {
      try {
        const next = await api<{ documents: CvDocument[] }>('/api/me/cv/documents');
        const before = new Map(latest.current.map((d) => [d.id, d.status]));
        const done = next.documents.find(
          (d) => !pending(d) && (before.get(d.id) === 'queued' || before.get(d.id) === 'submitted'),
        );
        setDocuments(next.documents);
        if (done) kit.say(done.status === 'ready' ? copy.list.ready : copy.list.failed);
      } catch {
        // Read again on the next round; the page keeps what it showed.
        setDocuments((d) => [...d]);
      }
    }, pollMs);
    return () => clearTimeout(timer);
  }, [documents, waiting, pollMs]);

  return (
    // `uf-cv`: the learner's own long words and links wrap at 320px (A2-46, globals.css).
    <div className="uf-cv flex flex-col gap-6">
      <StatusLine said={status} />
      <CvError kit={kit} at="page" />
      {optIn ? (
        <>
          <OptedIn
            optIn={optIn}
            canShare={initial.canShare}
            kit={kit}
            onChange={(next) => setOptIn(next)}
          />
          <CvSelectionCard headingId={whatId} view={view} kit={kit} onView={setView} />
          <CvEntries
            entries={entries}
            kit={kit}
            onAdded={(entry) => {
              setEntries((list) => [...list, entry]);
              setView((v) => ({
                ...v,
                available: {
                  ...v.available,
                  entries: [
                    ...v.available.entries,
                    { id: entry.id, kind: entry.kind, title: entry.title },
                  ],
                },
              }));
            }}
            onSaved={(entry) => {
              setEntries((list) => list.map((e) => (e.id === entry.id ? entry : e)));
              setView((v) => ({
                ...v,
                available: {
                  ...v.available,
                  entries: v.available.entries.map((e) =>
                    e.id === entry.id ? { ...e, title: entry.title } : e,
                  ),
                },
              }));
            }}
            onRemoved={(id) => {
              setEntries((list) => list.filter((e) => e.id !== id));
              setView((v) => ({
                ...v,
                selection: {
                  ...v.selection,
                  entryIds: v.selection.entryIds.filter((e) => e !== id),
                },
                available: {
                  ...v.available,
                  entries: v.available.entries.filter((e) => e.id !== id),
                },
              }));
            }}
          />
          <MakeCard
            ready={view.ready}
            waiting={waiting}
            kit={kit}
            onQueued={(doc) => setDocuments((list) => [doc, ...list])}
          />
          <CvDocuments
            documents={documents}
            shares={shares}
            sharing={initial.canShare && optIn.purposes.includes('cv.share')}
            reported={reported}
            kit={kit}
            onDocument={(doc) =>
              setDocuments((list) => list.map((d) => (d.id === doc.id ? doc : d)))
            }
            onShares={setShares}
            onReported={(id) => setReported((list) => [...list, id])}
            onRemoved={(id) => {
              setDocuments((list) => list.filter((d) => d.id !== id));
              // Its share links went with it (the database cascades them).
              setShares((list) => list.filter((s) => s.documentId !== id));
            }}
          />
          <TailorCard
            ready={view.ready}
            waiting={waiting}
            kit={kit}
            onQueued={(doc) => setDocuments((list) => [doc, ...list])}
          />
          <WithdrawCard
            documents={documents}
            kit={kit}
            onWithdrawn={() => {
              setOptIn(null);
              setEntries([]);
              setDocuments([]);
              setShares([]);
              setView((v) => ({
                ...v,
                selection: {
                  surname: null,
                  label: null,
                  summary: null,
                  email: null,
                  phone: null,
                  city: null,
                  region: null,
                  includeSchool: false,
                  subjectIds: [],
                  includeOffer: false,
                  moduleCodes: [],
                  entryIds: [],
                },
                available: { ...v.available, entries: [] },
                ready: false,
              }));
              kit.say(copy.withdraw.done);
              focusAfter(() => document.getElementById(optInId));
            }}
          />
        </>
      ) : (
        <OptInCard
          headingId={optInId}
          wordingCovers={initial.wordingCovers}
          canShare={initial.canShare}
          kit={kit}
          onOptedIn={(next) => {
            setOptIn(next);
            focusAfter(() => document.getElementById(whatId));
          }}
        />
      )}
    </div>
  );
}

/** One press at a time: the flag and the busy state for a card's request. */
function useOnce() {
  const inFlight = useRef(false);
  const [busy, setBusy] = useState(false);
  return {
    busy,
    async run(work: () => Promise<void>) {
      if (inFlight.current) return;
      inFlight.current = true;
      setBusy(true);
      try {
        await work();
      } finally {
        inFlight.current = false;
        setBusy(false);
      }
    },
  };
}

/** The opt-in card: §9.2's draft wording, and for an adult in their own name, sharing (unticked). */
function OptInCard({
  headingId,
  wordingCovers,
  canShare,
  kit,
  onOptedIn,
}: {
  headingId: string;
  wordingCovers: boolean;
  canShare: boolean;
  kit: CvKit;
  onOptedIn: (optIn: CvOptIn) => void;
}) {
  const { copy } = kit;
  const [share, setShare] = useState(false);
  const shareId = useId();
  const once = useOnce();
  return (
    <Card aria-labelledby={headingId} className="flex flex-col gap-3">
      <h2 id={headingId} tabIndex={-1} className="text-lg">
        {copy.optIn.title}
      </h2>
      <p>{copy.optIn.body}</p>
      {wordingCovers ? (
        <>
          {canShare ? (
            <div className="flex flex-col gap-1">
              <label htmlFor={shareId} className="flex min-h-11 items-center gap-3">
                <Checkbox
                  id={shareId}
                  checked={share}
                  onChange={(e) => setShare(e.target.checked)}
                  aria-describedby={`${shareId}-hint`}
                />
                {copy.optIn.share}
              </label>
              <p id={`${shareId}-hint`} className="text-sm text-muted">
                {copy.optIn.shareHint}
              </p>
            </div>
          ) : null}
          <div>
            <Button
              aria-disabled={once.busy || undefined}
              onClick={() =>
                once.run(async () => {
                  try {
                    const { optIn } = await api<{ optIn: CvOptIn }>('/api/me/cv/opt-in', {
                      method: 'POST',
                      json: { share },
                    });
                    onOptedIn(optIn);
                  } catch (e) {
                    kit.fail(e, 'opt-in');
                  }
                })
              }
            >
              {copy.optIn.agree}
            </Button>
          </div>
          <CvError kit={kit} at="opt-in" />
        </>
      ) : (
        <Notice tone="info">{copy.errors['cv-consent']}</Notice>
      )}
    </Card>
  );
}

/** After the opt-in: when it was given and, for an adult who didn't add sharing, adding it. */
function OptedIn({
  optIn,
  canShare,
  kit,
  onChange,
}: {
  optIn: CvOptIn;
  canShare: boolean;
  kit: CvKit;
  onChange: (optIn: CvOptIn) => void;
}) {
  const { copy } = kit;
  const once = useOnce();
  return (
    <div className="flex flex-col items-start gap-2">
      <p className="text-muted">{fill(copy.optIn.given, formatDate(optIn.optedInAt))}</p>
      {canShare && !optIn.purposes.includes('cv.share') ? (
        <Button
          variant="secondary"
          aria-disabled={once.busy || undefined}
          onClick={() =>
            once.run(async () => {
              try {
                const { optIn: next } = await api<{ optIn: CvOptIn }>('/api/me/cv/opt-in', {
                  method: 'POST',
                  json: { share: true },
                });
                onChange(next);
                kit.say(copy.optIn.shareAdded);
              } catch (e) {
                kit.fail(e, 'opt-in');
              }
            })
          }
        >
          {copy.optIn.addShare}
        </Button>
      ) : null}
      <CvError kit={kit} at="opt-in" />
    </div>
  );
}

/**
 * A press on Make my CV or Fit my CV that can't go yet says why in the status line, rather than
 * nothing (A2-48): a CV is still being made, or the name or the education is missing. True when
 * it can't go.
 */
function notYet(kit: CvKit, ready: boolean, waiting: boolean): boolean {
  if (waiting) kit.say(kit.copy.make.waiting);
  else if (!ready) kit.say(kit.copy.errors['cv-incomplete']);
  return waiting || !ready;
}

/** "Make my CV": one at a time (§11), and only once a name and some education are ticked. */
function MakeCard({
  ready,
  waiting,
  kit,
  onQueued,
}: {
  ready: boolean;
  waiting: boolean;
  kit: CvKit;
  onQueued: (doc: CvDocument) => void;
}) {
  const { copy } = kit;
  const titleId = useId();
  const once = useOnce();
  const care = useHeldCare();
  return (
    <Card aria-labelledby={titleId} className="flex flex-col gap-3">
      <h2 id={titleId} className="text-lg">
        {copy.make.title}
      </h2>
      <p className="text-muted">{waiting ? copy.make.waiting : copy.make.lead}</p>
      <HeldCare care={care} kit={kit} />
      <div>
        <Button
          // Keeps focus while it can't be pressed (A3-01); the API refuses a second one anyway.
          aria-disabled={once.busy || waiting || !ready || undefined}
          onClick={() => {
            if (notYet(kit, ready, waiting)) return;
            void once.run(async () => {
              try {
                const answer = await api<Sent>('/api/me/cv/drafts', {
                  method: 'POST',
                  ...(care.held ? { json: { sendAnyway: true } } : {}),
                });
                if (care.answered(answer)) {
                  onQueued(answer.document);
                  kit.say(copy.make.started);
                }
              } catch (e) {
                kit.fail(e, 'make');
              }
            });
          }}
        >
          {copy.make.button}
        </Button>
      </div>
      <CvError kit={kit} at="make" />
    </Card>
  );
}

/** What "Make my CV" and "Fit it to a job" answer: the CV queued, or held with the crisis card. */
type Sent =
  | { readonly document: CvDocument; readonly care: WrittenCare | null }
  | { readonly document: null; readonly care: WrittenCare };

/**
 * The crisis card when what would be sent holds words that worry us (A10-55, A10-56): nothing was
 * sent, and the next press of the same button sends it (`sendAnyway`). A concern goes ahead with
 * the card beside it.
 */
function useHeldCare() {
  const [care, setCare] = useState<WrittenCare | null>(null);
  const [held, setHeld] = useState(false);
  return {
    care,
    held,
    seen: () => setCare(null),
    /** Changed words are read again: the next press is a first press. */
    reset: () => setHeld(false),
    /** True when the CV was queued. */
    answered(answer: Sent): answer is Sent & { document: CvDocument } {
      setCare(answer.care && answer.care.level !== 'setback' ? answer.care : null);
      setHeld(answer.document === null);
      return answer.document !== null;
    },
  };
}

function HeldCare({ care, kit }: { care: ReturnType<typeof useHeldCare>; kit: CvKit }) {
  if (!care.care && !care.held) return null;
  return (
    <div className="flex flex-col gap-3">
      {care.care ? (
        <WrittenCarePanel care={care.care} words={kit.copy.care} onSeen={care.seen} />
      ) : null}
      {care.held ? <p className="font-medium">{kit.copy.make.held}</p> : null}
    </div>
  );
}

/** "Fit it to a job": a pasted advert makes a tailored CV (D4); the advert isn't kept (D13). */
function TailorCard({
  ready,
  waiting,
  kit,
  onQueued,
}: {
  ready: boolean;
  waiting: boolean;
  kit: CvKit;
  onQueued: (doc: CvDocument) => void;
}) {
  const { copy } = kit;
  const titleId = useId();
  const noteId = useId();
  const [title, setTitle] = useState('');
  const [company, setCompany] = useState('');
  const [text, setText] = useState('');
  const once = useOnce();
  const care = useHeldCare();
  return (
    <Card aria-labelledby={titleId} className="flex flex-col gap-3">
      <h2 id={titleId} className="text-lg">
        {copy.tailor.title}
      </h2>
      <p className="text-muted">{copy.tailor.lead}</p>
      {/* Before the advert goes: a fitted CV is written by the AI abroad (A11-37). Not on the
          judge demo, whose stand-in uses no AI (its notice on the page says so). */}
      {kit.standIn ? null : <p id={noteId}>{copy.tailor.aiNote}</p>}
      <HeldCare care={care} kit={kit} />
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (notYet(kit, ready, waiting)) return;
          void once.run(async () => {
            try {
              const answer = await api<Sent>('/api/me/cv/tailorings', {
                method: 'POST',
                json: {
                  advert: { title: title.trim(), company: company.trim() || null, text },
                  ...(care.held ? { sendAnyway: true } : {}),
                },
              });
              if (care.answered(answer)) {
                onQueued(answer.document);
                setText('');
                kit.say(copy.tailor.started);
              }
            } catch (e) {
              kit.fail(e, 'tailor');
            }
          });
        }}
      >
        <Field label={copy.tailor.jobTitle} error={kit.fieldError('tailor', 'advert.title')}>
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              aria-describedby={describedBy}
              aria-invalid={invalid}
              required
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                care.reset();
              }}
            />
          )}
        </Field>
        <Field label={copy.tailor.company} error={kit.fieldError('tailor', 'advert.company')}>
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              aria-describedby={describedBy}
              aria-invalid={invalid}
              value={company}
              onChange={(e) => {
                setCompany(e.target.value);
                care.reset();
              }}
            />
          )}
        </Field>
        <Field label={copy.tailor.advert} error={kit.fieldError('tailor', 'advert.text')}>
          {({ id, describedBy, invalid }) => (
            <TextArea
              id={id}
              aria-describedby={describedBy}
              aria-invalid={invalid}
              required
              rows={8}
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                care.reset();
              }}
            />
          )}
        </Field>
        <CvError kit={kit} at="tailor" />
        <div>
          <Button
            type="submit"
            aria-describedby={kit.standIn ? undefined : noteId}
            aria-disabled={once.busy || waiting || !ready || undefined}
          >
            {copy.tailor.button}
          </Button>
        </div>
      </form>
    </Card>
  );
}

/** "Stop using Mmereko" (§9.2, D15): the CVs to download first, then one DELETE. */
function WithdrawCard({
  documents,
  kit,
  onWithdrawn,
}: {
  documents: ReadonlyArray<CvDocument>;
  kit: CvKit;
  onWithdrawn: () => void;
}) {
  const { copy } = kit;
  const titleId = useId();
  const listId = useId();
  const [asking, setAsking] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const start = useRef<HTMLButtonElement>(null);
  const once = useOnce();
  const ready = documents.filter((d) => d.status === 'ready' && d.hasPdf);
  useEffect(() => {
    if (asking) panel.current?.focus();
  }, [asking]);
  return (
    <Card aria-labelledby={titleId} className="flex flex-col gap-3">
      <h2 id={titleId} className="text-lg">
        {copy.withdraw.title}
      </h2>
      {asking ? (
        <div ref={panel} tabIndex={-1} className="flex flex-col gap-3">
          <p>{copy.withdraw.body}</p>
          {ready.length > 0 ? (
            <>
              <p id={listId} className="font-medium">
                {copy.withdraw.downloadFirst}
              </p>
              <ul aria-labelledby={listId} className="flex flex-col gap-2">
                {ready.map((d) => (
                  <li key={d.id} className="flex flex-wrap items-center gap-3">
                    <span>
                      {docName(copy, d)} · {formatDate(d.createdAt)}
                    </span>
                    <Button
                      variant="secondary"
                      aria-label={`${copy.preview.download}: ${docName(copy, d)}, ${formatDate(d.createdAt)}`}
                      onClick={() => void kit.download(d.id, 'withdraw')}
                    >
                      {copy.preview.download}
                    </Button>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="danger"
              aria-disabled={once.busy || undefined}
              onClick={() =>
                once.run(async () => {
                  try {
                    await api('/api/me/cv/opt-in', { method: 'DELETE' });
                    onWithdrawn();
                  } catch (e) {
                    kit.fail(e, 'withdraw');
                  }
                })
              }
            >
              {copy.withdraw.confirm}
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setAsking(false);
                kit.focusAfter(() => start.current);
              }}
            >
              {copy.withdraw.keep}
            </Button>
          </div>
          <CvError kit={kit} at="withdraw" />
        </div>
      ) : (
        <div>
          <Button ref={start} variant="secondary" onClick={() => setAsking(true)}>
            {copy.withdraw.start}
          </Button>
        </div>
      )}
    </Card>
  );
}
