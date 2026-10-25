# University logos: the owner's permission requests

**For:** the owner (TUMO OLO). This is a to-do list, not code. **Contacts checked:** 2026-10-23.

## The decision (option A, 2026-10-23)

- Everywhere the web or the app names a university, it shows **our own neutral mark**: the
  university's short name in our letters ("Wits", "UJ", "UP", "UCT", "TUT", "UKZN") on a grey
  tile in our tokens. It never uses the university's logo, crest or colours.
- A **real logo shows only once the university has agreed in writing**, and only where the
  catalogue records that agreement. No university has agreed yet, so the app shows no logo.
- Why: every one of the six treats its logo as protected (the quotes below). UP's policy also
  forbids any use, "including University colours", that "gives a false impression … regarding
  the University's relationship with any person or entity". A neutral mark makes no such claim.

**One exception, for the FNB hackathon only (the owner's decision, 2026-10-23):** the judge demo
may show the universities' own logos with `NEXT_PUBLIC_UF_DEMO_LOGOS=1`, beside a "not affiliated"
line; production and staging refuse it. docs/deploy/demo.md says how, and how to remove it after.

## How a permission becomes a logo (when a "yes" arrives)

A person does this, never an agent:

1. Keep the written permission (the email or letter) somewhere a reviewer can open over HTTPS.
2. Put the logo file the university supplied, unaltered, at
   `apps/web/public/logos/<universityId>.png` (or `.webp`): `wits`, `uj`, `up`, `uct`, `tut`,
   `ukzn`. PNG or WebP only for now: the app can't draw an SVG until it has react-native-svg.
3. Add `logoPermission` to that university's record in `packages/catalogue/src/data/<id>.ts`:
   `grantedBy` (the office, as the letter gives it), `grantedOn` (the letter's date,
   YYYY-MM-DD), `evidenceUrl` (step 1's link) and `asset` (step 2's path).
4. Add the same logo to `UNIVERSITY_LOGOS` in `packages/ui/src/university-mark.ts`
   (`{ UCT: '/logos/uct.png' }`, by short name). A test holds this list equal to the catalogue's
   records, so it fails until both agree.
5. Apply any conditions the university set (sizes, clear space, an "independent" note) before
   merging.

**What the tests hold** (`packages/catalogue/src/logo-permission.test.ts`): they scan
`apps/web/public`, `apps/native/assets` and `packages/catalogue/assets`. They fail if:

- a file in a `logos` folder belongs to a university with no `logoPermission`;
- a file in a `logos` folder isn't named `<universityId>.png` or `.webp`;
- any other file there looks like a university logo (its name has a university's id or short
  name, or "logo", "crest", "emblem", "arms", "seal" or "coat"); or
- a `logoPermission` names a file that isn't there, or another university's file.

## Who to ask

Each line below was checked on the university's own page on 2026-10-23. **Not verified** means
the page couldn't be opened (HTTP 403 or a dead host): check it by hand before relying on it.
Individual staff are left out on purpose.

| University | Send to | Who decides | Checked |
|---|---|---|---|
| **UCT** | First your contractual representative, or the relevant faculty or department Communications and Marketing Manager; escalation to **OfficialMerchandise@uct.ac.za**. Communication & Marketing: +27 (0)21 650 4847/3730 | Communication and Marketing Department (CMD) | Verified |
| **UKZN** | **Corporaterelations@ukzn.ac.za** | Corporate Relations Division | Verified |
| **UP** | The Director: Department of Institutional Advancement (DIA), "the brand custodian". The policy prints no email: ask the UP switchboard for the office | Director: DIA | Office verified; no email published; switchboard not checked |
| **Wits** | **wits.news@wits.ac.za** (Wits Communications' general inbox), asking for it to go to Wits Marketing | Wits Marketing | Verified |
| **TUT** | **general@tut.ac.za**, +27 (0)86 110 2421, for Corporate Affairs and Marketing | Corporate Affairs and Marketing | Verified (email, phone, office name) |
| **UJ** | Marketing and Brand division: no inbox found. Ask the UJ switchboard | Marketing and Brand (not verified) | **Not verified** (403) |

### What each one says

**Wits.** "Unless specifically mentioned otherwise, all intellectual property rights existing in
and attaching to this website, including the University's brand and logo, are the property of the
University, may not be reproduced or otherwise used without the express written consent of the
University." Also: "Wits Marketing is responsible for brand identity, digital marketing, social
media, and the Wits Shop." No public brand portal was found.
Sources: https://www.wits.ac.za/site-assets/small-footer/terms-and-conditions-of-use/ ·
https://www.wits.ac.za/people/support-and-services/ (both checked 2026-10-23).

**UJ.** Logos are for staff only: "You can download the correct logo and all other corporate
identity assets in the Brand Folder on the Intranet." **Not verified:** UJ's brand pages and its
social-media SOP (https://www.uj.ac.za/brand/, https://www.uj.ac.za/brand/brand-fundamentals/)
return HTTP 403, so the rules there and the office that owns them could not be confirmed.
Source: https://news.uj.ac.za/news/vice-chancellor-message-23-june-2023/ (checked 2026-10-23).

**UP.** Policy Rt 473/19, "UP Brand and Corporate Identity" (approved 26 November 2019; next
review was due 26 November 2023):
- §3.4.1: "University trademarks may only be used by persons or entities outside the University
  pursuant to an agreement, licence, memorandum of understanding, or sponsorship agreement
  stating the terms and conditions of such use."
- §3.4.2: "Where entities wish to use the University's logo or trademarks in any way, approval
  must first be sought from the Director: DIA as the brand custodian."
- §3.6.4: "Neither the name of the University nor any University trademark, including University
  colours, may be used in any way that gives a false impression, is misleading, or could cause
  confusion regarding the University's relationship with any person or entity."
- §3.1.3: "All elements must be reproduced from official artwork only."
- §3.4.4: the Brand Manual "can be found on the intranet". **Not verified:** whether the
  Multimedia and Brand Hub is public (HTTP 403).

So UP asks for **a written agreement or licence**, not just an email.
Source: https://drupalwebprod-files.up.ac.za/Public/media/1/documents/inline/2754069/rt473_19-up-brand-and-corporate-identity.zp184405.pdf?VersionId=8PYJuVJDwE7NYng3MzrDBlcUcrA.TF1T
(checked 2026-10-23).

**UCT.** "UCT Brand Guidelines Our Identity", July 2024:
- p. 3: "Design work and trademark symbols remain the property of UCT under the stewardship the
  CMD." (quoted as printed) "The UCT trademarks are registered in terms of the South African
  Trademarks Act. As such, any misuse or non-authorised use will constitute trademark
  infringement."
- p. 32: "UCT Vendors and Third-parties: Please contact your contractual representative and
  consult with the relevant faculty or department Communications and Marketing Manager.
  Escalation may be emailed to OfficialMerchandise@uct.ac.za". Also: "Questions about the
  licensing of UCT's trademark symbols, in any manner other than prescribed in this guide, may be
  emailed to OfficialMerchandise@uct.ac.za".
- The logo download page is for members only ("This content is restricted for certain members
  only").

Sources: https://uct.ac.za/media/10371 · https://uct.ac.za/staff/general-contacts ·
https://uct.ac.za/staff/services-facilities-communication-marketing-branding/uct-logo-downloads
(checked 2026-10-23).

**TUT.** The contact is verified: general@tut.ac.za and +27 (0)86 110 2421, with Corporate
Affairs and Marketing listed as an executive portfolio. **Not verified:** TUT's Corporate
Identity Manual and its logo-use pages were on jupiter.tut.ac.za, which no longer resolves. So
TUT's own wording on third-party use couldn't be read. Treat it as needing written permission.
Source: https://www.tut.ac.za/about/executive-management-committee/ (checked 2026-10-23).

**UKZN.** "Corporate Identity Guide 2020":
- "The logo may not be used if it does not conform to these guidelines. At all times, written
  approval should be sought from the Corporate Relations Department, who are the custodians of
  this CI, should there be need for departure from these specifications for whatever reason."
- "At no time should any attempt be made to recreate the logo. Please contact the Marketing
  Department should the artwork be required."
- There is no public download: artwork is supplied on request. "CI Manual related queries:
  Corporaterelations@ukzn.ac.za".

Sources: https://coh.ukzn.ac.za/wp-content/uploads/2022/10/UKZN-CI-Manual.pdf ·
https://ukzn.ac.za/ukzn-notices/ukzn-corporate-identity-brand-awareness-campaign-2022/
(checked 2026-10-23).

## The email

Fill the brackets. For UP, ask in point 3 for the agreement or licence its policy requires.

> **Subject:** Request for written permission to display the [University] logo in UniversityFlow
>
> Dear [University] Marketing and Communications team,
>
> My name is TUMO OLO and I run Tumoolo, a South African software studio. We are building
> **UniversityFlow**, a free web and mobile app that helps learners from Grade 10 onwards plan
> their subjects and their applications to university, and get ready for their first year.
>
> Today the app shows [University]'s name beside a neutral mark of our own (the letters
> "[short name]" on a grey tile), never your logo or colours. I am writing to ask for **written
> permission to show the official [University] logo** in its place, and for the approved logo
> files and usage guidelines.
>
> **Where the logo would appear:** only next to [University]'s name, so learners can recognise
> it quickly: in course and programme lists, in their own application tracker, and on offer and
> campus pages.
>
> **How we would use it:**
> - unaltered, in your official colours, at the sizes and clear space your guidelines require,
>   using only the files you supply;
> - never on merchandise or advertising, and never combined with our own logo;
> - with a note in the app that UniversityFlow is independent and **not affiliated with or
>   endorsed by [University]**. The logo identifies the university; it does not suggest a
>   partnership.
>
> **Your control:** we will remove the logo promptly, within [5] working days, if you ask at any
> time, and we will apply any conditions you set.
>
> All admission information in the app comes from [University]'s own published sources, with
> links back to them.
>
> Could you please let me know:
> 1. whether [University] grants permission for this use, and on what conditions (in writing);
> 2. where to obtain the approved logo files (a high-resolution PNG, full-colour and reversed)
>    and your current brand guidelines;
> 3. whether a formal licence or agreement is required, and who should sign it.
>
> If this request should go to a different office, I would be grateful if you could forward it
> or point me to the right contact.
>
> Kind regards,
> TUMO OLO
> Tumoolo · UniversityFlow
> [email · phone · website]

## To do

- [ ] UCT: send (contractual representative or faculty C&M manager first; escalate to OfficialMerchandise@uct.ac.za)
- [ ] UKZN: send to Corporaterelations@ukzn.ac.za
- [ ] UP: find the DIA office through the switchboard; ask for the agreement or licence
- [ ] Wits: send to wits.news@wits.ac.za, for Wits Marketing
- [ ] TUT: send to general@tut.ac.za, for Corporate Affairs and Marketing
- [ ] UJ: find the Marketing and Brand office through the switchboard (nothing verified)
- [ ] For each "yes": the five steps above, and the conditions the university set
