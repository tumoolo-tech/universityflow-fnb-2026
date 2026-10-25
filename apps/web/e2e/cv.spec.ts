import { expect, type Page, test } from '@playwright/test';
import {
  expectAccessible,
  goTo,
  newPhone,
  serverErrorsSince,
  serverLogMark,
  signIn,
  trackCspViolations,
} from './helpers';

/**
 * My CV (docs/design/mmereko-api-proposal.md §10.6 step 5) on a production build with the owner's
 * switch on (UF_CV=1 in playwright.config.ts) and the stand-in engine: a learner opens My CV from
 * the sidebar, opts in, adds a project, ticks it with their school, makes a CV, runs the dev job
 * runner as the routes describe (once to submit, again to collect) until the list says Ready,
 * opens it and downloads its PDF through the 60-second link, then stops using Mmereko with the
 * download offered first. The page passes axe at each step and at 360px never scrolls sideways.
 * Synthetic learner. Written by the CV-UI agent, run by the integrator.
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

test('a learner makes a CV, downloads it, and stops using Mmereko', async ({ page }) => {
  await signIn(page, newPhone());
  await page.getByLabel('Date of birth').fill('2000-03-15');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page
    .getByLabel('I have read what UniversityFlow does with my information, and I agree.')
    .check();
  await page.getByRole('button', { name: 'I agree to this' }).click();
  await page.getByLabel('Which grade are you in?').selectOption('11');
  await page.getByRole('button', { name: 'Start' }).click();
  await expect(page).toHaveURL(/\/home$/);

  // A first name and a school, as About me would hold them (the CV's name and education).
  const origin = new URL(page.url()).origin;
  const profile = await page.request.patch('/api/me', {
    headers: { origin },
    data: { displayName: 'Thandi', schoolName: 'Synthetic High School' },
  });
  expect(profile.ok()).toBe(true);

  await goTo(page, 'My CV');
  await expect(page).toHaveURL(/\/cv$/);
  await expect(page.getByRole('heading', { level: 1, name: 'My CV' })).toBeVisible();
  await expectAccessible(page);

  // Opt in: focus moves to "What goes on my CV".
  await page.getByRole('button', { name: 'Yes, make my CV with Mmereko' }).click();
  await expect(page.getByRole('heading', { name: 'What goes on my CV' })).toBeFocused();

  // An entry in their own words.
  await page.getByRole('button', { name: 'Add a project or skill' }).click();
  const form = page.getByRole('form', { name: 'Add a project or skill' });
  await form.getByLabel('Name', { exact: true }).fill('Weather station');
  await form.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Added Weather station.');
  await expect(page.getByRole('button', { name: 'Edit Weather station' })).toBeFocused();

  // Tick it, with the school, and a surname.
  const what = page.getByRole('region', { name: 'What goes on my CV' });
  await what.getByLabel('Surname').fill('Example');
  await what.getByLabel('Synthetic High School').check();
  await what.getByLabel('Weather station').check();
  await what.getByRole('button', { name: 'Save what goes on my CV' }).click();
  await expect(page.getByRole('status')).toHaveText('Saved what goes on your CV.');

  // Make it; the jobs run as a scheduler would.
  await page.getByRole('button', { name: 'Make my CV', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Your CV is being made.');
  const list = page.getByRole('region', { name: 'My CVs' });
  await expect(list.getByText('Being made')).toBeVisible();
  await expect(async () => {
    const run = await page.request.post('/api/dev/jobs/run', { headers: { origin }, data: {} });
    expect(run.ok()).toBe(true);
    await expect(list.getByText('Ready', { exact: true })).toBeVisible({ timeout: 6_000 });
  }).toPass({ timeout: 60_000 });
  await expect(page.getByRole('status')).toHaveText('Your CV is ready.');
  await expectAccessible(page);

  // The preview: the text, then the PDF through a fresh 60-second link.
  await list.getByRole('button', { name: /^Open My CV/ }).click();
  const preview = page.getByRole('region', { name: 'My CV: preview' });
  await expect(preview.getByRole('heading', { level: 2 })).toBeFocused();
  await expect(preview).toContainText('Weather station');
  await expectAccessible(page);
  const pdf = page.waitForResponse((r) => r.url().includes('/api/cv/pdf/'));
  await preview.getByRole('button', { name: 'Download PDF' }).click();
  const response = await pdf;
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toBe('application/pdf');

  // Stop using Mmereko: each CV's download is offered first.
  await page.goto('/cv');
  const stop = page.getByRole('region', { name: 'Stop using Mmereko' });
  await stop.getByRole('button', { name: 'Stop using Mmereko', exact: true }).click();
  await expect(stop.getByRole('button', { name: /^Download PDF/ })).toBeVisible();
  await expectAccessible(page);
  await stop.getByRole('button', { name: 'Yes, stop and delete my CVs' }).click();
  await expect(page.getByRole('status')).toContainText('stopped using Mmereko');
  await expect(page.getByRole('heading', { name: 'Make a CV with Mmereko' })).toBeFocused();

  // At a phone's width, nothing scrolls sideways.
  await page.setViewportSize({ width: 360, height: 780 });
  await noSidewaysScroll(page);
  await expectAccessible(page);
});
