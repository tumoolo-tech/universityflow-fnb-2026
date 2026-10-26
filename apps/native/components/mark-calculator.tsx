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
import { useEffect, useMemo, useRef, useState } from 'react';
import { type KeyboardTypeOptions, Platform, StyleSheet, View } from 'react-native';
import { api, errorMessage } from '../lib/api';
import { theme } from '../lib/theme';
import { announce, Body, Button, Field, Heading, Notice, SectionTitle, useAnnounce } from './ui';

/**
 * A mark field's keyboard: one that can type "/" for a score like "18/24" (A7-24). The decimal
 * pad has no "/" on iOS or on most Android phones. iOS's numbers-and-punctuation keyboard opens on
 * the digits with "/" beside them; Android has no such keyboard, so the default one.
 */
export function markKeyboard(os: string): KeyboardTypeOptions {
  return os === 'ios' ? 'numbers-and-punctuation' : 'default';
}

/** How long the marks must stay unchanged before what they mean is said (A7-25). */
export const MARK_ANNOUNCE_DELAY_MS = 800;

/**
 * Says what the marks mean once typing stops, on one channel on both platforms: an announcement
 * (A3-02), never as well a live region, which TalkBack would read a second time (A7-25). Nothing on
 * opening the card: only a change the learner made.
 */
function useSettledAnnounce(text: string) {
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const timer = setTimeout(() => announce(text), MARK_ANNOUNCE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [text]);
}

/**
 * The module card's mark calculator in the app (Phase 6c, D11, D13): the same view model as the
 * web's (packages/ui `calculate`), run on the phone by packages/admissions from the scheme the
 * server resolved, so it works with no data. Only "Save my marks" needs the network. What the
 * marks mean is said once typing stops (`useSettledAnnounce`). A mark that isn't one is marked on
 * its field; nothing is worked out until it is fixed. Nothing animates.
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
  useSettledAnnounce(view.summary);
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
              keyboardType={markKeyboard(Platform.OS)}
              autoCorrect={false}
              autoCapitalize="none"
              spellCheck={false}
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

      <View style={styles.result} testID="calculator-result">
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
    // A panel in its card: the sunk fill and the card edge (RT-04).
    ...theme.panel,
  },
  needed: { gap: theme.space['1'] },
});
