# PHASE-5 — A11 Privacy and POPIA

**Project:** UniversityFlow · **Phase:** 5 · **Date:** 2026-10-17
**Commit:** 0554343 (`phase-5/stack`, the integration trial) · **Audit source:** docs/audits/A11-privacy-popia.md @ 0554343
**Result:** ❌ Fail: 0 Critical · 1 High · 2 Medium · 3 Low (6 findings, A11-13 to A11-18). The High (A11-13) shuts the Phase 5 gate.

Scope: the Phase 5 diff `git diff 7e8ddef..HEAD`. That covers:

- the two new document types (acceptance letters #70 and proofs of registration #78): what is
  extracted, what the prompts forbid, what is stored, and how long the files are kept;
- the three new tables (offers 0018, first_week_steps 0019, registrations 0020): RLS, the consent
  gate for minors and adults, export, deletion and the audit log;
- the new reminder and push templates (`offer.reply-by`, `safety.offer-accepted`,
  `safety.move-in`, `registration.change-deadline`);
- the campus lines in the SMS and WhatsApp crisis reply (#77);
- the E2E catalogue fixture switch (`UF_CATALOGUE_E2E_FIXTURES`);
- whether consent v2 (and adult v1) covers the new processing.

This was an independent, read-only review. Six throwaway probes ran on PGlite in `packages/db`
(`a11-phase5.audit-tmp.test.ts`, run as a single file, 6/6 passed, confirming each behaviour cited
below as P1–P6). The file was deleted afterwards.

## Executive summary

The data layer for Phase 5 is built to the same standard as Phase 4:

- **RLS and the consent gate.** Every new table has row-level security plus `uf_may_process`.
  - P1: an adult who has not agreed in their own name is refused on all three tables.
  - P3: a guardian's withdrawal stops reads of offers, registrations, first-week steps and the
    crisis reply's campus lookup at once.
- **Own-rows triggers.** A trigger stops an offer or a registration from pointing at another
  learner's document or reminder.
- **Export and deletion.** Export covers offers, registrations and first-week steps. Deletion
  cascades all three and returns the storage keys of the letters and proofs.
- **Audit rows.** They carry fixed words only (P6).
- **The new templates.** None has a variable in its text or `pushBody`, and each opens a screen
  from the fixed list.
- **The extraction schemas.** They have no field for a name, ID number, student number, address
  or fees, and both prompts forbid them.
- **The E2E fixture.** It is refused in production, including Vercel previews (`isProduction` is
  true whenever `VERCEL_ENV` is set).

What fails is again **the legal layer**, plus **what happens to the files**:

1. **Consent doesn't cover the new processing (A11-13, High).** Neither consent v2 nor adult-v1
   mentions acceptance letters or proofs of registration. Both say the AI provider gets data "to
   read reports and chat". In practice it now receives the whole letter or proof, with the
   learner's ID number, student number, home address and fees, outside South Africa.
   - Nothing in the data layer ties these uploads to a consent version. P2: a minor whose
     guardian agreed only to **v1** can still store a letter, an offer, a proof and a
     registration.
2. **The files are kept indefinitely (A11-14).** The tables keep no student number, but the
   original file in S3 does, and it is kept after confirmation. It is also kept after its offer is
   deleted and after a newer proof replaces it (P5). Retention is the owner's open decision 6.
3. **The store privacy page is stale (A11-15).** It still lists only reports, and declares
   "Physical address" and "Financial info" as not collected.
4. **Smaller gaps:**
   - the crisis SMS and WhatsApp now names the learner's campus and university (A11-16);
   - nothing outside the prompt keeps an ID or student number out of a quoted condition or a
     module name (A11-17, P4);
   - safety pushes outlive the accepted offer they were for (A11-18).

Already open and not re-reported: A11-04 and A11-12 (no retention schedule or sweep), and A11-10
(Information Officer and the legal review of the consent wording). A11-13's new wording joins
A11-10's legal review.

## Findings

| ID | Severity | Location | Finding | Why it matters | Fix | Test that fails without the fix |
|---|---|---|---|---|---|---|
| A11-13 | **High** | packages/content/src/en.ts:160-171 (`consent.whatWeDo`, `whatWeKeep`, `version: 'v2-2026-10'` at 194); en.ts:207-217 (`adultConsent`, `adult-v1-2026-10` at 227); packages/db (`uf_may_process` and `addDocument`, no version check for the new kinds) | **What the consent says.** The guardian consent says UniversityFlow "reads the learner's school report". It says data goes to the AI provider "to read reports and chat". It doesn't mention acceptance letters, proofs of registration, or keeping offers and registrations. Adult consent says the same.<br>**What actually happens.** Phase 5 sends the whole letter or proof to Anthropic (`AnthropicLetterReader` and `AnthropicRegistrationReader` through `readStructured`, documents/src/reader.ts:95-128). That file holds the learner's ID number, student number, home address and, on a proof, fees and amounts owed. Phase 5 also stores two new kinds of record about the learner's university life.<br>**Versions and the data layer.** Neither consent version was bumped. Nothing in the data layer links these uploads to the wording that was agreed. **P2:** a minor whose guardian agreed to **v1-2026-10**, which doesn't even mention messaging, can add an acceptance letter, an offer, a proof of registration and a registration. | The law is POPIA ss 13, 18 and 72. Consent must be specific and informed, and a cross-border transfer must be disclosed. These are new purposes (a place at university, registration) and new categories (identity and student numbers, address, fees). They go outside South Africa under a consent that names only reports and chat.<br>Offers arrive in Grade 12, when many learners are still 17, so for them the guardian's consent is the legal basis. This is the same class of gap as A11-01 (High, fixed by v2 for messaging), so it gets the same severity. | (1) Add letters and proofs to `consent.whatWeDo` and `adultConsent.whatWeDo`: "Reads an offer letter or proof of registration you upload (after you check every value) to keep track of your offers and modules". (2) In `whatWeKeep`, say that the whole document, including any ID or student number printed on it, is sent to the AI provider outside South Africa to be read, and how long the file is kept (A11-14). (3) Bump to `v3` and `adult-v2`. (4) Enforce this in the data layer, as #39 did for messaging: `addDocument` with kind `acceptance-letter` or `proof-of-registration` refuses unless the guardian consent is at least v3, or the adult agreement at least adult-v2. A re-consent prompt asks for it. (5) Add the new wording to A11-10's legal review. | Content test: `consent.whatWeDo.join(' ')` and `adultConsent.whatWeDo.join(' ')` match `/offer letter/i` and `/proof of registration/i`. DB test (P2 inverted): a minor granted under `'v2-2026-10'` calls `addDocument({kind:'acceptance-letter'})` and expects a `ConsentRequiredError`. Both fail today. |
| A11-14 | Medium | apps/web/lib/server/documents.ts:62-70 (file stored, never removed on confirm); packages/db/src/store.ts:1600-1643 (`addOffer`), 1788-1839 (`saveRegistration`), 1933-1940 (`deleteDocument` is the only path); migration 0018:21 and 0020:6-7 (comments: "never stored", "nothing here could hold them"); planning.md §11 5c ("The student number on the proof is **not stored**") | The tables hold no student number, ID number or address. The **original file** in S3 holds all of them, plus fees on a proof. It is kept indefinitely: confirming doesn't delete it, deleting its offer doesn't delete it, and replacing a registration with a newer proof leaves the old proof. **P5:** a letter whose offer was deleted, and a superseded proof, both remain with their `storage_key` and (for the letter) the stored draft in `extraction`. So the D4 statement "not stored" is true of the database rows only. Retention of these files is open as the owner's decision 6 ("deleted once confirmed?"), but nothing at all is deleted today. | POPIA s14 (kept no longer than the purpose needs) and s10 (minimisation). Once the rows are confirmed, the file has no purpose the app uses, yet it holds the most identifying data the product touches. That makes a breach of the S3 bucket worse than it needs to be. The planning text and the migration comments overstate the minimisation to a reader such as an auditor, the Information Regulator or the legal review. | **Owner:** decide decision 6 and write it into planning.md §8 (A11-04's schedule). **Code, either way:** (a) when an offer or registration is confirmed from a document, delete the file and null `storage_key` (keep the row for the audit trail), or schedule that deletion after N days with an IDs-only job; (b) when a registration is replaced, delete the replaced proof; when an offer is deleted, delete its letter; (c) reword the migration comments and planning 5c to "not kept in the database; the file is deleted on confirmation". | DB test: upload a proof, `saveRegistration({documentId})`, and expect the document's `storage_key` to be null (or a deletion job queued) and `FileStore.get(key)` to fail. Replace it with a second proof and expect the first gone. Fails today (P5). |
| A11-15 | Medium | docs/store/privacy-and-data-safety.md:19-33 (no letters, proofs, offers, registrations or first-week progress), 42-43 (Anthropic gets "chat messages and report images"), 73 (Physical Address ❌), 80 and 116 (Financial info "Not collected"), 112 ("report PDFs" only) | The App Privacy and Data safety answers were not updated for Phase 5. They miss:<br>- photos and PDFs of acceptance letters and proofs of registration;<br>- offers (with the conditions as quoted), registrations (modules) and first-week progress;<br>- the fact that Anthropic now reads letters and proofs.<br>The page says "Re-check this page whenever a column is added to `schema.ts`", and three tables were added. It also declares Physical Address and Financial info as not collected, while the stored letter and proof files carry the home address, fees and amounts owed (A11-14). | Wrong store declarations risk rejection by Apple and Google, and removal after launch. The website privacy policy is to "say the same", so POPIA s18 notice to learners and guardians is incomplete too. The page is the source the legal review (A11-10) will read. | Add rows for letters and proofs (User Content: Photos, Other User Content; Files and docs) and for offers, registrations and first-week progress (Other User Content / App activity). Update Anthropic's line to "chat messages and images of reports, offer letters and proofs of registration". Either declare Physical Address and Financial info (the conservative option, since the files hold them), or fix A11-14 first and say they are deleted on confirmation. Note the crisis-reply exception (A11-16). | A docs check in `scripts/` (or a web test): every value of the documents `kind` CHECK (`grade-11-report`, `acceptance-letter`, `proof-of-registration`, …) and every learner table in `schema.ts` is named in privacy-and-data-safety.md. Fails today for `acceptance-letter`, `proof-of-registration`, `offers`, `registrations` and `first_week_steps`. |
| A11-16 | Low | apps/web/lib/server/crisis-reply.ts:91-108 (`${line.name} (${line.campusName})` and the number); apps/web/app/api/messaging/[channel]/inbound/route.ts:118-127; docs/store/privacy-and-data-safety.md:48, 53, 56-58 ("no name, no university, no subject") | Since #77 the SMS and WhatsApp crisis reply appends the learner's own campus lines, for example "Campus Protection Services (East Campus)", with the number to call. The number and the campus identify the university of the learner's **accepted offer**. That text shows on a lock-screen preview and goes to the SMS provider and to Meta. A11-02 made every outgoing SMS and WhatsApp free of the university, and the privacy page promises that. This one message now breaks the promise, and no document records it as an exception. | s10 and s72 again, and the lock screen. The reply only follows the learner's own message of distress. It already shows helplines whose subject is more sensitive than a campus, and the safety benefit is real, so this is Low. But it is an undocumented exception to a stated rule. | **Owner decision:** keep the campus lines as a justified safety exception, and write that into planning.md §8.1 next to the s11(3) STOP exception and into the privacy page; or show them without the campus name ("Your campus security: call …"). Either way, add a test that holds the decision. | If kept: a content or docs test asserts the privacy page names the crisis-reply exception. If dropped: `crisisReply(…, campusSafetyLines(view,'wits'))` contains no `campusName` (the current `crisis-reply-campus.test.ts:30` asserts "(Test Campus)" and would be changed). |
| A11-17 | Low | packages/documents/src/letter.ts:41-46, 117-120 (`cleanCondition`, `condition`: whitespace only); packages/documents/src/registration.ts (module `name`); migration 0018:5-17 (`uf_offer_conditions_ok`), 0020:129-135 (`name`); apps/web/lib/server/documents.ts:72-82 (the unconfirmed draft stored in `documents.extraction`) | Keeping identifiers out of a quoted condition or a module name rests only on the prompt ("If a condition contains one, leave that detail out"). No code redacts a 13-digit SA ID number or a student, applicant or reference number. **P4:** a condition reading "Applicant 0501015800087, student number 22012345, 12 Example Street: …" and a module named "Student no 22012345 ID 0501015800087" are both accepted by the store and the SQL checks, and both are exported. The AI's draft is stored in `documents.extraction` before the learner sees it. Migration 0020's comment says "nothing here could hold them". | D4 and s10. Defence in depth: a model that slips on one letter puts an ID number into a long-lived free-text column. The learner, glancing at "conditions as quoted", may not notice it. Low, because the prompt forbids it and the learner confirms. | In `draftFromLetter` and `draftFromRegistration`, and in `confirmedOfferSchema` and `confirmedRegistrationSchema`, replace a 13-digit run (optionally Luhn-checked as an SA ID) and an 7–10 digit run next to "student", "applicant", "ref" or "no." with "[removed]", and add a `personal-detail-removed` warning. In SQL, `uf_offer_conditions_ok` and `uf_registration_modules_ok` also refuse `\d{13}`. | `draftFromLetter({...conditions:['ID 0501015800087: pass Maths']})` contains no `0501015800087`. A DB test: `addOffer` with that condition throws. Both fail today (P4). |
| A11-18 | Low | apps/web/app/api/offers/[id]/route.ts:24-29 (safety pushes scheduled on accept); packages/db/src/store.ts:1689-1720 (`#changeOffer`), 1673-1687 (`deleteOffer`) drop only the reply-by reminder | Accepting an offer schedules two safety pushes: one that evening, and `safety.move-in` on 15 January. Declining or deleting that offer afterwards drops only the reply-by reminder, so the pushes still go out. That includes the January one, up to three months later, "for the university place you added" (its `body`). Found by reading the code, not probed. | s13 and s15 purpose limitation, and the trust of a learner who said no. The content is generic (nothing personal on the lock screen), so this is Low. | In `#changeOffer` (to `declined`) and `deleteOffer`, when the offer was the accepted one, also drop waiting `safety.offer-accepted` and `safety.move-in` reminders as `offer-closed`, and return their jobs to cancel. | Accept an offer with push on, decline it, and expect both safety reminders `dropped`. Fails today (they stay `scheduled`). |

## Project-specific checks

| Check | Result |
|---|---|
| 1. Minors: the new tables refuse a minor before consent, in the data layer | ✅ RLS `*_consented_self` with `uf_may_process` on offers, first_week_steps and registrations (migrations 0018:73-76, 0019:95-98, 0020:194-197). The existing db tests cover a minor before consent. P1: an adult without their own agreement is refused on all three. P3: withdrawal stops reads at once and `acceptedOfferUniversity` returns null. ❌ The **consent version** isn't tied to the new purposes (A11-13, P2) |
| 1. Re-consent at 18 and old guardian links | Unchanged since #49 (A1-13/A5-07). The new tables use the same gate |
| 2. Minimisation: new columns | Every column has a reason: offers (ids, kind, source, status, reply-by, conditions as quoted, reminder), first_week_steps (ids and a time only), and registrations (ids, year, modules, proof, reminder). There is no column for a student number, ID number, name, address or fees. ⚠️ Free text in conditions and module names isn't screened (A11-17) |
| 2. Minimisation: what the AI sees | The letter and proof readers send the **whole file** (unavoidable for reading). The schemas have no personal fields, and the prompts forbid them (letter-reader.ts:56, registration-reader.ts:54, both tested). Chat tools: `offers` sends the conditions' count, not their words (A10-12). `compare_registration` keeps learner-typed codes out of `forModel` (commit 6826a1c). Not re-tested here (A10's scope) |
| 3. Logs, jobs, analytics, fixtures | ✅ No new `console.*` with data. Reminder params are `{universityId}` only, under `uf_reminder_params_ok`. Audit rows for the new actions carry fixed words (`letter`/`learner`/`proof`, template ids; P6). The sample letter and proof are synthetic (TEST codes, "Sample …"). Native uploads use fixed file names (`report.*`, `registration.*`) |
| 4. Residency and cross-border | No new processor. ❌ The cross-border transfer of letters and proofs to Anthropic isn't in the consent wording (A11-13) |
| 5. Retention and deletion | ✅ Deletion cascades offers, steps and registrations, and returns every document key (P5 docs included). ✅ Export includes `offers`, `registrations`, `firstWeek` and the documents' stored drafts. ❌ Letter and proof files are kept indefinitely (A11-14; owner decision 6, A11-04) |
| 6. Security safeguards | ✅ RLS per learner on every new table. ✅ The own-rows triggers (security definer) check that a document or reminder belongs to the learner, since FKs ignore RLS. ✅ `acceptedOfferUniversity` reads the offer as `uf_app` under the gate, and only an id leaves the database |
| 7. Accountability | Still open as A11-10 (owner). The A11-13 wording joins its legal review |
| 8. Push: new templates | ✅ `offer.reply-by`, `safety.offer-accepted`, `safety.move-in` and `registration.change-deadline` have no placeholders in `body` or `pushBody`. `universityName` is declared but unused, and the existing lock-screen and channel tests render it and assert it's absent. `opens` is from the fixed `APP_SCREENS` (now 7). The app routes only those screens (`routeForNotification`). Safety pushes go by push only, and only when push is offered and opted in |
| Crisis SMS/WhatsApp campus lines | ⚠️ Verified lines only, read under consent. They never push a helpline out. They name the campus (A11-16) |
| E2E fixture switch | ✅ `readConfig` throws in production (config.ts:323-324). `isProduction` is true for any `VERCEL_ENV`, so previews refuse it too. The config test covers it (config.test.ts:124). The fixture is synthetic and a draft, so it is shown only with preview on |
| Owner's earlier decision 4 (safety by push only) | ✅ Both safety templates have `channels: ['push']` |

## Not measured

- **Live readers.** Whether Claude actually leaves ID or student numbers out of conditions and
  module names on real letters and proofs. Only the prompt and the fake-API tests were read.
  Recommend real, anonymised samples in the owed document-reading library (planning.md §13).
- **S3 object lifecycle rules.** No bucket is connected. A lifecycle rule could also enforce
  A11-14's deletion.
- **The device lock screen and the SMS/WhatsApp preview.** Inferred from the reply text.
- **The website privacy policy.** There is no privacy page in `apps/web` yet (the launch
  standard requires one). Only the store page was checked (A11-15).
- **Real Postgres.** The probes ran on PGlite, the engine the db suite uses by default.

## Waived

None.

## Remediation roadmap

1. **Before Phase 5 closes (gate):** A11-13. Consent v3 and adult-v2 name letters and proofs and
   their transfer to the AI provider. The data layer refuses the new document kinds under an older
   version.
2. **With the owner's retention decision (decision 6 and A11-04):**
   - A11-14: delete letter and proof files once confirmed, superseded or orphaned;
   - correct the "not stored" wording.
3. **Before store submission:** A11-15, the store privacy page.
4. **Small fixes:**
   - A11-16: the owner chooses, then document or trim;
   - A11-17: redact ID-shaped numbers in code and SQL;
   - A11-18: drop the safety pushes when the accepted offer goes.

## What's genuinely good

- **The consent gate is in the database for every new table**, and the crisis reply's campus
  lookup goes through it too. It reads as `uf_app` under `uf_may_process`, so a withdrawn consent
  means no campus line, and only an id crosses the boundary.
- **Own-rows triggers** close the FK-bypasses-RLS hole: an offer or registration can't point at
  someone else's document or reminder.
- **Schemas with no room for identifiers**, prompts that forbid them, and tests that assert both.
  Terms are placed by code, never by the AI.
- **Every new template is lock-screen safe.** Variable-free texts, screens from a fixed list,
  safety guidance by push only, and existing tests that render real university names and assert
  they're absent.
- **Reminders end with their purpose:** reply-by when the offer is accepted, declined or deleted,
  and change-deadline when the registration is re-confirmed or deleted (A11-18 is the one gap).
- **The E2E fixture can't reach production or a preview**, and is synthetic and labelled.
