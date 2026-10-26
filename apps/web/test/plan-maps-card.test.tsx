// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { en } from '@universityflow/content';
import type { PlanMapsResponse } from '@universityflow/ui';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PlanMapsCard } from '../app/(app)/goals/plan-maps-card';
import { planCopy, templateChoices } from '../lib/server/plan-maps-copy';

/**
 * My plan maps on My goal (docs/design/plan-maps-proposal.md §4, §8.4, D10): the learner's maps,
 * an empty line inside the card, and "Start a new map" with the five templates as a radio group.
 * Its copy comes as props (the launch standard). Synthetic data only.
 */

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  push.mockReset();
});

const copy = planCopy();
const templates = templateChoices();
const t = en.planMaps;

const empty: PlanMapsResponse = { maps: [], wordsAllowed: true, max: 10 };
const one: PlanMapsResponse = {
  maps: [
    {
      id: '00000000-0000-4000-8000-000000000001',
      templateId: 'staircase',
      title: null,
      counts: { planned: 7, achieved: 4, notAchieved: 1 },
      updatedAt: '2026-10-13T08:00:00.000Z',
    },
  ],
  wordsAllowed: false,
  max: 10,
};

function card(initial: PlanMapsResponse, hasGoal = true) {
  return render(
    <PlanMapsCard initial={initial} copy={copy} templates={templates} hasGoal={hasGoal} />,
  );
}

describe('PlanMapsCard', () => {
  it('says there is no map yet, in a muted line inside the card', () => {
    card(empty);
    const section = screen.getByRole('region', { name: t.title });
    expect(within(section).getByText(t.empty).className).toMatch(/text-muted/);
    expect(within(section).getByText(t.lead)).toBeTruthy();
  });

  it('lists a map by its template’s name, with what is achieved and what is not', () => {
    card(one);
    const link = screen.getByRole('link', { name: new RegExp(t.templates.staircase.name) });
    expect(link.getAttribute('href')).toBe(`/goals/maps/${one.maps[0]?.id}`);
    expect(screen.getByText(t.counts(4, 1, 7))).toBeTruthy();
    // Writing waits for the consent wording: the lead says ticking works.
    expect(screen.getByText(t.leadTickOnly)).toBeTruthy();
  });

  it('offers the five templates as one radio group, with the goal in the middle when there is one', async () => {
    card(empty);
    fireEvent.click(screen.getByRole('button', { name: t.start }));
    const group = screen.getByRole('group', { name: t.chooseTemplate });
    const radios = within(group).getAllByRole('radio');
    expect(radios).toHaveLength(5);
    expect(radios.map((r) => r.getAttribute('value'))).toEqual([
      'six-stops',
      'thinking-cloud',
      'staircase',
      'life-map',
      'the-road',
    ]);
    await waitFor(() => expect(document.activeElement).toBe(radios[0]));
    expect((screen.getByLabelText(t.useGoal) as HTMLInputElement).checked).toBe(true);
  });

  it('starts a map with one POST and opens it, named by the learner while writing is on (RT-06)', async () => {
    const fetch = vi.fn(async () =>
      Response.json({ map: { id: '00000000-0000-4000-8000-000000000009' } }),
    );
    vi.stubGlobal('fetch', fetch);
    card(empty, false);
    fireEvent.click(screen.getByRole('button', { name: t.start }));
    fireEvent.click(screen.getByLabelText(new RegExp(t.templates['the-road'].name)));
    expect((screen.getByLabelText(t.useGoal) as HTMLInputElement).checked).toBe(false);
    // A name is needed: without one nothing is sent, the field says why and takes focus.
    fireEvent.click(screen.getByRole('button', { name: t.create }));
    expect(fetch).not.toHaveBeenCalled();
    expect(screen.getByText(t.naming.needed)).toBeTruthy();
    const name = screen.getByLabelText(t.naming.label) as HTMLInputElement;
    expect(document.activeElement).toBe(name);
    expect(name.getAttribute('aria-invalid')).toBe('true');
    fireEvent.change(name, { target: { value: ' My road to engineering ' } });
    fireEvent.click(screen.getByRole('button', { name: t.create }));
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith('/goals/maps/00000000-0000-4000-8000-000000000009?new=1'),
    );
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(
      '/api/me/plan-maps',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          templateId: 'the-road',
          linksGoal: false,
          title: 'My road to engineering',
        }),
      }),
    );
  });

  it('while writing waits for the consent wording, asks for no name and sends none', async () => {
    const fetch = vi.fn(async () =>
      Response.json({ map: { id: '00000000-0000-4000-8000-000000000009' } }),
    );
    vi.stubGlobal('fetch', fetch);
    card({ ...one, maps: [] }, false);
    fireEvent.click(screen.getByRole('button', { name: t.start }));
    expect(screen.queryByLabelText(t.naming.label)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: t.create }));
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(fetch).toHaveBeenCalledWith(
      '/api/me/plan-maps',
      expect.objectContaining({
        body: JSON.stringify({ templateId: 'six-stops', linksGoal: false }),
      }),
    );
  });

  it('at the limit, says so instead of offering another', () => {
    card({ ...one, max: 1 });
    expect(screen.queryByRole('button', { name: t.start })).toBeNull();
    expect(screen.getByText(t.full)).toBeTruthy();
  });
});

describe('where the card sits (D10)', () => {
  it('My goal shows it after "Change my goal" and before the exam countdown', () => {
    const view = readFileSync(
      join(__dirname, '..', 'app', '(app)', 'goals', 'goals-view.tsx'),
      'utf8',
    );
    const change = view.indexOf('t.change : t.setGoal');
    const plans = view.indexOf('{plans}');
    const countdown = view.indexOf('<ExamCountdown');
    expect(change).toBeGreaterThan(-1);
    expect(plans).toBeGreaterThan(change);
    expect(countdown).toBeGreaterThan(plans);
    const page = readFileSync(join(__dirname, '..', 'app', '(app)', 'goals', 'page.tsx'), 'utf8');
    expect(page).toMatch(/plans=\{\s*<PlanMapsCard/);
  });
});
