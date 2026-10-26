import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildCsp } from '../lib/csp';
import { DEFAULT_MMEREKO_APP_URL, mmerekoFrameOrigin } from '../lib/mmereko-canvas';
import { readConfig } from '../lib/server/config';
import { mmerekoCanvasFor } from '../lib/server/cv-mmereko';
import { proxy } from '../proxy';

/**
 * "Open Mmereko" on My CV (the owner's decision of 2026-10-24): the switch
 * `UF_CV_MMEREKO_CANVAS=1` (off by default, only with `UF_CV=1`), Mmereko's address
 * `MMEREKO_APP_URL` (an https origin), who may see it (18 or over by their confirmed date of
 * birth, or at university: never an under-18 school learner), and the CSP that may frame
 * Mmereko on /cv only.
 */

const DEMO = {
  NODE_ENV: 'production',
  VERCEL_ENV: 'production',
  UF_DEPLOYMENT: 'demo',
  UF_DEMO_PROJECT: '1',
  UF_PROVIDERS: 'local',
  AUTH_SECRET: 'd'.repeat(48),
  DATABASE_URL: 'postgres://demo@demo-db.example/uf?sslmode=verify-full',
  UF_DEMO_DATABASE: 'synthetic',
};
const LIVE: Record<string, string | undefined> = {
  UF_PUBLIC_URL: 'https://universityflow.example',
  VERCEL_ENV: 'production',
  UF_PROVIDERS: 'live',
  AUTH_SECRET: 'x'.repeat(48),
  DATABASE_URL: 'postgres://user@db.example/uf',
  UF_S3_BUCKET: 'uf-documents-test',
  UF_SMS_PROVIDER: 'test-provider',
  UF_JOBS_PROVIDER: 'test-jobs',
  ANTHROPIC_API_KEY: 'test-key-not-real',
  UF_CV: '1',
  UF_CV_PROVIDER: 'mmereko',
  MMEREKO_API_URL: 'https://partner.mmereko.example/partner/v1',
  MMEREKO_CLIENT_ID: 'uf-production',
  MMEREKO_CLIENT_SECRET: 'c'.repeat(48),
  MMEREKO_WEBHOOK_SECRET: 'w'.repeat(48),
  MMEREKO_REGION: 'af-south-1',
};
const ADAPTERS = {
  sms: ['test-provider'],
  jobs: ['test-jobs'],
  cv: ['mmereko'],
  inbound: { sms: ['test-provider'] },
};

describe('readConfig: UF_CV_MMEREKO_CANVAS', () => {
  it('is off by default, and on only for exactly 1 with My CV on', () => {
    expect(readConfig({}).mmerekoCanvas).toBeNull();
    expect(readConfig({ UF_CV: '1' }).mmerekoCanvas).toBeNull();
    expect(readConfig({ UF_CV: '1', UF_CV_MMEREKO_CANVAS: '1' }).mmerekoCanvas).toEqual({
      origin: DEFAULT_MMEREKO_APP_URL,
      loginUrl: `${DEFAULT_MMEREKO_APP_URL}/login`,
      siteUrl: `${DEFAULT_MMEREKO_APP_URL}/`,
    });
    expect(() => readConfig({ UF_CV: '1', UF_CV_MMEREKO_CANVAS: 'true' })).toThrow(
      /UF_CV_MMEREKO_CANVAS must be 1/,
    );
  });

  it('is refused without UF_CV=1: the canvas lives on My CV', () => {
    expect(() => readConfig({ UF_CV_MMEREKO_CANVAS: '1' })).toThrow(
      /UF_CV_MMEREKO_CANVAS.*UF_CV=1/,
    );
  });

  it('takes MMEREKO_APP_URL as an https origin only', () => {
    const on = { UF_CV: '1', UF_CV_MMEREKO_CANVAS: '1' };
    expect(
      readConfig({ ...on, MMEREKO_APP_URL: 'https://cv.mmereko.example/' }).mmerekoCanvas,
    ).toMatchObject({
      origin: 'https://cv.mmereko.example',
      loginUrl: 'https://cv.mmereko.example/login',
    });
    for (const bad of [
      'http://mmereko.tumoolo.tech',
      'https://mmereko.tumoolo.tech/login',
      'https://mmereko.tumoolo.tech/?from=uf',
      'https://mmereko.tumoolo.tech/#x',
      'https://user:pass@mmereko.tumoolo.tech',
      'https://localhost',
      'javascript:alert(1)',
      'not a url',
    ]) {
      expect(() => readConfig({ ...on, MMEREKO_APP_URL: bad }), bad).toThrow(/MMEREKO_APP_URL/);
    }
  });

  it('may run on the judge demo, beside My CV on the stand-in (it calls nothing on the server)', () => {
    expect(
      readConfig({ ...DEMO, UF_CV: '1', UF_CV_MMEREKO_CANVAS: '1' }).mmerekoCanvas?.origin,
    ).toBe(DEFAULT_MMEREKO_APP_URL);
  });

  it('may run in production once My CV may (the owner’s choice; the privacy page names it)', () => {
    const config = readConfig(
      { ...LIVE, UF_CV_MMEREKO_CANVAS: '1' },
      ADAPTERS,
      new Date('2026-10-24T08:00:00Z'),
      { namesCv: true },
    );
    expect(config.mmerekoCanvas?.origin).toBe(DEFAULT_MMEREKO_APP_URL);
  });
});

describe('mmerekoCanvasFor: 18 or over, or at university', () => {
  // 08:00 in Johannesburg on 24 October 2026.
  const now = new Date('2026-10-24T06:00:00Z');

  it('is 18 exactly on the birthday, by South African time', () => {
    expect(mmerekoCanvasFor({ dateOfBirth: '2008-10-24' }, 'grade-11', now)).toBe(true);
    // 23:59 on the 23rd in Johannesburg: still 17.
    expect(
      mmerekoCanvasFor({ dateOfBirth: '2008-10-24' }, 'matric', new Date('2026-10-23T21:59:00Z')),
    ).toBe(false);
    // Midnight in Johannesburg: 18.
    expect(
      mmerekoCanvasFor({ dateOfBirth: '2008-10-24' }, 'matric', new Date('2026-10-23T22:00:00Z')),
    ).toBe(true);
  });

  it('is never a school learner under 18, or one with no confirmed date of birth', () => {
    expect(mmerekoCanvasFor({ dateOfBirth: '2008-10-25' }, 'matric', now)).toBe(false);
    expect(mmerekoCanvasFor({ dateOfBirth: '2010-03-03' }, 'grade-11', now)).toBe(false);
    expect(mmerekoCanvasFor({ dateOfBirth: '2012-01-01' }, 'grade-10', now)).toBe(false);
    expect(mmerekoCanvasFor({ dateOfBirth: null }, 'grade-11', now)).toBe(false);
  });

  it('is any learner at university, whatever their age', () => {
    expect(mmerekoCanvasFor({ dateOfBirth: '2009-06-01' }, 'university', now)).toBe(true);
    expect(mmerekoCanvasFor({ dateOfBirth: '2000-01-15' }, 'university', now)).toBe(true);
    expect(mmerekoCanvasFor({ dateOfBirth: null }, 'university', now)).toBe(true);
  });
});

/**
 * A5-28 (Phase 6 audit): a policy belongs to the document a visit started on, and a click to My CV
 * (next/link) keeps it. With Mmereko's origin on /cv alone, the frame was refused after any click
 * from another page (seen in a browser, 2026-10-25). So every page carries it while the switch is on.
 */
describe('the CSP: Mmereko may be framed from every page, only with the switch on', () => {
  afterEach(() => vi.unstubAllEnvs());

  function csp(path: string): string {
    const response = proxy(new NextRequest(`http://localhost:3000${path}`));
    return response.headers.get('content-security-policy') ?? '';
  }
  function stub(env: Record<string, string>) {
    for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value);
  }
  const ON = { UF_CV: '1', UF_CV_MMEREKO_CANVAS: '1' };

  it('buildCsp adds Mmereko’s origin to frame-src, and nothing else changes', () => {
    const plain = buildCsp({ nonce: 'n', dev: false });
    const wide = buildCsp({ nonce: 'n', dev: false, mmerekoOrigin: DEFAULT_MMEREKO_APP_URL });
    expect(wide).toContain(`frame-src 'self' ${DEFAULT_MMEREKO_APP_URL}`);
    expect(wide.replace(`; frame-src 'self' ${DEFAULT_MMEREKO_APP_URL}`, '')).toBe(plain);
    // With the demo's Firebase frame too (never on the same page today), both are kept.
    expect(
      buildCsp({
        nonce: 'n',
        dev: false,
        mmerekoOrigin: DEFAULT_MMEREKO_APP_URL,
        firebaseAuthDomain: 'uf-demo-test.firebaseapp.com',
      }),
    ).toContain(`frame-src 'self' https://uf-demo-test.firebaseapp.com ${DEFAULT_MMEREKO_APP_URL}`);
  });

  it.each(['/cv', '/', '/home', '/chat', '/me', '/privacy'])(
    'frames Mmereko from %s, so a click to My CV keeps it',
    (path) => {
      stub(ON);
      expect(csp(path)).toContain(`frame-src 'self' ${DEFAULT_MMEREKO_APP_URL}`);
    },
  );

  it.each(['/cv', '/home'])(
    'never frames it with the switch off, or with My CV off (%s)',
    (path) => {
      stub({ UF_CV: '1' });
      expect(csp(path)).not.toContain('frame-src');
      vi.unstubAllEnvs();
      stub({ UF_CV_MMEREKO_CANVAS: '1' });
      expect(csp(path)).not.toContain('frame-src');
      vi.unstubAllEnvs();
      stub({ ...ON, MMEREKO_APP_URL: 'http://mmereko.example' });
      expect(csp(path)).not.toContain('frame-src');
    },
  );

  it('mmerekoFrameOrigin names the configured origin, wherever the visit is', () => {
    expect(mmerekoFrameOrigin({ ...ON, MMEREKO_APP_URL: 'https://cv.mmereko.example' })).toBe(
      'https://cv.mmereko.example',
    );
    expect(mmerekoFrameOrigin({ UF_CV: '1' })).toBeNull();
  });
});
