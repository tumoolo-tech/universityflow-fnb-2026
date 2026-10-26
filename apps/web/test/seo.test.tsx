// @vitest-environment jsdom

import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cleanup, render, screen, within } from '@testing-library/react';
import { en } from '@universityflow/content';
import type { Metadata } from 'next';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SiteFooter } from '../components/site-footer';
import { jsonForScript, SiteJsonLd } from '../components/site-json-ld';
import {
  PUBLIC_PAGES,
  pageMetadata,
  robotsFor,
  rootMetadata,
  SHARE_IMAGE,
  sitemapFor,
} from '../lib/server/seo';

/**
 * The launch standard's search line (A6-01, A6-02, A6-03, A6-04, A6-05): robots.txt and
 * sitemap.xml per deployment, one absolute canonical per public page (the bare path for the
 * college check, whatever name was typed), Open Graph and Twitter words from packages/content, and
 * Organization and WebSite structured data on the front door, carrying the request's CSP nonce.
 */

vi.mock('@/lib/server/session', () => ({ currentStudent: async () => null }));
vi.mock('next/navigation', () => ({
  redirect: (to: string) => {
    throw new Error(`redirect ${to}`);
  },
  notFound: () => {
    throw new Error('not found');
  },
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
}));

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

const BASE = 'https://universityflow.example';
const production = { UF_PUBLIC_URL: BASE };
const demo = { UF_PUBLIC_URL: 'https://demo.universityflow.example', UF_DEPLOYMENT: 'demo' };
const staging = {
  UF_PUBLIC_URL: 'https://staging.universityflow.example',
  UF_DEPLOYMENT: 'staging',
};

/** Every folder in app/(app): the signed-in routes. */
const signedInRoutes = readdirSync(resolve(__dirname, '../app/(app)'), {
  withFileTypes: true,
})
  .filter((d) => d.isDirectory())
  .map((d) => `/${d.name}`);

const disallowed = (robots: ReturnType<typeof robotsFor>) => {
  const rules = Array.isArray(robots.rules) ? robots.rules : [robots.rules];
  return rules.flatMap((r) => (Array.isArray(r.disallow) ? r.disallow : [r.disallow ?? []].flat()));
};

describe('robots.txt (A6-01)', () => {
  it('in production allows the public pages and keeps crawlers off the signed-in app and /api', () => {
    const robots = robotsFor(production);
    const rules = Array.isArray(robots.rules) ? robots.rules : [robots.rules];
    expect(rules).toHaveLength(1);
    expect(rules[0]?.userAgent).toBe('*');
    expect(rules[0]?.allow).toBe('/');
    const off = disallowed(robots);
    expect(signedInRoutes.length).toBeGreaterThan(10);
    for (const route of [
      ...signedInRoutes,
      '/api/',
      '/consent/',
      '/onboarding',
      '/dev/',
      '/demo',
    ]) {
      expect(off, route).toContain(route);
    }
    // Never a public page.
    for (const page of PUBLIC_PAGES) {
      expect(
        off.some((rule) => rule !== '/' && page.startsWith(rule)),
        page,
      ).toBe(false);
    }
    expect(robots.sitemap).toBe(`${BASE}/sitemap.xml`);
  });

  it('on a demo and on staging disallows everything, as their noindex already says', () => {
    for (const env of [demo, staging]) {
      const robots = robotsFor(env);
      expect(disallowed(robots)).toEqual(['/']);
      expect(robots.sitemap).toBeUndefined();
    }
  });

  it('is served per request from the deployment’s own environment', async () => {
    const route = await import('../app/robots');
    expect(route.dynamic).toBe('force-dynamic');
    vi.stubEnv('UF_DEPLOYMENT', 'demo');
    expect(disallowed(route.default())).toEqual(['/']);
    vi.stubEnv('UF_DEPLOYMENT', '');
    vi.stubEnv('UF_PUBLIC_URL', BASE);
    expect(route.default().sitemap).toBe(`${BASE}/sitemap.xml`);
  });
});

describe('sitemap.xml (A6-01)', () => {
  it('in production lists the public pages only, as absolute addresses from UF_PUBLIC_URL', () => {
    expect(sitemapFor(production).map((entry) => entry.url)).toEqual([
      `${BASE}/`,
      `${BASE}/colleges/registered`,
      `${BASE}/help`,
      `${BASE}/privacy`,
    ]);
  });

  it('lists nothing on a demo or staging', () => {
    expect(sitemapFor(demo)).toEqual([]);
    expect(sitemapFor(staging)).toEqual([]);
  });

  it('is served per request', async () => {
    const route = await import('../app/sitemap');
    expect(route.dynamic).toBe('force-dynamic');
    vi.stubEnv('UF_PUBLIC_URL', BASE);
    vi.stubEnv('UF_DEPLOYMENT', '');
    expect(route.default()).toEqual(sitemapFor(production));
  });
});

describe('the root metadata (A6-02, A6-03)', () => {
  it('resolves every canonical against UF_PUBLIC_URL', () => {
    const meta = rootMetadata(production);
    expect(String(meta.metadataBase)).toBe(`${BASE}/`);
    expect(meta.robots).toBeUndefined();
  });

  it('shares the front door’s words and picture by default', () => {
    const meta = rootMetadata(production);
    expect(meta.openGraph).toMatchObject({
      type: 'website',
      siteName: en.app.name,
      locale: 'en_ZA',
      title: en.app.name,
      description: en.home.description,
      images: [SHARE_IMAGE],
    });
    expect(meta.twitter).toMatchObject({
      card: 'summary_large_image',
      title: en.app.name,
      description: en.home.description,
    });
    // An existing front-door picture, until the owner's own 1200×630 share image.
    expect(SHARE_IMAGE.url).toMatch(/^\/stage\/[a-z-]+\.webp$/);
  });

  it('keeps a demo and staging out of search', () => {
    for (const env of [demo, staging]) {
      expect(rootMetadata(env).robots).toEqual({ index: false, follow: false });
    }
  });
});

/** Each public page's own metadata, resolved as Next would for a page with no generator. */
async function metadataOf(path: string): Promise<Metadata> {
  const files: Record<string, string> = {
    '/': '../app/page',
    '/privacy': '../app/privacy/page',
    '/help': '../app/help/page',
    '/colleges/registered': '../app/colleges/registered/page',
    '/sign-in': '../app/sign-in/page',
    '/demo': '../app/demo/page',
    '/demo/guide': '../app/demo/guide/page',
    '/demo/sign-up': '../app/demo/sign-up/page',
    '/demo/new-learner': '../app/demo/new-learner/page',
  };
  const mod = (await import(/* @vite-ignore */ files[path] as string)) as {
    metadata?: Metadata;
    generateMetadata?: () => Metadata;
  };
  return mod.generateMetadata ? mod.generateMetadata() : (mod.metadata as Metadata);
}

const PAGES: ReadonlyArray<[string, string]> = [
  ['/', en.home.description],
  ['/privacy', en.privacyPage.description],
  ['/help', en.dashboard.help.description],
  ['/colleges/registered', en.colleges.check.description],
  ['/sign-in', en.auth.description],
  ['/demo', en.demo.description],
  ['/demo/guide', en.demoPersonas.guide.description],
  ['/demo/sign-up', en.demoSignup.pageDescription],
  ['/demo/new-learner', en.demoPhoneSignup.pageDescription],
];

describe('every public page (A6-02, A6-03, A6-04)', () => {
  it.each(PAGES)('%s has its own canonical, description and share words', async (path, words) => {
    vi.stubEnv('UF_DEPLOYMENT', path.startsWith('/demo') ? 'demo' : '');
    const meta = await metadataOf(path);
    expect(meta.alternates?.canonical).toBe(path);
    expect(meta.description).toBe(words);
    expect(meta.openGraph).toMatchObject({ url: path, description: words });
    expect(meta.twitter).toMatchObject({ description: words });
    // Next replaces the root's openGraph and twitter wholesale: the page's carry the picture too.
    expect(meta.openGraph?.images).toEqual([SHARE_IMAGE]);
    expect(meta.twitter).toMatchObject({ card: 'summary_large_image' });
  });

  it('the college check’s canonical is the bare path, whatever name was typed', async () => {
    const meta = await metadataOf('/colleges/registered');
    expect(meta.alternates?.canonical).toBe('/colleges/registered');
    expect(String(meta.alternates?.canonical)).not.toContain('?');
  });

  it('the share title is the page’s own title', async () => {
    expect((await metadataOf('/privacy')).openGraph?.title).toBe(en.privacyPage.title);
    expect((await metadataOf('/')).openGraph?.title).toBe(en.app.name);
  });

  it('the demo’s /sign-in has its own title, not the picker’s (A6-04)', async () => {
    vi.stubEnv('UF_DEPLOYMENT', 'demo');
    expect((await metadataOf('/sign-in')).title).toBe(en.demo.signInPageTitle);
    expect((await metadataOf('/demo')).title).toBe(en.demo.signInTitle);
    vi.stubEnv('UF_DEPLOYMENT', '');
    expect((await metadataOf('/sign-in')).title).toBe(en.auth.title);
  });

  it('/demo/new-learner still keeps itself out of search', async () => {
    expect((await metadataOf('/demo/new-learner')).robots).toEqual({ index: false });
  });

  it('pageMetadata words a page from its title and description only', () => {
    expect(pageMetadata({ path: '/x', title: 'T', description: 'D' })).toEqual({
      title: 'T',
      description: 'D',
      alternates: { canonical: '/x' },
      openGraph: expect.objectContaining({ url: '/x', title: 'T', description: 'D' }),
      twitter: expect.objectContaining({ title: 'T', description: 'D' }),
    });
  });
});

describe('structured data on the front door (A6-03)', () => {
  const graphOf = (html: string) => {
    const match = /<script type="application\/ld\+json" nonce="([^"]+)">([\s\S]*?)<\/script>/.exec(
      html,
    );
    expect(match).not.toBeNull();
    return { nonce: match?.[1], data: JSON.parse(match?.[2] ?? 'null') };
  };

  it('is one JSON-LD script with the request’s nonce: an Organization and a WebSite', () => {
    const html = renderToStaticMarkup(<SiteJsonLd path="/" nonce="n0nce" base={new URL(BASE)} />);
    const { nonce, data } = graphOf(html);
    expect(nonce).toBe('n0nce');
    expect(data['@context']).toBe('https://schema.org');
    const graph = data['@graph'] as Array<Record<string, unknown>>;
    expect(graph.map((node) => node['@type'])).toEqual(['Organization', 'WebSite']);
    expect(graph[0]).toMatchObject({
      name: en.app.name,
      url: `${BASE}/`,
      logo: `${BASE}/icon.png`,
    });
    expect(graph[1]).toMatchObject({
      name: en.app.name,
      url: `${BASE}/`,
      description: en.home.description,
      inLanguage: 'en-ZA',
      publisher: { '@id': graph[0]?.['@id'] },
    });
  });

  it('is on the front door only, and never without a nonce', () => {
    const base = new URL(BASE);
    expect(renderToStaticMarkup(<SiteJsonLd path="/help" nonce="n" base={base} />)).toBe('');
    expect(renderToStaticMarkup(<SiteJsonLd path={null} nonce="n" base={base} />)).toBe('');
    expect(renderToStaticMarkup(<SiteJsonLd path="/" nonce={null} base={base} />)).toBe('');
  });

  it('can’t close its own script: a “<” in the data is escaped, and still parses', () => {
    const text = jsonForScript({ name: '</script><script>alert(1)</script>' });
    expect(text).not.toContain('<');
    expect(JSON.parse(text)).toEqual({ name: '</script><script>alert(1)</script>' });
  });

  it('the root layout renders it with the request’s nonce and path', () => {
    const layout = readFileSync(resolve(__dirname, '../app/layout.tsx'), 'utf8');
    expect(layout).toMatch(/<SiteJsonLd[\s\S]*?nonce=\{[^}]*NONCE_HEADER[^}]*\}/);
    expect(layout).toMatch(/<SiteJsonLd[\s\S]*?path=\{[^}]*PATH_HEADER[^}]*\}/);
    expect(layout).toMatch(/generateMetadata\(\): Metadata \{\s*return rootMetadata\(\);/);
  });
});

describe('the college check is linked from every public page (A6-05)', () => {
  it('the footer links to /colleges/registered', () => {
    render(<SiteFooter />);
    const footer = screen.getByRole('contentinfo');
    expect(
      within(footer).getByRole('link', { name: en.colleges.checkLink }).getAttribute('href'),
    ).toBe('/colleges/registered');
  });
});
