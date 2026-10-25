import 'server-only';
import type { DemoSignupSetting } from '../../demo-signup';
import {
  fakeIdentityVerifier,
  firebaseIdTokenVerifier,
  googleSecureTokenKeys,
  type IdentityVerifier,
} from './identity';

/**
 * The judges' real sign-up (a hackathon exception, docs/deploy/demo.md): the verifier its setting
 * names. One per process, on `globalThis` (gotcha 9), so Google's keys are fetched once and cached
 * across route chunks.
 */
const GLOBAL = globalThis as typeof globalThis & {
  __ufIdentityVerifier?: { key: string; verifier: IdentityVerifier };
};

export function identityVerifier(setting: DemoSignupSetting): IdentityVerifier {
  const key = setting.mode === 'firebase' ? `firebase:${setting.firebase.projectId}` : 'fake';
  if (GLOBAL.__ufIdentityVerifier?.key !== key) {
    const verifier =
      setting.mode === 'firebase'
        ? firebaseIdTokenVerifier({
            projectId: setting.firebase.projectId,
            keys: googleSecureTokenKeys(),
          })
        : fakeIdentityVerifier();
    GLOBAL.__ufIdentityVerifier = { key, verifier };
  }
  return GLOBAL.__ufIdentityVerifier.verifier;
}
