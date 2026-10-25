# UniversityFlow pitch deck: FNB Hackathon 2026

The deck for the FNB hackathon judges (24 October 2026, updated 25 October), by Tumo Mogame (Tumoolo).

| File | What it is |
|---|---|
| `UniversityFlow_FNB_Hackathon_2026.pptx` | The deck, 29 slides, 16:9 |
| `UniversityFlow_FNB_Hackathon_2026.pdf` | The same deck as a PDF, fonts embedded. **Present from this if Outfit isn't installed** |
| `charts/` | The charts, drawn by `scripts/charts.py` from the numbers below (transparent PNGs) |
| `images/` | Photos, the owner's journey pictures and screenshots of the live demo. Photos: JPEG, long side at most 1920 px, each under 400 KB. Screenshots: full-resolution PNG (laptop 2880x1800, phone 1170x2532), never resized |
| `fonts/` | Outfit Regular and Bold as static TTFs, made from the web app's own font (SIL Open Font License, `fonts/OFL.txt`) |
| `scripts/` | The scripts that make all of the above |

The layout, rhythm and slide types follow the owner's Y'elloLoop deck (MTN hackathon 2026),
re-skinned in UniversityFlow's brand: the dark theme, the dusty mauve accent and Outfit, with the
values from `packages/tokens` (canvas `#0E0D10`, surface `#17161A`, ink `#F4F2F5`, brand
`#C99BB8`, accent `#E9B8D4`). Y'elloLoop's road line became the journey path: a dashed line from
Grade 10 to graduation. Nothing of MTN's (logo, name, numbers, pictures) is left, and the team is
Tumo Mogame only.

## Slides

Updated 25 October 2026 for the judging criteria (product, creativity, usability, sustainability,
impact, presentation, intelligence) and the challenge's five focus areas. Kicker numbers are
assigned in order by `build_deck.js` (a kicker written `##  ·  ...`).

1. **Cover**: UniversityFlow, "From Grade 10 to graduation", the owner's journey pictures.
2. **The journey today**: five stops where learners fall out.
3. **Matric**: under half earn a bachelor pass (chart, 2019 to 2025).
4. **Mathematics**: Maths vs Maths Literacy, and how few reach 50% (chart, 2025).
5. **University**: of 100 who start a three-year degree, who finishes and when.
6. **Money and work**: NSFAS students, the NSFAS income limit, youth unemployment.
7. **Introducing** UniversityFlow: code decides, the AI explains, a person is always there.
8. **One learner's story**: Naledi (the demo's Grade 11 learner) from her report to every module.
9. **How it works**: five stops, each with an honest status chip.
10. **The challenge**: the five focus areas, what answers each and the slide that shows it.
11. **School, Grades 10 to 12** (screens: Naledi, Thabo).
12. **Apply and fund** (screens: Amahle).
13. **Money, planned**: cost planning as built (NSFAS, application fees, money safety) and the
    cost-of-study planner as next, only from checked fees.
14. **Matric, through the exams**: the message rhythm and a real template.
15. **Care**. 16. **Crisis**.
17. **Arrive** (screen: Lerato).
18. **University years**: module cards and the mark calculator, free books, plan maps and My CV
    built; the study coach, a plan that fits your life and the portfolio next.
19. **It thinks ahead** (intelligence): the forecasts in packages/admissions, memory, the exam
    rhythm, the crisis check; the Phase 7 study coach next.
20. **For every learner** (connectivity and accessible learning).
21. **Under the hood**: the technical architecture.
22. **Live demo**: the link, no password, both ways in, what is and isn't real.
23. **Built this weekend**: 56 pull requests merged from 23 to 25 October (#81 to #138, not
    counting automated dependency updates and one empty merge).
24. **Trust by design**.
25. **Who pays**: R0 for learners; sponsor a learner R420 a year, schools R6 000 a year,
    universities R250 000 a year from 2028, employers R2 500 a month from 2029 (proposals).
26. **What it costs**: about R10.50 per active learner a month, about R63 000 fixed a month,
    break-even at about 2 600 sponsored learners (estimates, below).
27. **Roadmap**. 28. **The destination** (the ask). 29. **Sources**.

`UniversityFlow_Judges_Quick_Start.pdf` is the one-page guide for judges, printed from
`quick-start/quick-start.html` by `scripts/quick_start.js <public code link>`.

### The cost estimates (slide 26)

At R18 to the US dollar, 25 October 2026. Per active learner a month: 30 chat replies on Claude
Sonnet 5.5 ($2 / $10 per million tokens, cache reads $0.20), about 8 000 cached and 2 000 new input
tokens and 800 output tokens a reply, about R0.25 each (R7.50); one report a term read on Claude
Opus 5.5 ($4 / $20), about R1 each (R0.35); 4 SMS at about R0.30 (R1.20); 10 WhatsApp utility
messages at R0.12 (planning.md §7.4, R1.20); hosting R0.25. Fixed a month: hosting R2 000
(docs/deploy/costs.md, about R700 to start); WhatsApp provider R1 500 (§7.4: R750 to R3 000),
monitoring, jobs and email R1 500, voice R1 800 (a guess); legal and POPIA R5 000 and paid fact
checkers R6 000 (guesses); app stores R150; a founder and a part-time developer R45 000. Year 1 at
5 000 active learners: about R115 500 a month, R1.39 million a year. The prices on slide 25 are
the owner's proposal; no payer has signed. Everything here is replaced by measured figures once the
real AI key runs (every reply records its provider, A10-49).

## Every number, with its source

Researched on 24 October 2026. Official sources first; where a source could not be reached, the
table says so. Nothing is rounded beyond the source except where a slide says "squares rounded".

### Matric (NSC), full-time candidates

| Year | Wrote | Bachelor passes | Bachelor % |
|---|---|---|---|
| 2019 | 504 303 | 186 058 | 36.9 |
| 2020 | 578 468 | 210 820 | 36.4 |
| 2021 | 704 021 | 256 031 | 36.4 |
| 2022 | 725 146 | 278 814 | 38.4 |
| 2023 | 691 160 | 282 894 | 40.9 |
| 2024 | 705 291 | 337 158 | 47.8 |
| 2025 | 746 110 | 345 857 | 46.4 |

- DBE, *2025 NSC Examination Report* (Table 1: wrote, 2025; Table 2: bachelor passes 2025; Figure 3:
  bachelor counts 2019 to 2021):
  <https://www.education.gov.za/LinkClick.aspx?fileticket=QYzQZg_JK_U%3d&tabid=1442&portalid=0&mid=8130>
- DBE, *2024 NSC Examination Report* (Table 1: 2024; Table 6.1.4: 2022 and 2023; Figure 2: bachelor %
  2019 to 2021): <https://www.education.gov.za/Portals/0/Documents/Reports/2024/2024NSC%20Examination%20Report.pdf>
- DBE, *NSC Examination Report 2021* (Table 6.2.1: wrote 2019 to 2021):
  <https://www.education.gov.za/Portals/0/Documents/Reports/2021NSCReports/DBE%20Matric%20Exam%20Results%20Report%202021.pdf>
- Small differences inside the reports: the 2024 report gives 615 429 passes in Table 1 and 615 271
  in Table 6.1.4; the 2025 report 656 415 in Table 1 and 656 221 in Table 2. Pass counts are not
  on the slides; where a table differs, Table 1 was used.

### Mathematics, NSC 2025 (slide 4)

| | Number |
|---|---|
| Wrote the NSC (full-time) | 746 110 |
| Wrote Mathematics | 254 415 |
| Mathematics 30% or more | 162 947 (64.0%) |
| Mathematics 50% or more | 63 813 (25.1%) |
| Mathematics 60% or more | 34 243 |
| Wrote Mathematical Literacy | 477 160 |

Source: DBE, *2025 NSC Examination Report*, Tables 1, 2.1, 3 and 6.3.8 (link above). The Minister's
2025 statement says "only 34% of candidates wrote Mathematics" (SAnews,
<https://www.sanews.gov.za/node/79055>); we could not reproduce that figure from the tables, so the
deck does not use it.

### University completion (slide 5)

DHET, *2000 to 2019 First Time Entering Undergraduate Cohort Studies for Public HEIs*, 22 February
2022, Table 28 (national, three-year undergraduate degrees, **contact and distance together,
including UNISA**; cumulative %):
<https://www.dhet.gov.za/HEMIS/2000%20TO%202019%20FIRST%20TIME%20ENTERING%20UNDERGRADUATE%20COHORT%20STUDIES%20FOR%20PUBLIC%20HEIs%20(Final).docx.pdf>

| Intake | Dropped out after year 1 | Dropped out by year 6 | Graduated in 3 years | Graduated by year 6 |
|---|---|---|---|---|
| 2011 | 19.7 | 30.6 | 20.9 | 54.6 |
| 2013 | 17.5 | 22.3 | 26.8 | 63.9 |
| 2014 | 16.5 | 20.3 | 28.3 | 66.0 |
| 2015 | 13.9 | 20.2 | 28.6 | 67.0 |

- "38.4% more by year 6" is 67.0 minus 28.6; "12.8% neither" is 100 minus 67.0 minus 20.2: our
  arithmetic on the table. The 100-square picture rounds these to 29, 38, 20 and 13 squares.
- This is the newest DHET cohort study we found. We found no contact-only (UNISA excluded) table for
  three-year degrees in it.

### NSFAS (slides 6 and 18)

- **Funded university students:** 509 978 (2023), 561 130 (2024), 593 543 (2025). **Paid out to
  university students in 2025:** R47.86 billion (the 2025 budget was R39.93 billion). Source: the
  Minister of Higher Education's written reply to Parliament, question NW874 (2026), on PMG:
  <https://pmg.org.za/committee-question/37471/>. The PMG table is laid out badly; we read its
  columns as budget, paid out, students. Other figures exist (news reports of 917 092 funded in
  2024 across universities and TVET colleges; a Minister's speech with about 811 011 for 2025): we
  used the Parliamentary reply as the more authoritative.
- **5 935** is our arithmetic: 1% of 593 543.
- **Income limit:** R350 000 a year in combined household income; R600 000 for students with a
  disability. NSFAS's own site could not be loaded during research; the figures are as published
  by universities, e.g. Rhodes University (<https://www.ru.ac.za/registrar/nsfas>), and match the
  repository's draft record (`packages/catalogue/src/data/support.ts`, source nsfas.org.za).

### Youth unemployment (slide 6)

Stats SA, *Quarterly Labour Force Survey Q2 2026*, released 11 August 2026: the unemployment rate
for ages 15 to 24 is 62.8%; 3.8 million of 10.4 million aged 15 to 24 (36.4%) are not in
employment, education or training. Media release:
<https://www.statssa.gov.za/publications/P0211/Media%20Release%20QLFS%20Q2%202026.pdf>;
presentation (pages 23 and 25):
<https://www.statssa.gov.za/publications/P0211/Presentation%20QLFS%20Q2%202026.pdf>.

### UniversityFlow's own facts

From this repository on 24 October 2026: `planning.md` (§0 locked decisions, §1, §2, §7.4 message
cost estimate, §10 who pays, §11 phases, §19 partner gates), `status.md` (the phase board, "Blocked
on", 86 programmes at six universities as drafts, the red-team suite of 454 cases at 100%),
`packages/messaging/src/cadence.ts` (the message rhythm), `packages/content/src/messages.ts` (the
message on slide 11, word for word), `packages/agent/src/crisis.ts`, `charter.ts` and
`system-prompt.ts` (care and crisis).

## Pictures and credits

**Unsplash** (free to use under the Unsplash License, <https://unsplash.com/license>), copied from
the owner's folder, cropped and compressed:

| File | Photographer | Original |
|---|---|---|
| `images/p-classroom.jpg` | Taylor Flowe | <https://unsplash.com/photos/4nKOEAQaTgA> |
| `images/p-calculator.jpg` | Mahmoud Amer | <https://unsplash.com/photos/Ia7I7oMnvcA> |
| `images/p-graduate-hood.jpg` | Dwayne Joe | <https://unsplash.com/photos/F-Y_gU26Ww8> |
| `images/p-window.jpg` | Tymofii Tarasov | <https://unsplash.com/photos/iIKCCmxGRLw> |
| `images/p-library.jpg` | Eliott Reyna | <https://unsplash.com/photos/kcT-7cirBEw> |
| `images/p-laptops.jpg` | X (@disruptxn) | <https://unsplash.com/photos/IgUR1iX0mqM> |
| `images/p-cap.jpg` | Albert Vincent Wu | <https://unsplash.com/photos/m7yOJx0ALME> |

Photographers' names are from the file names; X and Mahmoud Amer were checked on their Unsplash pages.

**The owner's journey pictures** (`images/journey-*.jpg`): the Grade 10, university and graduation
pairs from the owner's Downloads, the same pictures as on the web app's front door, set on the
deck's background.

**Screenshots** (`images/app-*.png`): the live judge demo at <https://universityflow.tumoolo.tech>,
captured on 25 October 2026 with Playwright at high pixel density (laptop 1440x900 at 2x, phone 390x844 at 3x, after the fonts and images load) and placed on the slides at no less than twice the pixels a 1920-wide slide needs, so the text stays crisp (`scripts/screenshots.js`), made-up learners only. Before
each screenshot the script hides the university logos (the deck has no permission to show them)
and blurs helpline numbers (they are still drafts until a person verifies them).

**Not used, on purpose:** `473022585_…_n.jpg`, `493924257_…_n.jpg`,
`learner-acting-career-curro-riverside-…jpg` and `university of johannesburg.jpg` (real people,
unknown rights or a real minor); `profile.jpg` and `profile2.jpg` (designs showing real-looking,
named people, rights unknown); the `mindmap*.jpg` pictures (other people's designs, rights unknown;
the app's own plan maps are the product's version); every university logo.

**Icons:** Font Awesome 6 Free (via `react-icons`), CC BY 4.0.

## How to rebuild

On Windows with Python 3, Node 24, Microsoft PowerPoint, and the repo installed (`pnpm install`):

```powershell
python -m pip install --user fonttools brotli matplotlib pillow qrcode pymupdf
python pitch/scripts/make_fonts.py                   # fonts/Outfit-*.ttf from the web app's font
# install pitch/fonts/Outfit-Regular.ttf and Outfit-Bold.ttf (right-click, Install)
python pitch/scripts/charts.py                       # charts/*.png
node pitch/scripts/screenshots.js                    # scripts/raw/*.png from the live demo (made-up learners)
python pitch/scripts/prep_images.py                  # images/: photos (JPEG), screenshots (PNG), glow, QR
cd pitch/scripts; npm install; cd ../..
$env:NODE_PATH = "$PWD\pitch\scripts\node_modules"  # so apply_theme.js finds pptxgenjs
node pitch/scripts/build_deck.js                     # the .pptx
powershell -File pitch/scripts/export_pdf.ps1        # the .pdf: exported for print, then sharpen_pdf.py puts the full-size screenshots back (PowerPoint downsamples pictures in a PDF); add -PngDir <folder> for slide PNGs
```

`build_deck.js` uses `apply_theme.js` from the pptx skill to write the theme colours; set
`PPTX_SKILL_DIR` if the skill lives somewhere else. `prep_images.py` reads the owner's photos from
`C:\Users\tumom\Tumoolo-Tech\UniversityFlow` and `C:\Users\tumom\Downloads`; change the two paths at
its top on another machine.

## For the owner to check before presenting

- The hackathon's exact name on the cover and footer ("FNB Hackathon 2026").
- The NSFAS figures (a Parliamentary reply read from a badly laid-out PMG table) and the NSFAS
  income limit (from a university page, not NSFAS's own).
- Each Unsplash photographer's name, and that the journey pictures are yours to use (one shows a
  faint watermark).
- Whether the live demo's AI key is set: if not, slide 16 already says the chat is a stand-in.
- The message rhythm numbers on slide 11 are the built defaults that status.md lists as yours to
  confirm.
