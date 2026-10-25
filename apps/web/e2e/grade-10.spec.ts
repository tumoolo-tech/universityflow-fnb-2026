import { expect, type Page, test } from '@playwright/test';
import {
  expectAccessible,
  goTo,
  lastSms,
  newPhone,
  serverErrorsSince,
  serverLogMark,
  signIn,
  trackCspViolations,
} from './helpers';

/**
 * S1's journey (planning §18.6): a Grade 10 learner, 15 and so a minor, from sign-in to Stage 0.
 * The guardian agrees through the SMS link; the home is Stage 0 (Report · Subjects · Goal ·
 * Study) and never says "qualify"; a confirmed Grade 10 report with Mathematical Literacy is
 * "on track", and My subjects shows the doors it closes. Axe on every page; like every journey,
 * no CSP violation and no unhandled server error. Synthetic learner and marks.
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

/** A 15-year-old's guardian agrees through the link in their SMS. */
async function guardianAgrees(page: Page, browser: import('@playwright/test').Browser) {
  const guardianPhone = newPhone();
  await page.getByLabel('Their name').fill('Test Guardian');
  await page.getByLabel('Their cellphone number').fill(guardianPhone);
  await page.getByRole('button', { name: 'Send them the link' }).click();
  await expect(
    page.getByRole('heading', { name: 'Waiting for your parent or guardian' }),
  ).toBeVisible();
  // At night the SMS waits for 07:00 (A12-04): the dev runner delivers it as at 18:00 tomorrow.
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
  const guardian = await (await browser.newContext()).newPage();
  await guardian.goto(link);
  await guardian.getByLabel(/I am this learner’s parent or legal guardian/).check();
  await guardian.getByRole('button', { name: 'I agree', exact: true }).click();
  await expect(guardian.getByText(/The learner can now use UniversityFlow/)).toBeVisible();
  await guardian.close();
}

test('a Grade 10 learner: Stage 0 on the home, a Grade 10 report on track, and My subjects', async ({
  page,
  browser,
}) => {
  await signIn(page, newPhone());
  // Fifteen this year: a minor, so a guardian agrees first (hard rule 5).
  const born = `${new Date().getUTCFullYear() - 15}-01-15`;
  await page.getByLabel('Date of birth').fill(born);
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(
    page.getByRole('heading', { name: 'A parent or guardian needs to say yes' }),
  ).toBeVisible();
  await guardianAgrees(page, browser);

  await page.goto('/onboarding');
  await page.getByLabel('What should we call you?').fill('Thando');
  await page.getByLabel('Which grade are you in?').selectOption('10');
  await page.getByRole('button', { name: 'Start' }).click();

  // The home: Stage 0, never "qualify", the report first.
  await expect(page).toHaveURL(/\/home$/);
  await expect(
    page.getByText('Grade 10 · your subjects, marks and goal at a glance'),
  ).toBeVisible();
  const journey = page.getByRole('region', { name: 'Your journey' });
  await expect(journey.getByRole('listitem')).toHaveText([
    /^1Report\s*Now$/,
    /^2Subjects\s*To do$/,
    /^3Goal\s*To do$/,
    /^4Study\s*To do$/,
  ]);
  await expect(page.getByRole('region', { name: 'Courses you’re on track for' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Courses you qualify for now' })).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'My applications' })).toHaveCount(0);
  await expectAccessible(page);

  // A final Grade 10 report, typed in and confirmed, with Mathematical Literacy (hard rule 6).
  await goTo(page, 'Documents');
  await page.getByRole('button', { name: 'Type in your marks' }).click();
  await expect(page.getByLabel('Which report is this?')).toHaveValue('grade-10-final');
  const marks: Array<[string, string]> = [
    ['isiZulu Home Language', '78'],
    ['English First Additional Language', '72'],
    ['Mathematical Literacy', '81'],
    ['Life Sciences', '74'],
    ['Geography', '70'],
    ['History', '68'],
    ['Life Orientation', '85'],
  ];
  for (const [index, [subject, percent]] of marks.entries()) {
    await page.getByLabel(`Subject ${index + 1}`, { exact: true }).selectOption({ label: subject });
    await page.getByLabel('Mark (%)').nth(index).fill(percent);
  }
  await page.getByRole('button', { name: 'These marks are correct' }).click();

  // My results on Grade 10 marks: where they're heading, never "You qualify now" (G10-3).
  await expect(page.getByText(/^Based on the Grade 10 marks you confirmed/)).toBeVisible();
  await expect(page.getByRole('heading', { name: /You qualify now/ })).toHaveCount(0);
  await expectAccessible(page);

  // The home again: the report done, the subjects checked, the goal next.
  await goTo(page, 'Home');
  await expect(journey.getByRole('listitem')).toHaveText([
    /^1Report\s*Done$/,
    /^2Subjects\s*Done$/,
    /^3Goal\s*Now$/,
    /^4Study\s*To do$/,
  ]);
  const subjects = page.getByRole('region', { name: 'Your subjects' });
  await expect(subjects.getByTestId('home-subjects')).toHaveText(
    /^\d+ courses? need a subject you don’t take$/,
  );
  await expectAccessible(page);

  // My subjects: Mathematical Literacy closes courses that need Mathematics.
  await subjects.getByRole('link', { name: 'Check my subjects' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'My subjects' })).toBeVisible();
  await expect(page.getByTestId('subjects-list')).toContainText('Mathematical Literacy');
  await expect(page.getByTestId('subjects-summary')).toHaveText(
    /^Your subjects close \d+ of the \d+ courses here, whatever your marks\.$/,
  );
  // The redesign (G10-4, round 2): the verdict is the first heading; the closed courses are
  // grouped by what they need, each group a disclosure with its count.
  await expect(page.getByRole('heading', { level: 2 }).first()).toHaveAttribute(
    'data-testid',
    'subjects-summary',
  );
  const closes = page.getByRole('region', { name: 'Courses your subjects close' });
  const maths = closes
    .locator('summary')
    .filter({ hasText: /^Needs Mathematics( or Technical Mathematics)?\d+ courses?$/ })
    .first();
  await expect(maths).toBeVisible();
  await maths.click();
  await expect(maths.locator('xpath=..')).toHaveAttribute('open', '');
  await expectAccessible(page);

  // Filter by university: a native select and Show; the verdict stays whole.
  const verdict = await page.getByTestId('subjects-summary').textContent();
  await closes.getByLabel('Show courses at').selectOption({ label: 'University of Johannesburg' });
  await closes.getByRole('button', { name: 'Show' }).click();
  await expect(
    page.getByRole('region', { name: 'Courses your subjects close at University of Johannesburg' }),
  ).toBeVisible();
  await expect(page.getByTestId('subjects-summary')).toHaveText(verdict ?? '');
  await expectAccessible(page);

  // Try a different subject: Mathematics instead of Mathematical Literacy.
  const tryIt = page.getByRole('region', { name: 'Try a different subject' });
  await tryIt.getByLabel('Instead of').selectOption({ label: 'Mathematical Literacy' });
  await tryIt.getByLabel('Take').selectOption({ label: 'Mathematics' });
  await tryIt.getByRole('button', { name: 'Check' }).click();
  await expect(
    page.getByRole('region', {
      name: 'If your school lets you take Mathematics instead of Mathematical Literacy',
    }),
  ).toBeVisible();
  await expect(page.getByTestId('subjects-summary')).toHaveText(verdict ?? '');
  await expectAccessible(page);

  // A phone (360px): nothing scrolls sideways.
  await page.setViewportSize({ width: 360, height: 800 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});
