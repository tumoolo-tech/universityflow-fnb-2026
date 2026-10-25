import { en } from '@universityflow/content';
import { NotFoundError } from '@universityflow/db';
import type { Metadata } from 'next';
import { SiteFooter } from '@/components/site-footer';
import { PublicPage } from '@/components/ui';
import { getServices } from '@/lib/server/services';
import { ConsentForm } from './consent-form';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: en.consent.title, robots: { index: false } };

/** What a parent or guardian sees when they open the SMS link. No account needed. */
export default async function ConsentPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { store } = await getServices();
  let view: Awaited<ReturnType<typeof store.consentRequest>> | null = null;
  try {
    view = await store.consentRequest(token);
  } catch (error) {
    if (!(error instanceof NotFoundError)) throw error;
  }

  return (
    <>
      <PublicPage brand={{ name: en.app.name }}>
        {view ? (
          <ConsentForm
            token={token}
            status={view.status}
            relationship={en.onboarding.relationships[view.relationship].toLowerCase()}
            learnerPhoneMasked={view.learnerPhoneMasked}
          />
        ) : (
          <p role="alert">{en.consent.invalid}</p>
        )}
      </PublicPage>
      <SiteFooter width="prose" />
    </>
  );
}
