import { describe, expect, it } from 'vitest';
import { en } from './en';

/**
 * Wave 10's launch words (A6-04, A6-05, A6-06): a search description for every public page, and
 * the demo's words now that module cards with a mark calculator have shipped (#129). New keys
 * only, each after the keys that were there before it.
 */

const DESCRIPTIONS: Record<string, string> = {
  '/': en.home.description,
  '/privacy': en.privacyPage.description,
  '/help': en.dashboard.help.description,
  '/colleges/registered': en.colleges.check.description,
  '/sign-in': en.auth.description,
  '/demo': en.demo.description,
  '/demo/guide': en.demoPersonas.guide.description,
  '/demo/sign-up': en.demoSignup.pageDescription,
  '/demo/new-learner': en.demoPhoneSignup.pageDescription,
};

const sitsAfter = (section: object, key: string, before: ReadonlyArray<string>) => {
  const keys = Object.keys(section);
  for (const old of before)
    expect(keys.indexOf(key), `${key} after ${old}`).toBeGreaterThan(keys.indexOf(old));
};

describe('a search description for every public page (A6-04, A6-05)', () => {
  it.each(Object.entries(DESCRIPTIONS))('%s: its own, 100 to 160 characters', (path, text) => {
    expect(text.length, path).toBeGreaterThanOrEqual(100);
    expect(text.length, path).toBeLessThanOrEqual(160);
    expect(text, path).not.toBe(en.app.tagline);
  });

  it('no two pages share one', () => {
    const texts = Object.values(DESCRIPTIONS);
    expect(new Set(texts).size).toBe(texts.length);
  });

  it('the college check’s is shorter than its 199-character lead', () => {
    expect(en.colleges.check.description.length).toBeLessThan(en.colleges.check.lead.length);
    expect(en.colleges.check.description).toMatch(/TVET/);
  });

  it('the demo’s are honest that the learners are made up', () => {
    expect(en.demo.description).toMatch(/made up/);
    expect(en.demoPhoneSignup.pageDescription).toMatch(/080/);
    // The judges' own accounts (adults, their own details): never the real service.
    expect(en.demoSignup.pageDescription).toMatch(/18/);
    expect(en.demoSignup.pageDescription).toMatch(/not the real service/);
  });

  it('the demo’s /sign-in has a title of its own', () => {
    expect(en.demo.signInPageTitle).not.toBe(en.demo.signInTitle);
    expect(en.demo.signInPageTitle).not.toMatch(/cellphone|phone/i);
  });

  it('sits after the keys that were there before it', () => {
    sitsAfter(en.home, 'description', ['title', 'lead', 'barHere']);
    sitsAfter(en.dashboard.help, 'description', ['title', 'lead', 'back']);
    sitsAfter(en.colleges.check, 'description', ['title', 'lead', 'dhetRegisters']);
    sitsAfter(en.auth, 'description', ['title', 'errors', 'devOutbox']);
    sitsAfter(en.demo, 'description', ['signInTitle', 'realPhotoLeadAccount']);
    sitsAfter(en.demo, 'signInPageTitle', ['signInTitle', 'realPhotoLeadAccount']);
    sitsAfter(en.demoPersonas.guide, 'description', ['title', 'back']);
    sitsAfter(en.demoSignup, 'pageDescription', ['pageTitle', 'invalidEmail']);
    sitsAfter(en.demoPhoneSignup, 'pageDescription', ['pageTitle', 'numberTaken']);
  });
});

describe('the demo’s front door says where information is kept (the owner, 2026-10-25)', () => {
  it('the real service’s promise is unchanged', () => {
    expect(en.home.barHere).toBe('Your information stays in South Africa');
    expect(en.home.free).toBe('Free for learners. Your information stays in South Africa.');
  });

  it('the demo’s: real learners’ information will stay in South Africa, and the demo runs in London', () => {
    expect(en.home.barHereDemo).toBe('Real learners’ information will stay in South Africa');
    expect(en.home.barHereDemoWhere).toBe('This demo runs in London, on made-up learners.');
    expect(en.home.freeDemo).toBe(
      'Free for learners. Real learners’ information will stay in South Africa; this demo runs in London.',
    );
    for (const words of [en.home.barHereDemo, en.home.barHereDemoWhere, en.home.freeDemo]) {
      expect(words).not.toMatch(/stays in South Africa/);
      expect(words).not.toContain("'");
    }
  });

  it('sits after the keys that were there before it', () => {
    for (const key of ['barHereDemo', 'barHereDemoWhere', 'freeDemo'])
      sitsAfter(en.home, key, ['free', 'barHere', 'description']);
  });
});

describe('the demo’s words since module marks shipped (A6-06)', () => {
  const next = en.demoPersonas.comingNext;
  const guide = en.demoPersonas.guide;

  it('“coming next” names weak spots, not module marks', () => {
    expect(next.weakSpots.name).not.toMatch(/marks/i);
    expect(next.weakSpots.line).not.toMatch(/marks in one place/);
    sitsAfter(next, 'weakSpots', ['title', 'lead', 'label', 'items']);
  });

  it('the guide’s honest list keeps its lines but the stale one, and says the module cards are SAMPLES', () => {
    const stale = guide.honest.at(-1) as string;
    expect(guide.honestNow).not.toContain(stale);
    expect(guide.honestNow.slice(0, guide.honest.length - 1)).toEqual(guide.honest.slice(0, -1));
    expect(guide.honestNow).toContain(guide.honestModuleCards);
    expect(guide.honestModuleCards).toMatch(/SAMPLE/);
    expect(guide.honestNow.join(' ')).toMatch(/still being built/);
    sitsAfter(guide, 'honestNow', ['honest', 'tries', 'back']);
    sitsAfter(guide, 'honestModuleCards', ['honest', 'tries', 'back']);
  });

  it('every learner still has two to four things to try, with the module card and the sample outline', () => {
    for (const [id, tries] of Object.entries(guide.tries)) {
      const more = (guide.moreTries as Record<string, ReadonlyArray<string>>)[id] ?? [];
      expect(tries.length + more.length, id).toBeGreaterThanOrEqual(2);
      expect(tries.length + more.length, id).toBeLessThanOrEqual(4);
    }
    for (const id of Object.keys(guide.moreTries)) {
      expect(Object.keys(en.demoPersonas.personas), id).toContain(id);
    }
    expect(guide.moreTries['demo-second-year'].join(' ')).toContain(en.moduleCard.calculator.title);
    expect(guide.moreTries['demo-final-year'].join(' ')).toContain(en.moduleOutline.useSample);
    sitsAfter(guide, 'moreTries', ['tries', 'back']);
  });
});
