import { fireEvent, render, within } from '@testing-library/react-native';
import { en } from '@universityflow/content/app';
import type { OfferCardArtifact } from '@universityflow/ui';
import { useRouter } from 'expo-router';
import { AccessibilityInfo, StyleSheet } from 'react-native';
import OffersScreen from '../app/offers';
import { ArtifactCard } from '../components/artifact-card';
import { OfferCardView } from '../components/offer-card';
import { routeForNotification } from '../lib/push';
import { saveToken } from '../lib/session';
import { theme } from '../lib/theme';
import type { OffersResponse } from '../lib/types';
import { serve } from '../test-utils/fake-api';

/** Synthetic (hard rule 4). */
const offer = (overrides: Partial<OfferCardArtifact> = {}): OfferCardArtifact => ({
  kind: 'offer-card',
  id: '00000000-0000-4000-8000-000000000001',
  offerKind: 'provisional',
  status: 'held',
  source: 'learner',
  universityId: 'uj',
  universityName: 'UJ',
  programme: {
    id: 'uj-beng-civil',
    name: 'BEng Civil Engineering',
    faculty: 'Engineering and the Built Environment',
    sourceUrl: 'https://www.uj.ac.za/',
    academicYear: 2027,
    draft: true,
  },
  replyBy: '2026-10-30',
  daysLeft: 16,
  conditions: ['Synthetic condition, as quoted.'],
  reminderAt: '2026-10-27T16:00:00.000Z',
  checksFinal: true,
  finalCheck: null,
  ...overrides,
});

const OPTIONS = [
  { id: 'uj-beng-civil', name: 'BEng Civil Engineering', universityName: 'UJ' },
  { id: 'wits-bsc-eng', name: 'BSc Engineering', universityName: 'Wits' },
];

const data = (offers: OfferCardArtifact[]): OffersResponse => ({
  offers,
  options: OPTIONS,
  remindersOn: true,
});

/** Words that would tell a learner a non-final offer is a place (planning.md §8.5). */
const SAYS_A_PLACE = /you[’']re in\b|you got in|place is yours|final offer|you have a place/i;

/** Every piece of text the tree renders, joined. */
const textOf = (node: unknown): string => {
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(textOf).join(' ');
  const children = (node as { children?: unknown } | null)?.children;
  return children ? textOf(children) : '';
};

beforeEach(async () => {
  await saveToken('tok');
});

describe('the offer card never calls a non-final offer a place (§8.5)', () => {
  const kinds = ['provisional', 'conditional', 'final', 'waitlist'] as const;
  const statuses = ['held', 'accepted', 'declined'] as const;
  it.each(kinds.flatMap((k) => statuses.map((s) => [k, s] as const)))('%s, %s', async (k, s) => {
    const screen = await render(<OfferCardView offer={offer({ offerKind: k, status: s })} />);
    const text = textOf(screen.toJSON());
    expect(text).toContain(en.offers.kinds[k]);
    expect(text).toContain(en.offers.explain[k]);
    expect(text).toContain(en.offers.statuses[s]);
    if (k === 'final') expect(text).toMatch(/final offer/i);
    else expect(text).not.toMatch(SAYS_A_PLACE);
  });
});

describe('My offers', () => {
  it('shows each offer’s kind, conditions as quoted, countdown and reminder', async () => {
    serve({ 'GET /api/offers': { json: data([offer()]) } });
    const screen = await render(<OffersScreen />);
    const card = within(await screen.findByTestId(`offer-${offer().id}`));
    expect(card.getByTestId('offer-kind')).toHaveTextContent(en.offers.kinds.provisional);
    expect(card.getByText(en.offers.explain.provisional)).toBeTruthy();
    expect(card.getByText('Synthetic condition, as quoted.')).toBeTruthy();
    expect(card.getByText(en.offers.daysLeft(16))).toBeTruthy();
    expect(card.getByText(/^We’ll remind you on/)).toBeTruthy();
    expect(card.getByText(en.common.draftBadge)).toBeTruthy();
    expect(card.getByText(en.offers.finalWaiting)).toBeTruthy();
  });

  it('"I got an offer": choose the course and kind, check the date, save through the API', async () => {
    const calls = serve({
      'GET /api/offers': { json: data([]) },
      'POST /api/offers': { json: data([offer()]) },
    });
    const screen = await render(<OffersScreen />);
    expect(await screen.findByText(en.offers.empty)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: en.offers.chooseCourse }));
    await fireEvent.changeText(screen.getByTestId('course-search'), 'uj');
    await fireEvent.press(screen.getByRole('button', { name: 'UJ: BEng Civil Engineering' }));
    await fireEvent.press(screen.getByTestId('kind-provisional'));
    await fireEvent.changeText(screen.getByTestId('reply-by'), '30 October');
    await fireEvent.press(screen.getByRole('button', { name: en.offers.save }));
    expect(await screen.findByText(en.offers.replyByInvalid)).toBeTruthy();
    expect(calls.some((c) => c.key === 'POST /api/offers')).toBe(false);

    await fireEvent.changeText(screen.getByTestId('reply-by'), '2026-10-30');
    const announce = jest
      .spyOn(AccessibilityInfo, 'announceForAccessibility')
      .mockImplementation(() => {});
    await fireEvent.press(screen.getByRole('button', { name: en.offers.save }));
    expect(await screen.findByText(en.offers.added)).toBeTruthy();
    expect(announce).toHaveBeenCalledWith(en.offers.added);
    announce.mockRestore();
    const post = calls.find((c) => c.key === 'POST /api/offers');
    expect(post?.body).toEqual({
      programmeId: 'uj-beng-civil',
      kind: 'provisional',
      replyBy: '2026-10-30',
      conditions: [],
    });
    expect(post?.headers['authorization']).toBe('Bearer tok');
  });

  it('accepts one offer; a second is refused with the reason', async () => {
    const id = offer().id;
    const calls = serve({
      'GET /api/offers': { json: data([offer()]) },
      [`PATCH /api/offers/${id}`]: {
        status: 409,
        json: { error: 'state', detail: 'another-accepted' },
      },
    });
    const screen = await render(<OffersScreen />);
    await fireEvent.press(
      await screen.findByRole('button', { name: `${en.offers.accept}: BEng Civil Engineering` }),
    );
    expect(await screen.findByText(en.offers.errors['another-accepted'])).toBeTruthy();
    expect(calls.find((c) => c.key === `PATCH /api/offers/${id}`)?.body).toEqual({
      action: 'accept',
    });
  });
});

describe('the offer card’s structure (A3-15, A2-14, A7-16)', () => {
  const notMet = offer({
    finalCheck: {
      confirmedAt: '2027-01-15T08:00:00.000Z',
      status: 'not-met',
      shortfalls: [],
      planB: [
        {
          programmeId: 'uj-test-plan-b',
          name: 'Synthetic Plan B course',
          universityName: 'UJ',
          qualification: 'diploma',
          draft: true,
        },
      ],
    },
  });

  it('its section titles are headings a screen reader can jump to', async () => {
    const screen = await render(<OfferCardView offer={notMet} />);
    for (const title of [en.offers.conditionsTitle, en.offers.finalTitle, en.offers.planBTitle]) {
      expect(screen.getByRole('header', { name: title })).toBeTruthy();
    }
  });

  it('labels a draft Plan B course, as the web does', async () => {
    const screen = await render(<OfferCardView offer={notMet} />);
    const row = within(screen.getByTestId('plan-b-uj-test-plan-b'));
    expect(row.getByText(/Synthetic Plan B course/)).toBeTruthy();
    expect(row.getByText(en.common.draftBadge)).toBeTruthy();
  });

  it('shows each condition as quoted, with the `border.rule` left rule the web uses (A2-16)', async () => {
    const screen = await render(
      <OfferCardView offer={offer({ conditions: ['First, as quoted.', 'Second, as quoted.'] })} />,
    );
    for (const [n, words] of ['First, as quoted.', 'Second, as quoted.'].entries()) {
      const quote = screen.getByTestId(`offer-condition-${n}`);
      expect(within(quote).getByText(words)).toBeTruthy();
      expect(StyleSheet.flatten(quote.props.style)).toMatchObject({
        borderLeftWidth: theme.border.rule,
        borderLeftColor: theme.color.lineStrong,
        backgroundColor: theme.color.surfaceSunk,
      });
    }
  });

  it('waiting for final results: a way to confirm them, as on the web (A2-16)', async () => {
    const screen = await render(<OfferCardView offer={offer()} />);
    await fireEvent.press(screen.getByRole('button', { name: en.offers.confirmFinal }));
    expect(useRouter().push).toHaveBeenCalledWith('/upload');
  });

  it('reminders off: a way to turn them on, as on the web (A2-16)', async () => {
    const screen = await render(
      <OfferCardView offer={offer({ reminderAt: null })} remindersOn={false} />,
    );
    expect(screen.getByText(en.offers.reminderOff)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: en.notifications.title }));
    expect(useRouter().push).toHaveBeenCalledWith('/notifications');
  });

  it('no reminders link when a reminder is set', async () => {
    const screen = await render(<OfferCardView offer={offer()} remindersOn={false} />);
    expect(screen.queryByRole('button', { name: en.notifications.title })).toBeNull();
  });

  it('says the reminder’s day in South Africa, not in UTC (00:30 SAST is the next day)', async () => {
    // 22:30 UTC on 26 Oct is 00:30 on 27 Oct in Johannesburg.
    const screen = await render(
      <OfferCardView offer={offer({ reminderAt: '2026-10-26T22:30:00.000Z' })} />,
    );
    expect(screen.getByText(/^We’ll remind you on 27 Oct/)).toBeTruthy();
  });
});

describe('the "I got an offer" form (A3-18, A7-15)', () => {
  it('Save says what is still missing while it can’t be pressed', async () => {
    serve({ 'GET /api/offers': { json: data([]) } });
    const screen = await render(<OffersScreen />);
    await screen.findByText(en.offers.empty);
    const save = () => screen.getByRole('button', { name: en.offers.save });
    expect(save().props.accessibilityHint).toBe(
      `${en.offers.missingCourse} ${en.offers.missingKind}`,
    );
    await fireEvent.press(screen.getByTestId('kind-final'));
    expect(save().props.accessibilityHint).toBe(en.offers.missingCourse);
    await fireEvent.press(screen.getByRole('button', { name: en.offers.chooseCourse }));
    await fireEvent.press(screen.getByRole('button', { name: 'UJ: BEng Civil Engineering' }));
    expect(save().props.accessibilityHint).toBeUndefined();
  });

  it('the reply-by date takes digits and writes the dashes in; the course search isn’t corrected', async () => {
    serve({ 'GET /api/offers': { json: data([]) } });
    const screen = await render(<OffersScreen />);
    await screen.findByText(en.offers.empty);
    const date = screen.getByTestId('reply-by');
    expect(date.props.keyboardType).toBe('number-pad');
    await fireEvent.changeText(date, '20261030');
    expect(screen.getByTestId('reply-by').props.value).toBe('2026-10-30');
    await fireEvent.changeText(screen.getByTestId('reply-by'), '2026-1');
    expect(screen.getByTestId('reply-by').props.value).toBe('2026-1');
    await fireEvent.press(screen.getByRole('button', { name: en.offers.chooseCourse }));
    const search = screen.getByTestId('course-search');
    expect(search.props.autoCorrect).toBe(false);
    expect(search.props.spellCheck).toBe(false);
    expect(search.props.autoCapitalize).toBe('none');
  });
});

describe('the offer card in the chat, and the reminder’s notification', () => {
  it('renders in full', async () => {
    const screen = await render(<ArtifactCard artifact={offer()} />);
    expect(screen.getByTestId('artifact-offer-card')).toBeTruthy();
    expect(screen.getByText(en.offers.explain.provisional)).toBeTruthy();
  });

  it('a tapped reply-by notification opens My offers', () => {
    expect(routeForNotification({ screen: 'offers' })).toBe('/offers');
  });
});
