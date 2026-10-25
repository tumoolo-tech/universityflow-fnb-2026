'use client';

import { consent } from '@universityflow/content';
import { useState } from 'react';
import { PrivacyLink } from '@/components/privacy-link';
import { Button, Checkbox, Notice, Page } from '@/components/ui';
import { api, errorMessage } from '@/lib/client/api';

type Status = 'open' | 'granted' | 'withdrawn' | 'expired' | 'declined';

export function ConsentForm(props: {
  token: string;
  status: Exclude<Status, 'declined'>;
  relationship: string;
  learnerPhoneMasked: string;
}) {
  const [status, setStatus] = useState<Status>(props.status);
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function answer(action: 'grant' | 'withdraw') {
    setBusy(true);
    setError(null);
    try {
      const result = await api<{ status: Status }>(`/api/consent/${props.token}`, {
        method: 'POST',
        json: { action },
      });
      setStatus(result.status);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  if (status === 'expired') return <p role="status">{consent.expired}</p>;
  if (status === 'withdrawn') return <Notice tone="success">{consent.withdrawn}</Notice>;
  if (status === 'declined') return <Notice tone="info">{consent.declined}</Notice>;
  if (status === 'granted') {
    return (
      <section className="flex flex-col gap-4">
        <Notice tone="success">{consent.granted}</Notice>
        <p>{consent.rights[0]}</p>
        <Button
          variant="secondary"
          className="self-start"
          disabled={busy}
          onClick={() => answer('withdraw')}
        >
          {consent.withdraw}
        </Button>
        {error ? <Notice tone="danger">{error}</Notice> : null}
      </section>
    );
  }

  return (
    <section aria-labelledby="consent-title">
      <Page title={consent.title} titleId="consent-title" lead={consent.lead(props.relationship)}>
        <p className="text-muted">{consent.learnerNumber(props.learnerPhoneMasked)}</p>
        {(
          [
            [consent.whatWeDoTitle, consent.whatWeDo],
            [consent.whatWeKeepTitle, consent.whatWeKeep],
            [consent.rightsTitle, consent.rights],
          ] as const
        ).map(([title, points]) => (
          <div key={title} className="flex flex-col gap-2">
            <h2 className="text-lg">{title}</h2>
            <ul className="flex list-disc flex-col gap-1 pl-6">
              {points.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
        ))}
        <PrivacyLink />
        <label htmlFor="consent-confirm" className="flex min-h-11 items-start gap-3">
          <Checkbox
            id="consent-confirm"
            className="mt-1"
            required
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
          />
          <span>{consent.agreeConfirm}</span>
        </label>
        {error ? <Notice tone="danger">{error}</Notice> : null}
        <div className="flex flex-wrap gap-3">
          <Button disabled={!agreed || busy} onClick={() => answer('grant')}>
            {consent.agree}
          </Button>
          <Button variant="secondary" disabled={busy} onClick={() => setStatus('declined')}>
            {consent.decline}
          </Button>
        </div>
      </Page>
    </section>
  );
}
