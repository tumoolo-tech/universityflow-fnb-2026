# A12: Messaging compliance

**Runs at:** phase 4 (WhatsApp and SMS), and when `packages/messaging` changes.

**Report only.** Write the result to `docs/audits/results/PHASE-<n>-A12.md` and add findings
to `status.md` → Open findings as `A12-NN`.

## Checks

1. **Opt-in and opt-out.** No message without recorded consent for that channel; STOP (and its
   equivalents in the supported languages) works at once and is confirmed; a minor's messaging
   is covered by guardian consent.
2. **Quiet hours and exams.** Nothing outside the quiet-hours window (`packages/messaging`
   quiet-hours rules), and nothing during a learner's scheduled paper.
3. **WhatsApp policy.** Business-initiated messages only through approved templates; the
   24-hour window respected; template categories correct (utility vs marketing).
4. **Cost.** The global SMS budget holds under abuse (many numbers, many IPs) and alerts before
   it's spent; cost per student per month is measured against the plan (§7.4).
5. **Content.** No PIN, mark or personal detail in a message beyond what its purpose needs; no
   message body in logs.
6. **Provider.** Delivery receipts handled; failures retried with a limit; the provider
   contract suite passes against the live adapter.
