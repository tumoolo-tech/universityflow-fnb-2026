import { createHmac } from 'node:crypto';
import { expect, type Page, test } from '@playwright/test';
import {
  expectAccessible,
  goTo,
  lastSms,
  newPhone,
  nonceFrom,
  serverErrorsSince,
  serverLogMark,
  signIn,
  trackCspViolations,
} from './helpers';

// Every journey runs under the nonce CSP and must cause no violation (audit finding 2). The
// journeys click through React forms, so they also prove the pages hydrate under it.
// And none may leave an unhandled error in the server's log (audit A1-10).
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

/** Every signed-in page, each of which must turn away a learner who isn't ready (A1-10). */
const SIGNED_IN_PAGES = [
  '/home',
  '/chat',
  '/results',
  '/subjects',
  '/documents',
  '/applications',
  '/applications/uj',
  '/results/what-i-need/uj-bcom-accounting',
  '/funding',
  '/goals',
  '/offers',
  '/campus',
  '/first-week',
  '/modules',
  '/me',
];

/** After the date of birth, an adult agrees in their own name (A7-04). */
async function agreeAsAdult(page: Page): Promise<void> {
  await expect(page.getByRole('heading', { name: 'Before you start' })).toBeVisible();
  await page
    .getByLabel('I have read what UniversityFlow does with my information, and I agree.')
    .check();
  await page.getByRole('button', { name: 'I agree to this' }).click();
}

/**
 * Onboarding and sign-in land on the home (docs/design/README.md); the chat is a tap away in the
 * nav. The home's own checks are in the first journey.
 */
async function openChatFromHome(page: Page): Promise<void> {
  await expect(page).toHaveURL(/\/home$/);
  await expect(page.getByRole('heading', { level: 1, name: /^Welcome/ })).toBeVisible();
  await goTo(page, 'Chat');
}

/** Each signed-in page redirects this learner to onboarding, as a redirect, not an error. */
async function expectTurnedAway(page: Page): Promise<void> {
  for (const path of SIGNED_IN_PAGES) {
    const response = await page.request.get(path, { maxRedirects: 0 });
    expect(response.status(), path).toBe(307);
    expect(response.headers()['location'], path).toMatch(/\/onboarding$/);
    await page.goto(path);
    await expect(page, path).toHaveURL(/\/onboarding$/);
  }
}

test('pages carry a fresh script nonce, and Next stamps it on its scripts', async ({ page }) => {
  const first = await page.goto('/sign-in');
  const nonce = nonceFrom(first?.headers()['content-security-policy']);
  const scripts = page.locator('script');
  expect(await scripts.count()).toBeGreaterThan(0);
  // The browser hides the nonce attribute from the DOM; the property keeps it.
  const stamped = await scripts.evaluateAll((nodes) =>
    nodes.map((node) => (node as HTMLScriptElement).nonce),
  );
  expect(stamped.every((value) => value === nonce)).toBe(true);

  const second = await page.goto('/sign-in');
  expect(nonceFrom(second?.headers()['content-security-policy'])).not.toBe(nonce);

  // Hydrated: React enables the button once a number is typed (server HTML has it disabled).
  const send = page.getByRole('button', { name: 'Send my PIN' });
  await expect(send).toBeDisabled();
  await page.getByLabel('Cellphone number').fill(newPhone());
  await expect(send).toBeEnabled();

  // The not-found page is rendered per request too, so its scripts carry the nonce.
  const missing = await page.goto('/no-such-page');
  expect(missing?.status()).toBe(404);
  nonceFrom(missing?.headers()['content-security-policy']);

  // API responses carry one policy too: scripts from our origin only, no nonce, no inline.
  const api = await page.request.get('/api/me');
  const apiScriptSrc = (api.headers()['content-security-policy'] ?? '')
    .split(';')
    .map((directive) => directive.trim())
    .find((directive) => directive.startsWith('script-src'));
  expect(apiScriptSrc).toBe("script-src 'self'");

  // A4-09: the icon a browser asks for on every first visit is there, and every page links it.
  for (const path of ['/favicon.ico', '/icon.png']) {
    const icon = await page.request.get(path);
    expect(icon.status(), path).toBe(200);
    expect(icon.headers()['content-type'], path).toMatch(/^image\//);
  }
  await page.goto('/sign-in');
  await expect(page.locator('link[rel="icon"]')).not.toHaveCount(0);
});

const MARKS: Array<[string, string]> = [
  ['isiZulu Home Language', '74'],
  ['English First Additional Language', '68'],
  ['Mathematics', '71'],
  ['Physical Sciences', '66'],
  ['Life Sciences', '70'],
  ['Geography', '63'],
  ['Life Orientation', '80'],
];

test('an adult learner goes from sign-in to an application pack', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expectAccessible(page);
  // Sign-in on the split stage, the form in its glass card (docs/design/README.md).
  await page.goto('/sign-in');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Sign in with your cellphone number' }),
  ).toBeVisible();
  await expectAccessible(page);

  await signIn(page, newPhone());
  await expect(page.getByRole('heading', { name: 'When were you born?' })).toBeVisible();
  await expectAccessible(page);
  await page.getByLabel('Date of birth').fill('2000-03-15');
  await page.getByRole('button', { name: 'Continue' }).click();

  // An adult is told where their information goes, and agrees, before anything else (A7-04).
  await expect(page.getByRole('heading', { name: 'Before you start' })).toBeVisible();
  await expect(page.getByText(/sent to our AI provider, which processes it outside/)).toBeVisible();
  await expectTurnedAway(page);
  await expect(page.getByRole('heading', { name: 'Before you start' })).toBeVisible();
  await expectAccessible(page);
  await agreeAsAdult(page);

  await expect(page.getByRole('heading', { name: 'Tell us a little about you' })).toBeVisible();
  await page.getByLabel('What should we call you?').fill('Sipho');
  await page.getByLabel('Which grade are you in?').selectOption('11');
  await page.getByRole('button', { name: 'Start' }).click();

  // The home (docs/design/README.md): the learner's stage, and no number before any marks.
  await expect(page).toHaveURL(/\/home$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Welcome, Sipho' })).toBeVisible();
  await expect(
    page.getByText('Grade 11 · your results and applications at a glance'),
  ).toBeVisible();
  await expect(page.getByText('Not yet: add a school report and we’ll work it out.')).toBeVisible();
  await expect(page.getByTestId('home-number')).toHaveCount(0);
  await expectAccessible(page);

  // Chat: the welcome, then type marks in by hand (hard rule 6: the learner enters or confirms).
  await openChatFromHome(page);
  await expect(page.getByText(/Hi Sipho!/)).toBeVisible();
  await expectAccessible(page);
  await goTo(page, 'Documents');
  await page.getByRole('button', { name: 'Type in your marks' }).click();
  // Until December a Grade 11 learner's form starts on the Grade 10 report (A1-35): Sipho has
  // their final Grade 11 report, so they say so.
  await page.getByLabel('Which report is this?').selectOption({ label: 'final Grade 11 report' });
  for (const [index, [subject, percent]] of MARKS.entries()) {
    await page.getByLabel(`Subject ${index + 1}`, { exact: true }).selectOption({ label: subject });
    await page.getByLabel('Mark (%)').nth(index).fill(percent);
  }
  await expectAccessible(page);
  await page.getByRole('button', { name: 'These marks are correct' }).click();

  // Stage 1 results, with unverified data labelled: on the course card itself, not only in the
  // page's preview notice (which also says "not yet verified").
  await expect(page.getByRole('heading', { name: /You qualify now/ })).toBeVisible();
  await expect(
    page
      .locator('section[aria-labelledby="group-qualify-now"]')
      .getByRole('listitem')
      .first()
      .getByText('Not yet verified', { exact: true }),
  ).toBeVisible();
  await expectAccessible(page);
  await page.getByLabel('Institution', { exact: true }).selectOption({ label: 'UJ' });
  const card = page.getByRole('listitem').filter({ hasText: 'Bachelor of Arts' }).first();
  await card.getByRole('button', { name: 'Add to my shortlist' }).click();
  await expect(card.getByRole('button', { name: 'On my shortlist' })).toBeVisible();

  // Stage 2: the application pack.
  await goTo(page, 'Applications');
  await expect(page.getByRole('heading', { name: 'University of Johannesburg' })).toBeVisible();
  await page.getByRole('link', { name: 'Application pack' }).click();
  await expect(page.getByText(/Dates for your intake aren’t out yet/)).toBeVisible();
  await page.getByLabel('Certified copy of your ID or birth certificate').check();
  await expectAccessible(page);
  await page.reload();
  await expect(page.getByLabel('Certified copy of your ID or birth certificate')).toBeChecked();

  // Chat uses the same tools.
  await goTo(page, 'Chat');
  await page.getByLabel(/Ask anything/).fill('What can I study with my marks?');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(page.getByText(/You meet the minimums for \d+ degree/)).toBeVisible();

  // Funding.
  await goTo(page, 'Funding');
  await expect(page.getByRole('heading', { name: 'NSFAS bursary' })).toBeVisible();
  await expectAccessible(page);

  // Back home: the learner's own numbers now, the shortlist with its standing, the application.
  await goTo(page, 'Home');
  await expect(page.getByRole('heading', { level: 1, name: 'Welcome, Sipho' })).toBeVisible();
  await expect(page.getByTestId('home-number')).toHaveText(/^\d+$/);
  const shortlist = page.getByRole('region', { name: 'My shortlist' });
  await expect(shortlist.getByText('Bachelor of Arts').first()).toBeVisible();
  const applications = page.getByRole('region', { name: 'My applications' });
  await expect(applications.getByRole('link', { name: 'UJ' })).toBeVisible();
  await expect(
    page.getByText(/^One report so far: your final Grade 11 report averages \d+%/),
  ).toBeVisible();
  await expectAccessible(page);

  // Get help, a tap from every signed-in page: the crisis card, checked with axe.
  await goTo(page, 'Get help');
  await expect(page.getByRole('heading', { level: 1, name: 'Get help' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Talk to someone now' })).toBeVisible();
  await expectAccessible(page);
});

test('a Grade 12 learner sets a goal and sees the exam countdown', async ({ page }) => {
  await signIn(page, newPhone());
  await page.getByLabel('Date of birth').fill('2000-04-04');
  await page.getByRole('button', { name: 'Continue' }).click();
  await agreeAsAdult(page);
  await page.getByLabel('Which grade are you in?').selectOption('12');
  await page.getByRole('button', { name: 'Start' }).click();
  await openChatFromHome(page);
  await expect(page.getByText(/How are you doing/)).toBeVisible();

  await goTo(page, 'Documents');
  await page.getByRole('button', { name: 'Type in your marks' }).click();
  for (const [index, [subject, percent]] of MARKS.entries()) {
    await page.getByLabel(`Subject ${index + 1}`, { exact: true }).selectOption({ label: subject });
    await page.getByLabel('Mark (%)').nth(index).fill(percent);
  }
  await page.getByRole('button', { name: 'These marks are correct' }).click();
  await expect(page.getByRole('heading', { name: /You qualify now/ })).toBeVisible();

  await goTo(page, 'My goal');
  await expect(page.getByRole('heading', { name: 'My goal and exams' })).toBeVisible();
  await expect(page.getByText('You haven’t chosen a goal yet.', { exact: false })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Exam countdown' })).toBeVisible();
  // The 2026 timetable is preview data here: labelled on every paper while there are papers left.
  if (Date.now() < Date.parse('2026-11-20T12:00:00Z')) {
    const paper = page
      .locator('[data-testid^="paper-"]')
      .filter({ hasText: /Mathematics Paper \d/ })
      .first();
    await expect(paper).toBeVisible();
    await expect(paper.getByText('Not yet verified', { exact: true })).toBeVisible();
  }
  await expectAccessible(page);

  await page
    .getByLabel('The course I’m aiming for')
    .selectOption({ label: 'Bachelor of Engineering in Civil Engineering' });
  await page.getByRole('button', { name: 'Make this my goal' }).first().click();
  await expect(page.getByRole('link', { name: 'My UJ application pack' })).toBeVisible();
  // Focus goes to the card the save changed, never to <body> (A3-01, WCAG 2.4.3).
  await expect(page.getByRole('heading', { name: 'My goal', exact: true })).toBeFocused();
  // Free practice follows the goal (Phase 4e): Siyavula links, preview drafts labelled.
  await expect(
    page.getByText('Free practice for the subjects that matter most for', { exact: false }),
  ).toBeVisible();
  // The region named by its own heading (its id comes from useId, A3-05).
  const practice = page.getByRole('region', { name: 'Free practice', exact: true });
  await expect(practice.getByRole('link', { name: /Mathematics Grade 12/ })).toHaveAttribute(
    'href',
    'https://www.siyavula.com/read/za/mathematics/grade-12',
  );
  await expect(practice.getByText('Not yet verified', { exact: true }).first()).toBeVisible();
  await expectAccessible(page);

  // An exam-subject checkbox keeps keyboard focus through its save (A3-01).
  const geography = page.getByLabel('I write Geography', { exact: true });
  await geography.focus();
  await page.keyboard.press('Space');
  await expect(geography).not.toBeChecked();
  await expect(geography).toBeFocused();
  expect(await page.evaluate(() => document.activeElement?.tagName)).toBe('INPUT');

  // The goal is on the shortlist, so its pack opens.
  await page.getByRole('link', { name: 'My UJ application pack' }).click();
  await expect(page.getByRole('heading', { name: 'University of Johannesburg' })).toBeVisible();
});

test('a June report re-checks every course, and "what I need" shows the marks to aim for', async ({
  page,
}) => {
  await signIn(page, newPhone());
  await page.getByLabel('Date of birth').fill('2000-03-15');
  await page.getByRole('button', { name: 'Continue' }).click();
  await agreeAsAdult(page);
  await page.getByLabel('What should we call you?').fill('Lerato');
  await page.getByLabel('Which grade are you in?').selectOption('12');
  await page.getByRole('button', { name: 'Start' }).click();
  await openChatFromHome(page);
  await expect(page.getByText(/Hi Lerato!/)).toBeVisible();

  const typeIn = async (marks: Array<[string, string]>, kind?: string) => {
    await goTo(page, 'Documents');
    await page.getByRole('button', { name: 'Type in your marks' }).click();
    if (kind) await page.getByLabel('Which report is this?').selectOption({ label: kind });
    for (const [index, [subject, percent]] of marks.entries()) {
      await page
        .getByLabel(`Subject ${index + 1}`, { exact: true })
        .selectOption({ label: subject });
      await page.getByLabel('Mark (%)').nth(index).fill(percent);
    }
    await page.getByRole('button', { name: 'These marks are correct' }).click();
    await expect(page.getByRole('heading', { name: /You qualify now/ })).toBeVisible();
  };
  await typeIn([
    ['isiZulu Home Language', '74'],
    ['English First Additional Language', '62'],
    ['Mathematics', '58'],
    ['Physical Sciences', '55'],
    ['Life Sciences', '66'],
    ['Geography', '61'],
    ['Life Orientation', '80'],
  ]);
  await typeIn(
    [
      ['isiZulu Home Language', '80'],
      ['English First Additional Language', '72'],
      ['Mathematics', '71'],
      ['Physical Sciences', '68'],
      ['Life Sciences', '74'],
      ['Geography', '70'],
      ['Life Orientation', '80'],
    ],
    'Grade 12 June report',
  );

  // The re-check: what moved since the Grade 11 report.
  await expect(
    page.getByRole('heading', { name: 'Since your final Grade 11 report…' }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: /^Moved closer/ })).toBeVisible();
  await expectAccessible(page);

  // What I need, from a course the learner is close to.
  await page
    .locator('section[aria-labelledby="group-close"]')
    .getByRole('link', { name: /^What I need for this course/ })
    .first()
    .click();
  await expect(page.getByRole('heading', { level: 1, name: 'What I need' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Aim for' })).toBeVisible();
  await expect(
    page
      .getByRole('region', { name: /^What I need: / })
      .getByText('Not yet verified', { exact: true }),
  ).toBeVisible();
  await expectAccessible(page);
});

test('a distressed message gets helplines, not coaching', async ({ page }) => {
  await signIn(page, newPhone());
  await page.getByLabel('Date of birth').fill('2001-01-01');
  await page.getByRole('button', { name: 'Continue' }).click();
  await agreeAsAdult(page);
  await page.getByRole('button', { name: 'Start' }).click();
  await openChatFromHome(page);
  await page.getByLabel(/Ask anything/).fill('I want to die');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Talk to someone now' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Call 0800 567 567' })).toHaveAttribute(
    'href',
    'tel:0800567567',
  );
  await expectAccessible(page);
});

test('a failed trial gets care; the same moment crossing into risk gets helplines', async ({
  page,
}) => {
  await signIn(page, newPhone());
  await page.getByLabel('Date of birth').fill('2001-02-02');
  await page.getByRole('button', { name: 'Continue' }).click();
  await agreeAsAdult(page);
  await page.getByRole('button', { name: 'Start' }).click();
  await openChatFromHome(page);
  await page.getByLabel(/Ask anything/).fill('I failed my trial and I’m so stressed');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(page.getByText(/that’s a hard result to get/)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Talk to someone now' })).toHaveCount(0);
  await expectAccessible(page);

  await page.getByLabel(/Ask anything/).fill('I failed my trial, there’s no point living');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Talk to someone now' })).toBeVisible();
  await expectAccessible(page);

  // A10-35: the learner reports the newest reply, a crisis reply included, for a person to see.
  await page.getByRole('button', { name: 'Report this reply' }).last().click();
  await page.getByRole('radio', { name: 'It’s harmful or upsetting' }).check();
  await expectAccessible(page);
  await page.getByRole('button', { name: 'Send report' }).click();
  await expect(page.getByText('Thanks. A person at UniversityFlow will look at it.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Get help' }).last()).toHaveAttribute(
    'href',
    '/help',
  );
  await expectAccessible(page);
  // It stays reported when the conversation is opened again.
  await page.reload();
  await expect(page.getByText('Reported', { exact: true })).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Report this reply' })).toHaveCount(1);
});

test('a minor waits for a guardian, who agrees through the SMS link', async ({ page, browser }) => {
  await signIn(page, newPhone());
  await expect(page.getByRole('heading', { name: 'When were you born?' })).toBeVisible();
  // Before a date of birth, no signed-in page is reachable (hard rule 5, A1-10).
  await expectTurnedAway(page);
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

  // The learner can't reach their data yet (hard rule 5): every signed-in page redirects back
  // to onboarding's guardian step, and the server logs no error doing it (A1-10).
  await expectTurnedAway(page);
  await expect(
    page.getByRole('heading', { name: 'A parent or guardian needs to say yes' }),
  ).toBeVisible();
  await expectAccessible(page);

  // At night the SMS waits for 07:00 (A12-04): then the dev runner delivers it as if it were
  // 18:00 tomorrow, so the hour this test runs at can't decide it.
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
  const guardianCspViolations = await trackCspViolations(guardian);
  await guardian.goto(link);
  await expect(
    guardian.getByRole('heading', { name: 'A learner has asked for your permission' }),
  ).toBeVisible();
  await expectAccessible(guardian);
  await guardian.getByLabel(/I am this learner’s parent or legal guardian/).check();
  await guardian.getByRole('button', { name: 'I agree', exact: true }).click();
  await expect(guardian.getByText(/The learner can now use UniversityFlow/)).toBeVisible();
  expect(guardianCspViolations).toEqual([]);

  await page.goto('/onboarding');
  await expect(page.getByRole('heading', { name: 'Tell us a little about you' })).toBeVisible();
});

test('a learner opts in to SMS, gets a reminder, replies STOP, and gets nothing more', async ({
  page,
}) => {
  const phone = newPhone();
  const e164 = `+27${phone.slice(1)}`;
  await signIn(page, phone);
  await page.getByLabel('Date of birth').fill('2000-03-15');
  await page.getByRole('button', { name: 'Continue' }).click();
  await agreeAsAdult(page);
  await page.getByLabel('What should we call you?').fill('Thandi');
  await page.getByLabel('Which grade are you in?').selectOption('12');
  await page.getByRole('button', { name: 'Start' }).click();
  await openChatFromHome(page);
  await expect(page.getByText(/Hi Thandi!/)).toBeVisible();

  // Opt in to SMS on About me (planning.md §7.1): recorded with its time.
  await goTo(page, 'About me');
  await expect(page.getByRole('heading', { name: 'Reminders and messages' })).toBeVisible();
  await page.getByLabel('SMS', { exact: true }).check();
  await expect(page.getByText(/^On since /)).toBeVisible();
  await expectAccessible(page);

  // A reminder for now, delivered by the dev runner as if it were 18:00 tomorrow in South
  // Africa, so the hour this test runs at (quiet hours) can't decide it. 18:00 is after every
  // NSC paper and its margin: a learner with no confirmed subjects is held during every session
  // (audit A12-03), and in October and November tomorrow is often an exam day.
  const origin = new URL(page.url()).origin;
  const tomorrow = new Date();
  const at = (days: number) =>
    new Date(
      Date.UTC(tomorrow.getUTCFullYear(), tomorrow.getUTCMonth(), tomorrow.getUTCDate() + days, 16),
    ).toISOString();
  const remind = () =>
    page.request.post('/api/me/reminders', {
      headers: { origin },
      data: { templateId: 'reminder.check-in', channel: 'sms', at: new Date().toISOString() },
    });
  const run = (when: string) =>
    page.request.post('/api/dev/jobs/run', { headers: { origin }, data: { at: when } });
  expect((await remind()).status()).toBe(201);
  expect((await run(at(1))).status()).toBe(200);
  const reminder = await lastSms(page, phone);
  // Nothing personal on the lock screen (A11-02), and how to stop (A12-10).
  expect(reminder).toMatch(/^UniversityFlow: this is the check-in reminder you set\./);
  expect(reminder).toMatch(/ Reply STOP to stop\.$/);
  expect(reminder).not.toMatch(/Thandi/);

  // STOP, signed the way the provider signs it: the timestamp, the channel and the body (A5-06).
  const body = JSON.stringify({ type: 'message', from: e164, text: 'STOP' });
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = createHmac('sha256', process.env['UF_MESSAGING_WEBHOOK_SECRET'] ?? '')
    .update(`${timestamp}.sms.${body}`)
    .digest('hex');
  const stopped = await page.request.post('/api/messaging/sms/inbound', {
    headers: {
      'content-type': 'application/json',
      'x-uf-signature': `t=${timestamp},v1=${signature}`,
    },
    data: body,
  });
  expect(stopped.status()).toBe(200);
  // On SMS, GSM-7 typography (A1-14).
  expect(((await stopped.json()) as { reply: string }).reply).toMatch(/won't get any more/);
  // A forged STOP is refused.
  const forged = await page.request.post('/api/messaging/sms/inbound', {
    headers: {
      'content-type': 'application/json',
      'x-uf-signature': `t=${timestamp},v1=${'0'.repeat(64)}`,
    },
    data: body,
  });
  expect(forged.status()).toBe(401);
  // The STOP is confirmed on the channel itself, not only in the webhook's answer (A12-12).
  const confirmation = await lastSms(page, phone);
  expect(confirmation).toMatch(/won't get any more/);

  // Another reminder, a day later: nothing more arrives after the confirmation.
  expect((await remind()).status()).toBe(201);
  await run(at(2));
  expect(await lastSms(page, phone)).toBe(confirmation);

  // About me says how it was turned off.
  await page.reload();
  await expect(page.getByText('You turned this off by replying STOP.')).toBeVisible();
  await expect(page.getByLabel('SMS', { exact: true })).not.toBeChecked();
});

test('a learner says "I got in": a provisional offer, called provisional, with its reply-by reminder, accepted', async ({
  page,
}) => {
  await signIn(page, newPhone());
  await page.getByLabel('Date of birth').fill('2000-03-15');
  await page.getByRole('button', { name: 'Continue' }).click();
  await agreeAsAdult(page);
  await page.getByLabel('What should we call you?').fill('Naledi');
  await page.getByLabel('Which grade are you in?').selectOption('12');
  await page.getByRole('button', { name: 'Start' }).click();
  await openChatFromHome(page);
  await expect(page.getByText(/Hi Naledi!/)).toBeVisible();

  // SMS on, so a reply-by reminder has somewhere to go.
  await goTo(page, 'About me');
  await page.getByLabel('SMS', { exact: true }).check();
  await expect(page.getByText(/^On since /)).toBeVisible();

  // "I got in!" in the chat: glad with them, never "you're in", and pointed to My offers.
  const say = async (text: string) => {
    await goTo(page, 'Chat');
    await page.getByLabel(/Ask anything/).fill(text);
    await page.getByRole('button', { name: 'Send', exact: true }).click();
  };
  await say('I got in!');
  await expect(page.getByText(/Congratulations on hearing back!/)).toBeVisible();

  // My offers: the learner records it in their own words (hard rule 6).
  await goTo(page, 'My offers');
  await expect(page.getByRole('heading', { level: 1, name: 'My offers' })).toBeVisible();
  await expectAccessible(page);

  // A letter's check form (hard rule 6): announced by focus on its heading, and checked with axe
  // (A3-13, A3-22). Cancelled here: this learner types the offer in below.
  await page.locator('input[type="file"]').setInputFiles({
    name: 'letter.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.7\nsynthetic offer letter\n%%EOF'),
  });
  await expect(
    page.getByRole('heading', { level: 1, name: 'Check your offer letter' }),
  ).toBeFocused();
  await expectAccessible(page);
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'My offers' })).toBeFocused();

  const replyBy = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  await page.getByLabel('The course you were offered').selectOption('uj-beng-civil');
  await page.getByLabel('What kind of offer is it?').selectOption({ label: 'Provisional offer' });
  await page.getByLabel('Date to reply by (optional)').fill(replyBy);
  await page.getByRole('button', { name: 'Save this offer' }).click();
  await expect(page.getByText('Saved. Your offer is below.')).toBeVisible();

  // Described as provisional: not a place yet, never "you're in" (§8.5).
  const offer = page.getByRole('article', { name: 'Bachelor of Engineering in Civil Engineering' });
  await expect(offer.getByText('Provisional offer', { exact: true })).toBeVisible();
  await expect(offer.getByText(/A provisional offer is not a place yet/)).toBeVisible();
  await expect(offer).not.toContainText(/you’re in|you're in|final offer/i);
  await expect(offer.getByText('Not yet verified', { exact: true })).toBeVisible();
  // The reply-by reminder is scheduled through the 4a pipeline.
  await expect(offer.getByText(/^We’ll remind you on /)).toBeVisible();
  await expect(offer.getByText(/days left to reply$/)).toBeVisible();
  const replyByReminders = async () => {
    const response = await page.request.get('/api/me/reminders');
    const { reminders } = (await response.json()) as {
      reminders: Array<{ templateId: string; status: string }>;
    };
    return reminders.filter((r) => r.templateId === 'offer.reply-by').map((r) => r.status);
  };
  expect(await replyByReminders()).toEqual(['scheduled']);
  await expectAccessible(page);

  // The chat describes it the same way: the card the tool built, provisional.
  await say('I got in!');
  await expect(
    page.getByText(/Here is your offer\. Each card says what kind of offer it is/),
  ).toBeVisible();
  await expect(
    page
      .getByRole('article', { name: 'Bachelor of Engineering in Civil Engineering' })
      .getByText('Provisional offer', { exact: true }),
  ).toBeVisible();

  // Accept it: still provisional, and the reminder to reply is no longer needed. The card in the
  // chat links to My offers.
  await page.getByRole('link', { name: 'Open: My offers' }).click();
  await page
    .getByRole('button', {
      name: 'Accept this offer: Bachelor of Engineering in Civil Engineering',
    })
    .click();
  await expect(page.getByText('Saved: you’ve accepted this offer.')).toBeVisible();
  await expect(offer.getByText('You’ve accepted this offer')).toBeVisible();
  await expect(offer.getByText('Provisional offer', { exact: true })).toBeVisible();
  await expect(offer.getByText(/A provisional offer is not a place yet/)).toBeVisible();
  // Accept is gone now: focus is on the offer it changed, not <body> (A3-11).
  await expect(
    offer.getByRole('heading', { name: 'Bachelor of Engineering in Civil Engineering' }),
  ).toBeFocused();
  expect(await replyByReminders()).toEqual(['dropped']);
  await expectAccessible(page);

  // My campus and First week (Phase 5b) for the accepted offer's university, checked with axe
  // (A3-22). Ticking a step by keyboard keeps focus on its box (A3-12).
  await goTo(page, 'My campus');
  await expect(page.getByRole('heading', { level: 1, name: 'My campus' })).toBeVisible();
  await expectAccessible(page);
  await page.getByRole('link', { name: 'Your first-week checklist' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'First week' })).toBeVisible();
  const register = page.getByRole('checkbox', { name: 'Register', exact: true });
  await register.focus();
  await page.keyboard.press('Space');
  await expect(page.getByRole('status').filter({ hasText: /^Saved\.$/ })).toHaveCount(1);
  await expect(register).toBeChecked();
  await expect(register).toBeFocused();
  await expectAccessible(page);

  // The home at university: the accepted offer and first-week steps done, checked with axe.
  await goTo(page, 'Home');
  await expect(page.getByText('University · your first weeks at a glance')).toBeVisible();
  const ready = page.getByRole('region', { name: 'Getting ready' });
  await expect(ready.getByTestId('home-first-week')).toHaveText(/^1\/\d+$/);
  await expect(
    page.getByRole('region', { name: 'My offers' }).getByText('You’ve accepted this offer'),
  ).toBeVisible();
  await expectAccessible(page);
});

// Phase 5c. The curriculum is a synthetic TEST-coded draft (lib/server/e2e-fixtures.ts, switched
// on by UF_CATALOGUE_E2E_FIXTURES in playwright.config.ts): the catalogue holds no curriculum a
// test can rely on. The faculty office and the 2027 calendar are UP's own draft records.
test('a learner with an accepted offer uploads a proof of registration, confirms the modules, and sees one missing module with who to see and the deadline', async ({
  page,
}) => {
  await signIn(page, newPhone());
  await page.getByLabel('Date of birth').fill('2000-03-15');
  await page.getByRole('button', { name: 'Continue' }).click();
  await agreeAsAdult(page);
  await page.getByLabel('What should we call you?').fill('Kagiso');
  await page.getByLabel('Which grade are you in?').selectOption('12');
  await page.getByRole('button', { name: 'Start' }).click();
  await openChatFromHome(page);
  await expect(page.getByText(/Hi Kagiso!/)).toBeVisible();

  // An accepted offer gives the course.
  const course = 'Bachelor of Science in Computer Science';
  await goTo(page, 'My offers');
  await page.getByLabel('The course you were offered').selectOption('up-bsc-computer-science');
  await page.getByLabel('What kind of offer is it?').selectOption({ label: 'Final offer' });
  await page.getByRole('button', { name: 'Save this offer' }).click();
  await expect(page.getByText('Saved. Your offer is below.')).toBeVisible();
  await page.getByRole('button', { name: `Accept this offer: ${course}` }).click();
  await expect(page.getByText('Saved: you’ve accepted this offer.')).toBeVisible();

  // My modules: nothing yet; upload the proof (the local stand-in reads a labelled sample).
  await goTo(page, 'My modules');
  await expect(page.getByRole('heading', { level: 1, name: 'My modules' })).toBeVisible();
  await expect(page.getByText(/Nothing to check yet/)).toBeVisible();
  await expectAccessible(page);
  await page.locator('input[type="file"]').setInputFiles({
    name: 'proof.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.7\nsynthetic proof of registration\n%%EOF'),
  });

  // Every row shown back to confirm (hard rule 6), the course taken from the accepted offer.
  await expect(page.getByRole('heading', { name: 'Check your modules' })).toBeVisible();
  await expect(page.getByText(/these are sample modules, not read from your file/)).toBeVisible();
  await expect(page.getByLabel('Your course')).toHaveValue('up-bsc-computer-science');
  await expect(page.getByLabel('Module 1: code')).toHaveValue('TEST101');
  await expect(page.getByLabel('Module 3: semester or term')).toHaveValue('S2');
  await expectAccessible(page);
  await page.getByRole('button', { name: 'These are my modules: check them' }).click();

  // The check: one missing module, who to see, the message, the last day to change.
  await expect(page.getByText('Saved. Your check is below.')).toBeVisible();
  const check = page.getByRole('article', { name: course });
  await expect(check.getByText('1 thing to fix')).toBeVisible();
  await expect(check.getByTestId('modules-differences').getByRole('listitem')).toHaveCount(1);
  await expect(check.getByTestId('modules-differences')).toContainText(
    'You’re not registered for TEST104 (Sample module four).',
  );
  await expect(check.getByRole('heading', { name: 'Who to see' })).toBeVisible();
  await expect(check.getByTestId('modules-office')).toContainText(
    'Engineering, Built Environment and Information Technology',
  );
  await expect(check.getByTestId('modules-message')).toContainText(
    'I am not registered for TEST104 (Sample module four)',
  );
  await expect(
    check.getByRole('heading', { name: 'Last day to change your registration' }),
  ).toBeVisible();
  await expect(check.getByTestId('modules-deadline')).toContainText('Second-semester modules');
  await expect(check.getByText('Not yet verified', { exact: true }).first()).toBeVisible();
  await expectAccessible(page);

  // The home counts the confirmed modules.
  await goTo(page, 'Home');
  await expect(
    page.getByRole('region', { name: 'Getting ready' }).getByTestId('home-modules'),
  ).toHaveText(/^\d+$/);
  await expectAccessible(page);
});
