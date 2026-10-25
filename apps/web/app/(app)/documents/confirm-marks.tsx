'use client';

import {
  defaultReportKind,
  REPORT_KINDS,
  type ReportKind,
  SUBJECTS,
  type SubjectId,
} from '@universityflow/catalogue/client';
import { common, confirm as confirmCopy, documents, reportKinds } from '@universityflow/content';
import type { DraftIssue, ReportDraft } from '@universityflow/documents';
import { type FormEvent, useState } from 'react';
import { Button, Notice, Page, Select } from '@/components/ui';
import { api, errorMessage } from '@/lib/client/api';

interface Row {
  key: number;
  nameAsPrinted: string | null;
  subject: SubjectId | '';
  percent: string;
  issue: DraftIssue | null;
}

const subjectName = (id: SubjectId | '') =>
  id ? (SUBJECTS.find((s) => s.id === id)?.name ?? null) : null;

/**
 * Hard rule 6: every value read from a document is shown back and confirmed, row by row, before
 * any calculation uses it. The learner can fix, add or remove any row.
 */
export function ConfirmMarks(props: {
  documentId: string | null;
  draft: ReportDraft | null;
  sample: boolean;
  /** The learner's grade: the report picker starts on its report (G10-1). */
  grade?: number | null;
  /** Today, for the picker's start (A1-35); the browser's clock unless a test sets it. */
  today?: Date;
  /** `offersToCheck`: offers the final results were just checked against (Phase 5a). */
  onSaved: (result: { offersToCheck: number }) => void;
  onCancel: () => void;
}) {
  let next = 0;
  const [rows, setRows] = useState<Row[]>(() =>
    props.draft
      ? props.draft.rows.map((r) => ({
          key: next++,
          nameAsPrinted: r.nameAsPrinted,
          subject: r.subject ?? '',
          percent: r.percent === null ? '' : String(r.percent),
          issue: r.issue,
        }))
      : Array.from({ length: 7 }, () => ({
          key: next++,
          nameAsPrinted: null,
          subject: '',
          percent: '',
          issue: null,
        })),
  );
  // The report the document prints, else the newest final one the learner holds (A1-35).
  const [kind, setKind] = useState<ReportKind>(
    () =>
      props.draft?.printedKind ?? defaultReportKind(props.grade ?? null, props.today ?? new Date()),
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const update = (key: number, patch: Partial<Row>) =>
    setRows((list) => list.map((r) => (r.key === key ? { ...r, ...patch, issue: null } : r)));

  const filled = rows.filter((r) => r.subject || r.percent);
  const valid =
    filled.length > 0 &&
    filled.every((r) => r.subject && /^\d{1,3}$/.test(r.percent) && Number(r.percent) <= 100) &&
    new Set(filled.map((r) => r.subject)).size === filled.length;

  async function confirm(event: FormEvent) {
    event.preventDefault();
    if (!valid) {
      setError(
        new Set(filled.map((r) => r.subject)).size !== filled.length
          ? confirmCopy.errors.duplicate
          : confirmCopy.errors.invalid,
      );
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const saved = await api<{ offersToCheck?: number }>('/api/reports', {
        method: 'POST',
        json: {
          kind,
          documentId: props.documentId,
          marks: filled.map((r) => ({ subject: r.subject, percent: Number(r.percent) })),
        },
      });
      props.onSaved({ offersToCheck: saved.offersToCheck ?? 0 });
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  return (
    <Page
      title={props.draft ? confirmCopy.title : confirmCopy.manualTitle}
      lead={props.draft ? confirmCopy.lead : confirmCopy.manualLead}
    >
      <form onSubmit={confirm} className="flex flex-col gap-5" noValidate>
        {props.sample ? <Notice tone="warning">{confirmCopy.sampleLead}</Notice> : null}
        {props.draft?.warnings.map((w) => (
          <Notice key={w} tone="warning">
            {confirmCopy.warnings[w]}
          </Notice>
        ))}
        <div className="flex flex-col gap-1">
          <label htmlFor="report-kind" className="font-medium">
            {documents.kind}
          </label>
          <Select
            id="report-kind"
            value={kind}
            onChange={(e) => setKind(e.target.value as ReportKind)}
          >
            {REPORT_KINDS.map((k) => (
              <option key={k} value={k}>
                {reportKinds[k]}
              </option>
            ))}
          </Select>
        </div>
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-2 font-medium">{confirmCopy.subject}</legend>
          {rows.map((row, index) => {
            const subjectWrong = row.issue === 'unknown-subject' || row.issue === 'duplicate';
            const percentWrong = row.issue === 'missing-percent' || row.issue === 'out-of-range';
            const issueId = `issue-${row.key}`;
            return (
              <div key={row.key} className="flex flex-col gap-2 rounded-md bg-surface p-3">
                {row.nameAsPrinted ? (
                  <p className="text-sm text-muted">{confirmCopy.asPrinted(row.nameAsPrinted)}</p>
                ) : null}
                <div className="flex flex-wrap items-end gap-2">
                  <div className="flex min-w-48 flex-1 flex-col gap-1">
                    <label htmlFor={`subject-${row.key}`} className="sr-only">
                      {confirmCopy.subjectNumber(index + 1)}
                    </label>
                    <Select
                      id={`subject-${row.key}`}
                      value={row.subject}
                      aria-invalid={subjectWrong}
                      aria-describedby={subjectWrong ? issueId : undefined}
                      onChange={(e) => update(row.key, { subject: e.target.value as SubjectId })}
                    >
                      <option value="">{confirmCopy.chooseSubject}</option>
                      {SUBJECTS.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="flex w-28 flex-col gap-1">
                    <label htmlFor={`percent-${row.key}`} className="text-sm">
                      {confirmCopy.percent}
                    </label>
                    <input
                      id={`percent-${row.key}`}
                      className="min-h-11 rounded-md border-thick border-line-strong bg-surface px-3 aria-[invalid=true]:border-danger"
                      inputMode="numeric"
                      maxLength={3}
                      value={row.percent}
                      // "Mark (%)" on every row doesn't say which subject a field is for (A3-03).
                      aria-label={confirmCopy.percentFor(
                        subjectName(row.subject) ?? confirmCopy.subjectNumber(index + 1),
                      )}
                      aria-invalid={percentWrong}
                      aria-describedby={percentWrong ? issueId : undefined}
                      onChange={(e) =>
                        update(row.key, { percent: e.target.value.replace(/\D/g, '') })
                      }
                    />
                  </div>
                  <Button
                    variant="quiet"
                    onClick={() => setRows((list) => list.filter((r) => r.key !== row.key))}
                    aria-label={`${confirmCopy.removeRow} ${index + 1}`}
                  >
                    {common.remove}
                  </Button>
                </div>
                {row.issue ? (
                  <p id={issueId} className="text-sm font-medium text-danger">
                    {confirmCopy.issues[row.issue]}
                  </p>
                ) : null}
              </div>
            );
          })}
        </fieldset>
        <Button
          variant="secondary"
          className="self-start"
          onClick={() =>
            setRows((list) => [
              ...list,
              {
                key: Math.max(0, ...list.map((r) => r.key)) + 1,
                nameAsPrinted: null,
                subject: '',
                percent: '',
                issue: null,
              },
            ])
          }
        >
          {confirmCopy.addRow}
        </Button>
        {error ? <Notice tone="danger">{error}</Notice> : null}
        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={busy}>
            {busy ? common.saving : confirmCopy.confirm}
          </Button>
          <Button variant="quiet" onClick={props.onCancel}>
            {common.cancel}
          </Button>
        </div>
      </form>
    </Page>
  );
}
