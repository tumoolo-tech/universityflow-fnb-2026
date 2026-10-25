import { crisisWords, en } from '@universityflow/content';
import type { Artifact } from '@universityflow/ui';
import { assessCare, type CareTopic } from './care';
import type { AgentContext } from './context';
import { assessWithPrevious, type DistressLevel } from './crisis';
import { type ChatModel, type ChatTurn, failedWriter, NO_MODEL, type ReplyWriter } from './model';
import { requestContext, systemPrompt } from './system-prompt';
import { campusLinesFor, crisisCard, crisisReply, runTool, TOOLS, ToolInputError } from './tools';

/**
 * One learner message in, one answer out. The order matters:
 *
 * 1. The crisis check runs first, on the learner's own words (planning.md §4.3). In a crisis the
 *    model is never called: the learner gets the reviewed reply and the verified helplines.
 * 2. Otherwise the model answers, calling tools; every artifact comes from a tool.
 * 3. If the model refuses or fails, the learner still gets a kind, honest reply.
 *
 * Nothing here logs the conversation (hard rule 4).
 */

export type TurnEvent =
  | { readonly type: 'text'; readonly delta: string }
  | { readonly type: 'artifact'; readonly artifact: Artifact };

export interface TurnResult {
  readonly text: string;
  readonly artifacts: ReadonlyArray<Artifact>;
  readonly distress: DistressLevel;
  /** Hard moments the message raised (none in a crisis: the crisis protocol answered instead). */
  readonly care: ReadonlyArray<CareTopic>;
  readonly failed: boolean;
  /**
   * Who wrote the reply (A10-49), stored with it. The model that answered; the model that wrote
   * the words before a refusal or failure, when there were any (our kind line follows them); and
   * `NO_MODEL` when no model wrote anything the learner reads (a crisis, or a refusal or failure
   * before any words).
   */
  readonly writtenBy: ReplyWriter;
}

export interface TurnInput {
  readonly model: ChatModel;
  readonly context: AgentContext;
  /** Earlier turns, oldest first. */
  readonly history: ReadonlyArray<ChatTurn>;
  readonly message: string;
  readonly emit: (event: TurnEvent) => void;
}

/** Turns of history sent to the model. Older turns stay in the database, not in the prompt. */
export const HISTORY_TURNS = 20;

const SYSTEM = systemPrompt();

export async function runTurn(input: TurnInput): Promise<TurnResult> {
  const { context, emit } = input;
  const artifacts: Artifact[] = [];
  const show = (artifact: Artifact) => {
    artifacts.push(artifact);
    emit({ type: 'artifact', artifact });
  };
  const previous = input.history.findLast((t) => t.role === 'user')?.text;
  const distress = assessWithPrevious(previous, input.message);

  if (distress.level === 'crisis') {
    // The reply promises only what the verified lines on the card can keep (audit A10-11). With
    // an accepted offer, the card adds the learner's own campus lines, verified only (Phase 5b).
    const card = crisisCard(
      context.catalogue.helplines,
      distress.topics,
      await campusLinesFor(context),
    );
    const text = crisisReply(card);
    emit({ type: 'text', delta: text });
    show(card);
    return { text, artifacts, distress: 'crisis', care: [], failed: false, writtenBy: NO_MODEL };
  }

  const care = assessCare(input.message);

  // What the learner reads if the model fails while they are struggling: it mentions "these
  // lines" only when the card shows some.
  let concernReply: string = en.crisis.concernReply;
  if (distress.level === 'concern') {
    const card = crisisCard(
      context.catalogue.helplines,
      distress.topics,
      await campusLinesFor(context),
    );
    show(card);
    concernReply = crisisWords(card.cover, card.helplines.length).concernReply;
  }

  const profile = await context.profile();
  let streamed = '';
  try {
    const response = await input.model.respond({
      system: SYSTEM,
      context: requestContext({
        today: context.today,
        targetIntake: context.targetIntake,
        grade: profile?.grade ?? null,
        finishedSchool: profile?.schoolFinished === true,
        displayName: profile?.displayName ?? null,
        goal: profile?.goal ?? null,
        preview: context.catalogue.includesDrafts,
        concern: distress.level === 'concern',
        care,
      }),
      history: [...input.history.slice(-HISTORY_TURNS), { role: 'user', text: input.message }],
      tools: TOOLS,
      onText: (delta) => {
        streamed += delta;
        emit({ type: 'text', delta });
      },
      callTool: async (name, toolInput) => {
        try {
          const result = await runTool(context, name, toolInput);
          for (const artifact of result.artifacts) {
            // The card from a concern is already showing; don't show it twice.
            if (artifact.kind === 'crisis-card' && artifacts.some((a) => a.kind === 'crisis-card'))
              continue;
            show(artifact);
          }
          return { content: JSON.stringify(result.forModel), isError: false };
        } catch (error) {
          if (error instanceof ToolInputError) return { content: error.message, isError: true };
          throw error;
        }
      },
    });
    const writer = response.writtenBy ?? input.model.writer;
    if (response.refused || response.text.trim() === '') {
      const text = distress.level === 'concern' ? concernReply : en.chat.error;
      // A refusal can arrive mid-answer: start the reply on its own paragraph.
      const gap = streamed.trim() ? '\n\n' : '';
      emit({ type: 'text', delta: `${gap}${text}` });
      return {
        text: `${streamed}${gap}${text}`,
        artifacts,
        distress: distress.level,
        care,
        failed: true,
        writtenBy: streamed.trim() ? writer : NO_MODEL,
      };
    }
    return {
      text: response.text,
      artifacts,
      distress: distress.level,
      care,
      failed: false,
      writtenBy: writer,
    };
  } catch (error) {
    const text = distress.level === 'concern' ? concernReply : en.chat.error;
    emit({ type: 'text', delta: `${streamed ? '\n\n' : ''}${text}` });
    return {
      text: `${streamed}${streamed ? '\n\n' : ''}${text}`,
      artifacts,
      distress: distress.level,
      care,
      failed: true,
      writtenBy: streamed.trim() ? (failedWriter(error) ?? input.model.writer) : NO_MODEL,
    };
  }
}
