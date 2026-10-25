# Audits

UniversityFlow runs the company audit suite ([tumoOLO_Audits](https://github.com/tumoolo-tech/tumoOLO_Audits),
private) plus four audits of its own that an AI product for minors owes and the suite doesn't
have yet.

## The IDs

| ID | Audit | Where it lives | Runs at | Blocks |
|---|---|---|---|---|
| A1 | Comprehensive codebase | suite + [A1.project.md](A1.project.md) | every phase | yes |
| A2 | Design fidelity (against the tokens) | suite | 1, 3, 4, 5 | yes |
| A3 | Accessibility, WCAG 2.2 AA | suite + [A3.project.md](A3.project.md) | 1, 3, 4, 5, 6 | yes |
| A4 | Performance and Core Web Vitals | suite | 3, 4, 5, 6 | yes |
| A5 | Security (whole system) | suite + [A5.project.md](A5.project.md) | 3, 4, 6 | yes |
| A6 | SEO and content (repo) | suite | 2, 3, 6 | yes |
| A7 | Mobile and native | suite | 4 (first store release), 5, 6 | yes |
| A8 | Dependencies and supply chain | suite, deterministic in CI | 0, 4, 6 · weekly | yes |
| A9 | Automated security review of each PR diff | suite (Claude action) | every PR | comments |
| **A10** | **AI safety and tone** | [A10-ai-safety.md](A10-ai-safety.md) | 2, 3, 4, 7, **every model change** | yes |
| **A11** | **Privacy and POPIA** | [A11-privacy-popia.md](A11-privacy-popia.md) | 2, 4, 8, before launch | yes |
| **A12** | **Messaging compliance** | [A12-messaging.md](A12-messaging.md) | 4 | yes |
| **A13** | **Data accuracy** | [A13-data-accuracy.md](A13-data-accuracy.md) | 1, 3, before every admissions season | yes |

**Renumbered 2026-10-13.** planning.md v0.3 called data accuracy "A9". The suite's A9 is the
per-PR security review, and the suite's IDs are shared by every company project, so the suite
wins: data accuracy is now **A13**. A10 to A12 are unchanged.

## Running one

```bash
# suite audits (A1–A9): render the brief, hand it to a fresh session, report only
node ../tumoOLO_Audits/runner/audit.mjs plan          # what this phase owes, and why
node ../tumoOLO_Audits/runner/audit.mjs brief A5      # the resolved brief, overlay included
node ../tumoOLO_Audits/runner/audit.mjs gate          # fails while a Critical/High is open

# project audits (A10–A13): the file is the brief
#   give docs/audits/A10-ai-safety.md to a fresh session; it reports, it never fixes
```

Results go to `docs/audits/results/PHASE-<n>-<ID>.md`. Findings go into `status.md` →
**Open findings** as `A10-01 | A10 | High | file:line | summary | Open`. The phase gate reads
that table: an open Critical or High shuts it.

## In CI

- **ci.yml** (no secrets): the gate, E2E with axe, the crisis red-team as its own check, and a
  secret scan of the whole history.
- **audits.yml**: "Owed checks" on every PR (what the diff obliges a person or an audit to do);
  the suite's run plan, A8 and phase gate; A9 on every PR; prompt audits on dispatch and
  schedule.
- Secrets it needs: `AUDIT_SUITE_TOKEN` (read access to tumoOLO_Audits) and
  `ANTHROPIC_API_KEY`. Without them those jobs **warn and skip**: a gap, never a pass.

## Why four project audits

The suite was built for websites. This product is an AI agent talking to 16-year-olds about
their future, with their school reports and their guardians' consent. What can go wrong there
(a confident wrong requirement, a missed crisis, a minor processed before consent, a 2am SMS)
isn't in A1 to A9. When a second company project needs one of these, it moves into the suite
and keeps its ID.
