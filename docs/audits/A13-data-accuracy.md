# A13: Data accuracy

*Called A9 in planning.md v0.3; renumbered because the suite's A9 is the per-PR security
review (see [README](README.md)).*

**Runs at:** phases 1 and 3, and **before every admissions season** (February to April, when
the next intake's prospectuses appear). The "Owed checks" PR comment flags catalogue and score
method changes.

**Report only.** Write the result to `docs/audits/results/PHASE-<n>-A13.md` and add findings
to `status.md` → Open findings as `A13-NN`.

## What it proves

That what a learner is told about admission is what the university says. It is an independent
re-check of the owner's verification pass, not a replacement for it (hard rule 3: only a person
verifies).

## Checks

1. **Sample.** At least 20% of programme records, chosen across all six universities and all
   faculties, plus every application window, every fee and every helpline. Open each
   `sourceUrl`; compare every field. A mismatch on a verified record is **High**; a wrong
   minimum score or subject requirement on a verified record is **Critical**.
2. **Score methods.** For each university, re-derive one learner's score by hand from the
   prospectus and compare with `packages/admissions`. Every method keeps a worked-example test.
3. **Year.** Every record's `academicYear` matches the intake the current cohort applies for.
   Records for an earlier intake are stale and must not reach a learner as current.
4. **Freshness.** `verifiedOn` within the season; helplines within three months.
5. **The open questions** in `docs/data-verification.md` are settled, or the records they affect
   are still drafts.
