'use client';

import { MODULE_TERMS, type ModuleTerm } from '@universityflow/catalogue/client';
import { common, moduleOutline, modules } from '@universityflow/content';
import type { RegistrationDraft } from '@universityflow/documents';
import { type FormEvent, useRef, useState } from 'react';
import { CourseOptions, CourseSearch, useCourseSearch } from '@/components/course-search';
import { MyModulesCard } from '@/components/modules';
import {
  Button,
  ButtonLink,
  Card,
  EmptyState,
  Field,
  FileButton,
  Input,
  Notice,
  Page,
  Select,
  StatusLine,
} from '@/components/ui';
import { ApiError, api, errorMessage } from '@/lib/client/api';
import { useFocusAfter } from '@/lib/client/focus';
import { useStatus } from '@/lib/client/status';
import type { RegistrationResponse } from '@/lib/server/registration';

const m = modules;
const PROOF = 'proof-of-registration';
/** As documents' MODULE_CODE: what a curriculum can be compared with. */
const MODULE_CODE = /^[A-Za-z0-9][A-Za-z0-9 \-/.]{1,23}$/;
const MAX_MODULES = 40;

type ProofResult = {
  documentId: string;
  registration: RegistrationDraft | null;
  sample: boolean;
};

/** Straight to storage (S3): a ticket, the file to storage, then the server checks and reads it. */
async function uploadDirect(file: File): Promise<ProofResult> {
  const ticket = await api<{ uploadId: string; url: string; fields: Record<string, string> }>(
    '/api/documents/uploads',
    { method: 'POST', json: { contentType: file.type, size: file.size } },
  );
  const form = new FormData();
  for (const [name, value] of Object.entries(ticket.fields)) form.append(name, value);
  form.append('file', file);
  const sent = await fetch(ticket.url, { method: 'POST', body: form }).catch(() => null);
  if (!sent?.ok) throw new ApiError(sent?.status ?? 0, 'upload', 'not-received');
  return api<ProofResult>(`/api/documents/uploads/${ticket.uploadId}?kind=${PROOF}`, {
    method: 'POST',
  });
}

/** Through our own server (local development). */
async function uploadThroughServer(file: File): Promise<ProofResult> {
  const form = new FormData();
  form.append('kind', PROOF);
  form.append('file', file);
  return api<ProofResult>('/api/documents', { method: 'POST', body: form });
}

/** What the confirm form starts from: a proof's draft, or one empty row to type into. */
interface Draft {
  readonly documentId: string | null;
  readonly sample: boolean;
  readonly draft: RegistrationDraft;
}

const EMPTY: RegistrationDraft = {
  programmeCode: null,
  yearOfStudy: null,
  modules: [],
  warnings: [],
};

/**
 * My modules: the check of the learner's confirmed registration, the proof upload (both upload
 * paths, like the letter), or their modules typed in, each confirmed row by row (hard rule 6).
 *
 * Focus never falls to `<body>` (WCAG 2.4.3, A3-13): opening or closing the confirm form moves it
 * to the page heading, a saved check to the check's heading, a removed one to the status line.
 * The status line stays mounted across both views, so what it says is announced (A3-04).
 */
export function ModulesView({
  initial,
  direct,
}: {
  initial: RegistrationResponse;
  direct: boolean;
}) {
  const [data, setData] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useStatus();
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const statusRef = useRef<HTMLParagraphElement>(null);
  const cardRef = useRef<HTMLHeadingElement>(null);
  const focusAfter = useFocusAfter();

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

  const openForm = (next: Draft) => {
    setDraft(next);
    focusAfter(() => titleRef.current);
  };

  async function upload(file: File) {
    await run(
      () => (direct ? uploadDirect(file) : uploadThroughServer(file)),
      (result) => {
        if (!result.registration) {
          setError(m.unreadable);
          return;
        }
        openForm({
          documentId: result.documentId,
          sample: result.sample,
          draft: result.registration,
        });
      },
      null,
    );
  }

  const current = data.modules;
  return (
    <Page
      title={draft ? m.confirmTitle : m.title}
      lead={draft ? (draft.documentId ? m.confirmLead : m.typeLead) : m.lead}
      headingRef={titleRef}
    >
      {!draft && error ? <Notice tone="danger">{error}</Notice> : null}
      <StatusLine said={status} ref={statusRef} tabIndex={-1} />

      {draft ? (
        <ConfirmModules
          key={draft.documentId ?? 'typed'}
          draft={draft}
          data={data}
          busy={busy}
          error={error}
          onConfirm={(registration) =>
            void run(
              () =>
                api<RegistrationResponse>('/api/registration', {
                  method: 'PUT',
                  json: { ...registration, documentId: draft.documentId },
                }),
              (next) => {
                setData(next);
                setDraft(null);
                focusAfter(() => cardRef.current ?? statusRef.current);
              },
              m.saved,
            )
          }
          onCancel={() => {
            setDraft(null);
            setError(null);
            focusAfter(() => titleRef.current);
          }}
        />
      ) : (
        <>
          {current ? (
            <MyModulesCard artifact={current} remindersOn={data.remindersOn} headingRef={cardRef}>
              <div>
                <Button
                  variant="quiet"
                  aria-disabled={busy}
                  onClick={() => {
                    if (busy) return;
                    void run(
                      () =>
                        api<RegistrationResponse>(`/api/registration/${current.registrationId}`, {
                          method: 'DELETE',
                        }),
                      (next) => {
                        setData(next);
                        // The card is gone: the status line says so, and takes focus.
                        focusAfter(() => statusRef.current);
                      },
                      m.removed,
                    );
                  }}
                >
                  {m.remove}
                </Button>
              </div>
            </MyModulesCard>
          ) : (
            <EmptyState>{m.empty}</EmptyState>
          )}

          <Card className="flex flex-col gap-3">
            <h2 className="text-lg">{current ? m.checkAgain : m.uploadTitle}</h2>
            <p>{m.uploadLead}</p>
            {/* Never `disabled` while reading: that drops focus to <body> (A3-13). The
                request guard ignores a second file instead. */}
            <FileButton
              className="self-start"
              label={busy ? m.reading : m.chooseProof}
              accept="image/jpeg,image/png,image/webp,application/pdf"
              capture="environment"
              aria-disabled={busy}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file && !busy) void upload(file);
                e.target.value = '';
              }}
            />
            <div>
              <Button
                variant="secondary"
                onClick={() => openForm({ documentId: null, sample: false, draft: EMPTY })}
              >
                {m.typeIn}
              </Button>
            </div>
          </Card>

          {/* Phase 6b: each module's outline, checked part by part. */}
          <Card className="flex flex-col gap-3">
            <h2 className="text-lg">{moduleOutline.fromModules.title}</h2>
            <p>{moduleOutline.fromModules.lead}</p>
            <div>
              <ButtonLink href="/modules/outline" variant="secondary">
                {moduleOutline.fromModules.link}
              </ButtonLink>
            </div>
          </Card>
        </>
      )}
    </Page>
  );
}

interface Row {
  key: number;
  code: string;
  name: string;
  term: ModuleTerm | '';
  termAsPrinted: string | null;
  credits: string;
}

const blankRow = (key: number): Row => ({
  key,
  code: '',
  name: '',
  term: '',
  termAsPrinted: null,
  credits: '',
});

/**
 * Hard rule 6 for a proof of registration: the course, the year and every module row are shown
 * back and confirmed before anything is compared. The learner can fix, add or remove any row.
 *
 * A code that can't be compared is marked on its own row (`aria-invalid`, the error read with the
 * field), the summary names the rows, and focus moves to the first (WCAG 3.3.1, A3-14), as the
 * app does. Removing a row moves focus to the next row, the one before, or "Add a module" (A3-17).
 */
function ConfirmModules(props: {
  draft: Draft;
  data: RegistrationResponse;
  busy: boolean;
  error: string | null;
  onConfirm: (registration: {
    programmeId: string;
    academicYear: number;
    yearOfStudy: number | null;
    modules: Array<{
      code: string;
      name: string | null;
      term: ModuleTerm | null;
      credits: number | null;
    }>;
  }) => void;
  onCancel: () => void;
}) {
  const { draft, sample } = props.draft;
  const [programmeId, setProgrammeId] = useState(props.data.acceptedProgrammeId ?? '');
  const [year, setYear] = useState(String(props.data.defaultYear));
  const [yearOfStudy, setYearOfStudy] = useState(
    draft.yearOfStudy ? String(draft.yearOfStudy) : '',
  );
  const [rows, setRows] = useState<Row[]>(() =>
    draft.modules.length > 0
      ? draft.modules.map((d, key) => ({
          key,
          code: d.code,
          name: d.name ?? '',
          term: d.term ?? '',
          termAsPrinted: d.termAsPrinted,
          credits: d.credits === null ? '' : String(d.credits),
        }))
      : [blankRow(0)],
  );
  const [problem, setProblem] = useState<string | null>(null);
  const [programmeError, setProgrammeError] = useState(false);
  /** The rows (by key) whose code can't be compared. */
  const [badRows, setBadRows] = useState<ReadonlySet<number>>(new Set());
  const programmeRef = useRef<HTMLSelectElement>(null);
  const listRef = useRef<HTMLFieldSetElement>(null);
  const addRef = useRef<HTMLButtonElement>(null);
  const focusAfter = useFocusAfter();
  const search = useCourseSearch(props.data.options, (o) => o.id === programmeId);
  const update = (key: number, patch: Partial<Row>) =>
    setRows((list) => list.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const inRow = (key: number, selector: string) =>
    listRef.current?.querySelector<HTMLElement>(`[data-row="${key}"] ${selector}`);

  const removeRow = (index: number) => {
    const next = rows[index + 1];
    const previous = rows[index - 1];
    const gone = rows[index]?.key;
    setRows((list) => list.filter((r) => r.key !== gone));
    focusAfter(() =>
      next
        ? inRow(next.key, 'input')
        : previous
          ? inRow(previous.key, '[data-remove]')
          : addRef.current,
    );
  };

  function submit(e: FormEvent) {
    e.preventDefault();
    if (props.busy) return;
    const filled = rows.filter((r) => r.code.trim() !== '');
    const bad = filled.filter((r) => !MODULE_CODE.test(r.code.trim()));
    setProgrammeError(programmeId === '');
    setBadRows(new Set(bad.map((r) => r.key)));
    if (programmeId === '') {
      setProblem(null);
      programmeRef.current?.focus();
      return;
    }
    if (filled.length === 0) {
      setProblem(m.needOneModule);
      inRow(rows[0]?.key ?? 0, 'input')?.focus();
      return;
    }
    if (bad.length > 0) {
      setProblem(m.checkRows(bad.map((r) => rows.indexOf(r) + 1)));
      const first = bad[0];
      if (first) focusAfter(() => inRow(first.key, 'input'));
      return;
    }
    setProblem(null);
    const credits = (value: string) => {
      const n = Number(value);
      return value.trim() === '' || !Number.isFinite(n) ? null : n;
    };
    props.onConfirm({
      programmeId,
      academicYear: Number(year),
      yearOfStudy: yearOfStudy === '' ? null : Number(yearOfStudy),
      modules: filled.map((r) => ({
        code: r.code.trim(),
        name: r.name.trim() === '' ? null : r.name.trim(),
        term: r.term === '' ? null : r.term,
        credits: credits(r.credits),
      })),
    });
  }

  return (
    <form className="flex flex-col gap-5" noValidate onSubmit={submit}>
      {sample ? <Notice tone="warning">{m.sampleLead}</Notice> : null}
      {draft.warnings.map((w) => (
        <Notice key={w} tone="warning">
          {m.warnings[w]}
        </Notice>
      ))}
      {props.error ? <Notice tone="danger">{props.error}</Notice> : null}
      {problem ? <Notice tone="danger">{problem}</Notice> : null}
      {draft.programmeCode ? (
        <p className="text-sm text-muted">{m.programmeCodeAsPrinted(draft.programmeCode)}</p>
      ) : null}
      <Field
        label={m.programme}
        hint={m.programmeHint}
        error={programmeError ? m.chooseProgramme : null}
      >
        {({ id, describedBy, invalid }) => (
          <>
            <CourseSearch search={search} total={props.data.options.length} />
            <Select
              id={id}
              ref={programmeRef}
              aria-describedby={describedBy}
              aria-invalid={invalid}
              value={programmeId}
              onChange={(e) => {
                setProgrammeId(e.target.value);
                setProgrammeError(false);
              }}
            >
              <CourseOptions courses={search.shown} none={m.chooseProgramme} />
            </Select>
          </>
        )}
      </Field>
      <Field label={m.academicYear}>
        {({ id }) => (
          <Input
            id={id}
            type="number"
            inputMode="numeric"
            min={2020}
            max={2100}
            value={year}
            onChange={(e) => setYear(e.target.value)}
          />
        )}
      </Field>
      <Field label={m.yearOfStudy}>
        {({ id }) => (
          <Select id={id} value={yearOfStudy} onChange={(e) => setYearOfStudy(e.target.value)}>
            <option value="">{m.notSure}</option>
            {[1, 2, 3, 4, 5, 6].map((y) => (
              <option key={y} value={String(y)}>
                {y}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <fieldset className="flex flex-col gap-3" ref={listRef}>
        <legend className="mb-2 font-medium">{m.registeredTitle}</legend>
        {rows.map((row, index) => (
          <div
            key={row.key}
            data-row={row.key}
            className="flex flex-col gap-2 rounded-md bg-surface p-3"
          >
            <Field
              label={m.moduleCode(index + 1)}
              error={badRows.has(row.key) ? m.invalidCode : null}
            >
              {({ id, describedBy, invalid }) => (
                <Input
                  id={id}
                  aria-describedby={describedBy}
                  aria-invalid={invalid}
                  value={row.code}
                  maxLength={24}
                  autoCapitalize="characters"
                  autoCorrect="off"
                  spellCheck={false}
                  onChange={(e) => update(row.key, { code: e.target.value })}
                />
              )}
            </Field>
            <Field label={m.moduleName(index + 1)}>
              {({ id }) => (
                <Input
                  id={id}
                  value={row.name}
                  maxLength={160}
                  onChange={(e) => update(row.key, { name: e.target.value })}
                />
              )}
            </Field>
            <Field
              label={m.moduleTerm(index + 1)}
              hint={row.termAsPrinted ? m.termAsPrinted(row.termAsPrinted) : undefined}
            >
              {({ id, describedBy }) => (
                <Select
                  id={id}
                  aria-describedby={describedBy}
                  value={row.term}
                  onChange={(e) => update(row.key, { term: e.target.value as ModuleTerm | '' })}
                >
                  <option value="">{m.notSure}</option>
                  {MODULE_TERMS.map((t) => (
                    <option key={t} value={t}>
                      {m.terms[t]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label={m.moduleCredits(index + 1)}>
              {({ id }) => (
                <Input
                  id={id}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={240}
                  value={row.credits}
                  onChange={(e) => update(row.key, { credits: e.target.value })}
                />
              )}
            </Field>
            <div>
              <Button variant="quiet" data-remove onClick={() => removeRow(index)}>
                {m.removeModule(index + 1)}
              </Button>
            </div>
          </div>
        ))}
        {rows.length < MAX_MODULES ? (
          <div>
            <Button
              variant="secondary"
              ref={addRef}
              onClick={() =>
                setRows((list) => [...list, blankRow(Math.max(0, ...list.map((r) => r.key + 1)))])
              }
            >
              {m.addModule}
            </Button>
          </div>
        ) : null}
      </fieldset>
      <div className="flex flex-wrap gap-3">
        <Button type="submit" aria-disabled={props.busy}>
          {props.busy ? common.saving : m.confirm}
        </Button>
        <Button variant="quiet" onClick={props.onCancel}>
          {common.cancel}
        </Button>
      </div>
    </form>
  );
}
