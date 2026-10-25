/**
 * "Open Mmereko" on My CV (the owner's decision of 2026-10-24): Mmereko's own site, in a canvas over
 * the page, for a learner 18 or over or at university. A separate service with its own account:
 * UniversityFlow sends it nothing (no query, no message, no prefill). This is an extra door beside
 * My CV's partner engine, which stays exactly as it is (docs/design/mmereko-api-proposal.md).
 *
 * Off unless `UF_CV_MMEREKO_CANVAS=1` (with `UF_CV=1`: the canvas lives on /cv). `MMEREKO_APP_URL`
 * names Mmereko's site, an https origin, by default https://mmereko.tumoolo.tech.
 *
 * No `server-only` and Web APIs only: the proxy (the CSP's `frame-src` on /cv) and the server both
 * read this file. `readConfig` decides where the switch may run.
 */

/** The one page the canvas is on, and the only page whose CSP may frame Mmereko. */
export const MMEREKO_CANVAS_PATH = '/cv';

export const DEFAULT_MMEREKO_APP_URL = 'https://mmereko.tumoolo.tech';

/** The variables the canvas reads (documented in .env.example). */
export const MMEREKO_CANVAS_VARIABLES = ['UF_CV_MMEREKO_CANVAS', 'MMEREKO_APP_URL'] as const;

/**
 * The frame's sandbox: Mmereko's own scripts, forms and storage on its own origin; popups (its
 * sign-in) that may leave the sandbox; downloads (a CV file); storage access on a tap. Nothing
 * else: no top navigation, so Mmereko can never move UniversityFlow's page.
 */
export const MMEREKO_FRAME_SANDBOX = [
  'allow-scripts',
  'allow-forms',
  'allow-same-origin',
  'allow-popups',
  'allow-popups-to-escape-sandbox',
  'allow-downloads',
  'allow-storage-access-by-user-activation',
].join(' ');

/** Features the frame may use: copying a CV's text, nothing more (no camera, microphone, place). */
export const MMEREKO_FRAME_ALLOW = 'clipboard-write';

export interface MmerekoCanvasSetting {
  /** Mmereko's site, e.g. https://mmereko.tumoolo.tech (no path, no trailing slash). */
  readonly origin: string;
  /** Where the canvas opens: its sign-in page, with no query, ever. */
  readonly loginUrl: string;
  /** Linked from the canvas's bar. Mmereko has no privacy page yet, so its site. */
  readonly siteUrl: string;
}

export class MmerekoCanvasConfigError extends Error {
  override readonly name = 'MmerekoCanvasConfigError';
}

const LOCAL_HOSTS = ['localhost', '127.0.0.1', '[::1]'];

/** `MMEREKO_APP_URL` as an https origin: no credentials, path, query or fragment, not this machine. */
export function readMmerekoOrigin(env: Record<string, string | undefined>): string {
  const value = env['MMEREKO_APP_URL']?.trim() || DEFAULT_MMEREKO_APP_URL;
  const refuse = () =>
    new MmerekoCanvasConfigError(
      'MMEREKO_APP_URL must be Mmereko’s https address alone (no path, query or localhost), such as https://mmereko.tumoolo.tech',
    );
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw refuse();
  }
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== '/' ||
    LOCAL_HOSTS.includes(url.hostname)
  ) {
    throw refuse();
  }
  return url.origin;
}

/**
 * The canvas's setting, or null while it is off. Throws `MmerekoCanvasConfigError` for a switch
 * that isn't exactly 1 or a bad URL: never a canvas that half works. Says nothing about where it
 * may run, or about `UF_CV`: `readConfig` decides that.
 */
export function readMmerekoCanvas(
  env: Record<string, string | undefined>,
): MmerekoCanvasSetting | null {
  const value = env['UF_CV_MMEREKO_CANVAS']?.trim() ?? '';
  if (value === '') return null;
  if (value !== '1') {
    throw new MmerekoCanvasConfigError('UF_CV_MMEREKO_CANVAS must be 1, or unset');
  }
  const origin = readMmerekoOrigin(env);
  return { origin, loginUrl: `${origin}/login`, siteUrl: `${origin}/` };
}

/**
 * For the proxy: Mmereko's origin when the page is /cv, My CV is on and the canvas is on; null
 * everywhere else, and for a setting `readConfig` would refuse (the page is refused anyway).
 */
export function mmerekoFrameOrigin(
  env: Record<string, string | undefined>,
  pathname: string,
): string | null {
  if (pathname !== MMEREKO_CANVAS_PATH || env['UF_CV'] !== '1') return null;
  try {
    return readMmerekoCanvas(env)?.origin ?? null;
  } catch {
    return null;
  }
}
