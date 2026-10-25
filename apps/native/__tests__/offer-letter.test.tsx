import { fireEvent, render, within } from '@testing-library/react-native';
import { en } from '@universityflow/content/app';
import type { OfferCardArtifact } from '@universityflow/ui';
import OffersScreen from '../app/offers';
import { saveToken } from '../lib/session';
import type { LetterUploadResult, OffersResponse } from '../lib/types';
import { type Call, serve } from '../test-utils/fake-api';
import { CACHE, files, imagePicker } from '../test-utils/native-modules';

/**
 * An offer from the acceptance letter, in the app (A1-33): camera, gallery or PDF, read into a
 * draft the learner checks field by field before anything is saved (hard rule 6), through the
 * same API as the web. Synthetic throughout (hard rule 4).
 */

const t = en.offers;
const DOCUMENT_ID = '33333333-3333-4333-8333-333333333333';

const OPTIONS = [
  { id: 'uj-beng-civil', name: 'BEng Civil Engineering', universityName: 'UJ' },
  { id: 'wits-bsc-eng', name: 'BSc Engineering', universityName: 'Wits' },
  { id: 'up-bsc-test', name: 'BSc Synthetic Studies', universityName: 'UP' },
];

const offer: OfferCardArtifact = {
  kind: 'offer-card',
  id: '00000000-0000-4000-8000-000000000009',
  offerKind: 'provisional',
  status: 'held',
  source: 'letter',
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
  replyBy: '2026-11-30',
  daysLeft: 44,
  conditions: ['Synthetic condition B, edited.'],
  reminderAt: null,
  checksFinal: true,
  finalCheck: null,
};

const data = (offers: OfferCardArtifact[] = []): OffersResponse => ({
  offers,
  options: OPTIONS,
  remindersOn: true,
});

const LETTER: LetterUploadResult = {
  documentId: DOCUMENT_ID,
  sample: true,
  candidates: ['uj-beng-civil'],
  letter: {
    universityAsPrinted: 'Synthetic University',
    programmeAsPrinted: 'BEng (Civil) synthetic',
    kind: 'provisional',
    conditions: ['Synthetic condition A, as quoted.', 'Synthetic condition B, as quoted.'],
    replyBy: '2026-11-30',
    warnings: ['partly-unreadable'],
  },
};

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);
const PHOTO = `${CACHE}ImagePicker/letter-1.jpg`;

function camera() {
  files.set(PHOTO, JPEG);
  imagePicker.requestCameraPermissionsAsync.mockResolvedValue({ granted: true });
  imagePicker.launchCameraAsync.mockResolvedValue({
    canceled: false,
    assets: [{ uri: PHOTO, mimeType: 'image/jpeg', width: 10, height: 10 }],
  });
}

/** Bytes as one character each (latin1), to read a multipart body. */
const text = (bytes: Uint8Array | null) => {
  let out = '';
  for (const b of bytes ?? []) out += String.fromCharCode(b);
  return out;
};

/** Every piece of text the tree renders, joined. */
const textOf = (node: unknown): string => {
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(textOf).join(' ');
  const children = (node as { children?: unknown } | null)?.children;
  return children ? textOf(children) : '';
};

/** Words that would tell a learner a non-final offer is a place (planning.md §8.5). */
const SAYS_A_PLACE = /you[’']re in\b|you got in|place is yours|final offer|you have a place/i;

const LOCAL_UPLOAD = {
  'POST /api/documents/uploads': { status: 404, json: { error: 'not-found', detail: null } },
};

beforeEach(async () => {
  await saveToken('tok');
});

afterEach(() => jest.restoreAllMocks());

describe('My offers: upload the letter', () => {
  it('no longer says reading a letter is for later; offers camera, gallery and PDF', async () => {
    serve({ 'GET /api/offers': { json: data() } });
    const screen = await render(<OffersScreen />);
    await screen.findByText(t.empty);
    expect(screen.queryByText(/Phase 5d/)).toBeNull();
    const card = within(screen.getByTestId('upload-letter'));
    expect(card.getByText(t.uploadTitle)).toBeTruthy();
    expect(card.getByText(t.uploadLead)).toBeTruthy();
    expect(card.getByRole('button', { name: en.documents.takePhoto })).toBeTruthy();
    expect(card.getByRole('button', { name: en.documents.choosePhoto })).toBeTruthy();
    expect(card.getByRole('button', { name: en.documents.choosePdf })).toBeTruthy();
  });

  it('a letter by camera reaches the check form, sent as a letter under a fixed name', async () => {
    camera();
    const calls = serve({
      'GET /api/offers': { json: data() },
      ...LOCAL_UPLOAD,
      'POST /api/documents': { json: LETTER },
    });
    const screen = await render(<OffersScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: en.documents.takePhoto }));
    expect(await screen.findByText(t.letterTitle)).toBeTruthy();
    expect(screen.getByText(t.letterLead)).toBeTruthy();

    const upload = calls.find((c) => c.key === 'POST /api/documents') as Call;
    const body = text(upload.bytes);
    expect(body).toContain('name="kind"\r\n\r\nacceptance-letter');
    expect(body.indexOf('name="kind"')).toBeLessThan(body.indexOf('name="file"'));
    expect(body).toContain('filename="letter.jpg"');
    // The app's copy of the photo is gone.
    expect(files.has(PHOTO)).toBe(false);

    // The draft, its warnings and the sample-reader notice are shown back.
    expect(screen.getByText(t.sampleLead)).toBeTruthy();
    expect(screen.getByText(t.letterWarnings['partly-unreadable'])).toBeTruthy();
    expect(screen.getByText(t.asPrinted('BEng (Civil) synthetic'))).toBeTruthy();
    expect(screen.getByTestId('condition-0').props.value).toBe('Synthetic condition A, as quoted.');
    expect(screen.getByTestId('condition-1').props.value).toBe('Synthetic condition B, as quoted.');
    expect(screen.getByTestId('reply-by').props.value).toBe('2026-11-30');
  });

  it('straight to storage, the server is asked to read it as a letter', async () => {
    camera();
    const ticket = {
      uploadId: '44444444-4444-4444-8444-444444444444',
      url: 'https://uf-documents.s3.af-south-1.amazonaws.com/',
      fields: { key: 'documents/incoming-abc' },
    };
    const calls = serve({
      'GET /api/offers': { json: data() },
      'POST /api/documents/uploads': { json: ticket },
      'POST /': { status: 204 },
      [`POST /api/documents/uploads/${ticket.uploadId}?kind=acceptance-letter`]: { json: LETTER },
    });
    const screen = await render(<OffersScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: en.documents.takePhoto }));
    expect(await screen.findByText(t.letterTitle)).toBeTruthy();
    expect(calls.map((c) => c.key)).toContain(
      `POST /api/documents/uploads/${ticket.uploadId}?kind=acceptance-letter`,
    );
  });

  it('the course is never chosen for the learner: the letter’s match is only offered first', async () => {
    camera();
    const calls = serve({
      'GET /api/offers': { json: data() },
      ...LOCAL_UPLOAD,
      'POST /api/documents': { json: LETTER },
      'POST /api/offers': { json: data([offer]) },
    });
    const screen = await render(<OffersScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: en.documents.takePhoto }));
    await screen.findByText(t.letterTitle);
    expect(screen.queryByTestId('chosen-course')).toBeNull();
    // The matched course is a button to press, not a choice made.
    const matched = within(screen.getByTestId('letter-candidates'));
    expect(matched.getByRole('button', { name: 'UJ: BEng Civil Engineering' })).toBeTruthy();

    // Confirm with no course: nothing is sent, and the form says what's missing.
    await fireEvent.press(screen.getByRole('button', { name: t.confirm }));
    expect(await screen.findByText(t.missingCourse)).toBeTruthy();
    expect(calls.some((c) => c.key === 'POST /api/offers')).toBe(false);
  });

  it('nothing is posted before Confirm; the edited fields are what is posted', async () => {
    camera();
    const calls = serve({
      'GET /api/offers': { json: data() },
      ...LOCAL_UPLOAD,
      'POST /api/documents': { json: LETTER },
      'POST /api/offers': { json: data([offer]) },
    });
    const screen = await render(<OffersScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: en.documents.takePhoto }));
    await screen.findByText(t.letterTitle);

    // The learner picks a different course from the full list than the letter's match.
    await fireEvent.press(screen.getByRole('button', { name: t.chooseCourse }));
    await fireEvent.changeText(screen.getByTestId('course-search'), 'synthetic');
    await fireEvent.press(screen.getByRole('button', { name: 'UP: BSc Synthetic Studies' }));
    expect(screen.getByTestId('chosen-course')).toHaveTextContent('UP: BSc Synthetic Studies');

    // Kind: conditional, not the letter's provisional.
    await fireEvent.press(screen.getByTestId('kind-conditional'));
    // Conditions: remove the first, fix the second, add a third, add an empty fourth.
    await fireEvent.press(screen.getByRole('button', { name: t.removeCondition(1) }));
    await fireEvent.changeText(
      screen.getByTestId('condition-0'),
      ' Synthetic condition B, edited. ',
    );
    await fireEvent.press(screen.getByRole('button', { name: t.addCondition }));
    await fireEvent.changeText(screen.getByTestId('condition-1'), 'Synthetic condition C.');
    await fireEvent.press(screen.getByRole('button', { name: t.addCondition }));
    // Reply-by: an unreadable date stops the save.
    await fireEvent.changeText(screen.getByTestId('reply-by'), '2026-13-45');
    await fireEvent.press(screen.getByRole('button', { name: t.confirm }));
    expect((await screen.findAllByText(t.replyByInvalid)).length).toBeGreaterThan(0);
    expect(calls.some((c) => c.key === 'POST /api/offers')).toBe(false);

    await fireEvent.changeText(screen.getByTestId('reply-by'), '20261215');
    await fireEvent.press(screen.getByRole('button', { name: t.confirm }));
    expect(await screen.findByText(t.added)).toBeTruthy();

    const posts = calls.filter((c) => c.key === 'POST /api/offers');
    expect(posts).toHaveLength(1);
    expect(posts[0]?.body).toEqual({
      programmeId: 'up-bsc-test',
      kind: 'conditional',
      replyBy: '2026-12-15',
      conditions: ['Synthetic condition B, edited.', 'Synthetic condition C.'],
      documentId: DOCUMENT_ID,
    });
    // Back on My offers, with the new card.
    expect(screen.getByTestId(`offer-${offer.id}`)).toBeTruthy();
  });

  it('one request at a time: a second Confirm while saving sends nothing more', async () => {
    camera();
    let release: () => void = () => {};
    const calls = serve({
      'GET /api/offers': { json: data() },
      ...LOCAL_UPLOAD,
      'POST /api/documents': { json: LETTER },
      'POST /api/offers': { json: data([offer]) },
    });
    const screen = await render(<OffersScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: en.documents.takePhoto }));
    await screen.findByText(t.letterTitle);
    await fireEvent.press(screen.getByRole('button', { name: 'UJ: BEng Civil Engineering' }));
    // Hold the save open, then press Confirm twice.
    const { fetch } = jest.requireMock('expo/fetch') as { fetch: jest.Mock };
    const answer = fetch.getMockImplementation() as (...args: unknown[]) => Promise<unknown>;
    fetch.mockImplementation(
      (...args: unknown[]) =>
        new Promise((resolve) => {
          release = () => resolve(answer(...args));
        }),
    );
    const confirm = screen.getByRole('button', { name: t.confirm });
    await fireEvent.press(confirm);
    await fireEvent.press(confirm);
    release();
    expect(await screen.findByText(t.added)).toBeTruthy();
    expect(calls.filter((c) => c.key === 'POST /api/offers')).toHaveLength(1);
  });

  it('a provisional letter is never shown as final', async () => {
    camera();
    serve({
      'GET /api/offers': { json: data() },
      ...LOCAL_UPLOAD,
      'POST /api/documents': { json: LETTER },
    });
    const screen = await render(<OffersScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: en.documents.takePhoto }));
    await screen.findByText(t.letterTitle);
    expect(screen.getByTestId('kind-provisional').props.accessibilityState).toMatchObject({
      checked: true,
    });
    expect(screen.getByTestId('kind-final').props.accessibilityState).toMatchObject({
      checked: false,
    });
    // What the chosen kind means is said in plain words, and never calls it a place.
    expect(screen.getByTestId('letter-kind-explain')).toHaveTextContent(t.explain.provisional);
    // Nothing else on the form says it is a place: "Final offer" appears only as the unchosen
    // radio's own label.
    const form = textOf(screen.getByTestId('confirm-letter'));
    expect(form.split(t.kinds.final)).toHaveLength(2);
    expect(form.replace(t.kinds.final, '')).not.toMatch(SAYS_A_PLACE);
  });

  it('a letter whose kind is unclear starts with no kind chosen, and says so', async () => {
    camera();
    serve({
      'GET /api/offers': { json: data() },
      ...LOCAL_UPLOAD,
      'POST /api/documents': {
        json: {
          ...LETTER,
          candidates: [],
          letter: { ...LETTER.letter, kind: null, warnings: ['kind-unclear'] },
        },
      },
    });
    const screen = await render(<OffersScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: en.documents.takePhoto }));
    await screen.findByText(t.letterTitle);
    expect(screen.getByText(t.letterWarnings['kind-unclear'])).toBeTruthy();
    expect(screen.getByText(t.noCandidates)).toBeTruthy();
    for (const k of ['provisional', 'conditional', 'final', 'waitlist']) {
      expect(screen.getByTestId(`kind-${k}`).props.accessibilityState).toMatchObject({
        checked: false,
      });
    }
    expect(screen.queryByTestId('letter-kind-explain')).toBeNull();
  });

  it('an unreadable letter says so and offers adding the offer by hand', async () => {
    camera();
    serve({
      'GET /api/offers': { json: data() },
      ...LOCAL_UPLOAD,
      'POST /api/documents': {
        json: { documentId: DOCUMENT_ID, letter: null, candidates: [], sample: false },
      },
    });
    const screen = await render(<OffersScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: en.documents.takePhoto }));
    expect(await screen.findByText(t.unreadable)).toBeTruthy();
    expect(screen.getByTestId('add-offer')).toBeTruthy();
  });

  it('a consent that doesn’t cover letters: the refusal says why', async () => {
    camera();
    const calls = serve({
      'GET /api/offers': { json: data() },
      ...LOCAL_UPLOAD,
      'POST /api/documents': {
        status: 403,
        json: { error: 'consent-outdated', detail: 'university-documents' },
      },
    });
    const screen = await render(<OffersScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: en.documents.takePhoto }));
    expect(await screen.findByText(en.errors.consentOutdatedDocuments)).toBeTruthy();
    expect(screen.queryByText(t.letterTitle)).toBeNull();
    expect(calls.some((c) => c.key === 'POST /api/offers')).toBe(false);
    // The photo still leaves the phone.
    expect(files.has(PHOTO)).toBe(false);
  });

  it('a refused camera says how to allow it', async () => {
    imagePicker.requestCameraPermissionsAsync.mockResolvedValue({ granted: false });
    serve({ 'GET /api/offers': { json: data() } });
    const screen = await render(<OffersScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: en.documents.takePhoto }));
    expect(await screen.findByText(en.documents.cameraDenied)).toBeTruthy();
  });

  it('Cancel goes back to My offers and sends nothing', async () => {
    camera();
    const calls = serve({
      'GET /api/offers': { json: data() },
      ...LOCAL_UPLOAD,
      'POST /api/documents': { json: LETTER },
    });
    const screen = await render(<OffersScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: en.documents.takePhoto }));
    await screen.findByText(t.letterTitle);
    await fireEvent.press(screen.getByRole('button', { name: en.common.cancel }));
    expect(screen.getByText(t.empty)).toBeTruthy();
    expect(calls.some((c) => c.key === 'POST /api/offers')).toBe(false);
  });
});
