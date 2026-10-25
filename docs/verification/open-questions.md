# The open questions: evidence and draft resolutions

These are the questions in [docs/data-verification.md](../data-verification.md) that the first
research pass couldn't settle. For each one: what the data says now, what a fresh look at the
institution's **own** site found on **2026-10-13**, a **draft** resolution, and how confident
that draft is.

**Read this first.**

- Everything below is **research, not verification**. An automated research pass (AI agents with
  web access) gathered the quotes, and nothing here has been checked by a person. Open each URL
  yourself before you accept a resolution. Where a quote matters, check it word for word.
- Quotes were copied from the pages and PDFs as fetched. Page numbers are the PDF page unless a
  printed page number is also given ("p.17 (PDF p.25)").
- Where a site **couldn't be opened**, the entry says so and gives the URL to open in a browser.
- Accepting a resolution changes nothing by itself. Values that should change are listed as
  patches in [proposed-corrections.md](proposed-corrections.md). Only you edit the data.

**Confidence:** **high** means the source states it plainly. **Medium** means the source implies it or
two parts of the source disagree. **Low** means we couldn't get to an official source.

## Summary

| # | Topic | Draft resolution | Confidence |
|---|---|---|---|
| [1](#q1) | UKZN 8-point rule | Keep 90–100% = 8 points, maximum 48: the sentence and two other pages agree. Ask UKZN to confirm | Medium |
| [2](#q2) | UJ June revision | Not reachable (Cloudflare). Every UJ value matches the **April** edition. Owner opens the June PDF and compares it | Low (the June URL isn't confirmed) |
| [3](#q3) | UJ BNursing both sciences | Keep "both": separate columns, no "OR" | High |
| [4](#q4) | UJ BEng Maths/Tech Maths | Keep accepting both: the merged column is printed that way | High |
| [5](#q5) | UJ "English" column | Keep Home or First Additional Language at the printed level, marked as an inference | Medium |
| [6](#q6) | Wits +2 bonus | English and Mathematics only, not Maths Literacy or Technical Maths | Medium |
| [7](#q7) | Wits maximum | Keep 56, labelled as derived from the table | Medium |
| [8](#q8) | Wits window | Keep `opensOn: null` ("March"); all dates and the R100 fee confirmed | High |
| [9](#q9) | Wits Health Sciences | Keep `minimumScore: null`; Composite Index confirmed, NBT deadline 17 August | High |
| [10](#q10) | UP APS from 2026 prospectus | Keep the method; no 2027 NSC/IEB prospectus exists on UP's file server. Re-check when it appears | Medium |
| [11](#q11) | UP fee | Keep `feeZar: null`; the fee couldn't be found on an openable UP page | Low |
| [12](#q12) | UCT Civil Band C | The rebuilt row is right: 420 FPS, Maths 80%, Physical Sciences 70% | High |
| [13](#q13) | UCT Health Sciences sub-minimums | Keep 450 and 360 as the school-results sub-minimums; all bands confirmed | High |
| [14](#q14) | TUT maximum, more than six subjects | TUT states neither. Keep 42 as derived and level 1 = 0 | High (that TUT is silent) |
| [15](#q15) | TUT BEd home languages | Narrow to Sepedi, Setswana, Xitsonga, isiZulu Home Language | Medium-high |
| [16](#q16) | UKZN / CAO opening date | **Set `opensOn: '2026-03-01'`**: the CAO Handbook states it | High |
| [17](#q17) | NSFAS | Dates, thresholds and N+ confirmed; no 2027 guidelines yet. **Narrow the SASSA note** to the three grants the guidelines name | High |
| [18](#q18) | Helplines | 4 of 7 records confirmed on their own sites. SAPS couldn't be opened; 10177 and 112 have no current national page. SMS 32312 needs a check | Mixed |
| [19](#q19) | NSC timetable 2027 | Not published yet: hold only 2026, tell Grade 11 learners so, add 2027 when the DBE publishes it | High (that it is unpublished) |
| [20](#q20) | Physical Sciences P2 on 2 Nov 2026 | Keep the DBE date with a learner-facing note until the DBE confirms or moves it | Low |
| [21](#q21) | Exam timetable source | Provincial copy of the DBE document; open the DBE copy and cite it if it matches | Medium |
| [22](#q22) | Siyavula practice links | Link only free resources on siyavula.com; practice needs a free account (Siyavula asks under-18s for guardian consent); show no endorsement claim | Medium-high |

---

<a id="q1"></a>

## Q1. UKZN APS: eight points at 90–100%?

**The data now.** `packages/admissions/src/universities/methods.ts:73`:
`const UKZN_TABLE: PointsTable = [{ min: 90, points: 8 }, ...NSC_LEVEL_TABLE];` with
`maximum: 48` (`:86`), and the open question noted at `:70`.

**Found** (https://applications.ukzn.ac.za/wp-content/uploads/2026/05/2027-Undergrad.pdf, accessed 2026-10-13):

- p.17 (PDF p.25): "UKZN will recognise academic excellence by awarding eight points to a subject
  with a performance level of 90-100%. Please see the table below:"
- The table under it, "Calculation of Composite Academic Performance Score (NSC-Deg)", has rows
  from "7 | 80% to 100% | 7 | 80% to 100%" down to "1 | 0% to 29% | 1 | 0% to 29%". **There is no
  8-point row.**
- Worked example on the same page: HL 5, FAL 6, LO 4/0, Maths 5, Accounting 6, Business Studies
  6, CAT 7, "Total APS 35". This is reproduced in `methods.test.ts`.
- Same page: "If more than seven subjects were taken, the APS is calculated by adding the
  performance ratings of English (HL or FAL) plus Mathematics or Mathematical Literacy plus the
  best ratings of four other subjects (excluding LO or Maths Paper 3). No bonus points are awarded
  for additional subjects."
- p.15 (PDF p.23): "Life Orientation (LO) is not included in the APS calculation for UKZN (no
  points are allocated for LO)."
- p.26 (PDF p.34): "The maximum APS obtainable is 48. Selection will therefore start from 48 down
  and will stop once places in a programme have been filled."

**Draft resolution.** Keep the method as it is: 90–100% = 8, 80–89% = 7, six subjects, LO
excluded, English and Maths/Maths Literacy always counted, maximum 48. The sentence on p.17 and
the maximum on p.26 agree with each other (6 × 8 = 48). Only the printed table disagrees, and it
looks like a copy of the standard NSC table. Email UKZN admissions to confirm before you verify,
and keep their answer.

**Confidence:** medium.

**Owner decision:** ☐ accept ☐ change to \_\_\_

<a id="q2"></a>

## Q2. UJ: the 25 June 2026 revision of the prospectus

**The data now.** `packages/catalogue/src/data/uj.ts:21`: "UJ published a revision on 25 June 2026
that research could not open: every value here must be checked against that revision before it is
verified". Every UJ `sourceUrl` points into
`https://www.uj.ac.za/wp-content/uploads/2026/04/uj_undergrad_prospectus2027.pdf`.

**Found (2026-10-13).**

- **Couldn't open anything live.** Every uj.ac.za URL returned HTTP 403 with a Cloudflare "Just a
  moment..." JavaScript challenge.
- A search restricted to uj.ac.za named
  `https://www.uj.ac.za/wp-content/uploads/2026/07/uj_undergrad_prospectus2027_online_25jun2026.pdf`,
  linked from https://www.uj.ac.za/pdf-document/2026-uj-undergraduate-prospectus/. **We didn't see
  that URL on any page we could open, so treat it as unconfirmed.**
- The April edition was read from a **Wayback Machine archive copy of the exact uj.ac.za address**
  (https://web.archive.org/web/20260408113955id_/https://www.uj.ac.za/wp-content/uploads/2026/04/uj_undergrad_prospectus2027.pdf).
  This is not the live page. p.11 reads "Information correct at the time of publication: April
  2026".
- Against that April copy, **all 16 UJ programme records match as printed**. Page-by-page quotes are
  in the research notes; see [uj.md](uj.md) for the fields.
- **Window:** p.15 says "All Undergraduate Programmes 31 October 2026 @ 12:00". p.14 says "No
  application fee will be charged for online and paper based applications". p.99 says
  "Applications open in April and close on 31 October 2026". **"1 April" was not found in the
  April edition** (see [proposed-corrections.md](proposed-corrections.md), C3).

**Draft resolution.** Open both PDFs in a browser: the June URL above, or the link on the
pdf-document page. Compare the June revision against [uj.md](uj.md), table by table. Where they
differ, the June edition wins. Then change every UJ `sourceUrl` to the June PDF, because the
April file is superseded.

**Confidence:** high that the April values are transcribed correctly; low that the June URL is
right; unknown whether June changed anything.

**Owner decision:** ☐ accept ☐ change to \_\_\_

<a id="q3"></a>

## Q3. UJ Bachelor of Nursing: Physical Sciences 4 and Life Sciences 4?

**The data now.** `packages/catalogue/src/data/uj.ts:151-156` requires English 5, Mathematics 4,
`requires(PHYSICAL, { level: 4 })` (`:154`) **and** `requires(LIFE_SCI, { level: 4 })` (`:155`).
The selection text tells the learner to check with UJ.

**Found** (April edition, archive copy, p.68):

- Header: "PROGRAMME | Qualification Code | Minimum APS | English | Mathematics | Physical Science |
  Life Science | CAREER | CAMPUS".
- Row: "Bachelor of Nursing (4 years) / NURSING | B9N02Q | 30 | 5 (60%+) | 4 (50%+) | 4 (50%+) |
  4 (50%+) | …".
- No "OR" column, asterisk or footnote on the page. Elsewhere UJ prints alternatives with an
  explicit "OR" column (p.60, BEngTech).

**Draft resolution.** Keep both as required. Once verified, drop "check with UJ" from the
selection text (see [proposed-corrections.md](proposed-corrections.md), C9).

**Confidence:** high, subject to the June revision (Q2).

**Owner decision:** ☐ accept ☐ change to \_\_\_

<a id="q4"></a>

## Q4. UJ BEng: Mathematics or Technical Mathematics?

**The data now.** `packages/catalogue/src/data/uj.ts:102` and `:119`:
`requires(MATHS_OR_TECH, { level: 5 })` for BEng Civil and BEng Electrical. Physical Sciences only;
the selection text says "Technical Science is not accepted".

**Found** (April edition, archive copy, p.60):

- Header: "English | Mathematics / Technical Mathematics | Physical Science | OR | Technical
  Science".
- "CIVIL ENGINEERING | B6CS0Q | 32 | 5 (60%+) | 5 (60%+) | 5 (60%+) | - | Not accepted".
- "ELECTRICAL AND ELECTRONIC ENGINEERING | B6ES0Q | 32 | 5 (60%+) | 5 (60%+) | 5 (60%+) | - | Not
  accepted".
- BEngTech: "CIVIL ENGINEERING | B6CV3Q | 28 | 4 (50%+) | 5 (60%+) | 5 (60%+) | OR | 5 (60%+)".

**Draft resolution.** Keep the record: BEng accepts Mathematics or Technical Mathematics 5,
requires Physical Sciences 5, and doesn't accept Technical Science. BEngTech Civil accepts Physical
Sciences or Technical Sciences 5. The merged column is unusual for a BEng, so it's worth one
question to UJ, but the record follows what is printed.

**Confidence:** high on what is printed.

**Owner decision:** ☐ accept ☐ change to \_\_\_

<a id="q5"></a>

## Q5. UJ's single "English" column

**The data now.** `packages/catalogue/src/data/uj.ts:58-59`: "UJ's tables print one "English"
column without saying Home or First Additional Language." The data uses
`const ENGLISH = (level: number) => requires(ENGLISH_ANY, { level });`, so Home Language or First
Additional Language at the same level.

**Found** (April edition, archive copy):

- No NSC degree table outside Education says which English it means.
- p.54 (Education): "Home language 5 (60%+) OR Additional Language 6 (70%+)". The record
  `uj-bed-foundation-phase` already encodes this.
- p.37 (footnote for Amended Senior Certificate applicants only): "* English, Home Language, First
  Additional Language".
- p.16 (APS example): "First language (language of teaching and learning)" and "Additional
  recognised language".
- p.77 (vocational certificate holders): "Language of Teaching and Learning of the faculty,
  English, an achievement rating of 5 (80-100%) is required or 1st Additional Language, an
  achievement rating of 5 (80-100%) is required."

**Draft resolution.** Keep Home Language or First Additional Language at the printed level for
every NSC table except Education. This is an inference from p.37 and p.77, not a statement, so ask
UJ to confirm.

**Confidence:** medium.

**Owner decision:** ☐ accept ☐ change to \_\_\_

<a id="q6"></a>

## Q6. Wits: does the +2 apply to Mathematical Literacy or Technical Mathematics?

**The data now.** `packages/admissions/src/universities/methods.ts:174` records the question. The
`subjectTables` at `:199-203` give the +2 table to `english-hl`, `english-fal` and `mathematics`
only.

**Found** (https://www.wits.ac.za/undergraduate/entry-requirements/, accessed 2026-10-13):

- Column headings: "Wits APS | Wits APS% | Wits APS for English and Mathematics | Wits APS for Life
  Orientation | Other subjects". The English and Mathematics column reads "8+2=10", "7+2=9",
  "6+2=8", "5+2=7", then "4", "3", "0", "0".
- "Mathematical Literacy will be considered for LLB, Education and Humanities (except for
  Speech-Language Pathology and Audiology)"
- "English must be taken either as Home Language or First Additional Language"
- The page never says "bonus" and never mentions Technical Mathematics.
- No 2027 "Guide for Applicants" PDF was found on wits.ac.za.

**Draft resolution.** Keep the method: the +2 goes to English (HL or FAL) and Mathematics. Maths
Literacy and Technical Maths earn the "Other subjects" points. The column names only "English and
Mathematics". This is an inference, so it's worth a question to Wits admissions.

**Confidence:** medium.

**Owner decision:** ☐ accept ☐ change to \_\_\_

<a id="q7"></a>

## Q7. Wits: maximum APS

**The data now.** `packages/admissions/src/universities/methods.ts:215`: `maximum: 56`. At `:172`:
"Wits states no maximum; the table gives 56."

**Found** (same page): the table above (8 points at 90–100% for "Other subjects", 10 for English
and Mathematics, 4 for Life Orientation) and "The APS calculation is based on the best seven
subjects including Life Orientation". No maximum is stated on that page or on any course page
opened. The Wits Grade 12 pamphlet (2026 cycle, PDF p.17) uses a different six-subject scale for
**scholarships only**.

**Draft resolution.** Keep 56 (English 10 + Mathematics 10 + four others × 8 + LO 4), labelled as
derived. The maximum only sets how full the score bar looks; no admission decision depends on it.

**Confidence:** medium.

**Owner decision:** ☐ accept ☐ change to \_\_\_

<a id="q8"></a>

## Q8. Wits application window

**The data now.** `packages/catalogue/src/data/wits.ts:31-32`: `// Wits says only "March", with no
day.` and `opensOn: null`. Also `closesOn: '2026-09-30'`, an earlier closing of 2026-06-30 for
"Health Sciences, Architectural Studies, Audiology, Speech-Language Pathology, BA Film and
Television" (`:37`), and `feeZar: 100`.

**Found** (accessed 2026-10-13):

- https://www.wits.ac.za/undergraduate/apply-to-wits/timelines/: under "March", "Applications open
  for all undergraduate (full-time and part-time) programmes." No day is given.
- Under "June": "Applications close on 30 June 2026 for: all Health Sciences programmes, Bachelor
  of Arts in Film and Television (BAFT), Bachelor of Architecture (BAS), Bachelor of
  Speech-Language Pathology, and Bachelor of Audiology."
- Under "September": "Applications close on 30 September 2026 for all remaining undergraduate
  programmes".
- https://www.wits.ac.za/undergraduate/apply-to-wits/: "Applications for the 2027 Academic Intake
  have Closed"; "All programmes in the Faculty of Health Sciences; Bachelor of Architectural
  Studies; Bachelor of Audiology, Bachelor of Speech-Language Pathology; BA Film and TV close 30
  June 2026."; "An application fee of R100 is required."

**Draft resolution.** Every value is confirmed. Keep `opensOn: null`. Optionally reword the
earlier-closing scope to "All programmes in the Faculty of Health Sciences, …" (C10).

**Confidence:** high.

**Owner decision:** ☐ accept ☐ change to \_\_\_

<a id="q9"></a>

## Q9. Wits Health Sciences: no published cut-off

**The data now.** `packages/catalogue/src/data/wits.ts:117`, `:135` and `:153`: `minimumScore:
null` for MBBCh, BPharm and BNursing. `HEALTH` at `:49-50` describes the Composite Index and says
the NBT must be written "by mid-August".

**Found** (https://www.wits.ac.za/course-finder/undergraduate/health/medicine-and-surgery/,
…/health/pharmacy/, …/health/nursing/, accessed 2026-10-13; the wording is the same on all three):

- "The Faculty of Health Sciences uses a Composite Index (CI) score to guide applicant selection."
- "Your matric academic results for five subjects: English, Mathematics, best of Physical
  Sciences/Life Sciences and the best two other subjects. We consider the percentage achieved, not
  the symbol. The average of the five subjects carries a 75% weighting."
- "National Benchmark Test (NBT) scores. The average of the NBT scores carries a 25% weighting."
- "All applicants must write the NBT at one of the Pencil and Paper, i.e. IN-PERSON NBT sessions.
  Online NBT results will not be considered."
- "The NBT should be written by 17 August."
- Subjects: MBBCh and BPharm, "English Home Language OR First Additional Language Level 5 /
  Mathematics Level 5 / Life Sciences AND/OR Physical Sciences Level 5". Nursing has the same
  subjects at Level 4.
- None of the three pages gives a minimum APS or cut-off.

**Draft resolution.** Keep `minimumScore: null`. Every subject level matches. Optionally replace
"by mid-August" with "by 17 August" (C11).

**Confidence:** high.

**Owner decision:** ☐ accept ☐ change to \_\_\_

<a id="q10"></a>

## Q10. UP APS: quoted from the 2026 prospectus

**The data now.** `packages/admissions/src/universities/methods.ts:22-24`: "best six 20-credit
subjects on the NSC 1–7 table; Life Orientation excluded; maximum 42. Quoted from the 2026 NSC/IEB
prospectus". The `sourceUrl` points at that 2026 PDF.

**Found** (accessed 2026-10-13):

- 2026 NSC/IEB prospectus
  (https://drupalwebprod-files.up.ac.za/Public/2026-01/up_ug-prospectus-2026_nsc-ieb_devv4_web.zp260601.pdf?VersionId=mvtuDlg.4YojvcJdv.N7CcECIn5Hv132),
  PDF p.6: "The APS calculation is done by using the NSC 1 to 7 scale of achievement. It is based on
  a candidate's achievement in six recognised 20-credit subjects. The highest APS that can be
  achieved is 42. Life Orientation is a 10-credit subject and is excluded from the calculation when
  determining the APS."
- **No 2027 NSC/IEB prospectus** was found on any UP domain. The 2027 requirement tables PDF has
  per-programme figures only; it was "Published … in December 2025". All 13 UP programme values
  match it.
- **Couldn't open:** www.up.ac.za (HTTP 403 for every page, including
  https://www.up.ac.za/students/admission-information). Open it in a browser and look for a 2027
  NSC/IEB prospectus.

**Draft resolution.** Keep the method and its 2026 citation. The 2027 tables are consistent with
it. If a 2027 NSC/IEB prospectus exists on www.up.ac.za, check the APS paragraph against it and
switch the citation.

**Confidence:** medium.

**Owner decision:** ☐ accept ☐ change to \_\_\_

<a id="q11"></a>

## Q11. UP application fee

**The data now.** `packages/catalogue/src/data/up.ts:40-41`: "The amount could not be confirmed on
an official page; left blank rather than guessed." and `feeZar: null`.

**Found (2026-10-13).**

- **Couldn't open:** https://www.up.ac.za/online-application/application-fee (HTTP 403). Open it in
  a browser.
- The only R300 on a UP domain is the UPOnline (distance) page,
  https://www.online.up.ac.za/application-fee: "When you submit your UPOnline study application,
  you must pay an application fee of R300 (US$30)… non-refundable." That page is about online
  programmes, **not** contact undergraduate applications.
- The 2026 prospectus p.2 mentions only "proof of payment of the application fee, if you paid at a
  bank". It gives no amount.
- **Window confirmed:** 2027 International prospectus, PDF p.11 (printed 10): "Applications to
  study at UP in 2027 open on 1 April 2026." PDF p.14 (printed 13): "The closing date for
  applications in the Faculty of Veterinary Science is 31 May. The closing date for programmes in
  all other faculties is 30 June."

**Draft resolution.** Keep `feeZar: null` until you've seen the amount (and any income waiver) on
www.up.ac.za in a browser. Don't use the R300 search summary.

**Confidence:** low (no openable source).

**Owner decision:** ☐ accept ☐ change to \_\_\_

<a id="q12"></a>

## Q12. UCT Civil Engineering Band C

**The data now.** `packages/catalogue/src/data/uct.ts:106-117`: bands A 500, B 480 (weighted), C 420
(`:115`), Mathematics 80% and Physical Sciences 70%.

**Found** (https://degree.uct.ac.za/media/685611, p.36, checked against the page image, 2026-10-13):

- Band A: "Guaranteed admission 500 FPS or above ≥ 80% for Mathematics & ≥ 70% for Physical
  Sciences NBTs in Mathematics, AL & QL to be written*"
- Band B: "Likely Admission 480 WPS or above ≥ 80% for Mathematics & ≥ 70% for Physical Sciences…"
- Band C ("Only SA applicants in targeted redress categories"): "Possible admission 420 FPS or
  above ≥ 80% for Mathematics & ≥ 70% for Physical Sciences".
- Electrical: the same bands with "≥ 75% for Physical Sciences".
- "*The results of the NBTs are not taken into account for admission for the Faculty of
  Engineering & The Built Environment."

**Draft resolution.** The rebuilt row is correct. No change.

**Confidence:** high.

**Owner decision:** ☐ accept ☐ change to \_\_\_

<a id="q13"></a>

## Q13. UCT Health Sciences: school-results sub-minimums

**The data now.** `packages/catalogue/src/data/uct.ts:149`: `minimumScore: 450` (MBChB), with bands
810 / 807 (weighted) / 644. `:171`: `minimumScore: 360` (Physiotherapy), with bands 730 / 797
(weighted) / 580.

**Found** (https://degree.uct.ac.za/media/685611, 2026-10-13):

- p.42: "APS = NSC score (score out of 600). The APS is worked out as follows: percentages of three
  required subjects plus percentages of next three best subjects excluding Life Orientation."
  Also "FPS … (score out of 900) … plus the NBT score."
- p.43, MBChB: "Mathematics and Physical Sciences at 70%, English (Home or First Additional
  Language) at 65%; and 70% for the next three best subjects excluding Life Orientation.
  Sub-minimum APS of 450." Bands: A "810 FPS or above"; B "807 WPS or above"; C "644 FPS or
  above".
- p.43, Physiotherapy: "Mathematics at 60%, Physical Sciences or Life Sciences at 65%, English
  (Home or First Additional Language) at 65%; and 60% for the next three best subjects excluding
  Life Orientation. Sub-minimum APS of 360." Bands: A "730 FPS or above"; B "797 WPS or above"
  (UCT does print B higher than A); C "580 FPS or above for redress 1 / 610 … redress 2 / 680 …
  redress 3 and 4".

**Draft resolution.** Keep 450 and 360 as the sub-minimums; the selection text already explains the
900-point score and the next-three-subjects minimum. Every band matches.

Note for the code: UCT's Health Sciences "APS" is the three required subjects plus the next three
best. The default `uct-fps` method counts English plus the best five. For these two programmes the
results come out the same only when the required subjects are counted first, which
`includesProgrammeSubjects: true` does.

**Confidence:** high.

**Owner decision:** ☐ accept ☐ change to \_\_\_

<a id="q14"></a>

## Q14. TUT APS: maximum, and more than six subjects

**The data now.** `packages/admissions/src/universities/methods.ts:43-47`: "TUT publishes no maximum;
six subjects at level 7 is 42". `const TUT_TABLE = NSC_LEVEL_TABLE.filter((band) => band.points > 1)`
makes level 1 earn 0. The maximum is 42 (`:56`).

**Found**
(https://www.tut.ac.za/media/tshwane-interim/site-content/documents/First-Year-Course_Information.pdf,
PDF p.3, 2026-10-13):

- Note 1: "Life Orientation and an achievement level of 1 in a subject are not considered in the
  calculation of the Admission Point Score (APS)."
- Note 3: "…with a minimum of six subjects, including English (home or first additional language
  with a minimum score of 3), Mathematics (Technical Mathematics) or Mathematical Literacy (as per
  specific academic programme requirement)…"
- No maximum and no rule for more than six subjects, here or in the 2027 "General Information for
  First Year Enrolment" (p.5, same wording).

**Draft resolution.** Keep the method. Level 1 = 0 follows the text. The 42 is a derived display
maximum, not a TUT rule; say so in the method comment (it already does). For more than six
subjects, the best six including English is the sensible reading. Ask TUT if it matters to a
learner near a cut-off.

**Confidence:** high that TUT states neither rule; medium on the best-six reading.

**Owner decision:** ☐ accept ☐ change to \_\_\_

<a id="q15"></a>

## Q15. TUT BEd Foundation Phase: which home languages?

**The data now.** `packages/catalogue/src/data/tut.ts:230`: `requires(HOME_LANGUAGES, { level: 5 })`,
so any of the 11 home languages. The selection text at `:235` quotes "Home language offered in the
programme".

**Found** (2026-10-13):

- 2027 course information, PDF p.9 (printed 7): "BEd (Foundation Phase Teaching) | SN | 4 | 31/7 |
  Home language offered in the programme 5 / First additional language 4 / Mathematics or 4 /
  Mathematical Literacy 5 | 25". The languages aren't named.
- **2026** Humanities prospectus
  (https://www.tut.ac.za/media/tshwane-interim/site-content/images/prospectus/PART_5_Humanities_Prospectus_-2026.pdf),
  PDF p.126: "achievement level of at least 5 for the home language (language must align with the
  language as offered in the programme)". PDF p.128: "plus one of the following Home Language
  electives: Home Language: Sepedi I / Home Language: Setswana I / Home Language: Xitsonga I / Home
  Language: isiZulu I".

**Draft resolution.** Narrow the requirement to Sepedi, Setswana, Xitsonga or isiZulu Home Language
at level 5 (C7). The list comes from the 2026 prospectus. Look for a 2027 Humanities prospectus
before you verify.

**Confidence:** medium-high.

**Owner decision:** ☐ accept ☐ change to \_\_\_

<a id="q16"></a>

## Q16. UKZN / CAO opening date

**The data now.** `packages/catalogue/src/data/ukzn.ts:41-42`: `// Neither UKZN nor the CAO publishes
an opening date.` and `opensOn: null`.

**Found** (CAO Handbook 2027,
https://www.cao.ac.za/Download/CAO%20HANDBOOK%202027%20Entry%20web.pdf, 2026-10-13):

- p.19 (PDF p.31): "Applications for 2027 entry open on 1 March 2026!"
- p.7 (PDF p.19): "The following year's January applications open on 01 March of the year
  preceding the entry year."
- p.12 calendar, March: "01 – 2027 First Semester applications open and on-time administration fee
  of R250 applicable".
- p.12, June: "30 – UKZN: B Medicine & B Surgery close (No Late Applications accepted)".
- p.13, September: "30 – On-time applications for all remaining DUT, MUT and UKZN programmes
  close". October: "01 – Late applications for selected DUT, MUT and UKZN programmes open and
  administration fee of R250 still applies"; "31 – Last Day for on-time administration fee of R250".
  November: "01 – Late administration fee of R470 applicable".
- Fee image (https://www.cao.ac.za/download/2027%20Admin%20Fee%20Structure%20(1).png): "If your FULL
  application and fee reach us on or before | 31 Oct 2026 | R250.00 | …".
- Watch out: UKZN prospectus p.11 (PDF p.19) prints "UKZN Application Fees / South Africa / On-time
  applications R210 / Late applications R420". It appears beside the Semester 2 direct
  applications, so it looks like UKZN's own direct fee, not the CAO fee. This is unconfirmed.

**Draft resolution.** Set `opensOn: '2026-03-01'` and correct the comment (C1). Closing dates and
the CAO fee are confirmed. Consider telling learners that late applications for selected UKZN
programmes open on 1 October.

**Confidence:** high.

**Owner decision:** ☐ accept ☐ change to \_\_\_

<a id="q17"></a>

## Q17. NSFAS

**The data now.** `packages/catalogue/src/data/support.ts:13-33`: opens 2026-09-18, closes
2026-10-31, R350,000 and R600,000. `sassaNote` (`:20-21`): "SASSA grant recipients automatically
qualify on financial eligibility, and no proof of income is required." The `nPlusRule` (`:30`) is
paraphrased from the 2026 Bursary Guidelines.

**Found** (2026-10-13). WebFetch failed on nsfas.org.za with "unable to verify the first
certificate". The pages were fetched with the Windows certificate store instead and opened fine
(HTTP 200). Check them in a browser.

- https://www.nsfas.org.za/content/: "Applications open 18 September 2026 and close 31 October
  2026 at 23:59 South African time." The 2027 box reads "SASSA grant recipients · Students from
  households earning up to R350 000 a year · Students with disabilities from households earning up
  to R600 000 a year". Also "If you receive a SASSA grant, no proof of income is required." and
  "Go to my.nsfas.org.za or open the NSFAS app."
- 2026 Bursary Guidelines
  (https://www.nsfas.org.za/content/downloads/Annexure%20A_NSFAS%202026%20Bursary%20Guidelines.pdf):
  - 4.4.5.1: "…R350,000 or less"; 4.4.5.2: applicants with disability "R600,000 or less".
  - 4.4.4.2: "Any applicant who is a South African Social Security Agency (SASSA) recipient, as
    validated by NSFAS, automatically meets the financial eligibility criteria…"
  - **4.4.4.3 limits that to "the Foster Care, Care Dependency, and Child Support grants."**
  - N+ rule: 4.5.6.3 "The N period of study equates to the minimum time required to complete a
    qualification."; 4.5.6.6 "The N+1 Rule applies to all students who receive financial aid from
    NSFAS."; 4.5.6.7 "All students with disability qualify for N+2."; 4.5.6.8 "The additional
    funding (denoted by 1 or 2) is applied once over a student's academic career within the
    education sector (University or TVET College)."
- **No 2027 guidelines** on https://www.nsfas.org.za/content/policies.html (it lists 2021, 2025 and
  2026). Clause 6.4.1: "The NSFAS will publish the NSFAS Eligibility Criteria and Conditions for
  Financial Aid once in three years, commencing from 2025." 2027 application forms (consent form,
  disability annexure) do exist.

**Draft resolution.** Dates, thresholds, documents and the N+ rule are confirmed. The `nPlusRule` is
a fair paraphrase; it leaves out distance students (4.5.6.5) and qualification changes
(4.5.6.9–10). **Narrow `sassaNote`** to the three grants (C5). Optionally add "at 23:59" to the
close and the NSFAS toll-free number. Keep the 2026 guidelines citation; under the three-year cycle
in 6.4.1 they may still apply for 2027.

**Confidence:** high.

**Owner decision:** ☐ accept ☐ change to \_\_\_

<a id="q18"></a>

## Q18. Helplines

**The data now.** `packages/catalogue/src/data/support.ts:35-110`, seven records. The Higher Health
SMS line was deliberately left out (`:9-10`). 10177 and 112 are sourced from
https://www.westerncape.gov.za/know-who-you-can-call-emergency (`:91`, `:101`).

**Found on each organisation's own site (2026-10-13).**

| Record | Number in data | Own-site evidence | Result |
|---|---|---|---|
| `higher-health` | 0800 36 36 36 (`:41`) | https://higherhealth.ac.za/: "24hr Crisis Helpline - 0800 36 36 36" and "Our helpline operates 24/7, 365 days a year" | **Confirmed.** One Higher Health page (…/suicide-prevention-and-mourning-the-tragic-loss-of-students/) prints "0860 36 36 36" once and "0800 36 36 36" later, which looks like a typo on their side. **No SMS short code** appears on the site; a site search for 43336 returns "Nothing found." Keep the SMS line out |
| `sadag-suicide-crisis` | 0800 567 567 (`:52`) | https://www.sadag.org/: "24-HOUR TOLL-FREE EMERGENCY HELPLINES Suicide Crisis Helpline 0800 567 567" | **Confirmed** |
| `substance-abuse-helpline` | 0800 12 13 14, SMS 32312 (`:63-64`) | https://www.sadag.org/: "Department of Social Development Substance Abuse Helpline 0800 12 13 14 SMS 32312", under the 24-hour heading. **But** DSD's own directory (https://www.dsd.gov.za/index.php/documents?task=download.send&id=102&catid=50&m=0) lists "Substance Abuse Helpline: 0800 12 13 14" and puts "SMS Line: 32312" under the **GBV Command Centre** | **Call line confirmed** (SADAG and DSD). **SMS 32312 is disputed** (C6) |
| `childline` | 116 (`:75`) | https://www.childlinesa.org.za/contact-us/: "Remember, you may call our Helpline 24X7 on 116 (We are free from all networks)" | **Confirmed.** The site footer also shows an image with alt text "0800 55 555". Decide whether to add it |
| `saps-emergency` | 10111 (`:85`) | **Couldn't open** saps.gov.za (HTTP 403 on every URL, including https://www.saps.gov.za/services/cc_10111.php) | **Not found on own site.** Open it in a browser. Indirect: Childline's contact page says "please call the Police on 10111" |
| `ambulance` | 10177 (`:95`) | Not on health.gov.za. gov.za has only a 2009 Gauteng statement (https://www.gov.za/node/595234) and the 2008 ICASA regulations (https://www.gov.za/sites/default/files/gcis_document/201409/gg31230nn862pg3-13.pdf): "The emergency numbers include the number(s) 112, 10111, 10177, 107 …" | **No current national page found.** The ICASA regulation lists it as an emergency number |
| `mobile-emergency` | 112 (`:105`) | The same ICASA regulations: "'emergency number' means the exclusive national public emergency number 112" and "Subscribers whose telephone services are temporarily disconnected or suspended … must, at all times, have access to the 112 emergency number." Not found on icasa.org.za's homepage | **No current national page found.** The regulation confirms 112 |

**Draft resolution.**

- Four records are confirmed on their own sites: Higher Health, SADAG, the substance call line and
  Childline.
- **Dial-test** 10111, 10177 and 112 from a South African phone, and open saps.gov.za in a browser.
- Consider changing the source of 10177 and 112 to the ICASA regulation (a national instrument)
  instead of the Western Cape page.
- Remove or confirm SMS 32312 (C6).

**Confidence:** high for the four confirmed; low for the three emergency numbers until they are
dial-tested or found on a national site.

**Owner decision:** ☐ accept ☐ change to \_\_\_

<a id="q19"></a>

## Q19. The 2027 NSC exam timetable

**The data now.** `packages/catalogue/src/data/nsc-exams-2026.ts`: 45 papers, all for the
**October/November 2026** NSC, all drafts. Nothing for 2027.

**Found (2026-10-13).** The DBE's publications list (https://www.education.gov.za/Resources/Publications.aspx)
has the "2027 School Calendar" but no 2027 NSC examination timetable, and searches found none. The
2026 timetable was approved by the Council of Education Ministers on 23 January 2026 (Eastern Cape
Assessment Instruction 19 of 2026, Annexure A).

**Draft resolution.** The first cohort writes in October/November 2027. Until the DBE publishes that
timetable, the app tells a Grade 11 learner it isn't out yet and shows no dates; nothing is invented.
Add the 2027 papers from the DBE's document as soon as it appears (expect January to March 2027),
then verify them like any other record.

**Confidence:** high that it is unpublished as of 2026-10-13.

**Owner decision:** ☐ accept ☐ change to \_\_\_

<a id="q20"></a>

## Q20. Physical Sciences Paper 2 on 2 November 2026

**The data now.** `nsc-2026-physical-sciences-p2`: 2026-11-02, 09:00, 3 hours, with a `note` that
learners see.

**Found (2026-10-13).** The DBE timetable (KZN copy:
https://www.kzneducation.gov.za/wp-content/uploads/2026/08/Oct-Nov-2026-NSC-TIMETABLE.pdf; Eastern
Cape copy: https://www.ecexams.co.za/2026_Assessment_Instructions/19-2026OctNovNSCSCtimetable.pdf)
schedules Physical Sciences P2, Technical Sciences P2 and Religion Studies P1 on Monday 2 November.
The Eastern Cape circular says 3 to 5 November were kept free for local government elections; the
elections were later set for 4 November. A Western Cape Education statement of 6 October 2026
(https://www.westerncape.gov.za/education/article/final-countdown-matric-exams-begins) says "No
exams will be written on 2 to 5 November". No revised national timetable was found.

**Draft resolution.** Keep the DBE date and the note until the DBE confirms or moves the paper; then
correct the record and remove the note.

**Confidence:** low.

**Owner decision:** ☐ accept ☐ change to \_\_\_

<a id="q21"></a>

## Q21. Where the exam timetable comes from, and what it covers

**The data now.** Every paper cites the KwaZulu-Natal Department of Education's copy of the DBE
timetable. 21 subjects are entered: the commonest ones (English and Afrikaans HL and FAL, isiZulu
HL, the three mathematics subjects, the sciences, the commerce subjects, Geography, History, CAT,
IT, EGD, Tourism, Consumer Studies, Agricultural Sciences).

**Found (2026-10-13).** The DBE's own file (Publications item 9548,
https://www.education.gov.za/Resources/Publications/tabid/93/ItemId/9548/Default.aspx) refused
automated access. The KZN PDF is headed as the DBE's document (Chief Directorate: National
Assessment and Public Examinations) and matches the Eastern Cape's Annexure A entry for entry.
The timetable prints a session and a duration, not an end time; end times are computed.

**Draft resolution.** Open the DBE's copy in a browser; if it matches, change `sourceUrl` to it.
Add the remaining subjects (other official languages, Technical Sciences, Religion Studies, the arts
and technology subjects) from the same document. Life Orientation stays out: it has no final
written paper.

**Confidence:** medium.

**Owner decision:** ☐ accept ☐ change to \_\_\_

<a id="q22"></a>

## Q22. Siyavula practice links: what is free, what may we say, and how do we link

**The data now.** 18 draft records in `packages/catalogue/src/data/siyavula.ts`: the Grade 10–12
Mathematics and Physical Sciences open textbooks, the Grade 10 Mathematical Literacy and Life
Sciences books (Siyavula lists no Grade 11 or 12 book for either), the Grade 10–12 Computer
Applications Technology and Information Technology books, free Practice for Mathematics and
Physical Sciences, and free past papers for both. Checklist: [practice.md](practice.md).

**Found (2026-10-13, Siyavula's own site only).**
- Textbooks are free to read online, no account: every book is linked from
  https://www.siyavula.com/read. The read pages say the content is under a Creative Commons
  Attribution licence (CC BY 3.0); /read says the branded editions are CC BY-ND 3.0 and that the
  CAT and IT books "have been provided by MTN and are under a closed copyright license".
- Practice: "Always FREE! Sign up as a learner" (https://www.siyavula.com/products/learners);
  "Learners practise on Siyavula for free!" (https://www.siyavula.com/pricing; the paid plans
  there are for teachers and schools). It needs an account. Per-chapter practice links
  (`/dashboard/select-chapter/…`) need a login, so the records link the learner page.
  https://www.siyavula.com/practice returns 404.
- Past papers: "Free past exam papers for Mathematics and Physical Sciences"
  (https://www.siyavula.com/products/past-papers). The page names no grades: the records assume
  Grade 12. It shows Sign up and Log in but doesn't say an account is needed.
- Linking: the terms (https://www.siyavula.com/info/terms-and-conditions) say nothing against
  linking to Siyavula pages; they reserve copyright on everything not marked Creative Commons,
  and say users under 18 need a parent's or guardian's consent to use the site. We link only:
  no copying, no logo, no suggestion of a partnership.
- "Endorsed by the Department of Basic Education" is Siyavula's own claim on /read. The DBE's
  page (https://www.education.gov.za/Curriculum/LearningandTeachingSupportMaterials(LTSM)/SiyavulaTextbooks.aspx)
  lists the Grade 10–12 Mathematics and Physical Sciences textbooks under Learning and Teaching
  Support Materials, without the word "endorsed".

**Draft resolution.** Open every link; if it is still free, add `verifiedOn`/`verifiedBy`.
Learners are told practice needs a free account and that Siyavula asks under-18s for a parent's
or guardian's OK. Show no endorsement claim to learners (planning.md §3 says "endorsed by the
DBE": if wanted, say "listed by the DBE as learning and teaching support material", citing the
DBE page). Decide whether to keep the CAT and IT books (closed copyright, MTN-provided, free to
read).

**Confidence:** medium-high.

**Owner decision:** ☐ accept ☐ change to \_\_\_
