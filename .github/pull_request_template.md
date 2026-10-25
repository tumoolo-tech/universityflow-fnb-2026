## What and why

<!-- One paragraph. Link the phase (planning.md §11) and any finding it closes. -->

## How it was made

- [ ] Written by a person
- [ ] Written with a coding agent. A person has read every line of the diff, not just the summary

## Hard rules this touches

<!-- Tick only what applies. "Owed checks" (a bot comment on this PR) lists what the diff obliges. -->

- [ ] **2 · 3** Admission facts come only from `catalogue`/`admissions`. No record gained `verifiedOn`/`verifiedBy` except from a person who checked the source
- [ ] **4** No personal information in logs, job payloads, snapshots or fixtures
- [ ] **5 · 6** Minors stay gated on guardian consent in the data layer; every value read from a document is confirmed by the student
- [ ] **7** `packages/agent` or `packages/content` changed: the crisis red-team passes 100%
- [ ] **8 · 9** Strings from `content`, design values from `tokens`, a reduced-motion path, WCAG 2.2 AA
- [ ] **10** Every Critical/High fix has a test that failed without it
- [ ] **11** Shared packages stay React-Native-safe, and `apps/native` lists any new workspace dependency

## Before merging

- [ ] `pnpm verify` green locally
- [ ] `status.md` updated (phase state, ledgers, open findings, next actions)
- [ ] The "Owed checks" comment's ☐ items are done, or deferred with a reason in `status.md`
- [ ] A9's comments (if any) fixed, or dismissed with a reply that says why
