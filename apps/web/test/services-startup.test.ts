import { describe, expect, it } from 'vitest';
import { startupFailure } from '../lib/server/services';

/**
 * When the services can't start (the database can't be reached, its certificate isn't trusted,
 * the learner role can't be used), every page fails and /api/health still answers 200: it never
 * opens the database. The one log line must say enough to fix it on the day (the error's code),
 * and never a message, which can carry personal data (hard rule 4).
 */
describe('startupFailure: the one log line when the services cannot start', () => {
  it('names the error and its code: TLS, network, Postgres and our own', () => {
    const tls = Object.assign(new Error('self-signed certificate in certificate chain'), {
      code: 'SELF_SIGNED_CERT_IN_CHAIN',
    });
    expect(startupFailure(tls)).toBe('services could not start (Error SELF_SIGNED_CERT_IN_CHAIN)');
    const network = Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' });
    expect(startupFailure(network)).toBe('services could not start (Error ECONNREFUSED)');
    const role = Object.assign(new Error('permission denied to set role'), { code: '42501' });
    expect(startupFailure(role)).toBe('services could not start (Error 42501)');
    const ours = Object.assign(new Error('grant uf_app to "postgres" with set true;'), {
      code: 'UF_LEARNER_ROLE',
    });
    expect(startupFailure(ours)).toBe('services could not start (Error UF_LEARNER_ROLE)');
  });

  it('names the causes inside a wrapped error, never their messages (the live demo, 2026-10-24)', () => {
    // The driver wraps the database's own error ("Failed query: …"), so the outer one has no code:
    // the live log said only "services could not start (Error)".
    const db = Object.assign(new Error('password authentication failed for user "postgres.abc"'), {
      code: '28P01',
    });
    const wrapped = new Error('Failed query: select to_regclass(…)', { cause: db });
    expect(startupFailure(wrapped)).toBe('services could not start (Error; caused by Error 28P01)');
    const deeper = new Error('migrate failed', { cause: wrapped });
    expect(startupFailure(deeper)).toBe(
      'services could not start (Error; caused by Error; caused by Error 28P01)',
    );
    const line = startupFailure(
      new Error('outer', { cause: new Error('Tenant or user not found') }),
    );
    expect(line).toBe('services could not start (Error; caused by Error)');
    expect(line).not.toContain('Tenant');
  });

  it('never the message, and no code that isn’t a plain code', () => {
    const line = startupFailure(
      Object.assign(new Error('student 0800000001 not found'), { code: 'not a code 0800000001' }),
    );
    expect(line).toBe('services could not start (Error)');
    expect(startupFailure('boom')).toBe('services could not start (unknown)');
  });
});
