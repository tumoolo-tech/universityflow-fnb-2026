import { en } from '@universityflow/content/app';
import type { OfferCardArtifact } from '@universityflow/ui';
import { useRef, useState } from 'react';
import { View } from 'react-native';
import { isDate, typedDate } from '../lib/date-input';
import { theme } from '../lib/theme';
import type { ConfirmedOffer, LetterDraft, OffersResponse } from '../lib/types';
import { CourseChooser } from './course-chooser';
import { Body, Button, Card, Field, Heading, Notice, PageHeader, Radio, RadioGroup } from './ui';

/**
 * Hard rule 6 for an offer letter, in the app: the course, the kind of offer, the date to reply by
 * and every condition are shown back and confirmed before anything is saved, exactly as on the web
 * (apps/web, offers-view.tsx) and through the same API (POST /api/offers). The course is always
 * the learner's choice from the catalogue: the letter's matches are only offered first (A1-29).
 * The conditions stay in the letter's order; the learner can fix, add or remove any of them.
 * Nothing is sent until they confirm, and only a final offer is ever called one (§8.5).
 */

type Kind = OfferCardArtifact['offerKind'];
const KINDS: ReadonlyArray<Kind> = ['provisional', 'conditional', 'final', 'waitlist'];
/** As packages/documents' MAX_CONDITIONS and MAX_CONDITION_LENGTH. */
const MAX_CONDITIONS = 20;
const MAX_CONDITION_LENGTH = 500;

interface Row {
  readonly key: number;
  readonly text: string;
}

export function ConfirmLetter(props: {
  letter: LetterDraft;
  candidates: ReadonlyArray<string>;
  sample: boolean;
  options: OffersResponse['options'];
  busy: boolean;
  error: string | null;
  onConfirm: (offer: Omit<ConfirmedOffer, 'documentId'>) => void;
  onCancel: () => void;
}) {
  const { letter } = props;
  const t = en.offers;
  const next = useRef(letter.conditions.length);
  const [programmeId, setProgrammeId] = useState<string | null>(null);
  const [kind, setKind] = useState<Kind | null>(letter.kind);
  const [replyBy, setReplyBy] = useState(letter.replyBy ?? '');
  const [rows, setRows] = useState<Row[]>(() =>
    letter.conditions.map((text, key) => ({ key, text })),
  );
  const [tried, setTried] = useState(false);
  const [replyByError, setReplyByError] = useState<string | null>(null);

  function confirm() {
    if (props.busy) return;
    setTried(true);
    const date = replyBy.trim();
    const dateOk = date === '' || isDate(date);
    setReplyByError(dateOk ? null : t.replyByInvalid);
    if (!programmeId || !kind || !dateOk) return;
    props.onConfirm({
      programmeId,
      kind,
      replyBy: date || null,
      conditions: rows.map((r) => r.text.trim()).filter((c) => c !== ''),
    });
  }

  return (
    <View style={{ gap: theme.space['4'] }} testID="confirm-letter">
      <PageHeader title={t.letterTitle} lead={t.letterLead} />
      {props.sample ? <Notice tone="warning">{t.sampleLead}</Notice> : null}
      {letter.warnings.map((w) => (
        <Notice key={w} tone="warning">
          {t.letterWarnings[w]}
        </Notice>
      ))}

      <Card>
        {letter.programmeAsPrinted ? (
          <Body pair="cardMuted" small>
            {t.asPrinted(letter.programmeAsPrinted)}
          </Body>
        ) : null}
        <CourseChooser
          label={t.whichCourse}
          hint={props.candidates.length === 0 ? t.noCandidates : null}
          options={props.options}
          candidates={props.candidates}
          value={programmeId}
          onChange={setProgrammeId}
          error={tried && !programmeId ? t.missingCourse : null}
        />
      </Card>

      <Card>
        <RadioGroup label={t.kind} pair="card">
          <Body pair="cardMuted" small>
            {t.kindHint}
          </Body>
          {KINDS.map((k) => (
            <Radio
              key={k}
              label={t.kinds[k]}
              selected={kind === k}
              onPress={() => setKind(k)}
              testID={`kind-${k}`}
            />
          ))}
        </RadioGroup>
        {/* What the chosen kind means, in plain words: only `final` says it is a place. */}
        {kind ? (
          <Body pair="card" testID="letter-kind-explain">
            {t.explain[kind]}
          </Body>
        ) : null}
        {tried && !kind ? <Notice tone="danger">{t.missingKind}</Notice> : null}
      </Card>

      <Card>
        <Field
          label={t.replyByLabel}
          hint={t.replyByFormat}
          error={replyByError}
          value={replyBy}
          onChangeText={(text) => setReplyBy(typedDate(text))}
          keyboardType="number-pad"
          maxLength={10}
          testID="reply-by"
        />
      </Card>

      <Heading pair="page">{t.conditionsTitle}</Heading>
      {rows.map((row, index) => (
        <Card key={row.key} testID={`condition-row-${index}`}>
          <Field
            label={t.condition(index + 1)}
            value={row.text}
            maxLength={MAX_CONDITION_LENGTH}
            multiline
            onChangeText={(text) =>
              setRows((list) => list.map((r) => (r.key === row.key ? { ...r, text } : r)))
            }
            testID={`condition-${index}`}
          />
          <Button
            variant="quiet"
            label={t.removeCondition(index + 1)}
            onPress={() => setRows((list) => list.filter((r) => r.key !== row.key))}
          />
        </Card>
      ))}
      {rows.length < MAX_CONDITIONS ? (
        <Button
          variant="secondary"
          label={t.addCondition}
          onPress={() => setRows((list) => [...list, { key: next.current++, text: '' }])}
        />
      ) : null}

      {props.error ? <Notice tone="danger">{props.error}</Notice> : null}
      <Button label={t.confirm} busy={props.busy} busyLabel={en.common.saving} onPress={confirm} />
      <Button variant="quiet" label={en.common.cancel} onPress={props.onCancel} />
    </View>
  );
}
