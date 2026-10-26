import { z } from 'zod';
import type { University } from './records';

/**
 * A university's written permission to show its logo (the owner's decision, option A,
 * 2026-10-23; planning.md §8.3). Every university is shown with UniversityFlow's own neutral mark
 * (`packages/ui` university-mark.ts); its real logo shows only once this record exists. None
 * does today. Only a person adds one, from the university's written reply (docs/brand/logo-permissions.md).
 *
 * The convention a logo file follows, so a scan can hold it (logo-permission.test.ts):
 * - It lives at `apps/web/public/logos/<universityId>.png` (or `.webp`), served at
 *   `/logos/<universityId>.png`; the phone app loads that same URL from the web app. PNG or WebP
 *   only: the app can't draw an SVG yet.
 * - Nothing else under `LOGO_ROOTS` may be, or look like, a university logo: a `logos` folder
 *   anywhere there, or a file whose name has a university's id or short name or a word like
 *   "logo", "crest" or "emblem" in it.
 */

/** The folders a logo could ship from: the web's public files, the app's assets, the catalogue's. */
export const LOGO_ROOTS = ['apps/web/public', 'apps/native/assets', 'packages/catalogue/assets'];

const LOGO_FILE = /^apps\/web\/public\/logos\/([a-z]+)\.(png|webp)$/;

/**
 * The one exception: the judge demo's logos (the owner's decision of 2026-10-23, for the FNB
 * hackathon only; apps/web/lib/demo-logos.ts). Files here are named `<institutionId>.svg|png|webp`
 * and show only on the demo's own build. Remove the folder and this exception after the hackathon.
 */
export const DEMO_LOGO_DIR = 'apps/web/public/demo-logos';

/**
 * The same exception for the public TVET colleges (planning.md §19.1, 2026-10-24): files named
 * `<collegeId>.svg|png|webp`, each a college the catalogue holds. Remove with the folder above.
 */
export const DEMO_COLLEGE_LOGO_DIR = 'apps/web/public/demo-logos/colleges';

/**
 * The same exception for the bursary funders (the owner, 2026-10-25): files named
 * `<bursaryId>.svg|png|webp`, each a bursary the catalogue holds. Remove with the folder above.
 */
export const DEMO_FUNDER_LOGO_DIR = 'apps/web/public/demo-logos/funders';

export const logoPermissionSchema = z.object({
  /** Who agreed: the office (and, if they signed, the person's role), as the letter gives it. */
  grantedBy: z.string().trim().min(2),
  /** The date of the written permission (ISO, YYYY-MM-DD). */
  grantedOn: z.iso.date(),
  /** Where the written permission is kept: a link a reviewer can open. HTTPS only. */
  evidenceUrl: z.url({ protocol: /^https$/ }),
  /** The logo file, repo-relative: `apps/web/public/logos/<universityId>.png` or `.webp`. */
  asset: z.string().regex(LOGO_FILE, 'apps/web/public/logos/<universityId>.png or .webp'),
});
export type LogoPermission = z.infer<typeof logoPermissionSchema>;

/** The university id a logo file is named by (the schema has already held its shape). */
export function logoAssetId(asset: string): string | undefined {
  return LOGO_FILE.exec(asset)?.[1];
}

/** Where the web app serves a permitted logo: `/logos/<universityId>.<ext>`. */
export function logoWebPath(permission: LogoPermission): string {
  return permission.asset.slice('apps/web/public'.length);
}

export interface LogoFinding {
  readonly file: string;
  readonly message: string;
}

const LOGO_WORDS = new Set(['logo', 'logos', 'crest', 'emblem', 'arms', 'seal', 'coat']);

type LogoHolder = Pick<University, 'id' | 'shortName' | 'logoPermission'>;

/** What is wrong with a file in a `logos` folder, if anything. */
function logosFolderProblem(
  file: string,
  base: string,
  byId: ReadonlyMap<string, LogoHolder>,
): string | undefined {
  const id = /^([a-z]+)\.(png|webp)$/.exec(base)?.[1];
  const university = id === undefined ? undefined : byId.get(id);
  if (!university) return 'a file in a logos folder must be named <institutionId>.png or .webp';
  const asset = university.logoPermission?.asset;
  if (asset === undefined) {
    return `${university.id} has no logoPermission: no logo may ship without written permission`;
  }
  return asset === file
    ? undefined
    : `${university.id}'s logoPermission names ${asset}, not this file`;
}

/**
 * What is wrong with the logos in a tree: `files` are repo-relative paths with forward slashes.
 * Empty when every logo file is the one a permission names and every permission's file exists.
 */
export function logoFindings(
  files: ReadonlyArray<string>,
  universities: ReadonlyArray<LogoHolder>,
  /** The public TVET colleges' ids (`RAW_COLLEGES`): a file named by one is a college logo. */
  collegeIds: ReadonlyArray<string> = [],
  /** The bursaries' ids (`RAW_CATALOGUE.bursaries`): a funder's demo logo is named by one. */
  funderIds: ReadonlyArray<string> = [],
): LogoFinding[] {
  const findings: LogoFinding[] = [];
  const byId = new Map(universities.map((u) => [u.id as string, u]));
  const names = new Set(universities.flatMap((u) => [u.id, u.shortName.toLowerCase()]));
  const shipped = files.filter((f) => LOGO_ROOTS.some((root) => f.startsWith(`${root}/`)));

  for (const file of shipped) {
    const slash = file.lastIndexOf('/');
    const base = file.slice(slash + 1);
    const stem = base.replace(/\.[^.]*$/, '');
    if (file.slice(0, slash) === DEMO_FUNDER_LOGO_DIR) {
      const id = /^([a-z0-9-]+)\.(svg|png|webp)$/.exec(base)?.[1];
      if (id === undefined || !funderIds.includes(id)) {
        findings.push({
          file,
          message: 'a demo funder logo must be named <bursaryId>.svg, .png or .webp',
        });
      }
      continue;
    }
    if (file.slice(0, slash) === DEMO_COLLEGE_LOGO_DIR) {
      const id = /^([a-z0-9-]+)\.(svg|png|webp)$/.exec(base)?.[1];
      if (id === undefined || !collegeIds.includes(id)) {
        findings.push({
          file,
          message: 'a demo college logo must be named <collegeId>.svg, .png or .webp',
        });
      }
      continue;
    }
    if (collegeIds.includes(stem)) {
      findings.push({
        file,
        message: `a college logo ships only from ${DEMO_COLLEGE_LOGO_DIR}/`,
      });
      continue;
    }
    if (file.slice(0, slash) === DEMO_LOGO_DIR) {
      const id = /^([a-z]+)\.(svg|png|webp)$/.exec(base)?.[1];
      if (id === undefined || !byId.has(id)) {
        findings.push({
          file,
          message: 'a demo logo must be named <institutionId>.svg, .png or .webp',
        });
      }
      continue;
    }
    if (file.slice(0, slash).split('/').includes('logos')) {
      const message = logosFolderProblem(file, base, byId);
      if (message) findings.push({ file, message });
      continue;
    }
    const words = base
      .toLowerCase()
      .replace(/\.[^.]*$/, '')
      .split(/[^a-z0-9]+/);
    if (words.some((w) => LOGO_WORDS.has(w) || names.has(w))) {
      findings.push({
        file,
        message:
          'this looks like a university logo: logos live only at apps/web/public/logos/<institutionId>.png, with a logoPermission',
      });
    }
  }

  for (const university of universities) {
    const asset = university.logoPermission?.asset;
    if (asset !== undefined && !files.includes(asset)) {
      findings.push({
        file: `packages/catalogue/src/data/${university.id}.ts`,
        message: `${university.id}'s logoPermission names ${asset}, which does not exist`,
      });
    }
  }
  return findings;
}
