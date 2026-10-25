import { fireEvent, render, waitFor, within } from '@testing-library/react-native';
import { en } from '@universityflow/content/app';
import type { Artifact } from '@universityflow/ui';
import { AccessibilityInfo, Linking } from 'react-native';
import ChatScreen from '../app/chat';
import { saveToken } from '../lib/session';
import { ndjson, serve } from '../test-utils/fake-api';

const crisisCard: Artifact = {
  kind: 'crisis-card',
  helplines: [
    {
      id: 'sadag',
      name: 'Test Helpline',
      purpose: 'Someone to talk to.',
      hours: '24 hours',
      numbers: [
        { kind: 'call', value: '0800 567 567' },
        { kind: 'sms', value: '31393' },
      ],
    },
  ],
} as Artifact;

beforeEach(async () => {
  await saveToken('tok');
});

async function send(screen: Awaited<ReturnType<typeof render>>, text: string) {
  await fireEvent.changeText(await screen.findByTestId('chat-input'), text);
  await fireEvent.press(screen.getByRole('button', { name: en.chat.send }));
}

describe('report this reply (A10-35)', () => {
  const r = en.chat.report;
  const REPLY = '00000000-0000-4000-8000-0000000000a1';
  const history = {
    sample: false,
    messages: [
      { id: 'm1', role: 'student', content: 'Hi', artifacts: [], crisis: false },
      { id: REPLY, role: 'assistant', content: 'A synthetic reply.', artifacts: [], crisis: false },
    ],
  };

  it('offers it under an AI reply only, sends the chosen reason, and says thanks', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    const calls = serve({
      'GET /api/chat': { json: history },
      [`POST /api/chat/messages/${REPLY}/report`]: { json: { status: 'reported' } },
    });
    const screen = await render(<ChatScreen />);
    const open = await screen.findAllByRole('button', { name: r.open });
    expect(open).toHaveLength(1);
    await fireEvent.press(open[0] as (typeof open)[number]);
    expect(screen.getByText(r.question)).toBeTruthy();
    for (const reason of Object.values(r.reasons)) {
      expect(screen.getByRole('radio', { name: reason })).toBeTruthy();
    }
    await fireEvent.press(screen.getByRole('radio', { name: r.reasons.harmful }));
    await fireEvent.press(screen.getByRole('button', { name: r.send }));
    expect(await screen.findByText(r.sent)).toBeTruthy();
    expect(calls.find((c) => c.key.endsWith('/report'))?.body).toEqual({ reason: 'harmful' });
    expect(announce).toHaveBeenCalledWith(r.sent);
    // Harmful or upsetting: Get help opens the web's help page.
    const openUrl = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    await fireEvent.press(screen.getByRole('link', { name: r.help }));
    expect(openUrl).toHaveBeenCalledWith(expect.stringMatching(/\/help$/));
    openUrl.mockRestore();
    announce.mockRestore();
  });

  it('can report a reply that has just streamed in, and shows "Reported" for one reported before', async () => {
    const calls = serve({
      'GET /api/chat': {
        json: { ...history, messages: [{ ...history.messages[1], reported: true }] },
      },
      'POST /api/chat': {
        chunks: [
          ndjson(
            { type: 'text', delta: 'A streamed reply.' },
            { type: 'done', crisis: false, messageId: '00000000-0000-4000-8000-0000000000c1' },
          ),
        ],
      },
      'POST /api/chat/messages/00000000-0000-4000-8000-0000000000c1/report': {
        json: { status: 'reported' },
      },
    });
    const screen = await render(<ChatScreen />);
    expect(await screen.findByText(r.reported)).toBeTruthy();
    await send(screen, 'Hello');
    await fireEvent.press(await screen.findByRole('button', { name: r.open }));
    await fireEvent.press(screen.getByRole('radio', { name: r.reasons.wrong }));
    await fireEvent.press(screen.getByRole('button', { name: r.send }));
    expect(await screen.findByText(r.sent)).toBeTruthy();
    expect(calls.some((c) => c.key.endsWith('0000000000c1/report'))).toBe(true);
    expect(screen.queryByRole('link', { name: r.help })).toBeNull();
  });

  it('a failure says so and keeps the choices open', async () => {
    serve({
      'GET /api/chat': { json: history },
      [`POST /api/chat/messages/${REPLY}/report`]: { status: 500, json: { error: 'server' } },
    });
    const screen = await render(<ChatScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: r.open }));
    await fireEvent.press(screen.getByRole('radio', { name: r.reasons.other }));
    await fireEvent.press(screen.getByRole('button', { name: r.send }));
    expect(await screen.findByText(r.error)).toBeTruthy();
    expect(screen.getByRole('radio', { name: r.reasons.other })).toBeTruthy();
  });
});

describe('the chat', () => {
  it('shows the history, then streams a reply in and stores nothing locally', async () => {
    const reply = ndjson(
      { type: 'text', delta: 'You can ' },
      { type: 'text', delta: 'apply to 3 courses.' },
      { type: 'artifact', artifact: { kind: 'deadlines', windows: [], targetIntake: 2028 } },
      { type: 'done', crisis: false },
    );
    const calls = serve({
      'GET /api/chat': {
        json: {
          sample: true,
          messages: [
            { id: 'm1', role: 'student', content: 'Hello', artifacts: [], crisis: false },
            {
              id: 'm2',
              role: 'assistant',
              content: 'Hi! How are you?',
              artifacts: [],
              crisis: false,
            },
          ],
        },
      },
      // Split mid-line, the way a network delivers it.
      'POST /api/chat': { chunks: [reply.slice(0, 20), reply.slice(20, 70), reply.slice(70)] },
    });
    const screen = await render(<ChatScreen />);
    expect(await screen.findByText('Hi! How are you?')).toBeTruthy();
    // In a preview the line under the field says no AI is connected, as on the web.
    expect(screen.getByTestId('chat-line')).toHaveTextContent(en.chat.sampleLine);

    await send(screen, 'What can I study?');
    expect(await screen.findByText('You can apply to 3 courses.')).toBeTruthy();
    expect(screen.getByText('What can I study?')).toBeTruthy();
    const card = within(screen.getByTestId('artifact-deadlines'));
    expect(card.getByRole('header', { name: en.deadlines.title })).toBeTruthy();
    expect(card.getByText(en.deadlines.none)).toBeTruthy();
    expect(calls.find((c) => c.key === 'POST /api/chat')?.body).toEqual({
      message: 'What can I study?',
    });
    expect(screen.queryByTestId('crisis-reply')).toBeNull();
    await waitFor(() => expect(screen.getByRole('button', { name: en.chat.send })).toBeTruthy());
  });

  it('renders a crisis reply prominently, with helplines that dial', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    serve({
      'GET /api/chat': { json: { sample: false, messages: [] } },
      'POST /api/chat': {
        chunks: [
          ndjson(
            { type: 'text', delta: en.crisis.reply },
            { type: 'artifact', artifact: crisisCard },
            { type: 'done', crisis: true },
          ),
        ],
      },
    });
    const screen = await render(<ChatScreen />);
    await send(screen, 'synthetic distress message');

    const reply = await screen.findByTestId('crisis-reply');
    expect(within(reply).getAllByRole('header', { name: en.crisis.cardTitle }).length).toBe(2);
    expect(within(reply).getByText(en.crisis.reply)).toBeTruthy();
    const card = within(screen.getByTestId('crisis-card'));
    expect(card.getByText('Test Helpline')).toBeTruthy();

    await fireEvent.press(card.getByRole('link', { name: en.crisis.call('0800 567 567') }));
    expect(open).toHaveBeenCalledWith('tel:0800567567');
    await fireEvent.press(card.getByRole('link', { name: en.crisis.sms('31393') }));
    expect(open).toHaveBeenCalledWith('sms:31393');
    open.mockRestore();
  });

  it('a crisis reply from the history is prominent too', async () => {
    serve({
      'GET /api/chat': {
        json: {
          sample: false,
          messages: [
            {
              id: 'c1',
              role: 'assistant',
              content: en.crisis.reply,
              artifacts: [crisisCard],
              crisis: true,
            },
          ],
        },
      },
    });
    const screen = await render(<ChatScreen />);
    expect(await screen.findByTestId('crisis-reply')).toBeTruthy();
    const card = within(screen.getByTestId('crisis-card'));
    // A card stored before A10-11 says nothing about its lines' hours.
    expect(card.queryByText(en.crisis.cardLead)).toBeNull();
    expect(card.getByText(en.crisis.cardLeadSetHours)).toBeTruthy();
  });

  it('a crisis reply’s heading is read and reachable as a heading, not swallowed by a grouped label (A3-28)', async () => {
    serve({
      'GET /api/chat': {
        json: {
          sample: false,
          messages: [
            { id: 'c1', role: 'assistant', content: en.crisis.reply, artifacts: [], crisis: true },
          ],
        },
      },
    });
    const screen = await render(<ChatScreen />);
    const reply = await screen.findByTestId('crisis-reply');
    const heading = within(reply).getByRole('header', { name: en.crisis.cardTitle });
    // A screen reader reads an `accessible` element as one item, by its label: a header inside
    // one is neither announced nor in heading navigation. RNTL's role query can't tell, so walk up.
    const grouped: string[] = [];
    for (let node = heading.parent; node; node = node.parent) {
      if (node.props.accessible === true) grouped.push(String(node.props.accessibilityLabel));
    }
    expect(grouped).toEqual([]);
    // The reply itself is still read as the companion's.
    expect(within(reply).getByLabelText(`${en.chat.assistant}: ${en.crisis.reply}`)).toBeTruthy();
  });

  it('a crisis card with no verified line makes no promise about calling (A10-11)', async () => {
    serve({
      'GET /api/chat': {
        json: {
          sample: false,
          messages: [
            {
              id: 'c2',
              role: 'assistant',
              content: en.crisis.replyNoLines,
              artifacts: [{ kind: 'crisis-card', helplines: [], cover: 'none' }],
              crisis: true,
            },
          ],
        },
      },
    });
    const screen = await render(<ChatScreen />);
    const card = within(await screen.findByTestId('crisis-card'));
    expect(card.getByText(en.crisis.noVerifiedNumbers)).toBeTruthy();
    expect(card.queryByText(en.crisis.cardLead)).toBeNull();
    expect(card.queryByText(en.crisis.cardLeadSetHours)).toBeNull();
  });

  it('shows the error sentence when the stream reports an error', async () => {
    serve({
      'GET /api/chat': { json: { sample: false, messages: [] } },
      'POST /api/chat': { chunks: [ndjson({ type: 'error' })] },
    });
    const screen = await render(<ChatScreen />);
    await send(screen, 'hello');
    expect(await screen.findByText(en.chat.error)).toBeTruthy();
  });

  it('offers the starters on an empty conversation, each a card with its note, that sends it', async () => {
    const calls = serve({
      'GET /api/chat': { json: { sample: false, messages: [] } },
      'POST /api/chat': {
        chunks: [ndjson({ type: 'text', delta: 'Sure.' }, { type: 'done', crisis: false })],
      },
    });
    const screen = await render(<ChatScreen />);
    for (const [i, starter] of en.chat.starters.entries()) {
      const card = await screen.findByRole('button', { name: starter });
      expect(within(card).getByText(en.chat.starterNotes[i] as string)).toBeTruthy();
    }
    expect(screen.getByRole('header', { name: `${en.chat.heroHi}!` })).toBeTruthy();
    expect(screen.getByTestId('chat-line')).toHaveTextContent(en.chat.disclaimer);
    await fireEvent.press(screen.getByRole('button', { name: en.chat.starters[1] }));
    expect(await screen.findByText('Sure.')).toBeTruthy();
    expect(calls.find((c) => c.key === 'POST /api/chat')?.body).toEqual({
      message: en.chat.starters[1],
    });
  });

  // A2-66 (DEMO-walk): the chat's welcome asked a second-year student to upload a school report.
  it.each([
    ['later-years', en.chat.welcomeLeadLaterYears],
    ['arriving', en.chat.welcomeLeadArriving],
  ] as const)(
    'at university (%s): its own welcome and the university starters (A2-66)',
    async (welcome, lead) => {
      const calls = serve({
        'GET /api/chat': { json: { sample: false, messages: [], welcome } },
        'POST /api/chat': {
          chunks: [ndjson({ type: 'text', delta: 'Sure.' }, { type: 'done', crisis: false })],
        },
      });
      const screen = await render(<ChatScreen />);
      expect(await screen.findByText(lead)).toBeTruthy();
      expect(screen.queryByText(en.chat.welcomeLead)).toBeNull();
      for (const [i, starter] of en.chat.startersUniversity.entries()) {
        const card = screen.getByRole('button', { name: starter });
        expect(within(card).getByText(en.chat.starterNotesUniversity[i] as string)).toBeTruthy();
      }
      expect(screen.queryByRole('button', { name: en.chat.starters[0] })).toBeNull();
      await fireEvent.press(screen.getByRole('button', { name: en.chat.startersUniversity[0] }));
      expect(await screen.findByText('Sure.')).toBeTruthy();
      expect(calls.find((c) => c.key === 'POST /api/chat')?.body).toEqual({
        message: en.chat.startersUniversity[0],
      });
    },
  );

  it('keeps the school welcome when the server says school, or says nothing (an older server)', async () => {
    serve({ 'GET /api/chat': { json: { sample: false, messages: [], welcome: 'school' } } });
    const screen = await render(<ChatScreen />);
    expect(await screen.findByText(en.chat.welcomeLead)).toBeTruthy();
  });

  it('greets the learner by the name they gave, in the hero', async () => {
    serve({
      'GET /api/chat': { json: { sample: false, messages: [] } },
      'GET /api/me': { json: { ready: true, profile: { displayName: 'Lerato' } } },
    });
    const screen = await render(<ChatScreen />);
    expect(await screen.findByRole('header', { name: `${en.chat.heroHi} Lerato!` })).toBeTruthy();
  });

  it('puts the send button inside the field’s box', async () => {
    serve({ 'GET /api/chat': { json: { sample: false, messages: [] } } });
    const screen = await render(<ChatScreen />);
    const composer = within(await screen.findByTestId('composer'));
    expect(composer.getByTestId('chat-input')).toBeTruthy();
    expect(composer.getByRole('button', { name: en.chat.send })).toBeTruthy();
  });
});
