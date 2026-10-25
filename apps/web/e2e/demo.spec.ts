import { expect, type Page, test } from '@playwright/test';
import { en } from '@universityflow/content';
import {
  expectAccessible,
  openMenu,
  serverErrorsSince,
  serverLogMark,
  trackCspViolations,
} from './helpers';

/**
 * Judge demo mode (docs/deploy/demo.md), run by playwright.demo.config.ts only (UF_DEPLOYMENT=demo,
 * with the judges' real sign-up on its local stand-in, UF_DEMO_SIGNUP=fake):
 * - `/` is the real landing page, with "Demo for judges" leading to the picker at /demo;
 * - a judge picks each made-up learner in one press and lands on that learner's home, with the
 *   demo banner; "Switch learner" goes back to the picker; "Back to UniversityFlow" goes to the
 *   landing page and keeps the copy;
 * - /sign-in offers the picker and the sign-up, and no phone field;
 * - an adult signs up and reaches the adult agreement; an under-18 is refused and signed out.
 * Axe on each page; no CSP violation, no unhandled server error.
 */

let cspViolations: string[] = [];
let serverLog = 0;
test.beforeEach(async ({ page }) => {
  cspViolations = await trackCspViolations(page);
  serverLog = serverLogMark();
});
test.afterEach(async ({ page }) => {
  expect(cspViolations).toEqual([]);
  expect(await serverErrorsSince(serverLog, page)).toEqual([]);
});

const PERSONAS = Object.values(en.demoPersonas.personas);
const copy = en.demoSignup;

test('/ is the real landing page, with the judges’ entry to the picker', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: en.home.headline })).toBeVisible();
  const entry = page.getByRole('navigation', { name: copy.judgeEntryTitle });
  await expect(entry).toBeVisible();
  // The landing page is the main one: no demo banner there.
  await expect(page.getByRole('note', { name: en.demo.bannerLabel })).toHaveCount(0);
  await expectAccessible(page);
  await entry.getByRole('link', { name: copy.judgeEntryTitle, exact: true }).click();
  await expect(page).toHaveURL(/\/demo$/);
  await expect(page.getByRole('heading', { level: 1, name: en.demo.pickerTitle })).toBeVisible();
});

test('/sign-in offers the picker and the sign-up, and no phone field', async ({ page }) => {
  await page.goto('/sign-in');
  await expect(page.getByRole('link', { name: copy.pickerAction, exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: copy.ownAccountAction, exact: true })).toBeVisible();
  await expect(page.locator('input[type="tel"], input[inputmode="tel"]')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: en.auth.title, exact: true })).toHaveCount(0);
  await expectAccessible(page);
});

// The owner's decision, 2026-10-23: a profile photo from made-up SAMPLE pictures only.
test('a judge gives the learner a sample photo, and no file can be chosen', async ({ page }) => {
  const persona = PERSONAS[0];
  if (!persona) throw new Error('no demo learner');
  await page.goto('/demo');
  await page.getByRole('button', { name: en.demo.tryAs(persona.name), exact: true }).click();
  await expect(page).toHaveURL(/\/home$/, { timeout: 20_000 });
  await page.goto('/me');
  await page.getByRole('button', { name: en.profileLook.open, exact: true }).click();

  const samples = page.getByRole('group', { name: en.demo.samplePhotosLegend, exact: true });
  await expect(samples).toBeVisible();
  await expect(page.locator('input[type="file"]')).toHaveCount(0);
  await expectAccessible(page);

  const second = en.demo.samplePhotoName(2, en.demo.samplePhotos['sample-2']);
  await samples.getByRole('radio', { name: second, exact: true }).check();
  await page.getByRole('button', { name: en.demo.useSamplePhoto, exact: true }).click();
  await expect(page.getByTestId('photo-crop')).toBeVisible();
  await page.getByRole('button', { name: en.profilePhoto.zoomIn, exact: true }).click();
  await page.getByRole('button', { name: en.profilePhoto.save, exact: true }).click();
  await expect(page.getByText(en.profilePhoto.saved, { exact: true })).toBeVisible();
  await expect(page.locator('[data-avatar="photo"]')).toBeVisible();
  await expectAccessible(page);

  // Gone with the copy: "Switch learner" deletes it.
  await page.getByRole('button', { name: en.demo.switchLearner, exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: en.demo.pickerTitle })).toBeVisible();
});

for (const persona of PERSONAS) {
  test(`a judge tries UniversityFlow as ${persona.name} and lands on the home`, async ({
    page,
  }) => {
    await page.goto('/demo');
    await expect(page.getByRole('heading', { level: 1, name: en.demo.pickerTitle })).toBeVisible();
    await expect(page.getByRole('note', { name: en.demo.bannerLabel })).toContainText(
      en.demo.bannerNotice,
    );
    // A2-67: no learner chosen yet, so nothing to switch from.
    await expect(
      page.getByRole('button', { name: en.demo.switchLearner, exact: true }),
    ).toHaveCount(0);
    await expectAccessible(page);

    await page.getByRole('button', { name: en.demo.tryAs(persona.name), exact: true }).click();
    await expect(page).toHaveURL(/\/home$/, { timeout: 20_000 });
    await expect(page.getByRole('note', { name: en.demo.bannerLabel })).toBeVisible();
    await expectAccessible(page);

    // "Switch learner": the copy is deleted, and the judge is back at the picker, signed out.
    await page.getByRole('button', { name: en.demo.switchLearner, exact: true }).click();
    await expect(page.getByRole('heading', { level: 1, name: en.demo.pickerTitle })).toBeVisible();
    await expect(page).toHaveURL(/\/demo$/);
    await page.goto('/home');
    await expect(page).not.toHaveURL(/\/home$/);
  });
}

test('"Back to UniversityFlow" goes to the landing page and keeps the learner', async ({
  page,
}) => {
  await page.goto('/demo');
  const first = PERSONAS[0];
  if (!first) throw new Error('no personas');
  await page.getByRole('button', { name: en.demo.tryAs(first.name), exact: true }).click();
  await expect(page).toHaveURL(/\/home$/, { timeout: 20_000 });
  await page
    .getByRole('note', { name: en.demo.bannerLabel })
    .getByRole('link', { name: copy.backToMain, exact: true })
    .click();
  await expect(page.getByRole('heading', { level: 1, name: en.home.headline })).toBeVisible();
  await page.getByRole('link', { name: copy.backToYourLearner, exact: true }).click();
  await expect(page).toHaveURL(/\/home$/);
});

// ── The judge-demo walk (docs/audits/results/DEMO-walk.md) ─────────────────────────────────────

async function startAs(page: Page, name: string) {
  await page.goto('/demo');
  await page.getByRole('button', { name: en.demo.tryAs(name), exact: true }).click();
  await expect(page).toHaveURL(/\/home$/, { timeout: 20_000 });
}

const sideways = (page: Page) =>
  page.evaluate(() => (document.scrollingElement?.scrollWidth ?? 0) - window.innerWidth);

test.describe('at a 360 px phone', () => {
  test.use({ viewport: { width: 360, height: 800 } });

  // A2-63: the marks chart's eight axis labels widened Amahle's and Lerato's home to 410 px.
  for (const persona of PERSONAS) {
    test(`${persona.name}'s home never scrolls sideways`, async ({ page }) => {
      await startAs(page, persona.name);
      expect(await sideways(page)).toBeLessThanOrEqual(0);
    });
  }

  // A2-60: the sample-photo fieldset grew past the card, which cut off photos 4 and 5.
  test('all six sample photos and their words fit inside the screen', async ({ page }) => {
    const first = PERSONAS[0];
    if (!first) throw new Error('no personas');
    await startAs(page, first.name);
    await page.goto('/me');
    await page.getByRole('button', { name: en.profileLook.open, exact: true }).click();
    const samples = page.getByRole('group', { name: en.demo.samplePhotosLegend, exact: true });
    await expect(samples.getByRole('radio')).toHaveCount(6);
    const beyond = await samples.evaluate(
      (group) =>
        [...group.querySelectorAll('label, p')].filter(
          (el) => el.getBoundingClientRect().right > window.innerWidth,
        ).length,
    );
    expect(beyond).toBe(0);
  });
});

// A2-61: Thabo's goal wasn't on his shortlist, so his goal card's pack link was a 404.
test('the goal card’s application-pack link opens a pack', async ({ page }) => {
  const thabo = PERSONAS[0];
  if (!thabo) throw new Error('no personas');
  await startAs(page, thabo.name);
  await page.goto('/goals');
  const pack = page.locator('a[href^="/applications/"]').first();
  await pack.click();
  await expect(page).toHaveURL(/\/applications\/[a-z]+$/);
  await expect(page.getByRole('heading', { level: 1, name: en.errors.notFound })).toHaveCount(0);
  await expectAccessible(page);
});

// A2-66 and A2-68: Sipho and Kagiso got an arriving student's home, a chat asking for a school
// report, and the applicant's empty shortlist on Applications.
for (const [id, subtitle] of [
  ['demo-second-year', en.dashboard.subtitleYears.middle],
  ['demo-final-year', en.dashboard.subtitleYears.final],
] as const) {
  const persona = en.demoPersonas.personas[id];
  test(`${persona.name}'s home, chat and Applications are for his year at university`, async ({
    page,
  }) => {
    await startAs(page, persona.name);
    await expect(page.getByText(subtitle, { exact: true })).toBeVisible();
    await expect(page.getByText(en.dashboard.promo.campusLead, { exact: true })).toHaveCount(0);
    await expect(page.getByText(en.dashboard.chart.none, { exact: true })).toHaveCount(0);
    await expect(
      page.getByRole('link', { name: en.dashboard.promo.planAction, exact: true }),
    ).toBeVisible();
    await expectAccessible(page);
    await page.goto('/chat');
    await expect(page.getByText(en.chat.welcomeLeadLaterYears, { exact: true })).toBeVisible();
    await expect(page.getByText(en.chat.welcomeLead, { exact: true })).toHaveCount(0);
    await expectAccessible(page);
    await page.goto('/applications');
    await expect(page.getByText(en.applications.atUniversity, { exact: true })).toBeVisible();
    await expectAccessible(page);
  });
}

// Phase 6b: each university learner adds the SAMPLE outline for their first module and checks it
// part by part (the made-up learners record the draft adult-v3: hackathon exception I).
for (const [id, code] of [
  ['demo-first-year', 'DEMO1001'],
  ['demo-second-year', 'DEMO2001'],
  ['demo-final-year', 'DEMO3001'],
] as const) {
  const persona = en.demoPersonas.personas[id];
  const o = en.moduleOutline;
  test(`${persona.name} adds the SAMPLE module outline and checks it part by part`, async ({
    page,
  }) => {
    await startAs(page, persona.name);
    await page.goto('/modules');
    await page.getByRole('link', { name: o.fromModules.link, exact: true }).click();
    await expect(page).toHaveURL(/\/modules\/outline$/);
    await page.getByRole('button', { name: o.useSample, exact: true }).click();
    await expect(
      page.getByRole('heading', { name: o.sections.components, exact: true }),
    ).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText(o.components.total(100), { exact: true })).toBeVisible();
    await expectAccessible(page);
    for (const section of ['dates', 'books', 'people'] as const) {
      await page.getByRole('button', { name: o.confirmPart, exact: true }).click();
      await expect(
        page.getByRole('heading', { name: o.sections[section], exact: true }),
      ).toBeVisible();
    }
    await page.getByRole('button', { name: o.save, exact: true }).click();
    await expect(page.getByText(o.saved, { exact: true })).toBeVisible();
    await expect(
      page.getByRole('heading', { name: new RegExp(`^${code} · \\d{4}`) }),
    ).toBeVisible();
    await expectAccessible(page);
  });
}

// Phase 6c: the first-year learner's first module card, from the SAMPLE outline with made-up
// marks (Assignment 70% already in). Two marks typed and a 60% target: 26.5 of 40 points, so the
// exam needs 55.83%, shown as 56% and labelled "rounded up"; the DP is met; a free book is
// labelled as not the prescribed one.
test('a judge opens a module card, types two marks, sets 60% and reads what the exam needs', async ({
  page,
}) => {
  const card = en.moduleCard;
  const c = card.calculator;
  await startAs(page, en.demoPersonas.personas['demo-first-year'].name);
  await page.goto('/modules');
  await page.getByRole('link', { name: card.openFor('DEMO1001'), exact: true }).click();
  await expect(page).toHaveURL(/\/modules\/[0-9a-f-]{36}\/DEMO1001$/);
  await expect(page.getByText(card.demoSample, { exact: true })).toBeVisible();
  await expect(page.getByText(/^From the SAMPLE module outline/).first()).toBeVisible();
  await expectAccessible(page);

  await page.getByLabel(c.markLabel('Test 1'), { exact: true }).fill('60');
  await page.getByLabel(c.markLabel('Test 2'), { exact: true }).fill('70');
  await page.getByLabel(c.targetLabel, { exact: true }).fill('60');
  const target = page.getByTestId('calculator-target');
  await expect(target.getByText(c.needed(56), { exact: true })).toBeVisible();
  await expect(target.getByText(c.roundedUp('55.8'), { exact: true })).toBeVisible();
  await expect(page.getByTestId('calculator-dp')).toContainText(c.dp.met(c.admissionTerm, 40));
  await expect(
    page
      .getByTestId('card-free-books')
      .getByText(en.freeBooks.notPrescribed, { exact: true })
      .first(),
  ).toBeVisible();

  // Saved with the keyboard: the marks are there when the card opens again.
  await page.getByLabel(c.targetLabel, { exact: true }).press('Enter');
  await expect(page.getByText(c.saved, { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel(c.markLabel('Test 1'), { exact: true })).toHaveValue('60');
  await expectAccessible(page);
});

// A2-64: our own not-found page, in the app's theme.
test('a missing page is our own not-found page, and accessible', async ({ page }) => {
  const response = await page.goto('/no-such-page');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { level: 1, name: en.errors.notFound })).toBeVisible();
  await expectAccessible(page);
});

test('the judges’ guide: linked from the picker, and it starts a learner', async ({ page }) => {
  const guide = en.demoPersonas.guide;
  await page.goto('/demo');
  await page.getByRole('link', { name: guide.pickerLink, exact: true }).click();
  await expect(page).toHaveURL(/\/demo\/guide$/);
  await expect(page.getByRole('heading', { level: 1, name: guide.title })).toBeVisible();
  expect(await sideways(page)).toBeLessThanOrEqual(0);
  await expectAccessible(page);
  const naledi = en.demoPersonas.personas['demo-grade-11'];
  await page
    .getByRole('region', { name: guide.personaHeading(naledi.name, naledi.stage) })
    .getByRole('button', { name: en.demo.tryAs(naledi.name), exact: true })
    .click();
  await expect(page).toHaveURL(/\/home$/, { timeout: 20_000 });
});

/** Signs up on the fake (no Firebase) with a synthetic example.com address. */
async function signUp(page: Page, email: string) {
  await page.goto('/demo/sign-up');
  await expect(page.getByRole('heading', { level: 1, name: copy.title })).toBeVisible();
  await expect(page.getByRole('region', { name: copy.noticeTitle })).toBeVisible();
  await expectAccessible(page);
  await page.getByLabel(copy.emailLabel).fill(email);
  await page.getByRole('checkbox', { name: copy.agreeLabel }).check();
  await page.getByRole('button', { name: copy.fakeAction, exact: true }).click();
  await expect(page).toHaveURL(/\/onboarding$/, { timeout: 20_000 });
}

async function giveDateOfBirth(page: Page, date: string) {
  await page.getByLabel(en.onboarding.dobLabel).fill(date);
  await page.getByRole('button', { name: en.common.continue, exact: true }).click();
}

test('an adult judge signs up with their own account and reaches the adult agreement', async ({
  page,
}) => {
  await signUp(page, `adult-${Date.now()}@example.com`);
  await giveDateOfBirth(page, '1990-05-05');
  await expect(page.getByRole('heading', { level: 1, name: en.adultConsent.title })).toBeVisible();
  await expectAccessible(page);
});

// ── The demo's ways in (the owner, 2026-10-23, late: "nothing works" on the live demo) ──────────

const PHONE_FIELD = 'input[type="tel"], input[inputmode="tel"], input[inputmode="numeric"]';

for (const width of [360, 1280]) {
  test.describe(`a first-time visitor at ${width} px`, () => {
    test.use({ viewport: { width, height: 800 } });

    for (const way of [en.home.start, en.home.signIn]) {
      test(`"${way}" leads to the judges’ sign-up, never a phone form`, async ({ page }) => {
        await page.goto('/');
        // One plain sentence: a demo, made-up learners, not the real service.
        await expect(
          page
            .getByRole('region', { name: en.home.barLabel })
            .getByText(copy.landingDemoLine, { exact: true }),
        ).toBeAttached();
        await page
          .getByRole('region', { name: en.home.barLabel })
          .getByRole('link', { name: way, exact: true })
          .click();
        await expect(page).toHaveURL(/\/demo\/sign-up$/);
        await expect(page.getByRole('heading', { level: 1, name: copy.title })).toBeVisible();
        await expect(page.locator(PHONE_FIELD)).toHaveCount(0);
        expect(await sideways(page)).toBeLessThanOrEqual(0);
        await expectAccessible(page);
      });
    }

    test('/sign-in says what the demo is, offers both ways in, and has no phone form', async ({
      page,
    }) => {
      await page.goto('/sign-in');
      await expect(page.getByText(copy.landingDemoLine, { exact: true })).toBeVisible();
      await expect(page.getByRole('link', { name: copy.pickerAction, exact: true })).toBeVisible();
      await expect(page.locator(PHONE_FIELD)).toHaveCount(0);
      expect(await sideways(page)).toBeLessThanOrEqual(0);
      await expectAccessible(page);
    });
  });
}

test('the menu’s "Sign out" on a made-up learner goes back to the picker', async ({ page }) => {
  const first = PERSONAS[0];
  if (!first) throw new Error('no personas');
  await startAs(page, first.name);
  const signOut = page.getByRole('button', { name: en.nav.signOut, exact: true });
  await openMenu(page, signOut);
  await signOut.click();
  await expect(page).toHaveURL(/\/demo$/);
  await expect(page.getByRole('heading', { level: 1, name: en.demo.pickerTitle })).toBeVisible();
  // Signed out, and coming back: /home goes to the demo's ways in, never a phone form.
  await page.goto('/home');
  await expect(page).not.toHaveURL(/\/home$/);
  await expect(page.locator(PHONE_FIELD)).toHaveCount(0);
});

test('a judge already on a learner: /sign-in goes to their home, / keeps the way back', async ({
  page,
}) => {
  const first = PERSONAS[0];
  if (!first) throw new Error('no personas');
  await startAs(page, first.name);
  await page.goto('/sign-in');
  await expect(page).toHaveURL(/\/home$/);
  await page.goto('/');
  await expect(page.getByRole('link', { name: copy.backToYourLearner, exact: true })).toBeVisible();
});

test('phone sign-in answers a plain "not found" on the demo', async ({ page }) => {
  await page.goto('/');
  const response = await page.request.post('/api/auth/request-pin', {
    data: { phone: '0800000000' },
    headers: { origin: new URL(page.url()).origin },
  });
  expect(response.status()).toBe(404);
  expect(await response.json()).toEqual({ error: 'not-found', detail: null });
});

test('an under-18 is refused, the account deleted and signed out', async ({ page }) => {
  await signUp(page, `minor-${Date.now()}@example.com`);
  await giveDateOfBirth(page, '2010-05-05');
  await expect(page.getByText(copy.adultsOnly)).toBeVisible();
  await expect(page.getByRole('link', { name: copy.adultsOnlyAction, exact: true })).toBeVisible();
  await page.goto('/home');
  await expect(page).not.toHaveURL(/\/home$/);
});
