import { crisisCard } from '@universityflow/agent';
import { en } from '@universityflow/content';
import type { Metadata } from 'next';
import Link from 'next/link';
import { CrisisCard } from '@/components/crisis-card';
import { SiteFooter } from '@/components/site-footer';
import { Page, PublicPage } from '@/components/ui';
import { getServices } from '@/lib/server/services';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: en.dashboard.help.title };

/**
 * Get help: the crisis card the chat shows (planning.md §4.3), a tap from every signed-in page.
 * Open to anyone, signed in or not, and it reads nothing about the visitor: only the verified
 * helplines the catalogue holds, chosen by the same code as the chat's card.
 */
export default async function HelpPage() {
  const { catalogue } = await getServices();
  return (
    <>
      <PublicPage brand={{ name: en.app.name, href: '/home' }}>
        <Page title={en.dashboard.help.title} lead={en.dashboard.help.lead}>
          <CrisisCard artifact={crisisCard(catalogue().helplines, [])} />
          <Link href="/home" className="inline-flex min-h-11 items-center self-start">
            {en.dashboard.help.back}
          </Link>
        </Page>
      </PublicPage>
      <SiteFooter width="prose" />
    </>
  );
}
