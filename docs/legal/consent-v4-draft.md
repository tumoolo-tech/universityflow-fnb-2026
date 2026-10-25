# Guardian consent v4 and adult agreement v3: DRAFT for legal review

> **DRAFT. Owed legal review (A11-10) and the owner's wording review. Not live.**
> The live wording stays **guardian `v3-2026-10`** (`packages/content/src/en/consent.ts`) and
> **adult `adult-v2-2026-10`** (`packages/content/src/en/adult-consent.ts`). Nothing here is a
> content key yet, and no version is bumped by this document. When the lawyer has approved the
> wording, it becomes content keys and a version bump in one change, with the database refusing
> each new kind of information under older wording (as migration 0021 does for letters).

Written 2026-10-23 by the A10 agent (S1 session 5). Sources: the current guardian consent and
adult agreement, the privacy page template (`en.privacyPage`,
`packages/content/src/en/privacy-page.ts`), the legal and regulatory brief
(`docs/research/2026-10-22-legal-and-regulatory-brief.md`), and three proposals in the
`UniversityFlow-proposals` worktree (read only): the Mmereko CV API (§7–9), the portfolio (§9–10)
and Phases 6 and 7 (module outlines; marked tests). Every fact about a provider's terms was read
on 2026-10-23 and must be re-checked before launch.

## 0. How to read this

- **Part 1** lists every change with the **current wording**, the **proposed wording**, **what it
  covers** and **why**. The proposed lines for the learner are written for a Grade 8 reader: short
  sentences, everyday words, "you".
- **Part 2** puts the proposed text together, as the guardian and the learner would read it.
- **Part 3** is the table of operators and countries, today and with v4.
- **Part 4** lists the questions for the lawyer.
- A change marked **(if built)** describes a feature that is designed but not live. Its wording
  goes in v4 so that one review and one re-consent cover it; the feature stays off until then (each
  has a server switch refused in production: `UF_PROFILE_PHOTO`, `UF_MINDMAP_WORDS`, and `UF_CV`
  as proposed).
- Who reads what: a learner **under 18** cannot consent in law (POPIA s34–35): their **guardian**
  agrees to **guardian v4**. A learner **18 or older** agrees in their own name to **adult v3**.
  The brief (item 18) also asks that a minor sees and taps the AI-sharing part themselves: Part 2.3
  is a short learner version for that.

## Summary of changes

| # | Change | Guardian v4 | Adult v3 | Feature gate | Source |
|---|---|---|---|---|---|
| C1 | Who we are, the Information Officer, the right to complain | Yes | Yes | None (transparency, s18) | Brief §1.1 |
| C2 | How long the AI provider keeps what it is sent | Yes | Yes | None | Brief §1.7, item 8; L-7 |
| C3 | Sensitive information in chat; a person may read a reported or flagged reply | Yes | Yes | None (already happens) | A11-21, L-3; brief §1.3, items 3, 5 |
| C4 | The guardian's permission lasts until the learner turns 18 | Yes | (n/a) | None | L-7, A11-25; brief §2 |
| C5 | A profile photo | Yes | Yes | `UF_PROFILE_PHOTO` | A11-31; profile proposal §5.3 |
| C6 | Plan maps in the learner's own words | Yes | Yes | `UF_MINDMAP_WORDS` | Plan-maps proposal §5 (option A) |
| C7 | A CV made by Mmereko; recruiter links from 18 | Yes | Yes (with sharing) | `UF_CV` (proposed) | Mmereko proposal §9.2 |
| C8 | Portfolio projects and evidence links (and GitHub from 18) | Yes | Yes (with sharing) | Portfolio switch (proposed) | Portfolio proposal §10 |
| C9 | Module outlines, marked tests, past papers, study plans | Yes | Yes | Phase 6 and 7 uploads | Phase 6 proposal; Phase 7 proposal F1, D2 |
| C10 | Read aloud (ElevenLabs) | Yes | Yes | `UF_ELEVENLABS_MINORS_APPROVED` | A11-30; privacy page |
| C11 | Google Gemini, only if it is ever used beyond the judge demo | Placeholder only | Placeholder only | Refused in production | Audit S1-A10b (A10-46) |

---

## Part 1: each change

### C1. Who we are, our Information Officer, and the right to complain

| | Wording |
|---|---|
| **Current (v3 and adult-v2)** | Not in the consent. The consent never names the responsible party, the Information Officer or the Information Regulator. |
| **Proposed, guardian** | "UniversityFlow is run by [**Owner to fill: full legal name**]. Our Information Officer is [**name**], [**email**], [**phone**]. If you are unhappy with how we use your child's information, tell them. You can also complain to the Information Regulator: 010 023 5200, POPIAComplaints@inforegulator.org.za. Our privacy policy has the full details: [link]." |
| **Proposed, learner (adult v3)** | "UniversityFlow is run by [**name**]. If you are unhappy with how we use your information, contact [**Information Officer, email, phone**]. You can also complain to the Information Regulator: 010 023 5200, POPIAComplaints@inforegulator.org.za. Read our full privacy policy here: [link]." |
| **What it covers** | POPIA s18 (what a person must be told when information is collected): the responsible party's name and address, and the right to complain to the Regulator. |
| **Why** | The brief §1.1 lists this as a gap in the consent. The privacy page (`en.privacyPage`) carries it, but the consent is where the agreement is recorded. The Regulator's numbers are the privacy page's (read from inforegulator.org.za on 2026-10-23). |

### C2. How long the AI provider keeps what it is sent

| | Wording |
|---|---|
| **Current (v3)** | "…parts of it are sent to our AI provider, which processes it outside South Africa and does not keep it for training." |
| **Current (adult-v2)** | "…parts of it are sent to our AI provider, which processes it outside South Africa and does not keep it for training." |
| **Proposed, guardian** | "Our AI provider is Anthropic, in the United States. It does not use your child's information to train its AI. It deletes what we send within 30 days. If its safety checks flag a message, it may keep that message longer (up to 2 years) to keep its service safe." |
| **Proposed, learner** | "Our AI provider is Anthropic, in the United States. It does not use your information to train its AI. It deletes what we send within 30 days. If its safety checks flag a message, it may keep it longer (up to 2 years) to keep its service safe." |
| **What it covers** | Naming the AI provider and its country; its retention. |
| **Why** | Brief §1.7 and item 8: Anthropic deletes API inputs within 30 days by default and keeps flagged content up to 2 years. Crisis messages are the most likely to be flagged. s18 transparency; s72(1)(b) consent as a backup basis for the transfer. **If Anthropic agrees to zero data retention** (the brief recommends asking), replace the last two sentences with "It does not keep what we send." |

### C3. Sensitive information in chat, and when a person reads it

| | Wording |
|---|---|
| **Current (v3)** | "Chats with them about their goals and studies. If they seem to be in distress, it gives them helpline numbers." |
| **Current (adult-v2)** | "Chats with you about your goals and studies. If you seem to be in distress, it gives you helpline numbers." |
| **Proposed, guardian** | "In the chat, your child may tell the AI about their health, their feelings, their family, or something that happened to them. That information is sent to the AI provider like any other message, and kept with their chats until they delete it or their account. If a message shows they may be in danger, the chat shows helpline numbers straight away. If your child reports an AI reply, a person at UniversityFlow reads that reply. [**Owner and lawyer to fill: when a person reads a chat because of a safety concern, who that is, and when we might have to tell someone else, such as the police, by law.**]" |
| **Proposed, learner** | "In the chat you might tell the AI about your health, your feelings, your family or something that happened to you. That is sent to the AI provider like any other message. It is kept with your chats until you delete it. If you seem to be in danger, the chat shows helpline numbers straight away. If you report an AI reply, a person at UniversityFlow reads it. [**Same fill as the guardian's.**]" |
| **What it covers** | Special personal information (POPIA s26: health, sex life, criminal behaviour) shared in chat; the "Report this reply" control (A10-35, built) and any human review of crisis turns. |
| **Why** | A11-21 and the brief §1.3: UniversityFlow is not a body s32 authorises, so it relies on **consent** (s27(1)(a)), which must be specific and informed. Item 5: the safeguarding policy decides when a disclosure is reported (Sexual Offences Act s54, Children's Act s110); the consent must not promise secrecy it can't keep. The store forms ("Health" and "Sensitive info" not collected) must change with this. |

### C4. The guardian's permission lasts until the learner turns 18

| | Wording |
|---|---|
| **Current (v3)** | "You can withdraw permission at any time with this same link. We stop using their information at once." Nothing says when the permission ends. |
| **Proposed, guardian** | "Your permission lasts until your child turns 18, unless you withdraw it first. On their 18th birthday it ends. From then, your child decides for themselves. Until they agree in their own name, we keep their information but don't use it, and send them no reminders." |
| **What it covers** | The duration of a competent person's consent; the gap after 18 (storage only). |
| **Why** | L-7 and A11-25 (both homes already tell the learner before the birthday); brief §2 ("the guardian v4 text should say the consent lasts until the learner turns 18"). Whether "agree ahead" is allowed is a question for the lawyer (Part 4, Q6). |

### C5. A profile photo (if built)

> **Updated 2026-10-23 (late), the owner's decision:** learners **from Grade 10** may upload their
> own photo for their profile, to keep them motivated, **"as long as the picture is not used for
> anything else"**. The proposed lines below now say so in those words. They are also content keys
> that are **not live** (`en.profilePhotoDraft.guardianLine`, `.adultLine`, and `.privacy` for the
> privacy policy; packages/content/src/en/profile-photo-draft.ts), so the approved wording goes live
> by moving them, not by retyping them. The database already refuses a photo under older wording
> (migration 0037, A11-31); the switch-on is docs/deploy/profile-photo.md.

| | Wording |
|---|---|
| **Current** | Not named. The privacy page lists it under "Coming later: a profile photo, if you choose to add one." |
| **Proposed, guardian** | "If your child chooses, a photo of themselves for their own profile, from Grade 10. Only they can see it. We don’t use it for anything else: it is never sent to the AI provider, put on a CV or shown to anyone. It is stored in South Africa. They can remove it at any time, and it is deleted with their account or if you withdraw permission." |
| **Proposed, learner** | "If you choose, a photo of yourself for your own profile. Only you see it. We don’t use it for anything else: it never goes to the AI, a CV or anyone else. It is stored in South Africa. Remove it any time. It is deleted with your account." |
| **Proposed, privacy policy** (replaces the "Coming later" line) | **Your profile photo.** If you choose, a photo of yourself for your About me card, from Grade 10. Only you see it. · We use it for nothing else. It is never sent to our AI provider, never put on a CV or sent to Mmereko, and never shown to anyone else, a recruiter or your parent or guardian included. · We keep one copy: cropped to a square, 512 by 512 pixels, in black and white, with its hidden details (such as where it was taken) removed. It is stored in South Africa. · Remove it at any time under About me. It is deleted with your account, and if a parent or guardian withdraws their permission. · It is in the copy of your information you can download. |
| **For the lawyer** | (a) Is "used for nothing else" a promise we should make in the consent itself (it is what the build enforces: apps/web/test/photo-used-for-nothing-else.test.ts)? (b) The guardian never sees the photo: is that right for a 15-year-old, or should a guardian be able to see what was uploaded? (c) A photo kept from before a learner's wording named it is not shown, and is deleted when they remove it, at withdrawal or with the account: is keeping it unshown until then acceptable, or must it be deleted at once? |
| **What it covers** | A photo of the learner's face, uploaded by them (migration 0029; behind `UF_PROFILE_PHOTO`, refused in production). Location data is stripped on upload; 512x512 at most. |
| **Why** | A11-31: today the only gate is a switch; the photo needs consent wording and a database check like 0021. A face photo of a minor is personal information (s34); it would be biometric (s26) only if processed for recognition, which it never is. Profile proposal §5.3. |

### C6. Plan maps in the learner's own words (if built)

| | Wording |
|---|---|
| **Current** | v3 names "the offers, registered modules and first-week progress they confirm" and "chats about their goals". Nothing names written plans or reflections. The privacy page lists "Your own words in a plan map" under "Coming later". |
| **Proposed, guardian** | "Plans your child writes in their own words under My goal, including what got in the way and what they could try next. Only they can see them. They are not sent to the AI provider. If the words sound like your child is struggling, the app shows them helpline numbers. Nobody is told." |
| **Proposed, learner** | "Plans you write in your own words, including what got in the way and what you could try next. Only you see them. They are not sent to the AI provider. If your words sound like you're struggling, we show you helpline numbers. Nobody else is told." |
| **What it covers** | Free text in plan maps (title, each part, "what got in the way", "what I could try differently"); behind `UF_MINDMAP_WORDS`. Statuses and template stops already work under v3. |
| **Why** | Plan-maps proposal §5 option A (approved): reflections may touch health or family, a new kind of information a guardian has not seen named (s34–35). The crisis check runs on our server as fixed rules, not AI; no person and no AI reads the words. |

### C7. A CV made by Mmereko, and recruiter links from 18 (if built)

| | Wording |
|---|---|
| **Current** | Not named. Mmereko is not an operator today. |
| **Proposed, guardian** (Mmereko proposal §9.2, lightly shortened) | "If your child chooses to make a CV, we send only what they tick for it (their school, subjects, any marks they tick, and projects and skills in their own words) to Mmereko. Mmereko is a company that makes the CV file for us, in South Africa, and deletes what we sent within a day. We never send their phone number, ID number or date of birth. If they ask for a CV fitted to a job advert, our AI provider writes the fitted version. Nobody else sees a CV made before your child turns 18." |
| **Proposed, learner, under 18 (opt-in card)** | "Make a CV with Mmereko. Mmereko is a company that turns what you choose into a CV file. We send it only what you tick on this page, never your phone number or ID number. It keeps it only until your CV is made, at most one day, in South Africa. You can stop any time." |
| **Proposed, learner, adult v3** | The opt-in card, plus: "From 18 you can make a link to share your CV with a recruiter. Anyone with the link can see that CV until the link expires or you switch it off. We count how often it is opened, but we don't know who opened it." |
| **Withdrawal** | "Stop using Mmereko? We'll switch off your share links and ask Mmereko to delete anything it still has. You can download your CVs first." |
| **What it covers** | Mmereko as an **operator** (POPIA ss 20–21) running in **AWS af-south-1 (Cape Town)**, keeping request content **at most 24 hours** (job records with ids only for 30 days, audit records with ids only for 12 months); the learner's own separate opt-in; share links served by UniversityFlow from 18 only, 30 days by default (7–90), revocable. |
| **Why** | Mmereko proposal §7–9. The wording is true **only with option A** (Mmereko's partner cell in af-south-1, §8). If the owner chooses Mmereko as it is today (Supabase, region unconfirmed, likely abroad), the wording must name the country and the cross-border basis (s72), and planning.md §0's "student data stays in South Africa" is re-planned. Share links make the learner's information available to a person we don't know: that is the learner's own disclosure, so adults only (s34–35; Mmereko proposal §9.3). Mmereko is a Tumoolo product: see Part 4, Q9. |

### C8. Portfolio projects and evidence links (if built)

| | Wording |
|---|---|
| **Current** | Not named. |
| **Proposed, guardian** (portfolio proposal §10, adapted to its D9 recommendation) | "Projects your child adds to their portfolio: their words, photos and files they upload, and links they add. Only they can see them. Nobody else can see them while they are under 18. The files are stored in South Africa. The AI suggests projects from their modules and can help with a project they ask it about, which sends what they write about it to the AI provider." [**Engineers: confirm against the build; the proposal's §4.4 sends the AI the module codes and topics, and "later coaches the work".**] |
| **Proposed, learner** | "Projects you add to your portfolio: your words, photos and files you upload, and links you add. Only you see them." From 18, add: "You can make a link that shows the projects you choose to someone else, such as a recruiter. Links expire, and you can switch them off at any time. If you connect GitHub, GitHub (in the United States) learns that you use UniversityFlow, and we read a short summary of the projects you choose, never your code. If you turn on Mmereko, the projects you choose are sent to Mmereko to build your CV." |
| **What it covers** | Portfolio items, uploads (S3 af-south-1, private), links (shown as text, no previews fetched), GitHub App connection (read-only, selected repositories, a summary only: languages, commit weeks, README and test presence), share links and view counts. |
| **Why** | Portfolio proposal §10: project words may be about health, family or community (treat as sensitive). GitHub is a new operator abroad (s72); the proposal recommends **no GitHub connection under 18** (links to public repositories only), so GitHub appears only in adult v3. |

### C9. Module outlines, marked tests, past papers and study plans (if built)

> **Updated 2026-10-24 (Phase 6b, the owner approved D9 and D10): module outlines are built, behind
> this wording.** The database refuses an outline upload, and an outline read from one, unless the
> learner's recorded consent is guardian v4 or adult-v3 (migration 0040, as 0021 does for letters);
> an outline typed in by hand needs only consent. What is kept from an outline, once the learner
> has checked it part by part: the module's code and name, how its marks work (the parts and what
> each counts for, the DP rule and subminima as printed), its dates, its books, and its lecturers'
> **work** details only (name, role, work email, office phone, office, consultation times). A
> lecturer's personal cellphone number or email, a class list and any student number are never
> kept (D3). **The outline file itself is deleted as soon as the learner has checked it** (D10),
> so the C9 file sentence below is stricter for outlines than "until they delete it". Proposed
> wording to add, DRAFT for the lawyer:
>
> - **Guardian:** "At university, your child can upload the outline for each module. It is sent
>   to the AI provider whole, so it sees what is printed on it, which may include their lecturers'
>   names and work details and other students' names. We keep only what your child checks: how
>   the marks work, the dates, the books, and lecturers' work contact details, never a personal
>   cellphone number or another student's name. The outline file is deleted as soon as they have
>   checked it."
> - **Learner (adult v3):** "You can upload the outline for each module. The whole outline goes to
>   the AI, so it sees everything on it, like lecturers' details or a class list. We keep only what
>   you check: how marks work, dates, books, and lecturers' work details. We never keep a personal
>   cellphone number or other students' names. The file is deleted once you've checked it."
> - **For the lawyer (adds to Q13):** keeping lecturers' work details for the learner's own use,
>   without telling the lecturer (s18(4)); and whether "deleted once checked" should be promised in
>   the consent itself (it is what the build does).
> - **The judge demo (hackathon exception I, docs/deploy/hackathon-undo-pr.md):** the demo's three
>   made-up university learners record this draft adult-v3 (`adult-v3-draft-demo-only`) so the
>   judges can upload the SAMPLE outline. No real person agrees to it; the production gate is
>   unchanged.

| | Wording |
|---|---|
| **Current (v3)** | "Reads an offer letter or proof of registration the learner uploads (after they check every detail)…" and "An offer letter or proof of registration is sent to the AI provider whole, so it sees everything printed on it, such as an ID number, student number, home address or fees…" |
| **Proposed, guardian** | Replace the two sentences with: "Reads documents your child uploads, after they check every detail: school reports, offer letters, proofs of registration, and at university their module outlines, marked tests and past papers. Each document is sent to the AI provider whole, so it sees everything printed on it, such as a name, ID number, student number, home address or fees. From it we keep only the details your child checks, not those numbers, the address or the fees. The file itself stays in South Africa until they delete it or their account." And add: "At university, a study plan built from their tests and the times they say they are busy. The words they type about busy times are read by the AI to make the plan, and are not kept." |
| **Proposed, learner** | "We read documents you upload, after you check every detail: school reports, offer letters, proofs of registration, and at university your module outlines, marked tests and past papers. The whole document goes to the AI provider, so it sees everything printed on it, like your name, ID number, student number, address or fees. We keep only what you check, not those numbers. The file stays in South Africa until you delete it." Plus: "A study plan from your tests and the times you're busy. The AI reads what you type about busy times to make the plan. We don't keep those words." |
| **What it covers** | Phase 6's `module-outline` document kind (lecturers' work contact details as printed, D3) and Phase 7's marked tests and past papers (the extraction never returns the name, student number, marker's comments or question text; the file still shows them), and Phase 7's busy-time words (handled as chat, never stored, D11). |
| **Why** | Phase 7 proposal F1 and D2 (recommended: name them in the one v4 bump; uploads refused under older wording, typed-in marks allowed under v3). A marked test is sent whole with the learner's name and student number, exactly the case A11-13 fixed for letters. Phase 6 reuses 0021's consent gate, but v3 does not name module outlines. Phase 7 is planned for university students only (D1), so in practice these lines matter to adults; they stay in the guardian text because some first-years are still 17. **Retention:** "until they delete it" is the v3 position; brief §1.1 and A11-04 say a schedule is owed (Part 4, Q4). |

### C10. Read aloud (ElevenLabs)

| | Wording |
|---|---|
| **Current** | Not in the consent. The privacy page names ElevenLabs: "Public text from our campus guide only… Never anything about you", and "Read aloud stays off for learners until ElevenLabs gives its written approval for use by people under 18." |
| **Proposed, guardian** | "Read aloud: the app can read campus information out loud. The voice is made by ElevenLabs, outside South Africa. We send ElevenLabs only our own public text, such as a building's name and opening hours, from our server. Nothing about your child is sent: not their name, number or chats." |
| **Proposed, learner** | "Read aloud: the app can read campus information out loud. The voice comes from ElevenLabs, outside South Africa. We only send it our own public text, like a building's opening hours. Nothing about you is sent." |
| **What it covers** | `/api/speech/[place]`: the place id is the only input; the words are built on the server from the catalogue; audio is cached. ElevenLabs sees our server, not the learner's device. |
| **Why** | Not personal information, so not strictly needed for POPIA consent; included for transparency (s18) and the store forms. The live gate is ElevenLabs' **written approval for under-18s** (`UF_ELEVENLABS_MINORS_APPROVED`, A11-30), not this wording. |

### C11. Google Gemini, only if it is ever used beyond the judge demo

| | Wording |
|---|---|
| **Current** | Not named. Production refuses `UF_AI_PROVIDER=gemini` and `GEMINI_API_KEY` (config.ts). The judge demo uses made-up learners only. |
| **Proposed (placeholder, not for use until Q11 is answered)** | Guardian: "Our AI providers are Anthropic and Google, both in the United States. If one is not working, the other answers instead. Neither uses your child's information to train its AI. [**Retention for each, from their terms.**]" Learner: the same in "you" form. |
| **What it covers** | A second AI provider (an operator abroad, s72), used as the first choice or as a fallback. |
| **Why it is only a placeholder** | **Google's Gemini API Additional Terms of Service** (last modified 2026-04-28, read 2026-10-23) say: "You must be 18 years of age or older to use the APIs", and the Services may not be used in a service "that is directed towards or is likely to be accessed by individuals under the age of 18". UniversityFlow is built for learners from 14. Under these terms, **no consent wording makes Gemini usable for learners**; only a different contract with Google could (Q11). Also: on Google's free tier, prompts may be used to improve Google's products and read by people, so only the Paid tier could ever be considered. Audit S1-A10b, A10-46 and A10-50. |

---

## Part 2: the proposed text, put together

The bracketed fills are the owner's or the lawyer's. "(if built)" lines are shown only while that
feature is switched on, or all are shown once and the features follow: the lawyer decides (Q2).

### 2.1 Guardian consent v4

**A learner has asked for your permission**

A learner who named you as their [relationship] wants to use UniversityFlow. Because they are
under 18, the law (POPIA) says we need your permission first.

**What UniversityFlow does**

- Reads documents your child uploads, after they check every detail: school reports, offer
  letters, proofs of registration, and at university their module outlines, marked tests and past
  papers. Shows which university courses their marks qualify for.
- Helps them with application deadlines, documents and NSFAS funding.
- Chats with them about their goals and studies. If they seem to be in distress, it gives them
  helpline numbers.
- Sends them reminders about deadlines and exams by SMS, WhatsApp or app notification, but only
  the ones they turn on. They can turn each one off at any time, or reply STOP.
- Reads campus information out loud, if they press Read aloud.
- (if built) Lets them write plans in their own words, add a profile photo, keep a portfolio of
  projects, make a CV with Mmereko, and at university build a study plan.

**What we keep, and who helps us**

- Their cellphone number, date of birth, marks, uploaded documents and chats, and the offers,
  registered modules and first-week progress they confirm. (if built) Their plans, profile photo,
  portfolio, CVs and study plans.
- Everything is stored in South Africa.
- **The AI provider.** To read documents and to chat, parts of it are sent to Anthropic, in the
  United States. It does not use your child's information to train its AI. It deletes what we
  send within 30 days. If its safety checks flag a message, it may keep that message longer (up
  to 2 years) to keep its service safe.
- **Whole documents.** Each document is sent to the AI provider whole, so it sees everything
  printed on it, such as a name, ID number, student number, home address or fees. From it we keep
  only the details your child checks, not those numbers, the address or the fees. The file itself
  stays in South Africa until they delete it or their account.
- **Sensitive things in chat.** Your child may tell the AI about their health, their feelings,
  their family, or something that happened to them. That is sent to the AI provider like any other
  message, and kept with their chats until they delete it or their account. If your child reports
  an AI reply, a person at UniversityFlow reads it. [Fill: when a person reads a chat for safety,
  and when the law may require us to tell someone.]
- **Reminders** are delivered by other companies. An SMS goes through an SMS company that sends
  texts for us. A WhatsApp message goes through WhatsApp, which is owned by Meta. An app
  notification goes through Expo (in the United States) and then Apple or Google. They get only
  the phone number or the phone's notification code, and the message, and handle it outside South
  Africa.
- **Read aloud** uses ElevenLabs, outside South Africa. We send it only our own public text, such
  as a building's opening hours. Nothing about your child.
- (if built) **Plans in their own words.** Only they can see them. They are not sent to the AI
  provider. If the words sound like your child is struggling, the app shows helpline numbers.
  Nobody is told.
- (if built) **A profile photo.** Only they can see it. It is never sent to the AI provider or
  anyone else.
- (if built) **Their portfolio.** Projects, files and links they add. Only they can see them while
  they are under 18. If they ask the AI about a project, what they write about it goes to the AI
  provider.
- (if built) **A CV with Mmereko.** If your child chooses, we send only what they tick for it to
  Mmereko, a company that makes the CV file for us in South Africa and deletes what we sent within
  a day. Never their phone number, ID number or date of birth. Nobody else sees a CV made before
  they turn 18.
- (if built) **A study plan at university.** The words they type about when they are busy are
  read by the AI to make the plan, and are not kept.
- We never sell it, never use it for advertising, and never log into any university system as
  your child.

**How long your permission lasts**

Your permission lasts until your child turns 18, unless you withdraw it first. On their 18th
birthday it ends, and they decide for themselves. Until they agree in their own name, we keep their
information but don't use it, and send them no reminders.

**Your rights**

- You can withdraw permission at any time with this same link. We stop using their information at
  once.
- The learner can see, download or delete everything we hold, at any time.
- UniversityFlow is run by [Fill: full legal name]. Our Information Officer is [Fill: name, email,
  phone]. If you are unhappy with how we use your child's information, tell them. You can also
  complain to the Information Regulator: 010 023 5200, POPIAComplaints@inforegulator.org.za. The
  full privacy policy: [link].

I am this learner's parent or legal guardian and I agree. · I don't agree

### 2.2 Adult agreement v3 (the learner, 18 or older)

**Before you start**

You're 18 or older, so this is your choice. Here is what UniversityFlow does with your information,
and who helps us.

**What UniversityFlow does**

- Reads documents you upload, after you check every detail: school reports, offer letters, proofs
  of registration, and at university your module outlines, marked tests and past papers.
- Shows which courses your marks qualify for, and helps with deadlines, documents and NSFAS.
- Chats with you about your goals and studies. If you seem to be in distress, it gives you
  helpline numbers.
- Sends you reminders by SMS, WhatsApp or app notification, but only the ones you turn on.
- Reads campus information out loud, if you press Read aloud.
- (if built) Plans in your own words, a profile photo, a portfolio, a CV with Mmereko, and a study
  plan at university.

**What we keep, and who helps us**

- Your number, date of birth, marks, uploads and chats, and the offers, modules and first-week
  progress you confirm. Everything is stored in South Africa.
- **The AI.** To read your documents and to chat, parts of it go to Anthropic, in the United
  States. It does not use your information to train its AI. It deletes what we send within 30
  days. If its safety checks flag a message, it may keep it longer (up to 2 years) to keep its
  service safe.
- **Whole documents.** The whole document goes to the AI, so it sees everything printed on it,
  like your name, ID number, student number, address or fees. We keep only what you check. The
  file stays in South Africa until you delete it.
- **Sensitive things in chat.** You might tell the AI about your health, your feelings, your family
  or something that happened to you. That goes to the AI like any other message, and is kept with
  your chats until you delete it. If you report an AI reply, a person at UniversityFlow reads it.
  [Fill: as the guardian's.]
- **Reminders** go through an SMS company, WhatsApp (owned by Meta), and for app notifications
  Expo (in the United States) and then Apple or Google. They get your number or notification code
  and the message, outside South Africa.
- **Read aloud** uses ElevenLabs, outside South Africa. We only send our own public text. Nothing
  about you.
- (if built) **Your plans** in your own words: only you see them, and they don't go to the AI. If
  your words sound like you're struggling, we show you helpline numbers. Nobody else is told.
- (if built) **A profile photo:** only you see it. It never goes to the AI or anyone else.
- (if built) **Your portfolio:** only you see it, unless you make a link to share it. Links expire,
  and you can switch them off at any time. If you connect GitHub, GitHub (in the United States)
  learns that you use UniversityFlow, and we read a short summary of the projects you choose,
  never your code.
- (if built) **A CV with Mmereko:** we send only what you tick, never your number or ID number.
  Mmereko makes the file in South Africa and deletes what we sent within a day. You can make a
  link to share your CV with a recruiter. Anyone with the link can see that CV until it expires or
  you switch it off. If you ask for a CV fitted to a job advert, the AI writes it.
- (if built) **A study plan:** the AI reads what you type about when you're busy, to make the
  plan. We don't keep those words.
- We never sell your information, never use it for advertising, and never log into any university
  system as you.

**Your rights**

- See, download or delete everything we hold about you, at any time, under About me.
- Turn any reminder off at any time, or reply STOP.
- UniversityFlow is run by [Fill]. Questions or complaints: [Fill: Information Officer, email,
  phone]. You can also complain to the Information Regulator: 010 023 5200,
  POPIAComplaints@inforegulator.org.za. Full privacy policy: [link].

I agree to this

### 2.3 What a learner under 18 sees and taps (new)

The brief (item 18; Apple 5.1.2(i)) asks that a minor sees the AI sharing themselves, not only the
guardian. Shown once, before the guardian link is sent; the tap is recorded with the version.

> **Before we ask your parent or guardian**
>
> - UniversityFlow uses AI. The AI is not a person.
> - What you type in the chat, and documents you upload, go to our AI company, Anthropic, in the
>   United States. It deletes them within 30 days, or keeps flagged messages longer for safety.
> - Don't put things in the chat you don't want the AI to read. If you're in danger, we show you
>   helpline numbers.
> - Your parent or guardian must say yes before we use anything about you.
>
> [I understand]

---

## Part 3: operators and countries

| Operator | What it does | What it receives | Where | Today (v3) | v4 / adult v3 | s72 basis to record (Legal) |
|---|---|---|---|---|---|---|
| Amazon Web Services | Database and file store | Everything we keep, encrypted | Cape Town, South Africa (af-south-1) | Named ("stored in South Africa") | Unchanged | Not a transfer |
| Vercel | Runs the website and API | Each request, with the device's IP address | Cape Town region (cpt1); a US company | Privacy page only | Unchanged; logs' location is an open s72 question (brief §1.4) | Q8 |
| Anthropic | The AI: chat, reading documents, CV tailoring | Chat messages; whole documents; CV content the learner ticks for a tailored CV | United States | Named as "our AI provider" | **Named, with retention (C2)** | DPA with EU SCCs (s72(1)(a)); consent (s72(1)(b)) as backup |
| SMS company | PINs, the guardian link, SMS reminders | Phone number and message | [Owner to fill] | Named generically | Unchanged | [Fill] |
| Meta (WhatsApp) | WhatsApp reminders | Phone number, fixed message, replies | Outside South Africa | Named | Unchanged | Q8 |
| Expo, then Apple or Google | App notifications | Push token, a fixed sentence | United States and outside South Africa | Named | Unchanged | Q8 |
| ElevenLabs | The voice of Read aloud | Public catalogue text only; nothing about the learner | Outside South Africa | Privacy page only | **Named (C10)** | Not personal information |
| Background-job service | Runs scheduled work | Account ids only | [Owner to fill] | Privacy page only | Unchanged | [Fill] |
| **Mmereko** (if built) | Makes CV files | Only what the learner ticks; never phone, ID or date of birth | **AWS af-south-1 (Cape Town)**, option A only | Not named | **Named (C7)** | Not a transfer under option A; s72 if not |
| **GitHub** (if built, 18+) | Read-only summary of chosen repositories | That the learner uses UniversityFlow; repository metadata | United States | Not named | **Named in adult v3 (C8)** | Q8 |
| **Google (Gemini)** | Not used for learners | Nothing (production refuses it); the judge demo sends made-up learners' chats | United States | Not named | **Placeholder only (C11)** | Not usable for under-18s under Google's terms (Q11) |

---

## Part 4: questions for the lawyer

1. **s57 prior authorisation (brief item 1).** Does s57(1)(d) apply to sending children's and
   special personal information to Anthropic (and, if built, GitHub)? If it might, the brief says
   file by about **2 November 2026** for a 1 March 2027 launch. Does v4's wording change the
   answer?
2. **One version or several?** Should v4 name every "(if built)" feature now (one review, one
   re-consent of every guardian), or should each feature get its own version when it ships? Can a
   feature that is named but not yet built be agreed to in advance?
3. **Special personal information (C3).** Is the C3 wording enough for specific, informed consent
   under s27(1)(a) for health, sex life and criminal-behaviour information in chat? Must it be a
   separate tick-box from the main consent?
4. **Retention (C9, A11-04).** Is "until they delete it" defensible under s14 for whole documents
   showing an ID number, address or fees, once the details are confirmed? What period should the
   schedule set (the brief suggests deleting the file N days after confirmation unless pinned)?
5. **Safeguarding and mandatory reporting (C3).** What must the consent say about when a person
   reads a chat for safety, and when UniversityFlow may have to tell SAPS or a social worker
   (Sexual Offences Act s54, Children's Act s110, FPA s24C)? How do we word it without
   discouraging a child from asking for help?
6. **Turning 18 and "agree ahead" (C4).** Is the C4 wording right? May a 17-year-old agree to
   adult v3 in advance, guardian-assisted, or only on or after the birthday (brief §2)? Is keeping
   but not using the information during the gap justified (s11(1)(d) or (f))?
7. **The minor's own acknowledgement (Part 2.3).** Is a learner's own "I understand" useful
   evidence alongside the guardian's consent, or could it confuse who consented?
8. **Cross-border basis (Part 3).** Which s72 basis do we rely on for each operator abroad, and
   must the consent say it? Do Vercel's logs (cpt1 runtime, US company) count as a transfer?
9. **Mmereko (C7).** Mmereko is a Tumoolo product with the same owner. Is it an operator (ss 20–21)
   or part of the responsible party? Which legal person signs the operator agreement? If Mmereko
   cannot run in af-south-1, what must the wording say about its country?
10. **Share links from 18 (C7, C8).** Is a learner's own share link to a recruiter their own
    disclosure, with UniversityFlow only the host? Do we need terms of use for recruiters who open
    a link? Is a view count without viewer details acceptable?
11. **Google Gemini (C11).** Google's Gemini API terms (2026-04-28) require users to be 18 or older
    and forbid services "likely to be accessed by individuals under the age of 18". (a) Is the
    public judge demo, used by adult judges with made-up learners, within those terms, or must it
    be gated or moved to Anthropic? (b) Would a different contract (for example Vertex AI under
    Google Cloud's terms, possibly in a South African region) allow use for minors? Until both are
    answered in writing, Gemini stays out of production and out of every consent.
12. **Read aloud (C10).** ElevenLabs receives no personal information. Is naming it in the consent
    useful, or should it stay on the privacy page only? Does ElevenLabs' under-18 restriction
    apply when it never sees the user?
13. **Lecturers' details (C9).** Module outlines print lecturers' work contact details. Is keeping
    the work contact (private to the learner) acceptable without notifying the lecturer (s18(4)
    exceptions)?
14. **Store forms.** With C3, should the Apple and Google data-safety forms declare "Health" and
    "Sensitive info" as collected (brief item 3)?
15. **Reading level.** Is the plain wording in Part 2 legally sufficient, or does any line need a
    more formal version beside it?

## Part 5: what the build must do when this is approved (for the engineers)

- New content keys for every line, the guardian version `v4-…` and adult `adult-v3-…`, with the
  old versions kept for the record.
- A migration like 0021 per new kind of information, refusing it under older wording: the photo
  (A11-31), plan-map words, CV entries and requests, portfolio items and share links, module
  outlines, marked tests and past papers. Share rows refused under 18 or without adult v3.
- Every existing guardian asked again (the "Send the new link" flow), and every adult asked again
  before anything new is used (`needsAdultConsent`).
- The privacy page (`en.privacyPage`): move each built feature from "Coming later" into "What we
  collect", add Mmereko and GitHub to "Who helps us", and keep the operators' list in step with
  Part 3. The store forms change with C3.
- Red team: plan-map words, CV entries and portfolio words are crisis-checked as plan maps are
  (an A10 round for each new surface).
