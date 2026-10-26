// @vitest-environment jsdom

import { cleanup, render, screen, within } from '@testing-library/react';
import {
  type ChatModel,
  FallbackChatModel,
  GeminiChatModel,
  SampleChatModel,
} from '@universityflow/agent';
import { en } from '@universityflow/content';
import type { ReactElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * Finding AI-01 (High, 2026-10-24): the owner put the judge demo's chat on Google's Gemini until
 * 2026-11-08, while the privacy page and the chat named only Anthropic. While Gemini can answer
 * (production refuses it), the chat's line under the composer and the privacy page say so; when
 * it can't, neither mentions Google. Read from the model the services actually built.
 */

const state = vi.hoisted(() => ({ model: null as unknown }));

vi.mock('@/lib/server/services', () => ({
  getServices: async () => ({
    model: state.model,
    catalogue: () => ({ helplines: [] }),
  }),
}));
vi.mock('@/lib/server/session', () => ({
  currentStudent: async () => null,
  readyStudent: async () => ({
    studentId: 'student-1',
    student: {
      conversationId: async () => 'conversation-1',
      history: async () => [],
      profile: async () => null,
      latestReport: async () => null,
      reportedReplies: async () => [],
    },
  }),
}));
vi.mock('@/lib/server/learner-place', () => ({
  learnerPlace: async () => ({ stage: 'grade-11', universityYear: null }),
}));

const ChatPage = (await import('../app/(app)/chat/page')).default;
const Privacy = (await import('../app/privacy/page')).default;

const g = en.geminiNotice;
/** Claude as the services name it (the Anthropic SDK itself refuses to start under jsdom). */
const anthropic = (): ChatModel => ({
  isSample: false,
  writer: { provider: 'anthropic', model: 'claude-test-model' },
  respond: async () => {
    throw new Error('not called');
  },
});
const gemini = () =>
  new GeminiChatModel({ apiKey: 'test-gemini-key-not-real', model: 'gemini-test' });

const MODELS: Array<[string, () => ChatModel, 'first' | 'fallback' | null]> = [
  ['Gemini alone', gemini, 'first'],
  [
    'Gemini first, Claude on an outage',
    () => new FallbackChatModel(gemini(), anthropic()),
    'first',
  ],
  [
    'Claude first, Gemini on an outage',
    () => new FallbackChatModel(anthropic(), gemini()),
    'fallback',
  ],
  ['Claude alone', anthropic, null],
  ['the stand-in', () => new SampleChatModel(), null],
];

afterEach(cleanup);

describe('the chat names Google’s Gemini while it answers (AI-01)', () => {
  it.each(MODELS)('%s', async (_, make, role) => {
    state.model = make();
    const page = (await ChatPage()) as ReactElement<{ disclaimer?: string }>;
    expect(page.props.disclaimer).toBe(role ? g.chat[role] : undefined);
  });

  it('the lines are honest: an AI, and which one', () => {
    for (const line of Object.values(g.chat)) {
      expect(line).toMatch(/an AI, not a person/);
      expect(line).toMatch(/Google’s Gemini/);
    }
    expect(g.chat.fallback).toMatch(/Anthropic’s Claude/);
  });
});

describe('/privacy names Google as an operator while Gemini answers (AI-01)', () => {
  it.each(MODELS)('%s', async (_, make, role) => {
    state.model = make();
    const { container } = render(await Privacy());
    const operators = screen.getByRole('region', { name: en.privacyPage.sections.operators.title });
    if (!role) {
      expect(container.textContent).not.toMatch(/Gemini|Google’s/);
      return;
    }
    const google = within(operators).getByRole('heading', { level: 3, name: g.operator.name });
    const item = google.closest('li') as HTMLElement;
    expect(within(item).getByText(g.operator.does[role])).toBeTruthy();
    expect(within(item).getByText(g.operator.gets)).toBeTruthy();
    expect(within(item).getByText(g.operator.where)).toBeTruthy();
    expect(within(operators).getByText(g.crossBorder[role])).toBeTruthy();
    // Anthropic stays: it reads the uploads whichever model chats.
    expect(within(operators).getByRole('heading', { level: 3, name: /^Anthropic/ })).toBeTruthy();
  });
});
