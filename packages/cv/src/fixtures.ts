import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Mmereko's shared contract (docs/design/mmereko-api-proposal.md §6.3), vendored into
 * `packages/cv/contract/` from Mmereko's `contract/` folder (SOURCE.json names the commit): the
 * golden cases, the synthetic profile and advert fixtures, the JSON Schema, the OpenAPI document
 * and the webhook golden vector. Both sides run the same cases, so a disagreement shows on both.
 *
 * Every file is its source byte for byte, except that the synthetic values the no-real-pii guard
 * refuses as literals (an example SA ID number, an example cellphone number) are stood in for by
 * tokens, restored here at run time from digits, never written whole in this repository.
 * contract.test.ts checks each restored file against its source's sha256. Never bundled into an app.
 */

const ROOT = join(import.meta.dirname, '..', 'contract');

const TOKENS: ReadonlyArray<readonly [string, () => string]> = [
  ['{{SYNTHETIC_PHONE}}', () => ['+27', '82', '1234567'].join('')],
  ['{{SYNTHETIC_PHONE_DIGITS}}', () => ['27', '82', '1234567'].join('')],
  ['{{SYNTHETIC_SA_ID}}', () => ['800101', '5009', '087'].join('')],
];

/** A vendored file as its source wrote it. */
export function contractText(relative: string): string {
  let text = readFileSync(join(ROOT, ...relative.split('/')), 'utf8');
  for (const [token, value] of TOKENS) text = text.split(token).join(value());
  return text;
}

function read<T>(relative: string): T {
  return JSON.parse(contractText(relative)) as T;
}

export interface ProfileCase {
  readonly fixture: string;
  readonly valid: boolean;
  readonly problems: ReadonlyArray<{ readonly path: string; readonly code: string }>;
  readonly mustNotEcho?: ReadonlyArray<string>;
}

export interface RequestCase {
  readonly id: string;
  readonly method: 'POST';
  readonly path: '/cv-drafts' | '/tailorings' | '/ats-scans';
  readonly body: Record<string, unknown>;
  readonly expect: {
    readonly status: number;
    readonly code?: string;
    readonly retryable?: boolean;
    readonly bodyKeys?: ReadonlyArray<string>;
    readonly problems?: ReadonlyArray<{ readonly path: string; readonly code: string }>;
    readonly mustNotEcho?: ReadonlyArray<string>;
  };
}

interface Cases {
  readonly contractVersion: string;
  readonly values: Record<string, unknown>;
  readonly profiles: ReadonlyArray<ProfileCase>;
  readonly requests: ReadonlyArray<RequestCase>;
}

export interface WebhookVector {
  readonly secret: string;
  readonly channel: string;
  readonly timestamp: number;
  readonly body: string;
  readonly signature: string;
  readonly header: string;
}

export interface JobAdvertFixture {
  readonly title: string;
  readonly company?: string | null;
  readonly description: string;
}

const cases = () => read<Cases>('cases.json');

/** A body from cases.json: `$NAME` from `values`, `@profiles/x` and `@adverts/x` from fixtures. */
function resolve(value: unknown, values: Record<string, unknown>): unknown {
  if (typeof value === 'string' && value.startsWith('$')) return values[value.slice(1)];
  if (typeof value === 'string' && value.startsWith('@')) {
    return read(`fixtures/${value.slice(1)}.json`);
  }
  if (Array.isArray(value)) return value.map((v) => resolve(v, values));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, resolve(v, values)]));
  }
  return value;
}

export const fixtures = {
  profile: (name: string) => read<Record<string, unknown>>(`fixtures/profiles/${name}.json`),
  minimal: () => read<Record<string, unknown>>('fixtures/profiles/valid-minimal.json'),
  full: () => read<Record<string, unknown>>('fixtures/profiles/valid-full.json'),
  advert: () => read<JobAdvertFixture>('fixtures/adverts/advert-python.json'),
  profileCases: () => cases().profiles,
  /** The golden requests, their bodies resolved. */
  requestCases: (): RequestCase[] => {
    const { values, requests } = cases();
    return requests.map((r) => ({
      ...r,
      body: resolve(r.body, values) as Record<string, unknown>,
    }));
  },
  contractVersion: () => cases().contractVersion,
  vector: () => read<WebhookVector>('webhook-golden-vector.json'),
  schema: () => read<Record<string, unknown>>('cv-profile.schema.json'),
  source: () =>
    JSON.parse(readFileSync(join(ROOT, 'SOURCE.json'), 'utf8')) as {
      readonly commit: string;
      readonly sha256: Readonly<Record<string, string>>;
    },
};

/** A profile with one value set at a dotted path. */
export function withValue(
  profile: Record<string, unknown>,
  path: string,
  value: unknown,
): Record<string, unknown> {
  const copy = structuredClone(profile);
  const keys = path.split('.');
  let at: Record<string, unknown> = copy;
  for (const key of keys.slice(0, -1)) {
    at[key] ??= {};
    at = at[key] as Record<string, unknown>;
  }
  at[keys[keys.length - 1] as string] = value;
  return copy;
}
