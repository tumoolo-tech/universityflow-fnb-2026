import { en } from '@universityflow/content/app';
import { useState } from 'react';
import { Body, Button, Card, Field, Heading, Notice, Screen, Title } from '../components/ui';
import { api, errorMessage } from '../lib/api';
import { useAuth } from '../lib/auth';
import { isDemoBuild } from '../lib/config';
import { takeAccountDeleted } from '../lib/session';

/**
 * Phone number, then a one-time PIN (decision D4). The token comes back in the response and
 * goes straight into the secure store; the auth gate then shows the app.
 *
 * The judges' demo (a hackathon exception, docs/deploy/demo.md §4b) sends no SMS: its server
 * returns the PIN (`demoPin`) for the screen, which shows it where it is typed, as the web does.
 * Only that server returns one; the app never makes one up. A judges' build also says first that
 * this is the demo (made-up details, a made-up 080 number).
 */
const SIX_DIGITS = /^\d{6}$/;
const d = en.demoPhoneSignup;

export default function SignInScreen() {
  const { signIn } = useAuth();
  const [step, setStep] = useState<'phone' | 'pin'>('phone');
  const [phone, setPhone] = useState('');
  const [masked, setMasked] = useState('');
  const [shownPin, setShownPin] = useState<string | null>(null);
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Just after deleting the account, the gate lands here: say it worked (A7-09).
  const [deleted] = useState(takeAccountDeleted);

  async function requestPin() {
    setBusy(true);
    setError(null);
    try {
      const result = await api<{ phoneMasked: string; demoPin?: unknown }>(
        '/api/auth/request-pin',
        { json: { phone } },
      );
      setMasked(result.phoneMasked);
      const demoPin = typeof result.demoPin === 'string' ? result.demoPin : '';
      setShownPin(SIX_DIGITS.test(demoPin) ? demoPin : null);
      setPin('');
      setStep('pin');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    setBusy(true);
    setError(null);
    try {
      const { token } = await api<{ token: string }>('/api/auth/verify-pin', {
        json: { phone, pin },
      });
      await signIn(token);
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  if (step === 'phone') {
    const demo = isDemoBuild();
    return (
      <Screen>
        {deleted ? <Notice tone="success">{en.me.deleted}</Notice> : null}
        <Body pair="pageBrand" strong>
          {en.app.name}
        </Body>
        {/* On the demo nothing is sent by SMS, and each made-up number is one new learner. */}
        <Title>{demo ? d.pageTitle : en.auth.title}</Title>
        {demo ? null : <Body>{en.auth.lead}</Body>}
        {demo ? (
          <Card testID="demo-notice">
            <Heading level={3}>{d.noticeTitle}</Heading>
            {d.noticePoints.map((point) => (
              <Body key={point} pair="card">
                {point}
              </Body>
            ))}
          </Card>
        ) : null}
        <Field
          label={demo ? d.phoneLabel : en.auth.phoneLabel}
          hint={demo ? d.phoneHint : en.auth.phoneHint}
          error={error}
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          // The demo wants a made-up number: never offer the phone's own to fill in.
          autoComplete={demo ? 'off' : 'tel'}
          textContentType={demo ? 'none' : 'telephoneNumber'}
          maxLength={20}
          testID="phone"
        />
        <Button
          label={en.auth.sendPin}
          busyLabel={en.auth.sending}
          busy={busy}
          disabled={phone.trim().length < 9}
          onPress={requestPin}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <Title>{en.auth.pinTitle}</Title>
      {shownPin ? (
        <Card emphasis testID="demo-pin">
          <Heading level={3}>{d.pinOnScreenTitle}</Heading>
          <Body pair="card">{d.pinOnScreen(shownPin)}</Body>
        </Card>
      ) : (
        <Body>{en.auth.pinLead(masked)}</Body>
      )}
      <Field
        label={en.auth.pinLabel}
        error={error}
        value={pin}
        onChangeText={(text) => setPin(text.replace(/\D/g, '').slice(0, 6))}
        keyboardType="number-pad"
        autoComplete="sms-otp"
        textContentType="oneTimeCode"
        maxLength={6}
        testID="pin"
      />
      <Button
        label={en.auth.verify}
        busyLabel={en.auth.verifying}
        busy={busy}
        disabled={pin.length !== 6}
        onPress={verify}
      />
      <Button label={en.auth.resend} variant="quiet" disabled={busy} onPress={requestPin} />
      <Button
        label={en.auth.changeNumber}
        variant="quiet"
        disabled={busy}
        onPress={() => {
          setStep('phone');
          setPin('');
          setError(null);
        }}
      />
    </Screen>
  );
}
