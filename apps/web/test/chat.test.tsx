// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { en } from '@universityflow/content';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Chat, type ChatMessage } from '../app/(app)/chat/chat';

/**
 * The chat (docs/design/README.md): an assistant-style column. The empty conversation is a hero
 * with the learner's name and four starter cards; the composer has the send button inside it;
 * Enter sends and Shift+Enter makes a new line; the conversation is a live region that keyboard
 * users can scroll. The API and its stream are unchanged.
 */

const t = en.chat;
const calls: Array<{ message: string }> = [];

function streamOf(lines: unknown[]): Response {
  const body = new ReadableStream({
    start(controller) {
      for (const line of lines)
        controller.enqueue(new TextEncoder().encode(`${JSON.stringify(line)}\n`));
      controller.close();
    },
  });
  return new Response(body, { status: 200 });
}

beforeEach(() => {
  calls.length = 0;
  Element.prototype.scrollIntoView = vi.fn();
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_path: string, init: RequestInit) => {
      calls.push(JSON.parse(String(init.body)) as { message: string });
      return streamOf([
        { type: 'text', delta: 'A synthetic reply.' },
        { type: 'done', crisis: false },
      ]);
    }),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const empty = (props: Partial<Parameters<typeof Chat>[0]> = {}) => (
  <Chat initial={[]} name="Sipho" hasReport={false} sample={false} {...props} />
);

describe('the empty conversation', () => {
  it('greets the learner by name, keeps the companion’s welcome, and offers the report link', () => {
    render(empty());
    expect(screen.getByRole('heading', { level: 2, name: 'Hi Sipho!' })).toBeTruthy();
    expect(screen.getByText(t.heroAsk)).toBeTruthy();
    expect(screen.getByText(/How are you doing\?/)).toBeTruthy();
    expect(screen.getByRole('link', { name: en.results.addReport }).getAttribute('href')).toBe(
      '/documents',
    );
  });

  it('has no report link once there is a report, and says just "Hi!" without a name', () => {
    render(empty({ name: null, hasReport: true }));
    expect(screen.getByRole('heading', { level: 2, name: 'Hi!' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: en.results.addReport })).toBeNull();
  });

  it('shows the four starters as cards, each a button with its note, that sends the question', async () => {
    render(empty());
    // Its own name, not the page's (A3-25).
    const starters = screen.getByRole('list', { name: t.startersLabel });
    const buttons = within(starters).getAllByRole('button');
    expect(buttons).toHaveLength(4);
    t.starters.forEach((question, i) => {
      expect(buttons[i]?.textContent).toBe(`${question}${t.starterNotes[i]}`);
    });
    fireEvent.click(buttons[1] as HTMLElement);
    await waitFor(() => expect(calls).toEqual([{ message: t.starters[1] }]));
    expect(await screen.findByText('A synthetic reply.')).toBeTruthy();
    // The hero and the starters give way to the conversation.
    expect(screen.queryByText(t.heroAsk)).toBeNull();
  });

  // A2-66 (DEMO-walk): the chat's welcome asked a second-year student to upload a school report.
  it.each([
    ['later-years', t.welcomeLeadLaterYears],
    ['arriving', t.welcomeLeadArriving],
  ] as const)(
    'at university (%s): its own welcome, no school report, the university starters (A2-66)',
    async (welcome, lead) => {
      render(empty({ welcome, hasReport: false }));
      expect(screen.getByText(lead)).toBeTruthy();
      expect(screen.queryByText(t.welcomeLead)).toBeNull();
      expect(screen.queryByRole('link', { name: en.results.addReport })).toBeNull();
      const buttons = within(screen.getByRole('list', { name: t.startersLabel })).getAllByRole(
        'button',
      );
      expect(buttons.map((b) => b.textContent)).toEqual(
        t.startersUniversity.map((q, i) => `${q}${t.starterNotesUniversity[i]}`),
      );
      fireEvent.click(buttons[0] as HTMLElement);
      await waitFor(() => expect(calls).toEqual([{ message: t.startersUniversity[0] }]));
    },
  );

  it('before university, the school welcome and starters, as before', () => {
    render(empty({ welcome: 'school' }));
    expect(screen.getByText(t.welcomeLead)).toBeTruthy();
    expect(screen.getByRole('link', { name: en.results.addReport })).toBeTruthy();
  });
});

describe('report this reply (A10-35)', () => {
  const r = t.report;
  const REPLY = '00000000-0000-4000-8000-0000000000a1';
  const history: ChatMessage[] = [
    { id: '00000000-0000-4000-8000-0000000000b1', role: 'student', content: 'Hi', artifacts: [] },
    { id: REPLY, role: 'assistant', content: 'A synthetic reply.', artifacts: [] },
  ];

  /** Fetch: the chat streams a reply with its stored id; a report answers `answer`. */
  function stub(answer: Response = Response.json({ status: 'reported' })) {
    const reports: Array<{ path: string; body: unknown }> = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string, init: RequestInit) => {
        if (path.endsWith('/report')) {
          reports.push({ path, body: JSON.parse(String(init.body)) });
          return answer;
        }
        return streamOf([
          { type: 'text', delta: 'A streamed reply.' },
          { type: 'done', crisis: false, messageId: '00000000-0000-4000-8000-0000000000c1' },
        ]);
      }),
    );
    return reports;
  }

  it('offers it under each AI reply only, and sends the chosen reason for that reply', async () => {
    const reports = stub();
    render(empty({ initial: history }));
    const open = screen.getAllByRole('button', { name: r.open });
    expect(open).toHaveLength(1);
    fireEvent.click(open[0] as HTMLElement);
    const group = screen.getByRole('group', { name: r.question });
    for (const reason of Object.values(r.reasons)) {
      expect(within(group).getByRole('radio', { name: reason })).toBeTruthy();
    }
    fireEvent.click(within(group).getByRole('radio', { name: r.reasons.harmful }));
    fireEvent.click(screen.getByRole('button', { name: r.send }));
    const thanks = await screen.findByText(r.sent);
    expect(reports).toEqual([
      { path: `/api/chat/messages/${REPLY}/report`, body: { reason: 'harmful' } },
    ]);
    // Harmful or upsetting: where to find someone now.
    expect(screen.getByRole('link', { name: r.help }).getAttribute('href')).toBe('/help');
    await waitFor(() => expect(document.activeElement).toBe(thanks.closest('[role="status"]')));
    expect(screen.queryByRole('button', { name: r.open })).toBeNull();
  });

  it('can report a reply that has just streamed in, by the id the stream gave', async () => {
    const reports = stub();
    render(empty());
    fireEvent.change(screen.getByLabelText(t.placeholder), { target: { value: 'Hello' } });
    fireEvent.click(screen.getByRole('button', { name: t.send }));
    fireEvent.click(await screen.findByRole('button', { name: r.open }));
    fireEvent.click(screen.getByRole('radio', { name: r.reasons.wrong }));
    fireEvent.click(screen.getByRole('button', { name: r.send }));
    await screen.findByText(r.sent);
    expect(reports[0]?.path).toBe('/api/chat/messages/00000000-0000-4000-8000-0000000000c1/report');
    // Not harmful: no help line.
    expect(screen.queryByRole('link', { name: r.help })).toBeNull();
  });

  it('says "Reported" for a reply reported before, with nothing to press', () => {
    stub();
    render(empty({ initial: [{ ...(history[1] as ChatMessage), reported: true }] }));
    expect(screen.getByText(r.reported)).toBeTruthy();
    expect(screen.queryByRole('button', { name: r.open })).toBeNull();
  });

  it('cancel closes it and puts focus back on the link; a failure says so and keeps it open', async () => {
    stub(Response.json({ error: 'server' }, { status: 500 }));
    render(empty({ initial: history }));
    fireEvent.click(screen.getByRole('button', { name: r.open }));
    fireEvent.click(screen.getByRole('button', { name: r.cancel }));
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole('button', { name: r.open })),
    );
    fireEvent.click(screen.getByRole('button', { name: r.open }));
    fireEvent.click(screen.getByRole('radio', { name: r.reasons.other }));
    fireEvent.click(screen.getByRole('button', { name: r.send }));
    expect(await screen.findByText(r.error)).toBeTruthy();
    expect(screen.getByRole('group', { name: r.question })).toBeTruthy();
  });
});

describe('the composer', () => {
  it('has a labelled field and a send button named "Send" inside the same box', () => {
    render(empty());
    const field = screen.getByLabelText(t.placeholder);
    const send = screen.getByRole('button', { name: t.send });
    expect(field.closest('[data-testid="composer"]')).toBe(
      send.closest('[data-testid="composer"]'),
    );
    // `aria-disabled`, never `disabled`: a disabled button drops keyboard focus (A3-25, A3-01).
    expect(send.getAttribute('aria-disabled')).toBe('true');
    expect(send.hasAttribute('disabled')).toBe(false);
    fireEvent.change(field, { target: { value: 'Hello' } });
    expect(send.getAttribute('aria-disabled')).toBe('false');
  });

  it('pressing Send with nothing typed sends nothing', () => {
    render(empty());
    fireEvent.click(screen.getByRole('button', { name: t.send }));
    expect(calls).toEqual([]);
  });
});

describe('keyboard focus stays in the conversation (A3-25, WCAG 2.4.3)', () => {
  it('after a starter, focus is in the message field, not back at the top of the page', async () => {
    render(empty());
    const starter = within(screen.getByRole('list', { name: t.startersLabel })).getAllByRole(
      'button',
    )[0] as HTMLElement;
    starter.focus();
    fireEvent.click(starter);
    await screen.findByText('A synthetic reply.');
    expect(document.activeElement).toBe(screen.getByLabelText(t.placeholder));
  });

  it('after Send, focus is in the message field, ready for the next question', async () => {
    render(empty());
    const field = screen.getByLabelText(t.placeholder);
    fireEvent.change(field, { target: { value: 'Hello' } });
    const send = screen.getByRole('button', { name: t.send });
    send.focus();
    fireEvent.click(send);
    await screen.findByText('A synthetic reply.');
    expect(document.activeElement).toBe(field);
  });

  it('sends on Enter, and Shift+Enter is a new line, not a send', async () => {
    render(empty());
    const field = screen.getByLabelText(t.placeholder);
    fireEvent.change(field, { target: { value: 'First line' } });
    fireEvent.keyDown(field, { key: 'Enter', shiftKey: true });
    expect(calls).toEqual([]);
    fireEvent.keyDown(field, { key: 'Enter' });
    await waitFor(() => expect(calls).toEqual([{ message: 'First line' }]));
    expect(await screen.findByText('A synthetic reply.')).toBeTruthy();
  });

  it('shows the disclaimer as one muted line under the field', () => {
    render(empty());
    expect(screen.getByText(t.disclaimer).className).toContain('text-muted');
  });

  it('in a preview, says there under the field that no AI is connected (the notice is hidden here)', () => {
    render(empty({ sample: true }));
    expect(screen.getByText(/^Preview: no AI is connected/)).toBeTruthy();
    expect(screen.queryByText(t.disclaimer)).toBeNull();
  });
});

describe('the conversation', () => {
  const history: ChatMessage[] = [
    { id: 'm1', role: 'student', content: 'Synthetic question', artifacts: [] },
    { id: 'm2', role: 'assistant', content: 'Synthetic answer', artifacts: [] },
  ];

  it('is a live region a keyboard can scroll, naming who said each message', () => {
    render(empty({ initial: history }));
    const region = screen.getByRole('region', { name: t.conversation });
    expect(region.getAttribute('tabindex')).toBe('0');
    const list = within(region).getByRole('list');
    expect(list.getAttribute('aria-live')).toBe('polite');
    const items = within(list).getAllByRole('listitem');
    expect(items[0]?.textContent).toContain(t.you);
    expect(items[1]?.textContent).toContain(t.assistant);
    expect(screen.queryByText(t.heroAsk)).toBeNull();
  });

  it('draws the learner’s message as a tinted bubble and the companion’s without a box', () => {
    render(empty({ initial: history }));
    expect(screen.getByText('Synthetic question').className).toContain('uf-bubble');
    expect(screen.getByText('Synthetic answer').className).not.toContain('uf-bubble');
  });
});
