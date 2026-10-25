import type { ResolvedScheme } from '@universityflow/admissions/client';
import { en } from '@universityflow/content/app';
import {
  calculate,
  calculatorFields,
  calculatorWords,
  initialValues,
  marksFrom,
  type NeededView,
  parseMark,
  type SavedMark,
} from '@universityflow/ui';
import { useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { api, errorMessage } from '../lib/api';
import { theme } from '../lib/theme';
import { Body, Button, Field, Heading, Notice, SectionTitle, useAnnounce } from './ui';

/**
 * The module card's mark calculator in the app (Phase 6c, D11, D13): the same view model as the
 * web's (packages/ui `calculate`), run on the phone by packages/admissions from the scheme the
 * server resolved, so it works with no data. Only "Save my marks" needs the network. What the
 * marks mean is said as they change (a polite live region on Android, an announcement on iOS,
 * A3-02). A mark that isn't one is marked on its field; nothing is worked out until it is fixed.
 * Nothing animates.
 */
export function MarkCalculator({
  scheme,
  initial,
  saveUrl,
  sample,
}: {
  scheme: ResolvedScheme;
  initial: { readonly marks: ReadonlyArray<SavedMark>; readonly target: number | null };
  saveUrl: string;
  sample: boolean;
}) {
  const words = useMemo(() => calculatorWords(), []);
  const { mode, fields, examNotes } = useMemo(
    () => calculatorFields(scheme, words),
    [scheme, words],
  );
  const [values, setValues] = useState<Record<string, string>>(() =>
    initialValues(fields, initial.marks),
  );
  const [target, setTarget] = useState(initial.target === null ? '' : String(initial.target));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const inFlight = useRef(false);

  const view = calculate({ scheme, values, target }, words);
  useAnnounce(view.summary);
  useAnnounce(status);
  const invalid = new Set(view.kind === 'invalid' ? view.invalid : []);
  const targetInvalid = view.kind === 'invalid' && view.targetInvalid;

  async function save() {
    if (view.kind === 'invalid' || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      const own = parseMark(target);
      await api(saveUrl, {
        method: 'PUT',
        json: { marks: marksFrom(fields, values), target: typeof own === 'number' ? own : null },
      });
      setStatus(words.saved);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <View style={styles.wrap} testID="mark-calculator">
      <Heading>{words.title}</Heading>
      <Body pair="cardMuted" small>
        {words.lead}
      </Body>
      {sample ? <Notice tone="warning">{words.sampleMarks}</Notice> : null}
      {mode === 'unknown' ? (
        <Body pair="card">{words.noWeighting}</Body>
      ) : (
        <>
          {fields.map((f) => (
            <Field
              key={f.key}
              label={f.label}
              hint={words.markHint}
              error={invalid.has(f.key) ? words.markInvalid : null}
              keyboardType="decimal-pad"
              value={values[f.key] ?? ''}
              onChangeText={(text) => setValues((v) => ({ ...v, [f.key]: text }))}
              testID={`mark-${f.key}`}
            />
          ))}
          {examNotes.map((note) => (
            <Body key={note} pair="cardMuted" small>
              {note}
            </Body>
          ))}
          <Field
            label={words.targetLabel}
            hint={words.targetHint}
            error={targetInvalid ? words.targetInvalid : null}
            keyboardType="decimal-pad"
            value={target}
            onChangeText={setTarget}
            testID="mark-target"
          />
          {error ? <Notice tone="danger">{error}</Notice> : null}
          <Button
            label={words.save}
            busy={busy}
            busyLabel={en.common.saving}
            onPress={() => void save()}
          />
          {status ? <Body strong>{status}</Body> : null}
        </>
      )}

      <View style={styles.result} accessibilityLiveRegion="polite" testID="calculator-result">
        <SectionTitle pair="sunk">{words.resultTitle}</SectionTitle>
        {view.kind === 'result' ? (
          <>
            <Body pair="sunk">{view.yearMark}</Body>
            {view.outstanding ? (
              <Body pair="sunk" small>
                {view.outstanding}
              </Body>
            ) : null}
            <Body pair="sunk" testID="calculator-dp">
              {view.dp.text}
            </Body>
            {view.dp.conditions.length > 0 ? (
              <>
                <Body pair="sunk" small>
                  {words.conditionsNote}
                </Body>
                {view.dp.conditions.map((c) => (
                  <Body key={c} pair="sunk" small>
                    {`• ${c}`}
                  </Body>
                ))}
              </>
            ) : null}
            <Needed view={view.pass} testID="calculator-pass" />
            {view.target ? (
              <Needed view={view.target} testID="calculator-target" />
            ) : (
              <Body pair="sunk" small>
                {words.noTarget}
              </Body>
            )}
            <SectionTitle pair="sunk">{words.supplementaryTitle}</SectionTitle>
            {view.supplementary.map((line) => (
              <Body key={line} pair="sunk" small>
                {line}
              </Body>
            ))}
          </>
        ) : (
          <Body pair="sunk" testID="calculator-summary">
            {view.summary}
          </Body>
        )}
      </View>
    </View>
  );
}

function Needed({ view, testID }: { view: NeededView; testID: string }) {
  return (
    <View style={styles.needed} testID={testID}>
      <Body pair="sunk" strong>
        {view.title}
      </Body>
      {view.text ? <Body pair="sunk">{view.text}</Body> : null}
      {view.readings.map((r) => (
        <View key={r.label} style={styles.needed}>
          <Body pair="sunk" small>
            {r.label}
          </Body>
          {r.lines.map((line, i) => (
            <Body key={line} pair="sunk" strong={i === 0} small={i > 0}>
              {line}
            </Body>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: theme.space['3'] },
  result: {
    gap: theme.space['2'],
    padding: theme.space['3'],
    borderRadius: theme.radius.md,
    backgroundColor: theme.color.surfaceSunk,
  },
  needed: { gap: theme.space['1'] },
});
