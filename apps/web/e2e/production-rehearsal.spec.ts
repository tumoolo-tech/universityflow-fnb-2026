import { expect, type Page, test } from '@playwright/test';
import {
  expectAccessible,
  lastSms,
  newPhone,
  openMenu,
  serverErrorsSince,
  serverLogMark,
  signIn,
  trackCspViolations,
} from './helpers';

/**
 * The production rehearsal (docs/deploy/production.md): the real learner's journey on a
 * production build configured as the launch will be, with the stand-ins in place of the owner's
 * accounts (e2e/production-rehearsal-env.ts says exactly what differs). Its own config and port:
 * `pnpm --filter @universityflow/web exec playwright test -c e2e/playwright.production.config.ts`.
 *
 * Phone sign-up with a PIN by SMS, a minor's guardian agreeing through the SMS link, an adult
 * agreeing in their own name, signing out and in again, deleting the account; and nothing of the
 * judge demo anywhere.
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

/** The nav's Sign out, behind the Menu button on a phone. */
async function signOut(page: Page): Promise<void> {
  const button = page
    .getByRole('navigation', { name: 'Main' })
    .getByRole('button', { name: 'Sign out', exact: true });
  await openMenu(page, button);
  await button.click();
  await expect(page).toHaveURL(/\/$/);
  // Signed out: a signed-in page sends the browser to sign in.
  await page.goto('/home');
  await expect(page).toHaveURL(/\/sign-in$/);
}

/** Hard rule 5's guard and the onboarding steps after a date of birth, for a learner of 11. */
async function aboutYou(page: Page, name: string): Promise<void> {
  await expect(page.getByRole('heading', { name: 'Tell us a little about you' })).toBeVisible();
  await page.getByLabel('What should we call you?').fill(name);
  await page.getByLabel('Which grade are you in?').selectOption('11');
  await page.getByRole('button', { name: 'Start' }).click();
  await expect(page).toHaveURL(/\/home$/);
  await expect(page.getByRole('heading', { level: 1, name: `Welcome, ${name}` })).toBeVisible();
}

/**
 * One number may ask for a PIN once a minute (OTP_COOLDOWN_MS in packages/db, 60 s), so a learner
 * signing in again straight after signing out is told "Too many tries". The journeys below are one
 * serial story, interleaved so the minute mostly passes in the other learner's steps; before a
 * number's next PIN, this waits out whatever is left of its minute. The product's limits and the
 * suite's waits are unchanged.
 */
const PIN_COOLDOWN_MS = 61_000;
const lastPinAt = new Map<string, number>();

async function signInAgain(page: Page, phone: string): Promise<void> {
  const last = lastPinAt.get(phone);
  if (last !== undefined)
    await page.waitForTimeout(Math.max(0, last + PIN_COOLDOWN_MS - Date.now()));
  lastPinAt.set(phone, Date.now());
  await signIn(page, phone);
}

test.describe
  .serial('the real journey: sign up, consent, sign out and in, delete', () => {
    const minor = newPhone();
    const adult = newPhone();

    test('a minor signs up by PIN, and a guardian agrees through the SMS link', async ({
      page,
      browser,
    }) => {
      await signInAgain(page, minor);
      await expect(page.getByRole('heading', { name: 'When were you born?' })).toBeVisible();
      await page.getByLabel('Date of birth').fill('2010-06-06');
      await page.getByRole('button', { name: 'Continue' }).click();
      await expect(
        page.getByRole('heading', { name: 'A parent or guardian needs to say yes' }),
      ).toBeVisible();
      await expectAccessible(page);

      const guardianPhone = newPhone();
      await page.getByLabel('Their name').fill('Test Guardian');
      await page.getByLabel('Their cellphone number').fill(guardianPhone);
      await page.getByRole('button', { name: 'Send them the link' }).click();
      await expect(
        page.getByRole('heading', { name: 'Waiting for your parent or guardian' }),
      ).toBeVisible();
      // Hard rule 5: nothing of the learner's until the guardian agrees.
      await page.goto('/home');
      await expect(page).toHaveURL(/\/onboarding$/);

      // At night the SMS waits for 07:00 (A12-04): the stand-in's job runner delivers it as at 18:00.
      if ((await lastSms(page, guardianPhone)) === '') {
        const now = new Date();
        const tomorrow = new Date(
          Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 16),
        ).toISOString();
        const origin = new URL(page.url()).origin;
        const ran = await page.request.post('/api/dev/jobs/run', {
          headers: { origin },
          data: { at: tomorrow },
        });
        expect(ran.status()).toBe(200);
      }
      const link =
        (await lastSms(page, guardianPhone)).match(/https?:\/\/\S+\/consent\/[\w-]+/)?.[0] ?? '';
      expect(link).not.toBe('');
      const guardian = await (await browser.newContext()).newPage();
      const guardianViolations = await trackCspViolations(guardian);
      await guardian.goto(link);
      await expect(
        guardian.getByRole('heading', { name: 'A learner has asked for your permission' }),
      ).toBeVisible();
      await expectAccessible(guardian);
      await guardian.getByLabel(/I am this learner’s parent or legal guardian/).check();
      await guardian.getByRole('button', { name: 'I agree', exact: true }).click();
      await expect(guardian.getByText(/The learner can now use UniversityFlow/)).toBeVisible();
      expect(guardianViolations).toEqual([]);

      await page.goto('/onboarding');
      await aboutYou(page, 'Lindi');
      await expectAccessible(page);
      await signOut(page);
    });

    test('an adult agrees in their own name', async ({ page }) => {
      await signInAgain(page, adult);
      await page.getByLabel('Date of birth').fill('2000-03-15');
      await page.getByRole('button', { name: 'Continue' }).click();
      await expect(page.getByRole('heading', { name: 'Before you start' })).toBeVisible();
      await expectAccessible(page);
      await page
        .getByLabel('I have read what UniversityFlow does with my information, and I agree.')
        .check();
      await page.getByRole('button', { name: 'I agree to this' }).click();
      await aboutYou(page, 'Sipho');

      // Only verified catalogue records reach a learner in production: none are yet (hard rule 3),
      // so no course card says "Not yet verified" and nothing is labelled a draft.
      await expect(page.getByText('Not yet verified', { exact: true })).toHaveCount(0);
      await signOut(page);
    });

    test('the minor signs in again, still agreed to, and deletes the account', async ({ page }) => {
      await signInAgain(page, minor);
      await expect(page).toHaveURL(/\/home$/, { timeout: 15_000 });
      await expect(page.getByRole('heading', { level: 1, name: 'Welcome, Lindi' })).toBeVisible();

      // Delete my account, on About me.
      await page.goto('/me');
      await page.getByLabel('Type DELETE to confirm').fill('DELETE');
      await page.getByRole('button', { name: 'Delete everything', exact: true }).click();
      await expect(page).toHaveURL(/\/$/);
      await page.goto('/home');
      await expect(page).toHaveURL(/\/sign-in$/);
    });

    test('the adult signs in again and is still in', async ({ page }) => {
      await signInAgain(page, adult);
      await expect(page).toHaveURL(/\/home$/, { timeout: 15_000 });
      await expect(page.getByRole('heading', { level: 1, name: 'Welcome, Sipho' })).toBeVisible();
    });

    test('production shows nothing of the demo: no judges’ entry, picker, guide, sign-up or samples', async ({
      page,
    }) => {
      expect((await page.request.get('/api/health')).status()).toBe(200);
      await page.goto('/');
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expect(page.getByText('Demo for judges', { exact: true })).toHaveCount(0);
      await expect(
        page.getByText('Demo: made-up learners. Don’t type real personal details.'),
      ).toHaveCount(0);
      await expect(page.getByText('Staging', { exact: true })).toHaveCount(0);
      for (const path of ['/demo', '/demo/guide', '/demo/sign-up']) {
        expect((await page.request.get(path)).status(), path).toBe(404);
      }
      const origin = new URL(page.url()).origin;
      for (const path of [
        '/api/demo/start',
        '/api/demo/switch',
        '/api/demo/sign-up',
        '/api/demo/sample-report',
      ]) {
        const response = await page.request.post(path, { headers: { origin }, data: {} });
        expect(response.status(), path).toBe(404);
      }
      expect((await page.request.get('/api/demo/sample-photos/sample-1')).status()).toBe(404);
      // Sign-in is the phone PIN, not the picker.
      await page.goto('/sign-in');
      await expect(
        page.getByRole('heading', { level: 1, name: 'Sign in with your cellphone number' }),
      ).toBeVisible();
      await expect(page.getByLabel('Cellphone number')).toBeVisible();
      await expect(page.getByText('Try UniversityFlow as…', { exact: true })).toHaveCount(0);
      await expectAccessible(page);
    });

    test('the deleted minor’s number starts again from nothing', async ({ page }) => {
      await signInAgain(page, minor);
      await expect(page.getByRole('heading', { name: 'When were you born?' })).toBeVisible();
    });
  });
