import { expect, type Locator, type Page, test } from '@playwright/test';
import { expectAccessible, newPhone, signIn } from './helpers';

/**
 * Layouts that must give way to the learner's own settings (WCAG 2.2 AA), measured in a real
 * browser because only layout can show them.
 *
 * A3-23 (1.4.12, 2.4.11): from a laptop's width the split stage was exactly one screen tall,
 * clipped what didn't fit and centred its content, so with wider text spacing the app name and the
 * page's heading were cut off at the top and "Send my PIN" could sit unreachable below the stage.
 * A3-24 (1.4.10): the chat was pinned to the screen's height, so at 400% zoom (320x256 CSS px) the
 * conversation was a 29px slot between the header and the composer.
 */

/** WCAG 1.4.12's text-spacing values, as a bookmarklet or a reading tool would set them. */
const TEXT_SPACING = `* { line-height: 1.5 !important; letter-spacing: 0.12em !important;
  word-spacing: 0.16em !important; } p { margin-bottom: 2em !important; }`;

/**
 * Scrolled to the way a learner can (the page, by wheel or touch), the element is wholly on screen
 * and is what a tap at its centre reaches. Script can scroll even an `overflow: hidden` box, as
 * Playwright's own scroll-into-view does, so every box is put back first and only the page moves.
 */
async function expectReachable(page: Page, el: Locator, what: string) {
  await el.evaluate((node) => {
    for (const box of document.querySelectorAll('*')) {
      if (box.scrollTop !== 0 && box !== document.scrollingElement) box.scrollTop = 0;
    }
    const top = node.getBoundingClientRect().top + window.scrollY;
    window.scrollTo(0, Math.max(0, top - 16));
  });
  const box = await el.boundingBox();
  expect(box, `${what} has a box`).not.toBeNull();
  if (!box) return;
  const viewport = page.viewportSize() ?? { width: 0, height: 0 };
  expect(box.y, `${what}: top on screen`).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height, `${what}: bottom on screen`).toBeLessThanOrEqual(viewport.height + 1);
  const hit = await el.evaluate(
    (node, [x, y]) => {
      const at = document.elementFromPoint(x as number, y as number);
      return at !== null && (at === node || node.contains(at));
    },
    [box.x + box.width / 2, box.y + box.height / 2],
  );
  expect(hit, `${what}: a tap at its centre reaches it`).toBe(true);
}

test.describe('the split stage with wider text spacing (A3-23)', () => {
  test.use({ viewport: { width: 1024, height: 600 }, isMobile: false, hasTouch: false });

  test('the front door keeps its name and heading on screen', async ({ page }) => {
    await page.goto('/');
    await page.addStyleTag({ content: TEXT_SPACING });
    const main = page.getByRole('main');
    await expectReachable(
      page,
      main.getByText('UniversityFlow', { exact: true }).first(),
      'app name',
    );
    await expectReachable(page, main.getByRole('heading', { level: 1 }), 'the heading');
  });

  test('sign-in keeps "Send my PIN" reachable with an error showing', async ({ page }) => {
    await page.goto('/sign-in');
    await page.addStyleTag({ content: TEXT_SPACING });
    await page.getByLabel('Cellphone number').fill('123456789');
    await page.getByRole('button', { name: 'Send my PIN' }).click();
    await expect(
      page.getByText('That doesn’t look like a South African cellphone number.'),
    ).toBeVisible();
    await expectReachable(page, page.getByRole('button', { name: 'Send my PIN' }), 'Send my PIN');
  });
});

test.describe('the privacy policy and the s43 footer on a 360px phone', () => {
  test.use({ viewport: { width: 360, height: 740 } });

  for (const path of ['/privacy', '/', '/sign-in', '/help']) {
    test(`${path} never scrolls sideways, and the footer links to /privacy`, async ({ page }) => {
      await page.goto(path);
      const wide = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(wide, `${path} scrolls sideways by ${wide}px`).toBeLessThanOrEqual(0);
      const footer = page.getByRole('contentinfo');
      // Exact: the placeholder under it ("Owner to fill: full legal name") holds the same words.
      await expect(footer.getByText('Full legal name', { exact: true })).toBeVisible();
      await expect(footer.getByRole('link', { name: 'Privacy policy' })).toHaveAttribute(
        'href',
        '/privacy',
      );
      if (path === '/privacy') await expectAccessible(page);
    });
  }
});

test.describe('the chat at 400% zoom (A3-24)', () => {
  test('the conversation is not squeezed into a slot', async ({ page }) => {
    await signIn(page, newPhone());
    await page.getByLabel('Date of birth').fill('2000-03-15');
    await page.getByRole('button', { name: 'Continue' }).click();
    await page
      .getByLabel('I have read what UniversityFlow does with my information, and I agree.')
      .check();
    await page.getByRole('button', { name: 'I agree to this' }).click();
    await page.getByLabel('What should we call you?').fill('Sipho');
    await page.getByLabel('Which grade are you in?').selectOption('11');
    await page.getByRole('button', { name: 'Start' }).click();
    await expect(page).toHaveURL(/\/home$/);
    // 1280x1024 at 400%.
    await page.setViewportSize({ width: 320, height: 256 });
    await page.goto('/chat');
    const region = page.getByRole('region', { name: 'Conversation' });
    await expect(region).toBeVisible();
    const { height, clipped } = await region.evaluate((el) => ({
      height: el.clientHeight,
      clipped: el.scrollHeight > el.clientHeight + 1,
    }));
    // Either it has real room, or it shows all it holds and the page scrolls instead.
    expect(height >= 128 || !clipped, `conversation ${height}px tall, clipped: ${clipped}`).toBe(
      true,
    );
    await expectReachable(page, page.getByRole('button', { name: 'Send' }), 'Send');
  });
});

/** A new adult learner, signed in and onboarded, on their home. */
async function onboardedLearner(page: Page) {
  await signIn(page, newPhone());
  await page.getByLabel('Date of birth', { exact: true }).fill('2000-03-15');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page
    .getByLabel('I have read what UniversityFlow does with my information, and I agree.', {
      exact: true,
    })
    .check();
  await page.getByRole('button', { name: 'I agree to this', exact: true }).click();
  await page.getByLabel('What should we call you?', { exact: true }).fill('Sipho');
  await page.getByLabel('Which grade are you in?', { exact: true }).selectOption('11');
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await expect(page).toHaveURL(/\/home$/);
}

test.describe('the signed-in header on a narrow phone', () => {
  // A3-26 (1.4.12): at 320px with wider text spacing the brand and Menu row pushed the page
  // 15px sideways on every signed-in page. The Menu now drops under the brand instead.
  test('never scrolls sideways at 320px with wider text spacing (A3-26)', async ({ page }) => {
    await onboardedLearner(page);
    await page.setViewportSize({ width: 320, height: 640 });
    for (const path of ['/home', '/subjects', '/chat']) {
      await page.goto(path);
      await page.addStyleTag({ content: TEXT_SPACING });
      const wide = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(wide, `${path} scrolls sideways by ${wide}px`).toBeLessThanOrEqual(0);
      const menu = page.locator('details.uf-menu > summary');
      const box = await menu.boundingBox();
      expect(box, `${path}: the Menu has a box`).not.toBeNull();
      expect(
        (box?.x ?? 0) + (box?.width ?? 0),
        `${path}: the Menu inside the screen`,
      ).toBeLessThanOrEqual(320);
    }
  });

  // A4-15: the Menu was a React button, dead until the page hydrated. A native disclosure opens
  // and its links work with no JavaScript at all.
  test('opens the Menu and follows a link with JavaScript off (A4-15)', async ({
    browser,
    page,
  }) => {
    await onboardedLearner(page);
    const noScript = await browser.newContext({
      javaScriptEnabled: false,
      viewport: { width: 360, height: 740 },
      storageState: await page.context().storageState(),
    });
    try {
      const phone = await noScript.newPage();
      await phone.goto('/home');
      const link = phone
        .getByRole('navigation', { name: 'Main' })
        .getByRole('link', { name: 'Get help', exact: true });
      await expect(link).toBeHidden();
      await phone.locator('details.uf-menu > summary').click();
      await expect(link).toBeVisible();
      await link.click();
      await expect(phone).toHaveURL(/\/help$/);
    } finally {
      await noScript.close();
    }
  });
});
