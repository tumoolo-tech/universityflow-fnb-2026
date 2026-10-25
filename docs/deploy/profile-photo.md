# Switching on the profile photo for learners

> The owner's decision (2026-10-23): learners **from Grade 10** may upload their own photo for
> their profile, to keep them motivated, **"as long as the picture is not used for anything
> else"**. The photo path is ready now (A11-31, migration 0037). It switches on for learners the
> day guardian consent v4 and adult-v3 are live. The judge demo has its drawn SAMPLE pictures, and
> a visitor's own photo only under its own hackathon switch `UF_DEMO_REAL_PHOTOS` (docs/deploy/demo.md,
> "Hackathon exceptions"), never under this one.

## What is already true

- **The database refuses a photo under older wording** (migration 0037). A learner's photo is kept
  only while the consent that covers them names it: the guardian's at **v4** or later for a minor,
  the learner's own agreement at **adult-v3** or later for an adult. A guardian's v4 stops covering
  a learner at 18; they agree in their own name. Nothing before consent at all (hard rule 5).
- **Removing a photo is never refused** (A11-32), with or without consent.
- **Used for nothing else.** Shown only to its learner, on their About me card (web and app). Never
  sent to the AI (chat, document reading), never on a CV or to Mmereko, never in a job payload, a
  log, a reminder, the guardian's consent page or a recruiter share page.
  `apps/web/test/photo-used-for-nothing-else.test.ts` fails if any other code starts to read it.
- **Deleted** when the learner removes it, when a guardian withdraws, and with the account.
- **In the learner's own download** ("Download my data"), as POPIA s23 requires: the image itself,
  never its storage key.
- **What is stored:** one copy, cropped square, 512 × 512, black and white, metadata (camera,
  location) removed, at most 2 MB in, encrypted in S3 in af-south-1.
- **A photo kept before the learner's wording named it** (possible only in the owner's preview:
  production always refused the switch) is **not shown** and not served; it is still in the
  learner's download, and goes when they remove it, at a guardian's withdrawal or with the account.
  0037 doesn't delete it itself because the file is in S3, which SQL can't reach. If the lawyer
  wants such photos deleted at once instead (consent-v4-draft.md C5, question c), that is a small
  sweep job: say so.

## What must be true before switching on

1. **Consent v4 and adult-v3 are approved by the legal adviser** (docs/legal/consent-v4-draft.md,
   C5 for the photo) and are the **live versions** in `packages/content` (`en.consent.version`
   `v4-…`, `en.adultConsent.version` `adult-v3-…`). That change is made by an engineer, in one PR:
   - the approved lines from `en.profilePhotoDraft` (`guardianLine`, `adultLine`) moved into the
     consent wording, and the version bumped;
   - the privacy policy: `en.profilePhotoDraft.privacy` replaces the photo's line under "Coming
     later" (`en.privacyPage.sections.later`);
   - the store forms (docs/store/privacy-and-data-safety.md) say a photo is collected;
   - the app's camera and photos purpose strings name the profile photo (**A7-23**, worded
     2026-10-24, awaiting the owner's review), and a new app build carries them to phones.
   Production's config check reads the live versions: with them below v4 / adult-v3,
   `UF_PROFILE_PHOTO=1` stops the server with a ConfigError that says why.
2. **S3 is live in af-south-1** (`UF_S3_BUCKET`, as for documents; production already needs it).
   The gated real-S3 test (`packages/documents/src/profile-photo.s3.test.ts`) passed on SeaweedFS.
3. Existing guardians and adults are asked to agree to the new wording ("Send the new link",
   `needsAdultConsent`). Until a learner's own consent is at v4 / adult-v3, they are simply not
   offered a photo: nothing breaks, and their guardian's older consent covers everything else.

## The one switch-on step (the owner)

In the Vercel project's **Production** environment, set:

```text
UF_PROFILE_PHOTO=1
```

and redeploy. If the server answers `/api/health` with 503, read Vercel's runtime log: a
ConfigError naming the photo means the live wording is not v4 / adult-v3 yet (step 1).

**Never** set it on a staging site (refused) or on the judge demo (refused: the demo's own
photos are `UF_DEMO_REAL_PHOTOS`, a hackathon exception).

## Checking it after the switch

- A learner on guardian v4 (or an adult on adult-v3): About me, "Make it yours", sees "Add a photo"
  and the line "Only you see your photo…". Add, see it on the card, remove it.
- A learner whose guardian is still on v3: no photo is offered.
- Download my data: the photo is in it.
