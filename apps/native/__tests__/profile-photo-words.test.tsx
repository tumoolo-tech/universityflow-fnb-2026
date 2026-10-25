import { fireEvent, render } from '@testing-library/react-native';
import { en } from '@universityflow/content/app';
import { AccessibilityInfo } from 'react-native';
import AccountScreen from '../app/account';
import { saveToken } from '../lib/session';
import { serve } from '../test-utils/fake-api';
import { me } from '../test-utils/fixtures';
import { CACHE, files, imagePicker } from '../test-utils/native-modules';

/**
 * The photo's words in the app's About me (A11-31; the owner's "not used for anything else"), the
 * same rules as the web: beside the photo buttons, only you see it and it is used for nothing
 * else; when the learner's consent doesn't name the photo yet, who must agree; and nothing about
 * a photo where the server offers none. RNTL v14: every render and press awaited.
 */

const t = en.profilePhoto;
const PICKED = `${CACHE}ImagePicker/profile-words.jpg`;

function learner(photo: { version: string | null } | null) {
  const base = me({ consentStatus: 'not-required' }, true, 10);
  return {
    ...base,
    profile: {
      ...base.profile,
      displayName: 'Thando Mokoena',
      theme: 'ocean',
      avatar: 'initials',
      taglineId: null,
      badgeIds: [],
    },
    photo,
  };
}

beforeEach(async () => {
  await saveToken('tok');
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
  jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

async function openPicker(screen: Awaited<ReturnType<typeof render>>) {
  await fireEvent.press(await screen.findByRole('button', { name: en.profileLook.open }));
}

describe('the photo’s words (A11-31)', () => {
  it('says beside the buttons that only the learner sees it and it is used for nothing else', async () => {
    serve({ 'GET /api/me': { json: learner({ version: null }) } });
    const screen = await render(<AccountScreen />);
    await openPicker(screen);
    expect(screen.getByText(t.onlyYou)).toBeTruthy();
  });

  it('says nothing about a photo where the server offers none', async () => {
    serve({ 'GET /api/me': { json: learner(null) } });
    const screen = await render(<AccountScreen />);
    await openPicker(screen);
    expect(screen.queryByText(t.onlyYou)).toBeNull();
  });

  it('says who must agree when the consent doesn’t name the photo yet', async () => {
    files.set(PICKED, new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]));
    imagePicker.launchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: PICKED, mimeType: 'image/jpeg', width: 1200, height: 800 }],
    });
    serve({
      'GET /api/me': { json: learner({ version: null }) },
      'POST /api/me/photo': {
        status: 403,
        json: { error: 'consent-outdated', detail: 'photo-consent' },
      },
    });
    const screen = await render(<AccountScreen />);
    await openPicker(screen);
    await fireEvent.press(screen.getByRole('button', { name: t.chooseFromPhone }));
    await fireEvent.press(await screen.findByRole('button', { name: t.save }));
    expect(await screen.findByText(t.consentNeeded)).toBeTruthy();
  });
});
