# PHASE-6 — A6 SEO and content

**Project:** UniversityFlow · **Phase:** 6 (wave 10 audit of #115–#134) · **Date:** 2026-10-25
**Commit:** e09ad5b4 · **Audit source:** tumoOLO_Audits @ 29eafd7 (`audit.mjs brief A6`)
**Result:** 0 Critical · 0 High · 3 Medium · 3 Low · 0 waived · 3 checks not measured

The first A6 on this project (no earlier A6 IDs in status.md or docs/audits/results), so the
technical half covers the whole public site, and the content half the pages in scope.

## Scope

- Commits `c0e1545c..e09ad5b4`; pages added or changed: the front door (`/`, #121, #133),
  `/colleges/registered` (#131), `/privacy` (#133 polish), `/demo` and `/demo/guide`, `/demo/sign-up`,
  `/demo/new-learner` (#116), `/sign-in`, `/help`, the 404 (`app/not-found.tsx`).
- Read: `apps/web/app/layout.tsx` (`generateMetadata`), each page's `metadata`, `app/not-found.tsx`,
  `apps/web/public/` (top level), `components/{card-art,split-stage,university-mark,college-card,coming-next}.tsx`,
  `packages/content/src/en/{colleges,demo-personas,cv-mmereko,demo-phone-signup,module-card,module-outline}.ts`,
  `docs/deploy/launch-checklist.md`.
- Live, read-only GETs to https://universityflow.tumoolo.tech (the demo deployment; production
  isn't deployed): status, `<meta name="robots">`, title, description, canonical, `og:*`, JSON-LD,
  `<h1>` count, `<img alt>`, and the main text of `/`, `/demo/guide`, `/colleges/registered?name=…`,
  the 404. Script: GET only, no forms, no sign-up, no learner start.

## Method

- Live headers and `<head>` for 13 paths (results below).
- A scan of every `.tsx` in apps/web and apps/native changed in scope for literal JSX text and
  literal `aria-label`/`placeholder`/`title`/`alt`/`label`/accessibility attributes (hard rule 8),
  and a second scan for quoted English phrases in changed `.ts`/`.tsx` files (apps and
  packages/ui).
- Every literal internal `href`/`action`/`redirect()`/`push()` in apps/web/app and
  apps/web/components checked against the App Router's routes (25 distinct targets, all resolve).

## Live results (2026-10-25)

| Path | Status | robots | Title | Description | Canonical / OG / JSON-LD |
|---|---|---|---|---|---|
| `/` | 200 | noindex, nofollow | UniversityFlow | From Grade 10 to graduation day. | none |
| `/demo` | 200 | noindex, nofollow | Try UniversityFlow · UniversityFlow | (tagline) | none |
| `/demo/guide` | 200 | noindex, nofollow | A three-minute guide for judges · UniversityFlow | (tagline) | none |
| `/demo/sign-up` | 200 | noindex, nofollow | Sign up for the judges’ demo · UniversityFlow | (tagline) | none |
| `/demo/new-learner` | 200 | **noindex** (page's own) | Sign up as a new learner · UniversityFlow | (tagline) | none |
| `/sign-in` | 200 | noindex, nofollow | Try UniversityFlow · UniversityFlow | (tagline) | none |
| `/privacy` | 200 | noindex, nofollow | Privacy policy · UniversityFlow | own, 117 chars | none |
| `/colleges/registered` (and `?name=`) | 200 | noindex, nofollow | Is this college registered? · UniversityFlow | own, 199 chars | none |
| `/help` | 200 | noindex, nofollow | Get help · UniversityFlow | (tagline) | none |
| `/no-such-page` | **404** | noindex, nofollow | We couldn’t find that page. · UniversityFlow | (tagline) | none |
| `/robots.txt` | **404** | | | | |
| `/sitemap.xml` | **404** | | | | |

The demo is noindex on every page (layout.tsx:35-41 adds it for `UF_DEPLOYMENT=demo` and
staging); the 404 returns a real 404 with one heading and a way home.

## Findings

| ID | Audit | Severity | Location | Finding | Status | Plan |
|---|---|---|---|---|---|---|
| A6-01 | A6 | Medium | apps/web/app (no robots.ts, sitemap.ts; nothing in public/) | No `robots.txt` and no `sitemap.xml`: both 404 live. In production nothing tells a crawler to leave signed-in routes, `/consent/[token]` links or `/api` alone, and nothing lists the public pages. The launch standard requires both (docs/deploy/launch-checklist.md:80 already says "not yet") | Open | `app/robots.ts` per environment (production: allow the public pages, disallow `/api`, `/consent`, the signed-in routes; staging and demo: disallow all) and `app/sitemap.ts` for `/`, `/privacy`, `/help`, `/colleges/registered`; a test per environment |
| A6-02 | A6 | Medium | apps/web/app/layout.tsx:35-41 | No `metadataBase` and no canonical on any page. `/colleges/registered?name=…` is a public GET form, so in production every typed name is a separate indexable URL of the same page | Open | `metadataBase` from `UF_PUBLIC_URL` and `alternates.canonical` per page (the bare path for `/colleges/registered`); a test that each public page has one absolute canonical |
| A6-03 | A6 | Medium | apps/web/app/layout.tsx, app/page.tsx | No Open Graph or Twitter tags and no structured data anywhere: a shared link to the front door or the college check shows no picture or summary, and search gets no `Organization`/`WebSite` (launch-checklist.md:81) | Open | `openGraph`/`twitter` in the root metadata with a 1200×630 image; JSON-LD `Organization` and `WebSite` on `/` with the CSP nonce |
| A6-04 | A6 | Low | layout.tsx:39; pages without their own `description` | Seven of nine public pages share the tagline "From Grade 10 to graduation day." (32 characters) as their description; `/demo` and `/sign-in` on the demo share one title ("Try UniversityFlow") | Open | A description key per public page (140–160 characters); `/sign-in` its own title on the demo |
| A6-05 | A6 | Low | packages/content/src/en/colleges.ts:65 (`check.lead`); apps/web/app/(app)/results/results-view.tsx:147 | `/colleges/registered`, the one page useful to anyone who isn't signed in, has a 199-character description and is linked only from the signed-in results page: no link from the front door, the footer or the help page | Open | A shorter description key; a link from the footer or `/help` ("Is a college registered?") |
| A6-06 | A6 | Low | packages/content/src/en/demo-personas.ts:58-61, 89 | Stale since #129: the guide tells judges "Study help, marks, a weekly plan and a portfolio … are still being built", and every university student's home (not only the demo's, coming-next.tsx:5-11) says "Marks and weak spots: coming next … Keep your module marks in one place", while module cards with a mark calculator now ship. The guide's "Things to try" mention no Phase 6 feature (module card, sample outline, colleges, My CV) | Open | Reword `comingNext.items.marks` to what is still to come (weak spots) and the guide's honest line; a "try" for the second-year's module card and sample outline (new keys, for the owner's wording review) |

## Hard rule 8 (every user-visible string from packages/content)

**Holds.** No literal user-visible string in any changed `.tsx` (web or native). The phrase scan
found only class names, union literals, the photographers' names in `lib/course-art.ts` (credits
data, kept with CREDITS.md, not rendered as copy) and the universities' full names as lookup keys
in `lib/demo-logos.ts`. Server-built words come from content too (`app/demo/new-learner/words.ts`
maps `demoPhoneSignup`; `lib/server/module-card-books.ts` imports `freeBooks`). Hard-coded strings
found: none.

## Alt text on the new pictures

**Holds.** The course and subject pictures (#121, #133) are decoration behind words that carry the
meaning: `alt=""` inside an `aria-hidden` wrapper (card-art.tsx:13-30), lazy and low priority. The
front door's journey pictures are the same (split-stage.tsx:112-122, `aria-hidden`, `alt=""`).
University and college logos on the demo take `alt=""` beside the name and the university's name
when alone (university-mark.tsx:31-44; content `universityMark.logoAlt`). Live: the front door's
three `<img>` carry `alt=""`, as designed.

## Copy assessment (pages in scope)

- **Front door: serviceable to sharp.** The first screen says what, for whom and why ("checks your
  marks against each university’s own rules, shows what you qualify for, what you’re close to,
  and your Plan B, then helps you apply on time"). "6 universities" no longer tells the whole
  story now that Plan B carries 50 public TVET colleges; a line for colleges would earn its place.
- **Is this college registered?: sharp.** Opens with the harm ("colleges that aren't registered
  take learners' fees"), says plainly what a yes does and doesn't mean, a not-found is a warning
  with DHET's own links, and while the list is unverified it says so rather than guessing.
- **Demo guide: serviceable, stale in one line** (A6-06).
- **404: serviceable.** One heading and Home; a link to `/help` would help someone lost.
- **Placeholder register:** none in scope. The demo's "SAMPLE"/"(made-up)" strings are deliberate
  labels, not placeholders.

## Holds (checked and sound)

- Demo and staging are noindex on every page (layout.tsx:35-41); `/demo/new-learner` sets its own
  `noindex` (page.tsx:13), which still keeps it out.
- The 404 is a real 404 in the app's own theme, with one `<h1>`.
- Every public page has exactly one `<h1>` live.
- 25 literal internal link targets in apps/web resolve to a route; none broken.
- `/colleges/registered` works with no JavaScript (a GET form, a server component) and keeps
  nothing about the visitor.

## Not measured

- Production's own robots behaviour (no production deployment exists; only the demo was read).
- The Rich Results Test and a social-card debugger: nothing to test (A6-03).
- Lighthouse SEO scores: not run (no browser tooling in this audit; A4's job for performance).

## Remediation roadmap

- **Before launch (under a day together):** A6-01, A6-02, A6-03 (the launch standard's SEO line).
- **Quick wording:** A6-04, A6-05, A6-06 (new content keys for the owner's review).

## What's genuinely good

- The demo can't leak into search: noindex is decided once, in the root layout, from the
  deployment, and holds on every page read live.
- The college check is written for the learner most at risk of being scammed, and is honest about
  what it doesn't know.
- Pictures were added without one meaningless alt text: decoration is hidden, logos are named.
