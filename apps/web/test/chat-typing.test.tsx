// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { en } from '@universityflow/content';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatMessage } from '../app/(app)/chat/chat';

/**
 * A4-16: the draft lived beside the conversation, so every keystroke re-rendered every message
 * and artifact card (40–112 ms a key at 50 messages on a slow phone, 16 ms in an empty chat).
 * Typing now touches the composer alone. Counted on the artifact cards, the heaviest part of a
 * message. Synthetic messages only.
 */

const renders = { artifacts: 0 };
vi.mock('@/components/artifacts', () => ({
  ArtifactView: () => {
    renders.artifacts += 1;
    return <div>Synthetic card</div>;
  },
}));

const { Chat } = await import('../app/(app)/chat/chat');

/** A long conversation: 50 messages, every reply with one card. */
const conversation: ChatMessage[] = Array.from({ length: 50 }, (_, i) =>
  i % 2 === 0
    ? { id: `me-${i}`, role: 'student', content: `Synthetic question ${i}`, artifacts: [] }
    : {
        id: `reply-${i}`,
        role: 'assistant',
        content: `Synthetic answer ${i}`,
        artifacts: [{ kind: 'synthetic' } as never],
      },
);

beforeEach(() => {
  renders.artifacts = 0;
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(cleanup);

describe('typing in a long chat (A4-16)', () => {
  it('re-renders no message while the learner types', () => {
    render(<Chat initial={conversation} name={null} hasReport sample={false} />);
    const first = renders.artifacts;
    expect(first).toBe(25);
    const field = screen.getByLabelText(en.chat.placeholder);
    for (const draft of ['W', 'Wh', 'Wha', 'What', 'What ', 'What n', 'What no', 'What now']) {
      fireEvent.change(field, { target: { value: draft } });
    }
    expect((field as HTMLTextAreaElement).value).toBe('What now');
    expect(renders.artifacts).toBe(first);
  });

  it('still knows what was typed: Send turns ready once there is a draft', () => {
    render(<Chat initial={conversation} name={null} hasReport sample={false} />);
    const send = screen.getByRole('button', { name: en.chat.send });
    expect(send.getAttribute('aria-disabled')).toBe('true');
    fireEvent.change(screen.getByLabelText(en.chat.placeholder), {
      target: { value: 'Synthetic' },
    });
    expect(send.getAttribute('aria-disabled')).toBe('false');
  });
});
