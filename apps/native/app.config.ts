import type { ExpoConfig } from 'expo/config';

/**
 * Expo config, ready for the stores (Phase 4d). The owner submits; docs/store/ says how.
 *
 * This file is evaluated by the Expo CLI outside Metro, so it cannot import workspace
 * TypeScript. Every colour and every sentence here mirrors packages/tokens and packages/content,
 * and __tests__/app-config.test.ts fails if they drift apart.
 *
 * **Versions.** `version` is the version people see (1.0.0 for the first store release), raised
 * by hand for each release. The build numbers (iOS `buildNumber`, Android `versionCode`) are
 * not set here: EAS keeps them and raises them on every production build (eas.json:
 * `appVersionSource: remote`, `autoIncrement`), so no two uploads can collide.
 */

/** packages/tokens: color.brand, color.canvas. */
export const BRAND = '#C99BB8'; // check-ignore: mirrors tokens.color.brand (tested)
export const CANVAS = '#0E0D10'; // check-ignore: mirrors tokens.color.canvas (tested)

/** packages/content: en.permissions. Shown by iOS when the app asks. */
export const PERMISSIONS = {
  camera:
    'UniversityFlow uses the camera only when you choose to take a photo: of a document to upload, such as your school report, offer letter or proof of registration, or of yourself, if you add a profile photo.',
  photos:
    'UniversityFlow opens your photos only when you choose a picture: of a document to upload, such as your school report, offer letter or proof of registration, or of yourself, if you add a profile photo.',
} as const;

/**
 * Android permissions nothing in the app needs, blocked so no library can add them. The camera
 * (taking a photo of a report), notifications and the network are all the app uses. The photo
 * and document pickers use the system pickers, which need no media permission. (The image
 * picker's own READ/WRITE_EXTERNAL_STORAGE, limited to Android 12 and older, are left alone:
 * blocking them is untested on such a phone, and they grant nothing on Android 13+.)
 */
export const BLOCKED_ANDROID_PERMISSIONS = [
  'android.permission.RECORD_AUDIO',
  'android.permission.READ_MEDIA_IMAGES',
  'android.permission.READ_MEDIA_VIDEO',
  'android.permission.READ_MEDIA_AUDIO',
  'android.permission.READ_MEDIA_VISUAL_USER_SELECTED',
  'android.permission.ACCESS_FINE_LOCATION',
  'android.permission.ACCESS_COARSE_LOCATION',
  'android.permission.ACCESS_BACKGROUND_LOCATION',
  'android.permission.READ_CONTACTS',
  'android.permission.READ_PHONE_STATE',
  'android.permission.SYSTEM_ALERT_WINDOW',
  'com.google.android.gms.permission.AD_ID',
] as const;

/** Set by the owner after `eas init` (an EAS project id is not a secret). */
const projectId = process.env['UF_EAS_PROJECT_ID'];

/** The EAS profile being built (eas.json), or undefined for `expo start` and local tooling. */
const profile = process.env['EAS_BUILD_PROFILE'];

/** Profiles that reach a phone other than a developer's: they must talk https to a real server. */
const RELEASE_PROFILES = ['preview', 'production'];
const isRelease = profile !== undefined && RELEASE_PROFILES.includes(profile);

/**
 * A7-05: a store or preview build must fail here, not ship an app that says "you're offline" on
 * every screen. EAS evaluates this file with the profile's environment (eas.json `environment`),
 * the same values Metro then inlines as EXPO_PUBLIC_UF_API_URL. lib/config.ts makes the same
 * check at run time, for any build this one misses.
 */
if (isRelease) {
  const raw = process.env['EXPO_PUBLIC_UF_API_URL']?.trim();
  if (!raw) {
    throw new Error(
      `EXPO_PUBLIC_UF_API_URL is not set for the "${profile}" build. Set it in that EAS environment.`,
    );
  }
  let protocol: string | null = null;
  try {
    protocol = new URL(raw).protocol;
  } catch {
    // Not a URL: reported below.
  }
  if (protocol !== 'https:') {
    throw new Error(`EXPO_PUBLIC_UF_API_URL must be an https:// URL for the "${profile}" build.`);
  }
}

/**
 * A7-21: every EAS build (any profile) names its EAS project. Without it EAS asks to write the id
 * into this file, which it cannot (the file is code), and push tokens can't be made. Local tooling
 * (`expo start`, `expo config`, `eas init` itself) sets no profile and needs none.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
if (profile !== undefined) {
  if (!projectId?.trim()) {
    throw new Error(
      `UF_EAS_PROJECT_ID is not set for the "${profile}" build. Run \`eas init\` in apps/native, then set the id it prints in your shell and in the "${profile}" EAS environment (docs/store/android-dev-build.md).`,
    );
  }
  if (!UUID.test(projectId.trim())) {
    throw new Error(
      `UF_EAS_PROJECT_ID must be the project's id (a UUID, as \`eas init\` prints it), for the "${profile}" build.`,
    );
  }
}

const config: ExpoConfig = {
  name: 'UniversityFlow',
  slug: 'universityflow',
  version: '1.0.0',
  orientation: 'portrait',
  scheme: 'universityflow',
  // Placeholder artwork until the owner's own (scripts/assets/generate-app-icons.mjs).
  icon: './assets/icon.png',
  // SDK 57 runs the New Architecture unconditionally (the `newArchEnabled` flag is gone).
  // Every native dependency must be Fabric-compatible: audit A8 checks it before one is added.

  ios: {
    // Phones only: an iPad build would need its own screenshots and review, for no learner gain.
    supportsTablet: false,
    bundleIdentifier: 'tech.tumoolo.universityflow',
    config: { usesNonExemptEncryption: false },
    infoPlist: {
      // HTTPS only, which is exempt: no export-compliance paperwork per build.
      ITSAppUsesNonExemptEncryption: false,
      // A7-07: a release build refuses cleartext, as Android's does (gotcha 27). Development
      // keeps Expo's default, so the simulator can reach the web app on http://localhost.
      ...(isRelease ? { NSAppTransportSecurity: { NSAllowsArbitraryLoads: false } } : {}),
    },
    privacyManifests: {
      NSPrivacyTracking: false,
      NSPrivacyTrackingDomains: [],
      // Required-reason APIs React Native and Expo use (Apple's reasons, for the app itself).
      NSPrivacyAccessedAPITypes: [
        {
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryUserDefaults',
          NSPrivacyAccessedAPITypeReasons: ['CA92.1'],
        },
        {
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryFileTimestamp',
          NSPrivacyAccessedAPITypeReasons: ['C617.1'],
        },
        {
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategorySystemBootTime',
          NSPrivacyAccessedAPITypeReasons: ['35F9.1'],
        },
        {
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryDiskSpace',
          NSPrivacyAccessedAPITypeReasons: ['E174.1'],
        },
      ],
    },
  },

  android: {
    package: 'tech.tumoolo.universityflow',
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: BRAND,
    },
    blockedPermissions: [...BLOCKED_ANDROID_PERMISSIONS],
    // SDK 57 enables edge-to-edge unconditionally, so safe-area handling is mandatory.
  },

  plugins: [
    'expo-router',
    // Also keeps the session out of Android's cloud backups. No Face ID purpose string: the app
    // never uses biometrics (A7-08).
    ['expo-secure-store', { faceIDPermission: false }],
    [
      'expo-splash-screen',
      {
        image: './assets/splash-icon.png',
        imageWidth: 200,
        resizeMode: 'contain',
        backgroundColor: CANVAS,
      },
    ],
    [
      'expo-notifications',
      {
        icon: './assets/notification-icon.png',
        color: BRAND,
        // Apple's push environment: production for store builds (EAS names the profile).
        mode: profile === 'production' ? 'production' : 'development',
        // Remote notifications only; nothing runs in the background.
        enableBackgroundRemoteNotifications: false,
      },
    ],
    // Read aloud's ElevenLabs voice (owner's choice of 2026-10-22): playback only, while the app
    // is open. No microphone purpose string or RECORD_AUDIO (still blocked above), no background
    // audio mode for the store reviewers to ask about.
    [
      'expo-audio',
      {
        microphonePermission: false,
        recordAudioAndroid: false,
        enableBackgroundRecording: false,
        enableBackgroundPlayback: false,
      },
    ],
    [
      'expo-image-picker',
      {
        cameraPermission: PERMISSIONS.camera,
        photosPermission: PERMISSIONS.photos,
        // Photos only: never the microphone.
        microphonePermission: false,
      },
    ],
  ],

  experiments: {
    typedRoutes: true,
  },

  ...(projectId?.trim() ? { extra: { eas: { projectId: projectId.trim() } } } : {}),
};

export default config;
