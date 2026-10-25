import { describe, expect, it } from 'vitest';
import {
  IdentityTokenError,
  type IdentityVerifier,
  type VerifiedIdentity,
} from '../lib/server/demo/identity';

/**
 * What every identity verifier behind the judge demo's real sign-up must do (D8: an interface, a
 * fake and a contract test). The Firebase verifier and the fake both run it.
 */
export function identityVerifierContract(
  name: string,
  setup: () => Promise<{
    verifier: IdentityVerifier;
    /** A token the verifier must accept for `identity`. */
    mint: (identity: VerifiedIdentity) => Promise<string>;
  }>,
): void {
  describe(`identity verifier contract: ${name}`, () => {
    const who = { uid: 'contract-uid-1', email: 'contract@example.com' };

    it('accepts a good token and returns exactly the uid and the email', async () => {
      const { verifier, mint } = await setup();
      expect(await verifier.verify(await mint(who))).toEqual(who);
    });

    it('tells two people apart', async () => {
      const { verifier, mint } = await setup();
      const other = { uid: 'contract-uid-2', email: 'other@example.com' };
      expect(await verifier.verify(await mint(other))).toEqual(other);
    });

    it.each(['', 'not-a-token', 'a.b.c', 'x'.repeat(10_000)])(
      'refuses %j with an IdentityTokenError',
      async (token) => {
        const { verifier } = await setup();
        await expect(verifier.verify(token)).rejects.toBeInstanceOf(IdentityTokenError);
      },
    );
  });
}
