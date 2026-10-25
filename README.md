# UniversityFlow: FNB Hackathon 2026 snapshot

**An AI companion for South African learners, from Grade 10 to graduation.**
Team TumoOlo Tech · Tumo Mogame, Tumoolo

This repository is a read-only snapshot of UniversityFlow's code, shared so the judges of the
FNB App of the Year Hackathon 2026 can read it. The working repository is private; this snapshot is
its `main` branch on 25 October 2026 with the deck update of pull request #139 (commit `96767bd7`), as one commit without history.

| | |
|---|---|
| **Try it** | <https://universityflow.tumoolo.tech/demo>: no password. Press **Try as Naledi**, or sign up as a new learner with any 080 number (the PIN shows on screen) |
| **Demo video** | <https://youtu.be/MaMFUa-UEzA> (88 s) |
| **The deck** | [`pitch/UniversityFlow_FNB_Hackathon_2026.pdf`](pitch/UniversityFlow_FNB_Hackathon_2026.pdf) |
| **Judges' quick start** | [`pitch/UniversityFlow_Judges_Quick_Start.pdf`](pitch/UniversityFlow_Judges_Quick_Start.pdf) |
| **The plan** | [`planning.md`](planning.md) (decisions, the journey, the agent, the stack) and [`status.md`](status.md) (where it is now) |

## Where to look

| Folder | What it holds |
|---|---|
| `apps/web` | The Next.js 16 web app and the API the phone app calls |
| `apps/native` | The Expo app (Android and iOS) |
| `packages/admissions` | **Code decides**: every university's scoring, the verdicts, What I need, the mark maths |
| `packages/catalogue` | The researched university and college records, each with its source and year |
| `packages/agent` | **The AI explains**: the crisis check that runs first, the 18 tools, the care charter |
| `packages/messaging` | SMS, WhatsApp and push: consent, STOP, the exam-time rhythm |
| `packages/documents` | Reading a school report; the learner confirms every mark |
| `packages/evals` | The crisis red-team suite (must pass 100%) |
| `docs/audits` | The audits each phase passes |

## Left out of this snapshot

- University and college logos (`apps/web/public/demo-logos`): shown on the judge demo only, and
  not ours to redistribute.
- Git history, and every `.env` file (none is ever committed).

Run from this snapshot, the logos won't show. The snapshot is for reading; the live demo is
the way to try it.

## Licence

Copyright © 2026 Tumoolo. All rights reserved. Shared for reading by the FNB App of the Year
Hackathon 2026 judges and organisers; no licence to use, copy or redistribute is granted.
Third-party pictures keep their own licences (see the CREDITS files and `pitch/README.md`).
