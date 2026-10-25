import { expect, type Page, test } from '@playwright/test';
import {
  expectAccessible,
  newPhone,
  serverErrorsSince,
  serverLogMark,
  signIn,
  trackCspViolations,
} from './helpers';

/**
 * The About me card and "Make it yours" (docs/design/profile-look-proposal.md, step 5) on a
 * production build: chosen, saved and still there after a reload; axe with the picker closed and
 * open, at a 360px phone and a 1280px laptop; never a sideways scroll. Set UF_E2E_SHOTS to a
 * folder to keep a screenshot of each. Synthetic learner.
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

async function noSidewaysScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

async function shot(page: Page, name: string) {
  const folder = process.env['UF_E2E_SHOTS'];
  if (folder) await page.screenshot({ path: `${folder}/${name}.png`, fullPage: true });
}

test('a learner makes the About me card theirs, and it stays', async ({ page }) => {
  await signIn(page, newPhone());
  await page.getByLabel('Date of birth').fill('2000-03-15');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page
    .getByLabel('I have read what UniversityFlow does with my information, and I agree.')
    .check();
  await page.getByRole('button', { name: 'I agree to this' }).click();
  await page.getByLabel('What should we call you?').fill('Thando');
  await page.getByLabel('Which grade are you in?').selectOption('10');
  await page.getByRole('button', { name: 'Start' }).click();
  await expect(page).toHaveURL(/\/home$/);

  await page.goto('/me');
  const card = page.getByRole('region', { name: 'Thando' });
  await expect(card).toBeVisible();
  await expect(card.getByText('Grade 10')).toBeVisible();

  for (const width of [360, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    await noSidewaysScroll(page);
    await expectAccessible(page);
    await shot(page, `about-me-${width}`);
  }
  if (process.env['UF_E2E_SHOTS']) {
    await page
      .locator('.uf-look-figure')
      .screenshot({ path: `${process.env['UF_E2E_SHOTS']}/figure-1280.png` });
  }

  const open = page.getByRole('button', { name: 'Make it yours' });
  await open.click();
  await expect(open).toHaveAttribute('aria-expanded', 'true');
  // The swatches and tiles are what a learner taps: the radio inside each is visually hidden.
  for (const name of ['Sunrise', 'Rocket']) {
    const radio = page.getByRole('radio', { name });
    await page.locator('label').filter({ has: radio }).click();
    await expect(radio).toBeChecked();
  }
  await page.getByLabel('Tagline').selectOption({ label: 'Small steps, big future.' });
  for (const word of ['Future engineer', 'Loves maths', 'Night owl']) {
    await page.getByRole('checkbox', { name: word }).check();
  }
  // A fourth word stays unticked, and says why.
  // `aria-disabled` keeps it focusable (A3-12); Playwright won't tap it unless forced to.
  await page.getByRole('checkbox', { name: 'Bookworm' }).click({ force: true });
  await expect(page.getByRole('checkbox', { name: 'Bookworm' })).not.toBeChecked();
  await expect(page.getByText('You can choose 3. Untick one to choose another.')).toBeVisible();

  for (const width of [360, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    await noSidewaysScroll(page);
    await expectAccessible(page);
    await shot(page, `make-it-yours-${width}`);
  }

  await page.getByRole('button', { name: 'Save' }).first().click();
  await expect(page.getByRole('status').filter({ hasText: 'Saved.' })).toBeVisible();
  await page.reload();
  const words = page.getByRole('list', { name: 'My words' });
  await expect(words.getByRole('listitem')).toHaveText([
    'Future engineer',
    'Loves maths',
    'Night owl',
  ]);
  await expect(card.locator('p', { hasText: 'Small steps, big future.' })).toBeVisible();
  await page.setViewportSize({ width: 360, height: 800 });
  await expectAccessible(page);
  await shot(page, 'about-me-saved-360');
  if (process.env['UF_E2E_SHOTS']) {
    await page.setViewportSize({ width: 1280, height: 900 });
    // The line starts drawing when it first shows (it is hidden on a phone): let it finish.
    await page.waitForTimeout(2_000);
    await page
      .locator('.uf-look-poster')
      .screenshot({ path: `${process.env['UF_E2E_SHOTS']}/poster-1280.png` });
  }
});

test('long words stay whole inside the card, at 360, 640 (a laptop at 200%) and 1280 (A2-32)', async ({
  page,
}) => {
  await signIn(page, newPhone());
  await page.getByLabel('Date of birth').fill('2000-03-15');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page
    .getByLabel('I have read what UniversityFlow does with my information, and I agree.')
    .check();
  await page.getByRole('button', { name: 'I agree to this' }).click();
  await page.getByLabel('What should we call you?').fill('Ayanda');
  await page.getByLabel('Which grade are you in?').selectOption('10');
  await page.getByRole('button', { name: 'Start' }).click();
  await expect(page).toHaveURL(/\/home$/);
  await page.goto('/me');

  const open = page.getByRole('button', { name: 'Make it yours' });
  await open.click();
  // The three longest words.
  for (const word of [
    'First in my family to go',
    'Future business owner',
    'Likes helping people',
  ]) {
    await page.getByRole('checkbox', { name: word, exact: true }).check();
  }
  await page.getByRole('button', { name: 'Save', exact: true }).first().click();
  await expect(page.getByRole('status').filter({ hasText: 'Saved.' })).toBeVisible();
  // A2-28: Save closed the picker, and focus went back to its button.
  await expect(open).toBeFocused();

  const card = page.getByRole('region', { name: 'Ayanda' });
  for (const width of [360, 640, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await noSidewaysScroll(page);
    const box = await card.boundingBox();
    expect(box).not.toBeNull();
    for (const chip of await card.getByRole('listitem').all()) {
      const c = await chip.boundingBox();
      expect(c, `a word at ${width}px`).not.toBeNull();
      if (!box || !c) continue;
      // Wholly inside the card, which cuts off anything past its edge.
      expect(c.x, `${await chip.textContent()} at ${width}px`).toBeGreaterThanOrEqual(box.x);
      expect(c.x + c.width, `${await chip.textContent()} at ${width}px`).toBeLessThanOrEqual(
        box.x + box.width,
      );
    }
    await shot(page, `long-words-${width}`);
  }
});

test('the card stays still for a learner who asks for reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await signIn(page, newPhone());
  await page.getByLabel('Date of birth').fill('2000-03-15');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page
    .getByLabel('I have read what UniversityFlow does with my information, and I agree.')
    .check();
  await page.getByRole('button', { name: 'I agree to this' }).click();
  await page.getByLabel('What should we call you?').fill('Lerato');
  await page.getByLabel('Which grade are you in?').selectOption('11');
  await page.getByRole('button', { name: 'Start' }).click();
  await expect(page).toHaveURL(/\/home$/);
  await page.goto('/me');
  await expect(page.getByRole('region', { name: 'Lerato' })).toBeVisible();
  // No running animation on the card, and its line is drawn in full from the start.
  const running = await page.evaluate(
    () =>
      document.getAnimations().filter((a) => {
        const target = (a.effect as KeyframeEffect | null)?.target;
        return a.playState === 'running' && target instanceof Element && target.closest('.uf-look');
      }).length,
  );
  expect(running).toBe(0);
  const offset = await page
    .locator('.uf-look-line')
    .first()
    .evaluate((line) => getComputedStyle(line).strokeDasharray);
  // One solid stroke, no dash.
  expect(offset).toBe('none');
});
