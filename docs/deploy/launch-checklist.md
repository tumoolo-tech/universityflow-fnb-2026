# Launch checklist (the owner's launch standard)

From the owner's launch standard (every site Tumoolo ships), read against the code at
`phase-5/deploy-readiness` on 2026-10-23. **✅ in code** means the code does it today and a test
or audit says so. **🟡 partly** means part is done or it's only been measured locally. **⬜ not yet**
means nothing exists yet. **👤 owner** means it can only be checked on the live site or in an
account. Nothing on this list has been checked on a live site, because none exists yet.

Run the 👤 items on the **live production site** (Vercel `cpt1`), not on staging, a preview or
`next dev`. A local "sent" proves nothing (tumoolo.tech, 2026-10-17).

## Where it runs

| Item | State | Where |
|---|---|---|
| Functions in `cpt1`, refused elsewhere | ✅ in code | `apps/web/vercel.json`; `readConfig` refuses another `VERCEL_REGION` (A1-06); `config.test.ts` |
| Production refused on Render | ✅ in code | `readConfig` refuses when `RENDER` is set; `config.test.ts` |
| S3 in `af-south-1`, refused elsewhere | ✅ in code | `readS3` in `lib/server/config.ts`; `config.test.ts` |
| RDS in `af-south-1` | 👤 owner | A database URL doesn't name its region: confirm in the AWS console that the instance is in Africa (Cape Town) |
| Accounts owned by Tumoolo (Vercel Pro team, AWS) | 👤 owner | [hosting-account.md](hosting-account.md) |
| Deploys only after CI passes | ✅ in code | `.github/workflows/deploy.yml` (a deploy hook after CI). 👤 Turn off Vercel's automatic production deploys for `main` |
| Health check | ✅ in code | `GET /api/health` (`app/api/health/route.ts`, `health.test.ts`) |

## Security

| Item | State | Where |
|---|---|---|
| HTTPS with HSTS | ✅ in code | `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` in `apps/web/next.config.ts`. 👤 Vercel serves HTTPS. Submit to the HSTS preload list only once every subdomain is HTTPS |
| Content-Security-Policy | ✅ in code | `lib/csp.ts`: a per-request nonce from `proxy.ts` for pages, a nonce-free policy for `/api/*`; `test/csp.test.ts`; audit finding 2 |
| Other security headers | ✅ in code | `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options: DENY`, `Permissions-Policy` (`next.config.ts`); `poweredByHeader: false` |
| No exposed database | 🟡 partly | The app reaches it only from the server. Row-level security per learner (planning.md §8.1). 👤 Turn off **Publicly accessible** on the RDS instance, and limit its security group to what Vercel needs |
| Spam protection on forms | 🟡 partly | The only public form is sign-in (a PIN by SMS). It has per-number and per-IP limits, lockout (`request-pin/route.ts`, `packages/db`), and global SMS budgets (`UF_SMS_BUDGET_*`, `UF_SMS_REMINDER_BUDGET_*`). There's no honeypot, time-trap or Turnstile. Turnstile goes on sign-in once it's keyed. The site has no contact form |
| Secrets only in the host's environment | ✅ in code | `.env.example` documents every variable (`pnpm check` env-documented guard). `render.yaml` holds none (`render-blueprint.test.ts`) |

## Forms deliver on the LIVE site

| Item | State | Where |
|---|---|---|
| Sign-in PIN reaches a real phone | 👤 owner | Once the SMS provider is connected (D8): request a PIN on the live site to a real test phone and confirm it arrives |
| Guardian consent link reaches the guardian's phone and opens on the live domain | 👤 owner | Check that `UF_PUBLIC_URL` is the production domain in Vercel's **Production** environment |
| Production keys set in the Production environment | 👤 owner | `ANTHROPIC_API_KEY`, the SMS provider, `UF_S3_*`, `AUTH_SECRET`, `UF_JOBS_PROVIDER`. The app refuses to start without them, and `/api/health` answers 503 |
| Email sending domain (DKIM) | n/a today | The app sends no email. If it ever does, verify the sending domain (DKIM record live) before launch |
| STOP replies are heard | ✅ in code | A live SMS or WhatsApp adapter must have an inbound verifier, or the app refuses to start (A5-02). 👤 Send STOP from a real phone |

## Speed

| Item | State | Where |
|---|---|---|
| Lighthouse ≥ 90, desktop | 🟡 partly | 100 on every page measured, on a **local** production build (docs/audits/results/PHASE-5-DESIGN-A4.md). 👤 Measure the live site |
| Lighthouse mobile (slow 4G), aim ≥ 90 | 🟡 partly | 94–99 locally (one cold start at 89), same audit. 👤 Measure the live site |
| First screen doesn't wait on JavaScript | ✅ in code | Root chunks ≤ 150 KB gzipped, checked in CI (`scripts/ci/root-chunk-budget.mjs`). Results render on the server (A4-03) |

## Devices, browsers, accessibility

| Item | State | Where |
|---|---|---|
| 360px phone: no sideways scroll; menu, forms and links by touch | 🟡 partly | E2E at 360px for some journeys (`e2e/grade-10.spec.ts`, `e2e/profile-look.spec.ts`). The E2E project is a Pixel 7. 👤 Audit every page at 360px on each release |
| Chrome, Safari, Edge, Firefox (current and previous), Windows, Mac, iPhone, Android | ⬜ not yet | The E2E suite runs Chromium only. 👤 A manual pass, or more Playwright projects (WebKit, Firefox) |
| WCAG 2.2 AA, checked with axe | ✅ in code | axe in every E2E journey (`e2e/helpers.ts`); hard rule 9. The staging banner adds no motion |
| Reduced motion | ✅ in code | Hard rule 9; audits A3 |

## Privacy and compliance (POPIA / ECTA)

| Item | State | Where |
|---|---|---|
| Privacy policy page (a template for the legal adviser) naming the responsible party, information officer, what's collected (IP for spam checks), retention, every operator and cross-border transfer, data-subject rights, the Information Regulator's details | ⬜ not yet | Planned this session as its own item (status.md). The store version is `docs/store/privacy-and-data-safety.md` |
| A required, unticked consent box on every form, linking to the policy | 🟡 partly | Consent steps exist for guardians and adults (consent v3, `adult-consent`). The link to a web privacy page waits for that page |
| Cookie-free visitor statistics | ⬜ not yet | There are no visitor statistics at all, and the CSP allows no third-party script. Choose a cookie-free counter (self-hosted, `af-south-1`) and add it to the privacy page as an operator |
| Fonts self-hosted, no font CDN | ✅ in code | Outfit from `app/fonts/Outfit-latin.woff2` via `next/font/local` (`app/layout.tsx`). The CSP allows `'self'` only |
| ECTA s43 footer: full legal name, legal status, registration number (or "not registered"), physical address, phone, email | ⬜ not yet | No footer with these details. 👤 The owner supplies them; the copy goes in `packages/content` |
| POPIA s72 assessment (AI, SMS, ElevenLabs outside South Africa) | 👤 owner | planning.md §8.1. Legal review owed |
| Information Officer registered | 👤 owner | planning.md §8.1 |

## Search

| Item | State | Where |
|---|---|---|
| Metadata (title, description) | ✅ in code | `generateMetadata` in `app/layout.tsx` |
| Canonical URL | ⬜ not yet | Add `metadataBase` and `alternates.canonical` from `UF_PUBLIC_URL` |
| `sitemap.xml`, `robots.txt` | ⬜ not yet | No `app/sitemap.ts` or `app/robots.ts`. Signed-in pages are disallowed; staging already says `noindex` |
| Structured data | ⬜ not yet | No JSON-LD. An `Organization` and `WebSite` on the front door. Its `<script>` needs the CSP nonce |
| 404 page | 🟡 partly | Next's built-in not-found page, rendered per request so the nonce reaches it (gotcha 16). There's no designed `app/not-found.tsx` |
| Redirects for old URLs | n/a | No earlier site |

## Staging (if used)

| Item | State | Where |
|---|---|---|
| Synthetic data only | ✅ in code | `UF_DEPLOYMENT=staging` refuses live providers; `render.yaml` has no database or keys (README.md §2) |
| Can't be taken for production | ✅ in code | The "Staging" banner on every page, `noindex`, and it refuses `VERCEL_ENV=production` |
| An access gate | ✅ in code | A5-10: HTTP Basic against `UF_STAGING_PASSWORD` on every page (`proxy.ts`) and API route (`handler()`), `/api/health` open; staging refuses to start without it (`staging-gate.test.ts`). 👤 Set the password in Render's dashboard |
