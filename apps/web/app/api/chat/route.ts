import { type Artifact, runTurn, type TurnEvent } from '@universityflow/agent';
import { chatWelcome } from '@universityflow/ui';
import { z } from 'zod';
import { agentContext } from '@/lib/server/agent-context';
import { demoCappedModel } from '@/lib/server/demo/ai-cap';
import { HttpError, handler, json, parseBody, QUOTAS, requireReady } from '@/lib/server/http';
import { learnerPlace } from '@/lib/server/learner-place';
import { getServices } from '@/lib/server/services';

export const maxDuration = 120;

/** The conversation so far. */
export const GET = handler(async (request: Request) => {
  const { student } = await requireReady(request);
  const conversationId = await student.conversationId();
  const { model, catalogue } = await getServices();
  const [history, reported, place] = await Promise.all([
    student.history(conversationId, 60),
    student.reportedReplies(),
    learnerPlace(student, catalogue()),
  ]);
  const isReported = new Set(reported);
  return json({
    sample: model.isSample,
    // The empty chat's welcome for where the learner is (A2-66): the app shows the same.
    welcome: chatWelcome(place.stage, place.universityYear?.group ?? null),
    messages: history.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      artifacts: m.artifacts as Artifact[],
      crisis: m.crisis,
      // A reply the learner reported (A10-35): the chat shows "Reported", not the link again.
      reported: isReported.has(m.id),
    })),
  });
});

const Body = z.object({ message: z.string().trim().min(1).max(2000) });

/**
 * One learner message. The answer streams back as newline-delimited JSON events: text deltas,
 * then artifacts as tools produce them, then `done`. Both sides of the exchange are stored.
 */
export const POST = handler(async (request: Request) => {
  const { student, studentId } = await requireReady(request);
  const { message } = await parseBody(request, Body);
  const services = await getServices();
  const { catalogue, store } = services;
  // Every message may call the model, which costs money: a per-learner cap (finding 6).
  if (!(await store.allow('chat', studentId, QUOTAS.chat.max, QUOTAS.chat.windowMs))) {
    throw new HttpError(429, 'rate-limited');
  }
  const conversationId = await student.conversationId();
  const earlier = await student.history(conversationId, 40);
  // Judge demo mode's optional daily AI cap: over it, a kind line, then the stand-in.
  const { model, kindLine } = await demoCappedModel(
    services,
    earlier.findLast((m) => m.role === 'student')?.content,
    message,
  );
  await student.appendMessage({ conversationId, role: 'student', content: message });
  const context = await agentContext(student, catalogue());

  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (
        event: TurnEvent | { type: 'done'; crisis: boolean; messageId: string } | { type: 'error' },
      ) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      try {
        const prefix = kindLine ? `${kindLine}\n\n` : '';
        if (prefix) send({ type: 'text', delta: prefix });
        const result = await runTurn({
          model,
          context,
          history: earlier.map((m) => ({
            role: m.role === 'student' ? ('user' as const) : ('assistant' as const),
            text: m.content,
          })),
          message,
          emit: send,
        });
        const stored = await student.appendMessage({
          conversationId,
          role: 'assistant',
          content: `${prefix}${result.text}`,
          artifacts: [...result.artifacts],
          crisis: result.distress === 'crisis',
          // Which provider wrote it (A10-49): a name and a model id only.
          writtenBy: result.writtenBy,
        });
        // The stored reply's id, so it can be reported straight away (A10-35).
        send({
          type: 'done',
          crisis: result.distress === 'crisis',
          messageId: stored?.id as string,
        });
      } catch {
        send({ type: 'error' });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(body, {
    headers: {
      'content-type': 'application/x-ndjson; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    },
  });
});
