# Can production sit in a friend's Vercel account?

Checked 2026-10-23. **Short answer: no.** Production belongs in a Vercel **Pro** team that
**Tumoolo owns**. It costs US$20 a month for one developer seat, which includes US$20 of usage
credit.

## 1. Vercel's Hobby plan doesn't allow it

Vercel's fair use guidelines, "Commercial usage":

> **Hobby teams** are restricted to non-commercial personal use only. All commercial usage of the
> platform requires either a Pro or Enterprise plan.
>
> Commercial usage is defined as any Deployment that is used for the purpose of financial gain of
> **anyone** involved in **any part of the production** of the project, including a paid employee
> or consultant writing the code.

- Source: https://vercel.com/docs/limits/fair-use-guidelines#commercial-usage (page last updated
  2026-09-14; checked 2026-10-23)
- The Hobby plan page says the same: "the Hobby plan restricts users to non-commercial, personal
  use only" (https://vercel.com/docs/plans/hobby, checked 2026-10-23).
- The pricing FAQ: "Our Hobby plan is for personal, non-commercial use"
  (https://vercel.com/pricing, checked 2026-10-23).

UniversityFlow is free for students, but it's built by a business (Tumoolo) and funded by
universities, bursary funders and sponsors (planning.md §0, D5). By Vercel's definition, that's
commercial whoever's account it sits in. Hobby also stops a feature for up to 30 days once a limit
is passed (https://vercel.com/docs/plans/hobby, "Hobby billing cycle"). That's not acceptable in
the weeks applications close.

## 2. Vercel's data processing addendum covers Pro and Enterprise only

> This DPA applies to Vercel's Processing of Personal Data as a Processor under the Agreement for
> Customers who are on Enterprise and Pro plans.

- Source: https://vercel.com/legal/dpa (checked 2026-10-23). Its parties are Vercel Inc. and "the
  Customer that executed the Agreement": the account holder, not Tumoolo, if the account is a
  friend's.

POPIA requires this kind of contract:

- **s20:** an operator (Vercel, AWS) may process personal information only with the knowledge or
  authorisation of the responsible party, and must treat it as confidential.
- **s21:** the responsible party must have a **written contract** with the operator that makes the
  operator keep the s19 security measures, and the operator must report any breach.

On a friend's Hobby account, there's no DPA at all, and the only contract with Vercel is the
friend's, not ours. The responsible party for a learner's information (Tumoolo, or the client
it builds for) would have no s21 contract with the company holding the data. That gap would go
straight to the legal reviewer and the Information Regulator.

## 3. Why the account must be Tumoolo's, whatever the plan

| | In a friend's account | In Tumoolo's own team |
|---|---|---|
| **Control of the data** | The friend can see environment variables (the database URL, the AI key), logs and deployments, and can delete the project | Only people Tumoolo adds, with roles (Owner, Member, Billing, Viewer) |
| **Operator agreement (POPIA s20/21)** | Between Vercel and the friend | Between Vercel and Tumoolo (the Pro DPA) |
| **Billing** | On the friend's card. A missed payment, or a falling-out, pauses the site | Tumoolo's invoice, Tumoolo's spend limits |
| **When people leave** | If the friend leaves, gets locked out or closes the account, the site and its keys go with them | Access is removed per person. The project stays |
| **Audit trail** | The friend's activity log | Tumoolo's activity log, which answers the Regulator's "who had access?" |
| **Region** | The `cpt1` regional pricing page says its rates are for Pro plan users (https://vercel.com/docs/pricing/regional-pricing/cpt1). Whether a Hobby project can run its functions in `cpt1` wasn't checked | `cpt1`, pinned by `apps/web/vercel.json` and refused otherwise by `readConfig` |

The same goes for AWS: RDS and S3 in an AWS account Tumoolo owns, with AWS's own DPA (it's part
of AWS's service terms; not fetched today).

## 4. If cost is the worry

The plan-keeping production setup comes to about **US$39 a month plus VAT** before any usage
past the included amounts (see [costs.md](costs.md)). A staging site for showing people costs
nothing, on Render's free plan, with synthetic data only (README.md §2).
