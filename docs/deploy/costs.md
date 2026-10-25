# What hosting costs (checked 2026-10-23)

Prices are in **US dollars, before VAT**, from each provider's own pages or price files on
2026-10-23. Nothing here is a quote. The sizes are the smallest sensible ones for the first
cohort. Usage past the included amounts is billed on top, and the owner should check the numbers
again before signing up.

## The prices

### Vercel

| | Hobby | Pro |
|---|---|---|
| Plan | $0 | **$20/month per developer seat**, with **$20 of usage credit** included |
| Commercial use | **Not allowed** (non-commercial personal use only) | Allowed |
| Data processing addendum | **Not covered** | Covered |
| Included | 1M function invocations, 4 CPU-hours, 360 GB-hrs memory, 100 GB transfer | 1 TB fast data transfer; the rest from the credit |
| `cpt1` (Cape Town) rates past the included amounts | — | Active CPU **$0.20/hour**, provisioned memory **$0.0166/GB-hr**, fast data transfer **$0.28/GB**, fast origin transfer **$0.43/GB** |

Sources: https://vercel.com/pricing; https://vercel.com/docs/plans/hobby;
https://vercel.com/docs/limits/fair-use-guidelines; https://vercel.com/docs/pricing/regional-pricing/cpt1;
https://vercel.com/legal/dpa (all checked 2026-10-23).

### Render (no South African region)

| | Price |
|---|---|
| Workspace | Hobby **$0** + compute (5 GB bandwidth); Pro **$25/month** + compute (25 GB); then $0.15/GB |
| Web service | Free **$0** (512 MB, sleeps after 15 idle minutes, disk wiped, "Do not use them for production"); 0.5 CPU / 512 MB **$7/month**; 1 CPU / 2 GB **$25/month** |
| Postgres | Free **$0** (**expires 30 days after creation**, 1 GB, no backups); 256 MB **$6/month**; 1 GB **$19/month**; 2 GB **$40/month**; storage 1 GB included, then **$0.30/GB** |

Sources: https://render.com/pricing.md (Render's machine-readable pricing page);
https://render.com/docs/free; https://render.com/docs/regions (all checked 2026-10-23).

### AWS `af-south-1` (Cape Town)

From AWS's own price files (`pricing.us-east-1.amazonaws.com/offers/v1.0/aws/<service>/current/af-south-1/index.csv`):
RDS published 2026-10-20, S3 published 2026-10-15. Checked 2026-10-23.

| | Price |
|---|---|
| RDS PostgreSQL `db.t4g.micro` (2 vCPU, 1 GiB), Single-AZ, on demand | **$0.021/hour** ≈ **$15.33/month** |
| RDS PostgreSQL `db.t4g.small` (2 vCPU, 2 GiB), Single-AZ, on demand | **$0.041/hour** ≈ **$29.93/month** |
| RDS gp3 storage, PostgreSQL, Single-AZ | **$0.151/GB-month** |
| S3 Standard storage | **$0.0274/GB-month** |

Monthly figures are hour rates × 730. Requests, backups beyond the database's size, data
transfer out and KMS keys are extra and small at this scale. They're not estimated here.

## Three ways to run production, monthly, before usage overages and VAT

| | Setup | Monthly | Data in South Africa? | Allowed? |
|---|---|---|---|---|
| **A. The plan (recommended)** | Vercel Pro, 1 seat (`cpt1`) + RDS `db.t4g.micro` with 20 GB gp3 + S3 10 GB, all in Tumoolo's accounts | $20 + $15.33 + $3.02 + $0.27 ≈ **$38.62** | **Yes** | Yes |
| B. A friend's Vercel Hobby + RDS/S3 | $0 + $18.62 | ≈ **$18.62** | Yes, if the friend's project is pinned to `cpt1` (not verified) | **No:** commercial use breaks Hobby's terms, and there's no DPA (hosting-account.md) |
| C. Render | Pro workspace $25 + 1 CPU/2 GB web $25 + 1 GB Postgres $19 | ≈ **$69** (≈ $26 on a Hobby workspace with a $7 web and a $19 database, if 512 MB can run the app, which wasn't tested) | **No** (nearest region Frankfurt) | **No,** without a POPIA s72 decision by the owner and the legal reviewer, in writing |

Notes:

- The app needs a database that lasts. Render's free Postgres expires after 30 days, and its free
  web service wipes its disk, so neither can hold production at any price.
- In A, as students arrive, the Vercel credit ($20) pays for usage at the `cpt1` rates above, and
  `db.t4g.small` is the next step if the database needs it (+$14.60).
- The SMS provider, the AI (Anthropic), ElevenLabs and Trigger.dev are the same in every option
  and aren't counted.

## The one recommendation

**Option A: Vercel Pro (one developer seat) in a Tumoolo-owned team, functions in `cpt1`, with
RDS `db.t4g.micro` and S3 in a Tumoolo-owned AWS account in `af-south-1`. About US$39 a month
plus VAT to start.** If the owner wants a free place to show the app, add **Render's free web
service as staging, on synthetic data only** (render.yaml, $0). Production on Render, or in a
friend's account, needs the owner **and** the legal reviewer to decide otherwise in writing.
