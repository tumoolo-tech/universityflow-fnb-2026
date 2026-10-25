import 'server-only';
import { assessWithPrevious, type ChatModel, SampleChatModel } from '@universityflow/agent';
import { en } from '@universityflow/content';
import type { Services } from '../services';

/** The demo's daily AI budget's name in the budget table. */
export const DEMO_AI_BUDGET = 'demo-ai';
const DAY_MS = 24 * 60 * 60 * 1000;

const STAND_IN = new SampleChatModel();

/**
 * Judge demo mode's optional daily AI cap (UF_DEMO_AI_DAILY_CAP; off unless set, the owner's
 * choice of 2026-10-23). Counted in the database across every server, one unit a message. Over it,
 * the reply starts with a kind line and comes from the scripted stand-in; the turn runner's crisis
 * check, care and every safety rule run as always. A crisis message is never counted or held back:
 * the crisis reply reaches no model anyway.
 *
 * Anywhere but a capped demo: the services' own model, no line.
 */
export async function demoCappedModel(
  services: Pick<Services, 'config' | 'model' | 'store'>,
  previous: string | undefined,
  message: string,
): Promise<{ model: ChatModel; kindLine: string | null }> {
  const cap = services.config.demo ? services.config.demoAiDailyCap : null;
  if (cap === null) return { model: services.model, kindLine: null };
  if (assessWithPrevious(previous, message).level === 'crisis') {
    return { model: services.model, kindLine: null };
  }
  const { allowed } = await services.store.takeBudget(DEMO_AI_BUDGET, [
    { limit: cap, windowMs: DAY_MS },
  ]);
  return allowed
    ? { model: services.model, kindLine: null }
    : { model: STAND_IN, kindLine: en.demo.aiCapLine };
}
