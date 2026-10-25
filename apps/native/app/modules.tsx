import { en } from '@universityflow/content/app';
import { Stack } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ConfirmModules } from '../components/confirm-modules';
import { MyModulesCard } from '../components/my-modules-card';
import {
  announce,
  Body,
  Button,
  Card,
  EmptyState,
  Heading,
  Notice,
  PageHeader,
  Screen,
  useAnnounce,
} from '../components/ui';
import { api, errorMessage } from '../lib/api';
import type { ConfirmedRegistration, RegistrationDraft, RegistrationResponse } from '../lib/types';
import {
  choosePdf,
  choosePhoto,
  type PickedFile,
  takePhoto,
  uploadProofOfRegistration,
} from '../lib/upload';

/**
 * My modules in the app (Phase 5c): the check of the learner's confirmed registration, a proof of
 * registration by camera, gallery or PDF (Phase 4d's upload flow, lib/upload.ts), or their modules
 * typed in, each confirmed row by row before anything is compared (hard rule 6). The same API and
 * the same server code as the web page.
 */

const m = en.modules;

/** What the confirm form starts from: a proof's draft, or nothing to type into. */
interface Draft {
  readonly documentId: string | null;
  readonly sample: boolean;
  readonly draft: RegistrationDraft | null;
}

export default function ModulesScreen() {
  const [data, setData] = useState<RegistrationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  // Outcomes are said on iOS too, not only through Android's live region (A3-02).
  useAnnounce(status);

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await api<RegistrationResponse>('/api/registration'));
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
      () => uploadProofOfRegistration(picked),
      (result) => {
        if (!result.registration) {
          setError(m.unreadable);
          return;
        }
        // The screen changes under a VoiceOver user's finger: say where they are now (A3-02).
        announce(m.confirmTitle);
        setDraft({
          documentId: result.documentId,
          sample: result.sample,
          draft: result.registration,
        });
      },
      null,
    );
  }

  const header = <Stack.Screen options={{ title: m.title }} />;

  if (!data) {
    return (
      <Screen belowHeader>
        {header}
        <PageHeader title={m.title} />
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

  if (draft) {
    return (
      <Screen belowHeader>
        {header}
        <ConfirmModules
          key={draft.documentId ?? 'typed'}
          documentId={draft.documentId}
          draft={draft.draft}
          sample={draft.sample}
          data={data}
          busy={busy}
          error={error}
          onConfirm={(registration) =>
            void run(
              () =>
                api<RegistrationResponse>('/api/registration', {
                  method: 'PUT',
                  json: {
                    ...registration,
                    documentId: draft.documentId,
                  } satisfies ConfirmedRegistration,
                }),
              (next) => {
                setData(next);
                setDraft(null);
              },
              m.saved,
            )
          }
          onCancel={() => {
            setDraft(null);
            setError(null);
          }}
        />
      </Screen>
    );
  }

  const current = data.modules;
  return (
    <Screen belowHeader>
      {header}
      <PageHeader title={m.title} lead={m.lead} />
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {status ? <Body strong>{status}</Body> : null}

      {current ? (
        <MyModulesCard artifact={current} remindersOn={data.remindersOn}>
          <Button
            label={m.remove}
            variant="quiet"
            disabled={busy}
            onPress={() =>
              void run(
                () =>
                  api<RegistrationResponse>(`/api/registration/${current.registrationId}`, {
                    method: 'DELETE',
                  }),
                setData,
                m.removed,
              )
            }
          />
        </MyModulesCard>
      ) : (
        <EmptyState>{m.empty}</EmptyState>
      )}

      <Card testID="upload-proof">
        <Heading>{current ? m.checkAgain : m.uploadTitle}</Heading>
        <Body pair="cardMuted" small>
          {m.uploadLead}
        </Body>
        <Button
          label={en.documents.takePhoto}
          busy={busy}
          busyLabel={m.reading}
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
        <Button
          label={m.typeIn}
          variant="quiet"
          disabled={busy}
          onPress={() => {
            setError(null);
            setStatus(null);
            announce(m.confirmTitle);
            setDraft({ documentId: null, sample: false, draft: null });
          }}
        />
      </Card>
    </Screen>
  );
}
