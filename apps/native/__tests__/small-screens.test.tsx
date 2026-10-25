import { fireEvent, render } from '@testing-library/react-native';
import { type SubjectMark, schoolRecord } from '@universityflow/admissions';
import { en } from '@universityflow/content/app';
import { type PlanMapsResponse, type PlanMapView, templateSeed } from '@universityflow/ui';
import { useLocalSearchParams } from 'expo-router';
import { AccessibilityInfo, Pressable, Text, TextInput, View } from 'react-native';
import AccountScreen from '../app/account';
import CvScreen from '../app/cv';
import PlanMapScreen from '../app/plan-map';
import ResultsScreen from '../app/results';
import { PlanMapsSection } from '../components/plan-maps';
import { saveToken } from '../lib/session';
import { serve } from '../test-utils/fake-api';
import { me } from '../test-utils/fixtures';
import { CACHE, files, imagePicker } from '../test-utils/native-modules';
import { atWidth, SMALL_WIDTHS, smallScreenProblems } from '../test-utils/small-screen';

/**
 * The screens added since the judge demo (#81), on the smallest phones learners carry: 320 and
 * 360 dp wide. The school record (C2), the profile photo and look, plan maps and My CV. Each is
 * rendered in the states a learner reaches and read for anything that overflows, clips words,
 * is too small to tap or has no name (test-utils/small-screen.ts). Synthetic data only; RNTL v14:
 * every render and press awaited.
 */

type Screen = Awaited<ReturnType<typeof render>>;
const problems = (screen: Screen, width: number) =>
  smallScreenProblems(screen.root as never, width);

beforeEach(async () => {
  await saveToken('tok');
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
});
afterEach(() => jest.restoreAllMocks());

describe('the checks, on broken examples', () => {
  const at = async (ui: React.ReactElement) =>
    smallScreenProblems((await render(ui)).root as never, 320);

  it('a fixed width wider than the screen', async () => {
    expect(await at(<View style={{ width: 320 }} />)).toEqual([
      expect.stringMatching(/^fixed width 320 > 288/),
    ]);
    expect(await at(<View style={{ width: 288, maxWidth: 999 }} />)).toEqual([]);
  });

  it('words cut to one line', async () => {
    expect(await at(<Text numberOfLines={1}>A long programme name</Text>)).toEqual([
      expect.stringMatching(/^text cut to 1 line/),
    ]);
  });

  it('words in a row that can neither shrink nor wrap', async () => {
    const row = (shrink: object) => (
      <View style={{ flexDirection: 'row' }}>
        <View style={{ width: 24, height: 24 }} />
        <Text style={shrink}>Bachelor of Science in Actuarial Science</Text>
      </View>
    );
    expect(await at(row({}))).toEqual([expect.stringMatching(/^words in a row/)]);
    expect(await at(row({ flexShrink: 1 }))).toEqual([]);
    expect(
      await at(
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          <Text>One</Text>
          <Text>Two</Text>
        </View>,
      ),
    ).toEqual([]);
  });

  it('a control too small, with no role or no name', async () => {
    expect(
      await at(
        <Pressable onPress={() => {}} accessibilityRole="button" style={{ minHeight: 30 }}>
          <Text>Go</Text>
        </Pressable>,
      ),
    ).toEqual([expect.stringMatching(/^a control 30 high/)]);
    expect(
      await at(<Pressable onPress={() => {}} style={{ minHeight: 44, minWidth: 44 }} />),
    ).toEqual([
      expect.stringMatching(/^a control with no role/),
      expect.stringMatching(/^a control with no name/),
    ]);
    expect(
      await at(
        <Pressable
          onPress={() => {}}
          accessibilityRole="button"
          accessibilityLabel="Close"
          style={{ minHeight: 44, width: 20 }}
        />,
      ),
    ).toEqual([expect.stringMatching(/^a control 20 wide/)]);
    expect(await at(<TextInput />)).toEqual([expect.stringMatching(/^a text field with no name/)]);
  });

  it('sets the window to a small phone', async () => {
    const spy = atWidth(320);
    const { Dimensions } = jest.requireActual<typeof import('react-native')>('react-native');
    expect(Dimensions.get('window').width).toBe(320);
    spy.mockRestore();
  });
});

// ---------------------------------------------------------------------------------------------
// The school record on My results (C2, #83)

/** Subjects with long names, as the record shows them in full. */
const GRADE_10: ReadonlyArray<SubjectMark> = [
  { subject: 'english-hl', percent: 61 },
  { subject: 'afrikaans-fal', percent: 55 },
  { subject: 'mathematical-literacy', percent: 29 },
  { subject: 'life-orientation', percent: 80 },
];
const GRADE_11: ReadonlyArray<SubjectMark> = [
  { subject: 'english-hl', percent: 70 },
  { subject: 'afrikaans-fal', percent: 58 },
  { subject: 'mathematical-literacy', percent: 30 },
  { subject: 'life-orientation', percent: 79 },
];
const GRADE_11_FINAL: ReadonlyArray<SubjectMark> = GRADE_11.map((m) => ({
  ...m,
  percent: m.percent + 3,
}));

const RECORD = schoolRecord([
  { kind: 'grade-10-final', confirmedAt: new Date('2026-12-01T10:00:00Z'), marks: GRADE_10 },
  { kind: 'grade-11-june', confirmedAt: new Date('2027-07-01T10:00:00Z'), marks: GRADE_11 },
  { kind: 'grade-11-final', confirmedAt: new Date('2027-12-01T10:00:00Z'), marks: GRADE_11_FINAL },
]);

const results = {
  report: { kind: 'grade-11-final', confirmedAt: '2027-12-01T10:00:00Z' },
  shortlist: [],
  results: {
    basis: 'progress',
    passProjected: 'bachelor',
    qualifyNow: [],
    onTrack: [],
    close: [],
    planB: [],
    checked: 0,
    includesDrafts: false,
  },
  record: RECORD,
};

// ---------------------------------------------------------------------------------------------
// The profile photo and look (About me)

const PICKED = `${CACHE}ImagePicker/profile-1.jpg`;

function learner(photo: { version: string | null } | null) {
  const base = me({ consentStatus: 'not-required' }, true, 11);
  return {
    ...base,
    profile: {
      ...base.profile,
      displayName: 'Nomvuyiso Ramaphosa-Vilakazi',
      schoolFinished: false,
      theme: 'ocean',
      avatar: 'initials',
      taglineId: 'small-steps',
      badgeIds: ['future-engineer', 'loves-maths'],
    },
    photo,
  };
}

// ---------------------------------------------------------------------------------------------
// Plan maps

const MAP_ID = '00000000-0000-4000-9000-000000000001';

function mapOf(): PlanMapView {
  const seed = templateSeed('six-stops');
  const id = (ref: string) =>
    `00000000-0000-4000-8000-${String(seed.findIndex((s) => s.ref === ref)).padStart(12, '0')}`;
  return {
    id: MAP_ID,
    templateId: 'six-stops',
    title: 'My road to a Bachelor of Science in Actuarial Science',
    linksGoal: false,
    goal: null,
    nodes: seed.map((s) => ({
      id: id(s.ref),
      parentId: s.parentRef ? id(s.parentRef) : null,
      position: s.position,
      depth: s.depth,
      slotId: s.slotId,
      text: null,
      status: s.slotId === 'slot:grade-10' ? 'not-achieved' : 'planned',
      whyNot: s.slotId === 'slot:grade-10' ? 'Synthetic: I ran out of time before the exams' : null,
      differently: null,
      targetMonth: s.slotId === 'slot:grade-11' ? '2027-11' : null,
    })),
    wordsAllowed: true,
    updatedAt: '2026-10-13T08:00:00.000Z',
  };
}

const MAPS: PlanMapsResponse = {
  maps: [
    {
      id: MAP_ID,
      templateId: 'staircase',
      title: 'My road to a Bachelor of Science in Actuarial Science',
      counts: { planned: 7, achieved: 1, notAchieved: 2 },
      updatedAt: '2026-10-13T08:00:00.000Z',
    },
  ],
  wordsAllowed: true,
  max: 10,
};

// ---------------------------------------------------------------------------------------------
// My CV (#85, behind UF_CV)

const t = en.cv;
const ID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const optIn = {
  optedInAt: '2026-10-19T08:00:00.000Z',
  version: 'cv-optin-v1',
  purposes: ['cv.draft', 'cv.tailor', 'cv.ats', 'cv.share'],
};
const cvView = {
  selection: {
    surname: null,
    label: null,
    summary: null,
    email: null,
    phone: null,
    city: null,
    region: null,
    includeSchool: true,
    subjectIds: ['mathematics'],
    includeOffer: false,
    moduleCodes: [],
    entryIds: [ID(2)],
  },
  available: {
    school: { name: 'Synthetic Hoërskool Noord-Kaapland Akademie', endYear: 2027 },
    subjects: [
      { id: 'mathematics', name: 'Mathematics', percent: 71 },
      { id: 'mathematical-literacy', name: 'Mathematical Literacy', percent: 64 },
    ],
    offer: null,
    modules: [],
    entries: [],
  },
  profile: {},
  ready: true,
  missing: [],
  omitted: [],
};
const entry = {
  id: ID(2),
  position: 0,
  kind: 'project',
  title: 'A school app that reminds learners of their exam timetable',
  organisation: 'Synthetic Hoërskool Noord-Kaapland Akademie',
  role: null,
  startDate: null,
  endDate: null,
  description: null,
  highlights: [],
  keywords: [],
  evidence: [
    { kind: 'other', url: 'https://example.org/a-very-long-path/school-app', label: null },
  ],
  linkedModules: [],
};
const cvDoc = {
  id: ID(9),
  kind: 'tailored',
  status: 'ready',
  problem: null,
  advertTitle: 'Junior data analyst (graduate programme)',
  advertCompany: 'Synthetic Analytics and Insurance Holdings',
  markdown: '# Nomvuyiso Example\n\nSynthetic Hoërskool Noord-Kaapland Akademie',
  gaps: ['Add a project with a link to your work.'],
  atsCoverage: 0.62,
  atsMatched: ['Excel', 'SQL'],
  atsMissing: ['Python', 'Power BI'],
  atsMissingMust: ['Python'],
  hasPdf: true,
  bytes: 1200,
  confirmedAt: '2026-10-21T08:00:00.000Z',
  createdAt: '2026-10-20T08:00:00.000Z',
  finishedAt: '2026-10-20T08:01:00.000Z',
};
const cvReads = {
  'GET /api/me/cv/opt-in': {
    json: { optIn, wordingCovers: true, mayShare: true, canShare: true, version: 'cv-optin-v1' },
  },
  'GET /api/me/cv/entries': { json: { entries: [entry] } },
  'GET /api/me/cv/selection': { json: cvView },
  'GET /api/me/cv/documents': { json: { documents: [cvDoc] } },
  'GET /api/me/cv/shares': { json: { shares: [] } },
  [`GET /api/me/cv/documents/${ID(9)}`]: {
    json: { document: cvDoc, pdf: { url: 'https://example.org/pdf', expiresAt: '' } },
  },
};

describe.each(SMALL_WIDTHS)('at %i dp wide', (width) => {
  beforeEach(() => {
    atWidth(width);
  });

  it('My results with the school record: three reports of long subject names', async () => {
    serve({ 'GET /api/results': { json: results } });
    const screen = await render(<ResultsScreen />);
    await screen.findByTestId('school-record');
    expect(problems(screen, width)).toEqual([]);
  });

  it('About me with a photo offered, the look picker open and the crop step', async () => {
    files.set(PICKED, new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]));
    imagePicker.launchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: PICKED, mimeType: 'image/jpeg', width: 1200, height: 800 }],
    });
    serve({ 'GET /api/me': { json: learner({ version: null }) } });
    const screen = await render(<AccountScreen />);
    await screen.findByRole('header', { name: 'Nomvuyiso Ramaphosa-Vilakazi' });
    expect(problems(screen, width)).toEqual([]);
    await fireEvent.press(screen.getByRole('button', { name: en.profileLook.open }));
    expect(problems(screen, width)).toEqual([]);
    await fireEvent.press(screen.getByRole('button', { name: en.profilePhoto.chooseFromPhone }));
    await screen.findByText(en.profilePhoto.cropTitle);
    expect(problems(screen, width)).toEqual([]);
  });

  it('the My plan maps card, with a long title and the template choice open', async () => {
    serve({ 'GET /api/me/plan-maps': { json: MAPS } });
    const screen = await render(<PlanMapsSection hasGoal />);
    await screen.findByText(en.planMaps.counts(1, 2, 7));
    expect(problems(screen, width)).toEqual([]);
    await fireEvent.press(screen.getByRole('button', { name: en.planMaps.start }));
    expect(problems(screen, width)).toEqual([]);
  });

  it('one plan map: the outline, a part being edited and a part’s menu', async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({ id: MAP_ID });
    serve({ [`GET /api/me/plan-maps/${MAP_ID}`]: { json: { map: mapOf() } } });
    const screen = await render(<PlanMapScreen />);
    await screen.findAllByTestId(/^plan-node-/);
    expect(problems(screen, width)).toEqual([]);
    await fireEvent.press(screen.getByRole('button', { name: en.planMaps.editing('Grade 11') }));
    expect(problems(screen, width)).toEqual([]);
    await fireEvent.press(screen.getByRole('button', { name: en.planMaps.moreFor('Matric') }));
    expect(problems(screen, width)).toEqual([]);
  });

  it('My CV: the opt-in card', async () => {
    serve({
      ...cvReads,
      'GET /api/me/cv/opt-in': {
        json: { optIn: null, wordingCovers: true, mayShare: true, canShare: false, version: 'v1' },
      },
    });
    const screen = await render(<CvScreen />);
    await screen.findByText(t.optIn.body);
    expect(problems(screen, width)).toEqual([]);
  });

  it('My CV: what goes on it, an entry being added, a CV open with its link, and stopping', async () => {
    serve(cvReads);
    const screen = await render(<CvScreen />);
    await screen.findByText(t.what.title);
    expect(problems(screen, width)).toEqual([]);
    await fireEvent.press(screen.getByRole('button', { name: t.entries.add }));
    expect(problems(screen, width)).toEqual([]);
    await fireEvent.press(screen.getByRole('button', { name: /^Open/ }));
    await screen.findByTestId('cv-preview');
    expect(problems(screen, width)).toEqual([]);
    await fireEvent.press(screen.getByRole('button', { name: t.withdraw.start }));
    await screen.findByTestId('cv-withdraw');
    expect(problems(screen, width)).toEqual([]);
  });
});
