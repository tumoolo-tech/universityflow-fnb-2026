# PHASE-6 — A13 Data accuracy (wave 10: Phase 6a, 6d, and the 50 TVET colleges)

**Project:** UniversityFlow · **Phase:** 6 · **Date:** 2026-10-25
**Commit:** e09ad5b4 · **Audit source:** docs/audits/A13-data-accuracy.md (project audit)
**Result:** 0 Critical · 0 High · 1 Medium · 6 Low · 4 Info · COL-01 stands · COL-02 narrowed · 0 waived

Every record audited here is a **draft**. Nobody has verified any of them, and no agent has added `verifiedOn`/`verifiedBy`. So under A13's rules a mismatch is at most Medium, unless a draft can reach a learner as fact. It can't in production; see "How drafts reach anyone".

## Scope

- **Phase 6a** (`packages/catalogue/src/data/{wits,uj,up,uct,ukzn,tut}-assessment.ts`):
  - 14 rules records.
  - 139 module schemes: UCT 44, UKZN about 90. Wits and TUT have none (their schemes are on the LMS); UJ and UP are `unread` (HTTP 403, a person in a browser).
  - 5 calendars: Wits 2027, TUT 2027, UCT 2027 (a DRAFT planner), UKZN 2026 and 2027.
- **Phase 6d** (`data/open-books.ts`, `book-links.ts`): the free books.
- **#131** (`data/colleges/*.ts`, `register.ts`; `colleges.ts`, `colleges-catalogue.ts`): 50 public TVET colleges, 791 programmes, the teach-out circulars TC 0134(B) and TC 0153, and the registration check.

## Method

1. **Structure.** I loaded the TypeScript with `node --experimental-strip-types` and counted records. For each I checked `sourceUrl` and `academicYear`, duplicate ids, programmes that point at no college, and any `verifiedOn`/`verifiedBy` value. I also compared the 50 colleges with DHET's own list:
   - DHET Statistics on PSET 2024, Appendix Table 10.10, p. 126, 50 rows;
   - DHET's March 2020 contacts list.
2. **Sample against the cited source.** Read-only GETs only. I downloaded each PDF or .docx and extracted its text; I read web pages with a fetch tool. Two truncated UCT downloads were fetched again and checked against `Content-Length`. Coverage:
   - 40 module schemes across UCT's 4 faculties and UKZN's 5 colleges;
   - 9 of the 14 rules records;
   - every date in all 5 calendars;
   - 20 free books;
   - 14 colleges across all 9 provinces;
   - both circulars.
3. **COL-01 and COL-02.** I searched dhet.gov.za (TVET Colleges, Registers, TECHNICA circulars) and the web for each circular, and checked again the 5 colleges with no usable site.

## Findings

| ID | Audit | Severity | Location | Finding | Status | Plan |
|---|---|---|---|---|---|---|
| A13-12 | A13 | Medium | packages/catalogue/src/data/colleges/fs-nc-nw.ts:1024-1180 (Northern Cape Rural) | The college's site says verbatim "NATED is closed to new intake — only students already enrolled are completing these", but 6 N4–N6 programmes carry `yearPrinted: 2027`. "Matric (Grade 12)" is the site's course-finder question, not an entry rule. The per-campus lists don't match the current campus cards (no Safety in Society, Tourism, Financial Management or Renewable Energy; Kuruman lists Office Admin, Road Transport, Public Admin, ECD, Small Retail). In Plan B, TC 0134(B) already hides every N4–N6 for 2027 | Open | A person re-reads ncrtvet.com: remove the N4–N6 programmes or mark them closed, mark the quote incomplete, and fix the campuses |
| A13-13 | A13 | Low | packages/catalogue/src/data/colleges/gauteng.ts:473 (Central JHB) | CJC lists "COSMETOLOGY: Alexandra" under "(NC)/V COURSES" as well as NATED. The data has it only as an N4–N6 OTHER | Open | A person adds the NC(V) record, or notes why it's left out |
| A13-14 | A13 | Low | packages/catalogue/src/data/colleges/fs-nc-nw.ts:1368, 1448 (Orbit) | `nameAtCollege` is edited text, not the college's wording ("… (also a Programming & Robotics variant)", "Engineering N4/N5/N6 (Electrical & Mechanical) - Electrical"). The NC(V) quotes aren't marked `entryQuoteIncomplete` although the page adds "All entry applicants must adhere to placement assessment criteria" | Open | Use the printed names; mark the quotes incomplete, so the verdict becomes "check the entry rule" |
| A13-15 | A13 | Low | packages/catalogue/src/data/colleges/eastern-cape.ts:123 (King Sabata Dalindyebo) | Table 10.10 (the record's `sourceUrl`) prints "King Sabata Dalindyebo TVET" without "College", and there is no `otherDhetNames` entry. The registration check therefore answers "not found" for DHET's own spelling (a false no, never a false yes) | Open | Add the table's spelling to `otherDhetNames` |
| A13-16 | A13 | Low | packages/catalogue/src/data/ukzn-assessment.ts:714 (MGNT102) | Named "Management 120". The source prints "Management 120 (offered at Howard College for pipeline students only)", so the restriction is dropped | Open | Keep the restriction (a note or `otherRules`) |
| A13-17 | A13 | Low | packages/catalogue/src/data/uct-assessment.ts:315-322 (CSC1015F) | The exam component is "June examination", but the record also covers CSC1015S through `alternativeCodes`. An S-course learner is told "June" for an exam that is in November | Open | Rename the component to the handbook's neutral term, or split the S record |
| A13-18 | A13 | Low | packages/catalogue/src/data/open-books.ts:568-574 | The book match targets PSY1004F, from the FHS errata table (which lists both codes; the strike-through is lost in the extracted text). The 2026 Humanities handbook prints "PSY1009F (previously PSY1004F)", and the assessment record uses PSY1009F, so a PSY1009F learner gets no module-level book match | Open | Match PSY1009F (keep PSY1004F as an alternative) |
| COL-01 | A13 | Medium | packages/catalogue/src/data/colleges/register.ts:36-82 | **Stands.** Neither circular is on dhet.gov.za. I searched: the TVET Colleges page (no circulars section), the Registers page, `dhetwebapps.dhet.gov.za/TECHNICA` (only TC 0043–0069), and web searches for "TC 0153", "TC 0132", "TC 0134". The only DHET-side mention is the Minister's media briefing (already in `supportingUrls`): it names "Circular TC 0134(b)" without dates. A second college copy of TC 0134(B) exists at https://www.swgc.co.za/wp-content/uploads/2025/10/TC-0134-B.pdf (200) | Open | A person checks with DHET. Add SWGC's copy as a second host |
| COL-02 | A13 | Medium | packages/catalogue/src/data/colleges (5 colleges) | **Narrowed.** Umgungundlovu is now usable: https://www.utvet.co.za/ (200, about 21 MB) prints "2027 COURSE LISTINGS" per campus (e.g. "NCV: Civil Engineering Level 2 Minimum entry requirement: Grade 9"), but its own menu says "NC(V) (No New Intakes for 2027)": a contradiction a person must settle. Still unusable: Lovedale (a placeholder site), Taletso (TLS certificate error), Lephalale (HTTPS 301 to HTTP, then 503). Motheo still prints no programmes, and its prospectus PDF `docs/PROSPECTUS-CONTENT-2024.pdf` returns 404 | Open | A person fills Umgungundlovu (after asking about the NC(V) intake) and contacts the other four |

Info (no row):
- **I1.** UCT's 2027 planner prints "January Supp Exams 11 - 15 January" 2027, for 2026's second-semester courses. No calendar record holds them. That is correct for a 2027 record, but the 2026 calendar doesn't hold them either.
- **I2.** `WITS_SCIENCE` in open-books.ts:510 points to `HSCi_eBook.pdf` (the Health Sciences book). The citation is right; only the constant's name is misleading.
- **I3.** UCT MAM1020S has its own handbook entry, but the MAM1020F record has no alternative code for it.
- **I4.** Siyavula's "Free to read online, no account" couldn't be confirmed by a fetch tool (sign-up and log-in links are shown). A person checks in a browser.

## Structure: holds

- **Phase 6a:** every record has `sourceUrl` (on its university's own domain, `onOwnSite`) and `academicYear`. Every module scheme is `academicYear` 2026, cited to a 2026 handbook. Every weighting adds up to 100 (`weightingProblems` refuses any that doesn't, so a scheme printed as "33.3% … 66.6%" has no weighting). No `verifiedOn`/`verifiedBy` appears anywhere in the six assessment files, `open-books.ts` or `book-links.ts`: grep finds only comments.
- **Colleges:**
  - **Counts:** 50 colleges and 791 programmes (428 NC(V), 363 N4–N6, 14 OTHER).
  - **Provenance:** every college, site and programme record has `sourceUrl` and `academicYear`; no verification fields.
  - **Integrity:** no duplicate ids, and no programme points at a missing college.
  - **Against DHET's list:** all 50 colleges are present exactly once, each in the right province (EC 8, FS 4, GP 8, KZN 9, LP 7, MP 3, NW 3, NC 2, WC 6).
  - **Levels:** the schema has no level field, so no level check could run. No `N0` or `N7+` appears; NC(V) "Level 1" hits are all "NQF Level 1" inside entry quotes.
  - **Entry quotes:** 156 are null and 200 are flagged incomplete; none is nonsensical.

## Sample: what matched

- **Module schemes (40, all matched every recorded field):**
  - UCT Commerce: ACC1006F, ACC1015F, INF1002F, STA1000S, BUS1003H, CSC1015F.
  - UCT EBE: MAM1020F, PHY1012F, GEO1008F, APG1023S.
  - UCT FHS: HUB1022F, CEM1011F, PHY1025F, HUB1019F, AHS1034S.
  - UCT Humanities: PSY1009F, SOC1001F (its conflict note is correct), SWK1013F.
  - UKZN CAES: COMP100, MATH130, CHEM181, ENME1DR, ECON101, ENAG1DE, BIOL195.
  - UKZN CLMS: ACCT101, ECON101 (its 50/50 "DP Requirement: None" scheme really differs from CAES's), MATH130 (DP 35% against CAES's 40%: the faculty split is right), MGNT102 (but see A13-16), ACLE101, LAWS1IC.
  - UKZN CHS: CMED1BF, SHSC1HI, PHRM141, NURS115, PHYS131.
  - UKZN COH: CFSD101, SOWK112, ELDV001, POLS101.
  - Page citations I checked are right (e.g. ACC1006F p.139, MATH130 p.427, BUS1003H p.186).
- **Calendars (all 5, every date):**
  - Wits 2027: exams 31 May–28 June and 1–26 November.
  - TUT 2027: all 10 dates, including the supplementaries and predicate days; "Last update: 15 April 2026".
  - UCT 2027 DRAFT planner: exams 19 May–7 Jun and 20 Oct–8 Nov; supplementaries 28 Jun–2 Jul and 22–26 Nov.
  - UKZN 2026 (CAES handbook sessional dates) and UKZN 2027 (registrar page, read through a fetch summariser as the record notes): all dates match.
- **Rules records (9 of 14):**
  - **UCT:** general (G26.1, G20.1, G22.3, GB11), Commerce (45–49, FBA14 40–44), EBE and Humanities (F18.1).
  - **UKZN general:** GR27 50%, BR6 40%, GR22, GR23.
  - **TUT general:** 4.1.12.1, 4.1.3.6, 4.1.12.2, 4.1.14.3, 4.1.12.7, 4.1.12.4.
  - **Wits:** general (G7.10, G13.3, G13.5, G13.6.1), Science and Health Sciences.
  - Every quote is as printed.
- **Free books (20):**
  - **OpenStax (16), against OpenStax's own API:**
    - All 16 are live and licensed `cc-by-nc-sa-4.0` (CC BY would be wrong for these editions).
    - Titles, ISBNs and senior authors match. The 6 details pages I tried return 200.
  - **Siyavula Maths and Physical Sciences Gr 12:** CC BY 3.0, as recorded.
  - **OpenUCT:** INTROSTAT is CC BY-NC-SA 4.0 (handle 11427/4150); Complex Numbers is CC BY 4.0. Both match.
  - **Links:** every link is on the publisher's own host, behind the allow-list and the piracy deny-list (book-links.ts:61, 78). Every match source resolves.
- **Colleges (14):**
  - Exact matches: Boland, Northlink, Buffalo City, Port Elizabeth, Flavius Mareka, Elangeni, Majuba, Capricorn, Ehlanzeni.
  - Orbit's programmes and quotes match (see A13-14); Central JHB matches apart from A13-13.
  - Majuba rightly leaves out "Introductory Business Studies" (TC 0134(B) note 5).
  - Northern Cape Rural: A13-12. Motheo: COL-02.
- **The circulars:**
  - **TC 0153** (Sedibeng's notice of 06 July 2026, with DHET's circular attached as pp. 3–4): number, date "01 JULY 2026", title, the 6 programmes, `noFirstIntakeFrom: 2027` and the quote all match.
  - **TC 0134(B)** (Sedibeng's copy): number, date "15 OCTOBER 2025" and title (including the printed "EXTENTION") match.
    - The schedule's "First / Repeating / Last date of National Examination" columns are for the last cohort, so `noFirstIntakeFrom: 2027` with `programmes: null` is consistent.
    - Not held, and nothing needs them: note 1 (the extension isn't compulsory) and note 5 (no new N4 Introductory Certificate from January 2026). TC 0153's Level 2/3/4 last-exam schedule is not held either.
  - Both `supportingUrls` (Gazette 54858; the Minister's briefing) return 200.
- **The registration check's source:** DHET Stats 2024 Table 10.10 (200) and the 2020 contacts list (200) are both live. DHET publishes no register of public colleges (DocRegisters lists private institutions only), so "DHET's list" is the honest wording. The abbreviation false yes is filed as A1-87 in PHASE-6-A1.md.

## How drafts reach anyone

- **Production:** refuses `UF_CATALOGUE_PREVIEW=1`. `apps/web/lib/server/config.ts` (around line 1011) throws "Unverified catalogue data is never shown in production". `resolveScheme`, `freeBooksView`, `collegeOptions` and the module card each mark drafts per record (`draft`). So no draft reaches a learner as fact.
- **The public judge demo:** docs/deploy/demo.md:317 sets `UF_CATALOGUE_PREVIEW=1`, and demo builds are not "production" (config.ts around line 958). So the draft schemes, books, colleges and the registration check are public there, labelled as preview. That is the owner's demo decision, not a new defect. It is the one route by which these drafts reach the public, including A13-12 and A1-87. I didn't check the live environment (I read no `.env`).
- **The chat page:** the preview banner is hidden there, and a line under the message box stands in for it (`app/(app)/layout.tsx:42-45`).

## Not measured

- UJ's and UP's rules (HTTP 403 to automated fetches): a person in a browser.
- The other 99 module schemes, 5 rules records and 36 colleges. The sample is 29% of schemes, 64% of rules records and 28% of colleges. Phase 6 schemes are not "programme records", so A13's 20% rule applies only loosely; every calendar date was checked.
- A hand re-derivation of a score per university (A13 check 2): Phase 6 changed no score method.
- Freshness of `verifiedOn` (A13 check 4): nothing is verified.
- The UKZN 2027 sessional dates were read through a summariser, not the raw page. A person confirms them.
