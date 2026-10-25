# UniversityFlow: legal and regulatory research brief

> **Checked by the session that commissioned it (2026-10-22).** Confirmed at the source:
> Anthropic's Usage Policy takes effect **12 November 2026** and lists high-risk "AI
> Recommendation" areas that need a qualified human in the loop and disclosure, among them
> "Education and credentials" ("admitting, rejecting, or ranking applicants; grading an exam or
> assessment that determines admission…") and "Public benefits and services" ("determining
> eligibility for, or the amount of, government benefits, assistance, or essential services");
> "general information or educational content" is excluded only when it isn't applied to the
> individual's circumstances (https://www.anthropic.com/legal/aup). UniversityFlow doesn't
> admit, reject or rank applicants (code checks published minimums; universities decide), so
> today's product is probably outside "Education and credentials", but that is the legal
> reviewer's call; NSFAS eligibility help (gate H3) would be inside "Public benefits". The POPIA
> s57 trigger for children's information sent abroad is confirmed in secondary sources, which
> differ on its exact scope: read the Act and the Regulator's guidance note before relying on
> it. Everything else is as the agent researched it, unverified by a second pass.

> **Not legal advice.** This is a research brief for the owner and the legal reviewer, prepared on
> **2026-10-22** from public sources (mostly primary, some law-firm commentary, each marked). It
> finds questions and evidence; it does not decide them. Every "what to do" is a proposal for the
> legal reviewer to confirm. Where a source could not be verified, it says so.

**Grounded in (read only):** `planning.md` §0, §1, §3, §4.3, §5–§8, §16.1, §18, §19, §19.1;
`docs/store/privacy-and-data-safety.md`; `docs/audits/A11-privacy-popia.md`;
`docs/store/review-notes.md`; `docs/store/release-checklist.md`;
`packages/content/src/en/consent.ts` (guardian v3) and `adult-consent.ts` (adult-v2);
`status.md` (open findings A11-04, A11-10, A11-14, A11-16; "agree ahead"; the owner's 13+ rating
choice). Note that the worktree was being edited while this brief was being written, so check
line references against the current files.

**Access date for every web source below: 2026-10-22** unless another date is given.

---

## One-page summary

Status: **Compliant** = looks right as built or planned · **Gap** = something is missing ·
**Unclear** = the law is open; the legal reviewer must decide · **Watch** = not binding yet, or
changing.
Who acts: **Owner** · **Legal** (the legal reviewer) · **Code** (an engineering change).

| # | Area | Status | Severity | Action | Who |
|---|---|---|---|---|---|
| 1 | **POPIA s57 prior authorisation**: children's information and special personal information sent to Anthropic (US), plus push tokens to Expo, Apple and Google, and WhatsApp to Meta | **Unclear** | **High (Critical if Legal finds it applies)** | Legal decides now whether s57(1)(d) applies, given the s72 basis. If it does, file on the eServices portal **straight away**: no processing until the Regulator answers, which can take up to **4 + 13 weeks**. For a **1 March 2027** launch, that means filing by **early November 2026** | Legal → Owner |
| 2 | **Accountability**: information officer registration (s55), PAIA manual, the named responsible party, privacy page | **Gap** | **High** (launch blocker, already A11-10) | Name the legal entity. Register the IO on the eServices portal. Publish a PAIA manual and the privacy page (template marked for the legal adviser) | Owner, Legal, Code |
| 3 | **Special personal information in chat** (health and mental health, sex life such as abuse disclosures, criminal behaviour, religion) and the "flag for a human" step | **Gap** | **High** | Consent v4 names this information explicitly. Store forms: "Health" and "Sensitive info" are currently declared *not collected*, which is inconsistent with a crisis-aware chat. Keep sensitive notes to a minimum, keep them short, and limit who may see them | Legal, Code |
| 4 | **Proof that a "competent person" consented** (s35(1)(a) and s11(2)(a) burden of proof): the SMS link goes to whatever number the learner types | **Gap** | **High** | Add proportionate checks (below). Decide the position for informal caregivers (a grandparent without guardianship) | Legal, Code |
| 5 | **Mandatory reporting**: Sexual Offences Act s54 (any person; knowledge, reasonable belief or suspicion), Films and Publications Act s24C(2)(d), Children's Act s110 | **Unclear** | **High** | Write a safeguarding policy: what happens when a minor discloses abuse, who reports to SAPS, and how the "human flag" interacts with it. Name a safeguarding lead | Legal, Owner |
| 6 | **Films and Publications Act s24C** "child-oriented services" (moderation, safety messages, a way to report, information on filtering tools) | **Unclear** | Medium–High (offence: up to R50 000 or 6 months) | Legal decides scope. The duties are cheap to meet: safety messages, a "report this reply" control, a parents' page on filtering tools | Legal, Code |
| 7 | **Anthropic Usage Policy** (new version effective **12 Nov 2026**) and its guidelines for organisations serving minors | **Gap** | Medium–High | AI disclosure at the start of every chat. Child-safety system prompt. A public statement of child-safety and privacy compliance. Keep the AI out of "high-risk" determinations (admissions, NSFAS eligibility); code decides them | Code, Owner |
| 8 | **s72 cross-border basis** and transparency (s18): the AI provider keeps inputs up to 30 days, and up to 2 years if flagged; neither appears in consent | **Gap** | Medium | Record the s72 basis (Anthropic DPA plus SCCs, s72(1)(a); consent, s72(1)(b) as backup). Consent v4 says the provider keeps data for a short time for safety | Legal, Code |
| 9 | **s14 retention** (A11-04, A11-14 open) | **Gap** | Medium | Owner writes the schedule; one sweep job applies it | Owner, Code |
| 10 | **s22 breach notification**: online only (eServices portal) since 1 April 2025; no "low-risk" exemption | **Gap** (no runbook seen) | Medium | A written incident runbook: the portal, a learner/guardian notice template, and a register | Owner, Code |
| 11 | **s71 automated decisions** ("Qualify now", eligibility) | Compliant with additions | Medium | Already "code decides, AI explains". Add: show the rule used; "think this is wrong?" leads to a re-check or a person; never hide a course | Code |
| 12 | **s69 / CPA direct marketing / NCC opt-out registry (CPA regulations of 15 April 2026)** | **Watch** | Medium | Reminders are not marketing. Anything promoting a sponsor, a university, a studio or a paid product **is**: separate consent, and a check against the NCC registry | Owner |
| 13 | **"Agree ahead"** (a 17-year-old agreeing before turning 18) | **Unclear** | Medium | Safer route: the agreement is **assisted by the guardian** (co-confirmed), or a one-tap confirmation on or after the birthday. Legal confirms | Legal |
| 14 | **ECTA s43** footer and website details | **Gap** | Medium | Owner gives the legal name, status, registration number, address, phone and email. Footer on the web and in the app's About screen | Owner, Code |
| 15 | **Consumer Protection Act**: does a free, sponsor-funded service count? Minors' agreements (CPA s39) | **Unclear** | Medium | Assume parts apply. Terms of use in plain language; the guardian approves them for a minor; no unfair exclusions | Legal |
| 16 | **WhatsApp Business policy** (updated 23 Sep 2026): opt-in, no ID numbers, AI-chatbot terms (from 15 Jan 2026) | **Watch** | Medium | Keep WhatsApp to reminders and short replies. Never ask for ID numbers there. Legal checks the AI-provider clause before free-form chat goes on WhatsApp | Owner, Legal |
| 17 | **SMS / WASPA Code v17.15**, through the aggregator | Compliant by design | Low | STOP on every channel, as built. WASPA's prohibited times (Sun; Sat before 09:00 / after 13:00; other days 20:00–08:00) apply to *direct marketing*; reminders are not marketing | Owner (contract) |
| 18 | **App stores**: Apple 5.1.2(i), 1.2/4.7 reporting, age-rating questionnaire; Google AI-generated content policy, Data safety, target audience | **Gap** (small) | Medium | An in-app "report this reply". The minor also sees and taps the AI-sharing disclosure (not only the guardian). 13+ rating is consistent; keep the in-app browser away from "unrestricted web access" (16+) | Code, Owner |
| 19 | **Age-assurance laws** (US states, Brazil, Australia, Singapore) | Not applicable in SA | Low | Distribute in South Africa only; the Declared Age Range / Play Age Signals APIs are optional | Owner |
| 20 | **Education law**: NSC results (DBE v Information Regulator), applying on a learner's behalf (CAO), NSFAS, DHET registers | **Watch** (H1–H4 are future) | Medium (later) | Nothing is submitted or fetched without a signed agreement (as planned). Under-18 applications need a guardian's signature (CAO). NSFAS says it uses no third-party agents | Owner |
| 21 | **"Is this college registered?"** | Risk | Medium | Say "not found on DHET's register as at <date>", with DHET's link; never "this college is illegal". Keep evidence of each check | Code, Legal |
| 22 | **Copyright** (Copyright Act 98 of 1978; Amendment Bill **not in force**: ConCourt ruled on 26 June 2026 and returned it to Parliament) | Compliant by design | Low–Medium | Link rather than copy. Facts are free, text is not. Siyavula: CC BY (unbranded) vs CC BY-ND (branded). Ask the DBE about past papers. No university logos | Code, Legal |
| 23 | **Synthetic results generator** (forgery risk) | Compliant by design | Low | Keep it private and the "SAMPLE" mark on every page; no insignia (already planned). Offences: NQF Act s32B, CET Act s48, common-law forgery | Code |
| 24 | **Accessibility** (Constitution s9, PEPUDA, CRPD) | Compliant by design | Low | Keep WCAG 2.2 AA (hard rule 9); publish an accessibility statement | Code |
| 25 | **Cybercrimes Act s54** (report within 72 h) | **Watch** (not in force; may not apply) | Low | Re-check for a commencement proclamation | Legal |
| 26 | **National AI policy** | **Watch** (draft withdrawn 26 Apr 2026) | Low | Re-check DCDT for the rewrite | Owner |

**The five things to do first.**
1. Legal decides the **s57 prior-authorisation** question this week (the launch date depends on it).
2. The owner names the **responsible party** and registers the **information officer**.
3. Consent **v4**: special personal information, the human flag, AI-provider retention, the
   studios, "until they turn 18". Then align the store forms.
4. A **safeguarding policy** for abuse disclosures (Sexual Offences Act s54 and FPA s24C).
5. Code items from Anthropic's minors guidelines: AI disclosure each session, the child-safety
   system prompt, "report this reply".

---

## 1. POPIA (Protection of Personal Information Act 4 of 2013)

**Commencement.** Most of POPIA commenced on **1 July 2020**, with a one-year grace period to
**30 June 2021**. Section 58(2) was postponed to 1 February 2022 (law-firm commentary:
[Bowmans](https://bowmanslaw.com/insights/south-africa-ready-or-not-popia-is-here/),
[Polity/ENS](https://www.polity.org.za/article/dont-be-deceived-by-rumours-popia-is-still-coming-into-effect-on-1-july-2021-no-extensions-2021-06-28)).
**In force.** Section text: [popia.co.za](https://popia.co.za/) (an unofficial consolidation;
the authoritative text is Gazette 37067, 26 Nov 2013).

### 1.1 Conditions for lawful processing (ss 8–25)
- **Accountability (s8), lawfulness and minimality (ss 9–10), consent/justification (s11),
  collection directly (s12), purpose (s13), retention (s14), further processing (s15),
  information quality (s16), openness (ss 17–18), security (ss 19–22), participation (ss 23–25).**
- **s11(2)(a):** the responsible party **bears the burden of proof** for the data subject's or
  competent person's consent. This matters for guardian consent (§2). **s11(3):** the right to
  object; the "STOP before consent" exception in planning §8.1 is a sound reading.
- **What UniversityFlow does:** consent gates in the database (hard rule 5), minimum data, RLS, an
  append-only audit log, export and delete, documents processed in South Africa. This is well
  ahead of typical practice.
- **Gaps:**
  - **s14 retention:** there is no schedule (A11-04, A11-12, A11-14 open). Original offer letters
    and proofs, which hold ID numbers, addresses and fees, are kept "until deleted": that is hard
    to justify under s14 once the values are confirmed. **Owner:** a schedule. Proposal: delete
    the file N days after confirmation, unless the learner pins it.
  - **s18 notification:** the consent text does not say how long the AI provider keeps data
    (see 1.9), and does not name the responsible party, the information officer, or the right to
    complain to the Regulator. The privacy page is still missing (status.md).
  - **Regulator's address for the privacy page** (from its own media statement, 2 June 2026):
    Woodmead North Office Park, 54 Maxwell Drive, Woodmead, Johannesburg 2191; PO Box 31533,
    Braamfontein 2017; enquiries@inforegulator.org.za; toll-free 080 001 7160
    ([statement PDF](https://inforegulator.org.za/wp-content/uploads/2026/06/MEDIA-STATEMENT-INFORMATION-REGULATOR-ISSUES-ENFORCEMENT-NOTICES-FOR-THE-CONTRAVENTIONS-OF-POPIA-AND-PAIA-BY-PUBLIC-AND-PRIVATE-BODIES.pdf)).
    The complaints email and form: check [inforegulator.org.za](https://inforegulator.org.za/)
    before publishing.

### 1.2 Children (ss 34–35)
- **s1 "child":** a natural person under 18 who is not legally competent without a competent
  person's assistance. **"Competent person":** anyone legally competent to consent to any action
  or decision about the child
  ([s1](https://popia.co.za/section-1-definitions/);
  [Regulator guidance note on children, 28 June 2021](https://inforegulator.org.za/wp-content/uploads/2020/07/GuidanceNote-Processing-PersonalInformation-Children-20210628-1.pdf)).
- **s34** prohibits processing a child's information. **s35(1)** exceptions: (a) prior consent of
  a competent person; (b) a right or obligation in law; (c) international public law; (d)
  historical, statistical or research use; (e) information deliberately made public by the child
  with a competent person's consent. **s35(2):** the Regulator may authorise processing in the
  public interest with safeguards. Its conditions may include a competent person's means to
  review and refuse, notices, and **not encouraging a child to disclose more than necessary**
  (guidance note §5.2).
- **UniversityFlow:** guardian consent before any processing, enforced in the database; a
  revocable link; re-consent at 18. **Compliant in design.** What remains open is proof
  (s11(2)(a)) and who counts as a competent person (§2).
- **Design point from the guidance note:** the companion should not invite more disclosure than
  the purpose needs (for example, it should not prompt for family circumstances).

### 1.3 Special personal information (ss 26–33)
- **s26 categories:** religious or philosophical beliefs, race or ethnic origin, trade union
  membership, political persuasion, **health, sex life**, biometrics, and **criminal behaviour**
  (alleged offences and proceedings)
  ([s26](https://popia.co.za/section-26-prohibition-on-processing-of-special-personal-information/)).
- **s27(1) exceptions:** (a) **consent**; (b) a right or obligation in law; (c) international
  public law; (d) research; (e) deliberately made public; (f) ss 28–33
  ([s27](https://popia.co.za/section-27-general-authorisation-concerning-special-personal-information/)).
- **s32 (health)** covers medical professionals, insurers, **schools** (special support for
  pupils), child-care bodies, and so on
  ([s32](https://popia.co.za/section-32-authorisation-concerning-data-subjects-health-or-sex-life/)).
  **UniversityFlow is none of these**, so it must rely on **s27(1)(a) consent** (for a minor,
  the competent person's).
- **Regulations on health information under s32(6)** were published on **6 March 2026**
  (GG 54268), in force on publication. Commentary says they apply to insurers, medical schemes,
  employers, pension funds and similar bodies, **not** to UniversityFlow
  ([Bowmans](https://bowmanslaw.com/insights/south-africa-popia-health-information-regulations-cross-the-finish-line/),
  [Fasken](https://www.fasken.com/en/knowledge/2026/04/health-data-under-the-microscope-new-popia-regulations)).
  The Gazette text itself was **not verified**.
- **What UniversityFlow touches:** a learner's chat can contain distress and mental health
  (health), abuse (sex life, criminal behaviour), religion, or a disability. `memory_notes` could
  store it. The crisis reply processes it. The "flag for a human" step (planning §4.3) has a
  person read it. Disability-unit referrals do too.
- **Gaps:**
  - Guardian v3 and adult-v2 say the companion "gives helpline numbers" but **do not say that
    health or other sensitive information shared in chat is processed, sent to the AI provider,
    or may be read by a person**. "Specific and informed" consent (s1) for s27(1)(a) arguably
    needs that. **Legal + Code: consent v4.**
  - `privacy-and-data-safety.md` declares **Health** (Google) and **Sensitive Info** (Apple)
    *not collected*. A chat built to recognise distress, and that keeps notes, probably collects
    them. Legal should decide; the conservative answer is to declare them.
  - Propose: never write special personal information into `memory_notes` unless the learner
    asks; a short retention for crisis-flagged turns; access by named staff only, logged; a
    written confidentiality undertaking for those staff (mirroring s32(2)–(3), although s32 does
    not apply directly).

### 1.4 Security (s19), operators (ss 20–21), breaches (s22)
- **s19:** reasonable technical and organisational measures: identify risks, keep safeguards in
  place, verify them, update them (summarised in the children guidance note §4.3). UniversityFlow
  has RLS, hashed PINs and tokens, encryption and audits. **Compliant in design.**
- **s21:** a **written contract** with every operator requiring security measures, and the
  operator must notify the responsible party of a breach. Operators: AWS, Vercel, Anthropic,
  Expo, Apple and Google (push), Meta, the SMS provider, Trigger.dev, and later Sentry. **Gap
  (owner):** keep a register of the contracts (the DPA or terms for each) and confirm each covers
  s21. Check where **Vercel's own logs** and **Trigger.dev** data sit: the code keeps payloads to
  IDs, but the processing location of logs and metadata is a s72 question.
- **s22:** notify the Regulator and the data subjects when there are reasonable grounds to
  believe information was accessed or acquired without authority. Since **1 April 2025** the
  Regulator takes notifications **only through its eServices portal**; email and the SCN1 form
  are no longer accepted ([Regulator media list, 7 Apr 2025 launch](https://inforegulator.org.za/media-statements/);
  [Moonstone](https://www.moonstone.co.za/updated-popia-compliance-data-breach-reporting-must-be-online/);
  [Michalsons](https://www.michalsons.com/blog/guideline-notification-of-security-compromises-to-the-information-regulator/58993)).
  Commentary says there is no "low-risk" exemption and no fixed 72-hour rule; the statute says
  "as soon as reasonably possible".
- **Enforcement involving an education body:** on **22 May 2026** the Regulator issued an
  enforcement notice to **Central Johannesburg TVET College** for unlawful sharing of special
  personal information, inadequate security, and **failing to notify a security compromise under
  s22** (primary: [Regulator statement, 2 June 2026](https://inforegulator.org.za/wp-content/uploads/2026/06/MEDIA-STATEMENT-INFORMATION-REGULATOR-ISSUES-ENFORCEMENT-NOTICES-FOR-THE-CONTRAVENTIONS-OF-POPIA-AND-PAIA-BY-PUBLIC-AND-PRIVATE-BODIES.pdf)).
- **Gap (owner + code):** a breach runbook: who decides, the portal account ready beforehand, a
  notice template for learners and guardians (a minor's guardian too), and an internal breach
  register.

### 1.5 Direct marketing by electronic communication (s69), and reminders
- **s69:** direct marketing by SMS, email, automated calls (and, per the Regulator's guidance,
  phone calls) needs **consent**, or the "customer" exception for the sender's own similar
  products. One request for consent only. Every message names the sender and gives a way to
  stop it ([s69](https://popia.co.za/section-69-direct-marketing-by-means-of-unsolicited-electronic-communications/)).
- **"Direct marketing"** (s1) means promoting or offering goods or services, or asking for a
  donation. **Utility reminders the learner asked for** (deadlines, exams) **are not direct
  marketing.** Compliant as designed.
- **Becomes direct marketing:** a message promoting a sponsor, a university's programmes "funded
  by", the studios' paid tiers, or any donation request. For a minor that needs the guardian's
  s69 consent, separate from service consent.
- **Amended POPIA Regulations, GN 6126, GG 52523, 17 April 2025, in force on publication**:
  consent for direct marketing may be requested by email, SMS or WhatsApp (not only Form 4);
  phone requests must be recorded; objections and corrections are free and can be made through
  more channels ([Eversheds Sutherland](https://www.eversheds-sutherland.com/en/south-africa/insights/new-amendments-to-popia-regulations-what-businesses-need-to-know),
  [Bowmans](https://bowmanslaw.com/insights/south-africa-popia-regulations-get-a-makeover-what-you-need-to-know/),
  [Power Law Africa](https://powerlaw.africa/2025/04/22/new-popia-regulations/)). Gazette text
  **not opened directly**. **UniversityFlow:** STOP on SMS and WhatsApp, and deletion and export
  in the app, fit this. Make sure an objection or correction **by SMS or WhatsApp reply** is
  honoured and free (it is, for STOP).
- **Regulator's direct-marketing guidance note** (final version reportedly released late
  2024; advisory) ([CDH, Jan 2025](https://www.cliffedekkerhofmeyr.com/en/news/publications/2025/Sectors/Technology-Communications/Technology-and-Communications-Alert-29-january-Navigating-the-Information-Regulators-guidance-note-on-direct-marketing)).
  Its exact date was **not verified**.

### 1.6 Automated decision-making (s71)
- **s71(1):** no decision with **legal consequences or a substantial effect** based **solely** on
  automated processing that profiles a person (performance, reliability and so on). **s71(2)**
  exceptions: a contract, with appropriate measures; or a law or code. **s71(3):** the person can
  make representations and must get enough information about the **underlying logic**
  ([s71](https://popia.co.za/section-71-automated-decision-making/)).
- **UniversityFlow:** "Qualify now / Getting close / Needs work" and eligibility lists are
  automated. They are not an admission decision (the university decides), but a learner who is
  told "you don't qualify" and then does not apply could be **substantially affected**. Status:
  **compliant with additions.** Show the rule ("UJ: APS 30 + Maths 50%, from the 2027
  prospectus, checked on <date>"); offer "think this is wrong?" leading to a re-check (the
  `rechecks` table exists) or a person; never remove a course from view because of a verdict;
  keep "provisional, not a promise" wording (planning §8.5).
- The Regulator has **no s71 guidance yet**; commentators call that a gap
  ([ITLawCo on the 2026/27 APP](https://itlawco.com/information-regulator-2026-27-annual-performance-plan/), secondary).

### 1.7 Cross-border transfers (s72)
- **s72(1):** a transfer abroad is allowed only if (a) the recipient is bound by a **law, binding
  corporate rules or binding agreement** giving adequate protection, substantially similar to
  POPIA and including onward-transfer rules; or (b) **consent**; or (c)–(d) a contract; or (e)
  for the data subject's benefit where consent is impracticable
  ([s72](https://popia.co.za/section-72-transfers-of-personal-information-outside-republic/)).
- **UniversityFlow:** chat and document images go to **Anthropic (US)**; push to **Expo (US)**,
  then Apple or Google; WhatsApp to **Meta**. The consent wording names each and says they are
  outside South Africa. **Basis (b) consent is covered.** Basis (a): Anthropic's
  [Data Processing Addendum](https://www.anthropic.com/legal/data-processing-addendum)
  incorporates the **EU SCCs** (Module 2/3), which is a candidate "binding agreement". **Legal:
  record which basis is relied on.** It matters for s57 (1.8).
- **Retention by the provider:** by default Anthropic removes API inputs and outputs **within 30
  days**. Content flagged by its trust-and-safety classifiers may be kept **up to 2 years**
  (scores up to 7 years); zero-retention agreements exist for eligible customers
  ([privacy.claude.com](https://privacy.claude.com/en/articles/7996866-how-long-do-you-store-my-organization-s-data)).
  **Crisis messages are the most likely to be flagged.** Consent says only "does not keep it for
  training". **Gap (Medium):** add "keeps it for up to 30 days, longer if needed for safety"; ask
  Anthropic about **zero data retention** for a minors' service.

### 1.8 Prior authorisation (ss 57–59): the most time-critical item
- **s57(1):** prior authorisation from the Regulator is needed before (a) processing unique
  identifiers for a new purpose and linking them with other responsible parties' information;
  (b) criminal-behaviour information on behalf of third parties; (c) credit reporting; **(d)
  transferring special personal information or children's personal information to a third party
  in a foreign country that does not provide an adequate level of protection as referred to in
  s72.** (s57(3): not needed where an applicable code of conduct is in force. s57(4): once only.)
  ([s57](https://popia.co.za/section-57-processing-subject-to-prior-authorisation/)).
- **s58:** processing may not start until the Regulator replies: **4 weeks** to say whether it
  will investigate, then **up to 13 weeks**. If there is no decision in time, the decision is
  presumed favourable ([s58](https://popia.co.za/section-58-responsible-party-to-notify-regulator-if-processing-is-subject-to-prior-authorisation/)).
  **s59:** failure to notify is an **offence**. The text was not opened; check the penalty tier
  in s107.
- **Regulator guidance:** its prior-authorisation guidance note (11 March 2021) lists category
  3.3.4: children's or special information to a third party in a country without adequate
  protection ([guidance PDF](https://inforegulator.org.za/wp-content/uploads/2020/07/Revised-Guidance-Note-on-applications-for-Prior-Authorisation-adopted-by-Members-30-Jan14.pdf);
  [Michalsons](https://www.michalsons.com/blog/guidance-note-on-application-for-prior-authorisation/48935)).
  The Regulator said in 2021 it would revise the note; a revision was **not found**. Prior
  authorisation applications are now made **online** ([ITLawCo, Aug 2026 briefing](https://itlawco.com/information-regulator-briefing-2026/)).
- **Why it is unclear.** Three questions decide it:
  1. Is an **operator** (Anthropic, acting for us) a "**third party**" in s57(1)(d)?
     Commentators disagree.
  2. Does the reference to **s72** mean a recipient bound by an adequate **agreement** (the SCCs)
     counts as "adequate", even though the US as a country has no adequacy finding?
  3. Every message to Anthropic is **children's personal information**, and some is special. So
     if s57(1)(d) applies at all, it applies to the core product.
- **There is no education-sector code of conduct** to rely on under s57(3). The only
  higher-education code found is a 2020 USAf draft, not issued
  ([SAJS](https://sajs.co.za/article/view/10935/16337)). The codes in progress concern gated
  access and direct marketing.
- **What to do (High).** Legal gives a written view **now**. If there is any doubt, the low-cost
  path is to **notify and apply** through the eServices portal: once only, and the presumption in
  s58 limits the delay to 17 weeks at most. **For 1 March 2027 that means filing by about 2
  November 2026.** Note that the AI is also used in development and testing with synthetic data
  only, which is fine. Apply for Anthropic, and decide whether Expo/Apple/Google push tokens and
  Meta numbers (children's personal information, though minimal) go in the same application.

### 1.9 Information officer, PAIA manual, Regulator's tools
- **Information officer:** must be **registered** with the Regulator before taking up duties
  (s55; the Regulator's [registration guidance](https://inforegulator.org.za/wp-content/uploads/2025/02/Registration.pdf)),
  through the eServices portal. **The portal does not accept an IO outside South Africa.**
  Deputies are appointed "as necessary"
  ([Michalsons](https://www.michalsons.com/blog/faq-items/how-do-i-register-my-information-officer-with-the-regulator)).
  For a company, the head of the body is the IO by default. **Open (A11-10). Owner.**
- **PAIA manual (s51 PAIA):** the small-business exemption lapsed on **31 Dec 2021**; commentary
  says every private body has needed a manual since 1 Jan 2022
  ([MJK](https://mjkinc.co.za/compliance/paia); [SAICA](https://www.saica.org.za/resources/legislation-and-governance/promotion-of-access-to-information-act)).
  No later exemption was found. **Gap: owner** (publish it with the privacy page).
- **Personal information impact assessment:** a regulation 4 duty of the IO. The Regulator plans
  a **PIIA guidance note in 2026/27** ([ITLawCo](https://itlawco.com/information-regulator-2026-27-annual-performance-plan/)).
  **Recommended:** a written PIIA for the AI, minors and crisis flows. The audits already hold
  most of the content.

### 1.10 Enforcement so far (for calibration)
- **Maximum administrative fine:** **R10 million** (s109). Six fines are reported to date: DoJ
  R5m (disputed); **DBE R5m (before the courts)**; IEC R100 000 (paid); Lancet Laboratories
  R100 000 (paid); Blouberg Municipality R500 000, reduced by the court to R250 000 (30 April
  2026); FT Rams Consulting R100 000 (direct marketing). Enforcement notices in 2026: Central
  Johannesburg TVET College (22 May 2026), SABS. OUTsurance and MTN direct-marketing matters
  have been referred to the Enforcement Committee. More than 8 000 breach notifications since
  2021. A party that complies within an enforcement notice's period cannot be fined
  ([ITLawCo summary of the 31 Aug 2026 briefing](https://itlawco.com/information-regulator-briefing-2026/), secondary;
  [Regulator media statements](https://inforegulator.org.za/media-statements/), primary list).
- **No enforcement against an ed-tech app was found.** The education matters are the DBE case
  (§6.1) and CJC (above).
- **Planned POPIA amendments:** the Regulator is processing a draft internally, to give direct
  consequences for intentional non-compliance. No timeline. **The Regulator members' current
  term ends November 2026** ([ITLawCo](https://itlawco.com/information-regulator-2026-27-annual-performance-plan/)). **Watch.**

---

## 2. Children: the Children's Act, POPIA's "child", and turning 18

- **Age of majority:** Children's Act 38 of 2005 **s17**: a child becomes a major at **18**
  (commenced 1 July 2007). Not opened directly this session (acts.co.za redirected); this is
  well established. **In force.**
- **Medical consent from 12 (s129)** ([acts.co.za](https://www.acts.co.za/childrens/129_consent_to_medical_treatment_and_surgical_operation.php)):
  this does **not** extend to data-processing consent. POPIA s35 requires a competent person for
  any child under 18, so a 16-year-old's own agreement is not enough. UniversityFlow is correct
  here.
- **Who is a "competent person"?** Parents with parental responsibilities, and guardians
  (Children's Act ss 18–21). A **caregiver** without guardianship (often a grandparent or aunt in
  South Africa) may not be "legally competent to consent". The consent's own confirmation reads
  "I am this learner's parent or legal guardian", which is the right test. **Legal:** what does
  the learner do when the person who cares for them is not their legal guardian? (The Regulator
  can authorise processing under s35(2) in the public interest; that is a heavier route.)
- **Proving consent (s11(2)(a)): Gap, High.** The SMS link goes to any number the learner types,
  so a learner can give a friend's number. Proportionate checks to propose:
  - refuse a guardian number equal to the learner's, or already used by many learners (allow a
    small number for siblings);
  - the guardian confirms the learner's name and date of birth, and their own relationship;
  - an attestation that knowingly false consent is a misrepresentation;
  - spot checks or a second channel for consents that look odd (for example granted seconds
    after sending);
  - keep the evidence (time, number hash, version), as is already done.
  POPIA does not prescribe a verification standard; Legal decides how much is "reasonable".
- **Turning 18 mid-service.** The guardian's authority ends at 18. **UniversityFlow stops
  processing until the learner agrees** (status.md, A1-13). **Compliant and conservative.** Data
  already held is not deleted in the gap (storage is processing, but ending it would destroy the
  learner's own record). Legal should confirm storage-only during the gap is justified under
  s11(1)(f) (legitimate interest) or s11(1)(d) (protecting the learner's interest).
- **"Agree ahead" (a 17-year-old agrees, effective on the 18th birthday): Unclear, Medium.** No
  authority was found either way. Analysis for Legal:
  - POPIA "consent" must be an informed expression of will; a child's own consent is not a s35
    ground. Agreement given at 17 is arguably not the learner's own adult consent.
  - In common law a minor can act **with the assistance** of a guardian, and a major can
    **ratify** an act done as a minor. Two safer designs: **(i) guardian-assisted agree-ahead**
    (the learner agrees and the guardian confirms by the same link), or **(ii) agree-ahead as a
    stored intention** that becomes valid by one tap on or after the birthday. In (ii), a
    reminder already scheduled could continue for a short grace period on s11(1)(f), with Legal's
    approval.
  - Whatever the choice, the guardian v4 text should say the consent "lasts until the learner
    turns 18", as status.md proposes.

---

## 3. ECTA, the Consumer Protection Act, and the Cybercrimes Act

### 3.1 ECTA (Act 25 of 2002): in force
- **s43(1)**: a supplier offering goods or services **for sale, hire or exchange** by electronic
  transaction must show: full name and legal status; physical address and phone; web and email
  address; any self-regulatory body and its code; for a company, registration number, directors
  and place of registration; an address for legal service; a description of the service; price;
  terms; **security and privacy policy**; ADR; and so on
  ([acts.co.za s43](https://www.acts.co.za/ELECTRONIC-COMMUNICATIONS-AND-TRANSACTIONS-ACT-2002/43__information_to_be_provided)).
  **Chapter VII applies to electronic transactions with consumers.** Whether a *free* service is
  in scope is **unclear** ([Michalsons](https://www.michalsons.com/blog/consumer-protection-provisions-of-the-ect-act/2380)).
  It is irrelevant here: Tumoolo's launch standard requires the s43 footer anyway. **Gap (owner
  supplies the details; code shows them on the web and in the app's About).**
- **s45 (unsolicited commercial communications): repealed** by POPIA s110 (Act 4 of 2013). The
  amendment-of-laws provisions commenced 30 June / 1 July 2021, per commentary
  ([acts.co.za s45 shows "Repealed by s110 of Act 4 of 2013"](https://www.acts.co.za/ELECTRONIC-COMMUNICATIONS-AND-TRANSACTIONS-ACT-2002/45__unsolicited_goods_services_or_communications)).
  POPIA s69 now governs.

### 3.2 Consumer Protection Act 68 of 2008: in force (since 31 March 2011)
- **Does a free service count?** "Consideration" means anything of value, given **directly or
  indirectly**, and including parties other than the supplier and consumer. "Consumer" includes
  a **user or beneficiary** who was not a party. "Service" includes **education, information and
  advice** ([acts.co.za s1](https://www.acts.co.za/consumer-protection/1_definitions)).
  **Sponsor-funded delivery may therefore be "consideration" passing indirectly.** No case was
  found. **Unclear: assume the CPA applies** to marketing and fairness.
- **Relevant if it applies:** s22 plain language; **s41 false or misleading representations**
  (no "guaranteed admission"; no implied university endorsement or sponsorship, which matters
  for D5 if universities fund it); ss 48–51 unfair and prohibited terms (no blanket exclusion of
  liability for negligence in the terms); **s39 agreements with minors** (voidable without a
  guardian's consent; *section not opened, verify*), so the guardian should approve the **terms of
  use** as well as the privacy consent.
- **CPA Amendment Regulations, gazetted 15 April 2026, in force on publication**: they
  operationalise the **National Opt-Out Registry**, run by the **National Consumer Commission**.
  Direct marketers must register with the NCC, renew yearly, honour pre-emptive blocks and clean
  lists monthly. The NCC launched the registry on **7 Oct 2026**
  ([NCC](https://thencc.org.za/ncc-launches-the-national-opt-out-registry-to-curb-unwanted-direct-marketing/);
  [Werksmans](https://werksmans.com/do-not-call-me-ill-call-you-south-africas-2026-cpa-amendment-regulations-operationalising-the-national-opt%E2%80%91out-regime-for-direct-marketing-and-shifting-day/);
  [Regulator's note of 24 Apr 2026](https://inforegulator.org.za/wp-content/uploads/2026/04/MEDIA-STATEMENT-REGULATOR-NOTES-PUBLISHED-GAZETTE-OF-THE-CONSUMER-PROTECT-ACT-AMENDMENT-REGULATIONS-2026.pdf)).
  **UniversityFlow today: not a direct marketer** (reminders only). **Watch:** the day a
  sponsor message, a partner offer or a studio upsell is sent, register with the NCC and check
  the registry.
- **Duty of care for AI advice to minors.** Liability for wrong information (a wrong deadline
  that costs a year) would be in **delict** (negligence, possibly pure economic loss) and, if the
  CPA applies, s54 (services of the quality the consumer is entitled to expect) and s61 (only
  goods). No South African AI-advice case was found. **Hard rules 2 and 3** (code decides;
  sourced, verified records) are the right defence; keep the evidence of verification.

### 3.3 Cybercrimes Act 19 of 2020
- **Most of the Act commenced 1 December 2021.** **s54** (an electronic communications service
  provider or financial institution must report certain offences to SAPS within 72 hours;
  penalty up to R50 000) is **not in force**, per commentary; no proclamation was found
  ([Michalsons](https://www.michalsons.com/blog/the-impact-of-the-cybercrimes-act-on-electronic-communications-service-provider-ecsp/56739);
  [acts.co.za s54](https://source.acts.co.za/cybercrimes-act-2020/54__obligations_of_electronic_.php)).
  UniversityFlow is probably not an "ECSP" in any case (it uses licensed ones). **Watch, Low.**
- Offences that bear on content learners send (for example harmful messages, or disclosure of
  intimate images, ss 14–16) are a safeguarding matter (§5.4), not a reporting duty for us
  today.

---

## 4. Messaging: WASPA, ICASA, WhatsApp, SMS opt-out

- **WASPA Code of Conduct, current version 17.15** (PDF uploaded September 2026; no effective
  date shown) ([waspa.org.za/coc](https://waspa.org.za/coc/);
  [PDF](https://waspa.org.za/wp-content/uploads/2026/09/WASPA-Code-of-Conduct-17.15-clean.pdf)).
  It binds WASPA **members** (the SMS aggregator), and through **cl. 3.1** their clients' services
  too. Relevant clauses read in the PDF:
  - **16.2** "direct marketing", mirroring POPIA; **16.7** no fee for opt-out; **16.8**
    prohibited times for *direct marketing*: Sundays and public holidays; Saturdays before 09:00
    and after 13:00; other days 20:00–08:00. **16.9–16.10** consent or customer.
  - **15.31:** after a customer ends a "notification service", a free confirmation message must
    be sent. This is worth adopting: after STOP, send one free "You won't get reminders any more"
    (check the aggregator's contract).
  - **22.1–22.7 Children:** a child is under 18. "Children's services" (aimed at, or
    particularly attractive to, children) must not exploit credulity, must not contain anything
    a reasonable parent would not want, and **must not involve an invasion of privacy of any
    child (22.7)**. UniversityFlow's design (no names or marks in messages) fits.
  - **Compliant by design** (STOP on SMS, fixed texts, quiet hours 21:00–07:00). Reminders are not
    direct marketing, so 16.8 does not bind them, but aligning reminders to **20:00–08:00** costs
    little. **Owner:** choose an aggregator that is a WASPA member and confirm it has a
    sender-ID or short-code policy for minors' numbers.
- **ICASA.** No ICASA rule specific to an application-to-person SMS sender was found. ICASA's
  End-User and Subscriber Service Charter Regulations bind licensees (the networks), not
  UniversityFlow ([ICASA](https://www.icasa.org.za/news/2019/amendments-to-the-end-user-and-subscriber-service-charter-regulations)).
  **Not applicable** directly. Searched; could not find more.
- **WhatsApp Business Messaging Policy (last updated 23 Sep 2026)**
  ([whatsappbusiness.com/policy](https://whatsappbusiness.com/policy/)):
  - contact only people who gave their number **and opted in**; honour any opt-out request **on
    or off WhatsApp**; separate opt-ins per category are "best practice";
  - **do not ask people to share full personal ID numbers**, financial account or card numbers,
    or other sensitive identifiers. **Never ask a learner to send an ID number or a document by
    WhatsApp**;
  - **no general minimum age**; messages in "regulated verticals" may not go to under-18s (this
    does not apply to education reminders);
  - automation is allowed in the 24-hour window with **a prompt escalation path to a human**.
    **Gap (small):** the WhatsApp reply flow needs a "talk to a person" route (email or support
    form), especially after a crisis reply.
  - **AI providers:** from **15 Jan 2026** (15 Oct 2025 for new accounts) the WhatsApp Business
    Solution Terms bar **AI providers whose main offering is a general-purpose assistant**.
    Businesses using AI for their own service are reported as allowed
    ([TechCrunch, 18 Oct 2025](https://techcrunch.com/2025/10/18/whatssapp-changes-its-terms-to-bar-general-purpose-chatbots-from-its-platform/), secondary;
    the Solution Terms themselves were **not read**). **Watch, Medium:** before free-form AI
    chat goes over WhatsApp, Legal reads the current Solution Terms. UniversityFlow is an
    education service, but "an AI companion" is close to the line.
- **SMS opt-out rules overall:** POPIA s69(4) (a way to stop), WASPA 16.x and 15.31, CPA s11
  and the NCC registry (marketing only). **Compliant for reminders.**

---

## 5. AI: national policy, provider terms, duty of care, crisis design

### 5.1 South African AI policy
- **National AI Policy Framework** (DCDT, August 2024): a framework, not binding.
- **Draft National AI Policy** approved by Cabinet on 25 March and 1 April 2026 and gazetted for
  comment (**GG 54477, 10 April 2026**). It was **withdrawn by Minister Malatsi on 26 April
  2026** after fabricated citations were found in its references
  ([TimesLIVE](https://www.timeslive.co.za/news/2026-04-27-minister-malatsi-withdraws-draft-ai-policy/);
  [Mail & Guardian](https://mg.co.za/article/2026-04-27-malatsi-withdraws-draft-ai-policy-over-fake-citations/);
  [Bowmans on the draft](https://bowmanslaw.com/insights/south-africa-draft-national-artificial-intelligence-policy-published-for-public-comment/)).
  The draft was **risk-based** (EU-AI-Act-like), with duties for high-risk AI. A rewrite is
  reported to be under way. **No AI-specific law is in force.** **Watch.**
- **The Information Regulator's position (May and Sep 2026):** POPIA is "the legal backbone" of
  AI regulation; AI rules complement it ([Juta](https://cms.juta.co.za/popi/popi-news-updates/popia-and-ai-friends-frenemies-or-future-partners/);
  [ITWeb, 17 Sep 2026](https://www.itweb.co.za/article/inforeg-unpacks-regulatory-complexities-posed-by-ai/KA3WwMdzPryvrydZ)).
  No AI guidance note has been issued.
- **Social-media age limits:** the government said on 16 Sep 2026 it is **not** pursuing an
  under-16 ban ([BiometricUpdate](https://www.biometricupdate.com/202609/south-africa-rejects-blanket-social-media-age-verification-for-under-16s)). **Watch.**

### 5.2 Anthropic's terms for products serving minors
- **Guidelines for organisations serving minors** (updated **16 March 2026**)
  ([support.claude.com](https://support.claude.com/en/articles/9307344-responsible-use-of-anthropic-s-models-guidelines-for-organizations-serving-minors)):
  - additional safeguards suited to the use case (examples: age verification, moderation and
    filtering, monitoring and reporting, educational resources for minors);
  - implement Anthropic's **child-safety system prompt** where provided;
  - comply with child-safety and privacy law, and **state that compliance on the website or
    public documentation**;
  - **tell users they are interacting with an AI, not a person**;
  - Anthropic audits; repeated violation can lead to suspension.
- **Usage Policy, version effective 12 November 2026** ([anthropic.com/legal/aup](https://www.anthropic.com/legal/aup)):
  - A minor is anyone under 18, whatever the jurisdiction. Products serving minors must follow
    the guidelines above. Anthropic reports detected CSAM or **imminent risk to a minor** to
    the relevant authorities.
  - **Consumer-facing chatbots must disclose that they are AI**, at least at the start of each
    chat session or in the product interface.
  - **"High-risk AI recommendations"** need a qualified human in the loop and disclosure. They
    include **"admitting, rejecting, or ranking applicants"** (education and credentials) and
    **"determining eligibility for … government benefits"** (public benefits). The policy
    covers advice to an individual who might rely on it.
- **UniversityFlow against these:**
  - Consent tells the learner about the "AI provider". **Gap (code):** no per-session "you're
    chatting with an AI" line was found in `packages/content/src/en` (search for "AI" found only
    stand-in and consent text). Add it to the chat's opening and header.
  - **Gap (code):** load Anthropic's child-safety system prompt (ask the account team for it)
    before minors' traffic.
  - **Gap (owner):** a public "Safety and privacy" statement on the website.
  - **Unclear (Legal):** "Qualify now" and **NSFAS** help. Code decides eligibility (hard rule
    2), and the AI only explains, so UniversityFlow arguably does not make "high-risk
    recommendations" with the model. Keep it so: the model must never state an eligibility
    outcome that code did not compute, and NSFAS eligibility must be **code-decided with
    "NSFAS decides" wording**. A test could assert that the agent's tools are the only source
    of eligibility text.
- **The studios' tutor (Gemini via LangChain, no crisis check):** already decided to route
  through UniversityFlow's AI interface and crisis check (§18.8). **Must be done before any
  UniversityFlow learner reaches the tutor (S3).** Otherwise it is a new operator, a new
  cross-border transfer and a new s57 question.

### 5.3 Duty of care and the crisis design
- No South African statute sets an AI-specific duty of care. The general law (delict,
  negligence) and, if it applies, the CPA set the standard of a reasonable provider serving
  children.
- **The design is strong:** a deterministic crisis check before the AI; verified helplines as
  catalogue records; a 323-case red team at 100%; and the A10 audits. **Gaps for Legal and the
  owner:**
  - the helplines are still "not yet verified" (planning §4.3); verification is a launch blocker
    by the project's own rules;
  - what "flag for a human" commits UniversityFlow to (hours, response time). A promise of human
    follow-up that is not kept is the highest liability exposure. Say plainly that it is **not
    an emergency service**;
  - the reporting duties in §5.4.

### 5.4 Mandatory reporting (child protection)
- **Criminal Law (Sexual Offences and Related Matters) Amendment Act 32 of 2007, s54**, as
  substituted by **Act 13 of 2021 (commenced 31 July 2022)**: **any person** with
  **knowledge, reasonable belief or suspicion** that a sexual offence was committed against a
  child (a "vulnerable person") must **report it to a police official immediately**. Failure is
  an offence (fine or **up to 5 years**). Good-faith reporters are protected. Sources:
  [Acts Online s54 (search extract)](https://www.acts.co.za/criminal/54__obligation_to_report_commi.php);
  [M&G, 18 Mar 2025](https://mg.co.za/thought-leader/2025-03-18-silence-is-complicit-speak-out-against-sexual-offences/).
  The current consolidated text was **not opened** (the page redirected); **Legal must read it.**
- **Films and Publications Act 65 of 1996, s24C(2)(d):** a provider of child-oriented services
  must **report** information about behaviour indicating an offence against a child to SAPS (see
  §5.5).
- **Children's Act s110:** a **mandatory** duty for listed professionals (teachers, social
  workers, health workers and others) to report abuse; "any person" **may** report. *Not opened;
  verify.*
- **What it means.** If a minor tells the companion "my uncle touches me", does UniversityFlow
  (a company) have "knowledge or suspicion"? Arguably not while only software reads it.
  **Arguably yes once a staff member reads it through the "flag for a human".** POPIA allows
  disclosure to SAPS where the law requires it (s11(1)(c), s15). **Legal decides; the owner
  writes a safeguarding policy:** who reads flags, how fast, when SAPS (or a social worker or
  Childline) is told, what the learner is told, and the record kept. The red team should cover
  the flow end to end.

### 5.5 Films and Publications Act s24C: child-oriented services
- **s24C(1):** "child-oriented service" means a **contact service** (people who have not met
  make contact) **or a content service specifically targeted at children**. "Content service"
  means supplying content, or editorial control over it, offered to the public. **s24C(2)**
  duties: (a) moderate, and take reasonable steps to stop use for offences against children; (b)
  prominently display **safety messages** children understand; (c) a way for children to
  **report suspicious behaviour**; (d) **report** to SAPS; (e) where feasible, tell children and
  parents about **filtering and blocking tools**. **s24C(3):** an offence, up to **R50 000 and/or
  6 months** (substituted 2022) ([acts.co.za](https://www.acts.co.za/films/24c__obligations_of_internet_a)).
- **UniversityFlow** has no learner-to-learner contact, but an AI generating content for an
  audience that is mostly under 18 could be a "content service specifically targeted at
  children". **Unclear (Legal).** The duties are cheap to meet: the digital-safety reminders
  (planning §8.6) already exist; add a "report this reply" control (needed for the app stores
  too, §8), a parents' page on filtering tools, and the reporting policy (§5.4). **Medium–High.**

---

## 6. Education law

### 6.1 NSC results: publication and use
- **Information Regulator v DBE.** The Regulator's enforcement notice (18 Nov 2024) and **R5m
  infringement notice** over publishing matric results by exam number were **set aside by a full
  bench of the Pretoria High Court on 12 Dec 2025**, which held that the results may be
  published as since 2022 ([IOL, 13 Dec 2025](https://iol.co.za/news/education/2025-12-13-high-court-sets-aside-r5-million-fine-against-department-of-basic-education-over-matric-results-publication/)).
  Leave to appeal was **refused on 3 June 2026** ([ITWeb, 10 June 2026](https://www.itweb.co.za/article/information-regulator-flunks-matric-results-appeal/lLn147mQmOj7J6Aa)).
  The Regulator has **petitioned the SCA**, per its 31 Aug 2026 briefing
  ([ITLawCo](https://itlawco.com/information-regulator-briefing-2026/), secondary). **Watch.**
  The court did not decide in this phase whether exam numbers are personal information.
- **For UniversityFlow:** do **not** scrape published results lists to "find" a learner's
  results, even if publication is lawful. That would be collection not directly from the data
  subject (s12) for a new purpose, and it would conflict with D3. **C-later / gate H2**
  (official results from the DBE under an agreement, with consent) is the right route. Consent
  wording must name the DBE (or IEB) and the fields fetched (as planned).

### 6.2 Applying for a learner (gate H1), CAO, NSFAS (gate H3)
- **CAO:** its handbook's declaration is signed by the applicant, **and by a parent or guardian
  if the applicant is under 18**; the principal confirms school results; processing waits for the
  signed declaration and fee ([CAO Handbook 2016 p.46–47](https://cao.ac.za/download/Handbook2016/files/assets/basic-html/page47.html);
  [2018 PDF](https://www.cao.ac.za/download/Handbook2018/CAO2018web.pdf); older handbooks, so
  **check the current one**). No published CAO rule on agents was found.
  **For H1/H4:** every submission needs the institution's agreement, the learner's own
  declaration (they vouch for the truth) and **the guardian's for a minor**. Fees paid through
  UniversityFlow would bring in ECTA s43 price and payment rules and the CPA.
- **NSFAS:** a 2025 NSFAS fraud alert (as reported) says NSFAS **does not work with third-party
  agents**, charges no fees, and applicants should apply themselves on the official site; never
  share myNSFAS logins ([gauteng.net report](https://gauteng.net/nsfas/?p=5215), secondary;
  NSFAS primary notice **not found**). **Until an NSFAS agreement (H3): guide only, never submit,
  never hold credentials** (as planned). The "scam" reminders in planning §8.6 match NSFAS's own
  warnings.
- **SASA (84 of 1996) / Higher Education Act (101 of 1997):** no provision found that stops a
  learner from using a third-party planning tool. Schools' reports are the school's documents;
  the learner uploads their own copy (Tier B). **No gap found.** (Searched lightly.)

### 6.3 Colleges: DHET registers, TVET, the "is this college registered?" check
- **CET Act 16 of 2006 s28:** only a company registered (or provisionally registered) as a
  **private college** may provide continuing education and training (public colleges and organs
  of state aside). **s48:** offences, including up to **5 years** for breaching s28, and fraud for
  claiming an unregistered NQF qualification
  ([acts.co.za s28](https://www.acts.co.za/continuing-education-and-training-act-2006/28__registration_of_private_co.php);
  [s48](https://www.acts.co.za/continuing-education-and-training-act-2006/48__offences.php)).
  Private **higher** education institutions are registered under the **Higher Education Act**
  (separate register). Its offence sections were **not verified**.
- **DHET publishes both registers**, updated regularly. Learners are warned every January about
  bogus colleges ([TimesLIVE, 12 Jan 2026](https://www.timeslive.co.za/news/south-africa/2026-01-12-its-open-season-as-authorities-warn-matriculants-against-bogus-colleges/)).
- **Risk in the check:** telling the public that a named college "isn't registered" when it is
  (a stale register, a name variant) risks **defamation or injurious falsehood**. **Code:** word
  it "We couldn't find '<name>' on DHET's register of private colleges as at <date>. Check with
  DHET: <link>". Store the register version used. Never label a college "illegal" or "a scam".
  Re-verify registers on a schedule (hard rule 3 already requires a date and verifier).
- **SAQA / NQF Amendment Act 12 of 2019** (largely in force from 2023; the exact date is given
  as 12 Sept or 13 Oct 2023 by different sources): **s32B** makes it an offence to falsely claim
  a qualification or to make a false entry in the national records, up to **5 years**
  ([SAQA, Nov 2023](https://www.saqa.org.za/wp-content/uploads/2023/11/The-NQF-Amendment-Act-of-2019-and-its-implications-03112023signed-1.pdf)).
  This is relevant to the generator (§7).
- **Umalusi** quality-assures the NSC, IEB and SACAI and issues certificates; checking
  certificates goes through Umalusi or SAQA. No rule was found on third parties *displaying* a
  learner's own results.

---

## 7. Copyright and the results generator

- **Copyright Act 98 of 1978: in force.** Fair dealing (s12) includes **quotation** "compatible
  with fair practice", with acknowledgement. **Facts are not protected; expression is.**
  Admission requirements as data, with a source link (the catalogue's design), are low risk.
  Copying prospectus text or layout wholesale is not.
- **Copyright Amendment Bill: not in force.** The **Constitutional Court ruled on 26 June 2026**:
  it upheld s12A (fair use), s12B (quotation and other exceptions), s12C, s12D(6)–(9), s19B and
  s19C, and **struck down s12D(1)–(5)** (broad educational exceptions) as overly broad. The
  Bills **return to Parliament** ([Spoor & Fisher](https://spoor.com/copyright-amendment-bill-constitutional-court/)).
  A **May 2025 court order reading s19D (access for persons with disabilities)** into the Act
  stands meanwhile ([KnowledgeGov](https://knowledgegov.org/constitutional-court-judgement-on-the-copyright-amendment-bill-in-south-africa-26-june-2026/), secondary).
  **Watch:** fair use, if enacted, helps quotation and AI-reading use cases; do not rely on it
  until it is enacted.
- **Siyavula:** unbranded books are **CC BY** (adapt with attribution); **branded** books (with
  the DBE endorsement) are **CC BY-ND** (no changes). The version (3.0 or 4.0) varies by book
  ([Siyavula](https://ng.siyavula.com/read); [Gr10 Maths teacher guide](https://www.siyavula.com/downloads/books/maths/Gr10_Mathematics_Teacher_Afr.pdf)).
  **Code:** link to Siyavula pages, or use the CC BY editions with attribution.
- **DBE past papers and materials:** state works (copyright in the state, s5). Reuse terms
  **could not be verified**. **Owner:** ask the DBE for written permission before hosting papers;
  linking to the DBE's own page is the safe default (planning §8.3 already says this).
- **University names and logos:** names used factually are fine. **Logos, crests and colours** are
  trade marks (Trade Marks Act 194 of 1993) and possibly heraldic registrations. Using them
  implies endorsement (CPA s41; passing off). **Keep them out** unless a partner agrees in writing.
- **Synthetic results generator (§18.7):** "SAMPLE: not an official document" on every page; no
  coat of arms, Umalusi or DBE logo, seal, barcode, certificate number or signature; synthetic
  names. **Compliant by design.** It guards against **forgery and uttering** (common law), the
  **NQF Act s32B** and **CET Act s48** fraud offences, and misuse of the national coat of arms.
  Additions: keep `tools/results-generator` out of any public deploy; put the SAMPLE mark across
  the body as well as the header (a cropped header defeats it); test that the output never
  includes a real school's name.

---

## 8. App stores

### 8.1 Apple (App Review Guidelines, current page)
([developer.apple.com/app-store/review/guidelines](https://developer.apple.com/app-store/review/guidelines/))
- **5.1.2(i)** (revised **13 Nov 2025**): "You must clearly disclose where personal data will be
  shared with third parties, **including with third-party AI**, and obtain **explicit
  permission** before doing so" ([TechCrunch, 13 Nov 2025](https://techcrunch.com/2025/11/13/apples-new-app-review-guidelines-clamp-down-on-apps-sharing-personal-data-with-third-party-ai/)).
  - Adults: the adult-v2 screen is explicit. **Compliant.**
  - **Minors: the guardian consents by SMS, but the *user* of the app (the learner) should also
    see the AI-sharing disclosure and tap to agree** before the first chat or upload. Apple's
    rule speaks of obtaining permission from the user. **Gap (code, small).**
- **5.1.1(v)** in-app account deletion: **compliant** (review-notes.md). **5.1.1(iii)**
  minimisation and system pickers: the camera and photo picker are used. **Compliant.**
- **5.1.4 (Kids):** apps that collect from minors need a privacy policy and must comply with
  children's privacy laws (for South Africa, POPIA ss 34–35). The privacy page is missing.
  **Gap (it is in A11-10).**
- **1.3 Kids Category:** for children 11 and under. **Do not choose it**; UniversityFlow is not a
  Kids-Category app.
- **1.2 / 4.7 (UGC; chatbots):** 1.2 names "AI content creation apps"; 4.7 covers chatbots
  (mainly hosted or third-party software) and requires filtering, **a reporting mechanism** and
  age restrictions. **Gap (code):** a "report this reply" control.
- **Age rating** (new tiers **13+, 16+, 18+**; questionnaire due by **31 Jan 2026**)
  ([Apple age-rating values](https://developer.apple.com/help/app-store-connect/reference/app-information/age-ratings-values-and-definitions/)):
  "Health or wellness topics" maps to **9+**, infrequent medical or treatment information to
  **13+**, frequent to **16+**, and **unrestricted web access to 16+**. The owner's **13+** fits.
  **Keep the studios' in-app browser limited to known domains**; a general browser would push the
  rating to 16+ and shut out 15-year-olds. The page did not list an "AI chatbot" item; answer
  whatever App Store Connect asks honestly.
- **Age-assurance laws** (Texas, Utah, Louisiana, Brazil, Australia, Singapore) drive Apple's
  **Declared Age Range API** ([Apple, 24 Feb 2026](https://developer.apple.com/news/?id=f5zj08ey)).
  **None applies in South Africa.** If distribution stays SA-only, no change is needed.

### 8.2 Google Play
- **Target audience 13+** keeps the **Families policy** out (it applies when under-13s are
  targeted). **Compliant** (release-checklist.md). Gate: refuse a date of birth under 13 at sign-up
  (Grade 9 learners are usually 14–15) so the declaration stays true. **Code: check this exists.**
- **AI-Generated Content policy:** apps that generate content with AI must provide **in-app
  reporting or flagging** of offensive output without leaving the app
  ([Play Console help 13985936](https://support.google.com/googleplay/android-developer/answer/13985936)).
  **Gap (code):** the same "report this reply".
- **Data safety:** "Shared: No" for processors is consistent with Google's service-provider
  exclusion. Health: see §1.3.
- **Play Age Signals API** is rolling out worldwide during 2026 (ranges 0–12, 13–15, 16–17, 18+;
  a parent enables it in Family Link) ([Android Developers blog, July 2026](https://android-developers.googleblog.com/2026/07/google-play-age-signals-api-safer-experiences.html)).
  Optional for South Africa; it could later support the age gate. **Watch.**

---

## 9. Accessibility

- **Constitution s9** (equality, disability a listed ground); **PEPUDA 4 of 2000** (unfair
  discrimination on the ground of disability, including failing to remove obstacles; *section
  wording not opened*); **UN CRPD** (ratified 2007; art. 9 accessibility); White Paper on the
  Rights of Persons with Disabilities (2015).
- **There is no SA statute requiring WCAG** for private websites or apps; duties are inferred
  ([overview, vendor source](https://www.allaccessible.org/is-website-accessibility-a-legal-requirement-in-south-africa/)).
  A **Disability Rights Bill** is reported to be in drafting (**unverified**).
- **UniversityFlow:** WCAG 2.2 AA, axe in E2E, reduced motion (hard rule 9). **Compliant by
  design.** Add an accessibility statement with a contact.

---

## 10. Watch list (re-check, how often, where)

| What | Why | How often | Where |
|---|---|---|---|
| Regulator's media statements, guidance notes, codes (PIIA guidance planned 2026/27; any children or AI note; the gated-access code; the DMASA code) | New duties; enforcement trends | Monthly | https://inforegulator.org.za/media-statements/ · https://inforegulator.org.za/popia/ |
| s57 prior-authorisation procedure; eServices portal (breach, IO, prior authorisation) | Filing route and forms change | Before filing; then quarterly | https://inforegulator.org.za/ (eServices) |
| POPIA amendment draft; new Regulator members (term ends Nov 2026) | Possible direct fines for intentional breaches | Quarterly | Regulator site; https://pmg.org.za/ |
| DBE v Information Regulator (SCA petition) | Whether exam-number publication is "processing"; affects gate H2 | Quarterly | https://www.saflii.org/ · Regulator statements |
| POPIA Regulations (GN 6126 of 17 Apr 2025) and s32(6) health regulations (GG 54268, 6 Mar 2026) | Forms and channels | Yearly | Government Gazette · https://inforegulator.org.za/popia-forms/ |
| CPA Amendment Regulations 2026 / NCC opt-out registry | Only if any marketing is sent | Before the first marketing message; then yearly | https://thencc.org.za/ |
| Anthropic Usage Policy (new version **12 Nov 2026**), minors guidelines, data retention | Contract terms for the core feature | Each release, and on Anthropic's notice | https://www.anthropic.com/legal/aup · https://support.claude.com/en/articles/9307344 · https://privacy.claude.com/en/articles/7996866 |
| WhatsApp Business Messaging Policy and Business Solution Terms (AI-provider clause) | Channel eligibility | Quarterly, and before free-form AI on WhatsApp | https://whatsappbusiness.com/policy/ |
| WASPA Code (17.15 now) | Aggregator duties | Twice a year | https://waspa.org.za/coc/ |
| Apple App Review Guidelines and age-rating questions | Store approval | Before each submission | https://developer.apple.com/app-store/review/guidelines/ · https://developer.apple.com/news/ |
| Google Play policy (AI content, Data safety, age signals) | Store approval | Before each submission | https://support.google.com/googleplay/android-developer/ |
| National AI policy rewrite (DCDT) | A risk-based regime could classify education AI for minors as high-risk | Quarterly | https://www.dcdt.gov.za/ · Government Gazette |
| Copyright Amendment Bill back in Parliament | Fair use, education exceptions | Twice a year | https://pmg.org.za/ |
| Cybercrimes Act s54 commencement | A possible reporting duty | Twice a year | Government Gazette |
| DHET registers of private colleges and private HEIs; list of public TVET colleges | The registration check's accuracy | Monthly, and before each colleges wave | https://www.dhet.gov.za/ |
| NSFAS rules on third parties and data sharing | Gate H3 | Before H3 outreach; then yearly | https://www.nsfas.org.za/ |
| CAO handbook (agents, under-18 signatures) | Gates H1/H4 | Yearly (each application cycle) | https://www.cao.ac.za/ |
| Children's online-safety policy (FPB codes, any age-limit bill) | s24C-type duties | Twice a year | https://www.fpb.org.za/ · https://www.dcdt.gov.za/ |
| Helpline numbers (Higher Health, SADAG and others) | A wrong number is the worst error (planning §4.3) | Every release and at least every 3 months (already a rule) | The organisations' own sites |

---

## 11. What this brief could not verify (be careful)

- The full Gazette texts of GN 6126 (2025 regulations) and GG 54268 (health regulations). Law-firm
  summaries were used.
- The current consolidated wording of Sexual Offences Act s54, Children's Act ss 17 and 110,
  CPA s39, PEPUDA s9, and POPIA s59/s107 (penalty tier). The acts.co.za pages redirected or were
  paywalled.
- Whether the prior-authorisation guidance note was revised after 2021.
- The WhatsApp Business **Solution Terms** wording on AI providers (press reports only).
- DBE reuse terms for past papers; any NSFAS primary notice on third-party agents; the current
  CAO handbook's rule on agents.
- The exact release date of the Regulator's direct-marketing guidance note.
- The ITLawCo summaries of the Regulator's 31 Aug 2026 briefing and 2026/27 APP are secondary.
  The Regulator's own statements list confirms the dates of its statements but not every detail.
