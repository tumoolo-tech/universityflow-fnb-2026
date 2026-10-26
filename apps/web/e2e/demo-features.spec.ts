import { expect, type Page, test } from '@playwright/test';
import { en } from '@universityflow/content';
import {
  expectAccessible,
  goTo,
  serverErrorsSince,
  serverLogMark,
  trackCspViolations,
} from './helpers';

/**
 * The judge demo's hackathon exceptions of 2026-10-24 (docs/deploy/demo.md), run by
 * playwright.demo.config.ts with UF_CV=1 and UF_MINDMAP_WORDS=1 and no ElevenLabs key:
 * - My CV on the built-in stand-in (never Mmereko, D14): a judge, as a made-up adult, opts in,
 *   ticks the made-up school, makes a CV (ready at once: the stand-in runs in the request), opens
 *   the structured preview and its PDF, checks every line and makes a share link (18+), fits a CV
 *   to a job, reports it, and deletes it;
 * - plan-map words: a made-up Grade 10 learner writes in a part of their map, and crisis words
 *   bring the crisis card (the crisis check on every save);
 * - Read aloud stays off without the key, as before.
 * Axe at each step; no CSP violation, no unhandled server error; nothing scrolls sideways at 360px.
 * Written by the features agent of wave 7, run by the integrator.
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

const personas = en.demoPersonas.personas;

async function start(page: Page, name: string) {
  await page.goto('/demo');
  await page.getByRole('button', { name: en.demo.tryAs(name), exact: true }).click();
  await expect(page).toHaveURL(/\/home$/, { timeout: 20_000 });
}

async function noSidewaysScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

test('a judge makes a CV for a made-up adult on the stand-in, fits it to a job, reports it, shares one and deletes one', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await start(page, personas['demo-final-year'].name);
  await page.goto('/cv');
  await expect(
    page.getByRole('heading', { level: 1, name: en.cv.title, exact: true }),
  ).toBeVisible();
  // Honest about the stand-in: never Mmereko, no AI.
  await expect(page.getByText(en.demoPersonas.cvStandIn, { exact: true })).toBeVisible();
  await expectAccessible(page);

  // The learner's own opt-in, sharing too (18+, in their own name).
  await page.getByLabel(en.cv.optIn.share, { exact: true }).check();
  await page.getByRole('button', { name: en.cv.optIn.agree, exact: true }).click();
  await expect(page.getByRole('heading', { name: en.cv.what.title, exact: true })).toBeFocused();

  // The made-up school, ticked.
  const what = page.getByRole('region', { name: en.cv.what.title, exact: true });
  await what.getByLabel(en.demoPersonas.schoolName, { exact: true }).check();
  await what.getByRole('button', { name: en.cv.what.save, exact: true }).click();
  await expect(page.getByRole('status')).toHaveText(en.cv.what.saved);

  // "Make my CV": the stand-in finishes it in the request; the list says so on its next read.
  await page.getByRole('button', { name: en.cv.make.button, exact: true }).click();
  const list = page.getByRole('region', { name: en.cv.list.title, exact: true });
  await expect(list.getByText(en.cv.status.ready, { exact: true })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByRole('status')).toHaveText(en.cv.list.ready);
  await expectAccessible(page);

  // The structured preview, then the PDF through the 60-second link.
  await list.getByRole('button', { name: new RegExp(`^Open ${en.cv.list.draft},`) }).click();
  const preview = page.getByRole('region', { name: en.cv.preview.title(en.cv.list.draft) });
  await expect(preview.getByRole('heading', { level: 2 })).toBeFocused();
  await expect(preview).toContainText(personas['demo-final-year'].name);
  await expect(preview).toContainText(en.demoPersonas.schoolName);
  await expectAccessible(page);
  const pdf = page.waitForResponse((r) => r.url().includes('/api/cv/pdf/'));
  await preview.getByRole('button', { name: en.cv.preview.download, exact: true }).click();
  const response = await pdf;
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toBe('application/pdf');
  await page.goto('/cv');

  // Every line checked, then a share link (18+).
  await list.getByRole('button', { name: new RegExp(`^Open ${en.cv.list.draft},`) }).click();
  await preview.getByRole('button', { name: en.cv.preview.confirm, exact: true }).click();
  const sharing = preview.getByRole('region', { name: en.cv.sharing.title, exact: true });
  await sharing.getByRole('button', { name: en.cv.sharing.create, exact: true }).click();
  await expect(page.getByRole('status')).toHaveText(en.cv.sharing.made);
  await expect(sharing.getByLabel(en.cv.sharing.link, { exact: true })).toHaveValue(/\/cv\/s\//);
  await expectAccessible(page);
  await preview.getByRole('button', { name: en.cv.preview.close, exact: true }).click();

  // "Fit it to a job", on the stand-in.
  const tailor = page.getByRole('region', { name: en.cv.tailor.title, exact: true });
  await tailor.getByLabel(en.cv.tailor.jobTitle, { exact: true }).fill('Junior developer');
  await tailor.getByLabel(en.cv.tailor.company, { exact: true }).fill('Example Company');
  await tailor
    .getByLabel(en.cv.tailor.advert, { exact: true })
    .fill('We need a junior developer who knows Python and works well in a team.');
  await tailor.getByRole('button', { name: en.cv.tailor.button, exact: true }).click();
  const fitted = en.cv.list.tailoredAt('Junior developer', 'Example Company');
  await expect(list.getByText(fitted, { exact: true })).toBeVisible();
  await expect(list.getByText(en.cv.status.ready, { exact: true })).toHaveCount(2, {
    timeout: 15_000,
  });

  // "Report this CV" on the fitted one.
  await list.getByRole('button', { name: new RegExp(`^Open ${fitted},`) }).click();
  const fittedPreview = page.getByRole('region', { name: en.cv.preview.title(fitted) });
  await fittedPreview.getByRole('button', { name: en.cv.report.open, exact: true }).click();
  await fittedPreview.getByLabel(en.cv.report.reasons.untrue, { exact: true }).check();
  await fittedPreview.getByRole('button', { name: en.cv.report.send, exact: true }).click();
  await expect(fittedPreview.getByText(en.cv.report.sent, { exact: true })).toBeVisible();
  await expectAccessible(page);

  // Delete the fitted one, after asking in the page.
  await list.getByRole('button', { name: new RegExp(`^Delete ${fitted},`) }).click();
  await list.getByRole('button', { name: en.cv.remove.yes, exact: true }).click();
  // The page has more than one status line (each part of it says its own outcome).
  await expect(page.getByRole('status').filter({ hasText: en.cv.remove.done(fitted) })).toHaveText(
    en.cv.remove.done(fitted),
  );
  await expect(list.getByText(fitted, { exact: true })).toHaveCount(0);

  await page.setViewportSize({ width: 360, height: 780 });
  await noSidewaysScroll(page);
  await expectAccessible(page);
});

test('a made-up under-18 makes a CV on the stand-in, and is never offered a share link', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await start(page, personas['demo-grade-11'].name);
  await page.goto('/cv');
  await expect(page.getByLabel(en.cv.optIn.share, { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: en.cv.optIn.agree, exact: true }).click();
  const what = page.getByRole('region', { name: en.cv.what.title, exact: true });
  await what.getByLabel(en.demoPersonas.schoolName, { exact: true }).check();
  await what.getByRole('button', { name: en.cv.what.save, exact: true }).click();
  await page.getByRole('button', { name: en.cv.make.button, exact: true }).click();
  const list = page.getByRole('region', { name: en.cv.list.title, exact: true });
  await expect(list.getByText(en.cv.status.ready, { exact: true })).toBeVisible({
    timeout: 15_000,
  });
  await list.getByRole('button', { name: new RegExp(`^Open ${en.cv.list.draft},`) }).click();
  const preview = page.getByRole('region', { name: en.cv.preview.title(en.cv.list.draft) });
  await expect(preview).toContainText(personas['demo-grade-11'].name);
  await expect(preview.getByRole('region', { name: en.cv.sharing.title, exact: true })).toHaveCount(
    0,
  );
  await expectAccessible(page);
});

test('a made-up learner writes in their plan map, and crisis words bring the crisis card', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await start(page, personas['demo-grade-10'].name);
  await page.goto('/goals');
  const card = page.getByRole('region', { name: en.planMaps.title, exact: true });
  await card.locator('a[href^="/goals/maps/"]').first().click();
  await expect(page).toHaveURL(/\/goals\/maps\/[0-9a-f-]{36}$/);
  // Words are on: no "writing comes later" note.
  await expect(page.getByText(en.planMaps.wordsWait, { exact: true })).toHaveCount(0);

  const stops = en.planMaps.templates.staircase.slots;
  await page
    .getByRole('button', { name: en.planMaps.editing(stops['finish-grade-10'].heading) })
    .click();
  await page.getByLabel(en.planMaps.myWords, { exact: true }).fill('Get 70% for maths');
  await page.getByRole('button', { name: en.planMaps.save, exact: true }).click();
  await expect(page.getByText('Get 70% for maths', { exact: true })).toBeVisible();
  await expectAccessible(page);

  // The crisis check reads every save: the words are kept, and the card comes.
  await page
    .getByRole('button', { name: en.planMaps.editing(stops['finish-grade-11'].heading) })
    .click();
  await page.getByLabel(en.planMaps.myWords, { exact: true }).fill('I want to die before matric');
  await page.getByRole('button', { name: en.planMaps.save, exact: true }).click();
  await expect(page.getByRole('heading', { name: en.crisis.cardTitle, exact: true })).toBeVisible();
  await expectAccessible(page);

  await page.setViewportSize({ width: 360, height: 780 });
  await noSidewaysScroll(page);
});

test('Read aloud stays off without the ElevenLabs key, as before', async ({ page }) => {
  await start(page, personas['demo-first-year'].name);
  const speech = await page.request.get('/api/speech');
  expect(speech.status()).toBe(200);
  expect(await speech.json()).toEqual({ available: false });
});

// "Open Mmereko" on My CV (the owner's decision of 2026-10-24; UF_CV_MMEREKO_CANVAS=1 in
// playwright.demo.config.ts). Mmereko's own page may not load offline: this checks the dialog and
// the frame element, never Mmereko's page.
test('a university learner opens Mmereko in a canvas over My CV; a school learner under 18 never sees it', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await start(page, personas['demo-first-year'].name);
  await page.goto('/cv');
  const open = page.getByRole('button', { name: en.cvMmereko.open, exact: true });
  await expect(open).toBeVisible();
  await expectAccessible(page);

  // Mmereko's live site allows only UniversityFlow's own domains to frame it (frame-ancestors,
  // Mmereko #6), never localhost: the frame gets a stand-in page here, so the test needs no network
  // and never depends on another site.
  await page.route('https://mmereko.tumoolo.tech/**', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><title>Mmereko</title><p>Sign in</p>',
    }),
  );
  await open.click();
  const dialog = page.getByRole('dialog', { name: en.cvMmereko.title, exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: en.cvMmereko.close, exact: true })).toBeFocused();
  // The line ends with the link to Mmereko's site, so the paragraph holds more than the line.
  await expect(dialog.locator('p').filter({ hasText: en.cvMmereko.separate })).toBeVisible();
  const tab = dialog.getByRole('link', { name: en.cvMmereko.newTab, exact: true });
  await expect(tab).toHaveAttribute('href', 'https://mmereko.tumoolo.tech/login');
  await expect(tab).toHaveAttribute('target', '_blank');
  await expect(tab).toHaveAttribute('rel', 'noopener noreferrer');
  const frame = dialog.locator('iframe');
  await expect(frame).toHaveAttribute('src', 'https://mmereko.tumoolo.tech/login');
  await expect(frame).toHaveAttribute('title', en.cvMmereko.frameTitle);
  await expect(frame).toHaveAttribute('referrerpolicy', 'no-referrer');
  await expect(frame).not.toHaveAttribute('sandbox', /allow-top-navigation/);
  // Full screen, and the page behind held still.
  const box = await dialog.boundingBox();
  const viewport = page.viewportSize();
  expect(box?.width).toBeCloseTo(viewport?.width ?? 0, 0);
  expect(await page.evaluate(() => document.documentElement.style.overflow)).toBe('hidden');
  await page.setViewportSize({ width: 360, height: 780 });
  await noSidewaysScroll(page);

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(open).toBeFocused();
  await expect(page.locator('iframe')).toHaveCount(0);

  // Amahle, Grade 12 and 17: no button, no dialog, no frame.
  await start(page, personas['demo-grade-12'].name);
  await page.goto('/cv');
  await expect(
    page.getByRole('heading', { level: 1, name: en.cv.title, exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: en.cvMmereko.open, exact: true })).toHaveCount(0);
  await expect(page.locator('dialog, iframe')).toHaveCount(0);
});

// A5-28 (Phase 6 audit): reached by a click, as a judge does, My CV keeps the policy of the page
// the visit started on. Mmereko's page must still load in the frame (the CSP check in afterEach
// fails on any refusal).
test('Open Mmereko works after a click to My CV from the sidebar, not only on a fresh load', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.route('https://mmereko.tumoolo.tech/**', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><title>Mmereko</title><p>Sign in</p>',
    }),
  );
  await start(page, personas['demo-first-year'].name);
  // The Main nav (behind the Menu on a phone): a client-side navigation, as a judge's click is.
  await goTo(page, en.cv.title);
  await expect(page).toHaveURL(/\/cv$/);
  await page.getByRole('button', { name: en.cvMmereko.open, exact: true }).click();
  const dialog = page.getByRole('dialog', { name: en.cvMmereko.title, exact: true });
  await expect(dialog.frameLocator('iframe').getByText('Sign in', { exact: true })).toBeVisible();
});
