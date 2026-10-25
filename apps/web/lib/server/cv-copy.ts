import 'server-only';
import { cv, planMaps } from '@universityflow/content';
import { CV_SHARE_DAYS } from '@universityflow/db';

/**
 * My CV's words for the browser, as plain strings (the launch standard: a client component
 * receives its copy as props, and a prop must be serialisable). A sentence that takes values is
 * sent as a template with `{0}`, `{1}` in their places, made by calling the content's own function
 * with those markers, so the words stay packages/content's (hard rule 8); the client fills them
 * with `fill` (lib/client/fill.ts), as My plan maps does.
 */

type Words<T> = {
  readonly [K in keyof T]: T[K] extends (...args: never[]) => string
    ? string
    : T[K] extends string
      ? string
      : Words<T[K]>;
};

const MARKERS = ['{0}', '{1}', '{2}'] as const;

function asTemplates<T extends object>(value: T): Words<T> {
  return Object.fromEntries(
    Object.entries(value).map(([key, v]) => [
      key,
      typeof v === 'function'
        ? (v as (...args: unknown[]) => string)(...MARKERS)
        : typeof v === 'object' && v !== null
          ? asTemplates(v)
          : v,
    ]),
  ) as Words<T>;
}

// The share page's words are the public page's, and the version is the server's: not the page's.
const { share: _share, optInVersion: _version, ...words } = cv;

export type CvCopy = Words<typeof words> & {
  /** The crisis card's words when a save needs care (D3, as My plan maps and About me). */
  readonly care: typeof planMaps.care;
  /** The share link's lengths to choose from, in days, and the one chosen at first (§9.3). */
  readonly shareDays: ReadonlyArray<number>;
  readonly shareDefault: number;
};

/** Every word the page uses, and the share link's choices. */
export function cvCopy(): CvCopy {
  return {
    ...asTemplates(words),
    care: planMaps.care,
    shareDays: [CV_SHARE_DAYS.min, 14, CV_SHARE_DAYS.default, 60, CV_SHARE_DAYS.max],
    shareDefault: CV_SHARE_DAYS.default,
  };
}
