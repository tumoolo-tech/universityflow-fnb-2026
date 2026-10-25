// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cleanup, render, screen, within } from '@testing-library/react';
import { en, ownerToFillFields } from '@universityflow/content';
import { NotFoundError } from '@universityflow/db';
import type { ReactElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * The privacy policy (/privacy) and the ECTA s43 footer (the owner's launch standard; A11-20).
 * The page is a template for the legal adviser: it says so, and shows every "Owner to fill"
 * line. It must name every operator docs/store/privacy-and-data-safety.md names, so a new
 * provider added there can't be forgotten here. Every public page carries the footer.
 */

vi.mock('@/lib/server/session', () => ({ currentStudent: async () => null }));
vi.mock('next/navigation', () => ({
  redirect: (to: string) => {
    throw new Error(`redirect ${to}`);
  },
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock('@/lib/server/services', () => ({
  getServices: async () => ({
    catalogue: () => ({ helplines: [] }),
    store: {
      consentRequest: async () => {
        throw new NotFoundError('consent request');
      },
    },
  }),
}));

const Privacy = (await import('../app/privacy/page')).default;
const FrontDoor = (await import('../app/page')).default;
const SignIn = (await import('../app/sign-in/page')).default;
const Help = (await import('../app/help/page')).default;
const Consent = (await import('../app/consent/[token]/page')).default;

const p = en.privacyPage;
const DOC = readFileSync(
  resolve(__dirname, '../../../docs/store/privacy-and-data-safety.md'),
  'utf8',
);

afterEach(cleanup);

/**
 * The operators the store document names: each bullet's bold head under "Processors outside
 * South Africa" ("Expo, then Apple (APNs) or Google (FCM)" is Expo, Apple and Google), and the
 * hosts it names where it says where everything is stored.
 */
function operatorsInDoc(doc: string): string[] {
  const section = doc.split('**Processors outside South Africa**')[1]?.split('\n## ')[0] ?? '';
  const heads = [...section.matchAll(/^- \*\*([^*]+)\*\*/gm)].map((m) => m[1] ?? '');
  const names = heads.flatMap((head) =>
    head
      .replace(/\([^)]*\)/g, '')
      .split(/,|\bthen\b|\bor\b/)
      .map((name) => name.trim().replace(/^The /, ''))
      .filter(Boolean),
  );
  const stored = /stored in South Africa \(([^)]*)\)/.exec(doc)?.[1] ?? '';
  const hosts = [...stored.matchAll(/\b(AWS|Vercel)\b/g)].map((m) => m[1] ?? '');
  return [...new Set([...names, ...hosts])];
}

const SCHEMA = readFileSync(resolve(__dirname, '../../../packages/db/src/schema.ts'), 'utf8');

/** The database columns of one table in packages/db's schema (`text('school_name')` → school_name). */
function columnsOf(table: string): string[] {
  const body = SCHEMA.split(`pgTable('${table}', {`)[1]?.split('\n});')[0] ?? '';
  return [...body.matchAll(/^\s+\w+: \w+\('(\w+)'/gm)].map((m) => m[1] ?? '');
}

/**
 * Each column of `profiles` that holds something the learner gave, and the word the page uses
 * for it, in "What we collect" (or, for the photo, "Coming later"). A new column fails the test
 * by name until the page says what it is (audit A11-33).
 */
const PROFILE_WORDS: Record<string, { section: 'collect' | 'later'; word: RegExp } | null> = {
  student_id: null,
  updated_at: null,
  display_name: { section: 'collect', word: /first name/ },
  grade: { section: 'collect', word: /grade/ },
  grade_given_on: { section: 'collect', word: /when you last confirmed it/ },
  school_name: { section: 'collect', word: /school/ },
  province: { section: 'collect', word: /province/ },
  goal: { section: 'collect', word: /goal in your own words/ },
  theme: { section: 'collect', word: /theme/ },
  avatar: { section: 'collect', word: /avatar/ },
  tagline_id: { section: 'collect', word: /tagline/ },
  badge_ids: { section: 'collect', word: /words from our lists/ },
  photo_key: { section: 'later', word: /profile photo/ },
};

describe('/privacy', () => {
  it('is a server component (no client JavaScript of its own)', () => {
    const source = readFileSync(resolve(__dirname, '../app/privacy/page.tsx'), 'utf8');
    expect(source).not.toMatch(/['"]use client['"]/);
  });

  it('has one main landmark and the title as its only h1, with metadata', async () => {
    const { metadata } = await import('../app/privacy/page');
    expect(metadata).toMatchObject({ title: p.title, description: p.description });
    render(await Privacy());
    expect(screen.getAllByRole('main')).toHaveLength(1);
    expect(screen.getAllByRole('heading', { level: 1 }).map((h) => h.textContent)).toEqual([
      p.title,
    ]);
  });

  it('says first, and plainly, that it is a template for the legal adviser', async () => {
    render(await Privacy());
    const notice = screen.getByRole('note', { name: p.templateTitle });
    expect(notice.textContent).toContain(p.templateNotice);
  });

  it('shows every "Owner to fill" line', async () => {
    const { container } = render(await Privacy());
    const text = container.textContent ?? '';
    const fields = ownerToFillFields();
    expect(fields.length).toBeGreaterThan(10);
    for (const field of fields) expect(text, field).toContain(field);
    // Each is marked as a placeholder, so it can be seen at a glance.
    const marked = [...container.querySelectorAll('.uf-fill')].map((el) => el.textContent);
    for (const field of fields) expect(marked, field).toContain(field);
  });

  it('names the responsible party, the information officer and every s43 detail', async () => {
    render(await Privacy());
    const who = screen.getByRole('region', { name: p.sections.whoWeAre.title });
    for (const [key, label] of Object.entries(p.businessLabels)) {
      expect(within(who).getByText(label)).toBeTruthy();
      expect(within(who).getByText(p.business[key as keyof typeof p.business])).toBeTruthy();
    }
    const officer = screen.getByRole('region', { name: p.sections.officer.title });
    for (const value of Object.values(p.sections.officer.values)) {
      expect(within(officer).getByText(value)).toBeTruthy();
    }
  });

  it('names every operator the store document names', async () => {
    const named = operatorsInDoc(DOC);
    // The parser is proven on the document as it stands, and on a new provider added to it.
    expect(named).toEqual(
      expect.arrayContaining([
        'Anthropic',
        'Expo',
        'Apple',
        'Google',
        'Meta',
        'SMS provider',
        'ElevenLabs',
        'AWS',
        'Vercel',
      ]),
    );
    expect(
      operatorsInDoc(DOC.replace('- **ElevenLabs**', '- **Sentry** (errors)\n- **ElevenLabs**')),
    ).toContain('Sentry');

    render(await Privacy());
    const section = screen.getByRole('region', { name: p.sections.operators.title });
    const text = (section.textContent ?? '').toLowerCase();
    for (const name of named) {
      const alias = name === 'SMS provider' ? 'sms company' : name.toLowerCase();
      expect(text, name).toContain(alias);
    }
  });

  it('lists each operator with what it does, what it receives and where', async () => {
    render(await Privacy());
    const section = screen.getByRole('region', { name: p.sections.operators.title });
    for (const operator of p.sections.operators.items) {
      const item = within(section).getByRole('heading', { name: operator.name }).closest('li');
      expect(item, operator.id).not.toBeNull();
      const text = item?.textContent ?? '';
      for (const value of [operator.does, operator.gets, operator.where]) {
        expect(text, operator.id).toContain(value);
      }
    }
    for (const line of p.sections.operators.crossBorder)
      expect(section.textContent).toContain(line);
  });

  it('says Mmereko, opened from My CV, is a separate service that UniversityFlow sends nothing', async () => {
    render(await Privacy());
    const section = screen.getByRole('region', { name: p.sections.operators.title });
    expect(
      within(section).getByRole('heading', { name: p.sections.operators.separateTitle }),
    ).toBeTruthy();
    const text = section.textContent ?? '';
    for (const line of p.sections.operators.separate) expect(text).toContain(line);
    expect(text).toMatch(/open Mmereko from My CV\. It is a separate service run by Tumoolo/);
    expect(text).toMatch(/UniversityFlow sends it nothing/);
  });

  it('gives the Information Regulator’s details, dated, with the complaint channels as links', async () => {
    render(await Privacy());
    const section = screen.getByRole('region', { name: p.sections.regulator.title });
    const v = p.sections.regulator.values;
    for (const value of [v.address, v.phone, v.tollFree, v.enquiries, v.complaints]) {
      expect(within(section).getByText(value)).toBeTruthy();
    }
    expect(within(section).getByText(p.sections.regulator.checked)).toBeTruthy();
    expect(within(section).getByRole('link', { name: v.portal }).getAttribute('href')).toBe(
      v.portal,
    );
    expect(within(section).getByRole('link', { name: v.website }).getAttribute('href')).toBe(
      v.website,
    );
  });

  it('covers rights, retention (with its placeholder), cookies, children and what comes later', async () => {
    const { container } = render(await Privacy());
    const s = p.sections;
    for (const title of [
      s.collect.title,
      s.why.title,
      s.children.title,
      s.sensitive.title,
      s.later.title,
      s.keep.title,
      s.cookies.title,
      s.security.title,
      s.rights.title,
      s.changes.title,
    ]) {
      expect(screen.getByRole('region', { name: title })).toBeTruthy();
    }
    const text = container.textContent ?? '';
    for (const line of [
      ...s.rights.items,
      ...s.keep.items,
      s.keep.schedule,
      ...s.cookies.items,
      ...s.later.items,
      ...s.collect.items,
    ]) {
      expect(text).toContain(line);
    }
  });

  it('names every column of the profile the learner fills in, the look included (A11-33)', async () => {
    const columns = columnsOf('profiles');
    expect(columns).toEqual(expect.arrayContaining(['display_name', 'theme', 'badge_ids']));
    render(await Privacy());
    const text = {
      collect: screen.getByRole('region', { name: p.sections.collect.title }).textContent ?? '',
      later: screen.getByRole('region', { name: p.sections.later.title }).textContent ?? '',
    };
    for (const column of columns) {
      expect(Object.keys(PROFILE_WORDS), `profiles.${column} is not described`).toContain(column);
      const rule = PROFILE_WORDS[column];
      if (rule) expect(text[rule.section], `profiles.${column}`).toMatch(rule.word);
    }
  });

  it('names plan maps as collected now, and only their words as later (A11-34)', async () => {
    // Since migration 0030 a map's template, each part's status and target month are kept for
    // every consent-ready learner; only the learner's own words wait for new consent wording.
    expect(SCHEMA).toContain("pgTable('plan_maps'");
    render(await Privacy());
    const collect = screen.getByRole('region', { name: p.sections.collect.title });
    const later = screen.getByRole('region', { name: p.sections.later.title });
    expect(collect.textContent).toMatch(/Plan maps you make under My goal/);
    expect(collect.textContent).toMatch(/how each part went/);
    expect(collect.textContent).toMatch(/month you aim for/);
    const laterItems = within(later)
      .getAllByRole('listitem')
      .map((li) => li.textContent ?? '');
    expect(laterItems.filter((item) => /plan map/i.test(item))).toEqual([
      expect.stringMatching(/^Your own words in a plan map/),
    ]);
    expect(laterItems.some((item) => /profile photo/.test(item))).toBe(true);
  });

  it('has a table of contents whose every link reaches a section', async () => {
    const { container } = render(await Privacy());
    const toc = screen.getByRole('navigation', { name: p.contentsLabel });
    const links = within(toc).getAllByRole('link');
    expect(links.length).toBeGreaterThan(10);
    for (const link of links) {
      const id = link.getAttribute('href')?.replace(/^#/, '') ?? '';
      expect(container.querySelector(`[id="${id}"]`), id).not.toBeNull();
    }
  });
});

describe('the ECTA s43 footer on every public page', () => {
  const pages: Array<[string, () => Promise<unknown>]> = [
    ['/', () => FrontDoor()],
    ['/sign-in', () => SignIn()],
    ['/help', () => Help()],
    ['/privacy', () => Privacy()],
    ['/consent/[token]', () => Consent({ params: Promise.resolve({ token: 'no-such-token' }) })],
  ];

  it.each(pages)('%s shows every s43 field and links to /privacy', async (_, page) => {
    render((await page()) as ReactElement);
    const footer = screen.getByRole('contentinfo');
    for (const [key, label] of Object.entries(p.businessLabels)) {
      expect(within(footer).getByText(label), key).toBeTruthy();
      expect(
        within(footer).getByText(p.business[key as keyof typeof p.business]),
        key,
      ).toBeTruthy();
    }
    expect(
      within(footer).getByRole('link', { name: p.footer.privacyLink }).getAttribute('href'),
    ).toBe('/privacy');
  });
});
