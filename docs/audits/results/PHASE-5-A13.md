# PHASE-5 — A13 Data accuracy

**Project:** UniversityFlow · **Phase:** 5 · **Date:** 2026-10-17
**Commit:** 0554343 (`phase-5/stack` integration trial) · **Audit source:** docs/audits/A13-data-accuracy.md @ 0554343
**Result:** ✅ PASS (no Critical or High). 4 Medium, 3 Low, 3 Info (10 findings). Every phone number, date, code and credit I sampled matches its cited source. The findings are about values that are *read into* a source rather than printed in it, and about two code paths that ignore the year a record is for.

Scope: Phase 5's new draft catalogue records (`packages/catalogue/src/data/*-orientation.ts`, `*-curricula.ts`), compared field by field with their own `sourceUrl`. I fetched each source from the university's own site and extracted the text locally (pypdf in layout mode for the PDFs); I used no search snippets or third-party copies. I also checked the code paths that decide what a learner sees: `catalogueViewOf` (`catalogue.ts:188-222`), `safetyPlacesOn`, `campusTour`, `firstWeek` and `campusSafetyLines` (`packages/agent/src/campus.ts`), `myModules` (`packages/agent/src/modules.ts`), `compareRegistration` and `changeDeadlinesFor` (`packages/admissions`). This is the first A13 run against Phase 5 data, and there is no PHASE-4-A13 to compare with. I report only. I added no `verifiedOn` or `verifiedBy` and changed no product code.

## Executive summary

The research is careful. I checked every safety number in the sample digit by digit: Wits security (4444, 1842, 3340, 2222), clinics (9111, 3294) and CCDU (9140, 3269); UP SHS (2500, 5233, 319 3051), SCU (2333, 6240, 319 3054) and the OMC (2310). TUT's six H&W campus numbers and 0800 68 78 88 match, as do UKZN's five RMS control-room pairs and the CoH and CLMS counselling lines, and UCT's CPS 021 650 2222 and SWS 021 650 1017. Every one matches the cited page or PDF as printed. Where two official sources disagree (Wits West security, UKZN Howard RMS, UP Groenkloof clinic), the record says so in its `note`.

I checked the registration calendars line by line for TUT 2027, UP 2027, UKZN 2027 and UCT 2026, including the weekdays UKZN prints. All the dates match. In the six curricula I checked module by module, every code, credit, term and printed total matches: Wits BCom CBA00, MBBCh MFA00 and BPharm MFA04 (with the BA letter's terms); TUT DPIT20 and DPRS20; UKZN BCom Accounting and BPharm; UCT MBChB and BCom CA.

The gates hold. I proved them with a probe:
- Outside preview, no Phase 5 record is shown.
- In preview, no safety place is shown: the view, the campus tour and the crisis card all hold.
- A programme with no curriculum gets `status: 'no-curriculum'`, with no differences, no credits and no message.

What needs attention:
- **The first-week checklist shows the newest calendar the catalogue holds, whatever year the learner arrives in (A13-02).** UCT's only calendar is for 2026, and the first cohort arrives in 2028.
- **Two Wits elective groups accept a registration the rule book doesn't allow (A13-05).** These are "one pair or the other" choices, which the schema can't express.
- **Three values were read into a source, not printed by it:**
  - UKZN's registration "window" closes on 6 Feb, but UKZN prints 12 Feb as the registration deadline (A13-03).
  - Two UCT SWS service points are recorded as clinics, but the source doesn't call them clinics (A13-04).
  - TUT's counselling line is filed as a place on two campuses (A13-06).

## Findings

| ID | Severity | Location | Finding | Why it matters | Fix | Test |
|---|---|---|---|---|---|---|
| A13-02 | Medium | `packages/agent/src/campus.ts:147` (`registrationCalendarFor(view, universityId)`), `packages/catalogue/src/catalogue.ts:295-300` (`newest`) | `firstWeek` shows the newest registration calendar the view holds, with no check against the year the learner arrives. `changeDeadlinesFor` refuses a calendar for another year (`registration-deadlines.ts:92`), but the checklist doesn't. **Proven** (probe): UCT's calendar verified as printed, `firstWeek(view,'uct','accepted-offer',[],null)` at 2027-01-10 returns `academicYear: 2026`, `registration.to: '2026-02-13'`, `draft: false`. It renders under "dates" (`apps/web/components/campus.tsx:210-240`, native `campus.tsx:189-200`) with no year warning. | The first cohort arrives in 2028. Every calendar held today is for 2026 (UCT) or 2027 (TUT, UP, UKZN). Once a person verifies these records, a learner sees last year's registration close and change deadlines in the "dates" section. Brief check 3 says that records for an earlier intake must not reach a learner as current. | Give `firstWeek` the intake year (the accepted offer's year, else the next intake) and use `registrationCalendarFor(view, id, year)`, which returns only that year's record. With none, show `t.noDates`. This is the same rule as the deadlines. | `firstWeek` with a verified calendar for 2026 and an accepted offer for 2027: expect `calendar: null`. It fails today. |
| A13-03 | Medium | `packages/catalogue/src/data/ukzn-orientation.ts:474-482` | `firstYearRegistration` is `{from:'2027-02-01', to:'2027-02-06'}`, taken from "Dedicated remote online registration week and orientation for First Time Entering Undergraduate (FTEN) students". The same sessional-dates page prints **"Fri, 12 Feb — Deadline for first semester academic registration"**, and the note doesn't mention it. The schema says this field is "the whole window, all faculties; maybe only its close" (`campus.ts:144`). The source also says "Schools to communicate dates for individual programmes … including FTEN students". | Once verified, the checklist tells a UKZN first-year that registration closes on 6 Feb, while UKZN's published deadline is 12 Feb. An early date is the safe direction, but it is still not what the source says, and the verifier isn't told about 12 Feb. | Set `to: '2027-02-12'`, or keep 6 Feb and say in the note that 12 Feb is the "Deadline for first semester academic registration", so the verifier decides. Data change only. | Not a code test: an "Owed checks" item for the verifier. |
| A13-04 | Medium | `packages/catalogue/src/data/uct-orientation.ts:200-221` (`uct-sws-steve-biko-building`, `uct-sws-groote-schuur-hospital`) | Both are recorded as `kind: 'clinic'`. The cited page (`uct.ac.za/dsa/sws-service-points`) lists them only as "SWS service points". SWS runs counselling, medical and pharmacy services, and the page doesn't say what each point offers. Only "Sports Centre Clinic" (temporarily closed) is called a clinic. Handbook 5 says therapists work "in the Ivan Toms building and satellite offices". The kind is inferred, and the notes don't flag it. | `clinic` is a safety kind. Once verified, the crisis card's campus lines (`campusSafetyLines`) and the "health" need on the campus tour would send a learner in distress to "Steve Biko Building, Level 6, Rooms 6.24" as a clinic. It may be a counselling room. | Ask the verifier to confirm what each service point offers before verifying, and say so in each record's `note`. If the source can't settle it, use a non-safety kind (`other`) or leave the place out. | Not a code test: data. |
| A13-05 | Medium | `packages/catalogue/src/data/wits-curricula.ts:279-286` (wits-bcom), `:321-328` (wits-bsw); `packages/catalogue/src/curriculum.ts:46-57` (`electiveGroupSchema`) | The rule books print "ECON1012A and ECON1014A **or** ECON1016A and ECON1018A" (CLM rule book, p. 54) and "either a) ANTH1006A and ANTH1007A or b) SASL1000A and SASL1001A". Both are recorded as "choose 36 credits from" all four modules. **Proven** (probe): `compareRegistration` over CBA00 with ECON1012A + ECON1018A returns no differences, and so does AFA04 with ANTH1006A + SASL1001A. The notes say "check", but verifying can't fix it, because the schema has no "one of these sets" group. UKZN's BEd Foundation Phase was held back for the same reason. | Once verified, My modules tells a learner with an invalid mixed registration "Your modules match the published first-year curriculum. Nothing to fix." That is a wrong fact from code (hard rule 2: code decides). | Either hold both records back until the schema can express alternatives (e.g. `choose: { oneOf: string[][] }`), as was done for the UKZN BEd, or add that group kind to `electiveGroupSchema`, `groupProblems` and `groupShortfall`. | `compareRegistration(CBA00, [... ECON1012A, ECON1018A ...])` expects an `elective-group-unsatisfied` difference. It fails today. |
| A13-06 | Low | `packages/catalogue/src/data/tut-orientation.ts:166-175, 243-253` (counselling), `:233-242` (`tut-soshanguve-south-clinic`) | TUT's "24 hour toll-free personal counselling telephone line" (0800 68 78 88, correct) is filed as a `counselling` *place* on Pretoria Campus and on Soshanguve South Campus, with `where` set to the campus name. The source gives no personal-counselling location; the only room it prints, Building 6, Room 361, is for career counselling, and the note says so. The Soshanguve H&W number is printed for "Soshanguve" and filed under South; the note says so. | The number is right, but the crisis card and tour would list "Student Development and Support, Pretoria Campus" as a place to go, and the source doesn't print one. The line serves all campuses. | Model the toll-free line as a helpline (TUT-specific, all campuses) rather than two campus places, or keep the places but have the verifier settle the location. | Not a code test: data. |
| A13-07 | Low | `packages/catalogue/src/data/wits-curricula.ts:33-35, 72, 302, 380-421` | Values that are inferred, not printed (the notes disclose all of them): (a) Wits totals are sums of the printed credits, since no Wits 2026 rule book prints a first-year total. The exceptions are the BA (the letter prints 144) and the BCom (the rule book prints "A total of 144 credits" for part-time). (b) The LLB range `{min:90,max:126}` is the researcher's construction. (c) Health Sciences S1/S2 come from which semester's timetable a code appears on: FAMH1003A and APES1000A appear only in the "1st SEMESTER" grid, and ANAT2005A only in the 2nd. I checked those placements against the timetable PDF and they are as the note says. | A sum or an inferred term can be wrong in a way verifying "against the source" won't catch, because the source doesn't state it. A wrong total gives `credits-short`/`credits-over`; a wrong term gives `wrong-semester`. | Have the verifier confirm each inferred total and term with the faculty office, or leave `semester` out where only a timetable implies it. Owner's call. | Not a code test. |
| A13-08 | Low | `packages/catalogue/src/data/up-orientation.ts:396-405` | The change deadlines are UP's "Last day of registration for Quarter 1, Quarter 2 and Semester 1" (19 Feb) and "…Quarter 3, Quarter 4 and Semester 2" (30 Jul). UP separately prints "Closing date: Amendments to or cancellation of modules (year, semester and quarter modules) after this date will affect fees and GPA" (8 Mar, 16 Aug). Reading "last day of registration" as "last day to add, drop or change" is an interpretation. The note quotes both dates. | It errs early, which is safe, but the reminder's "last day to change" is the researcher's reading, not UP's own words. | Verifier's call; note it in "Owed checks". | Not a code test. |
| A13-09 | Info | `packages/catalogue/src/data/wits-orientation.ts:480-488` | `witsRegistrationCalendars` is empty, and its comment says it is waiting for "`firstYearRegistration.from` is optional". That is already true (`campus.ts:131-139`), so the comment is stale. The Wits orientation and change dates the research found are not in the data. | Wits learners get "no dates" (honest), but the data is owed. | Add the Wits calendar (close-only if need be) or update the comment. | — |
| A13-10 | Info | `uct-orientation.ts:87-125, 397-411`; every `*-curricula.ts` | UCT's calendar and its three registration-venue places are for **2026**. Every curriculum is from a 2026 rule book. TUT, UP and UKZN calendars are for 2027. The first cohort enters in **2028** (CLAUDE.md, locked decisions). The registration venues' dates are in `note`, which `placeView` drops (`packages/agent/src/campus.ts:73-85`), so a 2026 venue with "09:00-15:00" hours would show without its date. | All of these are past intakes for the cohort. Curriculum year matching is already open as **A1-26** (not re-reported). The calendar side is A13-02. | Refresh to the 2028 intake before the cohort's offers arrive, and gate the venue places by year like the calendar. | — |
| A13-11 | Info | `packages/catalogue/src/data/ukzn-orientation.ts:105-425` | UKZN has no clinic record for Westville or Medical School, though `chs.ukzn.ac.za/campus-health-clinics/` lists Westville clinic numbers (031 260 7302, 7105). The Howard, PMB and Edgewood clinics have no phone, because the cited page gives none (the note names the CHS page's numbers). | Westville is a main campus. Its learners' crisis cards would have security but no clinic once verified. | Add the Westville clinic from the CHS page, and the clinic phones, citing that page. | — |

## Project-specific checks

### Sample: places (≥3 per university, every safety record digit by digit)

| Univ. | Records checked against source | Result |
|---|---|---|
| Wits | Security ×4 (security page: East 4444, West 1842, Education 3340, Health Sciences 2222, all with buildings); clinic ×2 (Student Guide 2026 p.57-58: 9111, "Students Union Building, lower Ground Floor of the Matrix", Mon–Fri 08:00–16:30; campushealth page: satellite 3294, Highfield House); CCDU ×2 (guide: 9140, CCDU Building; 3269, Marang Ground Floor Room 14; both Mon–Fri 08:00–16:30); DRU ×2 (9154, both addresses); Wartenweiler hours (raw table: Mon–Fri 08:00–17:00, Sat/Sun Closed); Main Dining Hall 1795; Transport 1754, Matrix Shop 20, 08:00–17:00 | All match |
| UP | InfoGuide 2026 pp. 6, 26–28, 49: SHS Hatfield (NS2 Room 4-11, Mon–Fri 08:00–15:30, 2500), Groenkloof (Letlotlo 2-10, Mon/Tue/Wed/Fri, 5233 and 3423), Prinshof (Tšwelopele 3-8, Tue–Fri, 319 3051/3052); SCU Hatfield (2333, Student Centre opposite TuksFM, 07:30–16:00), Groenkloof (6240, Letlotlo 1-28), Prinshof (319 3054, Tšwelopele 3-12); OMC 2310/2760, Administration Building (eastern entrance) | All match |
| TUT | General Information 2027 p.10, p.13-14: H&W eMalahleni 3122, Ga-Rankuwa 3820572, Mbombela 3691, Polokwane 0906, Pretoria 3826612, Soshanguve 3829184 (all as printed, spacing included); counselling 0800 68 78 88; Financial Aid Pretoria 4289, Soshanguve S 9272; Disability Coordinator 5072 (Course Information 2027) | All match (A13-06 on placement) |
| UKZN | RMS "Security Control Rooms": Edgewood 3462/3493, Howard 2540/2542, Medical 4516, PMB 033 5211/5231, Westville 7133/7265; clinic locations (CoH basics: "Opposite the main library", "House 5, Milner Road", "Dining Hall"); CoH SSS 2668/5233/3653 with locations; CLMS SSS +27 31 260 7337, three locations, 08h00–16h30 | All match |
| UCT | SWS service points (Ivan Toms, Steve Biko L6 6.24, Groote Schuur G26 21.6, Mon–Fri 08h30–16h30); Handbook 5 counselling 021 650-1017; CPS 021 650 2222/3, three service centres; SWS crisis line 021 650 1271 (note) | All match (A13-04 on kind) |

### Sample: faculty offices

Wits Science (TW Kambule Building, science.ug@, 6014 = "Office Administrator (Reception)"); Wits Health Sciences (2nd Floor Phillip V Tobias, 08:00–16:30, 2006); UP all seven Student Administration offices (InfoGuide p.7); TUT ICT (Building 7G Room 11) and Science (Building 1 Room G21, 6248); UKZN CoH (MTB G056, 031 260 1123); UCT Humanities (Room 110 Beattie, 2717, hours incl. Thu 09:30). All match.

### Registration calendars

| Univ. | Source | Result |
|---|---|---|
| Wits | none held (A13-09) | — |
| UP 2027 | 2027_MAINDATES.pdf | 30 Jan close, 1–5 Feb orientation, 19 Feb (Q1/Q2/S1), 30 Jul (Q3/Q4/S2): match. A13-08 on meaning |
| TUT 2027 | 2027-Academic-Core-Calendar.pdf (layout extraction) | 14–31 Jan online registration, 1–5 Feb newcomers' orientation, 28 Feb (S1), 6 Aug (S2): match |
| UKZN 2027 | registrar sessional-dates-2027 | 1–6 Feb FTEN week, 12 Feb and 30 Jul curriculum-change deadlines, weekdays correct: match. A13-03 on the close |
| UCT 2026 | students/registration and 2026 fees booklet | 19 Jan–13 Feb, 2–13 Feb orientation, 20 Feb (whole-year and S1 add), 31 Jul (S2): match. A13-10 on the year |

### Curricula, module by module

| Programme | Source | Codes · credits · terms · totals · groups |
|---|---|---|
| Wits BCom CBA00 | CLM rule book pp. 53-54 | All match. The group shape is wrong (A13-05) |
| Wits MBBCh MFA00 | HS rule book p. 42; 2026 first-year timetable | 72/18/28/26/0/0 = 144 (summed); FAMH1003A only in S1 grid, FAMH1002A only in S2 grid: match (A13-07) |
| Wits BPharm MFA04 | HS rule book p. 44; timetable | 18/36/18/36/18 = 126 (summed): match |
| Wits BA ABA00 (terms) | 2026 BA General letter | All 43 modules' terms and credits match; 144 printed |
| TUT DPIT20 | ICT prospectus p. 64 | 10/3/2 + six 15s + "(first- or second-semester module)" × 2; "TOTAL CREDITS FOR THE FIRST YEAR: 120": match |
| TUT DPRS20 | ICT prospectus p. 9 | All match, 120 printed |
| UKZN BCom Accounting BCOM-C | CLMS handbook pp. 85-86 | 10 modules × 16; ZULN101 or (BR(9)) ACLE101; "Total Credits Level One 160": match |
| UKZN BPharm B-PHAM | CHS handbook | All match; ZULN101/ZULM105 choice; 128 printed |
| UCT MBChB MB014 | FHS handbook 8A p. 49 | 15/15/30/35/18/18/18/18; "Total credits for year 1 … 167": match |
| UCT BCom CA CB001ACC04 | Commerce handbook 6A pp. 90-91 | All match incl. F/S codes; "Total credits per year 159": match |

### Code paths

| Check | Result |
|---|---|
| Drafts never shown outside preview | **Pass.** `catalogueView(…, {includeDrafts:false})` returns no Phase 5 campuses, places, offices, calendars or curricula (probe). `UF_CATALOGUE_PREVIEW=1` is refused in production (`apps/web/lib/server/config.ts:321`); the native app has no catalogue access of its own (it goes through the API). |
| Safety places verified-only, even in preview | **Pass.** `keepPlace` (`catalogue.ts:197`) uses `isPublishable` for clinic/counselling/security regardless of `includeDrafts`; `campusSafetyLines` filters `!isDraft` again. Probe: preview view, all five universities: no safety place in `places`, `placesOn`, the tour, or crisis lines. |
| No curriculum → no verdict | **Pass.** `myModules` → `status: 'no-curriculum'`, `differences: []`, `credits: null`, `message: null` (probe, a UP programme). |
| Year matching | **Fail in two paths.** Deadlines match the year (`registration-deadlines.ts:92`). The first-week calendar doesn't (A13-02), and nor does the curriculum (A1-26, already open). |

The probe was `packages/agent/src/a13-phase5.audit-tmp.test.ts`, run alone with `pnpm --filter @universityflow/agent exec vitest run` (7/7 passed, which confirmed the behaviour described above). It has been deleted.

## What I could not check

- **UJ:** there are no Phase 5 records (all four orientation arrays and the curricula are empty), so there was nothing to sample. I didn't try uj.ac.za.
- **up.ac.za (www):** it returned HTTP 403 (Cloudflare) on repeated requests, so I couldn't reach the yearbooks (UP curricula are empty because of this) or the faculty contact pages. One early request to `https://www.up.ac.za/maps`, the `mapUrl` of all four UP campuses, returned UP's own "Page not found" (404); later requests got 403. **Whether the maps link works is unconfirmed.** All the UP records I checked come from `drupalwebprod-files.up.ac.za` and `linus.up.ac.za`, which did respond.
- **Wits registration calendar:** none is held, so there was nothing to compare.
- **UCT Commerce handbook:** the download was cut off twice before it completed on resume; I extracted only the pages I needed.
- I didn't verify map image URLs, virtual tours or library pages beyond those listed above. I didn't compare the TUT 2026 prospectus totals for the other 13 TUT curricula, or the UKZN BSc CS 128 total (no printed total was checked).
- Freshness (brief check 4) doesn't apply yet: no Phase 5 record has `verifiedOn`.
