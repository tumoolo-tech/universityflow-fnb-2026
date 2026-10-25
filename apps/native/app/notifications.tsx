import { en } from '@universityflow/content/app';
import { useCallback, useEffect, useState } from 'react';
import { announce, Body, Button, Card, Notice, PageHeader, Screen } from '../components/ui';
import { api, errorMessage } from '../lib/api';
import { ensureThisPhone, pushOptedIn, turnOffPush, turnOnPush } from '../lib/push';
import type { MessagingResponse } from '../lib/types';

/**
 * App notifications, on or off for this phone (Phase 4d). The phone's permission prompt appears
 * only when the learner taps "Turn on notifications", after this screen has said what they are
 * and that nothing private shows on the lock screen.
 */
export default function NotificationsScreen() {
  const [state, setState] = useState<{ offered: boolean; on: boolean } | null>(null);
  const [notice, setNotice] = useState<{ tone: 'danger' | 'warning'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const view = await api<MessagingResponse>('/api/me/messaging');
      const offered = view.offeredChannels.includes('push');
      // "On" only once this phone is registered with this session: the server sends only to
      // tokens on a live session (A7-02).
      setState({ offered, on: offered && pushOptedIn(view) && (await ensureThisPhone()) });
    } catch (e) {
      setNotice({ tone: 'danger', text: errorMessage(e) });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function turnOn() {
    setBusy(true);
    setNotice(null);
    try {
      const result = await turnOnPush();
      if (result === 'on') {
        setState((s) => (s ? { ...s, on: true } : s));
        announce(en.notifications.on);
      } else {
        // Not turned on is an outcome the learner must hear about: a warning, which the Notice
        // announces on both platforms (A3-02). An `info` notice says nothing.
        setNotice({
          tone: 'warning',
          text:
            result === 'denied'
              ? en.notifications.denied
              : result === 'no-device'
                ? en.notifications.noDevice
                : en.notifications.unavailable,
        });
      }
    } catch (e) {
      setNotice({ tone: 'danger', text: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    setBusy(true);
    setNotice(null);
    try {
      await turnOffPush();
      setState((s) => (s ? { ...s, on: false } : s));
      announce(en.notifications.off);
    } catch (e) {
      setNotice({ tone: 'danger', text: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen belowHeader>
      <PageHeader title={en.notifications.title} lead={en.notifications.lead} />
      <Body small>{en.notifications.when}</Body>
      {notice ? <Notice tone={notice.tone}>{notice.text}</Notice> : null}
      {!state ? (
        notice ? (
          // A failed load is not a dead end on a poor network (A7-10).
          <Button
            label={en.common.tryAgain}
            onPress={() => {
              setNotice(null);
              void load();
            }}
          />
        ) : (
          <Body>{en.common.loading}</Body>
        )
      ) : !state.offered ? (
        <Notice tone="info">{en.notifications.unavailable}</Notice>
      ) : state.on ? (
        <Card>
          <Body pair="card" testID="push-status">
            {en.notifications.on}
          </Body>
          <Button
            label={en.notifications.turnOff}
            variant="secondary"
            busy={busy}
            busyLabel={en.common.saving}
            onPress={() => void turnOff()}
          />
        </Card>
      ) : (
        <Card>
          <Body pair="card" testID="push-status">
            {en.notifications.off}
          </Body>
          <Body pair="card" small>
            {en.notifications.askFirst}
          </Body>
          <Button
            label={en.notifications.turnOn}
            busy={busy}
            busyLabel={en.common.saving}
            onPress={() => void turnOn()}
          />
        </Card>
      )}
    </Screen>
  );
}
