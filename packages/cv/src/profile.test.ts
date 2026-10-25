import { describe, expect, it } from 'vitest';
import { fixtures, withValue } from './fixtures';
import { CV_SCHEMA_VERSION } from './limits';
import { jsonPointer, validateCvProfile } from './profile';

/**
 * `uf-cv-profile/1` beyond the golden cases (contract.test.ts runs those): the version both sides
 * send, the per-section caps, the ID number first when a text would match both rules, and paths
 * as JSON pointers. A refusal never repeats the value it refused.
 */

describe('uf-cv-profile/1 (§3)', () => {
  it('sends the version both sides agree on, and takes any 1.x', () => {
    expect(fixtures.full()['schemaVersion']).toBe(CV_SCHEMA_VERSION);
    expect(
      validateCvProfile(withValue(fixtures.minimal(), 'schemaVersion', 'uf-cv-profile/1.7')),
    ).toMatchObject({ ok: true });
  });

  it('caps a section at 40 entries', () => {
    const many = Array.from({ length: 41 }, (_, i) => ({ name: `Skill ${i}` }));
    expect(validateCvProfile(withValue(fixtures.minimal(), 'skills', many))).toEqual({
      ok: false,
      issues: [{ path: '/skills', code: 'too_many' }],
    });
  });

  it('calls a 13-digit shape after "ID" an ID number, once, and never repeats it', () => {
    const id = ['8', '0', '0', '1', '0', '1', '5', '0', '0', '9', '0', '8', '7'].join('');
    const check = validateCvProfile(withValue(fixtures.minimal(), 'basics.summary', `ID ${id}`));
    expect(check).toEqual({ ok: false, issues: [{ path: '/basics/summary', code: 'id_number' }] });
    expect(JSON.stringify(check)).not.toContain(id);
  });

  it('refuses a link to a private name as well as localhost and IP addresses', () => {
    const profile = withValue(fixtures.minimal(), 'basics.profiles', [
      { network: 'Site', url: 'https://printer.local/cv' },
    ]);
    expect(validateCvProfile(profile)).toEqual({
      ok: false,
      issues: [{ path: '/basics/profiles/0/url', code: 'url_host' }],
    });
  });

  it('writes paths as JSON pointers', () => {
    expect(jsonPointer(['projects', 0, 'a/b~c'])).toBe('/projects/0/a~1b~0c');
    expect(jsonPointer([])).toBe('');
  });
});
