# UniversityFlow

An AI companion that takes a South African learner from **Grade 11 results to graduation day**:
every course they qualify for, applications and funding, support through matric, orientation,
and a study coach for every year of the degree.

- **What and why:** [planning.md](planning.md)
- **Where it stands:** [status.md](status.md)
- **How to work in it:** [CLAUDE.md](CLAUDE.md)

## Getting started

```bash
pnpm install
cp .env.example .env                         # local stand-ins, no real accounts needed
pnpm verify                                  # everything green before you start
pnpm --filter @universityflow/web dev        # http://localhost:3000
```

Requires Node 24 (see `.nvmrc`) and pnpm 10. With `DATABASE_URL=pglite:./.data/pglite` there
is nothing else to install; for Docker Postgres, `pnpm db:up`.

Running locally, nothing is real: SMS messages (your sign-in PIN, a guardian's consent link)
appear at <http://localhost:3000/dev/outbox>, uploads go to `./.data/files`, and without an
`ANTHROPIC_API_KEY` the chat and report reader are scripted stand-ins. The catalogue is
researched but **unverified**, so it is shown only with `UF_CATALOGUE_PREVIEW=1` and always
labelled; see [docs/data-verification.md](docs/data-verification.md).

```bash
pnpm --filter @universityflow/web build && pnpm --filter @universityflow/web test:e2e   # E2E + axe
```

## The judge demo (FNB hackathon)

A public demo on **six made-up learners** (Grade 10, 11 and 12; a first, second and final year at
UJ, Wits and UCT), run as its own deployment with `UF_DEPLOYMENT=demo`. A judge picks a learner at
`/demo` and gets a private copy, deleted after 24 hours. No phone or SMS sign-in; uploads take only
the results generator's SAMPLE statements; profile photos come from drawn SAMPLE pictures only; the
chat is the real AI with every safety rule on, uncapped unless `UF_DEMO_AI_DAILY_CAP` is set. Two
**hackathon-only exceptions** (an 18+ Firebase sign-up for judges and the universities' logos) are
off unless switched on and are undone afterwards
([docs/deploy/hackathon-undo-pr.md](docs/deploy/hackathon-undo-pr.md)). How to deploy it and why
it is safe to be public: [docs/deploy/demo.md](docs/deploy/demo.md).

To run it locally, put these in `apps/web/.env.local` (made-up learners only):

```bash
UF_DEPLOYMENT=demo
UF_DEMO_PROJECT=1
UF_PROVIDERS=local
AUTH_SECRET=<48 or more random characters>
DATABASE_URL=pglite:./.data/demo
UF_CATALOGUE_PREVIEW=1
```

Then `pnpm --filter @universityflow/web dev` and open <http://localhost:3000/demo>. Without an AI
key the chat is the scripted stand-in. The demo's journeys:
`pnpm --filter @universityflow/web build && pnpm --filter @universityflow/web test:e2e:demo`.

## Behind switches

- **My CV** (web `/cv`, the app's My CV screen; `packages/cv`), made by
  [Mmereko](docs/design/mmereko-api-proposal.md) as our operator, server to server. **`UF_CV` is off
  for learners** until guardian consent v4 / adult agreement v3 (after legal review) and the
  Tumoolo–Mmereko agreement exist; off, every CV route answers 404. Locally it runs on a stand-in
  engine; the judge demo never calls Mmereko.
- **Gemini** is a second chat model for the **demo only** (`UF_AI_PROVIDER=gemini` with
  `GEMINI_API_KEY`); production refuses both. The demo runs on Anthropic for now: Gemini's terms
  are for users 18 and over (finding A10-46).
- **New wording** waits for the owner's review on the wording review page
  (<https://claude.ai/artifact/EsC5ktxCcd59vkfLoknitD>) before launch.
