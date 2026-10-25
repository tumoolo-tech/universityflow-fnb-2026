# Verification kit: the owner's pass over the catalogue

Hard rule 3: no catalogue record reaches a learner until a **person** has checked it against its
official source and added `verifiedOn` and `verifiedBy`. Every record in
`packages/catalogue/src/data/` is a **draft** researched on 2026-10-13 for the **2027 intake**.
This kit makes that pass fast; it verifies nothing by itself. Nothing in this folder, and no
agent, has added `verifiedOn` or `verifiedBy` anywhere. Only you can.

## What is in this folder

| File | What it is | Hand-written or generated |
|---|---|---|
| [open-questions.md](open-questions.md) | The 21 questions research couldn't settle, each with fresh evidence from the institution's own site, a **draft** resolution, a confidence level and a box for your decision | Hand-written (research, 2026-10-13) |
| [proposed-corrections.md](proposed-corrections.md) | Values fresh research suggests are **wrong**, each as a patch for you to approve. Nothing has been changed in the data | Hand-written |
| [wits.md](wits.md) · [uj.md](uj.md) · [up.md](up.md) · [uct.md](uct.md) · [tut.md](tut.md) · [ukzn.md](ukzn.md) | One table per record: every field, the value the data holds today, a column for what the source says, a box | **Generated** |
| [nsfas.md](nsfas.md) · [helplines.md](helplines.md) | The same for NSFAS and the crisis helplines | **Generated** |
| [exam-timetable.md](exam-timetable.md) | The same for every NSC exam paper (Phase 4b), in the order they are written | **Generated** |
| [practice.md](practice.md) | The same for every free practice link and open textbook (Siyavula, Phase 4e) | **Generated** |
| [free-books.md](free-books.md) | The same for every open book, curated book match and library search (Phase 6d, D5–D7) | **Generated** |

The generated files come from `pnpm verification:checklists`, which **reads** the catalogue and
writes only into this folder. `pnpm check:test` fails if they fall behind the data, and proves
every record in the catalogue appears in them exactly once, so a new record can't be missed.

## Time

About **159 records**: 86 programmes, 6 universities, 6 application windows, 8 score methods,
NSFAS, 7 helplines and 45 NSC exam papers. Budget **two sittings of about four hours**:

| Sitting | Work | Time |
|---|---|---|
| 1 | Open questions (1), score methods (2), Wits, UJ, UP (3) | ~4 h |
| 2 | UCT, TUT, UKZN (3), windows and fees (4), NSFAS (5), helplines (6), commit (7) | ~4 h |

A programme takes 2–4 minutes once its prospectus is open at the right page; most of the time
goes on finding pages. Keep each university's prospectus open in one tab for its whole section.

## Order of work

Work in this order. Each step depends on the ones before it.

1. **Settle the open questions** ([open-questions.md](open-questions.md)). Each affects records
   later on; the checklists flag them with "Settle first". Tick **accept** or write the change.
2. **Score methods** (top of each university file). A wrong method mis-scores every programme
   at that university. Check the rule text against the prospectus, then run
   `pnpm --filter @universityflow/admissions test`: the worked examples UJ (p.16) and UKZN (p.17)
   print are tests, and must still pass.
3. **Per university**: the university record, then every programme. Verify the **university
   record before its programmes**: `catalogueView` hides a programme or window whose university
   isn't verified, so a verified programme at an unverified university still shows nothing.
4. **Windows and fees** (in each university file, after the university record). Dates are the
   most time-sensitive facts; check opening, closing, every earlier closing and the fee.
5. **NSFAS** ([nsfas.md](nsfas.md)).
6. **Helplines** ([helplines.md](helplines.md)). On the organisation's **own** site only. Dial-test
   if you can.
7. **Exam timetable** ([exam-timetable.md](exam-timetable.md)), against the Department of Basic
   Education's own timetable (about a minute a paper). The papers are written with a helper,
   `paper(...)`: verify one as
   `{ ...paper('mathematics', 1, '2026-10-23', 'morning', 180), verifiedOn: '…', verifiedBy: '…' }`,
   never inside the helper or `SOURCE`. The 2027 timetable isn't published yet ([Q19](open-questions.md#q19)).
8. **Free practice** ([practice.md](practice.md)), on siyavula.com: open each link and check it is
   still free for learners ([Q22](open-questions.md#q22)). The textbooks are written with a helper,
   `textbook(...)`: verify one as `{ ...textbook(...), verifiedOn: '…', verifiedBy: '…' }`.
9. **Free books** ([free-books.md](free-books.md)), Phase 6d: open each book on its publisher’s
   own site (OpenStax, Siyavula, a university’s open repository: the allow-list, D5) and check the
   licence, authors, edition and ISBNs; agree or reject each curated match (D6); try each library
   search pattern with a real ISBN and title (D7). OpenStax books are written with a helper,
   `openstax(...)`: verify one as `{ ...openstax(...), verifiedOn: '…', verifiedBy: '…' }`; matches
   with `similar(...)` the same way. A match shows only once its book is verified too.
10. **Commit** (see Committing, below).

## How to check one record

1. Open the record's `sourceUrl` (in the checklist) in a browser. If it doesn't open, or opens
   something else, stop: the record can't be verified until its source can be.
2. Compare each row. Mark the last column **☑** if it matches the source, **☒** if it doesn't.
   For ☒, write what the source says in the third column and add a line to
   [proposed-corrections.md](proposed-corrections.md).
3. For `selection` text: anything in quotation marks must be the source's exact words; the rest
   must be a fair summary.
4. When every row is ☑, record the verification (below).

## How to record a verification (the exact edit)

Add two fields to **that record's own object**, in the data file the checklist names
(`Edit at packages/catalogue/src/data/wits.ts:61`):

```ts
  {
    ...base,
    sourceUrl: COURSE('science/computer-science'),
    id: 'wits-bsc-computer-science',
    // ...every other field unchanged...
    verifiedOn: '2026-10-20', // the date you checked it, YYYY-MM-DD, never a future date
    verifiedBy: 'Your Name', // a person, not a process
  },
```

- **Never** put `verifiedOn`/`verifiedBy` in a shared spread (`base`, `SOURCE`, `SOURCE_YEAR`):
  that marks every record using it as verified, including ones you haven't opened.
- **Score methods** live in `packages/admissions/src/universities/methods.ts`; add the two fields
  inside that method's `source: { ... }`. Careful: `UKZN_SOURCE` and `UCT_SOURCE` are shared by
  two methods each. Give each method its own object (`source: { ...UKZN_SOURCE, verifiedOn,
  verifiedBy }`) rather than editing the shared constant.
- **A programme reaches learners only when its score method is verified too.** A verified record
  scored by a draft method stays hidden in production and is labelled a draft in preview
  (`packages/admissions/src/results.ts`). So verify each university's method with its programmes,
  or none of them will show.
- Then run `pnpm verification:checklists` (the record's Status row changes) and
  `pnpm --filter @universityflow/catalogue test`.
- **Expected test failures after the first verification.** `packages/catalogue/src/catalogue.test.ts`
  asserts that *every* record is a draft and that a production view is empty. Those two tests
  describe the pre-verification state; update them to assert what you verified (for example,
  the verified university and its programmes now appear without `includeDrafts`).

## When a source disagrees with the data

- **The source wins.** Change the value in the data file first, then verify it. Record the old and
  new values in [proposed-corrections.md](proposed-corrections.md) (tick "approved").
- **Two official sources disagree** (prospectus vs course page, April vs June edition): use the
  **newest dated** document from the university's own domain; quote the other in the record's
  `selection` only if a learner could be misled. If you can't tell which is newer, phone or email
  the admissions office and leave the record a draft until they answer. Write down who said what.
- **A table and a sentence disagree in one document** (UKZN's 8-point rule): treat it as an open
  question; ask the university. Don't verify on your own reading.
- **The source has moved or changed format**: update `sourceUrl` to the new official address and
  re-check every field: it's a new source.
- **A value isn't published at all**: leave it `null` (the schema allows it where that's
  possible) and say so in `selection` or `feeNote`. Never fill a gap from a third-party site.
- **Can't reach a site** (UP's www.up.ac.za refuses automated tools; nsfas.org.za's certificate
  fails for some clients): open it in an ordinary browser. If it still fails, the record stays a
  draft.

## Re-check schedule

| What | When | Why |
|---|---|---|
| Every programme, window and score method | **February to April 2027**, as each university publishes its **2028-intake** prospectus | All data here is for the 2027 intake. The first cohort applies in 2027 for 2028. Re-verifying means updating `academicYear: 2028`, the `sourceUrl`, every changed value, and a new `verifiedOn` |
| Application windows and fees | Again in **March 2027**, just before applications open | Dates move between prospectus editions |
| NSFAS | When NSFAS opens its 2028 cycle (it opened on 18 September for 2027) and when it publishes new bursary guidelines | Thresholds and the N+ rule are set yearly |
| **Helplines** | **Every three months** (next: January 2027), and before launch | A wrong crisis number is the worst error this product could make |
| UJ | As soon as possible: the 25 June 2026 revision (open question 2) | The drafts are from the April edition |

## Committing

Use a branch `phase-1/verify-<university>` and a Conventional Commit, e.g.
`feat(catalogue): verify Wits records against the 2027 course finder`. Run `pnpm verify` before
pushing. Never commit a downloaded prospectus or anything about a real learner.
