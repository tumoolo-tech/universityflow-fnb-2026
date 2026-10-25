import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DATABASE_URL_ENV } from './index';

describe('db', () => {
  it('reads a variable that .env.example documents', () => {
    const example = readFileSync(new URL('../../../.env.example', import.meta.url), 'utf8');
    expect(example).toMatch(new RegExp(`^${DATABASE_URL_ENV}=`, 'm'));
  });
});
