import { existsSync, readFileSync, statSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { expect, type Locator, type Page } from '@playwright/test';

/**
 * The server's log (e2e/serve.mjs copies it to UF_E2E_SERVER_LOG). `serverLogMark` notes where
 * it ends now; `serverErrorsSince` returns every line after that mark where the server reported
 * an error: Next's `⨯` lines (an unhandled error in a page or route) and our own handler's
 * "request failed" (an unexpected 500). Audit A1-10.
 */
export function serverLogMark(): number {
  const path = process.env['UF_E2E_SERVER_LOG'];
  return path && existsSync(path) ? statSync(path).size : 0;
}

export async function serverErrorsSince(mark: number, page: Page): Promise<string[]> {
  const path = process.env['UF_E2E_SERVER_LOG'];
  if (!path) throw new Error('UF_E2E_SERVER_LOG is not set: run through playwright.config.ts');
  // The server writes its log through a pipe; give the last request's lines a moment to land.
  await page.waitForTimeout(500);
  const text = readFileSync(path).subarray(mark).toString('utf8');
  return text.split(/\r?\n/).filter((line) => /⨯|\bError \[|request failed|unhandled/i.test(line));
}

let n = Date.now() % 10_000_000;
/** A synthetic number, built at runtime (hard rule 4). */
export function newPhone(): string {
  n = (n + 1) % 10_000_000;
  return `082${String(n).padStart(7, '0')}`;
}

/** The newest SMS the local stand-in "sent" to a number. */
export async function lastSms(page: Page, phone: string): Promise<string> {
  const e164 = `+27${phone.slice(1)}`;
  const response = await page.request.get('/api/dev/outbox');
  const { messages } = (await response.json()) as { messages: Array<{ to: string; body: string }> };
  return messages.find((m) => m.to === e164)?.body ?? '';
}

let address = 0;

export async function signIn(page: Page, phone: string): Promise<void> {
  // Each sign-in comes from its own address (TEST-NET-3, RFC 5737), as learners do. From one
  // address the suite's sign-ins passed the product's limit of PIN requests per IP an hour
  // (OTP_PER_IP_PER_HOUR, proven in packages/db's tests) and the later journeys were refused.
  address = (address % 254) + 1;
  await page.setExtraHTTPHeaders({ 'x-forwarded-for': `203.0.113.${address}` });
  await page.goto('/sign-in');
  await page.getByLabel('Cellphone number').fill(phone);
  await page.getByRole('button', { name: 'Send my PIN' }).click();
  // The first write of a run opens and migrates the fresh embedded database: 6–9 s on a cold
  // server, longer than the default 5 s wait.
  await expect(page.getByRole('heading', { name: 'Enter your PIN' })).toBeVisible({
    timeout: 15_000,
  });
  const pin = (await lastSms(page, phone)).match(/\b(\d{6})\b/)?.[1] ?? '';
  await page.getByLabel('6-digit PIN').fill(pin);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

/**
 * The phone's Menu: a native `details` disclosure's summary (A4-15), which has no ARIA role of its
 * own to find it by. From a laptop's width it is hidden (the sidebar shows).
 */
export function menuSummary(page: Page): Locator {
  return page.locator('details.uf-menu > summary');
}

/**
 * Opens the phone's Menu, if there is one, until `target` inside it shows. A native disclosure
 * opens from first paint, before the page hydrates; the retry covers a hydration that lands
 * between a tap and the check.
 */
export async function openMenu(page: Page, target: Locator): Promise<void> {
  const menu = menuSummary(page);
  if (!(await menu.isVisible())) return;
  await expect(async () => {
    const open = await menu.evaluate(
      (summary) => (summary.parentElement as HTMLDetailsElement).open,
    );
    if (!open) await menu.click();
    await expect(target).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 15_000 });
}

/** Goes to a signed-in page through the Main nav, behind the Menu on a phone. */
export async function goTo(page: Page, name: string): Promise<void> {
  const link = page
    .getByRole('navigation', { name: 'Main' })
    .getByRole('link', { name, exact: true });
  await openMenu(page, link);
  await link.click();
}

/**
 * Collects every Content-Security-Policy violation on a page, across navigations: the
 * browser's `securitypolicyviolation` event and the console errors Chromium logs for them.
 */
export async function trackCspViolations(page: Page): Promise<string[]> {
  const violations: string[] = [];
  await page.exposeFunction('__ufCspViolation', (report: string) => violations.push(report));
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (event) => {
      const report = (window as unknown as { __ufCspViolation: (r: string) => void })
        .__ufCspViolation;
      report(
        `${event.violatedDirective} blocked ${event.blockedURI || 'inline'} at ${event.sourceFile}:${event.lineNumber} ${event.sample}`,
      );
    });
  });
  page.on('console', (message) => {
    if (/Content Security Policy/i.test(message.text())) violations.push(message.text());
  });
  return violations;
}

/** The nonce in a page response's CSP, after checking the policy is the strict one. */
export function nonceFrom(csp: string | undefined): string {
  const scriptSrc = csp?.split(';').find((d) => d.trim().startsWith('script-src')) ?? '';
  expect(scriptSrc).not.toContain("'unsafe-inline'");
  expect(scriptSrc).toContain("'strict-dynamic'");
  const nonce = /'nonce-([^']+)'/.exec(scriptSrc)?.[1] ?? '';
  expect(nonce).not.toBe('');
  return nonce;
}

/**
 * WCAG 2.2 AA, checked by axe on the page as it stands (hard rule 9), once it has settled: the
 * split stage fades in on load, and colours change over a short transition (the nav's current
 * pill), so axe waits for every finite animation and transition to finish rather than measure a
 * colour halfway through one. Nothing is skipped: the settled page is checked in full.
 */
export async function expectAccessible(page: Page): Promise<void> {
  await page.waitForFunction(
    () =>
      document
        .getAnimations()
        .every(
          (a) =>
            a.playState !== 'running' ||
            a.effect?.getTiming().iterations === Number.POSITIVE_INFINITY,
        ),
    undefined,
    { timeout: 5_000 },
  );
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(
    results.violations.map(
      (v) =>
        `${v.id}: ${v.nodes.map((node) => `${node.target.join(' ')} (${node.failureSummary ?? ''})`).join(', ')}`,
    ),
  ).toEqual([]);
}
