// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { OFFER_KINDS, type SubjectMark } from '@universityflow/admissions';
import { type AgentOffer, type OfferCardArtifact, offerCard } from '@universityflow/agent';
import { catalogueView } from '@universityflow/catalogue';
import { en } from '@universityflow/content';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OffersView } from '../app/(app)/offers/offers-view';
import { ArtifactView } from '../components/artifacts';
import { OfferCard } from '../components/offers';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/**
 * The letter form is on screen and its heading has focus (A3-13). Focus moves in an effect after
 * the render, so waiting for the heading alone races it: on a loaded machine the late move took
 * focus back from the field the next step had just focused.
 */
async function letterFormFocused(): Promise<HTMLElement> {
  const title = await screen.findByRole('heading', { name: en.offers.letterTitle });
  await waitFor(() => expect(document.activeElement).toBe(title));
  return title;
}

const TODAY = new Date('2026-10-13T08:00:00Z');
const VIEW = catalogueView(TODAY, { includeDrafts: true });

/** Synthetic (hard rule 4). */
const OFFER: AgentOffer = {
  id: '00000000-0000-4000-8000-000000000001',
  universityId: 'uj',
  programmeId: 'uj-beng-civil',
  kind: 'provisional',
  status: 'held',
  source: 'letter',
  replyBy: '2026-10-20',
  conditions: ['Synthetic condition, as quoted.'],
  reminder: { status: 'scheduled', desiredAt: new Date('2026-10-17T16:00:00Z') },
};

const card = (overrides: Partial<AgentOffer> = {}): OfferCardArtifact =>
  offerCard(VIEW, { ...OFFER, ...overrides }, null, TODAY);

/** Words that would tell a learner a non-final offer is a place (planning.md §8.5). */
const SAYS_A_PLACE = /you[’']re in\b|you got in|place is yours|final offer|you have a place/i;

describe('the offer card never calls a non-final offer a place (§8.5)', () => {
  it.each(
    OFFER_KINDS.flatMap((kind) =>
      (['held', 'accepted', 'declined'] as const).map((status) => [kind, status] as const),
    ),
  )('%s, %s', (kind, status) => {
    const { container } = render(<OfferCard artifact={card({ kind, status })} />);
    const text = container.textContent ?? '';
    expect(text).toContain(en.offers.kinds[kind]);
    expect(text).toContain(en.offers.explain[kind]);
    expect(text).toContain(en.offers.statuses[status]);
    if (kind === 'final') {
      expect(text).toMatch(/final offer/i);
    } else {
      expect(text).not.toMatch(SAYS_A_PLACE);
      // Accepting a provisional offer doesn't make it final: the card still says what it is.
      expect(text).toMatch(/not a place yet|isn’t an offer of a place yet/);
    }
  });
});

describe('OfferCard', () => {
  it('shows the conditions as quoted, the countdown and the waiting reminder', () => {
    render(<OfferCard artifact={card()} />);
    expect(
      screen.getByRole('heading', { name: 'Bachelor of Engineering in Civil Engineering' }),
    ).toBeTruthy();
    const quote = screen.getByText('Synthetic condition, as quoted.').closest('blockquote');
    // The same quoted treatment as the app: a left rule at the `border.rule` token (A2-16).
    expect(quote?.className.split(/\s+/)).toEqual(
      expect.arrayContaining(['border-l-rule', 'border-line-strong']),
    );
    expect(screen.getByText(en.offers.daysLeft(7))).toBeTruthy();
    expect(screen.getByText(/^We’ll remind you on/)).toBeTruthy();
    expect(screen.getByText(en.common.draftBadge)).toBeTruthy();
    expect(screen.getByText(en.offers.finalWaiting, { exact: false })).toBeTruthy();
  });

  it('says how to get a reminder when none can be sent, and when the date has passed', () => {
    render(<OfferCard artifact={card({ reminder: null })} remindersOn={false} />);
    expect(screen.getByText(en.offers.reminderOff, { exact: false })).toBeTruthy();
    cleanup();
    render(<OfferCard artifact={card({ replyBy: '2026-10-01', reminder: null })} />);
    expect(screen.getByText(en.offers.replyByPassed)).toBeTruthy();
  });

  it('after final results: not met, with Plan B; a final offer is never re-checked', () => {
    const marks = (
      [
        'english-hl',
        'mathematics',
        'physical-sciences',
        'life-sciences',
        'geography',
        'afrikaans-fal',
        'life-orientation',
      ] as const
    ).map((subject): SubjectMark => ({ subject, percent: 52 }));
    const finals = { confirmedAt: TODAY, marks };
    render(<OfferCard artifact={offerCard(VIEW, OFFER, finals, TODAY)} />);
    expect(screen.getByText(en.offers.finalNotMet)).toBeTruthy();
    expect(screen.getByText(en.offers.planBTitle)).toBeTruthy();
    cleanup();
    render(<OfferCard artifact={offerCard(VIEW, { ...OFFER, kind: 'final' }, finals, TODAY)} />);
    expect(screen.queryByText(en.offers.finalTitle)).toBeNull();
  });

  it('no badge sits on a background of its own colour (A2-13)', () => {
    const { container } = render(<OfferCard artifact={card()} />);
    const badges = [...container.querySelectorAll('span.rounded-full')];
    expect(badges.length).toBeGreaterThanOrEqual(3);
    for (const badge of badges) {
      const own = badge.className.match(/\bbg-(surface|sunk)\b/)?.[0];
      const under = badge.parentElement?.closest('.bg-surface, .bg-sunk');
      const theirs = under?.className.match(/\bbg-(surface|sunk)\b/)?.[0];
      if (own) expect(own).not.toBe(theirs);
    }
    expect(screen.getByText(en.offers.sources.letter).className).toContain('bg-sunk');
  });

  it('renders in the chat by kind, with a link to the page', () => {
    render(<ArtifactView artifact={card()} />);
    expect(
      screen.getByRole('link', { name: `${en.chat.artifactOpen}: ${en.offers.title}` }),
    ).toBeTruthy();
  });
});

describe('OffersView', () => {
  const data = (offers: OfferCardArtifact[]) => ({
    offers,
    options: [{ id: 'uj-beng-civil', name: 'BEng Civil', universityName: 'UJ' }],
    remindersOn: true,
  });

  it('saves "I got an offer" only once the course and kind are chosen', async () => {
    const fetch = vi.fn(async () => Response.json(data([card()]), { status: 201 }));
    vi.stubGlobal('fetch', fetch);
    render(<OffersView initial={data([])} direct={false} />);
    expect(screen.getByText(en.offers.empty)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: en.offers.save }));
    expect(fetch).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText(en.offers.course), {
      target: { value: 'uj-beng-civil' },
    });
    fireEvent.change(screen.getByLabelText(en.offers.kind), { target: { value: 'provisional' } });
    fireEvent.change(screen.getByLabelText(en.offers.replyByLabel), {
      target: { value: '2026-10-20' },
    });
    fireEvent.click(screen.getByRole('button', { name: en.offers.save }));
    await waitFor(() => expect(screen.getByText(en.offers.added)).toBeTruthy());
    const [, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({
      programmeId: 'uj-beng-civil',
      kind: 'provisional',
      replyBy: '2026-10-20',
      conditions: [],
    });
  });

  describe('keeps keyboard focus through every step (A3-11, A3-13, A3-17, A3-18)', () => {
    /** A fetch that answers only when the test says so, to look at the page mid-request. */
    function held(answer: (url: string, init?: RequestInit) => unknown) {
      const waiting: Array<() => void> = [];
      const fetch = vi.fn(
        (url: string, init?: RequestInit) =>
          new Promise<Response>((resolve) => {
            waiting.push(() => resolve(Response.json(answer(url, init))));
          }),
      );
      vi.stubGlobal('fetch', fetch);
      return {
        fetch,
        release: async () => {
          while (waiting.length > 0) {
            waiting.shift()?.();
            await new Promise((r) => setTimeout(r, 0));
          }
        },
      };
    }
    const NAME = 'Bachelor of Engineering in Civil Engineering';
    const heading = () => screen.getByRole('heading', { name: NAME });

    it('Accept: the button stays focusable while saving, then focus moves to that offer', async () => {
      const server = held(() => data([card({ status: 'accepted' })]));
      render(<OffersView initial={data([card()])} direct={false} />);
      const accept = screen.getByRole('button', { name: `${en.offers.accept}: ${NAME}` });
      accept.focus();
      fireEvent.click(accept);
      expect((accept as HTMLButtonElement).disabled).toBe(false);
      expect(document.activeElement).toBe(accept);
      await server.release();
      expect(await screen.findByText(en.offers.acceptedSaved)).toBeTruthy();
      // Accept is gone now: focus is on the offer it changed, never <body>.
      expect(screen.queryByRole('button', { name: `${en.offers.accept}: ${NAME}` })).toBeNull();
      expect(document.activeElement).toBe(heading());
    });

    it('Decline: focus moves to that offer', async () => {
      const server = held(() => data([card({ status: 'declined' })]));
      render(<OffersView initial={data([card()])} direct={false} />);
      const decline = screen.getByRole('button', { name: `${en.offers.decline}: ${NAME}` });
      decline.focus();
      fireEvent.click(decline);
      await server.release();
      expect(await screen.findByText(en.offers.declinedSaved)).toBeTruthy();
      expect(document.activeElement).toBe(heading());
    });

    it('Remove: the card is gone, so focus moves to the status, which says so', async () => {
      const server = held(() => data([]));
      render(<OffersView initial={data([card()])} direct={false} />);
      const status = screen.getByRole('status');
      fireEvent.click(screen.getByRole('button', { name: `${en.offers.remove}: ${NAME}` }));
      await server.release();
      expect(await screen.findByText(en.offers.removed)).toBeTruthy();
      expect(document.activeElement).toBe(status);
      expect(status.textContent).toBe(en.offers.removed);
    });

    it('Save with a field missing says which, ties it to the field and focuses it', async () => {
      const fetch = vi.fn();
      vi.stubGlobal('fetch', fetch);
      render(<OffersView initial={data([])} direct={false} />);
      fireEvent.click(screen.getByRole('button', { name: en.offers.save }));
      expect(fetch).not.toHaveBeenCalled();
      const course = screen.getByLabelText(en.offers.course);
      expect(course.getAttribute('aria-invalid')).toBe('true');
      expect(screen.getByText(en.offers.missingCourse)).toBeTruthy();
      expect(course.getAttribute('aria-describedby')).toContain(
        screen.getByText(en.offers.missingCourse).id,
      );
      expect(screen.getByText(en.offers.missingKind)).toBeTruthy();
      expect(document.activeElement).toBe(course);
      // With the course chosen, the kind is what's missing.
      fireEvent.change(course, { target: { value: 'uj-beng-civil' } });
      fireEvent.click(screen.getByRole('button', { name: en.offers.save }));
      expect(screen.queryByText(en.offers.missingCourse)).toBeNull();
      expect(document.activeElement).toBe(screen.getByLabelText(en.offers.kind));
    });

    it('Save: focus moves to the new offer, and the status region that was there says so', async () => {
      const server = held(() => data([card()]));
      render(<OffersView initial={data([])} direct={false} />);
      const status = screen.getByRole('status');
      fireEvent.change(screen.getByLabelText(en.offers.course), {
        target: { value: 'uj-beng-civil' },
      });
      fireEvent.change(screen.getByLabelText(en.offers.kind), { target: { value: 'provisional' } });
      fireEvent.click(screen.getByRole('button', { name: en.offers.save }));
      await server.release();
      await waitFor(() => expect(status.textContent).toBe(en.offers.added));
      expect(document.activeElement).toBe(heading());
    });

    it('a letter: the check form gets focus on its heading; confirming focuses the new offer', async () => {
      const documentId = '00000000-0000-4000-8000-000000000009';
      const letter = {
        documentId,
        letter: {
          universityAsPrinted: null,
          programmeAsPrinted: 'Synthetic programme',
          kind: 'provisional',
          replyBy: '2026-10-20',
          conditions: ['Synthetic condition one.', 'Synthetic condition two.'],
          warnings: [],
        },
        candidates: ['uj-beng-civil'],
        sample: true,
      };
      const server = held((url) => (url === '/api/documents' ? letter : data([card()])));
      const { container } = render(<OffersView initial={data([])} direct={false} />);
      const status = screen.getByRole('status');
      const input = container.querySelector('input[type="file"]') as HTMLInputElement;
      input.focus();
      fireEvent.change(input, {
        target: { files: [new File(['%PDF-1.7'], 'letter.pdf', { type: 'application/pdf' })] },
      });
      // Reading: the file input isn't disabled (that drops focus to <body>).
      expect(input.disabled).toBe(false);
      await server.release();
      await letterFormFocused();

      // Removing a condition keeps focus in the list (A3-17).
      fireEvent.click(screen.getByRole('button', { name: en.offers.removeCondition(1) }));
      expect(document.activeElement).toBe(screen.getByLabelText(en.offers.condition(1)));
      fireEvent.click(screen.getByRole('button', { name: en.offers.removeCondition(1) }));
      expect(document.activeElement).toBe(
        screen.getByRole('button', { name: en.offers.addCondition }),
      );

      // The learner picks the course (A1-29): nothing is chosen for them.
      fireEvent.change(screen.getByLabelText(en.offers.whichCourse), {
        target: { value: 'uj-beng-civil' },
      });
      fireEvent.click(screen.getByRole('button', { name: en.offers.confirm }));
      await server.release();
      await waitFor(() => expect(status.textContent).toBe(en.offers.added));
      // The same status region, mounted before the click, carries the outcome.
      expect(screen.getByRole('status')).toBe(status);
      expect(document.activeElement).toBe(heading());
    });

    it('a letter: the matched courses are listed first, but none is chosen until the learner picks (A1-29)', async () => {
      const letter = {
        documentId: '00000000-0000-4000-8000-000000000009',
        letter: {
          universityAsPrinted: null,
          programmeAsPrinted: 'Synthetic programme',
          kind: 'provisional',
          replyBy: null,
          conditions: [],
          warnings: [],
        },
        candidates: ['uj-beng-civil'],
        sample: true,
      };
      const fetchMock = vi.fn(async (_url: string) => Response.json(letter));
      vi.stubGlobal('fetch', fetchMock);
      const { container } = render(<OffersView initial={data([])} direct={false} />);
      fireEvent.change(container.querySelector('input[type="file"]') as HTMLInputElement, {
        target: { files: [new File(['%PDF-1.7'], 'letter.pdf', { type: 'application/pdf' })] },
      });
      await letterFormFocused();
      const course = screen.getByLabelText(en.offers.whichCourse) as HTMLSelectElement;
      expect(course.value).toBe('');
      // The short list is there, first, as a group of its own.
      const group = course.querySelector('optgroup') as HTMLOptGroupElement;
      expect(group.label).toBe(en.offers.whichCourse);
      expect([...group.querySelectorAll('option')].map((o) => o.value)).toEqual(['uj-beng-civil']);
      // Confirming without choosing says so, and nothing is saved.
      fireEvent.click(screen.getByRole('button', { name: en.offers.confirm }));
      expect(screen.getByText(en.offers.missingCourse)).toBeTruthy();
      expect(document.activeElement).toBe(course);
      expect(fetchMock.mock.calls.filter(([url]) => url === '/api/offers')).toHaveLength(0);
    });

    it('Cancel on the letter form returns focus to the page heading', async () => {
      const letter = {
        documentId: '00000000-0000-4000-8000-000000000009',
        letter: {
          universityAsPrinted: null,
          programmeAsPrinted: null,
          kind: null,
          replyBy: null,
          conditions: [],
          warnings: [],
        },
        candidates: [],
        sample: true,
      };
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => Response.json(letter)),
      );
      const { container } = render(<OffersView initial={data([])} direct={false} />);
      fireEvent.change(container.querySelector('input[type="file"]') as HTMLInputElement, {
        target: { files: [new File(['%PDF-1.7'], 'letter.pdf', { type: 'application/pdf' })] },
      });
      await letterFormFocused();
      // Confirming with no kind says what's missing (A3-18).
      fireEvent.click(screen.getByRole('button', { name: en.offers.confirm }));
      expect(screen.getByText(en.offers.missingKind)).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: en.common.cancel }));
      expect(document.activeElement).toBe(screen.getByRole('heading', { name: en.offers.title }));
    });
  });

  it('says why a second offer can’t be accepted', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({ error: 'state', detail: 'another-accepted' }, { status: 409 }),
      ),
    );
    render(<OffersView initial={data([card({ status: 'held' })])} direct={false} />);
    fireEvent.click(
      screen.getByRole('button', {
        name: `${en.offers.accept}: Bachelor of Engineering in Civil Engineering`,
      }),
    );
    await waitFor(() =>
      expect(screen.getByText(en.offers.errors['another-accepted'])).toBeTruthy(),
    );
  });
});
