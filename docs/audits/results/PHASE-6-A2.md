# PHASE-6 — A2 Design fidelity (wave 10: #115–#134)

**Project:** UniversityFlow · **Phase:** 6 (audit wave 10) · **Date:** 2026-10-25
**Commit:** e09ad5b4 (branch `phase-6/audit-a2-a3-a4`) · **Audit source:** tumoOLO_Audits @ 29eafd7 (brief A2)
**Result:** 0 Critical · 0 High · 1 Medium · 3 Low · 0 waived · 4 not measured

Scope: what `c0e1545c..e09ad5b4` changed on screen: the front door's pictures above "GRADE 10",
`/demo` and `/demo/guide` (#133), course, subject and offer pictures (#121, #133), the polish of
every signed-in page (#133), My plan maps on a canvas (#130), the module card and calculator
(#129; **the A2 pass A2-80 was waiting for**), colleges (#131), Open Mmereko (#133).

**Sources of truth.** The suite's A2 brief describes another project's reference (12 sections,
zero radii, orange glow); it doesn't apply here. As the browser brief says, this pass measures
against `packages/tokens` and `docs/design/README.md` (the design document from A2-11): one dark
theme, colours only from tokens, `Page`'s 24 px rhythm with one gap under every title, `Card`
(20 px inside, one title size), outline buttons calm, nothing sideways at 360 px.

## Method

Production build as the judge demo on `:3107` (PHASE-6-A4.md has the environment); Chromium at
360×780 and 1280×800, dark, reduced motion; four made-up learners. Full-page and first-screen
screenshots of 35 pages at both widths (scratchpad `aud-br-shots\`, not committed); measured gaps
between each page's header and its parts; sideways overflow at 360, 320 and 320 with text spacing;
a scan of every line the diff added to `globals.css` and to `apps/web/**/*.tsx` for raw colours,
pixel values, arbitrary Tailwind values and inline styles; text contrast over pictures (A3 §1).

## 1. Fidelity verdict: **faithful, minor drift**

The three biggest gaps:
1. A2-81: "Is this college registered?" invites a short name and then answers a correct short
   name with a red "We didn't find … it may be a private college".
2. A2-83: on a phone the demo's three notices take a third of every first screen.
3. A2-82: at 320 px the subject tiles lose their inner padding.

| Check | Result |
|---|---|
| Colours only from tokens | **Holds**: the diff adds no hex, `rgb()`, `hsl()` or px value to `globals.css`, and no arbitrary colour, pixel value or inline style to any `.tsx` (one arbitrary *breakpoint*, `lg:max-[90rem]:grid-cols-2`, not a design value) |
| One gap under every title (`Page`, 24 px) | **Holds** on every titled page at both widths (measured 24 px from the header to the first part; the home's outer column is `gap-6`, its title row `gap-4` by design) |
| `Card` style | Holds: the module card, college card, Open Mmereko card and plan-map canvas card are `Card` (20 px inside, `text-lg` titles) |
| Nothing sideways at 360 | **Holds** on all 35 pages and in both dialogs (0 px) |
| Outline buttons | Holds: neutral `lineStrong` outline, mauve only on hover/focus/pressed (Picture/List toggle shows `aria-pressed` as the mauve edge) |
| Pictures (#121, #133) | Holds the cards8/cards9 design: the picture behind the card's top under the card-colour scrim, words never on the bare photo (worst text 8.49:1), forced colours drop it |
| Plan maps canvas (#130) | Holds §4b: dotted ground, tools row, mini-map, one DOM in reading order; the canvas card fills the page column |
| Module card and calculator (#129) | Holds: one column of `Card`s at 360, 24 px rhythm, the result in a `bg-sunk` panel, no animation; the one layout defect is A3-32 (text spacing at 320) |
| Reduced motion | Every motion resolves to its end state (0 running animations) |

**A2-80 (module card and calculator, "no A2 pass yet"): this pass covers it.** Recommend closing it,
with A3-32 as the one follow-up.

## 2. Findings

| ID | Severity | Location | Spec reference | Finding | Fix |
|---|---|---|---|---|---|
| A2-81 | Medium | `packages/content/src/en/colleges.ts:67` (`hint: 'Type the name the college uses, like "Sedibeng TVET College" or its short name.'`), `packages/catalogue/src/colleges.ts:398-449` (`normaliseCollegeName`, `registrationCheck`: whole names and printed abbreviations only), `apps/web/app/colleges/registered/college-registered.tsx:111` (`Notice tone="danger"`) | The page's own promise; §3.1 danger is for real danger | The hint says a short name works. It doesn't: **"Sedibeng", "Boland", "Ekurhuleni East", "ekurhuleni east tvet" all get the red "We didn't find … Be careful. Don't pay any fee … It may be a private college"**, with the right college listed under "these are not a match". "Ekurhuleni East College", "False Bay College" and the abbreviation "EEC" are found | A learner checking a real public college is told, in the danger style, that it may be a scam. "Never a false yes" can stay: change the words. Either drop "or its short name" from the hint, or, when the only "similar" name is the query plus "TVET College", answer in the info tone ("Did you mean Sedibeng TVET College? Check the full name") instead of danger. Test: `college-registered.test.tsx` renders `?name=Sedibeng` and expects no danger notice, failing today. Words are the owner's call (new keys) |
| A2-82 | Low | `apps/web/app/(app)/subjects/subjects-view.tsx` (the tile grid, `grid-cols-2`); `globals.css` cards9 (`.uf-subject-tile`) | "Nothing sideways"; the card's 20 px inside | At 320 px (a 1280 screen at 400%) four tiles' content is wider than the tile (`scrollWidth 118–128 > clientWidth 117`); "Mathematics" runs to the tile's edge with its right padding gone | `min-w-0` with `overflow-wrap: anywhere` (or `hyphens: auto`) on the tile's name, or one column below ~22rem |
| A2-83 | Low | `apps/web/components/demo-banner.tsx` | §2 "one screen"; the phone's first screen | On the judge demo the banner stacks three notices (made-up learners; university logos; college logos) and two links: **about 260 px of a 360×780 first screen**, on every page, before the app's own header and preview line | Join the two logo sentences into one, and from the second page on show one line with a "More" `details` (as the preview notice does). Demo only, so Low |
| A2-84 | Low | `apps/web/app/(app)/cv/mmereko-canvas.tsx:91-112` (`.uf-mmereko-canvas-bar`) | Full-screen canvas | At 360×780 the dialog's bar is **283 px tall**, leaving 497 px (64%) for Mmereko's page; at 1280 it is 111 px | On a phone, keep the title and the two buttons in the bar and move the two sentences into a `details` ("About Mmereko"), or below the frame |

## 3. Deliberate deviations register

| Deviation | Reason | Recorded |
|---|---|---|
| Real university and college logos on the demo | Hackathon exception (owner, 2026-10-23/24) | `lib/demo-logos.ts`, docs/deploy/demo.md |
| The neutral library picture on languages and six subjects (several of Naledi's ten tiles share it) | No fitting photo yet; `SUBJECTS_AWAITING_PICTURE` | `lib/subject-art.ts:73-81`, tested |
| Plan-map canvas at every width ("Picture or List … from a 360px phone up") | The owner's canvas card (2026-10-24) | globals.css maps block, design README §4b |
| SEO `noindex` on the demo | Not a site to be found | docs/deploy/demo.md |

## 4. Not measured

| Check | Why |
|---|---|
| Side-by-side against the owner's reference pictures | Not in the repo for these changes; measured against the design document and tokens |
| Safari / Firefox rendering (`backdrop-filter`, container queries on the canvas) | Chromium only |
| The native app's screens for these features | Out of this browser brief |
| 768 px and 1920 px widths | The brief names 360 and 1280; 1024 and 1350 only where A3/A4 needed them |

## 5. Waived

None.

## 6. Remediation roadmap

**Quick wins:** A2-81 (one sentence or one tone, the owner's wording), A2-82 (wrap), A2-84
(collapse the bar's sentences on a phone).
**Medium:** A2-83 (one-line demo banner with "More").

## 7. What's genuinely good

- **Tokens held across the 836 changed lines of `globals.css`**: not one raw colour or pixel value; every picture,
  canvas and calculator style reads `--uf-*` custom properties.
- **The rhythm is uniform**: 24 px under every title on every page measured, at both widths.
- **The pictures stay behind the words**: a scrim in the card's own colour, a solid foot, no word
  on a bare photo, and forced colours drop the picture entirely.
- **The canvas card reads like the rest of the app**: same `Card`, same outline buttons, the same
  light-blue focus ring, a mini-map drawn from the map's own boxes.
- **The module card is calm**: one column of cards, the calculator's answer in a sunk panel, no
  motion.

## Rows for status.md → Open findings

```
| A2-81 | A2 | Medium | packages/content/src/en/colleges.ts:67; packages/catalogue/src/colleges.ts:398-449; college-registered.tsx:111 | "Is this college registered?" invites a short name, then answers "Sedibeng", "Boland", "Ekurhuleni East" in the danger style ("may be a private college") | Open | Drop "or its short name", or an info-tone "Did you mean …" when the only match is the name plus "TVET College"; a page test on ?name=Sedibeng |
| A2-82 | A2 | Low | apps/web/app/(app)/subjects/subjects-view.tsx; globals.css cards9 | At 320px subject tiles lose their inner padding ("Mathematics" to the edge; scrollWidth 128 > 117) | Open | min-w-0 + overflow-wrap on the name, or one column below ~22rem |
| A2-83 | A2 | Low | apps/web/components/demo-banner.tsx | On a phone the demo banner's three notices take ~260px of a 360×780 first screen on every page | Open | One logo sentence; one line with "More" after the first page |
| A2-84 | A2 | Low | apps/web/app/(app)/cv/mmereko-canvas.tsx:91-112 | At 360×780 the Open Mmereko bar is 283px, leaving 497px for Mmereko | Open | Collapse the bar's sentences on a phone |
```

Status change recommended (not new): **A2-80 can close**: this is its A2 pass (module card and
calculator measured at 360 and 1280; A3-32 is the follow-up).

Audit ledger row (for the integrator): `| 6 (wave 10) | **A2** Design fidelity | 0 | 0 | 1 | 3 | A2-80 covered | 2026-10-25 | Tokens held in all new CSS; 24px rhythm on every page |`
