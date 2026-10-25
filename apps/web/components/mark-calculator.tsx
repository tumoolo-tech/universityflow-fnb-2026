'use client';

import type { ResolvedScheme } from '@universityflow/admissions/client';
import {
  type CalculatorWords,
  calculate,
  calculatorFields,
  initialValues,
  marksFrom,
  type NeededView,
  parseMark,
  type SavedMark,
} from '@universityflow/ui/mark-calculator';
import { type FormEvent, useId, useMemo, useRef, useState } from 'react';
import { Button, Field, Input, Notice, StatusLine } from '@/components/ui';
import { api, errorMessage } from '@/lib/client/api';
import { useStatus } from '@/lib/client/status';

/**
 * The module card's mark calculator (Phase 6c, D11, D13): the learner types the marks they've got
 * back and a target, and sees what they mean at once, worked out here in the browser by
 * packages/admissions (through `@universityflow/ui/mark-calculator`, never the ui barrel, whose
 * module card brings copy and the free-book providers into the chunk: the client-chunk budget
 * fails on them). It is given the scheme the server resolved, never catalogue records, and its
 * words as props (`{0}`-templates from packages/content): it imports no copy of its own.
 *
 * Only "Save my marks" sends anything. The result's summary is announced politely (an
 * `aria-live="polite"` line); a mark that isn't one is marked on its field once the learner leaves
 * it or saves, and nothing is worked out until it is fixed (refused, never repaired). Nothing
 * animates.
 */
export function MarkCalculator({
  scheme,
  words,
  initial,
  saveUrl,
  sample,
  savingLabel,
}: {
  scheme: ResolvedScheme;
  words: CalculatorWords;
  initial: { readonly marks: ReadonlyArray<SavedMark>; readonly target: number | null };
  saveUrl: string;
  sample: boolean;
  savingLabel: string;
}) {
  const { mode, fields, examNotes } = useMemo(
    () => calculatorFields(scheme, words),
    [scheme, words],
  );
  const [values, setValues] = useState<Record<string, string>>(() =>
    initialValues(fields, initial.marks),
  );
  const [target, setTarget] = useState(initial.target === null ? '' : String(initial.target));
  const [touched, setTouched] = useState<ReadonlySet<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, say] = useStatus();
  const inFlight = useRef(false);
  const titleId = useId();
  const resultId = useId();

  const view = calculate({ scheme, values, target }, words);
  const invalid = new Set(view.kind === 'invalid' ? view.invalid : []);
  const targetInvalid = view.kind === 'invalid' && view.targetInvalid;
  const touch = (key: string) => setTouched((t) => new Set(t).add(key));

  async function save(e: FormEvent) {
    e.preventDefault();
    setTouched(new Set([...fields.map((f) => f.key), 'target']));
    if (view.kind === 'invalid' || inFlight.current) return;
    const ownTarget = parseMark(target);
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      await api(saveUrl, {
        method: 'PUT',
        json: {
          marks: marksFrom(fields, values),
          target: typeof ownTarget === 'number' ? ownTarget : null,
        },
      });
      say(words.saved);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <section
      aria-labelledby={titleId}
      className="flex flex-col gap-4"
      data-testid="mark-calculator"
    >
      <div className="flex flex-col gap-1">
        <h2 id={titleId} className="text-lg">
          {words.title}
        </h2>
        <p className="text-sm text-muted">{words.lead}</p>
      </div>
      {sample ? <Notice tone="warning">{words.sampleMarks}</Notice> : null}

      {mode === 'unknown' ? (
        <p>{words.noWeighting}</p>
      ) : (
        <form className="flex flex-col gap-4" noValidate onSubmit={(e) => void save(e)}>
          {fields.map((f) => (
            <Field
              key={f.key}
              label={f.label}
              hint={words.markHint}
              error={invalid.has(f.key) && touched.has(f.key) ? words.markInvalid : null}
            >
              {({ id, describedBy, invalid: isInvalid }) => (
                <Input
                  id={id}
                  aria-describedby={describedBy}
                  aria-invalid={isInvalid}
                  inputMode="decimal"
                  autoComplete="off"
                  value={values[f.key] ?? ''}
                  onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                  onBlur={() => touch(f.key)}
                />
              )}
            </Field>
          ))}
          {examNotes.map((note) => (
            <p key={note} className="text-sm text-muted">
              {note}
            </p>
          ))}
          <Field
            label={words.targetLabel}
            hint={words.targetHint}
            error={targetInvalid && touched.has('target') ? words.targetInvalid : null}
          >
            {({ id, describedBy, invalid: isInvalid }) => (
              <Input
                id={id}
                aria-describedby={describedBy}
                aria-invalid={isInvalid}
                inputMode="decimal"
                autoComplete="off"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                onBlur={() => touch('target')}
              />
            )}
          </Field>
          {error ? <Notice tone="danger">{error}</Notice> : null}
          <div>
            <Button type="submit" aria-disabled={busy}>
              {busy ? savingLabel : words.save}
            </Button>
          </div>
          <StatusLine said={status} />
        </form>
      )}

      <section
        aria-labelledby={resultId}
        className="flex flex-col gap-3 rounded-md bg-sunk p-4"
        data-testid="calculator-result"
      >
        <h3 id={resultId} className="font-bold">
          {words.resultTitle}
        </h3>
        {/* What changed, said politely as the learner types (WCAG 4.1.3). */}
        <p
          className="sr-only"
          aria-live="polite"
          aria-atomic="true"
          data-testid="calculator-summary"
        >
          {view.summary}
        </p>
        {view.kind === 'result' ? (
          <>
            <div className="flex flex-col gap-1">
              <p>{view.yearMark}</p>
              {view.outstanding ? <p className="text-sm text-muted">{view.outstanding}</p> : null}
            </div>
            <div className="flex flex-col gap-1" data-testid="calculator-dp">
              <p>{view.dp.text}</p>
              {view.dp.conditions.length > 0 ? (
                <>
                  <p className="text-sm">{words.conditionsNote}</p>
                  <ul className="list-disc pl-5 text-sm">
                    {view.dp.conditions.map((c) => (
                      <li key={c}>{c}</li>
                    ))}
                  </ul>
                </>
              ) : null}
            </div>
            <Needed view={view.pass} testId="calculator-pass" />
            {view.target ? (
              <Needed view={view.target} testId="calculator-target" />
            ) : (
              <p className="text-sm text-muted">{words.noTarget}</p>
            )}
            <div className="flex flex-col gap-1" data-testid="calculator-supplementary">
              <h4 className="font-medium">{words.supplementaryTitle}</h4>
              {view.supplementary.map((line) => (
                <p key={line} className="text-sm">
                  {line}
                </p>
              ))}
            </div>
          </>
        ) : (
          <p>{view.summary}</p>
        )}
      </section>
    </section>
  );
}

function Needed({ view, testId }: { view: NeededView; testId: string }) {
  return (
    <div className="flex flex-col gap-1" data-testid={testId}>
      <h4 className="font-medium">{view.title}</h4>
      {view.text ? <p>{view.text}</p> : null}
      {view.readings.map((r) => (
        <div key={r.label} className="flex flex-col gap-0.5">
          <p className="text-sm text-muted">{r.label}</p>
          {r.lines.map((line) => (
            <p key={line} className={line === r.lines[0] ? 'font-medium' : 'text-sm'}>
              {line}
            </p>
          ))}
        </div>
      ))}
    </div>
  );
}
