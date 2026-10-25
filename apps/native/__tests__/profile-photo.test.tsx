import { fireEvent, render, waitFor, within } from '@testing-library/react-native';
import { en } from '@universityflow/content/app';
import { CENTRED_CROP, cropBox, MAX_PHOTO_BYTES, moveCrop, zoomCrop } from '@universityflow/ui';
import { AccessibilityInfo, Animated, StyleSheet } from 'react-native';
import AccountScreen from '../app/account';
import { base64 } from '../lib/photo';
import { saveToken } from '../lib/session';
import { type Call, serve } from '../test-utils/fake-api';
import { me } from '../test-utils/fixtures';
import { CACHE, files, imagePicker } from '../test-utils/native-modules';
import { utf8 } from '../test-utils/utf8';

/**
 * The profile photo in the app (profile-look-proposal §5.3): only when the server's switch offers
 * it; taken or chosen with the picker the app already has; cropped with buttons (zoom, move) that
 * a screen reader and a switch can use; sent as picked with its crop box; shown in the avatar's
 * place, which stays the default and the fallback. RNTL v14: every render and press awaited.
 */

const t = en.profilePhoto;
const PICKED = `${CACHE}ImagePicker/profile-1.jpg`;
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);
const SERVED = new Uint8Array([0xff, 0xd8, 0xff, 0xdb, 9, 8, 7]);

function learner(photo: { version: string | null } | null | undefined) {
  const base = me({ consentStatus: 'not-required' }, true, 11);
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
    ...(photo === undefined ? {} : { photo }),
  };
}

const latin1 = (bytes: Uint8Array | null) =>
  bytes ? Array.from(bytes, (b) => String.fromCharCode(b)).join('') : '';

function cropSent(call: Call | undefined) {
  const text = latin1(call?.bytes ?? null);
  const match = text.match(/name="crop"\r\n\r\n([^\r]*)\r\n/);
  return match ? (JSON.parse(match[1] as string) as { x: number; y: number; size: number }) : null;
}

function library(bytes: Uint8Array = JPEG, asset: Record<string, unknown> = {}) {
  files.set(PICKED, bytes);
  imagePicker.launchImageLibraryAsync.mockResolvedValue({
    canceled: false,
    assets: [{ uri: PICKED, mimeType: 'image/jpeg', width: 1200, height: 800, ...asset }],
  });
}

let announce: jest.SpyInstance;
beforeEach(async () => {
  await saveToken('tok');
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
  announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

async function openPicker(screen: Awaited<ReturnType<typeof render>>) {
  await fireEvent.press(await screen.findByRole('button', { name: en.profileLook.open }));
}

describe('the switch', () => {
  it('off: no photo is offered (GET /api/me has no photo), and the avatar stays', async () => {
    for (const off of [undefined, null]) {
      serve({ 'GET /api/me': { json: learner(off) } });
      const screen = await render(<AccountScreen />);
      await openPicker(screen);
      expect(screen.queryByRole('button', { name: t.takePhoto })).toBeNull();
      expect(screen.queryByRole('button', { name: t.chooseFromPhone })).toBeNull();
      expect(screen.queryByTestId('photo-card', { includeHiddenElements: true })).toBeNull();
      await screen.unmount();
    }
  });

  it('on with no photo: offers the camera and the photos, no Remove, and the avatar', async () => {
    serve({ 'GET /api/me': { json: learner({ version: null }) } });
    const screen = await render(<AccountScreen />);
    await openPicker(screen);
    expect(screen.getByRole('button', { name: t.takePhoto })).toBeTruthy();
    expect(screen.getByRole('button', { name: t.chooseFromPhone })).toBeTruthy();
    expect(screen.queryByRole('button', { name: t.remove })).toBeNull();
    const avatar = screen.getByTestId('avatar-card', { includeHiddenElements: true });
    expect(within(avatar).getByText('TM', { includeHiddenElements: true })).toBeTruthy();
  });
});

describe('adding a photo', () => {
  it('crops with buttons, sends the photo with its crop box, then shows it on the card', async () => {
    library();
    const calls = serve({
      'GET /api/me': { json: learner({ version: null }) },
      'POST /api/me/photo': { json: { photo: { version: 'v2' } } },
      'GET /api/me/photo?v=v2': { bytes: SERVED },
    });
    const screen = await render(<AccountScreen />);
    await openPicker(screen);
    await fireEvent.press(screen.getByRole('button', { name: t.chooseFromPhone }));
    expect(await screen.findByText(t.cropTitle)).toBeTruthy();
    // The crop's picture is decoration; its buttons do the work.
    expect(
      screen.getByTestId('photo-crop', { includeHiddenElements: true }).props
        .importantForAccessibility,
    ).toBe('no-hide-descendants');
    const zoomOut = screen.getByRole('button', { name: t.zoomOut });
    expect(zoomOut.props.accessibilityState).toMatchObject({ disabled: true });
    await fireEvent.press(screen.getByRole('button', { name: t.zoomIn }));
    await fireEvent.press(screen.getByRole('button', { name: t.zoomIn }));
    await fireEvent.press(screen.getByRole('button', { name: t.moveRight }));
    await fireEvent.press(screen.getByRole('button', { name: t.moveDown }));
    await fireEvent.press(screen.getByRole('button', { name: t.moveLeft }));
    await fireEvent.press(screen.getByRole('button', { name: t.moveUp }));
    await fireEvent.press(screen.getByRole('button', { name: t.moveRight }));

    await fireEvent.press(screen.getByRole('button', { name: t.save }));
    await waitFor(() => expect(announce).toHaveBeenCalledWith(t.saved));
    const post = calls.find((c) => c.key === 'POST /api/me/photo');
    const expected = cropBox(
      moveCrop(zoomCrop(CENTRED_CROP, 2, 1200, 800), 1, 0, 1200, 800),
      1200,
      800,
    );
    const crop = cropSent(post);
    for (const k of ['x', 'y', 'size'] as const) expect(crop?.[k]).toBeCloseTo(expected[k]);
    const body = latin1(post?.bytes ?? null);
    // The photo as picked, under a fixed name, never the learner's own file name.
    expect(body).toContain('filename="photo.jpg"');
    expect(body).toContain(latin1(JPEG));
    expect(post?.headers['authorization']).toBe('Bearer tok');
    // The app's copy is gone from the phone.
    expect(files.has(PICKED)).toBe(false);
    // The card shows the photo, fetched with the session, from memory.
    const shown = await screen.findByTestId('photo-card', { includeHiddenElements: true });
    expect(shown.props.source).toEqual({ uri: `data:image/jpeg;base64,${base64(SERVED)}` });
    const get = calls.find((c) => c.key === 'GET /api/me/photo?v=v2');
    expect(get?.headers['authorization']).toBe('Bearer tok');
  });

  it('fits the crop window to a narrow screen: no fixed width, a square, positions in % (A2-37)', async () => {
    library();
    serve({ 'GET /api/me': { json: learner({ version: null }) } });
    const screen = await render(<AccountScreen />);
    await openPicker(screen);
    await fireEvent.press(screen.getByRole('button', { name: t.chooseFromPhone }));
    await screen.findByText(t.cropTitle);
    const hidden = { includeHiddenElements: true };
    const viewport = StyleSheet.flatten(
      screen.getByTestId('photo-crop', hidden).props.style,
    ) as Record<string, unknown>;
    // On a 320pt screen a fixed 320pt window ran 32pt past the edge.
    expect(viewport.width).toBe('100%');
    expect(viewport.height).toBeUndefined();
    expect(viewport.aspectRatio).toBe(1);
    expect(viewport.maxWidth).toBeGreaterThan(0);
    const image = StyleSheet.flatten(
      screen.getByTestId('photo-crop-image', hidden).props.style,
    ) as Record<string, unknown>;
    for (const side of ['width', 'height', 'left', 'top'])
      expect(`${side}: ${String(image[side])}`).toMatch(/^\w+: -?\d+(\.\d+)?(e-?\d+)?%$/);
  });

  it('says so when the camera is off, and when the photo is over 2 MB (sending nothing)', async () => {
    imagePicker.requestCameraPermissionsAsync.mockResolvedValue({ granted: false });
    const calls = serve({ 'GET /api/me': { json: learner({ version: null }) } });
    const screen = await render(<AccountScreen />);
    await openPicker(screen);
    await fireEvent.press(screen.getByRole('button', { name: t.takePhoto }));
    expect(await screen.findByText(t.cameraDenied)).toBeTruthy();

    library(new Uint8Array(MAX_PHOTO_BYTES + 1));
    await fireEvent.press(screen.getByRole('button', { name: t.chooseFromPhone }));
    await fireEvent.press(await screen.findByRole('button', { name: t.save }));
    expect(await screen.findByText(t.errors['too-large'])).toBeTruthy();
    expect(calls.some((c) => c.key === 'POST /api/me/photo')).toBe(false);
    expect(files.has(PICKED)).toBe(false);
  });

  it('says why the server refused it', async () => {
    library();
    serve({
      'GET /api/me': { json: learner({ version: null }) },
      'POST /api/me/photo': { status: 400, json: { error: 'upload', detail: 'unreadable' } },
    });
    const screen = await render(<AccountScreen />);
    await openPicker(screen);
    await fireEvent.press(screen.getByRole('button', { name: t.chooseFromPhone }));
    await fireEvent.press(await screen.findByRole('button', { name: t.save }));
    expect(await screen.findByText(t.errors.unreadable)).toBeTruthy();
  });

  it('a HEIC never leaves the phone', async () => {
    library(JPEG, { mimeType: 'image/heic' });
    const calls = serve({ 'GET /api/me': { json: learner({ version: null }) } });
    const screen = await render(<AccountScreen />);
    await openPicker(screen);
    await fireEvent.press(screen.getByRole('button', { name: t.chooseFromPhone }));
    await fireEvent.press(await screen.findByRole('button', { name: t.save }));
    expect(await screen.findByText(t.errors['heic-unsupported'])).toBeTruthy();
    expect(calls.some((c) => c.key === 'POST /api/me/photo')).toBe(false);
  });
});

describe('past matric, at university (the owner’s report, 2026-10-23)', () => {
  it('a first-year adult (school finished, no sticker) can choose and send a photo', async () => {
    library();
    const base = learner({ version: null });
    const calls = serve({
      'GET /api/me': {
        json: {
          ...base,
          account: { ...base.account, dateOfBirth: '2006-02-02' },
          profile: { ...base.profile, grade: 12, schoolFinished: true },
        },
      },
      'POST /api/me/photo': { json: { photo: { version: 'v2' } } },
      'GET /api/me/photo?v=v2': { bytes: SERVED },
    });
    const screen = await render(<AccountScreen />);
    await openPicker(screen);
    const hidden = { includeHiddenElements: true };
    expect(screen.queryByText(en.onboarding.gradeOption(12), hidden)).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: t.chooseFromPhone }));
    await fireEvent.press(await screen.findByRole('button', { name: t.save }));
    await waitFor(() => expect(announce).toHaveBeenCalledWith(t.saved));
    expect(calls.some((c) => c.key === 'POST /api/me/photo')).toBe(true);
    expect(await screen.findByTestId('photo-card', hidden)).toBeTruthy();
  });
});

describe('a photo on the card', () => {
  it('shows it in the avatar’s place; Remove takes it off and the avatar comes back', async () => {
    const calls = serve({
      'GET /api/me': { json: learner({ version: 'v1' }) },
      'GET /api/me/photo?v=v1': { bytes: SERVED },
      'DELETE /api/me/photo': { json: { photo: null } },
    });
    const screen = await render(<AccountScreen />);
    const hidden = { includeHiddenElements: true };
    expect(await screen.findByTestId('photo-card', hidden)).toBeTruthy();
    // Decoration inside the hidden ring: the name is already said.
    const ring = screen.getByTestId('avatar-card', hidden);
    expect(ring.props.importantForAccessibility).toBe('no-hide-descendants');
    expect(within(ring).getByTestId('photo-card', hidden)).toBeTruthy();

    await openPicker(screen);
    await fireEvent.press(screen.getByRole('button', { name: t.remove }));
    await waitFor(() => expect(announce).toHaveBeenCalledWith(t.removed));
    expect(calls.some((c) => c.key === 'DELETE /api/me/photo')).toBe(true);
    expect(screen.queryByTestId('photo-card', hidden)).toBeNull();
    expect(within(screen.getByTestId('avatar-card', hidden)).getByText('TM', hidden)).toBeTruthy();
  });

  it('falls back to the avatar when the photo can’t be fetched', async () => {
    serve({
      'GET /api/me': { json: learner({ version: 'v1' }) },
      'GET /api/me/photo?v=v1': { status: 404, json: { error: 'not-found', detail: null } },
    });
    const screen = await render(<AccountScreen />);
    await openPicker(screen);
    expect(screen.queryByTestId('photo-card', { includeHiddenElements: true })).toBeNull();
  });

  it('moves nothing under Reduce Motion, with a photo', async () => {
    const timing = jest.spyOn(Animated, 'timing');
    serve({
      'GET /api/me': { json: learner({ version: 'v1' }) },
      'GET /api/me/photo?v=v1': { bytes: SERVED },
    });
    const screen = await render(<AccountScreen />);
    await screen.findByTestId('photo-card', { includeHiddenElements: true });
    expect(timing.mock.calls.filter(([, config]) => (config.duration ?? 0) > 0)).toEqual([]);
  });
});

describe('base64', () => {
  it('matches the standard encoding at every padding length (RFC 4648 vectors)', () => {
    const vectors: Array<[string, string]> = [
      ['', ''],
      ['f', 'Zg=='],
      ['fo', 'Zm8='],
      ['foo', 'Zm9v'],
      ['foob', 'Zm9vYg=='],
      ['fooba', 'Zm9vYmE='],
      ['foobar', 'Zm9vYmFy'],
    ];
    for (const [text, encoded] of vectors) expect(base64(utf8(text))).toBe(encoded);
    expect(base64(new Uint8Array([0xff, 0xfe, 0xfd]))).toBe('//79');
  });
});
