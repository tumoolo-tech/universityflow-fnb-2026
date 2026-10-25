# A11: Privacy and POPIA

**Runs at:** phases 2, 4, 8, and **before launch**. The "Owed checks" PR comment flags changes
to `packages/db` and the consent and profile routes.

**Report only.** Write the result to `docs/audits/results/PHASE-<n>-A11.md` and add findings
to `status.md` → Open findings as `A11-NN`.

## What it proves

That the product meets POPIA for a service whose users start as children (planning.md §8.1):
consent before processing, the minimum data, kept no longer than needed, in South Africa, and
given back or deleted on request.

## Checks

1. **Minors (Critical).** Nothing about a learner under 18 is processed before guardian consent
   is recorded, and the gate is in the database layer. Try every route a minor can call before
   consent: each must refuse. Withdrawal stops processing. Re-consent at 18 works, and an old
   guardian link can't undo it.
   The one exception (planning.md §8.1): a STOP from a minor before consent is recorded as an
   opt-out (`messaging_channels`, written by the inbound webhook as the owner), because an
   objection (POPIA s11(3)) is honoured whatever else is true. Check that it records nothing
   beyond the channel, the time and the source, and that export returns it in `account` even
   without consent (A11-08).
2. **Minimisation.** List every column in `packages/db/src/schema.ts` and every field sent to
   the AI provider. Each needs a reason tied to a feature; anything without one is a finding.
3. **Logs, jobs, analytics, fixtures (hard rule 4).** IDs only. Search the code and a sample of
   real log output for phone numbers, names, marks, ID numbers.
4. **Residency and cross-border transfer.** Database and files in af-south-1, functions in
   `cpt1`. Calls to the AI provider are a cross-border transfer: the consent wording must say
   so, in words a 16-year-old and a guardian understand.
5. **Retention and deletion.** Uploaded reports deleted when no longer needed; export returns
   everything held about the learner; delete removes it (including files and memory), and the
   audit log keeps only what the law requires.
6. **Security safeguards (section 19).** Row-level security per learner; PINs and tokens stored
   only as hashes; encryption at rest for files.
7. **Accountability.** Information Officer registered with the Information Regulator; the
   guardian-consent wording reviewed by a lawyer. Until both are done, record each as an open
   finding owned by the owner: a launch blocker, not a code fix.
8. **Push notifications leave South Africa (Phase 4d).** A notification goes from our server
   (`cpt1`) to Expo's push service (exp.host, United States), then to Apple (APNs) or Google
   (FCM), then to the phone; Apple and Google also keep delivery records. That is a cross-border
   transfer of whatever the notification carries, so it carries as little as possible:
   - the **text** is the template's `pushBody` (packages/content, `messages.ts`), which has no
     variables at all: no name, no university, no subject, no mark. A test fails if one gains a
     placeholder, a digit or a catalogue name. The same text is what a lock screen shows to
     anyone holding the phone;
   - the **title** is the app's name; the **data** is one word from a fixed list of screens
     (`home`, `results`, `goals`), never a link or an id;
   - the **token** (identifies the app on one phone) is the one thing about the learner that
     travels. It is stored in `push_tokens` behind RLS and the consent gate (migration 0008),
     tied to the session (gone at sign-out), removed at opt-out and with the account, exported
     with the learner's data, and forgotten when Expo says the device is gone
     (`DeviceNotRegistered`).
   Check: the push templates still have no variables; `ExpoPushChannel` sends nothing else; the
   consent and privacy wording mentions that reminders by app notification pass through Expo,
   Apple and Google (an **owner** item: the wording is in the legal review above).
