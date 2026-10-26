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
 * My plan maps (docs/design/plan-maps-proposal.md §10 step 9) on a production build, with the
 * owner's words switch off as in production (UF_MINDMAP_WORDS unset): a learner starts a map from
 * My goal, ticks a stop, moves one by keyboard, deletes one after asking in the page, and the
 * page passes axe at 360, 768, 1280 and 1920px, as the outline and as the picture, never
 * scrolling sideways. The picture is a canvas on a card (2026-10-24): its buttons and keys zoom
 * and fit, and it opens full screen, Esc and Close giving focus back; at 200% zoom on a laptop
 * (640px) the page still never scrolls sideways, and the List is the outline. Synthetic learner.
 * Written by the plan maps agent, run by the integrator.
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

test('a learner starts a plan map, ticks it, moves and deletes a stop, by keyboard', async ({
  page,
}) => {
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

  await page.goto('/goals');
  const card = page.getByRole('region', { name: 'My plan maps' });
  await expect(card.getByText('You don’t have a plan map yet.')).toBeVisible();
  await card.getByRole('button', { name: 'Start a new map' }).click();
  await expect(card.getByRole('radio', { name: /Six stops/ })).toBeFocused();
  await card.getByRole('button', { name: 'Start', exact: true }).press('Enter');
  await expect(page).toHaveURL(/\/goals\/maps\/[0-9a-f-]{36}\?new=1$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Six stops' })).toBeFocused();
  await expect(page.getByText(/Writing in your own words comes once/)).toBeVisible();

  // Tick Grade 10 as achieved, by keyboard.
  await page.getByRole('button', { name: 'Edit Grade 10' }).press('Enter');
  // Exact: "Not achieved" holds the same word.
  await page.getByRole('radio', { name: 'Achieved', exact: true }).check();
  await page.getByRole('button', { name: 'Save', exact: true }).press('Enter');
  await expect(page.getByRole('status')).toHaveText('Saved. Grade 10: Achieved.');
  await expect(page.getByRole('button', { name: 'Edit Grade 10' })).toBeFocused();

  // Move Grade 11 up: focus stays on it.
  await page.getByRole('button', { name: 'More for Grade 11' }).press('Enter');
  await page.getByRole('button', { name: 'Move up' }).press('Enter');
  await expect(page.getByRole('button', { name: 'More for Grade 11' })).toBeFocused();
  const first = page.locator('.uf-map-branches > li').first();
  await expect(first.getByRole('heading', { level: 3 })).toContainText('Grade 11');

  // Delete Matric after asking in the page.
  await page.getByRole('button', { name: 'More for Matric' }).press('Enter');
  await page.getByRole('button', { name: 'Delete', exact: true }).press('Enter');
  await expect(page.getByText('Delete “Matric”?')).toBeVisible();
  await page.getByRole('button', { name: 'Delete', exact: true }).press('Enter');
  await expect(page.getByRole('heading', { name: 'Matric' })).toHaveCount(0);

  // The picture is a canvas on a card at every width (the owner, 2026-10-24), the List the outline.
  for (const width of [360, 768, 1280, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await noSidewaysScroll(page);
    await expectAccessible(page);
    await page.getByRole('button', { name: 'List', exact: true }).click();
    await expectAccessible(page);
    await page.getByRole('button', { name: 'Picture', exact: true }).click();
  }

  // The canvas: a labelled region; the buttons zoom, fit and go back to the middle.
  await page.setViewportSize({ width: 360, height: 800 });
  const canvas = page.getByRole('region', { name: 'Your map, on a canvas', exact: true });
  await expect(canvas).toBeVisible();
  const zoom = page.locator('.uf-canvas-zoom');
  // It opens at whatever zoom reads best for the window (93% on a 360px phone), not a fixed 100%.
  const percent = async () => Number((await zoom.innerText()).match(/\d+/)?.[0]);
  await expect(zoom).toContainText('%');
  const opened = await percent();
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
  await expect.poll(percent).toBeGreaterThan(opened);
  await page.getByRole('button', { name: 'Zoom out', exact: true }).click();
  await page.getByRole('button', { name: 'Fit to view', exact: true }).click();
  await page.getByRole('button', { name: 'Back to the middle', exact: true }).click();
  await expect(zoom).toContainText('100');
  // The keys, from the card: + zooms in, 0 fits.
  await canvas.focus();
  await page.keyboard.press('+');
  await expect(zoom).toContainText('125');
  await noSidewaysScroll(page);

  // Open full screen: focus goes in; Esc closes it and focus comes back to Open.
  await page.getByRole('button', { name: 'Open the canvas', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole('region', { name: 'Your map, on a canvas', exact: true }),
  ).toBeFocused();
  await expect(
    page.getByText('Your map is open on the full-screen canvas.', { exact: true }),
  ).toBeVisible();
  await expectAccessible(page);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('button', { name: 'Open the canvas', exact: true })).toBeFocused();
  // And its Close button.
  await page.getByRole('button', { name: 'Open the canvas', exact: true }).click();
  await dialog.getByRole('button', { name: 'Close the canvas', exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('button', { name: 'Open the canvas', exact: true })).toBeFocused();

  // A laptop at 200% zoom is 640 CSS pixels wide: the picture stays in its card, the page never
  // scrolls sideways, and the List is the outline.
  await page.setViewportSize({ width: 640, height: 900 });
  await noSidewaysScroll(page);
  await page.getByRole('button', { name: 'List', exact: true }).click();
  const display = await page.locator('.uf-map').evaluate((el) => getComputedStyle(el).display);
  expect(display).toBe('flex');
  await noSidewaysScroll(page);
  await page.getByRole('button', { name: 'Picture', exact: true }).click();

  // Back on My goal, the card counts what was ticked.
  await page.goto('/goals');
  await expect(card.getByText('1 achieved · 0 not achieved · 4 planned')).toBeVisible();
});
