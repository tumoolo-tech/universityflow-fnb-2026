import { en } from '@universityflow/content/app';
import { tokens } from '@universityflow/tokens';
import config, { BLOCKED_ANDROID_PERMISSIONS, BRAND, CANVAS, PERMISSIONS } from '../app.config';

/**
 * app.config.ts can't import the workspace packages (the Expo CLI reads it outside Metro), so it
 * mirrors them. These tests keep the copies honest, and check what the stores will read.
 */

type Plugin = string | [string, Record<string, unknown>];
const plugin = (name: string) =>
  (config.plugins as Plugin[]).find((p) => (Array.isArray(p) ? p[0] : p) === name);
const options = (name: string) => {
  const found = plugin(name);
  return Array.isArray(found) ? found[1] : {};
};

describe('app.config.ts', () => {
  it('uses the tokens’ colours and the content’s words', () => {
    expect(BRAND).toBe(tokens.color.brand);
    expect(CANVAS).toBe(tokens.color.canvas);
    expect(PERMISSIONS).toEqual(en.permissions);
    expect(options('expo-image-picker')).toMatchObject({
      cameraPermission: en.permissions.camera,
      photosPermission: en.permissions.photos,
      microphonePermission: false,
    });
  });

  it('Read aloud’s audio player only plays, in the foreground: no microphone, no background audio (2026-10-22)', () => {
    expect(options('expo-audio')).toEqual({
      microphonePermission: false,
      recordAudioAndroid: false,
      enableBackgroundRecording: false,
      enableBackgroundPlayback: false,
    });
    // The phone's own voice is gone with expo-speech.
    expect(plugin('expo-speech')).toBeUndefined();
  });

  it('the camera and photos purpose strings name every document the app photographs (A7-14)', () => {
    // The app takes or picks photos of a school report (upload), a proof of registration
    // (My modules) and, since A1-33, an offer letter (Offers).
    for (const purpose of [PERMISSIONS.camera, PERMISSIONS.photos]) {
      expect(purpose).toMatch(/school report/);
      expect(purpose).toMatch(/proof of registration/);
      expect(purpose).toMatch(/offer letter/);
    }
  });

  it('the camera and photos purpose strings also name the profile photo, a photo of yourself (A7-23)', () => {
    // About me takes a profile photo with the same camera and photo library (lib/photo.ts):
    // App Store 5.1.1 wants the purpose string to name every use, not only documents.
    for (const purpose of [PERMISSIONS.camera, PERMISSIONS.photos]) {
      expect(purpose).toMatch(/of yourself/);
      expect(purpose).toMatch(/profile/);
      expect(purpose).toMatch(/document/);
      // Still only when the learner chooses.
      expect(purpose).toMatch(/only when you choose/);
    }
  });

  it('declares no export-controlled encryption and no tracking', () => {
    expect(config.ios?.infoPlist?.['ITSAppUsesNonExemptEncryption']).toBe(false);
    expect(config.ios?.config?.usesNonExemptEncryption).toBe(false);
    expect(config.ios?.privacyManifests?.NSPrivacyTracking).toBe(false);
    expect(config.ios?.privacyManifests?.NSPrivacyTrackingDomains).toEqual([]);
  });

  it('blocks every Android permission the app doesn’t use, and none it does', () => {
    const blocked = config.android?.blockedPermissions ?? [];
    expect(blocked).toEqual([...BLOCKED_ANDROID_PERMISSIONS]);
    for (const needed of [
      'android.permission.CAMERA',
      'android.permission.POST_NOTIFICATIONS',
      'android.permission.INTERNET',
    ]) {
      expect(blocked).not.toContain(needed);
    }
    expect(blocked).toContain('android.permission.RECORD_AUDIO');
    expect(blocked).toContain('com.google.android.gms.permission.AD_ID');
  });

  it('has the identifiers, the version, and an icon, splash and notification icon that exist', () => {
    expect(config.ios?.bundleIdentifier).toBe('tech.tumoolo.universityflow');
    expect(config.android?.package).toBe('tech.tumoolo.universityflow');
    expect(config.version).toMatch(/^\d+\.\d+\.\d+$/);
    // Build numbers come from EAS (remote, auto-incremented), never typed here.
    expect(config.ios?.buildNumber).toBeUndefined();
    expect(config.android?.versionCode).toBeUndefined();
    expect(config.icon).toBe('./assets/icon.png');
    expect(options('expo-splash-screen')).toMatchObject({ backgroundColor: CANVAS });
    expect(options('expo-notifications')).toMatchObject({ color: BRAND });
    // Each file must exist: require fails on a missing asset.
    expect(() => require('../assets/icon.png')).not.toThrow();
    expect(() => require('../assets/adaptive-icon.png')).not.toThrow();
    expect(() => require('../assets/splash-icon.png')).not.toThrow();
    expect(() => require('../assets/notification-icon.png')).not.toThrow();
  });

  it('takes the EAS project id from the environment only when set', () => {
    expect(config.extra?.['eas']).toBeUndefined();
  });

  it('asks for no Face ID purpose string: the app never uses biometrics (A7-08)', () => {
    // expo-secure-store adds its own generic Face ID sentence unless told not to; `false`
    // deletes NSFaceIDUsageDescription from the resolved Info.plist.
    expect(options('expo-secure-store')).toMatchObject({ faceIDPermission: false });
  });
});

/** Evaluates app.config.ts afresh, as the Expo CLI would on a build with this environment. */
function configFor(env: Record<string, string | undefined>): typeof config {
  const keys = [
    'EAS_BUILD_PROFILE',
    'EXPO_PUBLIC_UF_API_URL',
    'UF_EAS_PROJECT_ID',
    ...Object.keys(env),
  ];
  const saved = new Map(keys.map((k) => [k, process.env[k]]));
  for (const k of keys) delete process.env[k];
  for (const [k, v] of Object.entries(env)) if (v !== undefined) process.env[k] = v;
  try {
    let loaded: typeof config | undefined;
    jest.isolateModules(() => {
      loaded = (require('../app.config') as { default: typeof config }).default;
    });
    return loaded as typeof config;
  } finally {
    for (const [k, v] of saved) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

describe('a store build refuses a missing or plain-http API URL (A7-05)', () => {
  it.each(['production', 'preview'])('fails the %s build when the URL is unset', (profile) => {
    expect(() => configFor({ EAS_BUILD_PROFILE: profile })).toThrow(/EXPO_PUBLIC_UF_API_URL/);
    expect(() => configFor({ EAS_BUILD_PROFILE: profile, EXPO_PUBLIC_UF_API_URL: ' ' })).toThrow(
      /EXPO_PUBLIC_UF_API_URL/,
    );
  });

  it.each(['production', 'preview'])('fails the %s build on anything but https', (profile) => {
    for (const url of ['http://app.example.org', 'not a url', 'ftp://app.example.org']) {
      expect(() => configFor({ EAS_BUILD_PROFILE: profile, EXPO_PUBLIC_UF_API_URL: url })).toThrow(
        /https/,
      );
    }
  });

  it('builds with an https URL, and leaves development (and the Expo CLI) alone', () => {
    expect(() =>
      configFor({
        EAS_BUILD_PROFILE: 'production',
        EXPO_PUBLIC_UF_API_URL: 'https://app.example.org',
        UF_EAS_PROJECT_ID: PROJECT_ID,
      }),
    ).not.toThrow();
    expect(() =>
      configFor({ EAS_BUILD_PROFILE: 'development', UF_EAS_PROJECT_ID: PROJECT_ID }),
    ).not.toThrow();
    expect(() => configFor({})).not.toThrow();
  });
});

/** A synthetic EAS project id (a UUID, as `eas init` prints). Not a secret. */
const PROJECT_ID = '00000000-0000-4000-8000-0000000000e1';

describe('every EAS build names its EAS project (A7-21)', () => {
  it.each(['development', 'preview', 'production'])(
    'the %s build fails at once, saying how, when UF_EAS_PROJECT_ID is missing',
    (profile) => {
      const env = { EAS_BUILD_PROFILE: profile, EXPO_PUBLIC_UF_API_URL: 'https://app.example.org' };
      expect(() => configFor(env)).toThrow(/UF_EAS_PROJECT_ID is not set .*eas init/);
      expect(() => configFor({ ...env, UF_EAS_PROJECT_ID: ' ' })).toThrow(/UF_EAS_PROJECT_ID/);
      expect(() => configFor({ ...env, UF_EAS_PROJECT_ID: 'my-project' })).toThrow(
        /UF_EAS_PROJECT_ID must be the project's id/,
      );
      expect(configFor({ ...env, UF_EAS_PROJECT_ID: PROJECT_ID }).extra?.['eas']).toEqual({
        projectId: PROJECT_ID,
      });
    },
  );

  it('local tooling (expo start, expo config, eas init) needs no project id', () => {
    expect(() => configFor({})).not.toThrow();
    expect(configFor({}).extra?.['eas']).toBeUndefined();
  });
});

describe('iOS refuses cleartext outside development (A7-07)', () => {
  const https = 'https://app.example.org';

  it.each(['production', 'preview'])('the %s build allows no arbitrary loads', (profile) => {
    const built = configFor({
      EAS_BUILD_PROFILE: profile,
      EXPO_PUBLIC_UF_API_URL: https,
      UF_EAS_PROJECT_ID: PROJECT_ID,
    });
    expect(built.ios?.infoPlist?.['NSAppTransportSecurity']).toEqual({
      NSAllowsArbitraryLoads: false,
    });
  });

  it('development keeps Expo’s default, which lets the simulator reach http://localhost', () => {
    expect(
      configFor({ EAS_BUILD_PROFILE: 'development', UF_EAS_PROJECT_ID: PROJECT_ID }).ios
        ?.infoPlist?.['NSAppTransportSecurity'],
    ).toBeUndefined();
    expect(configFor({}).ios?.infoPlist?.['NSAppTransportSecurity']).toBeUndefined();
  });
});

describe('eas.json', () => {
  const eas = require('../eas.json') as {
    cli: { appVersionSource: string };
    build: Record<
      string,
      {
        environment?: string;
        distribution?: string;
        autoIncrement?: boolean;
        developmentClient?: boolean;
        android?: { buildType?: string };
        env?: Record<string, string>;
      }
    >;
  };

  it('has development, preview and production builds; production goes to the stores', () => {
    expect(Object.keys(eas.build)).toEqual(
      expect.arrayContaining(['development', 'preview', 'production']),
    );
    expect(eas.build['production']).toMatchObject({
      distribution: 'store',
      environment: 'production',
      autoIncrement: true,
    });
    // Build numbers live in EAS, raised on every production build.
    expect(eas.cli.appVersionSource).toBe('remote');
  });

  it('development is a dev client for phones: internal, an Android APK, Debug (A7-22)', () => {
    // Without `developmentClient` a development build has no launcher: on a phone it can find no
    // bundle to load and shows only a red screen (docs/store/android-dev-build.md).
    expect(eas.build['development']).toMatchObject({
      developmentClient: true,
      distribution: 'internal',
      environment: 'development',
      android: { buildType: 'apk' },
    });
    // Preview is a release build to install by hand; production goes to Play as an app bundle.
    expect(eas.build['preview']).toMatchObject({
      distribution: 'internal',
      environment: 'preview',
      android: { buildType: 'apk' },
    });
    expect(eas.build['preview']?.developmentClient).toBeUndefined();
    expect(eas.build['production']).toMatchObject({ android: { buildType: 'app-bundle' } });
    expect(eas.build['production']?.developmentClient).toBeUndefined();
  });

  it('never bakes an API URL into a profile: each comes from its EAS environment', () => {
    // EXPO_PUBLIC_UF_API_URL is set per environment at expo.dev. A preview or production build
    // with it missing or not https fails in app.config.ts (tested above), and a release app
    // that somehow has a bad value says so (lib/api.ts), never "you're offline".
    for (const profile of Object.values(eas.build)) {
      expect(profile.env?.['EXPO_PUBLIC_UF_API_URL']).toBeUndefined();
    }
  });
});

describe('native modules at the versions Expo SDK 57 was built with', () => {
  /**
   * CLAUDE.md's pins, held on purpose below what this Expo release lists (react-native 0.86.3,
   * jest-expo ~57.0.5): `expo install --check` and expo-doctor report these two, and only these.
   */
  const PINNED: Record<string, string> = { 'react-native': '0.86.2', 'jest-expo': '57.0.4' };

  /** `~1.2.3` (same minor, patch at least 3) or an exact `1.2.3`: the forms Expo's list uses. */
  function satisfies(version: string, range: string) {
    const parse = (v: string) => v.replace(/^[~^]/, '').split('.').map(Number);
    const [major, minor, patch] = parse(version);
    const [wantMajor, wantMinor, wantPatch] = parse(range);
    if (!range.startsWith('~')) return version === range;
    return major === wantMajor && minor === wantMinor && (patch ?? 0) >= (wantPatch ?? 0);
  }

  it('the proof: the range check reads Expo’s forms', () => {
    expect(satisfies('57.0.20', '~57.0.20')).toBe(true);
    expect(satisfies('57.0.23', '~57.0.15')).toBe(true);
    expect(satisfies('57.0.14', '~57.0.15')).toBe(false);
    expect(satisfies('57.1.0', '~57.0.15')).toBe(false);
    expect(satisfies('15.15.4', '15.15.4')).toBe(true);
    expect(satisfies('15.15.5', '15.15.4')).toBe(false);
  });

  it('every installed native dependency is in Expo’s range, and the pins are exact', () => {
    const bundled = require('expo/bundledNativeModules.json') as Record<string, string>;
    const pkg = require('../package.json') as {
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
    };
    const names = [...Object.keys(pkg.dependencies), ...Object.keys(pkg.devDependencies)].filter(
      (name) => bundled[name] !== undefined,
    );
    expect(names.length).toBeGreaterThan(15);
    const off = names.flatMap((name) => {
      const installed = (require(`${name}/package.json`) as { version: string }).version;
      const want = PINNED[name] ?? (bundled[name] as string);
      return satisfies(installed, want) ? [] : [`${name}@${installed}, want ${want}`];
    });
    expect(off).toEqual([]);
  });
});
