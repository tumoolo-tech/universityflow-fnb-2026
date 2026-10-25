# Catalogue data: verification checklist

Hard rule 3: every catalogue record has a source, an academic year, and a named person who
checked it against that source. Until `verifiedOn` and `verifiedBy` are filled in, a record is a
**draft** and `catalogueView` never shows it to a student.

All records in `packages/catalogue/src/data/` were **researched on 2026-10-13** from each
institution's own website and are drafts. They describe the **2027 intake** (applications made
during 2026). No university had published 2028-intake rules when they were researched, so the
first cohort (applying in 2027 for 2028) must be re-checked against the 2028 prospectuses as
they appear (usually February to April).

**Start with the kit: [verification/README.md](verification/README.md).** It has per-record
checklists generated from the data, fresh evidence and draft resolutions for the open questions
below, and proposed corrections for you to approve.

## How to verify a record

1. Open the record's `sourceUrl` in a browser.
2. Check every field against the source: minimum score, each subject level or percentage, the
   pass type, NBT, closing date, and that `selection` quotes the source faithfully.
3. Add `verifiedOn: 'YYYY-MM-DD'` and `verifiedBy: '<your name>'` to the record.
4. If anything differs, fix the record first, then add the verification.
5. For a score method (`packages/admissions/src/universities/methods.ts`), check the rule and
   re-run its worked-example test (`pnpm --filter @universityflow/admissions test`).

## Open questions research could not settle

Settle these before verifying the records they affect.

| # | Record | Question |
|---|---|---|
| 1 | UKZN APS | The 2027 prospectus (p.17) says "eight points to a subject with a performance level of 90-100%" and the maximum is 48, but the printed table stops at 80–100% = 7. The method awards 8. Confirm with UKZN |
| 2 | All UJ records | Researched from the **April 2026** prospectus; UJ published a revision on **25 June 2026** that research couldn't open. Re-check every UJ minimum against the revision |
| 3 | UJ BNursing | Physical Sciences 4 and Life Sciences 4 are printed in separate columns with no "or". The record requires both. Confirm |
| 4 | UJ BEng | The column reads "Mathematics / Technical Mathematics"; the record accepts both. Confirm |
| 5 | UJ English | UJ prints one "English" column; the record accepts Home or First Additional Language at the same level. Confirm |
| 6 | Wits APS bonus | +2 for English and Mathematics at 60%+. Does it apply to Mathematical Literacy or Technical Mathematics? The method says no |
| 7 | Wits maximum | Wits states none; the method uses 56, derived from the table |
| 8 | Wits window | Wits says applications open in "March" with no day; `opensOn` is null |
| 9 | Wits Health Sciences | Selection uses a Composite Index with the NBT, no published cut-off: `minimumScore` is null |
| 10 | UP APS | Quoted from the **2026** NSC/IEB prospectus (www.up.ac.za refused automated access). Confirm against the 2027 one |
| 11 | UP fee | Not confirmed (a search summary said R300, waived for household income ≤ R150,000). `feeZar` is null |
| 12 | UCT bands | The Civil Engineering Band C row was rebuilt from garbled PDF text (420 FPS, Maths 80%, PS 70%). Check prospectus p.36 |
| 13 | UCT Health Sciences | `minimumScore` is the school-results sub-minimum (450 MBChB, 360 Physiotherapy); selection adds NBT scores we can't compute |
| 14 | TUT APS | TUT states no maximum and no rule for more than six subjects. Level 1 earns 0 ("not considered") |
| 15 | TUT BEd Foundation Phase | "Home language offered in the programme": the record accepts any home language at level 5. Narrow it to the languages TUT offers |
| 16 | UKZN / CAO window | No official opening date; `opensOn` is null |
| 17 | NSFAS | The N+ rule is quoted from the 2026 Bursary Guidelines (no 2027 PDF found). nsfas.org.za's certificate failed automated checks: spot-check in a browser |
| 18 | Helplines | Higher Health's SMS line could not be confirmed on its own site and is left out. 10177 and 112 are confirmed only on a provincial (Western Cape) page. Check every number on the organisation's own site before release, and every three months after |
| 19 | NSC exam timetable 2027 | The first cohort writes its final NSC exams in October/November **2027**. On 2026-10-13 the Department of Basic Education had published only the 2027 *school calendar*, not the 2027 exam timetable. The catalogue holds the **2026** timetable only (for testing and for any Grade 12 learner this year); a Grade 11 learner is told the timetable isn't published. Add the 2027 papers when the DBE publishes them (2026's was approved on 23 January 2026) |
| 20 | Physical Sciences P2, 2 November 2026 | The DBE timetable (and its provincial copies) put Physical Sciences P2 on Monday 2 November at 09:00, but a Western Cape Education statement of 6 October 2026 says no exams are written from 2 to 5 November (local government elections, 4 November). No revised national timetable was found. The record carries a note shown to learners. Confirm with the DBE; Technical Sciences P2 and Religion Studies P1 (not in the data) are on the same day |
| 21 | Exam timetable source and coverage | The DBE's own copy (education.gov.za, Publications, item 9548) refused automated access, so every paper cites the KwaZulu-Natal Department of Education's republication of the DBE document, which the Eastern Cape's Assessment Instruction 19 of 2026 matches entry for entry. Open the DBE copy in a browser and consider citing it instead. Only 21 subjects are entered (the commonest); other languages, Technical Sciences, Religion Studies and the arts are not. Life Orientation has no final written paper (its Common Assessment Task was on 1 September 2026) |
| 22 | Siyavula practice links | 18 draft records (packages/catalogue/src/data/siyavula.ts), researched on siyavula.com only on 2026-10-13: Grade 10–12 Mathematics and Physical Sciences open textbooks (CC BY 3.0), Grade 10 Mathematical Literacy and Life Sciences (no Grade 11–12 book exists), Grade 10–12 CAT and IT (MTN-provided, closed copyright, free to read), free Practice and past papers for Mathematics and Physical Sciences (free account; Siyavula asks under-18s for guardian consent). Open each link and confirm it is still free. "Endorsed by the DBE" is Siyavula's own claim; the DBE lists the books as LTSM. See [verification/open-questions.md, Q22](verification/open-questions.md#q22) |