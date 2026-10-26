'use client';

import { useId, useRef, useState } from 'react';
import { Button, Card, Field, Input, panelLook, Select } from '@/components/ui';
import { api, formatDate } from '@/lib/client/api';
import { fill } from '@/lib/client/fill';
import type { CvCopy } from '@/lib/server/cv-copy';
import { CvReport } from './cv-report';
import { CvText } from './cv-text';
import { type CvDocument, type CvShare, pending } from './cv-types';
import { CvError, type CvKit } from './cv-view';

/**
 * The learner's CVs (§10.5): each with its status word ("Being made", "Ready", "Couldn't be
 * made, try again"), never colour alone. A ready CV opens a preview: its text, then Download PDF
 * (a fresh 60-second link each time), what could make it stronger, a fitted CV's ATS score as a
 * bar with the number and its missing keywords as lists, and "Check every line is true". An adult
 * who added sharing can make a recruiter link to a checked CV (§9.3, D6): shown once, to copy.
 *
 * Wave 5: a fitted CV can be reported (A10-58); any CV not being made can be deleted, asked on the
 * page first (A11-38); the preview shows the CV's text as headings, lists and paragraphs (A2-47).
 */

/** A CV's name in the list: "My CV", or what it was fitted to. */
export function docName(copy: CvCopy, d: CvDocument): string {
  if (d.kind === 'draft' || !d.advertTitle) return copy.list.draft;
  return d.advertCompany
    ? fill(copy.list.tailoredAt, d.advertTitle, d.advertCompany)
    : fill(copy.list.tailored, d.advertTitle);
}

const openId = (id: string) => `cv-open-${id}`;
const removeId = (id: string) => `cv-remove-${id}`;
const askId = (id: string) => `cv-remove-ask-${id}`;
/** One preview at a time: focus goes to its title when it opens. */
const PREVIEW_ID = 'cv-preview';
const CONFIRMED_ID = 'cv-confirmed';

export function CvDocuments({
  documents,
  shares,
  sharing,
  reported,
  kit,
  onDocument,
  onShares,
  onReported,
  onRemoved,
}: {
  documents: ReadonlyArray<CvDocument>;
  shares: ReadonlyArray<CvShare>;
  /** An adult in their own name who added sharing to their opt-in. */
  sharing: boolean;
  /** The ids of the CVs the learner reported (A10-58). */
  reported: ReadonlyArray<string>;
  kit: CvKit;
  onDocument: (doc: CvDocument) => void;
  onShares: (shares: ReadonlyArray<CvShare>) => void;
  onReported: (id: string) => void;
  /** A CV deleted (A11-38): gone from the list. */
  onRemoved: (id: string) => void;
}) {
  const { copy } = kit;
  const titleId = useId();
  const [open, setOpen] = useState<string | null>(null);
  const [asking, setAsking] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const shown = documents.find((d) => d.id === open && d.status === 'ready') ?? null;

  /** Deletes one CV once the learner said yes on the page, never by `window.confirm`. */
  async function remove(d: CvDocument, name: string) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    try {
      await api(`/api/me/cv/documents/${d.id}`, { method: 'DELETE' });
      setAsking(null);
      if (open === d.id) setOpen(null);
      onRemoved(d.id);
      kit.say(fill(copy.remove.done, name));
      // Its row goes, buttons and all: focus to the list's heading (A2-44's pattern).
      kit.focusAfter(() => document.getElementById(titleId));
    } catch (e) {
      kit.fail(e, 'list');
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <>
      <Card aria-labelledby={titleId} className="flex flex-col gap-3">
        <h2 id={titleId} tabIndex={-1} className="text-lg">
          {copy.list.title}
        </h2>
        {documents.length === 0 ? (
          <p className="text-muted">{copy.list.empty}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {documents.map((d) => {
              const name = docName(copy, d);
              const date = formatDate(d.createdAt);
              return (
                <li
                  key={d.id}
                  className={`${panelLook} flex flex-wrap items-center justify-between gap-3 p-3`}
                >
                  <div className="flex min-w-0 flex-col">
                    <p className="font-bold">{name}</p>
                    <p className="text-sm text-muted">{fill(copy.list.made, date)}</p>
                    <p className="uf-cv-status text-sm font-medium">
                      {copy.status[d.status]}
                      {pending(d) ? (
                        <span className="uf-cv-progress" aria-hidden="true">
                          <span />
                          <span />
                          <span />
                        </span>
                      ) : null}
                    </p>
                  </div>
                  {d.status === 'ready' ? (
                    <Button
                      id={openId(d.id)}
                      variant="secondary"
                      aria-label={fill(copy.list.openName, name, date)}
                      onClick={() => {
                        setOpen(d.id);
                        kit.focusAfter(() =>
                          document.querySelector<HTMLElement>(`#${PREVIEW_ID} h2`),
                        );
                      }}
                    >
                      {copy.list.open}
                    </Button>
                  ) : null}
                  {pending(d) ? null : asking === d.id ? (
                    // The question in place of Delete (A11-38): read out first, then Yes or Keep it.
                    <div className="flex w-full flex-col gap-2">
                      <p id={askId(d.id)} tabIndex={-1}>
                        {fill(copy.remove.ask, name)}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="danger"
                          aria-disabled={busy || undefined}
                          onClick={() => void remove(d, name)}
                        >
                          {copy.remove.yes}
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={() => {
                            setAsking(null);
                            kit.focusAfter(() => document.getElementById(removeId(d.id)));
                          }}
                        >
                          {copy.remove.keep}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      id={removeId(d.id)}
                      variant="secondary"
                      aria-label={fill(copy.remove.name, name, date)}
                      onClick={() => {
                        kit.clear('list');
                        setAsking(d.id);
                        kit.focusAfter(() => document.getElementById(askId(d.id)));
                      }}
                    >
                      {copy.remove.button}
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <CvError kit={kit} at="list" />
      </Card>
      {shown ? (
        <Preview
          doc={shown}
          shares={shares}
          sharing={sharing}
          reported={reported.includes(shown.id)}
          kit={kit}
          onDocument={onDocument}
          onShares={onShares}
          onReported={onReported}
          onClose={() => {
            setOpen(null);
            kit.focusAfter(() => document.getElementById(openId(shown.id)));
          }}
        />
      ) : null}
    </>
  );
}

function Preview({
  doc,
  shares,
  sharing,
  reported,
  kit,
  onDocument,
  onShares,
  onReported,
  onClose,
}: {
  doc: CvDocument;
  shares: ReadonlyArray<CvShare>;
  sharing: boolean;
  reported: boolean;
  kit: CvKit;
  onDocument: (doc: CvDocument) => void;
  onShares: (shares: ReadonlyArray<CvShare>) => void;
  onReported: (id: string) => void;
  onClose: () => void;
}) {
  const { copy } = kit;
  const p = copy.preview;
  const titleId = useId();
  const hintId = useId();
  const gapsId = useId();
  const missingId = useId();
  const mustId = useId();
  const checkId = useId();
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const ats = doc.kind === 'tailored' && doc.atsCoverage !== null ? doc.atsCoverage : null;

  async function confirm() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    try {
      const { document: checked } = await api<{ document: CvDocument }>(
        `/api/me/cv/documents/${doc.id}/confirm`,
        { method: 'POST' },
      );
      onDocument(checked);
      // The button goes: focus moves to the line that replaces it, which is read out.
      kit.focusAfter(() => document.getElementById(CONFIRMED_ID));
    } catch (e) {
      kit.fail(e, 'preview');
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <Card id={PREVIEW_ID} aria-labelledby={titleId} className="flex flex-col gap-4">
      {/* Focus comes here when the preview opens. */}
      <h2 id={titleId} tabIndex={-1} className="text-lg">
        {fill(p.title, docName(copy, doc))}
      </h2>
      {/* An AI wrote a fitted CV: it is the learner's draft to check (A10-57). */}
      {/* Not on the judge demo, whose stand-in uses no AI (its notice on the page says so). */}
      {doc.kind === 'tailored' && !kit.standIn ? (
        <p className="text-muted">{p.tailoredNote}</p>
      ) : null}
      {/* The CV's text as headings, lists and paragraphs, never its Markdown marks (A2-47). */}
      <CvText markdown={doc.markdown} />
      {/* An AI wrote it: the learner can report it for a person to look at (A10-58, §11). */}
      {doc.kind === 'tailored' ? (
        <CvReport documentId={doc.id} reported={reported} kit={kit} onReported={onReported} />
      ) : null}
      {doc.hasPdf ? (
        <div className="flex flex-col items-start gap-1">
          <Button aria-describedby={hintId} onClick={() => void kit.download(doc.id, 'preview')}>
            {p.download}
          </Button>
          <p id={hintId} className="text-sm text-muted">
            {p.downloadHint}
          </p>
        </div>
      ) : null}

      {doc.gaps.length > 0 ? (
        <section aria-labelledby={gapsId} className="flex flex-col gap-2">
          <h3 id={gapsId} className="font-bold">
            {p.gaps}
          </h3>
          <ul className="list-disc pl-5">
            {doc.gaps.map((gap) => (
              <li key={gap}>{gap}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {ats !== null ? (
        <div className="flex flex-col gap-2">
          <h3 className="font-bold">{copy.tailor.score}</h3>
          {/* The bar is drawn; the number is in words beside it (never colour alone). */}
          <meter
            aria-label={copy.tailor.score}
            aria-valuetext={fill(copy.tailor.scoreValue, ats)}
            min={0}
            max={100}
            value={ats}
            className="uf-cv-meter"
          />
          <p className="font-medium">{fill(copy.tailor.scoreValue, ats)}</p>
          {doc.atsMissingMust.length > 0 ? (
            <>
              <p id={mustId} className="font-medium">
                {copy.tailor.missingMust}
              </p>
              <ul aria-labelledby={mustId} className="list-disc pl-5">
                {doc.atsMissingMust.map((k) => (
                  <li key={k}>{k}</li>
                ))}
              </ul>
            </>
          ) : null}
          {doc.atsMissing.length > 0 ? (
            <>
              <p id={missingId} className="font-medium">
                {copy.tailor.missing}
              </p>
              <ul aria-labelledby={missingId} className="list-disc pl-5">
                {doc.atsMissing.map((k) => (
                  <li key={k}>{k}</li>
                ))}
              </ul>
            </>
          ) : (
            <p>{copy.tailor.noneMissing}</p>
          )}
        </div>
      ) : null}

      <section className="flex flex-col gap-2" aria-labelledby={checkId}>
        <h3 id={checkId} className="font-bold">
          {p.check}
        </h3>
        {doc.confirmedAt ? (
          <p id={CONFIRMED_ID} tabIndex={-1}>
            {fill(p.confirmed, formatDate(doc.confirmedAt))}
          </p>
        ) : (
          <>
            <p className="text-muted">{p.checkLead}</p>
            <div>
              <Button
                variant="secondary"
                aria-disabled={busy || undefined}
                onClick={() => void confirm()}
              >
                {p.confirm}
              </Button>
            </div>
          </>
        )}
      </section>

      {sharing ? (
        <Sharing
          doc={doc}
          shares={shares.filter((s) => s.documentId === doc.id)}
          all={shares}
          kit={kit}
          onShares={onShares}
        />
      ) : null}

      <CvError kit={kit} at="preview" />
      <div>
        <Button variant="secondary" onClick={onClose}>
          {p.close}
        </Button>
      </div>
    </Card>
  );
}

/** "Share with a recruiter" (§9.3): a link for 7 to 90 days, shown once, switched off at will. */
function Sharing({
  doc,
  shares,
  all,
  kit,
  onShares,
}: {
  doc: CvDocument;
  shares: ReadonlyArray<CvShare>;
  all: ReadonlyArray<CvShare>;
  kit: CvKit;
  onShares: (shares: ReadonlyArray<CvShare>) => void;
}) {
  const { copy } = kit;
  const s = copy.sharing;
  const titleId = useId();
  const [days, setDays] = useState(copy.shareDefault);
  const [made, setMade] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const linkRef = useRef<HTMLInputElement>(null);
  const now = Date.now();
  const live = shares.filter((x) => !x.revokedAt && Date.parse(x.expiresAt) > now);

  async function create() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    try {
      const { share, url } = await api<{ share: CvShare; url: string }>('/api/me/cv/shares', {
        method: 'POST',
        json: { documentId: doc.id, days },
      });
      onShares([share, ...all]);
      setMade(url);
      kit.say(s.made);
      kit.focusAfter(() => linkRef.current);
    } catch (e) {
      kit.fail(e, 'preview');
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  async function off(share: CvShare) {
    try {
      await api('/api/me/cv/shares', { method: 'DELETE', json: { id: share.id } });
      onShares(all.filter((x) => x.id !== share.id));
      kit.say(s.switchedOff);
      // Its button goes with it: focus to the section's heading (A2-44).
      kit.focusAfter(() => document.getElementById(titleId));
    } catch (e) {
      kit.fail(e, 'preview');
    }
  }

  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-3">
      <h3 id={titleId} tabIndex={-1} className="font-bold">
        {s.title}
      </h3>
      <p className="text-muted">{s.lead}</p>
      {doc.confirmedAt ? (
        <div className="flex flex-col gap-3">
          <Field label={s.days}>
            {({ id }) => (
              <Select id={id} value={days} onChange={(e) => setDays(Number(e.target.value))}>
                {copy.shareDays.map((n) => (
                  <option key={n} value={n}>
                    {fill(s.daysOption, n)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <div>
            <Button aria-disabled={busy || undefined} onClick={() => void create()}>
              {s.create}
            </Button>
          </div>
        </div>
      ) : (
        <p>{copy.errors['cv-share-unchecked']}</p>
      )}
      {made ? (
        <div className="flex flex-col gap-2">
          <Field label={s.link} hint={s.linkOnce}>
            {({ id, describedBy }) => (
              <Input
                id={id}
                ref={linkRef}
                readOnly
                aria-describedby={describedBy}
                value={made}
                onFocus={(e) => e.currentTarget.select()}
              />
            )}
          </Field>
          <div>
            <Button
              variant="secondary"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(made);
                  kit.say(s.copied);
                } catch {
                  // No clipboard here: the link is selected, to copy by hand.
                  linkRef.current?.select();
                }
              }}
            >
              {s.copy}
            </Button>
          </div>
        </div>
      ) : null}
      {live.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {live.map((x) => {
            const until = formatDate(x.expiresAt);
            return (
              <li key={x.id} className="flex flex-wrap items-center gap-3">
                <span>{fill(s.active, until, x.viewCount)}</span>
                <Button
                  variant="secondary"
                  aria-label={fill(s.offName, until)}
                  onClick={() => void off(x)}
                >
                  {s.off}
                </Button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
