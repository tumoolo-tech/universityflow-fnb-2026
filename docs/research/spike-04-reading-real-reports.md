# Spike 4: Reading 10 real Grade 11 reports into confirmed marks

**Written:** 2026-10-13 · **Base commit:** `254550a` · **Planning:** §16.1 spike 4, §4.4, §12.1, §16.3, hard rule 6, D8

| | Verdict |
|---|---|
| **Stand-in** | **Holds for the flow** (upload → draft → learner confirms → only then results). **Proves nothing about reading**: the stand-in returns the same synthetic report for any file |
| **Real service** | **Not started.** `AnthropicReportReader` is written but has never read a real report and has no test of its own. Needs `ANTHROPIC_API_KEY` and 10 real reports, kept outside the repo |

## The question

Given photos (and some PDFs) of real Grade 11 reports from different schools, taken on ordinary
phones, does the reader return the subject table accurately enough that a learner can confirm
it quickly, and does every value reach a calculation only after the learner confirms it?

**Why it matters.** The report upload is the first thing the product does for a learner
(planning §3 Stage 1: "reads the report and shows the extracted marks back for the student to
confirm"). Planning §13 rates "Document reading fails on bad photos" as a Medium risk, mitigated
by confirmation and manual entry. D8 names this as the risk that "can only be proven with the
real API key". If reading is poor, the fallback (typing marks in) is fine for accuracy but
loses the product's first moment of help.

## Stand-in verdict: holds for the flow, says nothing about reading

What is built:

- **The reader interface.** `ReportReader` in [packages/documents/src/reader.ts](../../packages/documents/src/reader.ts),
  with `SampleReportReader` (the stand-in: returns `SAMPLE_REPORT`, a synthetic report, for any
  file, and says `isSample: true`) and `AnthropicReportReader` (Claude, structured output
  against `extractedReportSchema`; told to return `null` rather than guess, and not to return
  the learner's name, ID or school).
- **The draft.** `draftFromExtraction` and `resolveSubject` in
  [packages/documents/src/report.ts](../../packages/documents/src/report.ts): maps printed names
  ("Maths", "Eng FAL", "Wiskunde") to NSC subjects, flags `unknown-subject`, `missing-percent`,
  `duplicate`, `out-of-range`, and warns `partly-unreadable`, `not-grade-11`, `few-subjects`,
  `not-a-report`.
- **Confirmation before use (hard rule 6).** `confirmedMarksSchema`; the `ConfirmMarks`
  component shows every value read, the name as printed and each issue; `/api/reports` saves
  only confirmed marks, and `/api/results` calculates only from a confirmed report.
- **Uploads.** JPEG, PNG, WebP and PDF up to 10 MB, typed by magic bytes
  ([packages/documents/src/uploads.ts](../../packages/documents/src/uploads.ts)); direct-to-S3 in
  live mode with checks on arrival.
- **Manual entry** ("Type in your marks") is always available.

What the tests prove:

| File | Tests |
|---|---|
| `packages/documents/src/report.test.ts` | `resolveSubject (subject names as schools print them)` (table of spellings), `leaves a language without a level unresolved: only the learner knows which they take`, `leaves nonsense unresolved`, `normalises accents, case and punctuation`. `draftFromExtraction`: `maps the sample report to subjects with no issues`, `flags every problem a learner must fix before confirming`, `warns when the document is not a report`. `confirmedMarksSchema (hard rule 6: only confirmed values are used)`: `accepts a clean set` and the rejection table. `SampleReportReader (the local stand-in)`: `says it is a sample and returns a fresh copy each time`. `uploads`: `decides the type from the bytes`, `refuses empty, oversized and unsupported files` |
| `apps/web/test/api.test.ts` | `Stage 1: report → confirmed marks → results`: `reads an upload into a draft that is not used until confirmed` (after the upload, `/api/results` is `{ report: null, results: null }`; only after confirming are results calculated), `refuses a file that is not an image or PDF`, `refuses invalid or duplicate marks` |
| `apps/web/test/api-direct-uploads.test.ts` | `reads a file posted straight to storage into a draft, kept at a key no ticket can write`, `runs the magic-byte checks on what arrived, and deletes a file that fails them`, `refuses a minor before a guardian consents (hard rule 5)` |
| `apps/web/test/components.test.tsx` | `ConfirmMarks (hard rule 6)`: `shows every value read for checking, and refuses to save a duplicate subject`, `gives every field a label` |
| `apps/web/e2e/journey.spec.ts` | `an adult learner goes from sign-in to an application pack` types marks in by hand and confirms them ("These marks are correct") before results appear. It does **not** upload a file |

Commands run on 2026-10-13 (this branch):

```text
pnpm --filter @universityflow/documents exec vitest run src/report.test.ts
  Test Files  1 passed (1) · Tests  43 passed (43)
pnpm --filter @universityflow/documents test
  Test Files  5 passed (5) · Tests  86 passed | 10 skipped (96)   (10 = the real-S3 suite, needs TEST_S3_ENDPOINT)
pnpm --filter @universityflow/web exec vitest run test/api.test.ts -t "the chat|sign-in|Stage 1"
  Tests  10 passed | 11 skipped (21)
pnpm --filter @universityflow/web exec vitest run test/components.test.tsx
  Tests  5 passed (5)
```

**So:** the confirm-before-use design holds, and the draft flags the problems a bad read would
produce. **Reading itself is not proven at all**: `AnthropicReportReader` has no test (not even
with a mocked client; no test file imports it), and no real or realistic report has been read.
The "document-reading tests" library planning §12.1 calls for does not exist yet.

## Real-service verdict: not started

**Needed:** `ANTHROPIC_API_KEY` (and `ANTHROPIC_MODEL`, default `claude-opus-5`); 10 real Grade
11 reports.

### The 10 reports: rules

- **Kept outside the repo**, in a folder on the owner's machine that is not under
  `UniversityFlow/` (for example `%USERPROFILE%\uf-spike-reports\`). The `**/real-samples/`
  rule in `.gitignore` is a backstop, not the plan. **Never committed, never attached to a PR,
  never pasted into an issue, a log or this file.**
- **Consent first.** Each report belongs to a real learner, most of them minors (hard rule 5).
  Use reports only with the written agreement of the learner and, for a minor, a guardian, that
  the report is sent to the AI provider for this test (a cross-border transfer, planning §16.3
  and §8.1). Cover the learner's name, ID number and the school's name on the photo before
  upload: the reader is told not to return them, but the image still reaches the provider.
- **Spread:** at least 6 different schools, both public and independent if possible; at least
  7 phone photos (some at an angle, some in poor light, one with a fold or shadow) and up to 3
  PDFs; at least one with Afrikaans subject names and one with a language whose level isn't
  printed.
- **Ground truth by hand:** before running the reader, the owner types each report's subject
  rows (name as printed, percent) into a sheet kept with the photos, outside the repo.
- **Delete** the photos and the sheet when the spike is written up; only counts go into this file.

### Steps at integration

1. Before the key: add a unit test for `AnthropicReportReader` with a fake client (an image
   and a PDF go out as the right content blocks; a refusal or empty `parsed_output` throws
   `ReaderUnavailableError`). Cheap, no money spent.
2. Run the app locally with the key: `ANTHROPIC_API_KEY=… pnpm --filter @universityflow/web dev`.
   Sign in as a synthetic adult test account (the learner whose report it is never signs in).
3. For each report: Documents → upload → read the draft on the confirm screen. **Do not press
   "These marks are correct" until every row has been compared with the ground truth**, then
   correct any wrong row and confirm. Record per report: rows on the report, rows returned, rows
   exactly right, rows wrong, rows flagged by the draft (null / unknown / out of range), any
   row invented, and whether a name, ID or school appeared anywhere in the output.
4. Repeat 3 on a phone, on the deployed preview, for at least 3 of the photos (camera upload
   path, direct-to-S3).
5. Delete the account (About me → delete), which also deletes the stored files.

### Pass criteria (proposed; the owner confirms)

- **No invented values:** zero rows that aren't on the report, and zero percentages returned
  for a mark that is unreadable (it must come back `null` and be flagged).
- **Accuracy:** at least **95% of subject rows exactly right** across the 10 (subject resolved
  correctly and percent equal), and **every wrong row is either flagged by the draft or obvious
  on the confirm screen** next to its name as printed.
- **No personal details** in any output.
- **Confirm-before-use holds with real files:** results stay empty until confirmation, every
  time (already tested with the stand-in; check it once more live).
- **Time:** the draft appears within **20 s** of upload on mobile data.

If accuracy is below 95% but nothing is invented and errors are flagged, the flow is still safe
(hard rule 6): record it as a quality problem for prompt or model work, not a failure of the
design.

## Risks and fallback

- **Image size.** Uploads allow images up to 10 MB, and `AnthropicReportReader` sends the bytes
  as they are, with no downscaling. The API has its own per-image size and dimension limits
  (check the current numbers); a large phone photo may be rejected and the learner would see the
  reader as unavailable. Test with full-resolution photos in step 3; the likely fix is resizing
  before the call.
- **Phone formats.** HEIC isn't an accepted type. Most browsers convert iPhone photos to JPEG on
  upload, but check on an iPhone in step 4.
- **Schools print reports differently** (levels only, symbols, term columns). The instructions
  say not to convert levels or symbols; such reports should come back flagged, not guessed.
- **If the spike fails** (invented values, or accuracy far below the bar): swap the model or
  the reader behind `ReportReader`; the draft, the confirm screen and manual entry don't change.
  The worst case is the planning §13 mitigation already shipped: the learner types marks in.
