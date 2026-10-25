import { CV_LIMITS } from './limits';

/**
 * The text rules of `uf-cv-profile/1` that both sides enforce (docs/design/mmereko-api-proposal.md
 * §3.2), each with a test here and one on Mmereko's side.
 */

/**
 * Whether free text holds what looks like an ID number or a student number (audit A11-17): 13
 * digits in a row, perhaps grouped by single spaces or hyphens (an SA ID number's shape), or a run
 * of 7 or more digits shortly after a word that names a number. The same rule as packages/db's
 * `holdsPersonalNumber` and migration 0021's `uf_holds_personal_number` (a db test holds them
 * equal), kept here so this package needs no database.
 */
export function holdsPersonalNumber(text: string): boolean {
  return holdsIdNumber(text) || holdsStudentNumber(text);
}

/** An SA ID number's shape: 13 digits, perhaps grouped by single spaces or hyphens (`id_number`). */
export function holdsIdNumber(text: string): boolean {
  return /\d(?:[ -]?\d){12}/.test(text);
}

/** A run of 7 or more digits shortly after a word that names a number (`student_number`). */
export function holdsStudentNumber(text: string): boolean {
  return /\b(?:student|applicant|application|reference|ref|id|identity|passport|no|nr|number|num)\b\D{0,12}\d{7,}/i.test(
    text,
  );
}

/**
 * Plain text: no control characters (a tab or a line break aside) and nothing that reads as an
 * HTML tag or comment. Mmereko escapes every string before it reaches its renderer (§7.4); this
 * keeps markup out of what we store and send in the first place. `<` before a space or a digit
 * ("5 < 7") is ordinary text.
 */
export function isPlainText(text: string): boolean {
  // biome-ignore lint/suspicious/noControlCharactersInRegex: the control characters are the point
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text)) return false;
  return !/<[A-Za-z!/?]/.test(text);
}

export type LinkProblem =
  | 'invalid'
  | 'too-long'
  | 'not-https'
  | 'credentials'
  | 'ip-host'
  | 'private-host';

/**
 * Why an evidence or profile link can't go on a CV, or null when it can: `https:` only, at most
 * 500 characters, no user name or password in it, a named host (never an IP address) that isn't
 * this machine or a private network name. Neither side ever fetches it (D10): it is printed as a
 * link, so there is no server-side request to forge; the rules keep it a public link all the same.
 */
export function safeLinkProblem(url: string): LinkProblem | null {
  if (url.length > CV_LIMITS.url) return 'too-long';
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return 'invalid';
  }
  if (parsed.protocol !== 'https:') return 'not-https';
  if (parsed.username || parsed.password) return 'credentials';
  // A fully qualified name may end in a dot and still name the same host (`localhost.`): the
  // checks read it without (CV-A5 A5-20).
  const host = parsed.hostname.toLowerCase().replace(/\.+$/, '');
  if (host === '') return 'invalid';
  if (host.startsWith('[') || /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || /^\d+$/.test(host)) {
    return 'ip-host';
  }
  if (
    !host.includes('.') ||
    host === 'localhost' ||
    /\.(localhost|local|internal|lan|home|corp|intranet)$/.test(host)
  ) {
    return 'private-host';
  }
  return null;
}

/** An e-mail address the learner typed on the CV page (D9). */
export function isEmail(value: string): boolean {
  return value.length <= 120 && /^[^\s@<>()]+@[^\s@<>()]+\.[A-Za-z]{2,}$/.test(value);
}

/**
 * A phone number the learner typed on the CV page (D9), never the account's sign-in phone: digits,
 * spaces, brackets, hyphens and a leading +, 9 to 12 digits in all. Never anything an ID-number
 * check would catch.
 */
export function isContactPhone(value: string): boolean {
  if (!/^\+?[0-9 ()-]{9,20}$/.test(value)) return false;
  const digits = value.replace(/\D/g, '').length;
  return digits >= 9 && digits <= 12 && !holdsPersonalNumber(value);
}
