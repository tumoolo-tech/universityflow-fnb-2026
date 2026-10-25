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
const MAP_ID = '00000000-0000-4000-9000-000000000001';

function mapOf(
  wordsAllowed = true,
  templateId: 'six-stops' | 'the-road' = 'six-stops',
): PlanMapView {
  const seed = templateSeed(templateId);
  const id = (ref: string) =>
    `00000000-0000-4000-8000-${String(seed.findIndex((s) => s.ref === ref)).padStart(12, '0')}`;
  return {
    id: MAP_ID,
    templateId,
    title: null,
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
