'use client';

import { common, me, messageText } from '@universityflow/content';
import { useState } from 'react';
import { Card, Checkbox, Field, Notice, Select } from '@/components/ui';
import { api, errorMessage, formatDate } from '@/lib/client/api';

type Channel = 'sms' | 'whatsapp' | 'push';

export interface MessagingView {
  channels: Array<{
    channel: Channel;
    optedIn: boolean;
    optedInAt: string | null;
    optOutSource: 'app' | 'stop' | 'consent-withdrawn' | null;
  }>;
  maxPerWeek: number;
  offeredChannels: Channel[];
}

/** Per-channel opt-in and the weekly cap (planning.md §7.1, §7.2). */
export function MessagesCard({ initial }: { initial: MessagingView }) {
  const [view, setView] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function change(
    json: { channel: Channel; optedIn: boolean } | { maxPerWeek: number },
  ): Promise<void> {
    const before = view;
    setError(null);
    setSaved(false);
    // Show the choice at once; the server's answer replaces it, or it is put back on failure.
    setView((v) =>
      'channel' in json
        ? {
            ...v,
            channels: v.channels.map((c) =>
              c.channel === json.channel ? { ...c, optedIn: json.optedIn } : c,
            ),
          }
        : { ...v, maxPerWeek: json.maxPerWeek },
    );
    try {
      setView(await api<MessagingView>('/api/me/messaging', { method: 'PUT', json }));
      setSaved(true);
    } catch (e) {
      setView(before);
      setError(errorMessage(e));
    }
  }

  const t = me.messages;
  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <h2 className="text-lg">{t.title}</h2>
        <p>{t.lead}</p>
        <p className="text-muted">{t.stopHint}</p>
      </div>
      {error ? <Notice tone="danger">{error}</Notice> : null}
      <fieldset className="flex flex-col gap-1">
        <legend className="mb-2 font-medium">{t.channelsLegend}</legend>
        {view.channels.map((c) => {
          // Push is turned on in the app, which registers the phone first; here it can only
          // be turned off.
          const inApp = c.channel === 'push' && view.offeredChannels.includes('push');
          const offered = view.offeredChannels.includes(c.channel) && !inApp;
          const id = `channel-${c.channel}`;
          const hintId = `${id}-hint`;
          const name = messageText.channelNames[c.channel];
          // Why the box is as it is, most important first: a disabled box always says why.
          const hint =
            inApp && !c.optedIn
              ? t.pushInApp
              : !offered && !inApp
                ? c.channel === 'push'
                  ? t.pushLater
                  : t.notOffered(name)
                : c.optedIn && c.optedInAt
                  ? t.onSince(formatDate(c.optedInAt))
                  : c.optOutSource === 'stop'
                    ? t.stoppedByStop
                    : null;
          return (
            <div key={c.channel} className="flex flex-col">
              <label htmlFor={id} className="flex min-h-11 items-center gap-3">
                <Checkbox
                  id={id}
                  checked={c.optedIn}
                  disabled={!offered && !c.optedIn}
                  aria-describedby={hint ? hintId : undefined}
                  onChange={(e) => change({ channel: c.channel, optedIn: e.target.checked })}
                />
                <span>{name}</span>
              </label>
              {hint ? (
                <p id={hintId} className="ml-8 text-sm text-muted">
                  {hint}
                </p>
              ) : null}
            </div>
          );
        })}
      </fieldset>
      <Field label={t.perWeek}>
        {({ id }) => (
          <Select
            id={id}
            value={view.maxPerWeek}
            onChange={(e) => change({ maxPerWeek: Number(e.target.value) })}
          >
            {[1, 2, 3, 4, 5, 6, 7].map((n) => (
              <option key={n} value={n}>
                {t.perWeekOption(n)}
              </option>
            ))}
          </Select>
        )}
      </Field>
      {/* Always mounted, only its text changes, so screen readers announce it (A3-04). */}
      <p role="status" className="empty:sr-only">
        {saved ? common.saved : null}
      </p>
    </Card>
  );
}
