// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import {
  type CampusTourArtifact,
  campusSafetyLines,
  campusTour,
  crisisCard,
} from '@universityflow/agent';
import { campusTestView } from '@universityflow/agent/testing';
import { appleWalkingLink, streetViewLink, walkingLink } from '@universityflow/catalogue/client';
import { en } from '@universityflow/content';
import { type CampusPlaceView, speechPath } from '@universityflow/ui';
import axe from 'axe-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CampusTour } from '../components/campus';
import { CrisisCard } from '../components/crisis-card';
import { ReadAloudProvider } from '../components/read-aloud';
import { voiceSpeech } from '../lib/client/speech';

/**
 * Walk there, See it, the step-free route and Read aloud on the web's campus tour (planning.md
 * §11, Phase 5e-1 and 5e-4). Synthetic records (hard rule 4): made-up places and coordinates.
 */

const t = en.campus;
const AT = { query: 'Test Building', coordinates: { lat: -26.19, lng: 28.03 } };
const DOOR = { coordinates: { lat: -26.1901, lng: 28.0302 } };

/** The test tour, with its security place given coordinates, a step-free entrance and a note. */
function tour(change: (p: CampusPlaceView) => CampusPlaceView = accessible): CampusTourArtifact {
  const base = campusTour(campusTestView(true), 'wits', 'accepted-offer');
  if (!base) throw new Error('fixture');
  return {
    ...base,
    campuses: base.campuses.map((c) => ({
      ...c,
      needs: c.needs.map((n) => ({
        ...n,
        places: n.places.map((p) => (p.id === 'wits-test-security' ? change(p) : p)),
      })),
    })),
  };
}

function accessible(p: CampusPlaceView): CampusPlaceView {
  return {
    ...p,
    walkUrl: walkingLink(AT),
    appleWalkUrl: appleWalkingLink(AT),
    streetViewUrl: streetViewLink(AT),
    accessibleWalkUrl: walkingLink(DOOR),
    accessibleAppleWalkUrl: appleWalkingLink(DOOR),
    accessibleEntrance: 'East door, by the ramp',
    arrivalNote: 'The ramp is to the left of the main doors.',
  };
}

const SECURITY = 'Test security security';
const card = () => within(screen.getByTestId('place-wits-test-security'));
const named = (label: string) => new RegExp(`^${t.forPlace(label, SECURITY)}`);

/**
 * The browser's own speech engine, which Read aloud must never use any more (owner's choice of
 * 2026-10-22: ElevenLabs only). Stubbed so a test can prove it stays silent.
 */
function stubSpeechSynthesis() {
  const synth = { speak: vi.fn(), cancel: vi.fn() };
  vi.stubGlobal('speechSynthesis', synth);
  vi.stubGlobal('SpeechSynthesisUtterance', class {});
  return synth;
}

/** The browser's audio player, as far as Read aloud uses it: what it was asked to play. */
function stubAudio({ refuse = false } = {}) {
  const players: FakeAudio[] = [];
  class FakeAudio extends EventTarget {
    paused = true;
    play = vi.fn(async () => {
      if (refuse) throw new DOMException('Not allowed', 'NotAllowedError');
      this.paused = false;
    });
    pause = vi.fn(() => {
      this.paused = true;
    });
    removeAttribute = vi.fn();
    constructor(readonly src: string) {
      super();
      players.push(this);
    }
    end() {
      this.paused = true;
      this.dispatchEvent(new Event('ended'));
    }
    fail() {
      this.dispatchEvent(new Event('error'));
    }
  }
  vi.stubGlobal('Audio', FakeAudio);
  return players;
}

/** The test tour, with Read aloud offered (the server has an ElevenLabs voice) or not. */
function renderTour(artifact = tour(), available = true) {
  return render(
    <ReadAloudProvider available={available}>
      <CampusTour artifact={artifact} />
    </ReadAloudProvider>,
  );
}

let fetch: ReturnType<typeof vi.fn>;
beforeEach(() => {
  // Nothing on this card talks to our server: no tap, no destination, no position (5e-1).
  fetch = vi.fn();
  vi.stubGlobal('fetch', fetch);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Walk there and See it on a campus place (5e-1)', () => {
  it('opens Google walking directions and Street View in a new tab, each named for the place', () => {
    render(<CampusTour artifact={tour()} />);
    const walk = card().getByRole('link', { name: named(t.walkThere) });
    expect(walk.getAttribute('href')).toBe(walkingLink(AT));
    expect(walk.getAttribute('target')).toBe('_blank');
    expect(walk.getAttribute('rel')).toContain('noreferrer');
    expect(walk.textContent).toBe(t.walkThere);
    const see = card().getByRole('link', { name: named(t.seeIt) });
    expect(see.getAttribute('href')).toBe(streetViewLink(AT));
    expect(see.getAttribute('target')).toBe('_blank');
    expect(see.getAttribute('rel')).toContain('noreferrer');
    // The hint says only the destination leaves the page.
    expect(walk.getAttribute('aria-describedby')).toBeTruthy();
    const hint = document.getElementById(walk.getAttribute('aria-describedby') ?? '');
    expect(hint?.textContent).toBe(t.walkHint);
  });

  it('offers the step-free route and shows the entrance and the arrival note when published', () => {
    render(<CampusTour artifact={tour()} />);
    const stepFree = card().getByRole('link', { name: named(t.stepFree) });
    expect(stepFree.getAttribute('href')).toBe(walkingLink(DOOR));
    expect(stepFree.getAttribute('rel')).toContain('noreferrer');
    expect(card().getByText(`${t.accessibleEntrance}: East door, by the ramp`)).toBeTruthy();
    expect(
      card().getByText(`${t.arrival}: The ramp is to the left of the main doors.`),
    ).toBeTruthy();
  });

  it('no Street View without coordinates, no step-free route without an entrance', () => {
    render(
      <CampusTour
        artifact={tour((p) => ({
          ...accessible(p),
          streetViewUrl: null,
          accessibleWalkUrl: null,
          accessibleAppleWalkUrl: null,
          accessibleEntrance: null,
          arrivalNote: null,
        }))}
      />,
    );
    expect(card().getByRole('link', { name: named(t.walkThere) })).toBeTruthy();
    expect(card().queryByRole('link', { name: named(t.seeIt) })).toBeNull();
    expect(card().queryByRole('link', { name: named(t.stepFree) })).toBeNull();
    expect(card().queryByText(new RegExp(`^${t.arrival}:`))).toBeNull();
  });

  it('a card saved before Walk there keeps "Open in maps" and shows no walking link', () => {
    render(
      <CampusTour
        artifact={tour(({ walkUrl: _w, appleWalkUrl: _a, streetViewUrl: _s, ...old }) => old)}
      />,
    );
    expect(card().queryByRole('link', { name: named(t.walkThere) })).toBeNull();
    expect(card().getByRole('link', { name: new RegExp(t.openInMaps) })).toBeTruthy();
  });

  it('meets the 44px target and passes axe', async () => {
    stubAudio();
    const { container } = renderTour();
    for (const label of [t.walkThere, t.seeIt, t.stepFree]) {
      expect(card().getByRole('link', { name: named(label) }).className).toContain('min-h-11');
    }
    expect(card().getByRole('button', { name: named(t.readAloud) }).className).toContain(
      'min-h-11',
    );
    // jsdom can't compute colours: contrast is checked by the E2E axe run on the real page.
    const results = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
    expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });
});

describe('getting around with a disability (5e-4)', () => {
  it('says the app never replaces a cane, a guide dog or mobility training, and points to the unit', () => {
    render(<CampusTour artifact={tour()} />);
    expect(screen.getByRole('heading', { name: t.mobility.title })).toBeTruthy();
    expect(screen.getByText(t.mobility.statement)).toBeTruthy();
    // The test campus lists no disability unit: the general pointer.
    expect(screen.getByText(t.mobility.askUnitUnchecked)).toBeTruthy();
  });

  it('names the disability unit when the tour lists one', () => {
    const base = tour();
    const unit: CampusPlaceView = {
      ...base.campuses[0]!.needs[0]!.places[0]!,
      id: 'wits-test-disability-unit',
      kind: 'disability-unit',
      name: 'Test Disability Unit',
    };
    const withUnit = {
      ...base,
      campuses: base.campuses.map((c, i) =>
        i === 0 ? { ...c, needs: [...c.needs, { need: 'support' as const, places: [unit] }] } : c,
      ),
    };
    render(<CampusTour artifact={withUnit} />);
    expect(screen.getByText(t.mobility.askUnit('Test Disability Unit'))).toBeTruthy();
  });
});

/**
 * Read aloud on the web (owner's choice of 2026-10-22): the ElevenLabs voice only. These replace
 * the 5e-4 tests of the browser's own voice (`speechSynthesis`), which is removed: the button is
 * now hidden when the server has no ElevenLabs voice (it was hidden when the browser had no
 * speech), and the player asks our server for the place by its id (it used to speak on the device).
 */
describe('Read aloud in the ElevenLabs voice (2026-10-22)', () => {
  it('is hidden without the voice, and the browser’s own voice is never used instead', async () => {
    const synth = stubSpeechSynthesis();
    const players = stubAudio();
    renderTour(tour(), false);
    expect(screen.queryByRole('button', { name: new RegExp(`^${t.readAloud}`) })).toBeNull();
    // Outside a page that says (a test, a stray render): hidden too.
    cleanup();
    render(<CampusTour artifact={tour()} />);
    expect(screen.queryByRole('button', { name: new RegExp(`^${t.readAloud}`) })).toBeNull();
    expect(synth.speak).not.toHaveBeenCalled();
    expect(players).toEqual([]);
  });

  it('plays the place’s audio from our server, by its id only, when asked, and stops', async () => {
    const synth = stubSpeechSynthesis();
    const players = stubAudio();
    renderTour();
    // Nothing plays by itself.
    expect(players).toEqual([]);
    fireEvent.click(card().getByRole('button', { name: named(t.readAloud) }));
    expect(players).toHaveLength(1);
    const player = players[0];
    if (!player) throw new Error('expected a player');
    expect(player.src).toBe(speechPath('wits-test-security'));
    // Only the id leaves the page: none of the words, nothing about the learner.
    expect(player.src).not.toMatch(/ramp|Test Building|\?/i);
    await waitFor(() => expect(player.play).toHaveBeenCalledTimes(1));
    fireEvent.click(card().getByRole('button', { name: named(t.stopReading) }));
    expect(player.pause).toHaveBeenCalled();
    expect(card().getByRole('button', { name: named(t.readAloud) })).toBeTruthy();
    expect(synth.speak).not.toHaveBeenCalled();
    // The audio element fetches its own source; nothing else talks to our server.
    expect(fetch).not.toHaveBeenCalled();
  });

  it('turns back into Read aloud when the audio ends', async () => {
    const players = stubAudio();
    renderTour();
    fireEvent.click(card().getByRole('button', { name: named(t.readAloud) }));
    await waitFor(() => expect(players[0]?.play).toHaveBeenCalled());
    act(() => players[0]?.end());
    expect(card().getByRole('button', { name: named(t.readAloud) })).toBeTruthy();
    expect(card().queryByText(t.readAloudFailed)).toBeNull();
  });

  it('says so, plainly, when the audio can’t play', async () => {
    const players = stubAudio();
    renderTour();
    fireEvent.click(card().getByRole('button', { name: named(t.readAloud) }));
    act(() => players[0]?.fail());
    expect(card().getByRole('button', { name: named(t.readAloud) })).toBeTruthy();
    expect(card().getByRole('status').textContent).toBe(t.readAloudFailed);
    // Trying again clears it.
    fireEvent.click(card().getByRole('button', { name: named(t.readAloud) }));
    expect(card().getByRole('status').textContent).toBe('');
  });

  it('the voice version replaces what it is saying, and calls back once: done, stopped or failed', async () => {
    const players = stubAudio();
    const speech = voiceSpeech();
    expect(speech.version).toBe('voice');
    const first = vi.fn();
    speech.speak({ placeId: 'wits-test-one', text: 'One' }, first);
    speech.speak({ placeId: 'wits-test-two', text: 'Two' });
    expect(first).toHaveBeenCalledWith('done');
    expect(players[0]?.pause).toHaveBeenCalled();
    // The replaced player's late "ended" doesn't end the new one.
    const second = vi.fn();
    speech.speak({ placeId: 'wits-test-three', text: 'Three' }, second);
    players[1]?.end();
    expect(second).not.toHaveBeenCalled();
    speech.stop();
    speech.stop();
    expect(second).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledWith('done');

    // A browser that refuses to play (autoplay rules, no audio device) is a failure, said once.
    const refusing = stubAudio({ refuse: true });
    const failed = vi.fn();
    voiceSpeech().speak({ placeId: 'wits-test-four', text: 'Four' }, failed);
    await waitFor(() => expect(failed).toHaveBeenCalledWith('failed'));
    refusing[0]?.fail();
    expect(failed).toHaveBeenCalledTimes(1);
  });
});

describe('the crisis card’s campus lines (5e-1)', () => {
  it('each line with a location gets Walk there, in a new tab', () => {
    const card = crisisCard(
      campusTestView(true).helplines,
      ['suicide'],
      campusSafetyLines(campusTestView(true), 'wits'),
    );
    render(<CrisisCard artifact={card} />);
    const campus = within(screen.getByTestId('crisis-campus'));
    const walks = campus.getAllByRole('link', { name: new RegExp(`^${t.walkThere}`) });
    expect(walks).toHaveLength(3);
    for (const walk of walks) {
      expect(walk.getAttribute('href')).toMatch(/travelmode=walking/);
      expect(walk.getAttribute('target')).toBe('_blank');
      expect(walk.getAttribute('rel')).toContain('noreferrer');
    }
    expect(
      campus.getByRole('link', { name: new RegExp(`^${t.forPlace(t.walkThere, SECURITY)}`) }),
    ).toBeTruthy();
  });
});
