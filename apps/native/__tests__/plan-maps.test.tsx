import { fireEvent, render, waitFor, within } from '@testing-library/react-native';
import { en } from '@universityflow/content/app';
import { type PlanMapsResponse, type PlanMapView, templateSeed } from '@universityflow/ui';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AccessibilityInfo } from 'react-native';
import PlanMapScreen from '../app/plan-map';
import { PlanMapsSection } from '../components/plan-maps';
import { saveToken } from '../lib/session';
import { serve } from '../test-utils/fake-api';

/**
 * My plan maps in the app (docs/design/plan-maps-proposal.md §8.5, D6: the outline view now, the
 * Picture view later with react-native-svg): the card on My goal, and one map as an outline drawn
 * with Views. The same API as the web. RNTL v14: render and fireEvent are awaited. Synthetic words.
 */

const t = en.planMaps;
const ta = en.planMapsApp;
const MAP_ID = '00000000-0000-4000-9000-000000000001';

function mapOf(
  wordsAllowed = true,
  templateId: 'six-stops' | 'the-road' = 'six-stops',
  title: string | null = null,
): PlanMapView {
  const seed = templateSeed(templateId);
  const id = (ref: string) =>
    `00000000-0000-4000-8000-${String(seed.findIndex((s) => s.ref === ref)).padStart(12, '0')}`;
  return {
    id: MAP_ID,
    templateId,
    title,
    linksGoal: false,
    goal: null,
    nodes: seed.map((s) => ({
      id: id(s.ref),
      parentId: s.parentRef ? id(s.parentRef) : null,
      position: s.position,
      depth: s.depth,
      slotId: s.slotId,
      text: null,
      status: s.slotId === 'slot:grade-10' ? 'achieved' : 'planned',
      whyNot: null,
      differently: null,
      targetMonth: null,
    })),
    wordsAllowed,
    updatedAt: '2026-10-13T08:00:00.000Z',
  };
}

const grade11 = (map: PlanMapView) => map.nodes.find((n) => n.slotId === 'slot:grade-11');

beforeEach(async () => {
  await saveToken('tok');
  (useLocalSearchParams as jest.Mock).mockReturnValue({ id: MAP_ID });
  (useRouter().push as jest.Mock).mockClear();
});

describe('the My plan maps card', () => {
  it('lists the maps with their counts, and starts a new one with one POST', async () => {
    const list: PlanMapsResponse = {
      maps: [
        {
          id: MAP_ID,
          templateId: 'staircase',
          title: null,
          counts: { planned: 7, achieved: 1, notAchieved: 0 },
          updatedAt: '2026-10-13T08:00:00.000Z',
        },
      ],
      wordsAllowed: false,
      max: 10,
    };
    const calls = serve({
      'GET /api/me/plan-maps': { json: list },
      'POST /api/me/plan-maps': { json: { map: { id: 'new-map' } } },
    });
    const screen = await render(<PlanMapsSection hasGoal={false} />);
    expect(await screen.findByText(t.counts(1, 0, 7))).toBeTruthy();
    expect(screen.getByText(t.leadTickOnly)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: t.start }));
    // A group isn't `accessible` (that would merge its radios on iOS): found by its label.
    const group = screen.getByLabelText(t.chooseTemplate);
    expect(group.props.accessibilityRole).toBe('radiogroup');
    expect(within(group).getAllByRole('radio')).toHaveLength(5);
    await fireEvent.press(within(group).getByRole('radio', { name: t.templates['the-road'].name }));
    await fireEvent.press(screen.getByRole('button', { name: t.create }));
    await waitFor(() =>
      expect(useRouter().push).toHaveBeenCalledWith({
        pathname: '/plan-map',
        params: { id: 'new-map' },
      }),
    );
    expect(calls.filter((c) => c.key === 'POST /api/me/plan-maps').map((c) => c.body)).toEqual([
      { templateId: 'the-road', linksGoal: false },
    ]);
  });

  it('with no maps, says so in a muted line', async () => {
    serve({ 'GET /api/me/plan-maps': { json: { maps: [], wordsAllowed: true, max: 10 } } });
    const screen = await render(<PlanMapsSection hasGoal />);
    expect(await screen.findByText(t.empty)).toBeTruthy();
    expect(screen.getByText(t.lead)).toBeTruthy();
  });

  // RT-06 (the owner's run-through, 2026-10-25): a map has the learner's own name; the template
  // is only its layout.
  it('shows each map by its own name, with the template as a small label', async () => {
    const list: PlanMapsResponse = {
      maps: [
        {
          id: MAP_ID,
          templateId: 'the-road',
          title: 'My road to Wits',
          counts: { planned: 5, achieved: 0, notAchieved: 0 },
          updatedAt: '2026-10-13T08:00:00.000Z',
        },
      ],
      wordsAllowed: true,
      max: 10,
    };
    serve({ 'GET /api/me/plan-maps': { json: list } });
    const screen = await render(<PlanMapsSection hasGoal={false} />);
    expect(await screen.findByRole('button', { name: /^My road to Wits/ })).toBeTruthy();
    expect(screen.getByText(ta.naming.layout(t.templates['the-road'].name))).toBeTruthy();
    expect(screen.queryByText(t.templates['the-road'].name)).toBeNull();
  });

  it('with words allowed, a new map needs a name: an empty one is refused before any request', async () => {
    const calls = serve({
      'GET /api/me/plan-maps': { json: { maps: [], wordsAllowed: true, max: 10 } },
      'POST /api/me/plan-maps': { json: { map: { id: 'new-map' }, care: null } },
    });
    const screen = await render(<PlanMapsSection hasGoal />);
    await fireEvent.press(await screen.findByRole('button', { name: t.start }));
    expect(screen.getByText(ta.naming.hint)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: t.create }));
    expect(await screen.findByText(ta.naming.needed)).toBeTruthy();
    expect(calls.some((c) => c.key.startsWith('POST'))).toBe(false);
    await fireEvent.changeText(screen.getByLabelText(ta.naming.label), '  My road to Wits ');
    await fireEvent.press(screen.getByRole('button', { name: t.create }));
    await waitFor(() =>
      expect(useRouter().push).toHaveBeenCalledWith({
        pathname: '/plan-map',
        params: { id: 'new-map' },
      }),
    );
    expect(calls.filter((c) => c.key === 'POST /api/me/plan-maps').map((c) => c.body)).toEqual([
      { templateId: 'six-stops', linksGoal: true, title: 'My road to Wits' },
    ]);
  });

  it('without the consent wording, asks for no name and sends none', async () => {
    serve({ 'GET /api/me/plan-maps': { json: { maps: [], wordsAllowed: false, max: 10 } } });
    const screen = await render(<PlanMapsSection hasGoal={false} />);
    await fireEvent.press(await screen.findByRole('button', { name: t.start }));
    expect(screen.queryByLabelText(ta.naming.label)).toBeNull();
  });

  it('when the name needs care, shows the crisis card here and leaves the new map in the list', async () => {
    let made = false;
    const calls = serve({
      'GET /api/me/plan-maps': () => ({
        json: {
          maps: made
            ? [
                {
                  id: 'new-map',
                  templateId: 'six-stops',
                  title: 'Synthetic',
                  counts: { planned: 6, achieved: 0, notAchieved: 0 },
                  updatedAt: '2026-10-13T08:00:00.000Z',
                },
              ]
            : [],
          wordsAllowed: true,
          max: 10,
        },
      }),
      'POST /api/me/plan-maps': () => {
        made = true;
        return {
          json: {
            map: { id: 'new-map' },
            care: { level: 'crisis', card: { kind: 'crisis-card', helplines: [], cover: 'none' } },
          },
        };
      },
    });
    const screen = await render(<PlanMapsSection hasGoal={false} />);
    await fireEvent.press(await screen.findByRole('button', { name: t.start }));
    await fireEvent.changeText(screen.getByLabelText(ta.naming.label), 'Synthetic');
    await fireEvent.press(screen.getByRole('button', { name: t.create }));
    expect(await screen.findByTestId('crisis-card')).toBeTruthy();
    expect(screen.getByText(t.care.crisisLead)).toBeTruthy();
    expect(useRouter().push).not.toHaveBeenCalled();
    expect(await screen.findByRole('button', { name: /^Synthetic/ })).toBeTruthy();
    expect(calls.filter((c) => c.key === 'GET /api/me/plan-maps')).toHaveLength(2);
  });
});

describe('a map’s own name (RT-06)', () => {
  it('is the title, with the template as a small label, and is renamed with one PATCH', async () => {
    const map = mapOf(true, 'six-stops', 'My climb');
    const calls = serve({
      [`GET /api/me/plan-maps/${MAP_ID}`]: { json: { map } },
      [`PATCH /api/me/plan-maps/${MAP_ID}`]: (call) => ({
        json: { map: { ...map, ...(call.body as object) }, care: null },
      }),
    });
    const screen = await render(<PlanMapScreen />);
    expect(await screen.findByRole('header', { name: 'My climb' })).toBeTruthy();
    expect(screen.getByText(ta.naming.layout(t.templates['six-stops'].name))).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: ta.naming.renameFor('My climb') }));
    const field = screen.getByLabelText(ta.naming.label);
    expect(field.props.value).toBe('My climb');
    await fireEvent.changeText(field, '   ');
    await fireEvent.press(screen.getByRole('button', { name: ta.naming.saveName }));
    expect(await screen.findByText(ta.naming.needed)).toBeTruthy();
    expect(calls.some((c) => c.key.startsWith('PATCH'))).toBe(false);
    await fireEvent.changeText(screen.getByLabelText(ta.naming.label), 'My road to Wits');
    await fireEvent.press(screen.getByRole('button', { name: ta.naming.saveName }));
    expect(await screen.findByRole('header', { name: 'My road to Wits' })).toBeTruthy();
    expect(calls.filter((c) => c.key.startsWith('PATCH')).map((c) => c.body)).toEqual([
      { title: 'My road to Wits' },
    ]);
    expect(screen.getByText(ta.naming.renamed)).toBeTruthy();
    expect(screen.queryByLabelText(ta.naming.label)).toBeNull();
  });

  it('a map without a name shows its template’s name and asks for one', async () => {
    serve({ [`GET /api/me/plan-maps/${MAP_ID}`]: { json: { map: mapOf(true) } } });
    const screen = await render(<PlanMapScreen />);
    expect(await screen.findByRole('header', { name: t.templates['six-stops'].name })).toBeTruthy();
    expect(screen.getByText(ta.naming.unnamed)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: ta.naming.nameThis }));
    expect(screen.getByLabelText(ta.naming.label).props.value).toBe('');
  });

  it('without the consent wording, the template names the map and nothing renames it', async () => {
    serve({ [`GET /api/me/plan-maps/${MAP_ID}`]: { json: { map: mapOf(false) } } });
    const screen = await render(<PlanMapScreen />);
    expect(await screen.findByRole('header', { name: t.templates['six-stops'].name })).toBeTruthy();
    expect(screen.queryByText(ta.naming.unnamed)).toBeNull();
    expect(screen.queryByRole('button', { name: ta.naming.nameThis })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Rename map/ })).toBeNull();
  });

  it('shows the crisis card when the new name needs care', async () => {
    const map = mapOf(true, 'six-stops', 'My climb');
    serve({
      [`GET /api/me/plan-maps/${MAP_ID}`]: { json: { map } },
      [`PATCH /api/me/plan-maps/${MAP_ID}`]: {
        json: {
          map: { ...map, title: 'Synthetic' },
          care: { level: 'crisis', card: { kind: 'crisis-card', helplines: [], cover: 'none' } },
        },
      },
    });
    const screen = await render(<PlanMapScreen />);
    await fireEvent.press(
      await screen.findByRole('button', { name: ta.naming.renameFor('My climb') }),
    );
    await fireEvent.changeText(screen.getByLabelText(ta.naming.label), 'Synthetic');
    await fireEvent.press(screen.getByRole('button', { name: ta.naming.saveName }));
    expect(await screen.findByTestId('crisis-card')).toBeTruthy();
    expect(screen.getByText(t.care.crisisLead)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: t.care.seen }));
    expect(screen.queryByTestId('crisis-card')).toBeNull();
  });
});

describe('one map, as an outline', () => {
  it('names each part with its status in words, in order', async () => {
    serve({ [`GET /api/me/plan-maps/${MAP_ID}`]: { json: { map: mapOf() } } });
    const screen = await render(<PlanMapScreen />);
    expect(await screen.findByRole('header', { name: t.templates['six-stops'].name })).toBeTruthy();
    const parts = screen.getAllByTestId(/^plan-node-/);
    expect(parts.map((p) => p.props.accessibilityLabel)).toEqual([
      `Grade 10, ${t.status.achieved}`,
      `Grade 11, ${t.status.planned}`,
      `Matric, ${t.status.planned}`,
      `Applying, ${t.status.planned}`,
      `First year, ${t.status.planned}`,
      `Finishing my qualification, ${t.status.planned}`,
    ]);
  });

  it('edits in place: Not achieved opens the two reflections, and Save is one PUT', async () => {
    const map = mapOf();
    const part = grade11(map);
    const calls = serve({
      [`GET /api/me/plan-maps/${MAP_ID}`]: { json: { map } },
      [`PUT /api/me/plan-maps/${MAP_ID}/nodes/${part?.id}`]: (call) => ({
        json: { node: { ...part, ...(call.body as object) }, care: null },
      }),
    });
    const screen = await render(<PlanMapScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: t.editing('Grade 11') }));
    expect(screen.queryByLabelText(t.whyNot)).toBeNull();
    await fireEvent.press(screen.getByRole('radio', { name: t.status['not-achieved'] }));
    await fireEvent.changeText(screen.getByLabelText(t.whyNot), 'Ran out of time');
    await fireEvent.press(screen.getByRole('button', { name: t.save }));
    await waitFor(() => expect(calls.filter((c) => c.key.startsWith('PUT '))).toHaveLength(1));
    expect(calls.find((c) => c.key.startsWith('PUT '))?.body).toMatchObject({
      status: 'not-achieved',
      whyNot: 'Ran out of time',
    });
    expect(await screen.findByText(`${t.whyNotShown}: Ran out of time`)).toBeTruthy();
  });

  it('ticks only without the consent wording, and says why', async () => {
    serve({ [`GET /api/me/plan-maps/${MAP_ID}`]: { json: { map: mapOf(false) } } });
    const screen = await render(<PlanMapScreen />);
    expect(await screen.findByText(t.wordsWait)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: t.editing('Grade 11') }));
    await fireEvent.press(screen.getByRole('radio', { name: t.status['not-achieved'] }));
    expect(screen.queryByLabelText(t.whyNot)).toBeNull();
    expect(screen.queryByLabelText(t.myWords)).toBeNull();
  });

  it('shows the crisis card when the words need care, and says it', async () => {
    const map = mapOf();
    const part = grade11(map);
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    serve({
      [`GET /api/me/plan-maps/${MAP_ID}`]: { json: { map } },
      [`PUT /api/me/plan-maps/${MAP_ID}/nodes/${part?.id}`]: {
        json: {
          node: { ...part, status: 'not-achieved', whyNot: 'Synthetic' },
          care: { level: 'crisis', card: { kind: 'crisis-card', helplines: [], cover: 'none' } },
        },
      },
    });
    const screen = await render(<PlanMapScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: t.editing('Grade 11') }));
    await fireEvent.press(screen.getByRole('radio', { name: t.status['not-achieved'] }));
    await fireEvent.changeText(screen.getByLabelText(t.whyNot), 'Synthetic');
    await fireEvent.press(screen.getByRole('button', { name: t.save }));
    expect(await screen.findByTestId('crisis-card')).toBeTruthy();
    expect(screen.getByText(t.care.crisisLead)).toBeTruthy();
    await waitFor(() => expect(announce).toHaveBeenCalledWith(t.care.crisisLead));
    await fireEvent.press(screen.getByRole('button', { name: t.care.seen }));
    expect(screen.queryByTestId('crisis-card')).toBeNull();
  });

  it('moves a part up with one POST, and asks before deleting', async () => {
    const map = mapOf();
    const part = grade11(map);
    const calls = serve({
      [`GET /api/me/plan-maps/${MAP_ID}`]: { json: { map } },
      [`POST /api/me/plan-maps/${MAP_ID}/nodes/${part?.id}/move`]: { json: { map } },
      [`DELETE /api/me/plan-maps/${MAP_ID}/nodes/${part?.id}`]: { json: { ok: true } },
    });
    const screen = await render(<PlanMapScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: t.moreFor('Grade 11') }));
    await fireEvent.press(screen.getByRole('button', { name: t.moveUp }));
    await waitFor(() => expect(calls.some((c) => c.key.endsWith('/move'))).toBe(true));
    expect(calls.find((c) => c.key.endsWith('/move'))?.body).toEqual({
      parentId: map.nodes[0]?.id,
      position: 0,
    });
    await fireEvent.press(screen.getByRole('button', { name: t.moreFor('Grade 11') }));
    await fireEvent.press(screen.getByRole('button', { name: t.delete }));
    expect(screen.getByText(t.deleteAsk('Grade 11', 0))).toBeTruthy();
    expect(calls.some((c) => c.key.startsWith('DELETE'))).toBe(false);
    await fireEvent.press(screen.getAllByRole('button', { name: t.delete }).at(-1) as never);
    await waitFor(() => expect(calls.some((c) => c.key.startsWith('DELETE'))).toBe(true));
  });
});
