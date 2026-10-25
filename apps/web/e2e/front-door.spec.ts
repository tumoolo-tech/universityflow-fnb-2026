import { expect, type Locator, test } from '@playwright/test';

/**
 * The front door's journey in pictures (the owner, 2026-10-24): on a big screen the stack had
 * slid down onto the "GRADE 10" wordmark, cutting into its letters, and over the frosted half's
 * heading. It was sized by the screen's width and placed by a share of the stage's height, so on
 * a shorter or wider screen it no longer matched the room above the wordmark. Measured in a real
 * browser, because only layout can show it.
 */

const SCREENS = [
  { width: 1920, height: 960 },
  { width: 1900, height: 860 },
  { width: 1440, height: 900 },
  { width: 1280, height: 720 },
  { width: 1024, height: 768 },
] as const;

async function box(el: Locator, what: string) {
  const b = await el.boundingBox();
  expect(b, `${what} has a box`).not.toBeNull();
  return b ?? { x: 0, y: 0, width: 0, height: 0 };
}

for (const screen of SCREENS) {
  test.describe(`the front door at ${screen.width}x${screen.height}`, () => {
    test.use({ viewport: screen, isMobile: false, hasTouch: false });

    test('the pictures stand above the wordmark, clear of the heading and the tiles', async ({
      page,
    }) => {
      await page.goto('/');
      const people = await box(page.getByTestId('stage-people'), 'the pictures');
      const word = await box(page.locator('.uf-wordmark-frost .uf-wordmark-word'), 'the wordmark');
      expect(
        people.y + people.height,
        'the pictures end above the "GRADE 10" wordmark',
      ).toBeLessThanOrEqual(word.y + 1);
      expect(people.y, 'the pictures start on the stage').toBeGreaterThanOrEqual(0);

      const main = page.getByRole('main');
      const right = people.x + people.width;
      for (const [el, what] of [
        [main.getByText('Find your way to university, from Grade 10.', { exact: true }), 'heading'],
        [main.getByRole('heading', { name: 'What we do together', exact: true }), 'tiles title'],
        [main.getByRole('link', { name: /^Your results/ }), 'the first tile'],
      ] as const) {
        const b = await box(el, what);
        expect(right, `the pictures end left of the ${what}`).toBeLessThanOrEqual(b.x);
      }
      // And clear of the charcoal half's words: the headline and the lead end before them.
      for (const [el, what] of [
        [main.getByRole('heading', { level: 1 }), 'headline'],
        [main.getByText(/^UniversityFlow checks your marks/), 'lead'],
      ] as const) {
        const b = await box(el, what);
        expect(b.x + b.width, `the ${what} ends before the pictures`).toBeLessThanOrEqual(people.x);
      }
      // Where the glass makes way for the pictures, the tiles' captions still don't run together.
      const captions = await page
        .locator('#stage-tiles + ul a > span.uf-caps')
        .evaluateAll((els) => els.map((e) => e.getBoundingClientRect().toJSON()));
      expect(captions).toHaveLength(4);
      for (const [i, a] of captions.entries()) {
        for (const b of captions.slice(i + 1)) {
          const apart =
            a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top;
          expect(apart, 'two tile captions overlap').toBe(true);
        }
      }
      // The first screen still holds the whole stage: the wordmark is on it.
      expect(word.y + word.height, 'the wordmark on the first screen').toBeLessThanOrEqual(
        screen.height,
      );
    });
  });
}

test.describe('the front door on a phone', () => {
  test.use({ viewport: { width: 360, height: 780 } });

  test('shows no pictures and never fetches them', async ({ page }) => {
    const fetched: string[] = [];
    page.on('request', (r) => {
      if (r.url().includes('/stage/')) fetched.push(r.url());
    });
    await page.goto('/');
    await expect(page.getByTestId('stage-people')).toBeHidden();
    await page.mouse.wheel(0, 4000);
    await page.waitForLoadState('networkidle');
    expect(fetched).toEqual([]);
  });
});
