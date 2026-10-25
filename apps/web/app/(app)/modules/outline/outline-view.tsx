'use client';

import { MODULE_TERMS, type ModuleTerm } from '@universityflow/catalogue/client';
import { common, demo as demoCopy, moduleOutline, modules } from '@universityflow/content';
import type { ModuleOutlineRecord } from '@universityflow/db';
import type { ConfirmedModuleOutline, ModuleOutlineDraft } from '@universityflow/documents';
import { type FormEvent, useRef, useState } from 'react';
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
import { ApiError, api, errorMessage, formatDate } from '@/lib/client/api';
import { useFocusAfter } from '@/lib/client/focus';
import { useStatus } from '@/lib/client/status';
import type { OutlinesResponse } from '@/lib/server/module-outlines';

const o = moduleOutline;
const KIND = 'module-outline';
/** As documents' MODULE_CODE. */
const MODULE_CODE = /^[A-Za-z0-9][A-Za-z0-9 \-/.]{1,23}$/;
/** As documents' isMobileNumber / holdsMobileNumber (D3): the server checks again. */
const MOBILE = /(?<![\d+])(?:\+27|27|0)[ -]?(?:6\d|7[1-9]|8[1-4])(?:[ -]?\d){7}(?!\d)/;
const EMAIL = /^[^\s@]{1,64}@[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i;
const SECTIONS = ['components', 'dates', 'books', 'people'] as const;
type Section = (typeof SECTIONS)[number];
const COMPONENT_KINDS = Object.keys(o.components.kinds) as Array<keyof typeof o.components.kinds>;
const BOOK_ROLES = Object.keys(o.books.roles) as Array<keyof typeof o.books.roles>;

type UploadResult = { documentId: string; outline: ModuleOutlineDraft | null; sample: boolean };

/** Straight to storage (S3): a ticket, the file to storage, then the server checks and reads it. */
async function uploadDirect(file: File): Promise<UploadResult> {
  const ticket = await api<{ uploadId: string; url: string; fields: Record<string, string> }>(
    '/api/documents/uploads',
    { method: 'POST', json: { contentType: file.type, size: file.size } },
  );
  const form = new FormData();
  for (const [name, value] of Object.entries(ticket.fields)) form.append(name, value);
  form.append('file', file);
  const sent = await fetch(ticket.url, { method: 'POST', body: form }).catch(() => null);
  if (!sent?.ok) throw new ApiError(sent?.status ?? 0, 'upload', 'not-received');
  return api<UploadResult>(`/api/documents/uploads/${ticket.uploadId}?kind=${KIND}`, {
    method: 'POST',
  });
}

/** Through our own server (local development, the judge demo). */
async function uploadThroughServer(file: File): Promise<UploadResult> {
  const form = new FormData();
  form.append('kind', KIND);
  form.append('file', file);
  return api<UploadResult>('/api/documents', { method: 'POST', body: form });
}

/** The sentence for an error, this page's own first (consent wording that doesn't name outlines). */
function outlineError(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.code === 'consent-outdated' && e.detail === 'module-outlines') return o.consentNotYet;
    if (e.code === 'invalid' && e.detail === 'weights-dont-add-up') {
      return o.warnings['weights-dont-add-up'];
    }
    if (e.code === 'state' && e.detail === 'personal-number') return o.refused;
    if (e.code === 'upload' && e.detail === 'demo-sample-only') return demoCopy.sampleOnly;
  }
  return errorMessage(e);
}

interface Draft {
  readonly documentId: string | null;
  readonly sample: boolean;
  readonly draft: ModuleOutlineDraft;
}

const EMPTY: ModuleOutlineDraft = {
  moduleCode: null,
  moduleName: null,
  academicYear: null,
  term: null,
  termAsPrinted: null,
  components: [],
  weightsTotal: null,
  dpPercent: null,
  dpPercentAsPrinted: null,
  dpQuote: null,
  examSubminimum: null,
  examSubminimumAsPrinted: null,
  supplementaryQuote: null,
  dates: [],
  books: [],
  people: [],
  warnings: [],
};

/**
 * Module outlines (Phase 6b): upload an outline (both upload paths, like the proof of
 * registration; on the judge demo, the SAMPLE outline), check it part by part (how marks work,
 * dates, books, who teaches it; "Not in my outline" for any), and see the outlines kept. Nothing
 * read is used until the learner confirms it (hard rule 6).
 *
 * Focus never falls to `<body>` (WCAG 2.4.3): opening or closing the check moves it to the page
 * heading, each part to its heading, a removed outline to the status line.
 */
export function OutlineView({
  initial,
  direct,
  demo,
}: {
  initial: OutlinesResponse;
  direct: boolean;
  demo: boolean;
}) {
  const [data, setData] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useStatus();
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const statusRef = useRef<HTMLParagraphElement>(null);
  const focusAfter = useFocusAfter();

  /** One request at a time: a press while one runs does nothing (A3-01). */
  const inFlight = useRef(false);
  async function run<T>(call: () => Promise<T>, apply: (value: T) => void, done: string | null) {
    if (inFlight.current) return;
    inFlight.current = true;
    setError(null);
    setStatus('');
    setBusy(true);
    try {
      apply(await call());
      setStatus(done ?? '');
    } catch (e) {
      setError(outlineError(e));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  const openForm = (next: Draft) => {
    setDraft(next);
    focusAfter(() => titleRef.current);
  };

  const read = (call: () => Promise<UploadResult>) =>
    run(
      call,
      (result) => {
        if (!result.outline) {
          setError(o.unreadable);
          return;
        }
        openForm({ documentId: result.documentId, sample: result.sample, draft: result.outline });
      },
      null,
    );

  return (
    <Page
      title={draft ? o.confirmTitle : o.title}
      lead={draft ? o.confirmLead : o.lead}
      headingRef={titleRef}
    >
      {!draft && error ? <Notice tone="danger">{error}</Notice> : null}
      <StatusLine said={status} ref={statusRef} tabIndex={-1} />
      {draft ? (
        <ConfirmOutline
          key={draft.documentId ?? 'typed'}
          draft={draft}
          data={data}
          busy={busy}
          error={error}
          onSave={(outline) =>
            void run(
              () =>
                api<OutlinesResponse>('/api/module-outlines', {
                  method: 'PUT',
                  json: { ...outline, documentId: draft.documentId },
                }),
              (next) => {
                setData(next);
                setDraft(null);
                focusAfter(() => statusRef.current);
              },
              o.saved,
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
          <Card className="flex flex-col gap-3">
            <h2 className="text-lg">{o.uploadTitle}</h2>
            <p>{o.uploadLead}</p>
            {/* Never `disabled` while reading: that drops focus to <body> (A3-13). */}
            <FileButton
              className="self-start"
              label={busy ? o.reading : o.choose}
              accept="image/jpeg,image/png,image/webp,application/pdf"
              capture="environment"
              aria-disabled={busy}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file && !busy)
                  void read(() => (direct ? uploadDirect(file) : uploadThroughServer(file)));
                e.target.value = '';
              }}
            />
            {demo ? (
              <div>
                <p className="mb-2 text-muted">{o.useSampleLead}</p>
                <Button
                  variant="secondary"
                  aria-disabled={busy}
                  onClick={() => {
                    if (!busy) {
                      void read(() =>
                        api<UploadResult>('/api/demo/sample-outline', { method: 'POST' }),
                      );
                    }
                  }}
                >
                  {o.useSample}
                </Button>
              </div>
            ) : null}
            <div>
              <Button
                variant="quiet"
                onClick={() => openForm({ documentId: null, sample: false, draft: EMPTY })}
              >
                {o.typeIn}
              </Button>
            </div>
          </Card>

          <section className="flex flex-col gap-4" aria-labelledby="outlines-heading">
            <h2 id="outlines-heading" className="text-lg">
              {o.savedTitle}
            </h2>
            {data.outlines.length === 0 ? (
              <EmptyState>{o.empty}</EmptyState>
            ) : (
              data.outlines.map((outline) => (
                <SavedOutline
                  key={outline.id}
                  outline={outline}
                  busy={busy}
                  onRemove={() =>
                    void run(
                      () =>
                        api<OutlinesResponse>(`/api/module-outlines/${outline.id}`, {
                          method: 'DELETE',
                        }),
                      (next) => {
                        setData(next);
                        focusAfter(() => statusRef.current);
                      },
                      o.removed,
                    )
                  }
                />
              ))
            )}
          </section>
        </>
      )}
    </Page>
  );
}

/** One kept outline: where it came from, then each part as confirmed, or "Not in your outline". */
function SavedOutline({
  outline,
  busy,
  onRemove,
}: {
  outline: ModuleOutlineRecord;
  busy: boolean;
  onRemove: () => void;
}) {
  const { outline: kept } = outline;
  const confirmedOn = formatDate(new Date(outline.confirmedAt).toISOString());
  const none = <p className="text-muted">{o.notInYourOutline}</p>;
  return (
    <Card as="article" className="flex flex-col gap-3">
      <h3 className="text-lg">
        {o.heading(outline.moduleCode, outline.academicYear)}
        {kept.moduleName ? (
          <span className="block text-base font-normal">{kept.moduleName}</span>
        ) : null}
      </h3>
      <p className="text-sm text-muted">
        {outline.fromDocument ? o.fromOutline(confirmedOn) : o.typedIn(confirmedOn)}
      </p>
      <h4 className="font-medium">{o.sections.components}</h4>
      {kept.components.status === 'confirmed' ? (
        <ul className="list-disc pl-5">
          {kept.components.items.map((c) => (
            <li key={c.name}>
              {o.componentLine(c.name, c.weight)}
              {c.subminimum === null ? null : `, ${o.subminimumLine(c.subminimum)}`}
            </li>
          ))}
          {kept.components.dpRequirement.percent === null ? null : (
            <li>{o.dpLine(kept.components.dpRequirement.percent)}</li>
          )}
          {kept.components.examSubminimum === null ? null : (
            <li>{o.examSubminimumLine(kept.components.examSubminimum)}</li>
          )}
        </ul>
      ) : (
        none
      )}
      <h4 className="font-medium">{o.sections.dates}</h4>
      {kept.dates.status === 'confirmed' ? (
        <ul className="list-disc pl-5">
          {kept.dates.items.map((d) => (
            <li key={`${d.label}-${d.date}`}>
              {d.label}: {formatDate(d.date)}
            </li>
          ))}
        </ul>
      ) : (
        none
      )}
      <h4 className="font-medium">{o.sections.books}</h4>
      {kept.books.status === 'confirmed' ? (
        <ul className="list-disc pl-5">
          {kept.books.items.map((b) => (
            <li key={`${b.title}-${b.isbn ?? ''}`}>
              {o.books.roles[b.role]}: {b.title}
              {b.edition ? ` (${b.edition})` : ''}
              {b.isbn ? `, ISBN ${b.isbn}` : ''}
            </li>
          ))}
        </ul>
      ) : (
        none
      )}
      <h4 className="font-medium">{o.sections.people}</h4>
      {kept.people.status === 'confirmed' ? (
        <ul className="list-disc pl-5">
          {kept.people.items.map((p) => (
            <li key={p.name}>
              {[p.name, p.role, p.email, p.phone, p.office, p.consultationTimes]
                .filter(Boolean)
                .join(' · ')}
            </li>
          ))}
        </ul>
      ) : (
        none
      )}
      <div>
        <Button
          variant="quiet"
          aria-disabled={busy}
          onClick={() => (busy ? undefined : onRemove())}
        >
          {o.remove(outline.moduleCode)}
        </Button>
      </div>
    </Card>
  );
}

// ── The check, part by part ──────────────────────────────────────────────────────────────────

type Row = Record<string, string> & { readonly key: string };
type FieldKind = 'text' | 'number' | 'date' | 'email' | 'tel' | 'select' | 'textarea';

interface FieldSpec {
  readonly name: string;
  readonly label: (n: number) => string;
  readonly kind: FieldKind;
  readonly options?: ReadonlyArray<readonly [string, string]>;
  readonly max?: number;
  /** What the outline printed, shown under the field. */
  readonly printed?: string;
}

const FIELDS: Readonly<Record<Section, ReadonlyArray<FieldSpec>>> = {
  components: [
    { name: 'name', label: o.components.name, kind: 'text', max: 160 },
    {
      name: 'kind',
      label: o.components.kind,
      kind: 'select',
      options: COMPONENT_KINDS.map((k) => [k, o.components.kinds[k]] as const),
    },
    { name: 'weight', label: o.components.weight, kind: 'number', printed: 'weightAsPrinted' },
    {
      name: 'subminimum',
      label: o.components.subminimum,
      kind: 'number',
      printed: 'subminimumAsPrinted',
    },
  ],
  dates: [
    { name: 'label', label: o.dates.label, kind: 'text', max: 120 },
    { name: 'date', label: o.dates.date, kind: 'date', printed: 'dateAsPrinted' },
  ],
  books: [
    {
      name: 'role',
      label: o.books.role,
      kind: 'select',
      options: BOOK_ROLES.map((r) => [r, o.books.roles[r]] as const),
    },
    { name: 'title', label: o.books.title, kind: 'text', max: 200 },
    { name: 'authors', label: o.books.authors, kind: 'text', max: 200 },
    { name: 'edition', label: o.books.edition, kind: 'text', max: 40 },
    { name: 'isbn', label: o.books.isbn, kind: 'text', max: 40, printed: 'isbnAsPrinted' },
  ],
  people: [
    { name: 'name', label: o.people.name, kind: 'text', max: 160 },
    { name: 'role', label: o.people.role, kind: 'text', max: 60 },
    { name: 'email', label: o.people.email, kind: 'email', max: 120 },
    { name: 'phone', label: o.people.phone, kind: 'tel', max: 30 },
    { name: 'office', label: o.people.office, kind: 'text', max: 80 },
    { name: 'consultationTimes', label: o.people.consultation, kind: 'textarea', max: 200 },
  ],
};

const ADD: Readonly<Record<Section, string>> = {
  components: o.components.add,
  dates: o.dates.add,
  books: o.books.add,
  people: o.people.add,
};
const REMOVE: Readonly<Record<Section, (n: number) => string>> = {
  components: o.components.remove,
  dates: o.dates.remove,
  books: o.books.remove,
  people: o.people.remove,
};

let nextKey = 0;
const keyed = (row: Record<string, string>): Row => ({ ...row, key: `r${nextKey++}` });
const str = (value: string | number | null | undefined) =>
  value === null || value === undefined ? '' : String(value);

function rowsFrom(draft: ModuleOutlineDraft): Record<Section, Row[]> {
  return {
    components: draft.components.map((c) =>
      keyed({
        name: c.name,
        kind: c.kind ?? 'other',
        weight: str(c.weight),
        weightAsPrinted: str(c.weightAsPrinted),
        subminimum: str(c.subminimum),
        subminimumAsPrinted: str(c.subminimumAsPrinted),
      }),
    ),
    dates: draft.dates.map((d) =>
      keyed({ label: d.label, date: str(d.date), dateAsPrinted: str(d.dateAsPrinted) }),
    ),
    books: draft.books.map((b) =>
      keyed({
        role: b.role ?? 'prescribed',
        title: b.title,
        authors: str(b.authors),
        edition: str(b.edition),
        isbn: str(b.isbn),
        isbnAsPrinted: b.isbn ? '' : str(b.isbnAsPrinted),
      }),
    ),
    people: draft.people.map((p) =>
      keyed({
        name: p.name,
        role: str(p.role),
        email: str(p.email),
        phone: str(p.phone),
        office: str(p.office),
        consultationTimes: str(p.consultationTimes),
      }),
    ),
  };
}

const blank = (section: Section): Row =>
  keyed(
    Object.fromEntries(
      FIELDS[section].map((f) => [f.name, f.kind === 'select' ? (f.options?.[0]?.[0] ?? '') : '']),
    ),
  );

/** A percentage the learner typed, or null for blank; NaN when it isn't one from 0 to 100. */
function percent(value: string): number | null {
  const text = value.trim().replace(',', '.').replace(/%$/, '').trim();
  if (text === '') return null;
  const n = Number(text);
  return Number.isFinite(n) && n >= 0 && n <= 100 ? n : Number.NaN;
}

/** An ISBN-10 or ISBN-13 with its check digit right, digits only; null when it isn't one. */
function isbn(value: string): string | null {
  const v = value.replace(/[\s-]/g, '').toUpperCase();
  if (/^97[89]\d{10}$/.test(v)) {
    const sum = [...v].slice(0, 12).reduce((t, d, i) => t + Number(d) * (i % 2 === 0 ? 1 : 3), 0);
    return (10 - (sum % 10)) % 10 === Number(v[12]) ? v : null;
  }
  if (/^\d{9}[\dX]$/.test(v)) {
    const sum = [...v].reduce((t, d, i) => t + (d === 'X' ? 10 : Number(d)) * (10 - i), 0);
    return sum % 11 === 0 ? v : null;
  }
  return null;
}

const orNull = (value: string | undefined) => {
  const text = (value ?? '').trim();
  return text === '' ? null : text;
};

type Decision = 'confirmed' | 'not-in-outline';
type Problems = Readonly<Record<string, Readonly<Record<string, string>>>>;

/**
 * Hard rule 6 for a module outline: the module, then each part in turn (how marks work, dates,
 * books, who teaches it), checked, fixed, added to or said not to be in the outline. Weights that
 * don't add up to 100% are refused with their total, never changed. A row with a problem is marked
 * on its own field (`aria-invalid`, the error read with it) and focus moves to the first (WCAG
 * 3.3.1).
 */
function ConfirmOutline(props: {
  draft: Draft;
  data: OutlinesResponse;
  busy: boolean;
  error: string | null;
  onSave: (outline: Omit<ConfirmedModuleOutline, 'documentId'>) => void;
  onCancel: () => void;
}) {
  const { draft, sample } = props.draft;
  const firstModule = props.data.registration?.modules[0];
  const [code, setCode] = useState(draft.moduleCode ?? firstModule?.code ?? '');
  const [name, setName] = useState(draft.moduleName ?? firstModule?.name ?? '');
  const [year, setYear] = useState(
    String(draft.academicYear ?? props.data.registration?.academicYear ?? props.data.defaultYear),
  );
  const [term, setTerm] = useState<ModuleTerm | ''>(draft.term ?? '');
  const [rows, setRows] = useState(() => rowsFrom(draft));
  const [extra, setExtra] = useState({
    dpPercent: str(draft.dpPercent),
    dpQuote: str(draft.dpQuote),
    examSubminimum: str(draft.examSubminimum),
    supplementaryQuote: str(draft.supplementaryQuote),
  });
  const [decisions, setDecisions] = useState<Partial<Record<Section, Decision>>>({});
  const [step, setStep] = useState(0);
  const [problem, setProblem] = useState<string | null>(null);
  const [problems, setProblems] = useState<Problems>({});
  const [codeError, setCodeError] = useState(false);
  const stepRef = useRef<HTMLHeadingElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const focusAfter = useFocusAfter();
  const section = SECTIONS[step] as Section;

  const update = (key: string, patch: Record<string, string>) =>
    setRows((all) => ({
      ...all,
      [section]: all[section].map((r) => (r.key === key ? { ...r, ...patch } : r)),
    }));
  const firstInvalid = () =>
    focusAfter(() => formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]') ?? null);

  /** Checks this part's rows; returns the problems by row key and field. */
  function check(list: Row[]): {
    problems: Record<string, Record<string, string>>;
    summary: string | null;
  } {
    const found: Record<string, Record<string, string>> = {};
    const flag = (row: Row, field: string, message: string) => {
      found[row.key] = { ...found[row.key], [field]: message };
    };
    for (const row of list) {
      if (section === 'components') {
        if (!orNull(row['name'])) flag(row, 'name', o.needOneRow);
        const w = percent(row['weight'] ?? '');
        if (w === null || Number.isNaN(w) || w === 0)
          flag(row, 'weight', o.components.weightMissing);
        if (Number.isNaN(percent(row['subminimum'] ?? ''))) {
          flag(row, 'subminimum', o.components.percentInvalid);
        }
      } else if (section === 'dates') {
        if (!orNull(row['label'])) flag(row, 'label', o.needOneRow);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(row['date'] ?? '')) flag(row, 'date', o.dates.dateMissing);
      } else if (section === 'books') {
        if (!orNull(row['title'])) flag(row, 'title', o.needOneRow);
        if (orNull(row['isbn']) && !isbn(row['isbn'] ?? '')) flag(row, 'isbn', o.books.isbnInvalid);
      } else {
        if (!orNull(row['name'])) flag(row, 'name', o.needOneRow);
        const email = orNull(row['email']);
        if (email && !EMAIL.test(email)) flag(row, 'email', o.people.emailInvalid);
        const phone = orNull(row['phone']);
        if (phone && (MOBILE.test(phone) || !/^[+\d][\d ()-]{5,}$/.test(phone))) {
          flag(row, 'phone', o.people.phoneInvalid);
        }
        if (MOBILE.test(row['consultationTimes'] ?? '')) {
          flag(row, 'consultationTimes', o.people.phoneInvalid);
        }
      }
    }
    const bad = list.flatMap((r, i) => (found[r.key] ? [i + 1] : []));
    let summary = bad.length > 0 ? o.checkRows(bad) : null;
    if (section === 'components' && bad.length === 0) {
      const extras = [extra.dpPercent, extra.examSubminimum].map(percent);
      if (extras.some((v) => Number.isNaN(v))) summary = o.components.percentInvalid;
      const total =
        Math.round(list.reduce((t, r) => t + (percent(r['weight'] ?? '') ?? 0), 0) * 100) / 100;
      // Refused, never rescaled (hard rule 6).
      if (total !== 100) summary = o.components.notHundred(total);
    }
    return { problems: found, summary };
  }

  function goTo(next: number) {
    setProblem(null);
    setProblems({});
    setStep(next);
    focusAfter(() => stepRef.current);
  }

  function decide(decision: Decision) {
    if (props.busy) return;
    if (!MODULE_CODE.test(code.trim())) {
      setCodeError(true);
      firstInvalid();
      return;
    }
    setCodeError(false);
    if (decision === 'confirmed') {
      const list = rows[section];
      if (list.length === 0) {
        setProblem(o.needOneRow);
        return;
      }
      const result = check(list);
      setProblems(result.problems);
      setProblem(result.summary);
      if (result.summary) {
        firstInvalid();
        return;
      }
    }
    const all = { ...decisions, [section]: decision };
    setDecisions(all);
    if (step < SECTIONS.length - 1) goTo(step + 1);
    else props.onSave(build(all));
  }

  function build(
    all: Partial<Record<Section, Decision>>,
  ): Omit<ConfirmedModuleOutline, 'documentId'> {
    const none = { status: 'not-in-outline' } as const;
    const is = (s: Section) => all[s] === 'confirmed';
    return {
      moduleCode: code.trim(),
      moduleName: orNull(name),
      academicYear: Number(year),
      term: term === '' ? null : term,
      components: is('components')
        ? {
            status: 'confirmed',
            items: rows.components.map((r) => ({
              name: (r['name'] ?? '').trim(),
              kind: (r['kind'] ?? 'other') as keyof typeof o.components.kinds,
              weight: percent(r['weight'] ?? '') ?? 0,
              subminimum: percent(r['subminimum'] ?? ''),
            })),
            dpRequirement: { percent: percent(extra.dpPercent), quote: orNull(extra.dpQuote) },
            examSubminimum: percent(extra.examSubminimum),
            supplementaryQuote: orNull(extra.supplementaryQuote),
          }
        : none,
      dates: is('dates')
        ? {
            status: 'confirmed',
            items: rows.dates.map((r) => ({
              label: (r['label'] ?? '').trim(),
              date: r['date'] ?? '',
            })),
          }
        : none,
      books: is('books')
        ? {
            status: 'confirmed',
            items: rows.books.map((r) => ({
              role: (r['role'] ?? 'prescribed') as keyof typeof o.books.roles,
              title: (r['title'] ?? '').trim(),
              authors: orNull(r['authors']),
              edition: orNull(r['edition']),
              isbn: orNull(r['isbn']) ? isbn(r['isbn'] ?? '') : null,
            })),
          }
        : none,
      people: is('people')
        ? {
            status: 'confirmed',
            items: rows.people.map((r) => ({
              name: (r['name'] ?? '').trim(),
              role: orNull(r['role']),
              email: orNull(r['email']),
              phone: orNull(r['phone']),
              office: orNull(r['office']),
              consultationTimes: orNull(r['consultationTimes']),
            })),
          }
        : none,
    };
  }

  const list = rows[section];
  const total =
    section === 'components'
      ? Math.round(list.reduce((t, r) => t + (percent(r['weight'] ?? '') || 0), 0) * 100) / 100
      : null;

  return (
    <form
      ref={formRef}
      className="flex flex-col gap-5"
      noValidate
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        decide('confirmed');
      }}
    >
      {sample ? <Notice tone="warning">{o.sampleLead}</Notice> : null}
      {draft.warnings.map((w) => (
        <Notice key={w} tone="warning">
          {o.warnings[w]}
        </Notice>
      ))}
      {props.error ? <Notice tone="danger">{props.error}</Notice> : null}

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 font-medium">{o.moduleCode}</legend>
        <Field label={o.moduleCode} error={codeError ? o.invalidCode : null}>
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              aria-describedby={describedBy}
              aria-invalid={invalid}
              value={code}
              maxLength={24}
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              onChange={(e) => setCode(e.target.value)}
            />
          )}
        </Field>
        <Field label={o.moduleName}>
          {({ id }) => (
            <Input id={id} value={name} maxLength={160} onChange={(e) => setName(e.target.value)} />
          )}
        </Field>
        <Field label={o.academicYear}>
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
        <Field
          label={o.term}
          hint={draft.termAsPrinted ? o.termAsPrinted(draft.termAsPrinted) : undefined}
        >
          {({ id, describedBy }) => (
            <Select
              id={id}
              aria-describedby={describedBy}
              value={term}
              onChange={(e) => setTerm(e.target.value as ModuleTerm | '')}
            >
              <option value="">{o.notSure}</option>
              {MODULE_TERMS.map((t) => (
                <option key={t} value={t}>
                  {modules.terms[t]}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </fieldset>

      <section className="flex flex-col gap-3" aria-labelledby="outline-step">
        <p className="text-sm text-muted">{o.step(step + 1, SECTIONS.length)}</p>
        <h2 id="outline-step" className="text-xl" ref={stepRef} tabIndex={-1}>
          {o.sections[section]}
        </h2>
        <p className="text-muted">{o.sectionLeads[section]}</p>
        {problem ? <Notice tone="danger">{problem}</Notice> : null}
        {list.map((row, index) => (
          <div key={row.key} className="flex flex-col gap-2 rounded-md bg-surface p-3">
            {FIELDS[section].map((spec) => (
              <RowField
                key={spec.name}
                spec={spec}
                n={index + 1}
                row={row}
                error={problems[row.key]?.[spec.name] ?? null}
                onChange={(value) => update(row.key, { [spec.name]: value })}
              />
            ))}
            <div>
              <Button
                variant="quiet"
                onClick={() =>
                  setRows((all) => ({
                    ...all,
                    [section]: all[section].filter((r) => r.key !== row.key),
                  }))
                }
              >
                {REMOVE[section](index + 1)}
              </Button>
            </div>
          </div>
        ))}
        <div>
          <Button
            variant="secondary"
            onClick={() =>
              setRows((all) => ({ ...all, [section]: [...all[section], blank(section)] }))
            }
          >
            {ADD[section]}
          </Button>
        </div>
        {section === 'components' ? (
          <>
            {total !== null && list.length > 0 ? (
              <p className={total === 100 ? 'text-muted' : 'font-medium text-danger'}>
                {total === 100 ? o.components.total(total) : o.components.notHundred(total)}
              </p>
            ) : null}
            <Field
              label={o.components.dpPercent}
              hint={draft.dpPercentAsPrinted ? o.printedAs(draft.dpPercentAsPrinted) : undefined}
            >
              {({ id, describedBy }) => (
                <Input
                  id={id}
                  aria-describedby={describedBy}
                  inputMode="decimal"
                  value={extra.dpPercent}
                  onChange={(e) => setExtra({ ...extra, dpPercent: e.target.value })}
                />
              )}
            </Field>
            <Field label={o.components.dpQuote}>
              {({ id }) => (
                <TextArea
                  id={id}
                  maxLength={500}
                  value={extra.dpQuote}
                  onChange={(e) => setExtra({ ...extra, dpQuote: e.target.value })}
                />
              )}
            </Field>
            <Field
              label={o.components.examSubminimum}
              hint={
                draft.examSubminimumAsPrinted
                  ? o.printedAs(draft.examSubminimumAsPrinted)
                  : undefined
              }
            >
              {({ id, describedBy }) => (
                <Input
                  id={id}
                  aria-describedby={describedBy}
                  inputMode="decimal"
                  value={extra.examSubminimum}
                  onChange={(e) => setExtra({ ...extra, examSubminimum: e.target.value })}
                />
              )}
            </Field>
            <Field label={o.components.supplementary}>
              {({ id }) => (
                <TextArea
                  id={id}
                  maxLength={500}
                  value={extra.supplementaryQuote}
                  onChange={(e) => setExtra({ ...extra, supplementaryQuote: e.target.value })}
                />
              )}
            </Field>
          </>
        ) : null}
      </section>

      <div className="flex flex-wrap gap-3">
        <Button type="submit" aria-disabled={props.busy}>
          {step === SECTIONS.length - 1 ? (props.busy ? common.saving : o.save) : o.confirmPart}
        </Button>
        <Button
          variant="secondary"
          aria-disabled={props.busy}
          onClick={() => decide('not-in-outline')}
        >
          {o.notInOutline}
        </Button>
        {step > 0 ? (
          <Button variant="quiet" onClick={() => goTo(step - 1)}>
            {o.back}
          </Button>
        ) : null}
        <Button variant="quiet" onClick={props.onCancel}>
          {common.cancel}
        </Button>
      </div>
    </form>
  );
}

function RowField({
  spec,
  n,
  row,
  error,
  onChange,
}: {
  spec: FieldSpec;
  n: number;
  row: Row;
  error: string | null;
  onChange: (value: string) => void;
}) {
  const printed = spec.printed ? row[spec.printed] : undefined;
  const value = row[spec.name] ?? '';
  return (
    <Field label={spec.label(n)} hint={printed ? o.printedAs(printed) : undefined} error={error}>
      {({ id, describedBy, invalid }) => {
        const shared = { id, 'aria-describedby': describedBy, 'aria-invalid': invalid };
        if (spec.kind === 'select') {
          return (
            <Select {...shared} value={value} onChange={(e) => onChange(e.target.value)}>
              {spec.options?.map(([v, label]) => (
                <option key={v} value={v}>
                  {label}
                </option>
              ))}
            </Select>
          );
        }
        if (spec.kind === 'textarea') {
          return (
            <TextArea
              {...shared}
              maxLength={spec.max}
              value={value}
              onChange={(e) => onChange(e.target.value)}
            />
          );
        }
        return (
          <Input
            {...shared}
            type={spec.kind === 'number' ? 'text' : spec.kind}
            inputMode={spec.kind === 'number' ? 'decimal' : undefined}
            maxLength={spec.max}
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
        );
      }}
    </Field>
  );
}
