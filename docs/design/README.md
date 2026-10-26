# UniversityFlow design

The design document asked for by audit **A2-11**. It starts with the web round of the design
refresh (2026-10-19, branch `phase-5/design-refresh`); the mobile app follows it next round.

**Theme (revised the same day, after the owner saw the preview):** the colours come from the
owner's two pictures, not the old paper-and-green identity (planning.md Q16 is superseded for the
web): the poster's charcoal for the front door and sign-in, and the dashboard reference's
near-black with one dusty mauve accent for every signed-in page. One dark theme, the default,
applied through `packages/tokens` so every page moves together (section 3). The type is
**Outfit** (3.3), self-hosted; the body stays at a 17px base for budget phones. Every value lives
in `packages/tokens` (hard rule 8); every string in `packages/content` (`en.home`,
`en.dashboard`, `en.nav`).

**Fit the screen:** from a laptop's width the front door and sign-in are exactly one screen
(`height: 100dvh`), the display sizes following the viewport's height as well as its width.
Measured (Playwright, production build): no vertical or sideways scroll on `/` and `/sign-in`
at 1280x720, 1366x768, 1440x900 and 1920x1080; at 360x800 they scroll down only, never sideways.
The signed-in sidebar never scrolls from 1920x920 down to 1280x616 (the owner's zoomed window):
32px rows for a mouse from 64rem (`targetPointer`), 28px and smaller type on a screen under 800px
tall (`targetDense`), 44px on a phone (`target`); all above WCAG 2.5.8's 24px. Below about 600px
tall it may scroll, with a thin scrollbar.

**One width (owner's review, 2026-10-19 late night):** every signed-in page fills the layout's
column (`max-w-page`, beside the sidebar) and none narrows itself: Funding, My goal, Documents,
My modules, About me, My offers, My results and What do I need sat in a `max-w-prose` strip on
the left while First week and My campus filled the row. Paragraphs keep a readable length on
their own (PageHeader's lead is `max-w-prose`); a button in a column keeps its own width
(`self-start`), never stretched across a card. The chat is the one exception (a centred
conversation, §2b); pages without the sidebar (sign-in, onboarding, Get help, guardian consent)
are centred narrow pages of their own kind. Held by `apps/web/test/page-width.test.ts`.

**One rhythm (owner's review, 2026-10-20):** the gap under a page's title was 24, 48 or 72px
depending on the page (PageHeader's own margin stacked on each page's gap, and an empty status
line taking a gap of its own), and an empty page said so four ways (a bare sentence; a sentence
and a link; a loose sentence above a card; "No documents yet." alone at the foot). Now:

- **`Page`** (`components/ui.tsx`) owns every titled page: the header, then each part one
  `gap-6` (24px) apart, the same under the title as between the parts, as on the home. The header
  has no margin of its own. Measured at 1530, 1280, 1024 and 390px on every signed-in page.
- **`StatusLine`**, a page's live "Saved." line, takes no space while silent (`empty:sr-only`),
  so it never adds a second gap under the title; it stays in the page, so it is still announced.
- **`EmptyState`**, the one way to say "nothing yet", as the home's empty cards do: a card with
  one muted sentence and, when the next step isn't already on the page, one outline button to it
  (My results and What I need → Add my latest school report; Applications → Browse my results). Where
  the next step is right below (My offers' form, My modules' and Documents' upload cards), the
  sentence alone. A "nothing yet" inside a card that has its own heading (My goal, What the
  companion remembers) is a muted line, as on the home.
- **`Card`** is every card, the home's included (A2-23, 2026-10-24): 20px inside (`p-5`), and one
  card-title size, `text-lg` (a headline card's title is a caps label). The home's title and lead
  are `PageHeader`'s, 8px apart as on every page; its headline card is `Card` with `glow`.
- **`StatusLine`** speaks through `useStatus` (`lib/client/status.ts`): the same outcome twice
  ("Saved.", then "Saved." again) is announced twice (A2-51).

Held by `apps/web/test/page-rhythm.test.tsx`, `dashboard.test.tsx` and `status-line.test.tsx`.

**Course dropdowns (owner's review, same night):** every list of courses (My goal, My offers, My
modules, and "What would you like to study?" in onboarding and About me) groups the courses under
the university's **full name** ("University of Johannesburg", not "UJ"), from one function
(`goalOptions`), showing only courses the learner may see (hard rule 3: in production, none until
verified). "What would you like to study?" is a dropdown now, not free text: "I don't know yet"
or a course, saved as the profile's text "<course>, <university>"; an answer typed before stays
selectable, so saving never drops it (`components/study-choice.tsx`).

## 1. The split stage: the front door (`/`) and sign-in (`/sign-in`)

Taken from a poster the owner sent, without its photo (no hosted media, decision Q14).

| Part | What it is | Code |
|---|---|---|
| Sharp half | On the poster's charcoal gradient (`stageTop` to `stageBottom`): app name, an uppercase white headline ("From Grade 10 to graduation", G10-5), a short white rule, the lead in light grey, three big numbers with two-line labels in a row (the front door's bullet list was dropped to fit one screen) | `components/split-stage.tsx` |
| Frosted half | Charcoal glass (`glass.tint`) blurred over three decorative shapes: the poster's blurred light-grey figure (`haze`), a mauve glow (`brand`) and a charcoal shade. Three quiet words at the top ("Results. Apply. Arrive.") | `.uf-stage-ground`, `.uf-glass` in `globals.css` |
| Tiles | "What we do together": four square near-black tiles with a hairline edge, stroke icons and uppercase captions. Each tile is one link, named by its caption and where it leads ("Your results: Get started", A3-27) | `StageTiles`, `components/icons.tsx` |
| Wordmark | "Grade 10" huge across the bottom (G10-5; it was "Grade 11"), "to university" letter-spaced under it. It crosses the split: light ink on the charcoal, the accent pink on the glass, so the crossing shows as a colour change and both halves are readable (decoration, but held to 3:1: `ink` on `stageBottom` 9.27, `accent` on the glass 4.06) | `.uf-wordmark-*` |
| Bar | A dark glass card with a hairline edge across the bottom: "Free for learners", "Your information stays in South Africa", Get started, I already have an account | `StageBar` |

Sign-in uses the same stage. The headline is text (a `p`), because the form's own heading is the
page's `h1`; the form sits on the glass in a dark glass card. Its behaviour is unchanged.

**Phones (from 360px):** one column: sharp on top, frosted below, the wordmark on the glass alone
(only its light copy shows), the bar last. The front door repeats Get started under the lead on a
phone, because the bar is a long scroll away. Nothing scrolls sideways: the stage clips its own
overflow and the wordmark size is `clamp(3.5rem, min(15vw, 19dvh), 11rem)`.

**Numbers are product facts only:** 6 universities, 5 steps from results to registration, free for
learners. Never a catalogue count (drafts are not facts, hard rule 3) and never a number of users.

### The wordmark and assistive tech (decided)

The wordmark is **decoration, hidden from assistive tech** (`aria-hidden`). The visible `h1` (or,
on sign-in, the headline text) says the same thing, so a screen reader hears it once. The crossing
is drawn with two copies of the word in one grid cell, clipped at exactly 50%
(`clip-path: inset(0 50% 0 0)` and `inset(0 0 0 50%)`); the split is a two-column grid with equal
columns, so the clip line is the split. Tested: `test/split-stage.test.tsx`.

### Glass

- `backdrop-filter: blur(var(--uf-glass-blur))` (20px), with the `-webkit-` prefix for Safari.
- Without backdrop-filter (`@supports not`), the tint becomes solid `surfaceSunk` and the card
  solid `surface`: the tokens' `glass.fallback`, which pass on their own.
- Forced colours: the shapes are removed and the frosted panel and cards get a `CanvasText` border.
- The focus ring on the glass is the white ink; inside a glass card it is the light-blue focus
  colour. Both pass 3:1 over every backdrop.

### Motion

CSS only, once, on load: the headline rises (transform only: it is the largest paint, so it never
starts invisible); the rule, lead, numbers, tiles and bar fade and rise, staggered by a quarter and
a half of `--uf-duration-enter` (600ms). No scroll-triggered animation and no JavaScript animation
library. Under `prefers-reduced-motion: reduce`, `animation: none` (and the token durations are 0ms).

## 2. The signed-in home (`/home`)

Where sign-in, onboarding and the `/`, `/sign-in` redirects land (it was the chat). Modelled on a
finance dashboard the owner sent, in our theme. A server component: no JavaScript of its own.

### The stage (code decides: `apps/web/lib/home.ts`, `learnerStage`)

| Stage | When |
|---|---|
| `university` | An accepted offer, or a confirmed registration |
| `matric` | Grade 12, no accepted offer (a held or declined offer is not a place) |
| `grade-11` | Grade 11, or no grade given |
| `grade-10` | Stage 0 (G10-4): Grade 10 or 9, the current grade from `profile()` (G10-1) |

**Stage 0 (G10-4, 2026-10-22).** The journey is Report · Subjects · Goal · Study: Applications
and Funding are two years away, so the applications card gives way to **Your subjects** (what the
confirmed report's subjects keep open, `subjectDoors` in packages/admissions, the planning §9
item 7 warning). Subjects is done once a report is confirmed (the check runs on it); Study goes
to My goal's practice (`/goals#practice`) until the studios (S2) and, with no record, is never
"done". The next step: a report, then a goal, then study. **My subjects** (`/subjects`, in the
sidebar after My results; the app's Subjects screen) lists the confirmed subjects, how many of
the courses the learner may see they close and the subject that would open each group, and courses
open with a higher bar (TUT's Mathematical Literacy route). With no course to check (production
before verification) it says it can't check, never "all open". Before any report, a Grade 10
learner's headline card is already "Courses you're on track for" (G10-5).

**My subjects, round 2 (2026-10-22, the owner's approved proposal, every recommended answer).**
The verdict is never behind a control. In order: a one-sentence lead; the **verdict card** (the
answer is its `h2`; a decorative meter, open against closed, `aria-hidden`, the numbers in the
text; the goal course and where it stands, with What I need; the subjects' chips and "Not right?
Add a newer report"); **By university** (six rows to compare, each a link that sets the filter;
beside the verdict from `lg`); **Courses your subjects close** (it was "What would open them",
which over-promised: a course closed by two requirements stays shut with one subject): grouped by
what they need, each a styled native `details` (chevron, "Needs Mathematics", its count; no
"Show"), courses under university headings, "also needs …" where a course misses more, each a
link to What I need where What I need can show it; the group holding the goal starts open;
**Show courses at** (a native `select` in a GET form with a Show button, no submit-on-change; it
narrows the groups and the higher bar, never the verdict); **Open, with a higher bar** with its
reason in the catalogue's numbers; **Try a different subject** (two native selects and Check,
GET, `#what-if`; "take" lists only subjects a closed course names; the answer printed under it as
"If your school lets you…", the report unchanged, "Talk to your school first" under it: the
catalogue has no subject-combination rules); **How this works** (the longer lead). No JavaScript
of its own. Motion is CSS only: the meter fills once, the chevron turns, the panel grows where
the browser can animate to `auto`; every time a duration token, 0ms under reduced motion
(`test/subjects-motion.test.ts`). The numbers come from `subjectDoors`, `swapChoices` and
`trySwap` (packages/admissions); the words from `en.subjects` through packages/ui's shared
helpers, so the app's screen says the same: there the groups are buttons with their expanded
state, the filter and the what-if are radios behind a button naming the choice, and the what-if
asks `GET /api/me/subjects?drop=&take=` and announces its answer.

### Layout

- **Sidebar** (every signed-in page, from 64rem): the app name (links to `/home`), Sign out, then the
  links grouped by stage (A2-12): Home and Chat; *School* (Grade 10 to matric, G10-5; it was "Grade 11 and matric": My results, My subjects, Applications,
  Funding, My goal, Documents); *University* (My offers, My campus, First week, My modules); and at
  the foot *You* (About me, Get help). Sign out sits at the foot too. Labels and links never look alike: a group name is small, uppercase, letter-spaced, muted text (not focusable) with space above it; a link is body-size ink with a stroke icon and a hover fill. The current page is a mauve pill fading to transparent
  (`glass.pill`). **On a phone** (below 64rem) the header is one row: the app name and a
  **Menu**, a native `details` disclosure (A4-15, 2026-10-24: it opens from first paint, with no
  JavaScript; its summary says expanded or collapsed, its name stays "Menu", the icon turns to a
  cross). The two float to either end of the row, so with wider text spacing at 320px the Menu
  drops under the name rather than push the page sideways (A3-26). It opens the same grouped list under the header, group names shown, Sign out at its
  foot; a disclosure, so it pushes the page down and needs no focus trap. It closes on a second
  tap, on Escape (focus back on the summary) and on a page change; a long list scrolls inside it
  (`max-h: 70dvh`). It replaced the sideways row with edge fades (2026-10-19 evening), which took a
  second header row on every page. One nav either way, so every link exists once.
- **Header:** "Welcome, <name>" (the name the learner gave; on screen only, never logged), a
  subtitle naming the stage, and two icon buttons (Reminders and messages, About me), each named.
- **Pill links** to the stage's sections; an **ask bar** ("Ask your companion anything") that opens
  the chat; a **Next step** strip from a code rule (`nextAction`).
- **Cards** (`components/dashboard.tsx`), each from the same server code as the page it links to:

| Card | Grade 11 / matric | University | With nothing behind it |
|---|---|---|---|
| Headline number (a dark card with a soft mauve glow, `.uf-glow-card`: the number in white, its label small, uppercase and muted, the counts muted, the link pink) | Courses you qualify for now, with close and Plan B counts (Results' `assessAll` on the latest confirmed report); days to the next **verified** paper | Days until registration opens, else closes (the accepted offer's university calendar, via First week) | "Not yet" line and a link; the paper line is left out (draft papers never count) |
| Promo | What do I need? → `what-i-need/<goal>`, or Choose my goal | Know your campus → the campus tour | Always shown |
| List | My shortlist: course, university, standing chip (Qualify now / You're close / Plan B), Not yet verified on drafts | My offers: status and kind chips | "Nothing yet" line |
| Tiles | My applications: per university, status, checklist x/8, closing date (`applicationSummaries`) | Getting ready: accepted offer, first-week steps x/8, modules confirmed (and "to sort out" only when checked against a curriculum) | "Not yet" lines |
| Marks over time (full width) | The average of every subject on each confirmed report, one point per report kind in school-year order | Same | One report: a sentence with its average; none: a sentence |

A shortlisted course or a goal the learner may not see is left out (hard rule 3). No number is
ever shown as 0 for lack of data. Tested: `test/home.test.ts`, `test/home-data.test.ts`,
`test/dashboard.test.tsx`; and in E2E with axe.

### The chart

Inline SVG and positioned HTML, no library (bundle budgets). An area chart like the reference's: a
2px light-pink line (`accent`, 10.52 on the card) over a soft mauve gradient fill, the newest value
in a small card on a dashed marker (a marker, not a gridline). The line keeps
`vector-effect: non-scaling-stroke`; 10px dots with a ring in the card's colour; solid hairline
gridlines at 0/25/50/75/100; the title naming
the series (no legend for one series). The drawing is `aria-hidden`; **Show as a table** (a
`details` element, no JavaScript) is the accessible version: every subject on every report, and the
average. Each dot has a native tooltip. A per-subject chart was rejected: seven or more series is
past what colour can separate; the table carries them.

### Polish after the owner's review (2026-10-19)

- **The preview notice** (never in production) is one line: a warning icon, "Preview: data not yet
  verified · no AI connected", and "More" (a native `details`) for the full sentences.
- **The journey strip** replaces the section pills (they repeated the sidebar): an ordered list of
  the stage's steps, each "Done", "Now" or "To do" in words, the current one a link
  (`journeySteps` in `packages/ui`). Before university: Report, Shortlist, Goal, Applications
  (done when every checklist is), Funding (no record says it is done, so it becomes "Now" last).
  In Grade 10: Report, Subjects, Goal, Study (four columns).
  At university: Offer, First week, Modules. **Consistent by design (owner's review, 2026-10-19
  late night):** every name is one or two words of the same kind, the same in every state (the
  word under it says Done, Now or To do, so no name claims something happened); every step is
  the same box: one row each on a phone, and from a tablet's width an equal column each across
  the whole row (number on top, name and state centred), so the strip never wraps unevenly and
  "Applications" fits beside the sidebar at 1024px. Only the current step has the mauve edge and
  is a link. The app draws the same boxes. The campus tour has no record of being taken, so it
  isn't a step.
- **Next step** is one link, with a visible "Start".
- **Empty cards** each have one action, never the same twice: Add your latest school report (the
  headline card), Choose my goal (the promo), Browse my results (shortlist), See how applications
  work (applications), Add an offer and Confirm my modules (university).
- **Outline buttons** are calm: a neutral `lineStrong` outline and ink text, the mauve only on
  hover, focus and a pressed or current state.
- The sidebar's "You" group follows the others at the normal spacing (no gap above it).

## 2b. The chat (`/chat`)

Restructured like an assistant; the API, the stream, the crisis flow and the live region are
unchanged.

- **One screen, one scrolling list.** On the chat page the signed-in layout is exactly the viewport
  tall (`.uf-app:has(.uf-chat)`); only the conversation scrolls, inside a focusable region named
  "Conversation" (a keyboard can scroll it), and the composer is docked under it, never over it
  (WCAG 2.4.11). The column is 48rem wide (`tokens.maxWidth.chat`, A2-24). The composer holds
  its own draft, so typing never draws the conversation again (A4-16).
- **Empty conversation:** a hero ("Hi Sipho!", the name in the accent), "What shall we work on?",
  the companion's welcome and the "Add my latest school report" link, then the four starters as a 2×2
  grid of cards (an icon, the question, a muted one-line note), one column on a phone. The cards
  lift 2px on hover, not under reduced motion.
- **Messages:** the companion's in plain text beside a small mark; the learner's in a compact
  right-aligned bubble tinted mauve (`glass.pill`: ink on it 8.01); artifacts as cards in the flow.
  "Thinking…" with three pulsing dots (still under reduced motion).
- **Composer:** one rounded field with the send button inside it (an icon button named "Send",
  "Thinking…" while busy), growing with its text up to six lines; Enter sends, Shift+Enter is a new
  line (as before); the disclaimer is one small muted line under it.
- **The preview notice gives way to the chat** (`.uf-app:has(.uf-chat) .uf-preview`, every
  width): in a preview the line under the composer says "Preview: no AI is connected, so replies
  come from a simple script." in place of the disclaimer (`en.chat.sampleLine`), so the chat
  still says it. Draft records in the chat's artifacts keep their own "Not yet verified" badges.
  With the phone's Menu button, a phone at 412px gains the nav row and the notice: the
  conversation starts one header row below the top.
- `/chat` first load: 174.0 KB before, 176.0 KB after (gzipped; the icons and the starter notes).

## 2c. Get help (`/help`)

Public, a tap from every signed-in page: the crisis card with the verified helplines only, chosen
by the same code as the chat's. The card (`components/crisis-card.tsx`) and its call and maps
links (`components/place-links.tsx`) have no `'use client'`, so the page renders them on the
server and loads none of the chat's artifact code: first load **171.5 → 134.9 KB** gzipped
(the same as `/`). The chat still shows the same component as an artifact.

## 2d. About me: the profile card and "Make it yours"

Built from [profile-look-proposal.md](profile-look-proposal.md) (approved 2026-10-22, every
recommended answer; steps 1–8). The first thing on About me (`/me`, the app's About me screen),
above the profile form; the home shows only the avatar (44px, the button still named "About me"). **No one
but the learner sees it.** Stored as ids from fixed lists (theme, avatar, tagline, up to three
words; migration 0028), never free text, never sent to the AI, never logged.

### The card: the owner's poster, as built

The poster (`app/(app)/me/profile-look.tsx`, `.uf-look-*` in `globals.css`) is one grid in
**reading order**: the `h2` (an `aria-hidden` "I'm" and the name, or "Your card" with no name),
the figure with its round grade sticker, the words (a `ul` named "My words"), the tagline with
an arrow. A screen reader hears "Thando. Grade 10. My words: … Small steps, big future."; the
grid places them round the figure.

| Part | What it is |
|---|---|
| Ground | A soft spotlight of the theme (`--look-soft`) fading to `canvas` behind the figure; one hairline edge |
| "Hello" | SVG text on the arc `LOOK_POSTER.helloArc` (packages/ui, shared with the app), `ink`, at most 20rem wide; decoration |
| Figure | The avatar, black and white like the picture's portrait (`surfaceSunk` to `canvas`, `ink` initials or icon; a pattern keeps its two theme colours), a thin accent ring 8px out; 144px on a phone, 256px from 40rem |
| Sticker | The magazine cover's badge: the grade (`onboarding.gradeOption`) in `onAccent` on the accent, tilted; none past matric |
| Words | Dark tags (`canvas`), a thin accent edge and a small accent flick in the corner. On a phone they wrap in a centred row under the figure; from 40rem they float right, left, right at three heights round it, and a long word wraps at 30% of the poster so the card never cuts it off (A2-32) |
| Name | `display.poster` (`clamp(2.75rem, 11vw, 5.5rem)`), "I'm" in `ink`, the name in the accent; from 40rem it rises over the bottom of the figure, as in the picture; long names wrap anywhere |
| Line | One thin `ink` line from the end of "Hello" round the figure to "I'm", ending in an arrowhead (`LOOK_POSTER.line`); from 40rem only (hidden on a phone, so nothing crosses the wrapped words) |
| Tagline | `ink`, at most 14rem, bottom right, an accent arrow |

**The theme** is two custom properties on the card, `--look-accent` and `--look-soft`
(`lookStyle`, from `tokens.profileThemes`); it colours only the card and the home avatar (D1).
Seven themes, each pair in `PROFILE_THEME_PAIRS`: the accent on `surface`, `canvas` and its soft
colour; `ink`, `inkMuted` and `brand` (the picker's quiet buttons and ticked boxes, A2-30) on the
soft colour; `onAccent` on the accent; `focus` and `lineStrong` on the soft colour. Each accent
stays a ΔE of 20 from `focus`, every status and every other theme.

### "Make it yours" (the picker)

A disclosure under the card: the "Make it yours" button (`aria-expanded`, `aria-controls`) shows
the picker, which sits on the card's ground. Every choice previews on the card at once; nothing is
stored until **Save** (one `PATCH /api/me`); **Cancel**, or the button again, puts the saved look
back. Save and Cancel give focus back to the button (A2-28); "Saved." is the card's
`StatusLine`.

- **Theme:** a radio group of seven 44px swatches, each with its name under it (web and app,
  A2-31); selected = a thick `ink` ring and a tick in `onAccent`, never colour alone.
- **Picture:** one radio group of 19 tiles in three named kinds (fieldsets on the web, A2-33):
  My initials, 12 icons, 6 patterns, each 44px with its name for a screen reader; selected = an
  `ink` ring.
- **Tagline:** a native select on the web (12 lines and "No tagline"); radios in the app.
- **My words:** checkboxes in pills, up to three; "2 of 3 chosen" is a live region (announced in
  the app, A2-34). A fourth is `aria-disabled`, never `disabled`, so it keeps focus and its reason
  ("You can choose 3. Untick one to choose another.") is read (A3-12).

### The photo, behind its switch

Only while the server's switch `UF_PROFILE_PHOTO=1` is on (refused in production and on staging
until guardian consent v4; proposal §5.3) does the picker offer **Add a photo** (a JPEG or PNG
of up to 2 MB; a HEIC is refused with a sentence). It is saved at once, apart from the look. The
**crop** is a square window with a round guide: a zoom slider, Zoom in and out, Move left, right,
up and down buttons, the arrow keys and + and − on the focused window, or dragging (so dragging is
never the only way, WCAG 2.5.7). The zoom buttons are `aria-disabled` at their limits, and Save,
Cancel and Remove photo give focus to the photo button (A2-29). The server crops it, makes it black
and white and drops its metadata; on the card it takes the avatar's place and ring, in the theme's
spotlight, `alt=""` (the name is said). The avatar stays the default and the fallback. In the app:
Take a photo and Choose from my phone, the same buttons, no drag.

### The app (react-native-svg)

The app draws the phone layout always (`apps/native/components/profile-look.tsx`), from the same
shared shapes: "Hello" on the arc and the line with `react-native-svg` (`look-drawing.tsx`), the
icon avatars from the web's drawings, patterns and the spotlight with Views. The decoration is
`accessibilityElementsHidden` / `importantForAccessibility="no-hide-descendants"`; the name is a
header; each swatch and tile a radio with its label and checked state. The grade sticker and the
words are drawn above the name but hidden from assistive tech and said once, after the header, by
one summary laid over them ("Grade 10. My words: …", A2-35). After Save and Cancel the screen
reader goes back to "Make it yours" (A2-36). A native module: it needs a new build (§4).

### Motion and reduced motion

| What | Web (CSS, tokens) | App (RN `Animated`) | Reduced motion |
|---|---|---|---|
| Entrance | The figure and the name rise (transform only: the name never starts invisible), `duration.enter`, once | The same, native driver | None |
| Words | Fade and rise, staggered by half of `duration.fast` | Shown at once: the card first shows at rest until the phone answers, so a fade would flash them off (A2-40) | Shown at once |
| Line | Draws itself by growing a dash (`duration.draw`, after half the entrance); at rest a plain solid stroke | `strokeDashoffset`, `duration.draw` | A solid line from the first frame |
| Theme change | Colours cross-fade (`duration.normal`) | Instant | Instant |
| Choosing | The chosen swatch or tile pops once (`duration.fast`) | None | None |
| Save | The sticker wiggles once | The same | Text only |

Web: every one is `animation: none` under `prefers-reduced-motion` and the token durations are
0ms there (`test/profile-look.test.tsx`; E2E: no running animation on the card). App: none runs
while `useReduceMotion()` is true, which is its answer on the first frame. The crop has no motion.
No WebGL, canvas, Lottie or scroll-triggered animation.

Audited by A2 on 2026-10-23 ([S1-A2-profile.md](../audits/results/S1-A2-profile.md)).

## 3. Tokens: the palette, the glass and the type

### 3.1 Colours (`tokens.color`, one dark theme)

Sampled from the poster (`images/6.png`, averaged pixels) and from the dashboard reference's
description. **Adjusted for AA** where marked: legibility wins.

| Token | Hex | From | Lowest tested contrast |
|---|---|---|---|
| `canvas` | `#0E0D10` | Dashboard canvas | ink 17.41, inkMuted 9.52, brand 8.18, accent 11.32 |
| `surface` | `#17161A` | Dashboard cards | ink 16.18, inkMuted 8.85, brand 7.60, accent (chart line) 10.52 |
| `surfaceSunk` | `#211F25` | A tile inside a card | ink 14.65, inkMuted 8.01, brand 6.89 |
| `ink` | `#F4F2F5` | Primary white text | (see the grounds) |
| `inkMuted` | `#B9B4BC` | Poster body grey, **lightened** for AA | 5.07 on `stageBottom` |
| `line` | `#2E2C32` | Hairline (white at about 10% on a card): dividers only, never a card's edge | decorative (1.40 on `canvas`) |
| `cardEdge` | `#726A78` | A card's and a panel's edge (RT-04, §3.4) | 3.74 on `canvas`, 3.47 on `surface`, 3.14 on `surfaceSunk` |
| `lineStrong` | `#78727D` | Outlined controls and pills | 3.50 on `surfaceSunk`, 3.86 on `surface`, 3.17 on the glass card |
| `brand` | `#C99BB8` | The reference's dusty mauve | onBrand on it 7.75 |
| `brandHover` | `#DDB5CE` | Lighter mauve | onBrand on it 10.11 |
| `onBrand` | `#1A1219` | Dark plum on mauve | |
| `accent` | `#E9B8D4` | The reference's light pink (name, chart line) | onAccent on it 10.72 |
| `onAccent` | `#1A1219` | | |
| `focus` | `#9CC2FF` | Light-blue ring, never the accent | 8.99 on `surfaceSunk`, 4.91 on the nav pill |
| `success` / `successSoft` | `#4ADE80` / `#11291B` | The reference's gain green | 8.88; ink on soft 13.90 |
| `warning` / `warningSoft` | `#F5C26B` / `#221D15` (**quietened**: the draft notice read heavy) | | 10.21; ink on soft 15.04 |
| `danger` / `dangerSoft` | `#FF8A80` / `#341719` | | 7.17; onBrand on danger 8.04 |
| `info` / `infoSoft` | `#93B8FF` / `#172238` | | 7.97; ink on soft 14.27 |
| `stageTop` | `#2C2A2D` | Poster charcoal (top sample `#393738`, **darkened**) | ink 12.78, inkMuted 6.99 |
| `stageBottom` | `#433F45` | Poster charcoal lower down (samples `#4A4A4E` to `#655F63`, **darkened**) | ink 9.27, inkMuted 5.07, rule 4.35 |
| `haze` | `#9E9A9E` | The poster's blurred figure (sampled) | decorative, behind glass only |
| `onGlass` | `#FFFFFF` | Poster white type | 6.95 over the glass's lightest backdrop |
| `onGlassMuted` | `#D6D2D8` | Poster light grey | 4.66 over the glass's lightest backdrop |

The four statuses keep distinct hues (green, amber, coral, blue), each on a dark soft ground of
its own hue, always with a label (never colour alone). A test checks they stay apart.

### 3.2 Translucent colours (`tokens.glass`, `GLASS_PAIRS`, tested)

Each is composited over every colour it may sit over (its `backdrops`) and over its solid
`fallback` (no backdrop-filter). Lowest ratio:

| Glass | Value | Backdrops | Pairs (lowest) |
|---|---|---|---|
| `tint` (stage frost) | `rgba(38, 36, 40, 0.6)` | stageTop, stageBottom, brand, haze | onGlass 6.95, onGlassMuted 4.66, accent (non-text) 4.06 |
| `card` (sign-in card, bar) | `rgba(23, 22, 26, 0.88)` | the same, and canvas | ink 13.27, inkMuted 7.25, brand 6.23, focus 8.14, lineStrong 3.17 |
| `haze` (page glow) | `rgba(201, 155, 184, 0.14)` | canvas | ink 14.10, inkMuted 7.71, brand 6.62, accent 9.17 |
| `pill` (current nav item) | `rgba(201, 155, 184, 0.35)` | surface, canvas | ink 8.01, focus 4.91 |

`glass.blur` is 20px. Display sizes: wordmark `clamp(3.5rem, min(15vw, 19dvh), 11rem)`, number
`clamp(2rem, min(5vw, 6.5dvh), 3.25rem)`, headline `clamp(2rem, min(5vw, 7.5dvh), 3.75rem)`.
Tracking `-0.02em` / `0.08em` / `0.32em`; display line height 0.9; entrance 600ms (0ms reduced).

### 3.3 Type: Outfit

- **Outfit** (The Outfit Project Authors, **SIL Open Font License 1.1**, licence committed at
  `apps/web/app/fonts/OFL.txt`), a geometric sans close to both pictures.
- One **variable woff2, Latin subset, 32,292 bytes (31.5 KB)**, weights 100 to 900, from Google
  Fonts' own distribution (fonts.gstatic.com; the licence from github.com/Outfitio/Outfit-Fonts),
  committed at `apps/web/app/fonts/Outfit-latin.woff2`.
- Loaded with `next/font/local`: served from our own origin (no font CDN, CSP `font-src 'self'`),
  preloaded, `font-display: swap`, the system stack as fallback (`tokens.font.family`). It is not
  JavaScript: the root chunks are unchanged (127.8 KB).
- Body text stays at the 17px base. The owner's "huge" was the layout, not the type size; the
  display sizes now follow the viewport's height.

### 3.4 Cards: every card its own unit (RT-04, 2026-10-25)

The owner's run-through: "I cannot clearly see the separation of the cards." A card's edge was
`line`, 1.40:1 on the page; a tile inside a card (the goal's course, a plan map, a practice
subject, the course picker) had no edge at all, on a fill 1.10:1 from its parent's. Now, from
`tokens.card` (web and app alike):

| Level | Fill | Edge | Behind it | Edge contrast (WCAG 1.4.11, 3:1) |
|---|---|---|---|---|
| A card on the page | `surface` | `cardEdge` | `canvas` | 3.74 |
| A card in a card, or a panel | `surfaceSunk` | `cardEdge` | `surface` | 3.47 |
| A card in that | `surface` | `cardEdge` | `surfaceSunk` | 3.14 |

- **Web.** `Card` draws its fill, edge and shadow from `.uf-card` (a utility would beat a nested
  rule), so a `Card` inside a `Card` takes the next level by itself. A tile inside a card is
  `panelLook` (`uf-panel rounded-md bg-sunk`: the sunk fill and the card edge); none is typed by
  hand (`test/card-separation.test.tsx` scans the app). A card on the page has a still shadow
  (`card.shadow`: a lit top edge and a dark fall-off), decoration only; a card's `h2` at its top,
  or its `.uf-card-head`, is set off by a hairline. Lists of cards are 24px apart (`card.gap`,
  `cardListGap`), the page's gap; panels in a card 12px.
- **App.** `theme.card` and `theme.panel` from the same levels; `Card nested`, and every sunk
  tile in a card spreads `theme.panel` (`__tests__/card-separation.test.tsx`). No shadow in the
  app (React Native's Android elevation draws nothing visible on this dark ground).
- **Held by** `CARD_PAIRS` (packages/tokens), generated from `card.levels`, so a new level can't
  skip the 3:1 test; each level's fill differs from what is behind it by at least ΔE 3.

### 3.5 The funding card (RT-05, 2026-10-25)

`components/funding-card.tsx`, for any bursary record of NSFAS's shape (the other bursaries are
being added as records). In order: the head (an optional funder logo slot on the demo's logo chip,
the name, the year, Not yet verified on a draft); **the deadline** in a panel with a brand side
rule, its caption "Deadline", the closing date at `text-2xl`, the days left as an accent badge
while open ("6 days left to apply"; "Opens in 3 days" before; "Closed on …" after, the rule
grey); **who can apply** as fact chips that wrap into columns; **Apply on <the record's site>**
as the one primary button, the official source beside it; the longer rule (N+) behind My
subjects' disclosure. The window's state is `fundingWindow` (`lib/funding-window.ts`), from the
record's dates and today in South Africa, computed on the server.

## 4. The mobile app

**Shared rules.** The home's pure rules (`learnerStage`, `marksOverTime`, `registrationCountdown`,
`nextAction`, `journeySteps`, and now `homeJourney` and `journeyStepName`) and the `HomeData`
shape live in `packages/ui` (`src/home.ts`, React-Native-safe), so the web's page and the app's
home cannot drift apart. The app reads the data from **`GET /api/home`** (the same `homeData`
the web page renders; `requireReady`, so nothing before consent, hard rule 5).

**Home (`app/index.tsx`, `components/home.tsx`, built 2026-10-19 night).** The web's dashboard
in one column: "Welcome, <name>" (the name in the accent: `pageAccent`, a tested pair), the
stage subtitle, the ask bar (opens the chat), **Next step**, the **journey** (each step's
number, name and state in words; only the current step is a link), the headline card (courses
you qualify for, the next verified paper; or days to registration), the promo, the shortlist or
offers, applications or Getting ready, **marks over time as a list** (a decorative bar per report
and its average; each row read out whole, like the web chart's table), then every screen grouped
by stage under the web's group names, and Sign out. It reloads when the learner comes back to it.

**Links.** `HomeData` names web paths; `lib/routes.ts` (`nativeRoute`) maps them to the app's
screens (`/documents` → Upload, `/me` → About me, What do I need). Where the app has no screen
(applications, funding) nothing links: the card says "Open UniversityFlow on the web for the
full details." Never a dead link.

**Chat (`app/chat.tsx`).** As the web's §2b: the hero ("Hi Lerato!", from `/api/me`, "Hi!"
without a name or if that call fails), the welcome, the four starters as cards with their notes
(each a button named by its question, the note as its hint); the companion's messages as plain
text beside a small mauve mark, the learner's in a bubble on `glass.pill` (ink on pill: a
`GLASS_PAIRS` pair); a **crisis reply stays a bordered card with its heading**; the send button
inside the field's rounded box; under it, "Preview: no AI is connected…" in a preview (it was a
notice above the conversation), else the disclaimer.

**One rhythm (2026-10-21).** As on the web: every signed-in screen's title comes with its lead
through `PageHeader` (`components/ui.tsx`: the lead in the muted page colour, 8px under the
title, then the screen's usual gap), and "nothing yet" is said one way, `EmptyState`, the home's
empty card (one muted sentence, at most one outline button): My results and What I need →
Upload my report; My offers, My modules and an empty results group, the sentence alone (the next
step is on the screen). Sign-in, onboarding and the home are their own kind. Held by
`__tests__/screen-rhythm.test.tsx`.

**SVG (the app rebuild, 2026-10-23; D6).** `react-native-svg` **15.15.4** (the SDK 57 pin) draws the
12 icon avatars (the Icons group in "Make it yours", the card and the home's avatar) and the
About me poster's "Hello" arc and the thin line round the figure, from the same shapes as the
web (`packages/ui` `look-drawing.ts`). The line draws itself once (RN `Animated` on
`strokeDashoffset`, `duration.draw`), and under Reduce Motion it is a plain solid line from the
first frame; both are decorative (`importantForAccessibility="no-hide-descendants"`). A native
module: **it needs a new dev and store build; it can't reach phones as an OTA update.** Jest uses
`test-utils/svg.tsx` in its place.

**Type.** `theme.text.caps` (small, uppercase, letter-spaced from `tokens.tracking.wide`) for
captions. Outfit is not in the app yet: it needs `expo-font` (a native module, so a new build).

**Still to do:** Outfit (`expo-font`, a rebuild); React Native has no `clamp()` or
`backdrop-filter`, so the split-stage sign-in (if wanted in the app) sizes its display type from
the window width and uses the glass fallback colours (or `expo-blur`, if the bundle budget
allows); keep any wordmark decorative (`accessibilityElementsHidden`,
`importantForAccessibility="no-hide-descendants"`).

## 4b. My plan maps (`/goals`, `/goals/maps/[id]`, the app's My goal)

Built from [plan-maps-proposal.md](plan-maps-proposal.md) (approved 2026-10-23, every recommended
answer, with the owner's changes noted at its top).

- **Where:** a "My plan maps" card on My goal after "Change my goal" (D10); each map on its own
  page with "Back to My goal". Nothing on the home.
- **One DOM, two layouts.** The map is one nested list in reading order (centre `h2`, each stop
  an `li` with an `h3`, an `ol` for the staircase and the road). While the learner shows the
  Picture, the page places the same list on a canvas card (below); the List is the outline.
  "Show as: Picture | List" (`aria-pressed`), remembered per browser.
- **The canvas (the owner's run-through, 2026-10-25: RT-06 to RT-08, A4-21).** The picture is a
  night-sky board: one light shape in the middle (a starburst, a cloud, a circle with the
  learner's About me words on a ribbon, or the brand's goal card with a flag), sticker cards
  round it (a band in the card's tone across the top with its number and icon, the soft fill
  below, a hard shadow in the tone), and branches in each card's tone that leave the middle's
  edge and plug into the card's edge (a filled taper on the ring, the cloud and the life map;
  arrows up the staircase; the charcoal road with a star marker per milestone).
  `apps/web/app/(app)/goals/maps/[id]/map-layout.ts` is the pure maths: each template's
  arrangement from the cards' **fixed footprints** (a card's height is a sum of fixed slots from
  what it holds, `SLOT`, pinned in globals.css as `--uf-map-slot-*`, so the server's numbers are
  final and nothing jumps on hydration), with no two things nearer than 32px at 1 to 12 stops and
  no branch through another card (tested); the first view is placed before the page is live by a
  small nonce'd script the server sends (`placeScript`), so the map does not shift when it
  enhances. **A learner names their map** when starting it (the template is only its layout,
  "Layout: Staircase") and can rename it; an older or app-made map without a name shows its
  template's name with a prompt. **Cards move** (RT-08): drag (a mouse or pen past 6px; a finger
  held 300ms, a moving finger pans), or the card's Move button and the arrow keys (one dot of the
  24px grid, four with Shift; where it is said in words after each press; Enter puts it down,
  Escape or leaving puts it back), saved per card (`place_x`/`place_y`, migration 0043) and
  restored; a dropped card never lands on another (the nearest free dot, else back with a word);
  Reset layout puts every card back. The middle stays put (the map's anchor). The mini-map is
  docked under the window, never over a card. Ten sparks on a new Achieved (small, removable,
  none under reduced motion, never beside a care card: the owner decides).
- **Status** is a word and an icon: Planned (a circle, `lineStrong`), Achieved (a tick, `success`),
  Not achieved (a turning arrow, `inkMuted`: never danger, D7).
- **Tones:** `mapTone1..6` and their soft fills (tokens), a side rule in the outline, the card's
  fill in the picture; `MAP_TONE_PAIRS` holds every pair to AA and each tone apart from focus and
  the statuses.
- **Editing** is buttons: Edit in place; More moves up, down, in, out (focus stays on the moved
  stop) or deletes after asking in the page. "Not achieved" opens "What got in the way?" and
  "What could I try differently?". Placeholder prompts are visible hint text.
- **The words wait** for consent wording that names plan maps (`UF_MINDMAP_WORDS=1`, the owner's
  preview only): without it a learner chooses a template and ticks, and the page says why.
- **Care:** every save is read by the chat's crisis check; the crisis card appears at once under
  the stop, focus on its title ("Talk to someone now"), no animation (M7).
- **Motion** (CSS only, every time a token, `animation: none` under reduced motion): the centre
  settles, stops rise in order, connectors and the road draw once, a tick draws on Achieved, the
  reflections rise in, a move re-flows (a hand-rolled FLIP whose duration is the token).
- **The app** (D6) shows the outline only, with Views; the Picture view waits for
  `react-native-svg` in the planned new build.

## 5. Open

- One theme only (dark). A light variant is the owner's decision; the pair tests would then run
  per theme.
- The mobile app takes the new colours through the tokens (its status bar is light, its icon and
  splash colours mirror `brand` and `canvas`) and now the home and the chat (§4); not yet Outfit,
  nor the other screens' layouts (they keep the shared cards and colours).
- All new wording is owed the owner's review (`en.home`, `en.dashboard`, `en.nav.groups`,
  `en.nav.menu`, `en.chat.sampleLine`, the journey's action names).
- The journey has no campus-tour step and Funding never shows "Done": each needs a record of its
  own (a migration), the owner's call.
