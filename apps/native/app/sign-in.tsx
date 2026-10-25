import { en } from '@universityflow/content/app';
import { useState } from 'react';
import { Body, Button, Field, Notice, Screen, Title } from '../components/ui';
import { api, errorMessage } from '../lib/api';
import { useAuth } from '../lib/auth';
import { takeAccountDeleted } from '../lib/session';

/**
 * Phone number, then a one-time PIN (decision D4). The token comes back in the response and
 * goes straight into the secure store; the auth gate then shows the app.
 */
export default function SignInScreen() {
  const { signIn } = useAuth();
  const [step, setStep] = useState<'phone' | 'pin'>('phone');
  const [phone, setPhone] = useState('');
  const [masked, setMasked] = useState('');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Just after deleting the account, the gate lands here: say it worked (A7-09).
  const [deleted] = useState(takeAccountDeleted);

  async function requestPin() {
    setBusy(true);
    setError(null);
    try {
      const result = await api<{ phoneMasked: string }>('/api/auth/request-pin', {
        json: { phone },
      });
      setMasked(result.phoneMasked);
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
    return (
      <Screen>
        {deleted ? <Notice tone="success">{en.me.deleted}</Notice> : null}
        <Body pair="pageBrand" strong>
          {en.app.name}
        </Body>
        <Title>{en.auth.title}</Title>
        <Body>{en.auth.lead}</Body>
        <Field
          label={en.auth.phoneLabel}
          hint={en.auth.phoneHint}
          error={error}
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          autoComplete="tel"
          textContentType="telephoneNumber"
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
      <Body>{en.auth.pinLead(masked)}</Body>
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
