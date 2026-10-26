// @vitest-environment jsdom

import { cleanup, render, screen, within } from '@testing-library/react';
import { en } from '@universityflow/content';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Chat, type ChatMessage } from '../app/(app)/chat/chat';

/**
 * RT-02 (the owner's run-through, 2026-10-25): an AI reply's Markdown showed as typed,
 * "* **Howard College** (Durban)". A reply is now real paragraphs, lists and bold words; the
 * learner's own message stays exactly as they typed it.
 */

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(cleanup);

const reply: ChatMessage = {
  id: 'reply-1',
  role: 'assistant',
  content: [
    'UKZN has five campuses:',
    '',
    '* **Howard College** (Durban)',
    '* **Westville Campus** (Durban)',
    '',
    '1. Make a CAO account.',
    '2. Choose up to six programmes.',
  ].join('\n'),
  artifacts: [],
};
const mine: ChatMessage = {
  id: 'me-1',
  role: 'student',
  content: '**not bold** * not a list',
  artifacts: [],
};

function show() {
  render(<Chat initial={[mine, reply]} name="Sipho" hasReport sample={false} />);
  return screen.getByRole('region', { name: en.chat.conversation });
}

describe('an AI reply in the chat (RT-02)', () => {
  it('shows bullets as a list and bold words in bold, with no asterisks', () => {
    const conversation = show();
    const lists = within(conversation).getAllByRole('list');
    const bullets = lists.find((l) => l.tagName === 'UL' && l.textContent?.includes('Howard'));
    expect(bullets).toBeTruthy();
    const items = within(bullets as HTMLElement).getAllByRole('listitem');
    expect(items.map((i) => i.textContent)).toEqual([
      'Howard College (Durban)',
      'Westville Campus (Durban)',
    ]);
    expect(items[0]?.querySelector('strong')?.textContent).toBe('Howard College');
    expect(conversation.textContent).not.toContain('**Howard');
  });

  it('shows numbered steps as an ordered list', () => {
    const steps = show().querySelector('ol ol, li ol');
    expect(steps?.tagName).toBe('OL');
    expect(steps?.querySelectorAll('li').length).toBe(2);
  });

  it('keeps the learner’s own message exactly as typed', () => {
    expect(within(show()).getByText('**not bold** * not a list')).toBeTruthy();
  });
});
