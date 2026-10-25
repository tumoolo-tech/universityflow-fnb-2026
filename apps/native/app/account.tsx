import { en } from '@universityflow/content/app';
import { type ProfileLook, resolveLook } from '@universityflow/ui';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ProfileLookSection } from '../components/profile-look';
import {
  announce,
  Body,
  Button,
  Card,
  Field,
  Heading,
  Notice,
  PageHeader,
  Screen,
} from '../components/ui';
import { api, errorMessage } from '../lib/api';
import { removeThisPhone } from '../lib/push';
import { clearToken, noteAccountDeleted } from '../lib/session';
import type { Me } from '../lib/types';

/**
 * About me, in the app: the learner's card and "Make it yours" (the owner's D5, 2026-10-22: the
 * card and its picker only), then deleting the account (POPIA, and the App Store's rule that an
 * app which creates accounts lets people delete them from inside it). The same API as the web
 * (GET/PATCH/DELETE /api/me). Everything else about the learner is on the web's About me page.
 */
export default function AccountScreen() {
  const [card, setCard] = useState<{
    look: ProfileLook;
    name: string | null;
    grade: number | null;
    photo: { readonly version: string | null } | null;
  } | null>(null);
  // The card is extra: if the profile can't be read, deletion is still offered, with no error.
  useEffect(() => {
    let live = true;
    api<Me>('/api/me')
      .then(({ profile, photo }) => {
        if (!live || !profile) return;
        setCard({
          look: resolveLook(profile),
          name: profile.displayName?.trim() || null,
          grade: profile.schoolFinished ? null : profile.grade,
          // Only when the server's switch is on (UF_PROFILE_PHOTO, until consent v4).
          photo: photo ?? null,
        });
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);
  // My CV, only while the server's switch is on (UF_CV): its API answers 404 otherwise.
  const router = useRouter();
  const [cvOn, setCvOn] = useState(false);
  useEffect(() => {
    let live = true;
    api('/api/me/cv/opt-in')
      .then(() => {
        if (live) setCvOn(true);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      await api('/api/me', { method: 'DELETE' });
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
      return;
    }
    // Said before the screen goes, and shown again on sign-in, so the learner knows it worked
    // and doesn't try again (A3-09, A7-09).
    announce(en.me.deleted);
    noteAccountDeleted();
    // The server took this phone's token with the account; forget it here too, then sign out.
    await removeThisPhone();
    await clearToken();
  }

  return (
    <Screen belowHeader>
      {/* The card and deletion here; seeing, changing and downloading the rest are on the web (A7-09, D5). */}
      <PageHeader title={en.me.title} lead={en.me.appLead} />
      {card ? (
        <ProfileLookSection
          initial={card.look}
          name={card.name}
          grade={card.grade}
          photo={card.photo}
        />
      ) : null}
      {cvOn ? (
        <Card>
          <Heading>{en.cv.title}</Heading>
          <Body pair="card">{en.cv.lead}</Body>
          <Button label={en.cv.title} variant="secondary" onPress={() => router.push('/cv')} />
        </Card>
      ) : null}
      <Card>
        {/* Red, as on the web: this can't be undone (A2-03). */}
        <Heading pair="cardDanger">{en.me.deleteTitle}</Heading>
        <Body pair="card">{en.me.deleteLead}</Body>
        <Field
          label={en.me.deleteConfirm}
          value={confirm}
          onChangeText={setConfirm}
          autoCapitalize="characters"
          testID="delete-confirm"
        />
        {error ? <Notice tone="danger">{error}</Notice> : null}
        <Button
          label={en.me.deleteButton}
          variant="danger"
          disabled={confirm !== 'DELETE'}
          busy={busy}
          busyLabel={en.common.saving}
          onPress={() => void remove()}
        />
      </Card>
    </Screen>
  );
}
