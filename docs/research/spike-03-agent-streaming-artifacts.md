# Spike 3: The agent streaming into the chat, with a tool call that renders an artifact

**Written:** 2026-10-13 · **Base commit:** `254550a` · **Planning:** §16.1 spike 3, §16.3, §16.5, D8

| | Verdict |
|---|---|
| **Stand-in** | **Holds.** Streaming, the tool loop and artifact rendering are built and tested from the model interface to the browser, with a scripted model |
| **Real service** | **Pending.** `AnthropicChatModel` is written but has never run against the API, and has no test of its own. Needs `ANTHROPIC_API_KEY` |

## The question

Can the agent stream its answer into the chat as it is written, call one of our tools in the
middle of a turn, and have the tool's typed result open as an **artifact** (a component chosen
by `kind`, never HTML from the model), all through a Vercel server function?

**Why it matters.** This is the product's core interaction (planning §3, §16.3): "When a tool
returns structured data (a course list, a study plan), the UI renders it as an artifact: a
typed component chosen by the result's type, never raw HTML from the model." It is also how
hard rule 2 works in practice: the facts come from tools that run our tested code, and the model
only explains them. If streaming plus tool calls didn't work through our stack, the chat
architecture would change.

## Stand-in verdict: holds

What is built:

- **The model interface.** `ChatModel` / `ModelRequest` in
  [packages/agent/src/model.ts](../../packages/agent/src/model.ts): `onText(delta)` for streaming,
  `callTool(name, input)` so every tool call comes back to our code.
- **The runner.** `runTurn` in [packages/agent/src/runner.ts](../../packages/agent/src/runner.ts):
  the deterministic crisis check first, then the model, tool inputs validated, artifacts
  collected and emitted as events.
- **The tools and artifacts.** 9 tools in `packages/agent/src/tools.ts`; artifact types
  (`results-card`, `course-explorer`, `score-breakdown`, `crisis-card`, `deadlines`,
  `application-pack`, `funding`) in `packages/agent/src/artifacts.ts`.
- **Two models behind the interface.** `SampleChatModel` (the local stand-in, routes by keyword
  through the same tools) and `ScriptedModel` in `packages/agent/src/testing.ts` (follows a
  script of tool calls and answers, for tests). The real one is `AnthropicChatModel` (below).
- **The stream.** [apps/web/app/api/chat/route.ts](../../apps/web/app/api/chat/route.ts) returns
  newline-delimited JSON: text deltas, artifacts as tools produce them, then `done` (or `error`).
  Both sides are stored. `maxDuration = 120`.
- **The browser.** [apps/web/app/(app)/chat/chat.tsx](../../apps/web/app/(app)/chat/chat.tsx)
  reads the stream with `getReader()`, appends text deltas and artifacts as they arrive, and
  renders each artifact through `ArtifactView` ([apps/web/components/artifacts.tsx](../../apps/web/components/artifacts.tsx)),
  a `switch` on `kind`.

What the tests prove:

| File | Tests |
|---|---|
| `packages/agent/src/agent.test.ts` | `runTurn`: `passes the model's tool calls through tested tools and collects their artifacts` (a scripted `my_results` call yields `results-card` and `course-explorer`), `turns a bad tool call into an error the model can see, not a crash`, `answers kindly when the model refuses or fails`, `answers a crisis with the reviewed reply and helplines, without calling the model`, `does not show the crisis card twice when the model also asks for it`, `sends only recent history and the new message last`. `tools`: `every tool has a JSON-serialisable input schema and a description`, `never runs an unknown tool or a bad input`, and one test per tool. `system prompt`: `is identical on every call, so it can be cached`, `carries every charter principle and no admission fact`. `SampleChatModel (the local stand-in)`: `shows results through the same tools`, `never bypasses the crisis check` |
| `apps/web/test/api.test.ts` | `the chat`: `streams an answer with artifacts from tools, and stores both sides` (through the real route handler: status 200, artifact events `results-card` then `course-explorer`, last event `done`), `answers a crisis with helplines and flags the stored message`, `refuses an empty message` |
| `apps/web/test/components.test.tsx` | `CrisisCard`: `offers one-tap call links with dialable numbers`; `ProgrammeCard`: `says exactly what to improve, and labels unverified data` |
| `packages/evals/src/index.test.ts` | `crisis red-team suite (hard rule 7)`: `passes every case` (64 cases, 100%) |
| `apps/web/e2e/journey.spec.ts` | `an adult learner goes from sign-in to an application pack`: sends "What can I study with my marks?" in the chat and sees the streamed answer; `a distressed message gets helplines, not coaching`: the `crisis-card` artifact renders in the chat (heading "Talk to someone now", a `tel:` link) and passes axe |

Commands run on 2026-10-13 (this branch):

```text
pnpm --filter @universityflow/agent exec vitest run src/agent.test.ts
  Test Files  1 passed (1) · Tests  28 passed (28)
pnpm --filter @universityflow/web exec vitest run test/api.test.ts -t "the chat|sign-in|Stage 1"
  Test Files  1 passed (1) · Tests  10 passed | 11 skipped (21)   (the 11 are other describes, filtered out)
pnpm --filter @universityflow/web exec vitest run test/components.test.tsx
  Test Files  1 passed (1) · Tests  5 passed (5)
pnpm --filter @universityflow/evals test
  Test Files  1 passed (1) · Tests  4 passed (4)
pnpm --filter @universityflow/web build && pnpm --filter @universityflow/web test:e2e
  4 passed (24.4s)
```

**So the design holds** with a model that behaves as the interface says. Limits of what this
proves, stated plainly:

- The E2E chat step asserts the streamed **text** of the adult journey, not that the
  `results-card` / `course-explorer` components rendered in the chat. The only artifact the E2E
  sees rendered in the chat is the `crisis-card`, and that one comes from the deterministic
  crisis protocol, not from a model tool call. The tool-call → artifact path is proven at the
  route level (`api.test.ts`), not in the browser.
- No test checks that text arrives **incrementally** (that the first delta reaches the browser
  before the turn ends). The route enqueues events as `runTurn` emits them, so it should, but a
  buffering proxy would not show up in any current test.
- `packages/ui`'s `ARTIFACT_KINDS` is a planning list (`results-card` … `study-plan`) that does
  not match the kinds the agent actually emits (`crisis-card`, `deadlines`, `application-pack`
  and `funding` are missing from it) and is not used by `ArtifactView`. Harmless today, but
  it is a second, stale source of truth.

## Real-service verdict: pending

`AnthropicChatModel` ([packages/agent/src/model.ts](../../packages/agent/src/model.ts)) is
written: `client.beta.messages.stream` with the charter cached (`cache_control: ephemeral`), the
per-request context uncached, server-side refusal fallback (`server-side-fallback-2026-07-01`,
`fallbacks: 'default'`), `output_config.effort`, and up to `MAX_TOOL_ROUNDS = 6` tool rounds.
**It has never run against the API and has no unit test**, not even with a mocked client: no
test file imports it. `services.ts` selects it whenever `ANTHROPIC_API_KEY` is set.

**Needed:** `ANTHROPIC_API_KEY` (the owner's first account, D8 recommends getting it early),
`ANTHROPIC_MODEL` (default `claude-opus-5`, `.env.example`).

### Steps at integration

1. Before the key: add a unit test for `AnthropicChatModel` with a fake `Anthropic` client that
   replays a recorded stream (text, a `tool_use`, the tool result, more text), so the loop's
   message shapes are pinned. This is cheap and catches SDK-shape mistakes without spending
   money.
2. With the key, locally: `ANTHROPIC_API_KEY=… pnpm --filter @universityflow/web dev`, sign in
   with a synthetic adult, type marks in by hand, then ask in the chat:
   - "What can I study with my marks?" → expect a `my_results` call and the results card and
     course explorer to open;
   - "Tell me about BA at UJ" → `programme_details` / `score-breakdown`;
   - "When do applications close at Wits?" → `deadlines`;
   - a crisis phrase → the crisis card, with **no** model request (the runner answers first).
3. Run the same against a preview deployment in `cpt1`, on a phone on mobile data.
4. Record time to first token and the cached-token count on the second message (the charter
   prefix must be a cache read).
5. Run Audit A10 checks 2–8, which need the key ([docs/audits/A10-ai-safety.md](../audits/A10-ai-safety.md)).

### Pass criteria (proposed; the owner confirms the numbers)

- Text visibly streams (first words on screen before the answer is complete) on the deployed
  preview, i.e. nothing in front of the function buffers the response.
- Each of the three questions calls the expected tool and opens the expected artifact; the model
  states no admission fact that isn't in the tool result (hard rule 2).
- Time to first token **≤ 3 s** at p50 on the deployed preview.
- From the second message on, the response's usage shows a cache read for the system prompt.
- The crisis red-team suite still passes 100% (it runs without the model, so it must not
  change), and A10 has no open Critical/High.

## Risks and fallback

- **SDK or beta-shape drift.** The adapter uses a beta stream with server-side fallback. If a
  parameter is rejected, the turn ends in the kind fallback reply, not a crash
  (`answers kindly when the model refuses or fails`), but the chat would be useless. Step 1
  above reduces this.
- **Vercel function duration.** `maxDuration = 120` s; six tool rounds with adaptive thinking
  could approach it. Measure the longest turn in step 2.
- **Streaming through the platform.** If the response is buffered in front of the function,
  fallback: Server-Sent Events, which every proxy passes through, with the same event shapes.
- **If the spike fails** on the model itself (quality, cost, latency): swap the model behind
  `ChatModel`; the runner, tools, artifacts and UI don't change. `ANTHROPIC_MODEL` already makes
  the model a configuration choice.
