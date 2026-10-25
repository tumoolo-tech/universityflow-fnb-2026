import {
  defaultReportKind,
  isReportKind,
  REPORT_KINDS,
  type ReportKind,
  SUBJECTS,
} from '@universityflow/catalogue/client';
import { en } from '@universityflow/content/app';
import { useRef, useState } from 'react';
import { View } from 'react-native';
import { api, errorMessage } from '../lib/api';
import { theme } from '../lib/theme';
import type { DraftIssue, ReportDraft } from '../lib/types';
import { Body, Button, Card, Field, Heading, Notice, PageHeader, Radio, RadioGroup } from './ui';

/**
 * Hard rule 6, in the app: every value read from a report is shown back and confirmed, row by
 * row, before any calculation uses it, exactly as on the web (apps/web, confirm-marks.tsx) and
 * through the same API (POST /api/reports). The learner can fix, add or remove any row. Nothing
 * is sent until they say the marks are correct.
 */

interface Row {
  readonly key: number;
  readonly nameAsPrinted: string | null;
  readonly subject: string;
  readonly percent: string;
  readonly issue: DraftIssue | null;
}

const subjectName = (id: string) => SUBJECTS.find((s) => s.id === id)?.name ?? id;

export function ConfirmMarks(props: {
  documentId: string | null;
  draft: ReportDraft | null;
  sample: boolean;
  /** The learner's grade: the report picker starts on its report (G10-1). */
  grade?: number | null;
  /** Today, for the picker's start (A1-35); the phone's clock unless a test sets it. */
  today?: Date;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const next = useRef(0);
  const [rows, setRows] = useState<Row[]>(() =>
    props.draft
      ? props.draft.rows.map((r) => ({
          key: next.current++,
          nameAsPrinted: r.nameAsPrinted,
          subject: r.subject ?? '',
          percent: r.percent === null ? '' : String(r.percent),
          issue: r.issue,
        }))
      : Array.from({ length: 7 }, () => ({
          key: next.current++,
          nameAsPrinted: null,
          subject: '',
          percent: '',
          issue: null,
        })),
  );
  // The report the document prints, else the newest final one the learner holds (A1-35).
  const [kind, setKind] = useState<ReportKind>(() => {
    const printed = props.draft?.printedKind;
    return isReportKind(printed)
      ? printed
      : defaultReportKind(props.grade ?? null, props.today ?? new Date());
  });
  const [picking, setPicking] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const update = (key: number, patch: Partial<Row>) =>
    setRows((list) => list.map((r) => (r.key === key ? { ...r, ...patch, issue: null } : r)));

  const filled = rows.filter((r) => r.subject || r.percent);
  const duplicate = new Set(filled.map((r) => r.subject)).size !== filled.length;
  const valid =
    filled.length > 0 &&
    !duplicate &&
    filled.every((r) => r.subject && /^\d{1,3}$/.test(r.percent) && Number(r.percent) <= 100);

  async function confirm() {
    if (!valid) {
      setError(duplicate ? en.confirm.errors.duplicate : en.confirm.errors.invalid);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api('/api/reports', {
        method: 'POST',
        json: {
          kind,
          documentId: props.documentId,
          marks: filled.map((r) => ({ subject: r.subject, percent: Number(r.percent) })),
        },
      });
      props.onSaved();
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  const matches = SUBJECTS.filter((s) =>
    s.name.toLowerCase().includes(search.trim().toLowerCase()),
  ).slice(0, 8);

  return (
    <View style={{ gap: theme.space['4'] }} testID="confirm-marks">
      <PageHeader
        title={props.draft ? en.confirm.title : en.confirm.manualTitle}
        lead={props.draft ? en.confirm.lead : en.confirm.manualLead}
      />
      {props.sample ? <Notice tone="warning">{en.confirm.sampleLead}</Notice> : null}
      {props.draft?.warnings.map((w) => (
        <Notice key={w} tone="warning">
          {en.confirm.warnings[w]}
        </Notice>
      ))}

      <Card>
        <RadioGroup label={en.documents.kind} pair="card">
          {REPORT_KINDS.map((k) => (
            <Radio
              key={k}
              label={en.reportKinds[k]}
              selected={kind === k}
              onPress={() => setKind(k)}
            />
          ))}
        </RadioGroup>
      </Card>

      <Heading pair="page">{en.confirm.subject}</Heading>
      {rows.map((row, index) => (
        <Card key={row.key} testID={`mark-row-${index}`}>
          {row.nameAsPrinted ? (
            <Body pair="cardMuted" small>
              {en.confirm.asPrinted(row.nameAsPrinted)}
            </Body>
          ) : null}
          <Button
            variant="secondary"
            label={row.subject ? subjectName(row.subject) : en.confirm.chooseSubject}
            // A subject the reader got wrong is said with the button, not only beside it.
            hint={[
              en.confirm.subjectNumber(index + 1),
              row.issue === 'unknown-subject' || row.issue === 'duplicate'
                ? en.confirm.issues[row.issue]
                : null,
            ]
              .filter(Boolean)
              .join(' ')}
            expanded={picking === row.key}
            testID={`subject-${index}`}
            onPress={() => {
              setSearch('');
              setPicking(picking === row.key ? null : row.key);
            }}
          />
          {picking === row.key ? (
            <View style={{ gap: theme.space['2'] }}>
              <Field
                label={en.confirm.chooseSubject}
                value={search}
                onChangeText={setSearch}
                autoCapitalize="none"
                testID={`subject-search-${index}`}
              />
              {matches.map((s) => (
                <Button
                  key={s.id}
                  variant="quiet"
                  label={s.name}
                  onPress={() => {
                    update(row.key, { subject: s.id });
                    setPicking(null);
                  }}
                />
              ))}
            </View>
          ) : null}
          <Field
            label={en.confirm.percent}
            // Which subject this mark is for, not "Mark (%)" on every row (A3-03).
            accessibilityLabel={en.confirm.percentFor(
              row.subject ? subjectName(row.subject) : en.confirm.subjectNumber(index + 1),
            )}
            value={row.percent}
            keyboardType="number-pad"
            maxLength={3}
            testID={`percent-${index}`}
            error={
              row.issue === 'missing-percent' || row.issue === 'out-of-range'
                ? en.confirm.issues[row.issue]
                : null
            }
            onChangeText={(text) => update(row.key, { percent: text.replace(/\D/g, '') })}
          />
          {row.issue === 'unknown-subject' || row.issue === 'duplicate' ? (
            <Notice tone="danger">{en.confirm.issues[row.issue]}</Notice>
          ) : null}
          <Button
            variant="quiet"
            label={en.common.remove}
            hint={`${en.confirm.removeRow} ${index + 1}`}
            onPress={() => setRows((list) => list.filter((r) => r.key !== row.key))}
          />
        </Card>
      ))}
      <Button
        variant="secondary"
        label={en.confirm.addRow}
        onPress={() =>
          setRows((list) => [
            ...list,
            { key: next.current++, nameAsPrinted: null, subject: '', percent: '', issue: null },
          ])
        }
      />
      {error ? <Notice tone="danger">{error}</Notice> : null}
      <Button
        label={en.confirm.confirm}
        busy={busy}
        busyLabel={en.common.saving}
        onPress={() => void confirm()}
      />
      <Button variant="quiet" label={en.common.cancel} onPress={props.onCancel} />
    </View>
  );
}
