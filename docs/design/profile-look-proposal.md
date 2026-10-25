# About me: a customisable learner profile (design, approved)

> **Status: approved by the owner on 2026-10-22, every recommended answer (D1 to D8); built, steps 1–8** (migration 0028; steps 1–7 on `phase-5/grade-10`, step 8's docs and A2 audit on `phase-5/profile-step-8`, 2026-10-23: [docs/design/README.md §2d](README.md#2d-about-me-the-profile-card-and-make-it-yours), [S1-A2-profile.md](../audits/results/S1-A2-profile.md)). The photo (§5.3, step 9) is built behind the server switch `UF_PROFILE_PHOTO`, off until consent v4. Written by a design agent at the owner's request from two reference pictures (not committed).
>
> **Changed while building (step 1):** a colour-distance test (CIE76 ΔE ≥ 20 from `focus`, every status and every other theme) found **Sunrise** #FFC27A only 7.9 from `warning` and **Coral** #FF9E8A only 10.3 from `danger`: a learner's name would look like a warning or an error. Sunrise is now a deeper orange **#FF9F45** (23.5 from `warning`). Coral can't be coral and stay apart from the danger red, so it is now **Protea**, a protea pink **#FF94C2** with soft **#2E1724** (31.8 from `danger`). Both names are in the owner's D8 wording review.

Date: 2026-10-22. Read-only review of worktree `UniversityFlow-design`. Nothing was edited.

## 0. Summary

A **profile card** at the top of About me (web and app): a curved "Hello" over an avatar, the
learner's name big in their theme colour, up to three chosen **word chips** around the avatar, a
chosen **tagline** underneath. The learner picks a **theme** (7, for everyone), an **avatar** (initials,
an icon or a pattern, from fixed sets), a **tagline** and **badges** (from fixed lists in
`packages/content`). Everything is stored as **ids from fixed lists**: no free text, no photo, no gender.
A photo is a **later, separate step** that needs guardian consent v4 first.

Two plan-drift flags for the owner:
- **The app's About me today only deletes the account** (`apps/native/app/account.tsx`, A7-09:
  "seeing, changing and downloading are on the web"). Putting the profile card in the app reverses
  that decision for this part. Recommended: yes, the card and its pickers only.
- **"Boys and girls"**: designed as one set for everyone (no gender field); see 5.2 for what a split would cost.

## 1. What the two pictures show (UI pattern only)

People and names in the pictures are not described or copied.

**Picture 1 (`photos/design-references/profile-reference-1.jpg`): a "Hello, I'm ..." personal poster.**
- Near-black background; a black-and-white cut-out portrait centred.
- **"Hello" set on an arc** above the head (text on a curved path), in off-white, heavy rounded sans.
- A **thin white line curves around the portrait** from the "Hello", ending in an arrowhead pointing at
  the name: reads as a hand-drawn path, a natural candidate for a "line draws itself" animation.
- **Five role chips** float left and right of the portrait: dark pills, a thin orange outline, white
  two-line text, a small orange corner flick. They read as tags/badges.
- Bottom-left, two lines of huge type: "I'm" in white, the **name in a strong orange**.
- Bottom-right: a small two-line **tagline** with an arrow.
- One accent colour on monochrome: the "theme" is a single accent.

**Picture 2 (`photos/design-references/profile-reference-2.jpg`): a magazine cover.**
- Grey-to-black monochrome portrait filling the frame; the masthead word huge across the top,
  **behind** the head (layered type).
- Left and right columns of **cover lines**: a bold condensed uppercase heading, a small sentence, a
  short accent rule under each. One accent (amber) used for single words and a big number.
- A round **accent sticker** ("Exclusive interview") at the right: a badge.
- Bottom: a two-line headline in huge condensed type, the second line in the accent; a strapline
  of three words separated by full stops; a small "+" section marker; a barcode as decoration.
- Pattern: monochrome photo + one accent + editorial type hierarchy + sticker badges.

**What we take:** one accent per theme on our dark ground; the curved "Hello"; the self-drawing line;
chips placed around the avatar; the big two-tone "I'm / Name"; a tagline line; a round sticker badge
(grade). **What we leave:** the photo-as-hero (minors, consent), the masthead behind the head (needs a
cut-out photo), the barcode, condensed fonts (we keep Outfit, one self-hosted font).

## 2. The design

### 2.1 Where it shows
- **About me** (`/me`, the app's About me screen): the full card, first on the page, and the
  "Make it yours" picker under it. The existing Profile form, messages, memory, export, delete stay below.
- **Home header** (web and app): only the small avatar (40px) in place of the plain About me icon
  button, still named "About me". No tagline or badges on the home: the home is for the next step.
- Nowhere else. **No one but the learner sees it**: there is no sharing or social feature.

### 2.2 The profile card (web, from 64rem)

```
+--------------------------------------------------------------------------+
|  (soft theme band, decorative)                                           |
|              H e l l o                      ( Future engineer )          |
|           .-'         '-.                                                |
|  ( Grade 10 )    .-----------.   ·-----.                                 |
|                 |   ( TM )    |        \      ( Loves maths )            |
|                 |  avatar     |         )                                |
|                  '-----------'         /                                 |
|                                    <--'                                  |
|  I'm                                                    [ Grade 10 ]     |
|  Thando                     (name in theme accent)      round sticker    |
|  "Small steps, big future."  ->   (tagline, muted)                       |
|                                                   [ Make it yours ]      |
+--------------------------------------------------------------------------+
```

### 2.3 The card on a phone (360px) and in the app

```
+--------------------------------+
|          H e l l o             |
|       .-------------.          |
|       |    ( TM )    |  [G10]  |
|       '-------------'          |
|  ( Future engineer )           |
|  ( Loves maths ) ( Night owl ) |   chips wrap in a row under the avatar
|  I'm                           |
|  Thando                        |
|  Small steps, big future. ->   |
|  [ Make it yours ]             |
+--------------------------------+
```
On a phone the chips leave their orbit and wrap in a row (no absolute positioning: nothing scrolls
sideways). The decorative curve is hidden below 40rem. The app draws the phone layout always.

**Accessibility of the card:** one `h2` "Thando" (or "About me" when no name); the "Hello" arc,
the line and the band are `aria-hidden` / `importantForAccessibility="no"`. The chips are a
`ul` labelled "My words"; the tagline is a `p`. Read out: "Thando. Grade 10. My words: Future
engineer, Loves maths. Small steps, big future." Avatar `alt=""` (the name is already said).

### 2.4 "Make it yours" (the picker)

A disclosure under the card (web: a `details`-style button with `aria-expanded`; app: a section
that expands). Four groups, each a **radio group** (single choice) or **checkbox group** (badges):

```
Make it yours
  Theme     (o) Mauve  ( ) Ocean  ( ) Fynbos  ( ) Sunrise  ( ) Protea  ( ) Jacaranda  ( ) Mono
            [swatch circles 44px, each with its name under it; selected = ink ring + tick]
  Avatar    Initials | Icons | Patterns            (segmented control)
            [ TM ]  [rocket] [book] [protea] [compass] ...   (grid of 44px tiles)
  Tagline   [ Choose a line ...                v ]   (select, 12 options + "None")
  My words  [x] Future engineer [ ] Future doctor [x] Loves maths ... (pick up to 3)
            "2 of 3 chosen"
  [ Save ]   Saved.            (StatusLine, announced)
```
- The card above **previews live** as the learner picks; nothing is stored until **Save**
  (one PATCH). Cancel restores the saved look.
- Selection is never colour alone: a tick, an ink ring and `aria-checked`. Every target 44px.
- Theme names are words, not swatches alone. The 4th badge checkbox is disabled with a reason
  ("You can choose 3. Untick one to choose another.").

### 2.5 The avatar (v1: no photo)

Three kinds, all from fixed sets, all drawn from tokens:
- **Initials** (default): the first letter(s) of the display name in `onBrand`-style dark ink on the
  theme accent; with no name, a neutral icon.
- **Icons** (12): rocket, book, compass, telescope, beaker, paintbrush, headphones, ball, protea,
  baobab, mountain, star. Objects and South African plants, nothing gendered, no faces, no skin tones.
  Web: inline SVG in `components/icons.tsx` style. App: **`react-native-svg` is not a dependency**
  (a native module, needs a rebuild); so v1 in the app uses initials + patterns drawn with Views, and
  the icon avatars come with the Outfit/`expo-font` rebuild, or the icons ship as small PNGs (assets,
  no native module). Owner decision D6.
- **Patterns** (6): dots, stripes, waves, grid, rays, rings: two theme colours, drawn with CSS
  gradients (web) and Views (app).
- Ring: 2px theme accent around the avatar (non-text pair, >= 3:1 on `surface`).

### 2.6 Animations (each with its reduced-motion behaviour)

Web: **CSS only** (keyframes + transitions on `transform`/`opacity`, the existing
`--uf-duration-*` tokens, which already drop to 0ms under `prefers-reduced-motion`). No animation
library: the card is rendered on the server and is fully visible without JavaScript (first paint
never waits). App: **the RN `Animated` API** (built in, `useNativeDriver: true`), gated by the
existing `useReduceMotion()` in `apps/native/lib/motion.ts`. **Reanimated is not a dependency**
(checked `apps/native/package.json`); not needed.

| # | Animation | Normal | Reduced motion |
|---|---|---|---|
| A1 | Card entrance | Avatar scales 0.96 -> 1, name rises 8px, `duration.enter` (600ms), once on load; the name never starts invisible (transform only, it is the largest paint) | Static, no animation |
| A2 | "Hello" arc + curved line | SVG text on a path (`textPath`); the line **draws itself** with `stroke-dashoffset` (CSS), 800ms after A1 starts, once | Line shown fully drawn; no motion |
| A3 | Chips | Fade + 6px rise, staggered by 60ms each, after A1 | Shown at once |
| A4 | Idle float of the chips | **Off by default.** If kept: 2px drift, 6s loop, only while the card is on screen (IntersectionObserver), pauses on hover/focus, and a Pause button (WCAG 2.2.2) | None |
| A5 | Theme change (preview) | Colours cross-fade 200ms (`duration.normal`) via CSS custom properties on the card | Instant swap |
| A6 | Selecting a swatch / avatar / chip | Scale 1 -> 1.06 -> 1 in 120ms (`duration.fast`), tick fades in | Tick appears, no scale |
| A7 | Save success | The sticker badge does one 8-degree wiggle; "Saved." announced | Text only |

New token proposed: `duration.draw: '800ms'` for A2 (it then drops to 0ms with the others). App:
`Animated.timing` with the same durations read from `tokens.duration` (parsed ms), `0` when
`useReduceMotion()` is true (its safe default is `true` on the first frame, so no flash of motion).
No WebGL, canvas, Lottie runtime or scroll-triggered animation.

## 3. Themes

**Scope:** a theme colours **only the profile card** (band, accent, chips, ring, sticker) and the
home avatar, not the whole app. Re-theming every page would put every `TEXT_PAIRS` row under 7x
testing and fight "one dark theme" (docs/design §5). The page canvas, surface, ink, focus and the
status colours stay. All themes sit on the existing `surface` (#17161A).

Each theme = 2 new colour tokens, `profile<Name>` (accent) and `profile<Name>Soft` (the band's dark
ground), plus the existing `onAccent` (#1A1219) for text on the accent and `ink` for text on the band.
Mauve reuses the existing `accent`. Grouped in `tokens.profileThemes` (ids -> token names) so the
web and app read one map. Ratios below were computed with the package's own `contrastRatio` formula.

| id | Name (content) | Accent token | Soft token | accent on surface | ink on soft | onAccent on accent | focus on soft |
|---|---|---|---|---|---|---|---|
| `mauve` (default) | Mauve | `accent` #E9B8D4 (existing) | `profileMauveSoft` #2A1E27 | 10.52 | 14.36 | 10.72 | 8.81 |
| `ocean` | Ocean | `profileOcean` #5FD3D9 | `profileOceanSoft` #112A2C | 10.12 | 13.56 | 10.32 | 8.32 |
| `fynbos` | Fynbos | `profileFynbos` #7FDCB0 | `profileFynbosSoft` #11291F | 10.95 | 13.86 | 11.15 | 8.51 |
| `sunrise` | Sunrise | `profileSunrise` #FF9F45 (was #FFC27A) | `profileSunriseSoft` #2A1F12 | 8.83 | 14.48 | 9.00 | 8.88 |
| `protea` (was `coral`) | Protea | `profileProtea` #FF94C2 (was Coral #FF9E8A) | `profileProteaSoft` #2E1724 | 8.80 | tested | 8.97 | tested |
| `jacaranda` | Jacaranda | `profileJacaranda` #B9A6FF | `profileJacarandaSoft` #211C38 | 8.54 | 14.65 | 8.70 | 8.99 |
| `mono` | Mono (black and white, like the pictures) | `ink` #F4F2F5 (existing) | `profileMonoSoft` #26252A | 16.18 | 13.67 | 16.48 | 8.38 |

Why new tokens and not the status colours: `success`/`warning`/`danger`/`info` mean something; a
learner's "green theme" must never read as "you passed". Ocean was moved off light blue (#8EC5FF
measured 1.00 against `focus`): focus must never be mistaken for a theme colour.

**Pairs to add, per theme** (a new `PROFILE_THEME_PAIRS` list, generated from `tokens.profileThemes`
so a new theme cannot skip a test):
- text: accent on `surface` (the name, large text, but held to 4.5), accent on `canvas` (home avatar
  initials area), accent on soft, `ink` on soft, `inkMuted` on soft (tagline), `onAccent` on accent
  (initials, sticker text);
- non-text (3:1): accent on `surface` (avatar ring, chip outline), `focus` on soft and on `surface`,
  `lineStrong` on soft (unselected swatch ring).
- Plus a test that every accent is at least a set distance from `focus` and from each status colour
  (like the existing "statuses stay apart" test), and that `toCss()` emits each new token.

## 4. Data and API

**Migration `0028_profile_look.ts`** (0027 may be taken by another session; take the next free
number when building). Append-only:

```sql
alter table profiles
  add column theme text not null default 'mauve',
  add column avatar text not null default 'initials',
  add column tagline_id text,
  add column badge_ids text[] not null default '{}';
alter table profiles add constraint profiles_badge_ids_max check (cardinality(badge_ids) <= 3);
```
- Values are **ids** (`ocean`, `icon:rocket`, `pattern:waves`, `tagline:small-steps`,
  `badge:future-engineer`). The database checks shape and the 3-badge cap; the app checks
  membership (lists will grow, so no DB enum: an unknown id read back falls back to the default).
- `schema.ts` `profiles` gains the four fields; `student.profile()` / `updateProfile()` carry them.

**`PATCH /api/me`**: the zod `Profile` gains
`theme: z.enum(THEME_IDS)`, `avatar: z.enum(AVATAR_IDS)`, `taglineId: z.enum(TAGLINE_IDS).nullable()`,
`badgeIds: z.array(z.enum(BADGE_IDS)).max(3)` (deduplicated), all optional. The id lists come from
`packages/ui` (`profileLook.ts`, RN-safe), the words from `packages/content` (`en.profileLook`).
`requireReady` already blocks it before consent (hard rule 5). `GET /api/me` returns them, which the
app uses. Export (`/api/me/export`) includes them; delete removes them with the row (cascade).

**Not stored:** gender; a photo; any free text; the label text (only ids, so wording can change
without data migrations); preview state. **Not sent:** the look is never put in an AI prompt, a log
line, a job payload or analytics (hard rule 4; they are harmless ids, but there is no reason).

## 5. Privacy and safety

### 5.1 Fixed words, not free text (v1)
- Tagline (about 12) and badges (about 30) are fixed lists in `packages/content`: study goals
  ("Future engineer", "Future teacher", "Future nurse", "Still deciding"), habits ("Early bird",
  "Night owl", "Loves maths", "Bookworm"), values ("First in my family to go", "Proud of my school"),
  stage (the grade badge comes from the profile's grade, not chosen). All written for any learner.
- Why fixed first: free text from minors needs moderation (insults, phone numbers, addresses,
  self-harm cues that would oblige a crisis response), would be new personal information in a
  field we must keep out of logs and fixtures, and must be translated; ids need none of that and
  translate with the content. Free text later = a `tagline_text` column, a length cap, a
  PII/abuse filter, the crisis check, consent wording and a store-answer review.

### 5.2 No gender
Not asked, not stored, not inferred. Every theme, avatar and word is offered to everyone.
**Alternative (owner decides):** a gender-specific version would need a new `profiles.gender` field
(special personal information is not required, but it is still personal information about a minor),
guardian consent wording naming it (a version bump, legal review), a privacy-policy and store-answer
update (Apple "Other user content"/Play "Personal info: Other"), a "prefer not to say" and non-binary
option, export/deletion, and a rule that it never reaches the AI or analytics. It adds risk and no
function: a learner can already pick any look. Recommended: don't.

### 5.3 A profile photo (later, behind its own gate)
Before a photo ships, all of this must be true:
1. **Guardian consent v4** (`consent.ts`, bump from `v3-2026-10`) names "a profile photo the learner
   chooses, shown only to them"; adult consent bumped likewise. The database refuses a photo under an
   older consent (as v3 does for offer letters, migration 0021). **Legal review** (A11-10).
2. **Store answers**: Photos is already declared for documents; add the purpose "profile photo",
   and state it is **not shared** (unlike documents, which go to the AI provider).
3. **Storage**: the existing files service, S3 af-south-1, private, served only to the owner through
   an authorised route; a `documents`-like row of kind `profile-photo` (or `profiles.photo_key`).
4. **Never sent to the AI provider**, never in a prompt, log, job payload, analytics, snapshot or fixture.
5. **Shown to no one but the learner** (no sharing exists); not in reminders, not on the guardian page.
6. **Retention**: until replaced or removed (one tap "Remove photo"), and deleted with the account
   (add its key to `deleteAccount()`'s returned keys). Replacing deletes the old object.
7. **Export**: included in `/api/me/export`.
8. **EXIF and location stripped** server-side on upload (re-encode to WebP/JPEG); a client crop to a
   square before upload; **max 2 MB in, 512x512 out**; JPEG/PNG/HEIC only.
9. **Moderation stance**: private to the learner, so no human review; an automated check is not
   proposed (it would mean sending the photo to a third party). Terms say no one else's photo.
10. The non-photo avatar stays the default and the fallback.

**Customising a photo** (the owner's "customise it nicely"), when it comes: crop and zoom (pinch /
slider, keyboard-operable), then **filters from the theme**: Mono (greyscale, like both pictures),
Duotone in the theme accent, and a frame (ring, sticker edge). Done as CSS `filter`/blend on web and
an overlay tint on the app, on the stored image: no AI, no background removal (that would need a
third party or a large on-device model).

**Recommendation:** ship the non-photo profile first; the photo only after consent v4 is approved.

## 6. Build plan

Branch `phase-5/profile-look` (or the current phase's prefix). Each step: the tests named fail first.

1. **Tokens.** Add the 13 colour tokens, `tokens.profileThemes`, `duration.draw`, `PROFILE_THEME_PAIRS`;
   regenerate `tokens.css`. Tests: every pair passes AA; accents keep a distance from `focus` and statuses;
   `toCss` has each token. (Fail first: the pair test with no tokens.)
2. **Lists and words.** `packages/ui/src/profile-look.ts` (ids, defaults, `resolveLook(row)` falling
   back on unknown ids, `initials(name)`); `packages/content/src/en/profile-look.ts` (names, tagline
   and badge words, picker labels, announcements). Tests: every id has words and vice versa; no
   duplicate; `resolveLook` fallback; `initials` with no name / one name / non-Latin letters; the
   RN-safety guard (`pnpm check`) passes.
3. **Database.** Migration 0028 (or next free); schema; `profile()`/`updateProfile()`. Tests:
   defaults on an old row; >3 badges refused by the DB; export includes the fields; delete removes them;
   nothing before consent (data-layer test, rule 5); the real-Postgres suite.
4. **API.** zod fields on `PATCH /api/me`. Tests: unknown theme/badge -> 400; 4 badges -> 400;
   duplicates collapsed; free text in `taglineId` -> 400; nothing in logs (the existing log-capture test).
5. **Web card + picker.** `ProfileCard` (server), `MakeItYours` (client, receives copy as props),
   CSS keyframes in `globals.css` under `prefers-reduced-motion`. Tests: card renders without JS;
   reduced motion -> `animation: none`; selection has `aria-checked` and a tick; 4th badge disabled with
   reason; live preview then Save sends one PATCH; page-rhythm and page-width tests still pass;
   Playwright + axe at 360px and 1280px on a production build, no sideways scroll; Lighthouse >= 90.
6. **Home avatar** (web and app). Tests: still named "About me"; renders initials with no name.
7. **App.** Profile card + picker on the About me screen above the delete card (`Animated`,
   `useReduceMotion`), `GET`/`PATCH /api/me`. Tests (RNTL v14, `await` render and fireEvent): reduce
   motion -> no `Animated.timing` with a duration; accessibility labels; Save -> PATCH; screen-rhythm test.
8. **Docs and status.** `docs/design/README.md` §2d, `privacy-and-data-safety.md` (`profiles` row:
   "look: theme, avatar, tagline and badge ids"), status.md. Audit A2 (design/a11y) on the card.
9. **Later: photo** (5.3), only after consent v4 and legal sign-off.

**Owner decisions (recommended answer in bold; the owner chose every one on 2026-10-22):**
- D1 Themes colour the profile card only, or the whole app? **Card only.**
- D2 Gender-specific themes/words? **No; one set for everyone.**
- D3 Words: fixed lists or free text? **Fixed lists in v1.**
- D4 Photo in v1? **No; non-photo avatar first, photo after consent v4.**
- D5 Show the card in the app (reverses A7-09's "changing is on the web")? **Yes, the card and picker only.**
- D6 App icon avatars: wait for the `expo-font` rebuild and add `react-native-svg`, or ship PNGs? **Ship initials + patterns now, icons with the rebuild.**
- D7 Idle chip float (A4)? **Off.** Only the one-time entrance.
- D8 The theme names, taglines and badge words: owed the owner's review (and Zulu/Sotho etc. later).

**Waits for legal:** consent v4 (guardian) and the matching adult-consent bump, privacy policy, store
answers, for the photo only. The v1 look (ids from fixed lists) adds no new category of personal
information; still mention "how you chose to style your profile" in the privacy policy's profile row.

## 7. Inspiration (pages actually opened on 2026-10-22)

1. **Motion: Path drawing** — https://motion.dev/examples/vue-path-drawing. SVG shapes drawn by
   animating `pathLength` 0 -> 1, staggered. Adapt: the curved line from "Hello" to the name (A2),
   done in **plain CSS** with `stroke-dasharray`/`stroke-dashoffset` (no Motion dependency), stroke in
   the theme accent, drawn once; reduced motion shows it fully drawn.
2. **Motion: Tab select** — https://motion.dev/examples/react-tab-select. A highlight slides between
   tabs, with `role="tab"`, `aria-selected` and keyboard use. Adapt: the Initials | Icons | Patterns
   segmented control; slide the pill with a CSS `transform` transition (`duration.normal`); instant
   under reduced motion. (The animated steps on that page are paywalled; the pattern is what we take.)
3. **Motion: Split text** — https://motion.dev/examples/js-split-text. Words of a heading cascade in,
   hidden until fonts load. Adapt: "I'm" then the name rise in two pieces (whole words, not letters, so
   screen readers read one word); **never hide the name before paint** (transform only, the
   launch standard), unlike the example's `visibility: hidden`.
4. **Motion: Grid stagger** — https://motion.dev/examples/js-stagger-grid (listed on the examples
   page; I did not open the page itself). Adapt: the chips' 60ms stagger (A3) and the avatar grid's
   entrance in the picker, as CSS `animation-delay` from a `--i` custom property.
5. **FreeFrontend: JavaScript Staggered Animation** — https://freefrontend.com/javascript-staggered-animation/
   (includes "Rating Stars" and "Split Staggered Reveal Cards"). Adapt the rating-stars idea for the
   badge picker's tick pop (A6) in CSS; ignore the 3D tilt effects (motion sickness, cost).
6. **LottieFiles: Underline Wave** — https://lottiefiles.com/free-animation/underline-wave-fnT7WEPQlv
   (1.1 KB dotLottie, Lottie Simple License). Adapt: a wavy underline under the tagline. Recommended
   **redrawn as a CSS/SVG stroke** rather than adding a Lottie player (bundle, and the CSP).

Opened but not used: the **GSAP showcase** (https://gsap.com/showcase/) lists portfolio sites
(e.g. unseen.co, raviklaassens.com) without describing their techniques; its menu names DrawSVG,
MotionPath and SplitText, which do what 1-3 do, but GSAP would be a new dependency for effects CSS
covers. The LottieFiles JavaScript page had no confetti/badge/avatar animations; FreeFrontend's main
page was truncated past 100k characters, so only the staggered hub above was checked.
