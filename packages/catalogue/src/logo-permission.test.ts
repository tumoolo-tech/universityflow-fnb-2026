import { mkdirSync, mkdtempSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { RAW_CATALOGUE } from './catalogue';
import { RAW_COLLEGES } from './colleges-catalogue';
import {
  LOGO_ROOTS,
  type LogoPermission,
  logoFindings,
  logoPermissionSchema,
  logoWebPath,
} from './logo-permission';
import { universitySchema } from './records';

/**
 * University logos (the owner's decision, option A, 2026-10-23): a neutral mark everywhere, and a
 * real logo only where the university agreed in writing. The agreement is `logoPermission` on the
 * university's record; no logo file may ship without one, and no record may name a file that
 * isn't there. The naming convention is in docs/brand/logo-permissions.md.
 */

const PERMISSION: LogoPermission = {
  grantedBy: 'Synthetic Marketing Office',
  grantedOn: '2026-11-02',
  evidenceUrl: 'https://example.org/permissions/synthetic-letter.pdf',
  asset: 'apps/web/public/logos/wits.png',
};

const WITS = RAW_CATALOGUE.universities.find((u) => u.id === 'wits');
if (!WITS) throw new Error('Wits is in the catalogue');
const withPermission = { ...WITS, logoPermission: PERMISSION };

describe('logoPermissionSchema', () => {
  it('accepts who agreed, when, a link to the written permission and the logo file', () => {
    expect(logoPermissionSchema.safeParse(PERMISSION).success).toBe(true);
  });

  it.each([
    ['no one named', { grantedBy: ' ' }],
    ['a date that is not ISO', { grantedOn: '2 November 2026' }],
    ['evidence over plain http', { evidenceUrl: 'http://example.org/letter.pdf' }],
    ['a logo outside apps/web/public/logos', { asset: 'apps/web/public/wits.png' }],
    ['an SVG (the app cannot draw one yet)', { asset: 'apps/web/public/logos/wits.svg' }],
    ['a file not named by an institution id', { asset: 'apps/web/public/logos/Wits Logo.png' }],
  ])('refuses %s', (_label, change) => {
    expect(logoPermissionSchema.safeParse({ ...PERMISSION, ...change }).success).toBe(false);
  });

  it('refuses a permission with a field missing', () => {
    const { evidenceUrl: _omitted, ...rest } = PERMISSION;
    expect(logoPermissionSchema.safeParse(rest).success).toBe(false);
  });
});

describe('a university record and its logo permission', () => {
  it('is optional: no university has one today, so none shows a logo', () => {
    expect(universitySchema.safeParse(WITS).success).toBe(true);
    expect(RAW_CATALOGUE.universities.filter((u) => u.logoPermission)).toEqual([]);
  });

  it("validates when present and names the university's own file", () => {
    expect(universitySchema.safeParse(withPermission).success).toBe(true);
  });

  it("refuses a permission whose file is another university's", () => {
    const wrong = {
      ...withPermission,
      logoPermission: { ...PERMISSION, asset: 'apps/web/public/logos/uct.png' },
    };
    expect(universitySchema.safeParse(wrong).success).toBe(false);
  });
});

describe('logoWebPath', () => {
  it('serves a logo from the web app at /logos/<id>.<ext>', () => {
    expect(logoWebPath(PERMISSION)).toBe('/logos/wits.png');
  });
});

describe('logoFindings', () => {
  const none = RAW_CATALOGUE.universities;

  it('finds nothing in a tree with no logos', () => {
    expect(logoFindings(['apps/web/app/icon.png', 'apps/native/assets/icon.png'], none)).toEqual(
      [],
    );
  });

  it.each(LOGO_ROOTS)('fails a logo under %s whose university has no permission', (root) => {
    const file = `${root}/logos/wits.png`;
    expect(logoFindings([file], none)).toEqual([
      { file, message: 'wits has no logoPermission: no logo may ship without written permission' },
    ]);
  });

  it('fails a file in a logos folder not named by an institution id', () => {
    const file = 'apps/web/public/logos/university-crest.webp';
    expect(logoFindings([file], none)).toEqual([
      { file, message: 'a file in a logos folder must be named <institutionId>.png or .webp' },
    ]);
  });

  it.each([
    'apps/native/assets/wits-logo.png',
    'apps/web/public/images/UKZN.svg',
    'packages/catalogue/assets/uct_crest.jpg',
    'apps/web/public/coat-of-arms.png',
    'apps/native/assets/emblem.webp',
  ])('fails %s, which looks like a university logo outside logos/', (file) => {
    expect(logoFindings([file], none)).toEqual([
      {
        file,
        message:
          'this looks like a university logo: logos live only at apps/web/public/logos/<institutionId>.png, with a logoPermission',
      },
    ]);
  });

  it('allows the one file a permission names', () => {
    expect(logoFindings([PERMISSION.asset], [withPermission])).toEqual([]);
  });

  it('fails a second copy of a permitted logo elsewhere', () => {
    const file = 'apps/native/assets/logos/wits.png';
    expect(logoFindings([PERMISSION.asset, file], [withPermission])).toEqual([
      { file, message: `wits's logoPermission names ${PERMISSION.asset}, not this file` },
    ]);
  });

  it('fails a permission that names a file that is not there', () => {
    expect(logoFindings([], [withPermission])).toEqual([
      {
        file: 'packages/catalogue/src/data/wits.ts',
        message: `wits's logoPermission names ${PERMISSION.asset}, which does not exist`,
      },
    ]);
  });

  // The judge demo's logos (the owner's decision of 2026-10-23, for the hackathon only): one web
  // folder, named by institution id, shown only when the demo's switch is on. Remove after.
  it.each([
    'apps/web/public/demo-logos/wits.svg',
    'apps/web/public/demo-logos/ukzn.webp',
    'apps/web/public/demo-logos/uj.png',
    'apps/web/public/demo-logos/up.webp',
  ])('allows the judge demo its logo %s', (file) => {
    expect(logoFindings([file], none)).toEqual([]);
  });

  it('fails a demo logo not named by an institution id', () => {
    const file = 'apps/web/public/demo-logos/university-crest.svg';
    expect(logoFindings([file], none)).toEqual([
      { file, message: 'a demo logo must be named <institutionId>.svg, .png or .webp' },
    ]);
  });

  it('fails a demo-logos folder anywhere but the web app', () => {
    const file = 'apps/native/assets/demo-logos/wits.png';
    expect(logoFindings([file], none)).toHaveLength(1);
  });

  // The judge demo's public TVET college logos (planning.md §19.1, the same exception): one
  // subfolder, each named by a college id the catalogue holds. Remove after the hackathon.
  it.each([
    'apps/web/public/demo-logos/colleges/boland.webp',
    'apps/web/public/demo-logos/colleges/false-bay.svg',
  ])('allows the judge demo its college logo %s', (file) => {
    expect(logoFindings([file], none, ['boland', 'false-bay'])).toEqual([]);
  });

  it('fails a demo college logo not named by a college id the catalogue holds', () => {
    const file = 'apps/web/public/demo-logos/colleges/fake-college.webp';
    expect(logoFindings([file], none, ['boland'])).toEqual([
      { file, message: 'a demo college logo must be named <collegeId>.svg, .png or .webp' },
    ]);
    const jpeg = 'apps/web/public/demo-logos/colleges/boland.jpg';
    expect(logoFindings([jpeg], none, ['boland'])).toHaveLength(1);
  });

  it('fails a college logo anywhere but the demo’s college folder', () => {
    const file = 'apps/web/public/images/colleges/boland.webp';
    expect(logoFindings([file], none, ['boland'])).toEqual([
      { file, message: 'a college logo ships only from apps/web/public/demo-logos/colleges/' },
    ]);
  });

  // The judge demo's bursary funders' logos (the owner, 2026-10-25; the same exception): one
  // subfolder, each named by a bursary id the catalogue holds. Remove after the hackathon.
  it.each([
    'apps/web/public/demo-logos/funders/sasol.webp',
    'apps/web/public/demo-logos/funders/allan-gray-orbis.svg',
  ])('allows the judge demo its funder logo %s', (file) => {
    expect(logoFindings([file], none, [], ['sasol', 'allan-gray-orbis'])).toEqual([]);
  });

  it('fails a demo funder logo not named by a bursary id the catalogue holds', () => {
    const file = 'apps/web/public/demo-logos/funders/fake-funder.webp';
    expect(logoFindings([file], none, [], ['sasol'])).toEqual([
      { file, message: 'a demo funder logo must be named <bursaryId>.svg, .png or .webp' },
    ]);
    const jpeg = 'apps/web/public/demo-logos/funders/sasol.jpg';
    expect(logoFindings([jpeg], none, [], ['sasol'])).toHaveLength(1);
  });

  it('ignores files outside the folders a logo could ship from', () => {
    expect(logoFindings(['docs/brand/wits-logo.png'], none)).toEqual([]);
  });
});

/** Every file under the folders a logo could ship from, repo-relative with forward slashes. */
function shippedFiles(repo: string): string[] {
  const files: string[] = [];
  const walk = (dir: string) => {
    let names: string[];
    try {
      names = readdirSync(dir);
    } catch {
      return;
    }
    for (const name of names) {
      if (name === 'node_modules') continue;
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else files.push(relative(repo, path).split('\\').join('/'));
    }
  };
  for (const root of LOGO_ROOTS) walk(join(repo, root));
  return files;
}

describe('the repository (the real scan)', () => {
  const repo = fileURLToPath(new URL('../../..', import.meta.url));

  it('catches a logo planted in a copy of the tree (the scan proven on a broken example)', () => {
    const tree = mkdtempSync(join(tmpdir(), 'uf-logos-'));
    try {
      mkdirSync(join(tree, 'apps/web/public/logos'), { recursive: true });
      writeFileSync(join(tree, 'apps/web/public/logos/wits.png'), 'not a real logo');
      mkdirSync(join(tree, 'apps/native/assets'), { recursive: true });
      writeFileSync(join(tree, 'apps/native/assets/uj-crest.png'), 'not a real logo');
      expect(logoFindings(shippedFiles(tree), RAW_CATALOGUE.universities)).toHaveLength(2);
    } finally {
      rmSync(tree, { recursive: true, force: true });
    }
  });

  it('ships no logo without a permission, and every permission has its logo', () => {
    const files = shippedFiles(repo);
    // The scan reaches the app's real assets, so an empty list can't pass by walking nothing.
    expect(files).toContain('apps/native/assets/icon.png');
    expect(files).toContain('apps/web/public/demo-logos/colleges/boland.webp');
    expect(files).toContain('apps/web/public/demo-logos/funders/sasol.webp');
    expect(
      logoFindings(
        files,
        RAW_CATALOGUE.universities,
        RAW_COLLEGES.colleges.map((c) => c.id),
        (RAW_CATALOGUE.bursaries ?? []).map((b) => b.id),
      ),
    ).toEqual([]);
  });
});
