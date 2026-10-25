import { expect, type Page, test } from '@playwright/test';
import { en } from '@universityflow/content';
import { expectAccessible, serverErrorsSince, serverLogMark, trackCspViolations } from './helpers';

/**
 * The judge demo's on-screen phone sign-up (a HACKATHON EXCEPTION the owner approved on
 * 2026-10-24, docs/deploy/demo.md), run by playwright.demo-phone.config.ts only (UF_DEPLOYMENT=demo,
 * UF_DEMO_PHONE_SIGNUP=onscreen). A judge signs up as a new learner the real way, on made-up
 * details: a made-up 080 number, the PIN shown on screen (nothing is sent), date of birth, consent
 * (an adult in their own name; an under-18 through a made-up guardian, whose link is shown on
 * screen too), onboarding, and the real learner's home. A cellphone number is refused, the
 * learner's and the guardian's. Axe on each page; no CSP violation, no unhandled server error.
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

const copy = en.demoPhoneSignup;

// A random start per run, so no run meets a number an earlier one took (a taken number is refused).
let n = Math.floor(Math.random() * 10_000_000);
/** A made-up toll-free number, built at runtime (hard rule 4). */
function tollFree(): string {
  n = (n + 1) % 10_000_000;
  return `080${String(n).padStart(7, '0')}`;
}
/** A cellphone-looking number, built at runtime: the demo must refuse it. */
function cellphone(): string {
  n = (n + 1) % 10_000_000;
  return `082${String(n).padStart(7, '0')}`;
}

let address = 0;
/** Each journey from its own address (TEST-NET-3): the PIN limit counts per address (gotcha 46). */
async function ownAddress(page: Page) {
  address = (address % 254) + 1;
  await page.setExtraHTTPHeaders({ 'x-forwarded-for': `203.0.113.${address}` });
}

/** From the landing page's way in to onboarding, with the PIN read off the screen; the number. */
async function signUpAsNewLearner(page: Page, phone = tollFree()): Promise<string> {
  await ownAddress(page);
  await page.goto('/');
  await page
    .getByRole('region', { name: en.home.barLabel })
    .getByRole('link', { name: copy.action, exact: true })
    .click();
  await expect(page).toHaveURL(/\/demo\/new-learner$/);
  await expect(page.getByRole('heading', { level: 1, name: copy.pageTitle })).toBeVisible();
  await expect(page.getByRole('region', { name: copy.noticeTitle })).toBeVisible();
  await expectAccessible(page);

  await page.getByLabel(copy.phoneLabel).fill(phone);
  await page.getByRole('button', { name: en.auth.sendPin, exact: true }).click();
  await expect(page.getByRole('heading', { name: en.auth.pinTitle, exact: true })).toBeVisible({
    timeout: 15_000,
  });
  const shown = page.getByRole('status').filter({ hasText: copy.pinOnScreenTitle });
  await expect(shown).toBeVisible();
  await expectAccessible(page);
  // The title and the PIN line are two paragraphs: their text runs together ("…PIN123456."), so
  // the PIN is the six digits with no digit either side, never a word boundary.
  const pin = (await shown.textContent())?.match(/(?<!\d)(\d{6})(?!\d)/)?.[1] ?? '';
  expect(pin).toMatch(/^\d{6}$/);
  await page.getByLabel(en.auth.pinLabel).fill(pin);
  await page.getByRole('button', { name: en.auth.verify, exact: true }).click();
  await expect(page).toHaveURL(/\/onboarding$/, { timeout: 20_000 });
  await expect(page.getByText(copy.onboardingNotice, { exact: true })).toBeVisible();
  return phone;
}

async function giveDateOfBirth(page: Page, date: string) {
  await page.getByLabel(en.onboarding.dobLabel).fill(date);
  await page.getByRole('button', { name: en.common.continue, exact: true }).click();
}

async function finishProfile(page: Page, name: string) {
  await expect(
    page.getByRole('heading', { level: 1, name: en.onboarding.profileTitle }),
  ).toBeVisible();
  await expectAccessible(page);
  await page.getByLabel(en.onboarding.displayName).fill(name);
  await page.getByRole('button', { name: en.onboarding.finish, exact: true }).click();
  await expect(page).toHaveURL(/\/home$/, { timeout: 20_000 });
  await expect(page.getByRole('note', { name: en.demo.bannerLabel })).toBeVisible();
  await expectAccessible(page);
}

test('an adult signs up with a made-up 080 number, agrees in their own name and reaches home', async ({
  page,
}) => {
  await signUpAsNewLearner(page);
  await expectAccessible(page);
  await giveDateOfBirth(page, '1990-05-05');
  await expect(page.getByRole('heading', { level: 1, name: en.adultConsent.title })).toBeVisible();
  await expectAccessible(page);
  await page.getByRole('checkbox', { name: en.privacyPage.adultConfirm }).check();
  await page.getByRole('button', { name: en.adultConsent.agree, exact: true }).click();
  await finishProfile(page, 'Made-up Judge');
});

test('an under-18 signs up, and the made-up guardian agrees through the link on screen', async ({
  page,
  browser,
}) => {
  await signUpAsNewLearner(page);
  const born = `${new Date().getUTCFullYear() - 15}-01-15`;
  await giveDateOfBirth(page, born);
  await expect(
    page.getByRole('heading', { level: 1, name: en.onboarding.guardianTitle }),
  ).toBeVisible();
  await expect(page.getByText(copy.guardianPhoneHint, { exact: true })).toBeVisible();
  await expectAccessible(page);

  // A guardian's cellphone number is refused: only made-up 080 numbers.
  await page.getByLabel(en.onboarding.guardianName).fill('Made-up Guardian');
  await page.getByLabel(en.onboarding.guardianPhone).fill(cellphone());
  await page.getByRole('button', { name: en.onboarding.sendRequest, exact: true }).click();
  await expect(page.getByText(copy.only080, { exact: true })).toBeVisible();

  await page.getByLabel(en.onboarding.guardianPhone).fill(tollFree());
  await page.getByRole('button', { name: en.onboarding.sendRequest, exact: true }).click();
  const shown = page.getByRole('region', { name: copy.guardianLinkTitle });
  await expect(shown).toBeVisible();
  await expectAccessible(page);
  const href = (await shown
    .getByRole('link', { name: copy.guardianLinkAction, exact: true })
    .getAttribute('href')) as string;
  expect(href).toMatch(/^\/consent\/[\w-]+$/);

  // The made-up guardian opens the link (in another browser, as on their own phone) and agrees.
  const guardian = await (
    await browser.newContext({ baseURL: new URL(page.url()).origin })
  ).newPage();
  await guardian.goto(href);
  await expectAccessible(guardian);
  await guardian.getByLabel(en.consent.agreeConfirm).check();
  await guardian.getByRole('button', { name: en.consent.agree, exact: true }).click();
  await expect(guardian.getByText(en.consent.granted, { exact: true })).toBeVisible();
  await guardian.close();

  // The waiting step's own Continue moves on now the guardian has agreed.
  await page.getByRole('button', { name: en.common.continue, exact: true }).click();
  await finishProfile(page, 'Made-up Learner');
});

test('a number another judge took is refused in another browser: pick another made-up number', async ({
  page,
  browser,
}) => {
  const phone = await signUpAsNewLearner(page);
  const other = await (await browser.newContext({ baseURL: new URL(page.url()).origin })).newPage();
  await ownAddress(other);
  await other.goto('/demo/new-learner');
  await other.getByLabel(copy.phoneLabel).fill(phone);
  await other.getByRole('button', { name: en.auth.sendPin, exact: true }).click();
  await expect(other.getByText(copy.numberTaken, { exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(other.getByRole('status').filter({ hasText: copy.pinOnScreenTitle })).toHaveCount(0);
  await expectAccessible(other);
  await other.close();
});

test('a cellphone number is refused, saying to use a made-up 080 number', async ({ page }) => {
  await ownAddress(page);
  await page.goto('/demo/new-learner');
  await page.getByLabel(copy.phoneLabel).fill(cellphone());
  await page.getByRole('button', { name: en.auth.sendPin, exact: true }).click();
  await expect(page.getByText(copy.only080, { exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('heading', { name: en.auth.pinTitle, exact: true })).toHaveCount(0);
  await expectAccessible(page);
});

test('the picker and /sign-in offer the way in; /sign-in still has no phone form', async ({
  page,
}) => {
  await page.goto('/demo');
  await expect(page.getByRole('link', { name: copy.action, exact: true })).toBeVisible();
  await expectAccessible(page);
  await page.goto('/sign-in');
  await expect(page.getByRole('link', { name: copy.action, exact: true })).toBeVisible();
  await expect(page.locator('input[type="tel"]')).toHaveCount(0);
  await expectAccessible(page);
});

test.describe('at a 360 px phone', () => {
  test.use({ viewport: { width: 360, height: 800 } });

  test('the sign-up page never scrolls sideways', async ({ page }) => {
    await page.goto('/demo/new-learner');
    const sideways = await page.evaluate(
      () => (document.scrollingElement?.scrollWidth ?? 0) - window.innerWidth,
    );
    expect(sideways).toBeLessThanOrEqual(0);
  });
});
