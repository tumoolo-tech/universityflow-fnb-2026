import { fireEvent, render, within } from '@testing-library/react-native';
import { en } from '@universityflow/content/app';
import type { ModuleDifference, MyModulesArtifact } from '@universityflow/ui';
import { useRouter } from 'expo-router';
import { Linking, Share, StyleSheet } from 'react-native';
import ModulesScreen from '../app/modules';
import { ArtifactCard } from '../components/artifact-card';
import { MyModulesCard } from '../components/my-modules-card';
import { routeForNotification } from '../lib/push';
import { saveToken } from '../lib/session';
import { theme } from '../lib/theme';
import type { ProofUploadResult, RegistrationResponse } from '../lib/types';
import { type Call, serve } from '../test-utils/fake-api';
import { CACHE, files, imagePicker } from '../test-utils/native-modules';

const m = en.modules;

/** Synthetic throughout (hard rule 4): made-up codes, names, places and numbers. */
const REGISTRATION_ID = '00000000-0000-4000-8000-0000000000aa';
const DIFFERENCE_TEXT = 'You’re not registered for TEST102 Synthetic Module B. (synthetic)';
const MESSAGE = 'Good day,\nSynthetic message line.\nThank you.';

const difference = {
  difference: { kind: 'missing-compulsory', module: { code: 'TEST102' } },
  text: DIFFERENCE_TEXT,
} as unknown as ModuleDifference;

const artifact = (overrides: Partial<MyModulesArtifact> = {}): MyModulesArtifact => ({
  kind: 'my-modules',
  registrationId: REGISTRATION_ID,
  academicYear: 2027,
  yearOfStudy: 1,
  confirmedAt: '2027-02-01T08:00:00.000Z',
  programme: {
    id: 'test-bsc',
    name: 'BSc Synthetic Studies',
    faculty: 'Synthetic Science',
    universityId: 'uj',
    universityName: 'UJ',
    sourceUrl: 'https://example.org/rules',
    academicYear: 2027,
    draft: true,
  },
  status: 'checked',
  curriculum: { academicYear: 2027, sourceUrl: 'https://example.org/curriculum', draft: true },
  registered: [
    { code: 'TEST101', name: 'Synthetic Module A', term: 'S1', credits: 12, inCurriculum: true },
  ],
  expected: [
    {
      code: 'TEST101',
      name: 'Synthetic Module A',
      semester: 'S1',
      credits: 12,
      compulsory: true,
      registered: true,
    },
    {
      code: 'TEST102',
      name: 'Synthetic Module B',
      semester: 'S2',
      credits: 12,
      compulsory: true,
      registered: false,
    },
  ],
  differences: [difference],
  credits: { registered: 12, uncounted: [], min: 24, max: 24 },
  office: {
    faculty: 'Synthetic Science',
    where: 'Building 0, Room 000',
    contactUrl: 'https://example.org/contact',
    email: 'office@example.org',
    phone: '000 000 0000',
    hours: '08:00 to 16:00',
    sourceUrl: 'https://example.org/contact',
    draft: true,
  },
  deadlines: {
    status: 'published',
    deadlines: [{ appliesTo: 'all', lastDay: '2027-02-20', daysLeft: 19 }],
    unpublishedTerms: [],
    next: { appliesTo: 'all', lastDay: '2027-02-20', daysLeft: 19 },
    sourceUrl: 'https://example.org/calendar',
    draft: true,
  },
  reminderAt: '2027-02-17T16:00:00.000Z',
  message: MESSAGE,
  includesDrafts: true,
  ...overrides,
});

const OPTIONS = [
  { id: 'test-bsc', name: 'BSc Synthetic Studies', universityName: 'UJ' },
  { id: 'test-ba', name: 'BA Synthetic Arts', universityName: 'Wits' },
];

const response = (overrides: Partial<RegistrationResponse> = {}): RegistrationResponse => ({
  modules: null,
  acceptedProgrammeId: 'test-bsc',
  options: OPTIONS,
  remindersOn: true,
  defaultYear: 2027,
  ...overrides,
});

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);
const PHOTO = `${CACHE}ImagePicker/proof-1.jpg`;

function camera() {
  files.set(PHOTO, JPEG);
  imagePicker.requestCameraPermissionsAsync.mockResolvedValue({ granted: true });
  imagePicker.launchCameraAsync.mockResolvedValue({
    canceled: false,
    assets: [{ uri: PHOTO, mimeType: 'image/jpeg', width: 10, height: 10 }],
  });
}

const SAMPLE: ProofUploadResult = {
  documentId: '11111111-1111-4111-8111-111111111111',
  sample: true,
  registration: {
    programmeCode: 'TSTBSC',
    yearOfStudy: 1,
    modules: [
      {
        code: 'TEST101',
        name: 'Synthetic Module A',
        term: 'S1',
        termAsPrinted: 'SEM1',
        credits: 12,
      },
      {
        code: 'TEST103',
        name: 'Synthetic Module C',
        term: null,
        termAsPrinted: null,
        credits: null,
      },
      { code: 'TEST102', name: null, term: 'S2', termAsPrinted: 'SEM2', credits: 12 },
    ],
    warnings: ['term-unclear'],
  },
};

/** Bytes as one character each (latin1), to read a multipart body. */
const text = (bytes: Uint8Array | null) => {
  let out = '';
  for (const b of bytes ?? []) out += String.fromCharCode(b);
  return out;
};

beforeEach(async () => {
  await saveToken('tok');
});

afterEach(() => jest.restoreAllMocks());

describe('the My modules card', () => {
  it('shows "term not printed" and a module’s alternative codes, never a guessed term', async () => {
    const screen = await render(
      <MyModulesCard
        artifact={artifact({
          expected: [
            {
              code: 'TEST101',
              alternativeCodes: ['TEST101S'],
              name: 'Synthetic Module A',
              credits: 12,
              compulsory: true,
              registered: true,
            },
          ],
        })}
      />,
    );
    expect(screen.getByText('TEST101 / TEST101S: Synthetic Module A')).toBeTruthy();
    expect(screen.getByText(`${m.termNotPrinted} · ${m.credits(12)}`)).toBeTruthy();
  });

  it('checked, one difference: its text, who to see, the message, the last day and the lists', async () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' });
    const screen = await render(<MyModulesCard artifact={artifact()} remindersOn />);

    const differences = within(screen.getByTestId('modules-differences'));
    expect(differences.getByText(m.differencesTitle(1))).toBeTruthy();
    expect(differences.getByText(DIFFERENCE_TEXT)).toBeTruthy();
    expect(screen.getByText(m.checkedAgainst(2027))).toBeTruthy();
    expect(screen.queryByText(m.matches)).toBeNull();
    expect(screen.getByText(m.totalCredits(12, 24, 24))).toBeTruthy();

    // Who to see: email, phone and the contact page open the phone's own apps.
    const office = within(screen.getByTestId('modules-office'));
    expect(office.getByText(m.whoLead('Synthetic Science'))).toBeTruthy();
    expect(office.getByText('Building 0, Room 000')).toBeTruthy();
    await fireEvent.press(office.getByRole('link', { name: `${m.email}: office@example.org` }));
    expect(openURL).toHaveBeenLastCalledWith('mailto:office@example.org');
    await fireEvent.press(office.getByRole('link', { name: `${m.phone}: 000 000 0000` }));
    expect(openURL).toHaveBeenLastCalledWith('tel:0000000000');
    await fireEvent.press(
      office.getByRole('link', { name: `${m.contactPage}: Synthetic Science` }),
    );
    expect(openURL).toHaveBeenLastCalledWith('https://example.org/contact');

    // The message goes to the share sheet (which offers Copy), exactly as code wrote it.
    expect(screen.getByTestId('modules-message')).toHaveTextContent(MESSAGE);
    await fireEvent.press(screen.getByRole('button', { name: m.copy }));
    expect(share).toHaveBeenCalledWith({ message: MESSAGE });

    const deadline = within(screen.getByTestId('modules-deadline'));
    expect(deadline.getByText(m.daysLeft(19))).toBeTruthy();
    expect(deadline.getByText(/^All modules: /)).toBeTruthy();
    expect(deadline.getByText(/^We’ll remind you on/)).toBeTruthy();

    const expected = within(screen.getByTestId('modules-expected'));
    expect(expected.getByText('TEST102: Synthetic Module B')).toBeTruthy();
    expect(expected.getByText(m.notRegistered)).toBeTruthy();
    expect(
      within(screen.getByTestId('modules-registered')).getByText('TEST101: Synthetic Module A'),
    ).toBeTruthy();
    expect(screen.getAllByText(en.common.draftBadge).length).toBeGreaterThan(0);
  });

  it('says when the share sheet could not open', async () => {
    jest.spyOn(Share, 'share').mockRejectedValue(new Error('no share sheet'));
    const screen = await render(<MyModulesCard artifact={artifact()} />);
    await fireEvent.press(screen.getByRole('button', { name: m.copy }));
    expect(await screen.findByText(m.copyFailed)).toBeTruthy();
  });

  it('clean: says it matches, with nothing to fix and no message', async () => {
    const screen = await render(
      <MyModulesCard
        artifact={artifact({
          differences: [],
          message: null,
          reminderAt: null,
          credits: { registered: 24, uncounted: [], min: 24, max: 24 },
        })}
        remindersOn={false}
      />,
    );
    expect(screen.getByText(m.matches)).toBeTruthy();
    expect(screen.queryByTestId('modules-differences')).toBeNull();
    expect(screen.queryByText(m.messageTitle)).toBeNull();
    // Nothing to fix: no nudge to turn reminders on.
    expect(screen.queryByText(m.reminderOff)).toBeNull();
  });

  it('no curriculum: no verdict at all, only who can check it', async () => {
    const screen = await render(
      <MyModulesCard
        artifact={artifact({
          status: 'no-curriculum',
          curriculum: null,
          differences: [],
          expected: [],
          credits: null,
          message: null,
          registered: [
            { code: 'TEST101', name: null, term: null, credits: null, inCurriculum: null },
          ],
        })}
      />,
    );
    expect(screen.getByTestId('modules-no-verdict')).toHaveTextContent(m.noCurriculum);
    expect(screen.queryByText(m.matches)).toBeNull();
    expect(screen.queryByTestId('modules-differences')).toBeNull();
    expect(screen.queryByText(m.checkedAgainst(2027))).toBeNull();
    expect(screen.queryByTestId('modules-expected')).toBeNull();
    expect(screen.getByText(m.notSure)).toBeTruthy();
    expect(screen.getByTestId('modules-office')).toBeTruthy();
  });

  it.each([
    ['no-programme', m.noProgramme],
    ['not-first-year', m.notFirstYear],
  ] as const)('%s: says why there is no verdict', async (status, words) => {
    const screen = await render(
      <MyModulesCard
        artifact={artifact({
          status,
          curriculum: null,
          differences: [],
          expected: [],
          credits: null,
        })}
      />,
    );
    expect(screen.getByTestId('modules-no-verdict')).toHaveTextContent(words);
    expect(screen.queryByText(m.matches)).toBeNull();
  });

  it('no published deadline: never a date, ask the office, no reminder nudge', async () => {
    const screen = await render(
      <MyModulesCard
        artifact={artifact({
          reminderAt: null,
          deadlines: {
            status: 'none',
            deadlines: [],
            unpublishedTerms: ['S2'],
            next: null,
            sourceUrl: null,
            draft: false,
          },
        })}
        remindersOn={false}
      />,
    );
    const deadline = within(screen.getByTestId('modules-deadline'));
    expect(deadline.getByText(m.noDeadline(2027))).toBeTruthy();
    expect(deadline.queryByText(/days? left|today is the last day|modules: \d/i)).toBeNull();
    expect(deadline.getByText(m.unpublished(m.deadlineScopes.S2))).toBeTruthy();
    // No date to remind before: the "turn reminders on" nudge needs a coming deadline.
    expect(deadline.queryByText(m.reminderOff)).toBeNull();
  });

  it('a coming deadline with reminders off says how to turn them on', async () => {
    const screen = await render(
      <MyModulesCard artifact={artifact({ reminderAt: null })} remindersOn={false} />,
    );
    expect(screen.getByText(m.reminderOff)).toBeTruthy();
  });

  it('a passed change deadline is a badge, as on the web, not a notice announced on every mount (A2-16)', async () => {
    const passed = { appliesTo: 'all', lastDay: '2027-02-20', daysLeft: -1 } as const;
    const screen = await render(
      <MyModulesCard
        artifact={artifact({
          reminderAt: null,
          deadlines: {
            status: 'published',
            deadlines: [passed],
            unpublishedTerms: [],
            next: null,
            sourceUrl: 'https://example.org/calendar',
            draft: false,
          },
        })}
      />,
    );
    const deadline = within(screen.getByTestId('modules-deadline'));
    expect(deadline.getByTestId('modules-deadline-passed')).toHaveTextContent(m.deadlinePassed);
    expect(screen.queryByTestId('notice-warning')).toBeNull();
  });

  it('each difference has the heavy side rule, `border.rule`, as on the web (A2-16)', async () => {
    const screen = await render(<MyModulesCard artifact={artifact()} />);
    const style = StyleSheet.flatten(screen.getByTestId('modules-difference-0').props.style);
    expect(style.borderLeftWidth).toBe(theme.border.rule);
    expect(style.borderLeftColor).toBe(theme.color.warning);
  });
});

describe('the My modules screen', () => {
  it('shows the empty state, and the upload and type-in choices', async () => {
    serve({ 'GET /api/registration': { json: response() } });
    const screen = await render(<ModulesScreen />);
    expect(await screen.findByText(m.empty)).toBeTruthy();
    expect(screen.getByText(m.uploadTitle)).toBeTruthy();
    expect(screen.getByRole('button', { name: en.documents.takePhoto })).toBeTruthy();
    expect(screen.getByRole('button', { name: en.documents.choosePhoto })).toBeTruthy();
    expect(screen.getByRole('button', { name: en.documents.choosePdf })).toBeTruthy();
    expect(screen.getByRole('button', { name: m.typeIn })).toBeTruthy();
  });

  it('shows the check when there is one, and removes it', async () => {
    const calls = serve({
      'GET /api/registration': { json: response({ modules: artifact() }) },
      [`DELETE /api/registration/${REGISTRATION_ID}`]: { json: response() },
    });
    const screen = await render(<ModulesScreen />);
    expect(await screen.findByText(DIFFERENCE_TEXT)).toBeTruthy();
    expect(screen.getByText(m.checkAgain)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: m.remove }));
    expect(await screen.findByText(m.removed)).toBeTruthy();
    expect(screen.getByText(m.empty)).toBeTruthy();
    expect(calls.some((c) => c.key === `DELETE /api/registration/${REGISTRATION_ID}`)).toBe(true);
  });

  it('typed in: the course is preselected, and exactly the confirmed rows are sent', async () => {
    const calls = serve({
      'GET /api/registration': { json: response() },
      'PUT /api/registration': { json: response({ modules: artifact() }) },
    });
    const screen = await render(<ModulesScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: m.typeIn }));
    expect(screen.getByText(m.typeLead)).toBeTruthy();
    // The accepted offer's course is chosen; the default year is selected.
    expect(screen.getByTestId('chosen-programme')).toHaveTextContent('UJ: BSc Synthetic Studies');
    expect(screen.getByRole('radio', { name: '2027' }).props.accessibilityState).toMatchObject({
      checked: true,
    });

    await fireEvent.changeText(screen.getByTestId('code-0'), ' TEST101 ');
    await fireEvent.changeText(screen.getByTestId('name-0'), 'Synthetic Module A');
    await fireEvent.press(screen.getByTestId('term-0'));
    await fireEvent.press(screen.getByRole('radio', { name: m.terms.S1 }));
    await fireEvent.changeText(screen.getByTestId('credits-0'), '12');

    await fireEvent.press(screen.getByRole('button', { name: m.addModule }));
    await fireEvent.changeText(screen.getByTestId('code-1'), 'TEST102');
    // A third row left empty is not a module.
    await fireEvent.press(screen.getByRole('button', { name: m.addModule }));
    await fireEvent.press(screen.getByTestId('year-of-study-1'));
    expect(calls.some((c) => c.key === 'PUT /api/registration')).toBe(false);

    await fireEvent.press(screen.getByRole('button', { name: m.confirm }));
    expect(await screen.findByText(m.saved)).toBeTruthy();
    const put = calls.find((c) => c.key === 'PUT /api/registration') as Call;
    expect(put.body).toEqual({
      programmeId: 'test-bsc',
      academicYear: 2027,
      yearOfStudy: 1,
      modules: [
        { code: 'TEST101', name: 'Synthetic Module A', term: 'S1', credits: 12 },
        { code: 'TEST102', name: null, term: null, credits: null },
      ],
      documentId: null,
    });
    expect(put.headers['authorization']).toBe('Bearer tok');
    // Back on the screen, with the check.
    expect(screen.getByText(DIFFERENCE_TEXT)).toBeTruthy();
  });

  it('sends nothing with an invalid code or no course chosen', async () => {
    const calls = serve({
      'GET /api/registration': { json: response({ acceptedProgrammeId: null }) },
      'PUT /api/registration': { json: response({ modules: artifact() }) },
    });
    const screen = await render(<ModulesScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: m.typeIn }));

    await fireEvent.press(screen.getByRole('button', { name: m.confirm }));
    expect(await screen.findByTestId('notice-danger')).toHaveTextContent(m.chooseProgramme);

    // Choose the course through the searchable list.
    await fireEvent.press(screen.getByRole('button', { name: m.chooseProgramme }));
    await fireEvent.changeText(screen.getByTestId('programme-search'), 'wits');
    expect(screen.queryByRole('button', { name: 'UJ: BSc Synthetic Studies' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Wits: BA Synthetic Arts' }));

    await fireEvent.press(screen.getByRole('button', { name: m.confirm }));
    expect(await screen.findByText(m.needOneModule)).toBeTruthy();

    await fireEvent.changeText(screen.getByTestId('code-0'), 'TEST 101!');
    await fireEvent.press(screen.getByRole('button', { name: m.confirm }));
    expect((await screen.findAllByText(m.invalidCode)).length).toBeGreaterThan(0);
    expect(calls.some((c) => c.key === 'PUT /api/registration')).toBe(false);

    await fireEvent.changeText(screen.getByTestId('code-0'), 'TEST 101');
    await fireEvent.press(screen.getByRole('button', { name: m.confirm }));
    expect(await screen.findByText(m.saved)).toBeTruthy();
    expect(calls.find((c) => c.key === 'PUT /api/registration')?.body).toMatchObject({
      programmeId: 'test-ba',
      modules: [{ code: 'TEST 101', name: null, term: null, credits: null }],
    });
  });

  it('a module code is never autocorrected or spell-checked (A7-15)', async () => {
    serve({ 'GET /api/registration': { json: response() } });
    const screen = await render(<ModulesScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: m.typeIn }));
    const code = screen.getByTestId('code-0');
    expect(code.props.autoCorrect).toBe(false);
    expect(code.props.spellCheck).toBe(false);
    expect(code.props.autoCapitalize).toBe('characters');
  });

  it('a proof by camera: the sample draft is prefilled, a removed row is not sent', async () => {
    camera();
    const calls = serve({
      'GET /api/registration': { json: response() },
      'POST /api/documents/uploads': { status: 404, json: { error: 'not-found', detail: null } },
      'POST /api/documents': { json: SAMPLE },
      'PUT /api/registration': { json: response({ modules: artifact() }) },
    });
    const screen = await render(<ModulesScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: en.documents.takePhoto }));
    expect(await screen.findByText(m.confirmTitle)).toBeTruthy();

    // The proof went up as a proof of registration, under a fixed name, and left the phone.
    const upload = calls.find((c) => c.key === 'POST /api/documents') as Call;
    const body = text(upload.bytes);
    expect(body).toContain('name="kind"\r\n\r\nproof-of-registration');
    expect(body.indexOf('name="kind"')).toBeLessThan(body.indexOf('name="file"'));
    expect(body).toContain('filename="registration.jpg"');
    expect(files.has(PHOTO)).toBe(false);

    // Read, shown, and not used until confirmed.
    expect(screen.getByText(m.confirmLead)).toBeTruthy();
    expect(screen.getByText(m.sampleLead)).toBeTruthy();
    expect(screen.getByText(m.warnings['term-unclear'])).toBeTruthy();
    expect(screen.getByText(m.programmeCodeAsPrinted('TSTBSC'))).toBeTruthy();
    expect(screen.getByText(m.termAsPrinted('SEM1'))).toBeTruthy();
    expect(screen.getByTestId('code-0').props.value).toBe('TEST101');
    expect(screen.getByTestId('credits-0').props.value).toBe('12');
    expect(calls.some((c) => c.key === 'PUT /api/registration')).toBe(false);

    // The learner removes the module that isn't on their proof, and confirms.
    await fireEvent.press(screen.getByRole('button', { name: m.removeModule(2) }));
    await fireEvent.press(screen.getByRole('button', { name: m.confirm }));
    expect(await screen.findByText(m.saved)).toBeTruthy();
    expect(calls.find((c) => c.key === 'PUT /api/registration')?.body).toEqual({
      programmeId: 'test-bsc',
      academicYear: 2027,
      yearOfStudy: 1,
      modules: [
        { code: 'TEST101', name: 'Synthetic Module A', term: 'S1', credits: 12 },
        { code: 'TEST102', name: null, term: 'S2', credits: 12 },
      ],
      documentId: SAMPLE.documentId,
    });
  });

  it('a proof straight to storage asks the server to read it as a proof of registration', async () => {
    camera();
    const ticket = {
      uploadId: '22222222-2222-4222-8222-222222222222',
      url: 'https://uf-documents.s3.af-south-1.amazonaws.com/',
      fields: { key: 'documents/incoming-abc' },
    };
    const calls = serve({
      'GET /api/registration': { json: response() },
      'POST /api/documents/uploads': { json: ticket },
      'POST /': { status: 204 },
      [`POST /api/documents/uploads/${ticket.uploadId}?kind=proof-of-registration`]: {
        json: SAMPLE,
      },
    });
    const screen = await render(<ModulesScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: en.documents.takePhoto }));
    expect(await screen.findByText(m.confirmTitle)).toBeTruthy();
    expect(calls.map((c) => c.key)).toContain(
      `POST /api/documents/uploads/${ticket.uploadId}?kind=proof-of-registration`,
    );
  });

  it('an unreadable proof says so and offers typing the modules in', async () => {
    camera();
    serve({
      'GET /api/registration': { json: response() },
      'POST /api/documents/uploads': { status: 404, json: { error: 'not-found', detail: null } },
      'POST /api/documents': {
        json: { documentId: SAMPLE.documentId, registration: null, sample: false },
      },
    });
    const screen = await render(<ModulesScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: en.documents.takePhoto }));
    expect(await screen.findByText(m.unreadable)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: m.typeIn }));
    expect(screen.getByText(m.typeLead)).toBeTruthy();
  });
});

describe('My modules in the chat, and the change-deadline notification', () => {
  it('renders the card in full, with a way to the screen', async () => {
    const screen = await render(<ArtifactCard artifact={artifact()} />);
    expect(screen.getByTestId('artifact-my-modules')).toBeTruthy();
    expect(screen.getByText(DIFFERENCE_TEXT)).toBeTruthy();
    await fireEvent.press(
      screen.getByRole('button', { name: `${en.chat.artifactOpen}: ${m.title}` }),
    );
    expect(useRouter().push).toHaveBeenCalledWith('/modules');
  });

  it('a tapped change-deadline notification opens My modules', () => {
    expect(routeForNotification({ screen: 'modules' })).toBe('/modules');
  });
});
