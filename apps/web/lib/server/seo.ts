import 'server-only';
import { en } from '@universityflow/content';
import type { Metadata, MetadataRoute } from 'next';
import { isDemo, isStaging } from './deployment';

/**
 * The launch standard's search line (A6-01, A6-02, A6-03): robots.txt, sitemap.xml, the root
 * metadata (`metadataBase`, Open Graph, Twitter) and each public page's canonical and share words.
 * Every word comes from packages/content; every address from UF_PUBLIC_URL, the same one guardian
 * links start with (readConfig holds production to its own https address, A1-50).
 *
 * A staging site and a judge demo are never indexed: their pages say noindex, their robots.txt
 * disallows everything, and their sitemap lists nothing.
 */

type Env = Record<string, string | undefined>;

/** The public pages search may list (sitemap.xml): open to anyone, the same for everyone. */
export const PUBLIC_PAGES = ['/', '/colleges/registered', '/help', '/privacy'] as const;

/**
 * The signed-in app (every folder in app/(app), held by test/seo.test.tsx), and what no crawler
 * has any business in: the API, guardians' consent links, onboarding, the dev outbox, the demo's
 * pages (not found outside a demo).
 */
const SIGNED_IN_ROUTES = [
  '/applications',
  '/campus',
  '/chat',
  '/cv',
  '/documents',
  '/first-week',
  '/funding',
  '/goals',
  '/home',
  '/me',
  '/modules',
  '/offers',
  '/results',
  '/subjects',
] as const;
const NEVER_CRAWLED = ['/api/', '/consent/', '/onboarding', '/dev/', '/demo'] as const;

/**
 * The picture a shared link shows: an existing front-door picture, as it is (720×735). A proper
 * 1200×630 share image is the owner's to make.
 */
export const SHARE_IMAGE = { url: '/stage/graduation.webp', width: 720, height: 735 } as const;

/** The site's own address, from UF_PUBLIC_URL (this machine when unset, as config.ts does). */
export function siteUrl(env: Env = process.env): URL {
  try {
    return new URL(env['UF_PUBLIC_URL']?.trim() || 'http://localhost:3000');
  } catch {
    return new URL('http://localhost:3000');
  }
}

const hidden = (env: Env) => isStaging(env) || isDemo(env);

export function robotsFor(env: Env = process.env): MetadataRoute.Robots {
  if (hidden(env)) return { rules: { userAgent: '*', disallow: '/' } };
  return {
    rules: { userAgent: '*', allow: '/', disallow: [...NEVER_CRAWLED, ...SIGNED_IN_ROUTES] },
    sitemap: new URL('/sitemap.xml', siteUrl(env)).href,
  };
}

export function sitemapFor(env: Env = process.env): MetadataRoute.Sitemap {
  if (hidden(env)) return [];
  const base = siteUrl(env);
  return PUBLIC_PAGES.map((path) => ({ url: new URL(path, base).href }));
}

/** What a shared link shows, for a page (or, with no title, the front door). */
function shareWords(title: string, description: string, path?: string) {
  return {
    openGraph: {
      type: 'website' as const,
      siteName: en.app.name,
      locale: 'en_ZA',
      title,
      description,
      images: [SHARE_IMAGE],
      ...(path ? { url: path } : {}),
    },
    twitter: {
      card: 'summary_large_image' as const,
      title,
      description,
      images: [SHARE_IMAGE.url],
    },
  };
}

/** The root layout's metadata: every relative canonical and picture resolves against the site. */
export function rootMetadata(env: Env = process.env): Metadata {
  return {
    metadataBase: siteUrl(env),
    title: { default: en.app.name, template: `%s · ${en.app.name}` },
    description: en.app.tagline,
    ...shareWords(en.app.name, en.home.description),
    ...(hidden(env) ? { robots: { index: false, follow: false } } : {}),
  };
}

/**
 * A public page's metadata: its title, description and canonical (the bare path, so a query such
 * as the college check's `?name=` is never its own page), and its share words. Next replaces the
 * root's `openGraph` and `twitter` wholesale, so each page carries the whole set.
 */
export function pageMetadata(page: {
  path: string;
  title?: string;
  description: string;
}): Metadata {
  return {
    ...(page.title ? { title: page.title } : {}),
    description: page.description,
    alternates: { canonical: page.path },
    ...shareWords(page.title ?? en.app.name, page.description, page.path),
  };
}

/** The front door's structured data: who runs the site, and the site itself (schema.org). */
export function structuredData(base: URL) {
  const url = new URL('/', base).href;
  const organization = `${url}#organization`;
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': organization,
        name: en.app.name,
        url,
        logo: new URL('/icon.png', base).href,
      },
      {
        '@type': 'WebSite',
        '@id': `${url}#website`,
        name: en.app.name,
        url,
        description: en.home.description,
        inLanguage: 'en-ZA',
        publisher: { '@id': organization },
      },
    ],
  };
}
