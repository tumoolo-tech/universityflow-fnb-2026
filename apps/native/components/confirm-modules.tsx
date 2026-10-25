import { MODULE_TERMS, type ModuleTerm } from '@universityflow/catalogue/client';
import { en } from '@universityflow/content/app';
import { useRef, useState } from 'react';
import { View } from 'react-native';
import { theme } from '../lib/theme';
import type { ConfirmedRegistration, RegistrationDraft, RegistrationResponse } from '../lib/types';
import { Body, Button, Card, Field, Heading, Notice, PageHeader, Radio, RadioGroup } from './ui';

/**
 * Hard rule 6 for a proof of registration, in the app: the course, the year and every module row
 * are shown back and confirmed before anything is compared, exactly as on the web (apps/web,
 * modules-view.tsx) and through the same API (PUT /api/registration). The learner can fix, add or
 * remove any row. Nothing is sent until the form is valid and they confirm it.
 */

const m = en.modules;
/** As packages/documents' MODULE_CODE: what a curriculum can be compared with. */
export const MODULE_CODE = /^[A-Za-z0-9][A-Za-z0-9 \-/.]{1,23}$/;
const MAX_MODULES = 40;
const MAX_OPTIONS = 20;
const YEARS_OF_STUDY = [1, 2, 3, 4, 5, 6] as const;

interface Row {
  readonly key: number;
  readonly code: string;
  readonly name: string;
  readonly term: ModuleTerm | null;
  readonly termAsPrinted: string | null;
  readonly credits: string;
}

const blankRow = (key: number): Row => ({
  key,
  code: '',
  name: '',
  term: null,
  termAsPrinted: null,
  credits: '',
});

export function ConfirmModules(props: {
  /** Null when the learner types their modules in. */
  documentId: string | null;
  draft: RegistrationDraft | null;
  sample: boolean;
  data: RegistrationResponse;
  busy: boolean;
  error: string | null;
  onConfirm: (registration: Omit<ConfirmedRegistration, 'documentId'>) => void;
  onCancel: () => void;
}) {
  const { draft, data } = props;
  const next = useRef(0);
  const [rows, setRows] = useState<Row[]>(() =>
    draft && draft.modules.length > 0
      ? draft.modules.map((d) => ({
          key: next.current++,
          code: d.code,
          name: d.name ?? '',
          term: d.term,
          termAsPrinted: d.termAsPrinted,
          credits: d.credits === null ? '' : String(d.credits),
        }))
      : [blankRow(next.current++)],
  );
  const [programmeId, setProgrammeId] = useState<string | null>(data.acceptedProgrammeId);
  const [choosing, setChoosing] = useState(false);
  const [query, setQuery] = useState('');
  const [year, setYear] = useState(data.defaultYear);
  const [yearOfStudy, setYearOfStudy] = useState<number | null>(draft?.yearOfStudy ?? null);
  const [picking, setPicking] = useState<number | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [tried, setTried] = useState(false);

  const update = (key: number, patch: Partial<Row>) =>
    setRows((list) => list.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const options = data.options
    .filter((o) => words.every((w) => `${o.universityName} ${o.name}`.toLowerCase().includes(w)))
    .slice(0, MAX_OPTIONS);
  const chosen = data.options.find((o) => o.id === programmeId) ?? null;
  const years = [data.defaultYear - 1, data.defaultYear, data.defaultYear + 1];
  const invalid = (row: Row) => row.code.trim() !== '' && !MODULE_CODE.test(row.code.trim());

  function confirm() {
    if (props.busy) return;
    setTried(true);
    const filled = rows.filter((r) => r.code.trim() !== '');
    if (!chosen) {
      setProblem(m.chooseProgramme);
      return;
    }
    if (filled.length === 0) {
      setProblem(m.needOneModule);
      return;
    }
    if (filled.some(invalid)) {
      setProblem(m.invalidCode);
      return;
    }
    setProblem(null);
    props.onConfirm({
      programmeId: chosen.id,
      academicYear: year,
      yearOfStudy,
      modules: filled.map((r) => ({
        code: r.code.trim(),
        name: r.name.trim() === '' ? null : r.name.trim(),
        term: r.term,
        credits: r.credits === '' ? null : Number(r.credits),
      })),
    });
  }

  return (
    <View style={{ gap: theme.space['4'] }} testID="confirm-modules">
      <PageHeader title={m.confirmTitle} lead={props.documentId ? m.confirmLead : m.typeLead} />
      {props.sample ? <Notice tone="warning">{m.sampleLead}</Notice> : null}
      {draft?.warnings.map((w) => (
        <Notice key={w} tone="warning">
          {m.warnings[w]}
        </Notice>
      ))}

      <Card>
        <Heading>{m.programme}</Heading>
        <Body pair="cardMuted" small>
          {m.programmeHint}
        </Body>
        {draft?.programmeCode ? (
          <Body pair="cardMuted" small>
            {m.programmeCodeAsPrinted(draft.programmeCode)}
          </Body>
        ) : null}
        {chosen && !choosing ? (
          <>
            <Body pair="card" strong testID="chosen-programme">
              {`${chosen.universityName}: ${chosen.name}`}
            </Body>
            <Button
              label={en.offers.changeCourse}
              variant="quiet"
              onPress={() => setChoosing(true)}
            />
          </>
        ) : choosing ? (
          <View style={{ gap: theme.space['2'] }} testID="programme-chooser">
            <Field
              label={m.chooseProgramme}
              hint={en.goals.chooseHint}
              value={query}
              onChangeText={setQuery}
              autoCapitalize="none"
              autoCorrect={false}
              spellCheck={false}
              testID="programme-search"
            />
            {options.map((o) => (
              <Button
                key={o.id}
                variant="secondary"
                label={`${o.universityName}: ${o.name}`}
                onPress={() => {
                  setProgrammeId(o.id);
                  setChoosing(false);
                  setQuery('');
                }}
              />
            ))}
            <Button label={en.common.cancel} variant="quiet" onPress={() => setChoosing(false)} />
          </View>
        ) : (
          <Button label={m.chooseProgramme} variant="secondary" onPress={() => setChoosing(true)} />
        )}
      </Card>

      <Card>
        <RadioGroup label={m.academicYear} pair="card">
          {years.map((y) => (
            <Radio
              key={y}
              label={String(y)}
              selected={year === y}
              onPress={() => setYear(y)}
              testID={`year-${y}`}
            />
          ))}
        </RadioGroup>
        <RadioGroup label={m.yearOfStudy} pair="card">
          <Radio
            label={m.notSure}
            selected={yearOfStudy === null}
            onPress={() => setYearOfStudy(null)}
          />
          {YEARS_OF_STUDY.map((y) => (
            <Radio
              key={y}
              label={String(y)}
              selected={yearOfStudy === y}
              onPress={() => setYearOfStudy(y)}
              testID={`year-of-study-${y}`}
            />
          ))}
        </RadioGroup>
      </Card>

      <Heading pair="page">{m.registeredTitle}</Heading>
      {rows.map((row, index) => {
        const n = index + 1;
        return (
          <Card key={row.key} testID={`module-row-${index}`}>
            <Field
              label={m.moduleCode(n)}
              value={row.code}
              maxLength={24}
              autoCapitalize="characters"
              // A code is never "corrected": "ECO 1A" must stay as printed (A7-15).
              autoCorrect={false}
              spellCheck={false}
              error={tried && invalid(row) ? m.invalidCode : null}
              onChangeText={(text) => update(row.key, { code: text })}
              testID={`code-${index}`}
            />
            <Field
              label={m.moduleName(n)}
              value={row.name}
              maxLength={160}
              onChangeText={(text) => update(row.key, { name: text })}
              testID={`name-${index}`}
            />
            <Body pair="card" strong>
              {m.moduleTerm(n)}
            </Body>
            {row.termAsPrinted ? (
              <Body pair="cardMuted" small>
                {m.termAsPrinted(row.termAsPrinted)}
              </Body>
            ) : null}
            <Button
              variant="secondary"
              label={row.term ? m.terms[row.term] : m.notSure}
              accessibilityLabel={`${row.term ? m.terms[row.term] : m.notSure}, ${m.moduleTerm(n)}`}
              expanded={picking === row.key}
              testID={`term-${index}`}
              onPress={() => setPicking(picking === row.key ? null : row.key)}
            />
            {picking === row.key ? (
              <RadioGroup label={m.moduleTerm(n)} pair="card">
                {[null, ...MODULE_TERMS].map((t) => (
                  <Radio
                    key={t ?? 'not-sure'}
                    label={t ? m.terms[t] : m.notSure}
                    selected={row.term === t}
                    onPress={() => {
                      update(row.key, { term: t });
                      setPicking(null);
                    }}
                  />
                ))}
              </RadioGroup>
            ) : null}
            <Field
              label={m.moduleCredits(n)}
              value={row.credits}
              keyboardType="number-pad"
              maxLength={3}
              onChangeText={(text) => update(row.key, { credits: text.replace(/\D/g, '') })}
              testID={`credits-${index}`}
            />
            <Button
              variant="quiet"
              label={m.removeModule(n)}
              onPress={() => setRows((list) => list.filter((r) => r.key !== row.key))}
            />
          </Card>
        );
      })}
      {rows.length < MAX_MODULES ? (
        <Button
          variant="secondary"
          label={m.addModule}
          onPress={() => setRows((list) => [...list, blankRow(next.current++)])}
        />
      ) : null}

      {props.error ? <Notice tone="danger">{props.error}</Notice> : null}
      {problem ? <Notice tone="danger">{problem}</Notice> : null}
      <Button label={m.confirm} busy={props.busy} busyLabel={en.common.saving} onPress={confirm} />
      <Button variant="quiet" label={en.common.cancel} onPress={props.onCancel} />
    </View>
  );
}
