import { en } from '@universityflow/content/app';
import type { OfferCardArtifact } from '@universityflow/ui';
import { Stack } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ConfirmLetter } from '../components/confirm-letter';
import { CourseChooser } from '../components/course-chooser';
import { OfferCardView } from '../components/offer-card';
import {
  announce,
  Body,
  Button,
  Card,
  EmptyState,
  Field,
  Heading,
  Notice,
  PageHeader,
  Radio,
  RadioGroup,
  Screen,
  useAnnounce,
} from '../components/ui';
import { api, errorMessage } from '../lib/api';
import { isDate, typedDate } from '../lib/date-input';
import type { ConfirmedOffer, LetterUploadResult, OffersResponse } from '../lib/types';
import {
  choosePdf,
  choosePhoto,
  type PickedFile,
  takePhoto,
  uploadAcceptanceLetter,
} from '../lib/upload';

/**
 * My offers in the app (Phase 5a): every offer as a card (accept one, decline, remove), "I got
 * an offer" in the learner's own words, or the offer letter by camera, gallery or PDF (Phase 4d's
 * upload flow, lib/upload.ts), read into a draft they check field by field before anything is
 * saved (hard rule 6, A1-33). The same API and the same server code as the web page.
 */

type Kind = OfferCardArtifact['offerKind'];
const KINDS: ReadonlyArray<Kind> = ['provisional', 'conditional', 'final', 'waitlist'];

/** A letter read into a draft, waiting for the learner to check it. */
type Letter = LetterUploadResult & { readonly letter: NonNullable<LetterUploadResult['letter']> };

export default function OffersScreen() {
  const [data, setData] = useState<OffersResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [letter, setLetter] = useState<Letter | null>(null);
  const [programmeId, setProgrammeId] = useState<string | null>(null);
  const [kind, setKind] = useState<Kind | null>(null);
  const [replyBy, setReplyBy] = useState('');
  const [replyByError, setReplyByError] = useState<string | null>(null);
  const t = en.offers;
  // Outcomes are said on iOS too, not only through Android's live region (A3-02).
  useAnnounce(status);

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await api<OffersResponse>('/api/offers'));
    } catch (e) {
      setError(errorMessage(e));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /** One request at a time: a press while one runs does nothing (A3-01). */
  const inFlight = useRef(false);
  async function run<T>(call: () => Promise<T>, apply: (value: T) => void, done: string | null) {
    if (inFlight.current) return false;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      apply(await call());
      setStatus(done);
      return true;
    } catch (e) {
      setError(errorMessage(e));
      return false;
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  const post = (offer: ConfirmedOffer) =>
    run(
      () => api<OffersResponse>('/api/offers', { method: 'POST', json: offer }),
      setData,
      t.added,
    );

  async function pick(from: () => Promise<PickedFile | 'denied' | null>) {
    if (inFlight.current) return;
    setError(null);
    setStatus(null);
    const picked = await from();
    if (picked === 'denied') {
      setError(en.documents.cameraDenied);
      return;
    }
    if (!picked) return;
    await run(
      () => uploadAcceptanceLetter(picked),
      (result) => {
        if (!result.letter) {
          setError(t.unreadable);
          return;
        }
        // The screen changes under a VoiceOver user's finger: say where they are now (A3-02).
        announce(t.letterTitle);
        setLetter({ ...result, letter: result.letter });
      },
      null,
    );
  }

  const header = <Stack.Screen options={{ title: t.title }} />;

  if (!data) {
    return (
      <Screen belowHeader>
        {header}
        <PageHeader title={t.title} />
        {error ? (
          <>
            <Notice tone="danger">{error}</Notice>
            <Button label={en.common.tryAgain} onPress={() => void load()} />
          </>
        ) : (
          <Body>{en.common.loading}</Body>
        )}
      </Screen>
    );
  }

  if (letter) {
    return (
      <Screen belowHeader>
        {header}
        <ConfirmLetter
          key={letter.documentId}
          letter={letter.letter}
          candidates={letter.candidates}
          sample={letter.sample}
          options={data.options}
          busy={busy}
          error={error}
          onConfirm={async (offer) => {
            if (await post({ ...offer, documentId: letter.documentId })) setLetter(null);
          }}
          onCancel={() => {
            setLetter(null);
            setError(null);
            announce(t.title);
          }}
        />
      </Screen>
    );
  }

  const accepted = data.offers.some((o) => o.status === 'accepted');
  const missing = [...(programmeId ? [] : [t.missingCourse]), ...(kind ? [] : [t.missingKind])];

  const save = async () => {
    if (!programmeId || !kind || busy) return;
    const date = replyBy.trim();
    if (date !== '' && !isDate(date)) {
      setReplyByError(t.replyByInvalid);
      return;
    }
    setReplyByError(null);
    const saved = await post({ programmeId, kind, replyBy: date || null, conditions: [] });
    if (saved) {
      setProgrammeId(null);
      setKind(null);
      setReplyBy('');
    }
  };

  return (
    <Screen belowHeader>
      {header}
      <PageHeader title={t.title} lead={t.lead} />
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {status ? <Body strong>{status}</Body> : null}

      {data.offers.length === 0 ? <EmptyState>{t.empty}</EmptyState> : null}
      {data.offers.map((offer) => {
        const name = offer.programme?.name ?? offer.universityName;
        return (
          <OfferCardView key={offer.id} offer={offer} remindersOn={data.remindersOn}>
            {offer.status !== 'accepted' && !accepted ? (
              <Body pair="cardMuted" small>
                {t.acceptHint}
              </Body>
            ) : null}
            {offer.status !== 'accepted' ? (
              <Button
                label={t.accept}
                accessibilityLabel={`${t.accept}: ${name}`}
                disabled={busy}
                onPress={() =>
                  void run(
                    () =>
                      api<OffersResponse>(`/api/offers/${offer.id}`, {
                        method: 'PATCH',
                        json: { action: 'accept' },
                      }),
                    setData,
                    t.acceptedSaved,
                  )
                }
              />
            ) : null}
            {offer.status !== 'declined' ? (
              <Button
                label={t.decline}
                accessibilityLabel={`${t.decline}: ${name}`}
                variant="secondary"
                disabled={busy}
                onPress={() =>
                  void run(
                    () =>
                      api<OffersResponse>(`/api/offers/${offer.id}`, {
                        method: 'PATCH',
                        json: { action: 'decline' },
                      }),
                    setData,
                    t.declinedSaved,
                  )
                }
              />
            ) : null}
            <Button
              label={t.remove}
              accessibilityLabel={`${t.remove}: ${name}`}
              variant="quiet"
              disabled={busy}
              onPress={() =>
                void run(
                  () => api<OffersResponse>(`/api/offers/${offer.id}`, { method: 'DELETE' }),
                  setData,
                  t.removed,
                )
              }
            />
          </OfferCardView>
        );
      })}

      <Card testID="add-offer">
        <Heading>{t.addTitle}</Heading>
        <Body pair="cardMuted" small>
          {t.addLead}
        </Body>
        <CourseChooser
          label={t.course}
          options={data.options}
          value={programmeId}
          onChange={setProgrammeId}
        />
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
        <Button
          label={t.save}
          busy={busy}
          busyLabel={en.common.saving}
          disabled={missing.length > 0}
          // Dimmed, it says why: what is still to choose (A3-18).
          {...(missing.length > 0 ? { hint: missing.join(' ') } : {})}
          onPress={() => void save()}
        />
      </Card>

      <Card testID="upload-letter">
        <Heading>{t.uploadTitle}</Heading>
        <Body pair="cardMuted" small>
          {t.uploadLead}
        </Body>
        <Button
          label={en.documents.takePhoto}
          busy={busy}
          busyLabel={t.reading}
          onPress={() => void pick(takePhoto)}
        />
        <Button
          label={en.documents.choosePhoto}
          variant="secondary"
          disabled={busy}
          onPress={() => void pick(choosePhoto)}
        />
        <Button
          label={en.documents.choosePdf}
          variant="secondary"
          disabled={busy}
          onPress={() => void pick(choosePdf)}
        />
      </Card>
    </Screen>
  );
}
