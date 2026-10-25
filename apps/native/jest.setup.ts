// @testing-library/react-native v12.4+ registers its matchers automatically.

// The device's secure store, in memory.
jest.mock('expo-secure-store', () => require('./test-utils/secure-store'));

// Every request goes through expo/fetch; tests program it with test-utils/fake-api.
jest.mock('expo/fetch', () => ({ fetch: jest.fn() }));

// Notifications, the pickers and the file system need a phone: in-memory stand-ins
// (test-utils/native-modules.ts), reset before every test.
jest.mock('expo-notifications', () => require('./test-utils/native-modules').notifications);
jest.mock('expo-image-picker', () => require('./test-utils/native-modules').imagePicker);
jest.mock('expo-document-picker', () => require('./test-utils/native-modules').documentPicker);
jest.mock('expo-file-system', () => {
  const { File, Paths } = require('./test-utils/native-modules');
  return { File, Paths };
});
// Read aloud's audio player (the ElevenLabs voice, 2026-10-22), in place of the phone's own
// speech engine (expo-speech, removed): silent, so a test reads what it was asked to play.
jest.mock('expo-audio', () => {
  const { audio } = require('./test-utils/native-modules');
  return {
    createAudioPlayer: audio.createAudioPlayer,
    setAudioModeAsync: audio.setAudioModeAsync,
  };
});
// The icon avatars and the card's "Hello" arc and line (react-native-svg, D6): plain views that
// keep their props (test-utils/svg.tsx).
jest.mock('react-native-svg', () => require('./test-utils/svg'));
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { extra: { eas: { projectId: 'test-project-id' } } } },
}));

// Screens are rendered on their own, outside a navigator.
jest.mock('expo-router', () => {
  const router = { push: jest.fn(), back: jest.fn(), replace: jest.fn() };
  // A mock, so a test can read the options the gate gives the stack (A7-12).
  const Stack = Object.assign(
    jest.fn(() => null),
    { Screen: () => null, Protected: () => null },
  );
  // Screens read their route params from here; a test sets them with mockReturnValue.
  const useLocalSearchParams = jest.fn(() => ({}));
  // Outside a navigator a screen is focused once, when it mounts. `__focusAgain` is the learner
  // coming back to it: every mounted screen's focus effect runs again (call it inside `act`).
  const { useEffect } = require('react');
  type MockEffect = () => undefined | (() => void);
  const focused = new Set<MockEffect>();
  const useFocusEffect = (effect: MockEffect) =>
    useEffect(() => {
      focused.add(effect);
      const cleanup = effect();
      return () => {
        focused.delete(effect);
        cleanup?.();
      };
    }, [effect]);
  const __focusAgain = () => {
    for (const effect of [...focused]) effect();
  };
  return {
    useRouter: () => router,
    useLocalSearchParams,
    useFocusEffect,
    Stack,
    router,
    __focusAgain,
  };
});

beforeEach(() => {
  require('./test-utils/secure-store').items.clear();
  require('./test-utils/native-modules').resetNativeModules();
});

export {};
