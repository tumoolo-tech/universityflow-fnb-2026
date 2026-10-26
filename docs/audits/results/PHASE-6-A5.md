# PHASE-6 — A5 Security

**Project:** UniversityFlow · **Phase:** 6 (wave 10 audit of #115–#134) · **Date:** 2026-10-25
**Commit:** e09ad5b4 · **Audit source:** tumoOLO_Audits @ 29eafd7
**Result:** 0 Critical · 1 High · 1 Medium · 2 Low · 0 waived · 3 not measured

## Scope

`c0e1545c..e09ad5b4` on `main` (#115 to #134). Read in full: every route added or changed
(`api/module-outlines`, `api/module-outlines/[id]`, `api/modules/[registrationId]/[code]`,
`api/demo/sample-outline`, `api/demo/sample-report`, `api/documents`, `api/documents/uploads/[id]`,
`api/auth/request-pin`, `api/auth/verify-pin`, `api/me/guardian`, `api/me/cv/drafts`,
`api/me/cv/tailorings`), `lib/server/demo/phone-signup.ts`, `lib/demo-phone-signup.ts`,
`lib/server/demo/core.ts` (sweeps, `leaveCurrent`), `lib/server/module-card.ts`,
`lib/server/module-outlines.ts`, `lib/server/documents.ts`, `lib/server/services.ts` (diff),
`lib/server/config.ts` (diff), `lib/csp.ts`, `proxy.ts`, `lib/mmereko-canvas.ts`,
`lib/server/cv-mmereko.ts`, `app/(app)/cv/page.tsx`, `app/(app)/cv/mmereko-canvas.tsx`,
`app/(app)/nav.tsx`, `app/sign-in/sign-in-form.tsx`, `app/demo/new-learner/page.tsx`,
`app/demo/sign-up/*` (diff), `packages/db/src/store.ts` (diff), `packages/db/src/phone.ts`,
`packages/db/src/module-outlines.ts`, migrations 0040 and 0041, `lib/server/demo/cv-inline.ts`
(logging), `packages/catalogue/src/book-links.ts` (`librarySearchLink`), `.gitleaksignore` and the
seven commits it names, `.github/workflows/ci.yml` (diff), `pitch/` (README and scripts), the
photos commit fefa236e. The integrator's `cv-csp.mjs` and `cv-frame-check.mjs` were read, not run.

## Method

Code read against the A5 brief and docs/audits/A5.project.md. Live, read-only GETs of
https://universityflow.tumoolo.tech (`/`, `/demo/sign-up`, `/cv`, `/api/health`, a 404) and
https://mmereko.tumoolo.tech (`/`, `/login`) for headers. A regex secret scan over every added
line in the scope (keys, tokens, private keys, connection strings), and each `.gitleaksignore`
line read at its commit. One throwaway test (below), run under a suite lock against the real route
handlers and an embedded database, then deleted.

**Attack surface map.** New writes in scope: a learner's module outlines (PUT, DELETE), a
module's marks and target (PUT), the demo's sample outline (POST), and, on the judge demo only,
phone sign-in with the PIN returned on screen and the guardian's link returned to the learner.
New third party in the browser: Mmereko's site in an iframe on `/cv`. An attacker goes for one
learner reading or writing another's outline or marks (holds: RLS plus an own-registration check),
for the demo's sign-up to land in someone else's account (**A5-27, proven**), and for the CSP
changes (scoped well, but see A5-28).

## Findings

| ID | Audit | Severity | Location | Finding | Status | Plan |
|---|---|---|---|---|---|---|
| A5-27 | A5 | High | apps/web/lib/server/demo/phone-signup.ts:77-114; lib/server/demo/core.ts:82-89 | Demo on-screen sign-up: a browser's `uf_demo_phone` mark is a keyed hash of the **number only** and is never cleared, so after its account goes ("Switch learner", or the sweep) and another judge makes a new account on the same 080 number, the first browser is let in to the second judge's account (proven: 200, `isNewStudent=false`, same account id) | Open | Bind the mark to the account (HMAC over number + the account's id or `createdAt`), compare with the account that holds the number now, and clear the cookie in `leaveCurrent`; regression test below |
| A5-28 | A5 | Medium (suspected) | apps/web/proxy.ts:23-30; lib/mmereko-canvas.ts:103-113; app/(app)/nav.tsx:173; proxy.ts:47-52 (Firebase) | The CSP widenings are per document: `frame-src https://mmereko.tumoolo.tech` only in `/cv`'s own response, Firebase's sources only in `/demo/sign-up`'s. Both pages are reached by `next/link` (sidebar "My CV"; the landing page, `/demo` and `/sign-in` buttons), a soft navigation that keeps the previous page's policy, so the Mmereko frame (and Firebase's `connect-src`/`frame-src`) should be refused unless the page was loaded directly. Every check so far used `page.goto` | Open | Check in a browser first (sidebar to My CV, Open Mmereko, console shows "Refused to frame"); if confirmed, raise to High and make those links full loads (`<a>`, not `Link`) or carry the widening on every page that links there; add an E2E that arrives by clicking |
| A5-29 | A5 | Low | apps/web/lib/server/session.ts:14, 86-92; lib/server/demo/phone-signup.ts:107-113 | `uf_session` (and `uf_demo_phone`) are plain host cookies without the `__Host-` prefix. The demo now lives at universityflow.tumoolo.tech beside mmereko.tumoolo.tech (framed on /cv) and tumoolo.tech: any sibling site can set a `Domain=tumoolo.tech` cookie of the same name (session fixation, login CSRF into an attacker's account) | Open | `__Host-uf_session` (Secure, Path=/, no Domain); `__Host-` or `__Secure-` for the demo mark; before production picks its domain |
| A5-30 | A5 | Low | Mmereko (its repo): live headers of https://mmereko.tumoolo.tech | Mmereko's own headers: HSTS `max-age=63072000` without `includeSubDomains; preload`; the only CSP is `frame-ancestors 'self' https://universityflow.tumoolo.tech https://universityflow.vercel.app` (no script policy); the old `universityflow.vercel.app` stays allowed to frame it | Open | Mmereko's next release: a full CSP, HSTS with includeSubDomains, frame-ancestors only the live UniversityFlow origin(s) |

### A5-27 (High): taking over another judge's demo account

`requireFreeOrOwn` (phone-signup.ts:91-97) lets a browser in when the number has an account and the
browser's cookie equals `HMAC(AUTH_SECRET, "uf-demo-phone-owner:v1:" + number)`. That value
depends on the number alone, the cookie lasts 24 hours from the browser's last sign-in, and nothing
clears it: `leaveCurrent` (core.ts:82-89) deletes the account and the session only. Judges pick
easy numbers (the code says so), so the second judge on 0800000000 after the first switched learner
is the expected case, not a contrived one. The first browser then gets the second judge's PIN on
screen and their account. The overlay calls one learner acting as another at least High; the data
is made-up by instruction, but the feature's own promise ("a taken number belongs to the browser
that made it", docs/deploy/demo.md) is exactly what fails, and on the demo real photos are allowed
(A11-51).

Throwaway test (apps/web/test/aud-a5-takeover.test.ts, the setup of
api-demo-phone-signup.test.ts), run under a suite lock, then deleted:

```ts
it('judge A, after "Switch learner", can still sign in to judge B’s account on the same number', async () => {
  const phone = tollFree();
  const a = new Browser();
  const first = await requestPin(a, phone);
  expect((await verify(a, phone, first.body.demoPin)).status).toBe(200);
  const idA = await accountId(a);
  // A leaves: the account is deleted, the browser's mark for the number stays.
  const left = await a.call(routes.switch, '/api/demo/switch', {
    method: 'POST', body: '', headers: { 'content-type': 'application/x-www-form-urlencoded' },
  });
  expect(left.status).toBe(303);
  // B picks the same easy number: it is free again, so B makes an account with it.
  later(); // past the number's one-minute PIN cooldown
  const b = new Browser();
  const second = await requestPin(b, phone);
  expect(second.status).toBe(200);
  expect((await verify(b, phone, second.body.demoPin)).status).toBe(200);
  const idB = await accountId(b);
  expect(idB).not.toBe(idA);
  // A comes back to the number: the server should say "taken" (409 demo-080-taken).
  later();
  const third = await requestPin(a, phone);
  console.log(`A asks for B's number: ${third.status} ${third.body.detail ?? ''}`);
  if (third.status === 200) {
    const signed = await verify(a, phone, third.body.demoPin);
    console.log(`A verifies: ${signed.status}, isNewStudent=${signed.body.isNewStudent}`);
    console.log(`A is now in B's account: ${(await accountId(a)) === idB}`);
  }
  expect(third.status).toBe(409);
  expect(third.body.detail).toBe('demo-080-taken');
});
```

Output:

```
A asks for B's number: 200
A verifies: 200, isNewStudent=false
A is now in B's account: true
 × judge A, after "Switch learner", can still sign in to judge B’s account on the same number
AssertionError: expected 200 to be 409 // Object.is equality
 Test Files  1 failed (1)
```

The same happens without "Switch learner": A signs in again at hour 23 (the cookie is renewed for
24 hours), the sweep deletes A's account after hour 24, B takes the number, and A's mark still
matches. The fix must hold both paths; the test above, kept, fails without it.

### A5-28 (Medium, suspected): the per-page CSP and soft navigation

A Content-Security-Policy delivered with a response governs the document it created. Next's
`Link` navigations fetch the next page's RSC payload and keep the same document, so the policy of
the page where the visit started stays in force. Live headers: `/` and every other page send no
`frame-src` (so `default-src 'self'` governs frames) and `connect-src 'self'`; only `/cv` sends
`frame-src 'self' https://mmereko.tumoolo.tech` and only `/demo/sign-up` sends Firebase's
`connect-src`/`frame-src`. Both are linked with `next/link` (`nav.tsx:173`, `ButtonLink` for `/`
paths, `components/ui.tsx:86-87`; `app/page.tsx:67-96`, `app/demo/page.tsx:39`,
`app/sign-in/page.tsx:39`). `e2e/demo-features.spec.ts:213`, the live smoke and
`cv-frame-check.mjs` all reach `/cv` with `page.goto`, a full load, so none would notice. Not run in
a browser (not allowed in this audit), hence "suspected". The Firebase half predates the scope
(#83) but the brief names its CSP; it is the same root cause.

## Not measured

- **The client bundle and built output for secrets.** No `next build` allowed; the source scan of
  every added line found only test values (`test-key-not-real`, synthetic secrets in tests).
- **Browser behaviour of the frame and of A5-28.** No browser allowed; reasoned from the CSP spec,
  the live headers and the link components.
- **The pitch deck's binaries** (`pitch/*.pptx`, `*.pdf`, images) for embedded secrets: compressed,
  not scanned. Its README and scripts hold none, and the photos commit (fefa236e) added only
  `.gitignore` and script changes: `git ls-files photos` is empty.

## Waived

None.

## Holds (checked and sound)

- **Outlines (#124).** `requireReady` (sign-in, same-origin, consent) on every method; 30 confirms an
  hour; a strict schema with field caps, checked again in the store and again in the database
  (`uf_module_outline_ok`, 64 KB, weights to 100, no ID/student/mobile number); `documentId` read
  under RLS and required to be a `module-outline`; RLS on `module_outlines`; DELETE takes a UUID and
  RLS scopes it. The outline-upload consent gate (D9) is a trigger, for every role.
- **Module marks (#129).** The card exists only when `registrationId` equals the learner's own
  latest registration and the code is on it (`module-card.ts:176-184`); marks only for a coursework
  component of the resolved scheme; 120 saves an hour; strict zod plus database checks (0–100, NaN
  refused, no personal numbers in a component name); RLS on both tables.
- **Sample outline and uploads.** `requireDemo` first; the upload quota; the demo's upload route
  takes only the generator's SAMPLE PDFs, as a report or an outline. The direct-to-S3 path is
  unchanged apart from the `kind`, and the consent trigger decides whether that kind may be stored.
- **Demo phone sign-up stays on the demo.** `UF_DEMO_PHONE_SIGNUP` is a demo-only marker
  (production and staging refuse it, `DEMO_ONLY` at config.ts:500-511); `readConfig` reads it only when
  `demo`; the `Store` throws if `demoPhoneSignup` is set without `demo`
  (store.ts:736-741), so the 100-an-hour PIN limit cannot reach a production store. Only toll-free
  numbers on the learner's, the guardian's and the verify path; the PIN is never logged (test);
  demo sessions end when the account's 24 hours do (store.ts:1141-1149).
- **Open Mmereko (#133).** `frame-src` names Mmereko's origin alone, on `/cv` alone, only with
  `UF_CV=1` and the switch exactly `1` (`mmerekoFrameOrigin`); `MMEREKO_APP_URL` must be a bare
  https origin, not localhost. The iframe: `referrerPolicy="no-referrer"`, a fixed `/login` URL with
  no query, created only when the dialog opens; sandbox without `allow-top-navigation`;
  `allow="clipboard-write"` only; no `postMessage` listener anywhere in the diff. "Open in a new
  tab" and the site link carry `rel="noopener noreferrer"`. The 18+/university decision is made on
  the server (`cv/page.tsx:52-56`), so a school learner under 18 gets no button, dialog or frame.
  Mmereko's live `frame-ancestors` allows UniversityFlow's domains only (Mmereko #6). UniversityFlow's
  same-origin check compares the Origin's host with Host exactly (`http.ts:205-218`), so the
  same-site sibling cannot pass it.
- **Firebase's widening** is on `/demo/sign-up` only, on a demo with `UF_DEMO_SIGNUP=firebase`
  (live: identitytoolkit, securetoken, the auth domain's frame, apis.google.com, nowhere else).
- **next 16.4.3 (#132).** Live: nonce CSP with `strict-dynamic`, enforcing; HSTS
  `max-age=63072000; includeSubDomains; preload`; nosniff; `X-Frame-Options: DENY` and
  `frame-ancestors 'none'`; `Referrer-Policy: strict-origin-when-cross-origin`; API responses get the
  nonce-free CSP. `proxy.ts` changed only by the Mmereko line.
- **Secrets.** All seven `.gitleaksignore` entries are false positives, each read at its commit:
  two SHA-256 checksums in `packages/cv/contract/SOURCE.json` (line 29, a file hash) and the
  golden vector's documented synthetic secret (`webhook-golden-vector.json:3`, used nowhere else);
  `config.ts:321` is the setting name `UF_MINDMAP_WORDS`; the four `plan-maps.ts` lines are slot keys
  (`finish-grade-10`, `finish-grade-11`). Entries are pinned to commit, file and line, so anything
  new still fails. No secret in the scope's added lines, `pitch/` text files or the photos commit.
- **Client side.** No `dangerouslySetInnerHTML`, `eval`, `new Function` or message listener added;
  every new `target="_blank"` has `rel="noopener noreferrer"`; library search links encode the
  query (`book-links.ts:451`).
- **Logs.** The one new `console.error` (demo CV inline jobs) logs the job kind and the error's name
  only.

## Carried-in findings

A5-08 (incident response): unchanged by this scope; the #110 draft waits for the owner. A11-19 to
A11-23: owner and legal items, unchanged. A10-46 (Gemini on the demo): still stands until
2026-11-08, and #116 lets a judge make an under-18 learner who then chats on Gemini.

## Remediation roadmap

- Quick (under a day): A5-27 (bind and clear the mark, with the test above); verify A5-28 in a
  browser and, if confirmed, full loads for the two links plus a click-through E2E.
- Medium: A5-29 cookie prefixes (touches sign-in, sign-out, the app's bearer path and every test
  that names the cookie).
- Structural: A5-30 on Mmereko's side.

## What's genuinely good

The database refuses what the code refuses (outline shape, marks range, consent coverage) for every
role; IDs are scoped twice (RLS plus an own-registration check); every demo exception is guarded in
three places (config, store constructor, route), so none can leak into production; and the Mmereko
door sends Mmereko nothing at all, by construction rather than by policy.
