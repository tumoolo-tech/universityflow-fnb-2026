import { en, REPLY_REPORT_REASONS, type ReplyReportReason } from '@universityflow/content/app';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { api } from '../lib/api';
import { apiUrl } from '../lib/config';
import { theme } from '../lib/theme';
import { announce, Body, Button, Notice, Radio, RadioGroup, SourceLink } from './ui';

const t = en.chat.report;

/**
 * "Report this reply" under an AI reply (A10-35), as on the web (apps/web, report-reply.tsx): a
 * quiet button that opens the reasons in place, a reason from the fixed list and never free text
 * (hard rule 4). The thank-you is announced (A3-02); "harmful or upsetting" adds Get help, which
 * opens the web's help page (the app has no screen for it).
 */
export function ReportReply({ messageId, reported }: { messageId: string; reported: boolean }) {
  const [state, setState] = useState<'closed' | 'open' | 'sent'>('closed');
  const [reason, setReason] = useState<ReplyReportReason | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (reported && state !== 'sent') {
    return (
      <Body small pair="pageMuted">
        {t.reported}
      </Body>
    );
  }

  async function send() {
    if (!reason || busy) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/api/chat/messages/${messageId}/report`, { method: 'POST', json: { reason } });
      setState('sent');
      announce(t.sent);
    } catch {
      setError(t.error);
    } finally {
      setBusy(false);
    }
  }

  if (state === 'sent') {
    return (
      <View style={styles.box}>
        <Body small>{t.sent}</Body>
        {reason === 'harmful' ? (
          <>
            <Body small pair="pageMuted">
              {t.helpLead}
            </Body>
            <SourceLink url={`${apiUrl()}/help`} pair="pageBrand">
              {t.help}
            </SourceLink>
          </>
        ) : null}
      </View>
    );
  }

  if (state === 'closed') {
    return (
      <View style={styles.start}>
        <Button label={t.open} variant="quiet" expanded={false} onPress={() => setState('open')} />
      </View>
    );
  }

  return (
    <View style={[styles.box, styles.open]}>
      <RadioGroup label={t.question}>
        {REPLY_REPORT_REASONS.map((r) => (
          <Radio
            key={r}
            label={t.reasons[r]}
            selected={reason === r}
            onPress={() => setReason(r)}
          />
        ))}
      </RadioGroup>
      {error ? <Notice tone="danger">{error}</Notice> : null}
      <Button
        label={t.send}
        busy={busy}
        busyLabel={en.common.saving}
        disabled={!reason}
        onPress={() => void send()}
      />
      <Button
        label={t.cancel}
        variant="secondary"
        disabled={busy}
        onPress={() => {
          setState('closed');
          setError(null);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  start: { alignItems: 'flex-start' },
  box: { gap: theme.space['2'] },
  open: {
    padding: theme.space['3'],
    borderRadius: theme.radius.md,
    borderWidth: theme.border.thin,
    borderColor: theme.color.line,
  },
});
