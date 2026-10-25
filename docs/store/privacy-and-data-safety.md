# App Privacy (Apple) and Data safety (Google Play)

The answers for both forms, derived from what the app and its server actually collect, as of
Phase 5 (2026-10-17: offer letters, proofs of registration, offers, registrations and the first
week added, audits A11-15 and A11-16; Phase 4d 2026-10-13; what SMS and WhatsApp carry, and Meta,
added 2026-10-14; ElevenLabs, Read aloud's voice, added 2026-10-22). **Exact and
conservative**: where a category is arguable, it is declared.
Re-check this page whenever a column is added to `packages/db/src/schema.ts`, a provider is
connected, or an SDK is added to `apps/native` (Sentry, when connected, adds Diagnostics).
`packages/db/src/privacy-page.test.ts` fails when a table holding a learner's rows, or a kind of
document a learner uploads, is not named below.

Our users start at about 15 (Grade 10, the first grade UniversityFlow serves: S1, G10-6; the
API and the database refuse Grade 9, A1-39), so most are
minors, for up to about three years. **No one under 13 can sign up** (A11-24): the database
refuses a date of birth under 13 (`setDateOfBirth`, `MINIMUM_AGE`) and records nothing, and both
apps' date-of-birth step says why. Then: nothing about a minor is processed before a guardian
consents (hard rule 5), in the database itself. A guardian's consent ends on the learner's 18th
birthday; from then the learner must agree in their own name, and until they do nothing of
theirs is processed and **no reminder is sent, exam reminders included** (A1-13). With learners
from Grade 10, many turn 18 in matric, some during the final exams: "agree ahead" (the learner
agrees in the 30 days before, taking effect on the day) is planned after S1's audits, once the
legal reviewer confirms a 17-year-old may agree ahead. An offer letter or a proof of
registration is accepted only under consent wording that names them (guardian consent v3, an
adult's own agreement adult-v2, audit A11-13), in the database itself too. **The consent wording
and this page are owed a legal review (A11-10).**

## What the app collects, and why

"Collected" in both stores means: sent off the phone and kept longer than it takes to answer
the request. Everything below is stored in South Africa (Postgres and S3 in AWS af-south-1;
functions in Vercel `cpt1`), linked to the learner's account, and **never used for tracking or
advertising, never sold, never used to build a profile for anyone else**.

| Data | Where it comes from in the app | Why | Optional? |
|---|---|---|---|
| **Phone number** | Sign-in | The account (a PIN by SMS); SMS reminders if chosen | Required |
| **Date of birth** | Onboarding | Whether a guardian must consent (POPIA) | Required |
| **Guardian's name and phone number** | Onboarding, learners under 18 | To ask for and record the guardian's consent | Required for minors |
| **Name** (first name, as the learner types it) | About me (web) | How the companion greets them | Optional |
| **The profile look** (how the learner chose to style their About me card: theme, avatar, tagline and word ids, from fixed lists; never free text) | About me (web and app) | Shown only to the learner, on their card and home: not shared, never sent to the AI provider (audit A11-33) | Optional (defaults) |
| **Grade** (moved up a year each school year, and confirmed by the learner each January; with the date it was given or confirmed) | Onboarding (web and app), About me (web), the January check on the home | The learner's stage, the exam timetable, the report the confirm form starts on | **Required** (A11-26) |
| **School, province, a goal in their words** | About me (web), onboarding | Matching courses and the exam timetable | Optional |
| **Profile photo** (built, but **only when switched on**: the server switch `UF_PROFILE_PHOTO=1`, the owner's preview only; off for learners, and production refuses it, until guardian consent v4 and adult consent v3 name it after legal review) | About me, "Add a photo" (web and app; one photo, cropped to a square by the learner) | Shown to the learner alone, black and white, on their About me card. Kept as a 512 × 512 black-and-white JPEG with every piece of metadata (EXIF, GPS) removed by our server; the photo as chosen is not kept. Replacing it deletes the old one; "Remove photo" deletes it; it goes with the account and is in the data export | Optional |
| **Photos and PDFs of school reports** | Upload my report (camera, photos, files) | Reading the marks, which the learner then confirms | Optional (marks can be typed) |
| **Photos and PDFs of offer letters** | I got in (camera, photos, files) | Reading the offer (university, course, kind, reply-by date, conditions), which the learner then checks field by field | Optional (an offer can be added in the learner's own words) |
| **Photos and PDFs of proofs of registration** | My modules (camera, photos, files) | Reading the registered modules, which the learner then checks row by row | Optional (modules can be typed) |
| **Photos and PDFs of module outlines** (built; refused until guardian consent v4 and adult consent v3 name them after legal review: migration 0040. The judge demo's made-up university learners record the draft, a hackathon exception) | My modules → Add a module outline (web) | Reading how the module's marks work, its dates, books and lecturers' work details, which the learner then checks part by part. **The file is deleted as soon as they have checked it** | Optional (an outline can be typed in) |
| **Module outlines** (as checked: the parts and what each counts for, the DP rule and subminima as printed, dates, books, and lecturers' **work** details only, never a personal cellphone number or email, a class list or a student number) | Module outlines | The learner's own record of how a module works, for them alone | Optional |
| **What is printed on an uploaded letter or proof** (see below) | The file itself, kept as uploaded | Not used: the readers' schemas have no place for it, and nothing from it is stored in a database row | Comes with the file |
| **Marks** (confirmed by the learner) | Confirming a report | Working out what they qualify for | Optional, but the app is about this |
| **Offers** (university, course, kind, reply-by date, the conditions as quoted, held, accepted or declined) | I got in | Tracking replies and conditions; the reply-by reminder; safety guidance once a place is accepted | Optional |
| **Registrations** (the modules confirmed, with code, name, term and credits, for one year) | My modules | Comparing them with the published curriculum; the change-deadline reminder | Optional |
| **First-week progress** (which first-week steps were ticked, and when) | The campus tour and first-week checklist | Showing what is left to do | Optional |
| **Chat messages** with the AI companion, and notes it was asked to remember | Chat | Answering the learner | Optional |
| **Goal, shortlist, applications, checklists, exam subjects, re-checks** | Goals, results | Planning applications | Optional |
| **Plan maps and reflections in their words** (a template, each part's status and the learner's own target month; and, once consent wording names them, the learner's own words: a title, what each part says, what got in the way and what they could try differently) | My plan maps, on My goal | The learner's own plan, for them alone: never sent to the AI provider, never shown to a guardian or anyone else. What they write is read by our server's crisis check, in South Africa, to show helplines at once; nothing about that check is stored | Optional |
| **My CV** (built, but **only when switched on**: the server switch `UF_CV=1`, the owner's preview only; off for learners, and production, staging and the demo refuse it, until guardian consent v4 and adult-v3 name Mmereko after legal review, the Tumoolo–Mmereko agreement is signed and Mmereko's South African partner cell runs; docs/design/mmereko-api-proposal.md) | My CV (web and app), after the learner's own opt-in, separate from the account consent and revocable | The learner's opt-in (when, the wording version, what it covers); projects, skills, work, volunteering, awards, languages and certificates in their own words, with evidence links they type (printed on the CV, never fetched); what they tick for it; contact details they choose to type for the CV (e-mail, a phone number, a city: never the sign-in phone, never an ID or student number); the CVs made (the text, gaps, an ATS score and the PDF in S3 in South Africa); a job advert's title and company (its text only until the CV is made); and, from 18 only, recruiter links. Marks go on a CV only when the learner ticks the subject. Their words are read by our server's crisis check, in South Africa; nothing about that check is stored. "Stop using Mmereko" switches every link off, asks Mmereko to delete anything it still has, and deletes the CV data here | Optional |
| **Messaging choices and reminders** (with each message's delivery report, and on WhatsApp the price category Meta charged) | Notifications, About me | Sending only what the learner asked for | Optional |
| **Push token** (identifies the app on one phone) | Turning notifications on | Sending app notifications | Optional |
| **Account id** (a random id) | Created at sign-up | Linking the above | Required |
| **Keyed hashes of the phone number and IP address**, with a time | Sign-in and uploads | Rate limits against abuse; the number or address itself is never stored here | Required |

**What is printed on an uploaded letter or proof.** An offer letter or a proof of registration
usually carries the learner's full name, ID number, student or applicant number and home
address, and a proof may show fees and amounts owed. None of that is read into a database row:
the readers' schemas have no field for it, their prompts forbid it, and the data layer refuses
an ID-number or student-number shape in a quoted condition or a module name (audit A11-17). But
**the original file is kept**, in S3 in South Africa, until the learner deletes it (Documents)
or deletes their account. How long it should be kept is the owner's open decision (A11-04,
A11-14); until it is decided, this page declares the address, the fees and the ID number as
collected.

**Not collected:** location (no location permission; province is typed by the learner), contacts,
the microphone, browsing or search history, advertising identifiers (the Android AD_ID
permission is blocked), purchases, payment or credit details, health, crash or usage analytics
(none installed today), and the photos left in the learner's gallery (only the one they choose;
the app deletes its own copy after uploading).

**Processors outside South Africa** (service providers acting for us, under contract):
- **Anthropic** (the AI): chat messages, and the images of reports, offer letters and proofs of registration, to answer and to read them.
  A letter or proof is sent whole, with everything printed on it (above). Not used to train
  models under the API terms. A cross-border transfer named in the consent wording (guardian v3,
  adult-v2). The profile photo is never sent to Anthropic or any other provider: not in a
  prompt, a tool, the companion's memory, a log, a job or analytics (it stays in S3 in South
  Africa and is served only to its owner).
- **Expo, then Apple (APNs) or Google (FCM)**: app notifications. Each carries only the push
  token, a fixed sentence with no personal data and a screen name (docs/audits/A11, check 8).
  The safety guidance sent after an offer is accepted goes by push only, and stops when no offer
  is accepted any more (audit A11-18).
- **Meta (the WhatsApp Business Platform)**, only for a learner who turns WhatsApp reminders on
  (not connected yet): the phone number and which fixed message template to send. A reminder is
  a fixed sentence with **no name, no university, no subject and no mark** (audit A11-02), and a
  "Stop" button. Meta sends back delivery reports (with the price category it charged), and
  passes on what the learner writes back to us (STOP, or a reply).
- **The SMS provider** (not chosen yet; it may be in South Africa): the phone number, and one of
  the sign-in PIN, a guardian's consent link, or a reminder. A reminder is a fixed sentence with
  **no name, no university, no subject and no mark**, ending "Reply STOP to stop." (audits
  A11-02, A12-10). It also passes on STOP and other replies.
- **ElevenLabs** (Read aloud's voice, owner's choice of 2026-10-22; only when its key is set):
  **public catalogue text only**, never anything about a learner. When a learner presses Read
  aloud on a campus place, the web page or the app asks our server for that place by its id;
  our server builds the words from the published catalogue (the place's name, kind, where, hours,
  step-free entrance, arrival note and how to get there: what the card already shows) and sends
  only those words to ElevenLabs' text-to-speech API (`api.elevenlabs.io`, outside South Africa;
  ElevenLabs has no African data region), with our own API key. It sends back the audio, which we
  keep in our own file store in South Africa and reuse for every learner. No phone number, name,
  account id, chat message, mark or location is sent, and the request carries no learner
  identifier: our server makes it, not the learner's phone. Why: so Read aloud can speak in one
  clear voice on every phone and browser. ElevenLabs keeps what it is sent under its terms (zero
  retention is for enterprise accounts only), which is why only public text goes. The learner's
  own screen reader, when on in the app, speaks on the phone and sends nothing.
  **Owner and legal to confirm (2026-10-22):** (1) that ElevenLabs is named as an operator in the
  privacy policy although it receives no personal information; (2) ElevenLabs' terms on products
  "directed at individuals under 18" (planning.md §11 records that they need ElevenLabs' written
  approval: most of our learners are minors); (3) whether a cross-border mention belongs in the
  consent wording (v4 is legal's call; the consent wording in `packages/content` is unchanged).

What a reminder says, on SMS and WhatsApp, is the same as on a lock screen: that one of the
learner's own reminders, or an update to their account, is waiting in the app (for example
"UniversityFlow: this is the study reminder you asked for."). The detail is only in the app.

**One deliberate exception: the crisis reply.** When a learner's own SMS or WhatsApp message
reads as distress, the reply gives helpline numbers and, after them, the security and support
lines of the campus of their accepted offer, named with the campus (for example "Campus
Protection Services (East Campus)") and the number to call, so it identifies their university
(audit A11-16). It is kept as a safety exception to "no university in an SMS or WhatsApp": it
answers only the learner's own message, the lines come from verified records read under consent,
and they never push a helpline out. Whether to keep the campus name in it is an owner decision
(planning.md §8.1).

## My CV's operator, in South Africa (not live yet)

Not an operator today (`UF_CV` is off for
learners), so the website's privacy page doesn't name it yet; it must, in the same change that
switches the CV on (move it into the processors above then: `apps/web/test/privacy-page.test.tsx` reads
that list):

- **Mmereko** (the CV engine, in South Africa: its partner cell in AWS af-south-1, Cape Town;
  only once `UF_CV` is on, after consent v4 / adult-v3 and the agreement): only what the learner
  ticked for a CV, when they press "Make my CV", with a random reference made for Mmereko alone
  (never the account id, a phone, an ID or a student number), an age band (never the date of
  birth) and the id of their opt-in. It keeps it only until we have collected the CV, at most a
  day, and deletes it at once when the learner stops using it or deletes their account (we keep a
  record that the deletion reached it, with no link to the learner). A CV fitted to a job advert
  is written by our AI provider (Anthropic, above), through Mmereko; a base CV uses no AI. Mmereko
  never sees who opens a recruiter link: we serve those ourselves. Not connected yet: today the
  CV is made by our own stand-in, on our server.

## Learner tables

Each table in `packages/db/src/schema.ts` that holds a learner's rows, and the row above it
belongs to. Every one has row-level security per learner, is in the data export, and goes with
the account.

| Table | Row above |
|---|---|
| `students` | Phone number, date of birth, the consent status and the adult agreement's version |
| `guardian_consents` | Guardian's name and phone number, and the consent version they agreed to |
| `sessions` | Account id (signed-in sessions; no personal data beyond the id) |
| `profiles` | Name; school, grade, province, a goal in their words; the profile look (theme, avatar, tagline and word ids, 0028); the profile photo's storage key (0029; the photo itself in S3; only when switched on, waits for consent v4) |
| `documents` | Photos and PDFs of school reports (`grade-11-report`), offer letters (`acceptance-letter`) and proofs of registration (`proof-of-registration`), each with the reader's draft until it is confirmed; module outlines (`module-outline`, migration 0040), deleted as soon as the learner has checked one |
| `upload_intents` | The same uploads, while a direct upload is in flight |
| `reports`, `report_marks` | Marks |
| `offers` | Offers |
| `registrations` | Registrations |
| `module_outlines` | Module outlines as checked by the learner, per module and year (migration 0040): whether one was read from an upload (the file itself is gone), never a student number, a class list or a lecturer's personal cellphone number (refused in the database) |
| `module_marks`, `module_targets` | The marks the learner typed for each part of a module (tests, assignments) and their own target, per module and year (migration 0041), for the module card's mark calculator; kept for the academic year plus one, then deleted |
| `first_week_steps` | First-week progress |
| `conversations`, `messages`, `memory_notes` | Chat messages and notes; each AI reply also records which provider and model wrote it (a provider name and a model id, or "system" for a reply no model wrote; migration 0036, A10-49) |
| `reply_reports` | Which AI reply the learner reported and why (harmful, wrong, other): ids and a fixed reason, no text of its own (A10-35), and which provider and model wrote that reply (A10-49) |
| `goals`, `shortlist`, `applications`, `checklist_items`, `exam_subject_choices`, `rechecks` | Goal, shortlist, applications, checklists, exam subjects, re-checks |
| `plan_maps`, `plan_map_nodes` | Plan maps and reflections in their words: a template id, a title, and each part's status, target month and words (migration 0030). The words are refused until consent wording names them (guardian v4, adult-v3, owed legal review), except in the owner's preview |
| `cv_links` | My CV: the learner's opt-in (when, the wording version, the purposes, withdrawn when) and their random reference for Mmereko (migration 0035; only when `UF_CV` is on, waits for consent v4 / adult-v3) |
| `cv_entries` | My CV: projects, skills, work, volunteering, awards, languages and certificates in their words, with evidence links (no ID or student number, refused in the database) |
| `cv_selections` | My CV: what is ticked for the CV, and the contact details typed for it (e-mail, phone, city; never the sign-in phone) |
| `cv_documents` | My CV: the CVs made (text, gaps, ATS numbers, the PDF's key in S3), a job advert's title and company (its text only until the CV is made) |
| `cv_shares` | My CV: recruiter links, from 18 only (refused in the database for anyone younger or without adult-v3): a hash of the link's token, its expiry and how many times it was opened |
| `cv_reports` | My CV: which fitted CV the learner reported and why (untrue, harmful, other): ids and a fixed reason, no CV text of its own (migration 0039, A10-58); deleted with the CV (the learner can delete one CV, A11-38) and with the account |
| `messaging_channels`, `messaging_preferences`, `reminders` | Messaging choices and reminders |
| `push_tokens` | Push token |
| `demo_signups` | **The judge demo only, never the app or production** (a hackathon exception, docs/deploy/demo.md, migration 0034): an adult judge's Firebase sign-in id and email address; deleted with the account 30 days after it was made |
| `audit_log` | Account id, with fixed action words only (who did what, when) |

`cv_deletions` holds no learner's rows: the record that a CV deletion reached Mmereko (the random
reference, when it was asked for and when Mmereko confirmed it), with no link to the student, so
it outlives the account by design.

## Apple: App Privacy

**Do you or your third-party partners collect data from this app?** Yes.

For every type below: **Linked to the user: Yes. Used for tracking: No.** Purpose: **App
Functionality** only (Apple's App Functionality includes security and fraud prevention). No
Analytics, no Product Personalization beyond the app's own function, no Developer's
Advertising, no Third-Party Advertising.

| Apple category | Type | Declare | Notes |
|---|---|---|---|
| Contact Info | Phone Number | ✅ | The learner's, and a guardian's |
| Contact Info | Name | ✅ | Optional first name; a guardian's name; the full name printed on an uploaded letter or proof |
| Contact Info | Physical Address | ✅ | Printed on an uploaded letter or proof, kept with the file (conservative; never read into a row) |
| Contact Info | Email Address | ❌ | Not collected. **Once My CV is switched on** (after consent v4): ✅, an e-mail address the learner may type for their CV |
| User Content | Photos or Videos | ✅ | Photos of reports, offer letters and proofs of registration (and, once switched on after consent v4, the profile photo: purpose App Functionality, not shared) |
| User Content | Other User Content | ✅ | PDFs of reports, offer letters and proofs of registration; confirmed marks, offers, registered modules and first-week progress; chat messages, goals and plans; plan maps and reflections in their words |
| User Content | Emails or Text Messages | ❌ | The chat is "other user content"; inbound SMS/WhatsApp replies (STOP) are kept as an opt-out record only. *Conservative alternative: declare it.* |
| Financial Info | Other Financial Info | ✅ | Fees and amounts owed printed on an uploaded proof of registration, kept with the file (conservative; never read into a row) |
| Financial Info | Payment Info, Credit Info | ❌ | Not collected |
| Identifiers | User ID | ✅ | The account id; the student or applicant number printed on an uploaded letter or proof |
| Identifiers | Device ID | ✅ | The push token (conservative: it identifies the app on a device) |
| Other Data | Other Data Types | ✅ | Date of birth, school, grade, province; the ID number printed on an uploaded letter or proof; keyed hashes for rate limits |
| Location, Health & Fitness, Contacts, Browsing History, Search History, Purchases, Sensitive Info | — | ❌ | Not collected |
| Usage Data, Diagnostics | — | ❌ | **None today. Declare when Sentry or any analytics is connected.** |

**Tracking:** No (`NSPrivacyTracking: false` in the app's privacy manifest; no tracking
domains; no IDFA; App Tracking Transparency not needed).

**My school record** (C2, #83) adds nothing to either form: it lays out the marks the learner
already confirmed, report by report, worked out on the server. Nothing new is collected, sent or
kept for it (refreshed 2026-10-23).

### When My CV is switched on (not today)

Production refuses `UF_CV` until the consent wording names Mmereko, so the first store release
declares none of this. In the same release that switches it on (and before that build is
submitted), change both forms:

| Form | Change |
|---|---|
| Apple: Contact Info → Email Address | ✅ (typed by the learner for the CV), Linked, App Functionality, not tracking |
| Apple: Contact Info → Phone Number, Name, Physical Address | Already ✅; the notes add "typed for the CV" (a phone for the CV, a surname, a city) |
| Apple: User Content → Other User Content | Already ✅; the notes add the CV's entries (projects, skills, work, volunteering, awards, languages, certificates), the CVs made, and a job advert's title and company |
| Google: Personal info → Email address | Collected, optional, App functionality |
| Google: Files and docs | Add the CV PDF |
| Google: App activity → Other user-generated content | Add the CV's entries and the CVs made |
| Google: **Shared?** | Mmereko processes for us under contract (a service provider), so still **No data shared**, unless the legal review says otherwise |
| Both: processors | Move Mmereko from "My CV's operator" into "Processors" above, and name it on `/privacy` (`apps/web/test/privacy-page.test.tsx`) |

The recruiter links (18 and over only) are links the learner makes to their own CV and can
revoke; the recruiter opens our page, not Mmereko's. They are the learner sharing their own
content, not the app sharing data with a third party.

## Google Play: Data safety

**Does your app collect or share any of the required user data types?** Yes.
**Is all of the user data collected by your app encrypted in transit?** Yes (HTTPS only; a
release build refuses a plain-http server address).
**Do you provide a way for users to request that their data is deleted?** Yes: About me →
Delete my account, in the app and on the web (deletes the account, files, chats, offers,
registrations, reminders and push tokens). Give the web address of the same page for the form's
deletion link.

**Shared?** Google's form excludes transfers to service providers that process data on your
behalf. Anthropic, Expo/Apple/Google (push), Meta (WhatsApp) and the SMS provider are such
providers (ElevenLabs receives no user data at all, only public catalogue text), so the
answer is **No data shared**. If the legal review says otherwise for the AI provider, mark
"Messages", "Photos" and "Files and docs" as shared, purpose App functionality.

For each type below: **Collected: Yes. Shared: No. Processed ephemerally: No. Required or
optional:** as shown. **Purpose: App functionality** (plus *Account management* for the phone
number, and *Fraud prevention, security, and compliance* for the keyed hashes and the date of
birth).

| Google category | Data type | Required? |
|---|---|---|
| Personal info | Name | Optional |
| Personal info | Phone number | Required |
| Personal info | Address (printed on an uploaded letter or proof, kept with the file) | Optional |
| Personal info | User IDs (a student or applicant number on an uploaded letter or proof) | Optional |
| Personal info | Other info (date of birth, school, grade, province; an ID number on an uploaded letter or proof) | Date of birth and grade required; the rest optional |
| Financial info | Other financial info (fees and amounts owed on an uploaded proof, kept with the file) | Optional |
| Photos and videos | Photos (reports, offer letters, proofs of registration; once switched on after consent v4, the profile photo, not shared) | Optional |
| Files and docs | Files and docs (PDFs of reports, offer letters and proofs of registration) | Optional |
| Messages | Other in-app messages (chat with the companion) | Optional |
| App activity | Other user-generated content (marks, offers, registered modules, first-week progress, goals, plans, plan maps and reflections) | Optional |
| Device or other IDs | Device or other IDs (push token, account id) | Optional (push token); required (account id) |
| Location, Health and fitness, Audio, Calendar, Contacts, Web browsing, App info and performance | — | Not collected |

**Security practices:** encrypted in transit: yes. Deletion: yes. Committed to Google Play's
Families policy: not applicable (target audience 13 and over; learners from Grade 10, about 15). Independent security review:
no (unless the owner commissions one).

## Keep in step

- The privacy policy on the website (`/privacy`, words in `packages/content`
  `en.privacyPage`) says the same, in plain words a 15-year-old and a guardian understand. It is
  **a template for the legal adviser** until reviewed, with "Owner to fill" lines for the
  responsible party, the information officer, the ECTA s43 details, the SMS company, the
  retention schedule and the PAIA manual. `apps/web/test/privacy-page.test.tsx` fails when an
  operator named under "Processors outside South Africa" (or AWS and Vercel above) is not named
  on the page: add a provider here and there together.
- A new SDK in `apps/native` (an analytics or crash tool especially) changes these answers
  before it ships.
- When the owner decides how long letter and proof files are kept (A11-04, A11-14), update the
  paragraph above, the consent wording (`packages/content` `consent.whatWeKeep` and
  `adultConsent.whatWeKeep`) and, if the files are deleted once confirmed, the address, fees and
  ID-number rows.
