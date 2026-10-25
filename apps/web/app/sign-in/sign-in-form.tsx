'use client';

import { auth } from '@universityflow/content';
import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';
import { Button, Field, Input } from '@/components/ui';
import { ApiError, api, errorMessage } from '@/lib/client/api';
import type { DemoPhoneWords } from '../demo/new-learner/words';

/**
 * Phone number, then a one-time PIN. No passwords (decision D4).
 *
 * `demo`: the judge demo's on-screen sign-up only (a hackathon exception, docs/deploy/demo.md),
 * on its own page under that page's heading: a made-up 080 number, and the PIN the server returns
 * shown where it is typed, since nothing is sent. Absent (production, everywhere else), the form is
 * exactly as it was.
 */
export function SignInForm({ demo }: { demo?: DemoPhoneWords } = {}) {
  const router = useRouter();
  const [step, setStep] = useState<'phone' | 'pin'>('phone');
  const [phone, setPhone] = useState('');
  const [masked, setMasked] = useState('');
  const [shownPin, setShownPin] = useState<string | null>(null);
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The demo refuses any number that isn't a made-up 080 one, and one another judge took, and
  // says so in its own words.
  const sentence = (e: unknown) => {
    if (demo && e instanceof ApiError && e.detail === 'demo-080-only') return demo.only080;
    if (demo && e instanceof ApiError && e.detail === 'demo-080-taken') return demo.numberTaken;
    return errorMessage(e);
  };

  async function requestPin(event?: FormEvent) {
    event?.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await api<{ phoneMasked: string; demoPin?: string }>('/api/auth/request-pin', {
        method: 'POST',
        json: { phone },
      });
      setMasked(result.phoneMasked);
      setShownPin(demo && result.demoPin ? result.demoPin : null);
      setStep('pin');
    } catch (e) {
      setError(sentence(e));
    } finally {
      setBusy(false);
    }
  }

  async function verify(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api('/api/auth/verify-pin', { method: 'POST', json: { phone, pin } });
      router.push('/onboarding');
      router.refresh();
    } catch (e) {
      setError(sentence(e));
      setBusy(false);
    }
  }

  // On the demo's own page, under its h1, the form's headings are the next level down.
  const Heading = demo ? 'h2' : 'h1';

  if (step === 'phone') {
    return (
      <form onSubmit={requestPin} className="flex flex-col gap-5" noValidate>
        {demo ? null : (
          <>
            <Heading className="text-2xl">{auth.title}</Heading>
            <p>{auth.lead}</p>
          </>
        )}
        <Field
          label={demo ? demo.phoneLabel : auth.phoneLabel}
          hint={demo ? demo.phoneHint : auth.phoneHint}
          error={error}
        >
          {({ id, describedBy }) => (
            <Input
              id={id}
              aria-describedby={describedBy}
              aria-invalid={Boolean(error)}
              type="tel"
              inputMode="tel"
              autoComplete={demo ? 'off' : 'tel'}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
          )}
        </Field>
        <Button type="submit" disabled={busy || phone.trim().length < 9}>
          {busy ? auth.sending : auth.sendPin}
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={verify} className="flex flex-col gap-5" noValidate>
      <Heading className="text-2xl">{auth.pinTitle}</Heading>
      {demo ? (
        shownPin ? (
          <div role="status" className="rounded-md border-l-rule border-info bg-info-soft p-4">
            <p className="font-bold">{demo.pinOnScreenTitle}</p>
            <p className="text-ink">{demo.pinOnScreen.replace('{pin}', shownPin)}</p>
          </div>
        ) : null
      ) : (
        <p>{auth.pinLead(masked)}</p>
      )}
      <Field label={auth.pinLabel} error={error}>
        {({ id, describedBy }) => (
          <Input
            id={id}
            aria-describedby={describedBy}
            aria-invalid={Boolean(error)}
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6}"
            maxLength={6}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
            required
          />
        )}
      </Field>
      <Button type="submit" disabled={busy || pin.length !== 6}>
        {busy ? auth.verifying : auth.verify}
      </Button>
      <div className="flex flex-wrap gap-2">
        <Button variant="quiet" onClick={() => requestPin()} disabled={busy}>
          {auth.resend}
        </Button>
        <Button
          variant="quiet"
          onClick={() => {
            setStep('phone');
            setPin('');
            setShownPin(null);
            setError(null);
          }}
        >
          {auth.changeNumber}
        </Button>
      </div>
    </form>
  );
}
