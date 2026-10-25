'use client';

import type { OfferCardArtifact } from '@universityflow/agent';
import { common, offers } from '@universityflow/content';
import type { LetterDraft } from '@universityflow/documents';
import { type FormEvent, type Ref, useRef, useState } from 'react';
import { CourseOptions, CourseSearch, useCourseSearch } from '@/components/course-search';
import { OfferCard } from '@/components/offers';
import {
  Button,
  Card,
  EmptyState,
  Field,
  FileButton,
  Input,
  Notice,
  Page,
  Select,
  StatusLine,
  TextArea,
} from '@/components/ui';
import { ApiError, api, errorMessage } from '@/lib/client/api';
import { useFocusAfter } from '@/lib/client/focus';
import { useStatus } from '@/lib/client/status';
import type { OffersResponse } from '@/lib/server/offers';

type Kind = OfferCardArtifact['offerKind'];
const KINDS: ReadonlyArray<Kind> = ['provisional', 'conditional', 'final', 'waitlist'];

type LetterResult = {
  documentId: string;
  letter: LetterDraft | null;
  candidates: string[];
  sample: boolean;
};

const LETTER = 'acceptance-letter';

/** Straight to storage (S3): a ticket, the file to storage, then the server checks and reads it. */
async function uploadDirect(file: File): Promise<LetterResult> {
  const ticket = await api<{ uploadId: string; url: string; fields: Record<string, string> }>(
    '/api/documents/uploads',
    { method: 'POST', json: { contentType: file.type, size: file.size } },
  );
  const form = new FormData();
  for (const [name, value] of Object.entries(ticket.fields)) form.append(name, value);
  form.append('file', file);
  const sent = await fetch(ticket.url, { method: 'POST', body: form }).catch(() => null);
  if (!sent?.ok) throw new ApiError(sent?.status ?? 0, 'upload', 'not-received');
  return api<LetterResult>(`/api/documents/uploads/${ticket.uploadId}?kind=${LETTER}`, {
    method: 'POST',
  });
}

/** Through our own server (local development). */
async function uploadThroughServer(file: File): Promise<LetterResult> {
  const form = new FormData();
  form.append('kind', LETTER);
  form.append('file', file);
  return api<LetterResult>('/api/documents', { method: 'POST', body: form });
}

function KindSelect({
  id,
  describedBy,
  invalid,
  selectRef,
  value,
  onChange,
}: {
  id: string;
  describedBy: string | undefined;
  invalid: true | undefined;
  selectRef: Ref<HTMLSelectElement>;
  value: Kind | '';
  onChange: (kind: Kind | '') => void;
}) {
  return (
    <Select
      id={id}
      ref={selectRef}
      aria-describedby={describedBy}
      aria-invalid={invalid}
      value={value}
      onChange={(e) => onChange(e.target.value as Kind | '')}
    >
      <option value="">{common.chooseOne}</option>
      {KINDS.map((k) => (
        <option key={k} value={k}>
          {offers.kinds[k]}
        </option>
      ))}
    </Select>
  );
}

/**
 * The course and the kind must both be chosen before an offer is saved. Pressing Save without
 * them says which is missing on the field itself and moves focus there (A3-18), rather than
 * doing nothing.
 */
function useRequired() {
  const t = offers;
  const [courseError, setCourseError] = useState<string | null>(null);
  const [kindError, setKindError] = useState<string | null>(null);
  const courseRef = useRef<HTMLSelectElement>(null);
  const kindRef = useRef<HTMLSelectElement>(null);
  /** True when both are chosen; otherwise marks what's missing and focuses the first of it. */
  const check = (programmeId: string, kind: Kind | '') => {
    setCourseError(programmeId === '' ? t.missingCourse : null);
    setKindError(kind === '' ? t.missingKind : null);
    if (programmeId === '') courseRef.current?.focus();
    else if (kind === '') kindRef.current?.focus();
    return programmeId !== '' && kind !== '';
  };
  return {
    courseError,
    kindError,
    courseRef,
    kindRef,
    check,
    clearCourse: () => setCourseError(null),
    clearKind: () => setKindError(null),
  };
}

/**
 * My offers: every offer as a card (accept one, decline, remove), "I got an offer" in the learner's
 * own words, or a letter read into a draft they check field by field (hard rule 6).
 *
 * Focus never falls to `<body>` (WCAG 2.4.3, A3-11, A3-13): after Accept or Decline it moves to
 * that offer's heading, after a save to the new offer's, after Remove to the status line, and
 * when the letter's check form opens or closes, to the page heading. The status line stays
 * mounted across both views, so what it says is announced (A3-04).
 */
export function OffersView({ initial, direct }: { initial: OffersResponse; direct: boolean }) {
  const [data, setData] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useStatus();
  const [busy, setBusy] = useState(false);
  const [letter, setLetter] = useState<LetterResult | null>(null);
  const [programmeId, setProgrammeId] = useState('');
  const [kind, setKind] = useState<Kind | ''>('');
  const [replyBy, setReplyBy] = useState('');
  const required = useRequired();
  const search = useCourseSearch(data.options, (o) => o.id === programmeId);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const statusRef = useRef<HTMLParagraphElement>(null);
  /** Each offer card's heading, by offer id: where focus goes after acting on it. */
  const headings = useRef(new Map<string, HTMLHeadingElement>());
  const focusAfter = useFocusAfter();
  const t = offers;

  /** One request at a time: a press while one runs does nothing (A3-01). */
  const inFlight = useRef(false);
  async function run<T>(call: () => Promise<T>, apply: (value: T) => void, done: string | null) {
    if (inFlight.current) return false;
    inFlight.current = true;
    setError(null);
    setStatus('');
    setBusy(true);
    try {
      apply(await call());
      setStatus(done ?? '');
      return true;
    } catch (e) {
      setError(errorMessage(e));
      return false;
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  const save = (offer: {
    programmeId: string;
    kind: Kind;
    replyBy: string | null;
    conditions: string[];
    documentId?: string;
  }) => {
    const before = new Set(data.offers.map((o) => o.id));
    return run(
      () => api<OffersResponse>('/api/offers', { method: 'POST', json: offer }),
      (next) => {
        setData(next);
        setLetter(null);
        setProgrammeId('');
        setKind('');
        setReplyBy('');
        const added = next.offers.find((o) => !before.has(o.id));
        focusAfter(() => (added && headings.current.get(added.id)) ?? statusRef.current);
      },
      t.added,
    );
  };

  const act = (id: string, action: 'accept' | 'decline') =>
    run(
      () => api<OffersResponse>(`/api/offers/${id}`, { method: 'PATCH', json: { action } }),
      (next) => {
        setData(next);
        // The button pressed is gone now: focus goes to the offer it changed.
        focusAfter(() => headings.current.get(id) ?? statusRef.current);
      },
      action === 'accept' ? t.acceptedSaved : t.declinedSaved,
    );

  const removeOffer = (id: string) =>
    run(
      () => api<OffersResponse>(`/api/offers/${id}`, { method: 'DELETE' }),
      (next) => {
        setData(next);
        // The whole card is gone: the status line says so, and takes focus.
        focusAfter(() => statusRef.current);
      },
      t.removed,
    );

  async function upload(file: File) {
    await run(
      () => (direct ? uploadDirect(file) : uploadThroughServer(file)),
      (result) => {
        if (!result.letter) {
          setError(t.unreadable);
          return;
        }
        setLetter(result);
        focusAfter(() => titleRef.current);
      },
      null,
    );
  }

  const checking = letter?.letter ? { ...letter, letter: letter.letter } : null;
  const accepted = data.offers.some((o) => o.status === 'accepted');

  return (
    <Page
      title={checking ? t.letterTitle : t.title}
      lead={checking ? t.letterLead : t.lead}
      headingRef={titleRef}
    >
      {!checking && error ? <Notice tone="danger">{error}</Notice> : null}
      <StatusLine said={status} ref={statusRef} tabIndex={-1} />

      {checking ? (
        <LetterConfirm
          key={checking.documentId}
          result={checking}
          options={data.options}
          busy={busy}
          error={error}
          onConfirm={(offer) => void save({ ...offer, documentId: checking.documentId })}
          onCancel={() => {
            setLetter(null);
            setError(null);
            focusAfter(() => titleRef.current);
          }}
        />
      ) : (
        <>
          {data.offers.length === 0 ? (
            <EmptyState>{t.empty}</EmptyState>
          ) : (
            <div className="flex flex-col gap-6">
              {data.offers.map((offer) => {
                const name = offer.programme?.name ?? offer.universityName;
                return (
                  <OfferCard
                    key={offer.id}
                    artifact={offer}
                    remindersOn={data.remindersOn}
                    headingRef={(el: HTMLHeadingElement | null) => {
                      if (el) headings.current.set(offer.id, el);
                      else headings.current.delete(offer.id);
                    }}
                  >
                    <div className="flex flex-col gap-2">
                      {offer.status !== 'accepted' && !accepted ? (
                        <p className="text-sm text-muted">{t.acceptHint}</p>
                      ) : null}
                      <div className="flex flex-wrap gap-3">
                        {offer.status !== 'accepted' ? (
                          <Button
                            aria-label={`${t.accept}: ${name}`}
                            aria-disabled={busy}
                            onClick={() => {
                              if (!busy) void act(offer.id, 'accept');
                            }}
                          >
                            {t.accept}
                          </Button>
                        ) : null}
                        {offer.status !== 'declined' ? (
                          <Button
                            variant="secondary"
                            aria-label={`${t.decline}: ${name}`}
                            aria-disabled={busy}
                            onClick={() => {
                              if (!busy) void act(offer.id, 'decline');
                            }}
                          >
                            {t.decline}
                          </Button>
                        ) : null}
                        <Button
                          variant="quiet"
                          aria-label={`${t.remove}: ${name}`}
                          aria-disabled={busy}
                          onClick={() => {
                            if (!busy) void removeOffer(offer.id);
                          }}
                        >
                          {t.remove}
                        </Button>
                      </div>
                    </div>
                  </OfferCard>
                );
              })}
            </div>
          )}

          <Card className="flex flex-col gap-3">
            <h2 className="text-lg">{t.addTitle}</h2>
            <p className="text-muted">{t.addLead}</p>
            <form
              className="flex flex-col gap-3"
              noValidate
              onSubmit={(e: FormEvent) => {
                e.preventDefault();
                if (busy || !required.check(programmeId, kind) || kind === '') return;
                void save({ programmeId, kind, replyBy: replyBy || null, conditions: [] });
              }}
            >
              <Field label={t.course} error={required.courseError}>
                {({ id, describedBy, invalid }) => (
                  <>
                    <CourseSearch search={search} total={data.options.length} />
                    <Select
                      id={id}
                      ref={required.courseRef}
                      aria-describedby={describedBy}
                      aria-invalid={invalid}
                      value={programmeId}
                      onChange={(e) => {
                        setProgrammeId(e.target.value);
                        required.clearCourse();
                      }}
                    >
                      <CourseOptions courses={search.shown} />
                    </Select>
                  </>
                )}
              </Field>
              <Field label={t.kind} hint={t.kindHint} error={required.kindError}>
                {({ id, describedBy, invalid }) => (
                  <KindSelect
                    id={id}
                    describedBy={describedBy}
                    invalid={invalid}
                    selectRef={required.kindRef}
                    value={kind}
                    onChange={(k) => {
                      setKind(k);
                      required.clearKind();
                    }}
                  />
                )}
              </Field>
              <Field label={t.replyByLabel} hint={t.replyByHint}>
                {({ id, describedBy }) => (
                  <Input
                    id={id}
                    type="date"
                    aria-describedby={describedBy}
                    value={replyBy}
                    onChange={(e) => setReplyBy(e.target.value)}
                  />
                )}
              </Field>
              <div>
                <Button type="submit" aria-disabled={busy}>
                  {busy ? common.saving : t.save}
                </Button>
              </div>
            </form>
          </Card>

          <Card className="flex flex-col gap-3">
            <h2 className="text-lg">{t.uploadTitle}</h2>
            <p>{t.uploadLead}</p>
            {/* Never `disabled` while reading: that drops focus to <body> (A3-13). The
                request guard ignores a second file instead. */}
            <FileButton
              className="self-start"
              label={busy ? t.reading : t.chooseLetter}
              accept="image/jpeg,image/png,image/webp,application/pdf"
              capture="environment"
              aria-disabled={busy}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file && !busy) void upload(file);
                e.target.value = '';
              }}
            />
          </Card>
        </>
      )}
    </Page>
  );
}

interface ConditionRow {
  key: number;
  text: string;
}

/**
 * Hard rule 6 for a letter: the course (from a short list matched by code, or the full list), the
 * kind, the date to reply by and each condition are shown back and confirmed before anything is
 * saved. The learner can fix, add or remove any of them. Removing a condition moves focus to the
 * next one, the one before, or "Add a condition" (A3-17).
 */
function LetterConfirm(props: {
  result: LetterResult & { letter: LetterDraft };
  options: OffersResponse['options'];
  busy: boolean;
  error: string | null;
  onConfirm: (offer: {
    programmeId: string;
    kind: Kind;
    replyBy: string | null;
    conditions: string[];
  }) => void;
  onCancel: () => void;
}) {
  const { letter, candidates } = props.result;
  const t = offers;
  // The matched courses are a short list offered first, never a choice made for the learner
  // (A1-29): the field opens on "Choose one" until they pick.
  const [programmeId, setProgrammeId] = useState('');
  const [kind, setKind] = useState<Kind | ''>(letter.kind ?? '');
  const [replyBy, setReplyBy] = useState(letter.replyBy ?? '');
  const [rows, setRows] = useState<ConditionRow[]>(() =>
    letter.conditions.map((text, key) => ({ key, text })),
  );
  const required = useRequired();
  // The courses the letter matched stay at the top whatever is typed; the search narrows the rest.
  const matched = candidates.flatMap((cid) => props.options.filter((o) => o.id === cid));
  const search = useCourseSearch(props.options, (o) => o.id === programmeId);
  const listRef = useRef<HTMLFieldSetElement>(null);
  const addRef = useRef<HTMLButtonElement>(null);
  const focusAfter = useFocusAfter();
  const inRow = (key: number, selector: string) =>
    listRef.current?.querySelector<HTMLElement>(`[data-row="${key}"] ${selector}`);

  const removeRow = (index: number) => {
    const next = rows[index + 1];
    const previous = rows[index - 1];
    const gone = rows[index]?.key;
    setRows((list) => list.filter((r) => r.key !== gone));
    focusAfter(() =>
      next
        ? inRow(next.key, 'textarea')
        : previous
          ? inRow(previous.key, '[data-remove]')
          : addRef.current,
    );
  };

  return (
    <form
      className="flex flex-col gap-5"
      noValidate
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        if (props.busy || !required.check(programmeId, kind) || kind === '') return;
        props.onConfirm({
          programmeId,
          kind,
          replyBy: replyBy || null,
          conditions: rows.map((r) => r.text.trim()).filter((c) => c !== ''),
        });
      }}
    >
      {props.result.sample ? <Notice tone="warning">{t.sampleLead}</Notice> : null}
      {letter.warnings.map((w) => (
        <Notice key={w} tone="warning">
          {t.letterWarnings[w]}
        </Notice>
      ))}
      {props.error ? <Notice tone="danger">{props.error}</Notice> : null}
      {letter.programmeAsPrinted ? (
        <p className="text-sm text-muted">{t.asPrinted(letter.programmeAsPrinted)}</p>
      ) : null}
      <Field
        label={t.whichCourse}
        hint={candidates.length === 0 ? t.noCandidates : undefined}
        error={required.courseError}
      >
        {({ id, describedBy, invalid }) => (
          <>
            <CourseSearch search={search} total={props.options.length} />
            <Select
              id={id}
              ref={required.courseRef}
              aria-describedby={describedBy}
              aria-invalid={invalid}
              value={programmeId}
              onChange={(e) => {
                setProgrammeId(e.target.value);
                required.clearCourse();
              }}
            >
              <CourseOptions courses={search.shown} first={matched} firstLabel={t.whichCourse} />
            </Select>
          </>
        )}
      </Field>
      <Field label={t.kind} hint={t.kindHint} error={required.kindError}>
        {({ id, describedBy, invalid }) => (
          <KindSelect
            id={id}
            describedBy={describedBy}
            invalid={invalid}
            selectRef={required.kindRef}
            value={kind}
            onChange={(k) => {
              setKind(k);
              required.clearKind();
            }}
          />
        )}
      </Field>
      <Field label={t.replyByLabel} hint={t.replyByHint}>
        {({ id, describedBy }) => (
          <Input
            id={id}
            type="date"
            aria-describedby={describedBy}
            value={replyBy}
            onChange={(e) => setReplyBy(e.target.value)}
          />
        )}
      </Field>
      <fieldset className="flex flex-col gap-3" ref={listRef}>
        <legend className="mb-2 font-medium">{t.conditionsTitle}</legend>
        {rows.map((row, index) => (
          <div
            key={row.key}
            data-row={row.key}
            className="flex flex-col gap-2 rounded-md bg-surface p-3"
          >
            <Field label={t.condition(index + 1)}>
              {({ id }) => (
                <TextArea
                  id={id}
                  value={row.text}
                  maxLength={500}
                  onChange={(e) =>
                    setRows((list) =>
                      list.map((r) => (r.key === row.key ? { ...r, text: e.target.value } : r)),
                    )
                  }
                />
              )}
            </Field>
            <div>
              <Button variant="quiet" data-remove onClick={() => removeRow(index)}>
                {t.removeCondition(index + 1)}
              </Button>
            </div>
          </div>
        ))}
        <div>
          <Button
            variant="secondary"
            ref={addRef}
            onClick={() =>
              setRows((list) => [
                ...list,
                { key: Math.max(0, ...list.map((r) => r.key + 1)), text: '' },
              ])
            }
          >
            {t.addCondition}
          </Button>
        </div>
      </fieldset>
      <div className="flex flex-wrap gap-3">
        <Button type="submit" aria-disabled={props.busy}>
          {props.busy ? common.saving : t.confirm}
        </Button>
        <Button variant="quiet" onClick={props.onCancel}>
          {common.cancel}
        </Button>
      </div>
    </form>
  );
}
