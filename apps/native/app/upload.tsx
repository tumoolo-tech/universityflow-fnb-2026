import { en } from '@universityflow/content/app';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ConfirmMarks } from '../components/confirm-marks';
import { announce, Body, Button, Card, Notice, PageHeader, Screen } from '../components/ui';
import { api, errorMessage } from '../lib/api';
import type { Me, UploadResult } from '../lib/types';
import { choosePdf, choosePhoto, type PickedFile, takePhoto, uploadReport } from '../lib/upload';

/**
 * Upload my report (Phase 4d): take a photo of the page with the marks, or choose a photo or a
 * PDF, then check every mark before anything uses it (hard rule 6).
 *
 * The camera permission is asked only when the learner taps "Take a photo". Choosing a photo uses
 * the system picker, which needs no access to the whole gallery. The app's copy of the photo is
 * deleted once it is uploaded (lib/upload.ts, which also does the picking).
 */

export default function UploadScreen() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<
    UploadResult | { documentId: null; draft: null; sample: false } | null
  >(null);
  // The grade the learner is in: the confirm form starts on its report (G10-1). The form opens only
  // once it has loaded (or failed to): its picker reads the grade once, when it opens, so opening
  // it early on a slow connection started a Grade 10 learner on the Grade 11 report (A1-40).
  const [grade, setGrade] = useState<number | null>(null);
  const [gradeLoaded, setGradeLoaded] = useState(false);
  useEffect(() => {
    void api<Me>('/api/me')
      .then((me) => setGrade(me.profile?.grade ?? null))
      .catch(() => undefined)
      .finally(() => setGradeLoaded(true));
  }, []);

  async function send(file: PickedFile) {
    setBusy(true);
    setError(null);
    try {
      const result = await uploadReport(file);
      if (!result.draft) setError(en.documents.errors.unreadable);
      // The screen changes under a VoiceOver user's finger: say where they are now (A3-02).
      announce(result.draft ? en.confirm.title : en.confirm.manualTitle);
      setDraft(result);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function pick(from: () => Promise<PickedFile | 'denied' | null>) {
    setError(null);
    const picked = await from();
    if (picked === 'denied') setError(en.documents.cameraDenied);
    else if (picked) await send(picked);
  }

  if (draft && !gradeLoaded) {
    return (
      <Screen belowHeader>
        <Body>{en.common.loading}</Body>
      </Screen>
    );
  }

  if (draft) {
    return (
      <Screen belowHeader>
        {error ? <Notice tone="warning">{error}</Notice> : null}
        <ConfirmMarks
          documentId={draft.documentId}
          draft={draft.draft}
          sample={draft.sample}
          grade={grade}
          onSaved={() => router.replace('/results')}
          onCancel={() => {
            setDraft(null);
            setError(null);
          }}
        />
      </Screen>
    );
  }

  return (
    <Screen belowHeader>
      <PageHeader title={en.documents.uploadReport} lead={en.documents.appLead} />
      <Card>
        <Button
          label={en.documents.takePhoto}
          busy={busy}
          busyLabel={en.documents.reading}
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
      {error ? <Notice tone="danger">{error}</Notice> : null}
      <Button
        label={en.documents.typeMarks}
        variant="quiet"
        disabled={busy || !gradeLoaded}
        onPress={() => {
          announce(en.confirm.manualTitle);
          setDraft({ documentId: null, draft: null, sample: false });
        }}
      />
    </Screen>
  );
}
