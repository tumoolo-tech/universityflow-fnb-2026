# CV-A10: AI safety of My CV with Mmereko (#85, behind `UF_CV`)

**Project:** UniversityFlow · **Step:** S1 session 7 (wave 3, agent cva10) · **Date:** 2026-10-23
**Commit:** 092163c (base; worktree `UniversityFlow-w3-cva10`, branch `phase-6/cv-audit-a10`) · **Audit source:** docs/audits/A10-ai-safety.md, scoped by the wave-3 brief
**Result:** 0 Critical · 3 High · 2 Medium · 4 Low. **Fixed on this branch:** all 3 Highs and 1 Medium, each with tests seen failing first. **Open:** A10-58 (Medium: "Report this CV"), A10-59 to A10-62 (Low: two accepted with reasons, two for Mmereko's side or a review).

Scope (the brief): (1) the crisis check on every word a learner writes for a CV, on web and app,
and what happens on a hit; (2) the tailoring path: what reaches Mmereko's model, whether an advert
or Mmereko's answer can inject anything back into UniversityFlow, and how the answer is shown;
(3) that only what the learner ticked leaves; (4) the under-18 limits, server-side. Read:
docs/design/mmereko-api-proposal.md (D1 to D17 approved), packages/cv (and `contract/`),
packages/agent/src/crisis.ts, apps/web/lib/server/{cv,cv-routes,plan-care}.ts, every
`/api/me/cv/*` route, the web page and the app screen, migration 0035. Findings up to A10-53 are
not repeated. cva5 owns the webhook, tokens, share links, PDF and adapter; cva11 privacy and
accessibility: cross-area points are recorded, not fixed.

## Executive summary

- **The crisis check missed words that go on the CV (A10-54, High).** On save it read an entry's
  title, organisation, role, description and highlights, and the page's line about the learner and
  summary. Not read: an entry's **keywords** (up to 15 × 40 characters) and its **links' labels**,
  and the **surname, town and province** typed on the CV page. "i want to die" as a keyword got no
  card. Fixed: every free-text field is read, on POST and PATCH.
- **The job advert was never read (A10-55, High).** "Fit it to a job" and the ATS scan take a
  title, a company and up to 20,000 characters the learner types or pastes. None of it was checked,
  and a tailoring stores the advert in `cv_documents.advert_text` until the job ends and sends it
  to Mmereko, whose model (Anthropic, D4) writes from it. Fixed: on crisis words nothing is stored
  or sent and the answer is the crisis card; a concern goes ahead with the card beside it.
- **Crisis words went to Mmereko with no second look (A10-56, High).** The design (§7.5) shows the
  card on save and sends the words when the learner presses "Make my CV". So "I left because I
  want to die", saved in a ticked entry, went into the profile to Mmereko (and to Anthropic when
  tailoring) and onto the PDF. Fixed: at "Make my CV" and "Fit it to a job" the profile that would
  leave is read again, group by group; on crisis words **nothing is written, queued or sent**, and
  the answer is the crisis card with "Nothing was sent…". **A second press sends it**
  (`sendAnyway`), because the words can belong on a CV: the detector calls "Volunteer at a suicide
  prevention helpline" a crisis (A10-61). The owner should confirm this choice (plan-drift note
  below).
- **Only what the learner ticks leaves (check 3): Pass.** Traced from `cvSources` (profile, latest
  confirmed report, offers, registration, `cv_entries`: nothing else is read) through
  `buildCvProfile` to the `cv.submit` envelope. A new test sends a minor's tailored CV with a
  guardian, a goal in their words, a province, two marks and an unticked entry on the account, and
  proves the envelope has exactly `learnerRef, consent, profile, render, job`, the ticked entry and
  mark only, and none of: the student id, the CV row id, the entry ids, the unticked entry, the
  unticked mark, the guardian's name or phone, the goal, the province, the date of birth.
- **The tailoring path treats Mmereko's answer as data (check 2): Pass, one Medium.** The advert
  reaches only Mmereko (and its model); nothing from Mmereko reaches UniversityFlow's chat model
  (packages/agent has no CV tool or read). The CV text, gaps and ATS words are stored capped
  (40,000 characters; 20 × 300; 200 × 80), shown as text (React and React Native escape; no
  Markdown or HTML rendering), and a CV must be checked "every line is true" before it can be
  shared. A fitted CV was not marked as written by an AI (A10-57, fixed); there is no "Report this
  CV" yet (A10-58, open).
- **Under-18 limits are server-side (check 4): Pass.** No share link for an under-18 in the route
  (opt-in), the database (`uf_cv_share_allowed`, the `cv_links` and `cv_shares` triggers), the
  envelope (`ageBand` from the date of birth; no date of birth → `under-18`; `cv.share` stripped)
  and the engine (`share_not_allowed`). Existing tests cover each; the new test asserts the band.
- **Red team: 100% (4 files, 18/18 tests).** No crisis rule changed, so no new red-team case; the
  run is for the new content keys (hard rule 7).

## Check 1: the crisis check on every word (web and app)

| Where the learner writes | Before | After | Test |
|---|---|---|---|
| Entry: title, organisation, role, description, highlights | Read on POST and PATCH | Same | existing |
| Entry: keywords | **Not read** | Read | api-cv: "reads the keywords and the links' labels" |
| Entry: links' labels | **Not read** | Read | same |
| Entry: link URLs, module codes, dates | Not read | Not read (shapes: `https:` URLs, module-code pattern, `YYYY-MM`) | — |
| CV page: label, summary | Read | Same | existing |
| CV page: surname, town, province | **Not read** | Read | api-cv: "reads the surname, town and province" |
| CV page: e-mail, phone | Not read | Not read (shapes) | — |
| "Fit it to a job": title, company, advert | **Not read** | Read at the request; crisis holds it | api-cv: "reads the job advert…" |
| ATS scan: title, company, advert | **Not read** | Read; crisis holds it (`ats: null`) | same |
| "Make my CV" / "Fit it to a job": everything that would leave | **Not read again** | Read in groups (the page's lines; each school, project, job …), so two entries never run together into one sentence | api-cv: "sends nothing when what would leave holds crisis words" |

**On a hit:** the reviewed crisis card (`crisisCard`, the same as the chat's and plan maps', with
the learner's campus lines when they have an accepted offer) and `en.planMaps.care.crisisLead`; at
"Make my CV" / "Fit it to a job" also `en.cv.make.held`. Nothing about the check is stored or
logged (the existing log test still passes; the check writes no column, row or line). Nothing is
sent to Mmereko, no `cv_documents` row is written (so the advert is not stored), no job is
scheduled (job payloads are ids only in any case), and the daily limit is not spent. Web
(`cv-view.tsx`) and app (`cv.tsx`) show the card in the card the learner pressed; a changed advert
is read again (the second-press flag resets on any edit).

## Check 2: the tailoring path and injection

- **What reaches Mmereko's model:** the profile `buildCvProfile` makes from the ticks, and the
  advert `{ title, company, description }`. No chat, plan map, wellbeing data, guardian detail or
  id other than `learnerRef` (pseudonymous, per learner, for Mmereko only) and `consent.ref`
  (`cv_links.id`). The idempotency key is the `cv_documents` row id (the design's §5.1).
- **Can an advert inject instructions back into UniversityFlow?** Only through Mmereko's answer,
  which UniversityFlow treats as data: stored capped, shown as plain text, never given to the chat
  model or any prompt, never used as a URL (the PDF is fetched from the engine's short link and its
  sha256 checked; cva5's area). What an injected advert *can* do is make the fitted CV say
  something untrue or unkind to the learner who pasted it; the defences are Mmereko's
  verify-claims stage, the AI note (A10-57), "every line is true" before sharing, and a report
  route (A10-58, open). On Mmereko's side the advert must be passed to the model as data, not
  instructions (A10-62).
- **Is the returned text crisis-checked?** No, by choice (A10-60): the learner's own crisis-worded
  entries are now held before they leave, and checking the answer would also withhold a CV that
  rightly mentions a helpline the learner volunteered for.

## Check 3: only learner-chosen data leaves

Pass. `cvSources` reads the profile (first name, school, grade for the end year), the latest
confirmed report, the offers (accepted only used), the registration and the learner's entries.
`buildCvProfile` puts on: the school only when ticked, marks only for ticked subjects of a
confirmed report (D11, hard rule 6), the offer and modules only when ticked and named only from
verified records (hard rule 3), ticked entries only, contact details only as typed (D9). The
`cv.submit` envelope is built from that and the opt-in only. Proven by
`cv-jobs.test.ts` "sends only what the learner ticked…" (see the summary). This test passes on
the code as it was: it guards, and fixes nothing. A temporary break to show it biting (letting
every entry through `buildCvProfile`) was refused by the session's tool policy, so it was not run;
the test asserts both sides (the ticked entry and mark present, the rest absent), so it is not
vacuous.

## Check 4: minors

Pass (above). Tailoring is open to under-18s, as the approved guardian v4 line says ("If they ask
for a CV fitted to a job advert, the AI provider named above writes the fitted version").

## Findings

| ID | Severity | Location | Finding | Fix | Test (how it failed first) | Status |
|---|---|---|---|---|---|---|
| A10-54 | High | apps/web/app/api/me/cv/entries (POST, PATCH), selection (PUT) | The crisis check skipped an entry's keywords and links' labels, and the surname, town and province typed for the CV: crisis words there got no card | `entryTexts` and `selectionTexts` (cv-routes.ts) read every free-text field | api-cv: "expected undefined to be 'crisis'" for a keyword, a label, a PATCH and each of surname/city/region | **Fixed** |
| A10-55 | High | api/me/cv/tailorings, api/me/cv/ats-scan | The job advert (title, company, up to 20,000 characters, typed or pasted by the learner) was never crisis-checked; a tailoring stored it and sent it to Mmereko's model | `careForLeaving` over the advert (and, for a tailoring, the profile); crisis: `200 { document: null, care }` / `{ ats: null, care }`, nothing stored or sent; `sendAnyway` on a second press; a concern goes ahead with the card | api-cv: "expected 202 to be 200"; cv-page and app cv.test: "Unable to find … What you wrote matters" | **Fixed** |
| A10-56 | High | api/me/cv/drafts, tailorings | Crisis words already saved in ticked entries or the summary were sent to Mmereko (and Anthropic) and onto the PDF at "Make my CV" with no second look | The profile that would leave is read again in groups; crisis holds it with the card and `en.cv.make.held`; the learner's second press sends it (the words may belong on a CV, A10-61). Web and app show the card in the pressed card | api-cv: "expected 202 to be 200"; cv-page and app cv.test: "Unable to find … What you wrote matters" | **Fixed** (owner to confirm the hold, below) |
| A10-57 | Medium | web cv-documents.tsx, app cv.tsx (the preview) | A fitted CV, written by an AI from the advert, was shown with no sign an AI wrote it (A10-31's principle; §1 flag 7 "truth only") | `en.cv.preview.tailoredNote` above a fitted CV's text, web and app; not on a base CV (no model, D7) | cv-page and app cv.test: "Unable to find an element with the text: An AI fitted this CV…" | **Fixed** |
| A10-58 | Medium | (missing) the CV preview | No "Report this CV" for a fitted CV, though §11 promises "a report button as on AI replies (A10-35's pattern)" (Films and Publications Act s24C; the app stores' AI-content rules) | Recommended before `UF_CV` is on for learners: `cv_reports` (document id, reason from a fixed list; migration **0039**, reserved for CV-A10), `POST /api/me/cv/documents/[id]/report`, the button on web and app, an id-only alert as `ReplyReportAlerts`. Not small: left for its own change | — | **Open** |
| A10-59 | Low | apps/web/lib/server/cv.ts (`cv.submit`) | The job rebuilds the profile when it runs: an entry edited to crisis words after "Make my CV" is pressed (while it is queued) is sent without the make-time hold. The save itself showed the card | Accepted: the window is the queue's (seconds), the edit's own save shows the card, and holding in the job would need a learner-facing "held" state. Revisit if `cv.submit` ever runs late by design | — | **Open** (accepted) |
| A10-60 | Low | cv.collect; api/me/cv/ats-scan | Mmereko's answer (CV text, gaps, ATS words) is not crisis-checked, by choice (see check 2). Also: the synchronous ATS route returns the engine's word lists as they come, uncapped (stored ones are capped) | Accepted for the check. The cap belongs in the live adapter's parsing: **cva5 (adapter)**, recorded, not fixed here | — | **Open** (cross-area) |
| A10-61 | Low | packages/agent/src/crisis.ts (as used for CVs) | CV-shaped false alarms at crisis level: "Volunteer at a suicide prevention helpline", "Suicide Prevention Week organiser", "Self-harm awareness campaign" (probed; "Volunteered at Childline", "anti-bullying campaign", "Killer sales skills" are `none`). The learner sees the card on save and at make; the second press is the way through | No rule change (narrowing "suicide" would weaken the chat). A clinician or Childline counsellor reviews these with A10-27 and A10-53 | Probe in the session scratchpad (27 phrasings) | **Open** (review) |
| A10-62 | Low | Mmereko (partner API, `/tailorings`) | The advert is untrusted text that reaches Mmereko's model with the learner's profile. UniversityFlow cannot see Mmereko's prompt | Add to Mmereko's build list (§12): pass the advert to the model in a marked data block with an instruction never to follow it; a shared contract fixture with an injection advert ("ignore previous instructions …") whose result must contain no claim absent from the profile | — | **Open** (Mmereko side) |

## Plan drift

**A10-56's hold is stricter than §7.5 as approved.** §7.5 says the words are saved and "nothing
is sent to Mmereko until the learner presses Make my CV", that is, they are sent then. The hold
adds a step: on crisis words the first press sends nothing and shows the card, and a second press
sends. Options, plan-keeping first: (1) remove the hold and send on the first press, as §7.5
reads; **(2, recommended) keep the hold with the second press**, which follows the brief ("nothing
sent to Mmereko" on a hit) and keeps a minor's crisis words from reaching an operator and a model
without one more look, while never blocking a CV that rightly mentions a helpline; (3) hold with
no way through (blocks A10-61's false alarms for good). The brief also asks that "nothing about
the check is stored": the hold stores nothing, so the second press is a flag in the request.

## New content keys (owner's wording review)

- `cv.make.held`: "Nothing was sent. If these words belong on your CV, press the button again to
  send them. You can also change what you wrote or ticked first." (also under "Fit it to a job")
- `cv.preview.tailoredNote`: "An AI fitted this CV to the advert from what you ticked. It can get
  things wrong or say more than is true, so check every line before you use it."

## What I could not check

- Mmereko's tailoring prompt and model behaviour (no sandbox, no key): A10-62's case is proposed,
  not run.
- A live model's output on an injected advert.
- The temporary break for check 3's guard test (refused by the tool policy; see check 3).
- Language review of the CV-shaped false alarms (A10-61).

## Waived

None.
