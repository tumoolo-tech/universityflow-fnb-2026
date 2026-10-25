import { en } from '@universityflow/content';
import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { headers } from 'next/headers';
import { connection } from 'next/server';
import type { ReactNode } from 'react';
import { bannerOnPath, DemoBanner } from '@/components/demo-banner';
import { StagingBanner } from '@/components/staging-banner';
import { PATH_HEADER } from '@/lib/csp';
import { isDemo, isStaging } from '@/lib/server/deployment';
import { demoLearnerSignedIn } from '@/lib/server/session';
import './globals.css';

/**
 * Outfit (SIL OFL, app/fonts/OFL.txt): one variable woff2, Latin only, 32 KB, served from our own
 * origin (no font CDN) and preloaded; `tokens.font.brand` names it. Until it loads (font-display:
 * swap) the page shows next/font's size-matched fallback, then `tokens.font.family`: globals.css
 * sets `var(--font-outfit), var(--uf-font)`. No `fallback` here (A2-26): next/font would put it
 * inside `--font-outfit`, ending in `sans-serif`, and the tokens' stack would never be reached
 * (next/font takes literals only, so it can't be read from the tokens).
 */
const outfit = localFont({
  src: './fonts/Outfit-latin.woff2',
  weight: '100 900',
  style: 'normal',
  display: 'swap',
  preload: true,
  variable: '--font-outfit',
});

/**
 * A staging site (UF_DEPLOYMENT=staging) and a judge demo (UF_DEPLOYMENT=demo) are never indexed,
 * so search never sends a learner there.
 */
export function generateMetadata(): Metadata {
  return {
    title: { default: en.app.name, template: `%s · ${en.app.name}` },
    description: en.app.tagline,
    ...(isStaging() || isDemo() ? { robots: { index: false, follow: false } } : {}),
  };
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  colorScheme: 'dark',
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  // Render every page per request, the not-found page included: Next stamps the proxy's CSP
  // nonce on its scripts only while rendering a request. A prerendered page's scripts carry no
  // nonce and would be blocked (audit finding 2).
  await connection();
  // Read per request, so the banner follows the deployment's own environment.
  const staging = isStaging();
  // The landing page is the main one, even on the demo: no banner there (bannerOnPath).
  const demo = isDemo() && bannerOnPath((await headers()).get(PATH_HEADER));
  // "Switch learner" only while a learner is signed in (A2-67); asked only on the demo.
  const learner = demo && (await demoLearnerSignedIn());
  return (
    <html lang="en-ZA" className={outfit.variable}>
      <body className="min-h-dvh text-ink">
        <a className="skip-link" href="#main">
          {en.common.skipToContent}
        </a>
        <StagingBanner staging={staging} />
        <DemoBanner demo={demo} learner={learner} />
        {children}
      </body>
    </html>
  );
}
