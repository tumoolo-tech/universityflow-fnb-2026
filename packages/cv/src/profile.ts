import { z } from 'zod';
// Bundled with the code, never read from disk (bundled.test.ts): Next builds this into the server.
import schema from '../contract/cv-profile.schema.json';
import { holdsIdNumber, holdsStudentNumber, safeLinkProblem } from './text';

/**
 * `uf-cv-profile/1` (docs/design/mmereko-api-proposal.md §3), exactly as Mmereko's shared
 * contract defines it (packages/cv/contract/cv-profile.schema.json, vendored with its golden
 * cases): JSON Resume-compatible where it fits, `x`-prefixed fields where JSON Resume has none.
 *
 * Every object is strict: a field this version doesn't name is refused (`unknown_field`, at its
 * parent's path, never by name), so nothing extra (a date of birth, an ID number, a photo, a
 * reference's details, §3.1) can ride along. Beyond the schema, as Mmereko does: no ID-number
 * (`id_number`) or student-number (`student_number`) shape in any text, and no link to an IP
 * address, localhost or a private name (`url_host`). Text is plain text: HTML or Markdown in a
 * field isn't refused, Mmereko escapes it and it prints as typed. A refusal names a JSON-pointer
 * path and a code, never the value (`validateCvProfile`).
 */

/** The path codes both sides use (Mmereko's contract README, "Problems"). */
export const PROFILE_PROBLEMS = [
  'required',
  'wrong_type',
  'too_long',
  'too_short',
  'too_many',
  'too_few',
  'invalid_format',
  'invalid_value',
  'out_of_range',
  'unknown_field',
  'duplicate',
  'id_number',
  'student_number',
  'url_host',
  'schema_version',
] as const;
export type ProfileProblem = (typeof PROFILE_PROBLEMS)[number];

/** No ID-number or student-number shape (A11-17), the ID number first when both would match. */
function personalNumbers(value: string, ctx: z.RefinementCtx) {
  if (holdsIdNumber(value)) ctx.addIssue({ code: 'custom', message: 'id_number' });
  else if (holdsStudentNumber(value)) ctx.addIssue({ code: 'custom', message: 'student_number' });
}

/** A string of at most `max` characters, refused if it holds an ID or student number. */
const text = (max: number, min = 0) => {
  const base = z.string({ message: 'wrong_type' }).max(max, { message: 'too_long' });
  return (min > 0 ? base.min(min, { message: 'too_short' }) : base).superRefine(personalNumbers);
};
const nullableText = (max: number) => text(max).nullable().optional();

/** An https link to a public host, printed, never fetched (D10). */
export const cvLink = z
  .string({ message: 'wrong_type' })
  .max(500, { message: 'too_long' })
  .regex(/^https:\/\/[^\s@/?#\\]+([/?#]\S*)?$/, { message: 'invalid_format' })
  .superRefine((url, ctx) => {
    const problem = safeLinkProblem(url);
    if (problem === 'ip-host' || problem === 'private-host') {
      ctx.addIssue({ code: 'custom', message: 'url_host' });
    }
  });

/** `YYYY-MM` or `YYYY` (§3.1), or null. */
export const cvDate = z
  .string({ message: 'wrong_type' })
  .regex(/^[0-9]{4}(-(0[1-9]|1[0-2]))?$/, { message: 'invalid_format' })
  .nullable()
  .optional();

const list = <T extends z.ZodType>(item: T, max: number) =>
  z.array(item, { message: 'wrong_type' }).max(max, { message: 'too_many' }).optional();

const name = text(80, 1);
const title = text(120);
const short = nullableText(80);
const description = nullableText(600);
const highlights = list(text(200), 5);
const keywords = list(text(40), 15);
const object = <T extends z.ZodRawShape>(shape: T) =>
  z.strictObject(shape, { message: 'wrong_type' });

const roleSection = list(
  object({
    name: title.optional(),
    organization: title.optional(),
    position: title.optional(),
    url: cvLink.optional(),
    startDate: cvDate,
    endDate: cvDate,
    summary: description,
    highlights,
  }),
  40,
);

const basics = object({
  name,
  label: nullableText(120),
  email: z
    .string({ message: 'wrong_type' })
    .max(120, { message: 'too_long' })
    .regex(/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/, { message: 'invalid_format' })
    .superRefine(personalNumbers)
    .nullable()
    .optional(),
  phone: z
    .string({ message: 'wrong_type' })
    .regex(/^\+?[0-9 ()-]{7,20}$/, { message: 'invalid_format' })
    .superRefine((value, ctx) => {
      if (holdsIdNumber(value)) ctx.addIssue({ code: 'custom', message: 'id_number' });
    })
    .nullable()
    .optional(),
  summary: description,
  location: object({
    city: short,
    region: short,
    countryCode: z
      .string({ message: 'wrong_type' })
      .regex(/^[A-Z]{2}$/, { message: 'invalid_format' })
      .optional(),
  }).optional(),
  profiles: list(object({ network: short, username: short, url: cvLink }), 10),
});

const education = object({
  institution: title,
  area: title.optional(),
  studyType: title.optional(),
  startDate: cvDate,
  endDate: cvDate,
  score: short,
  courses: list(title, 40),
  xModules: list(
    object({
      code: text(20).optional(),
      name: title,
      year: z
        .number({ message: 'wrong_type' })
        .int({ message: 'wrong_type' })
        .min(1900, { message: 'out_of_range' })
        .max(2200, { message: 'out_of_range' })
        .optional(),
      term: nullableText(20),
      credits: z
        .number({ message: 'wrong_type' })
        .min(0, { message: 'out_of_range' })
        .max(1000, { message: 'out_of_range' })
        .nullable()
        .optional(),
      result: nullableText(20),
    }),
    40,
  ),
  xSubjects: list(object({ name: title, result: nullableText(20) }), 40),
  xSource: text(40).optional(),
});

export const cvProfileSchema = object({
  /** `uf-cv-profile/1.x`: an unknown major is refused (§5.4). */
  schemaVersion: z
    .string({ message: 'wrong_type' })
    .regex(/^uf-cv-profile\/1\.[0-9]+$/, { message: 'schema_version' }),
  basics,
  education: list(education, 40),
  projects: list(
    object({
      name: title,
      description,
      highlights,
      keywords,
      startDate: cvDate,
      endDate: cvDate,
      url: cvLink.optional(),
      roles: list(title, 5),
      xEvidence: list(object({ kind: text(40).optional(), url: cvLink, label: short }), 10),
      xLinkedModules: list(text(20), 40),
    }),
    40,
  ),
  skills: list(object({ name: title, level: short, keywords }), 40),
  work: roleSection,
  volunteer: roleSection,
  awards: list(
    object({ title, date: cvDate, awarder: title.optional(), summary: description }),
    40,
  ),
  certificates: list(
    object({ name: title, date: cvDate, issuer: title.optional(), url: cvLink.optional() }),
    40,
  ),
  languages: list(object({ language: short, fluency: short }), 40),
  interests: list(object({ name: title, keywords }), 40),
});

export type CvProfile = z.infer<typeof cvProfileSchema>;

/**
 * The JSON Schema for `uf-cv-profile/1`: Mmereko's, vendored (contract/cv-profile.schema.json),
 * also served by Mmereko at `/partner/v1/schema/cv-profile.json` (§2, §6.3).
 */
export function cvProfileJsonSchema(): Record<string, unknown> {
  // A fresh copy, so no caller can change the bundled one.
  return structuredClone(schema) as Record<string, unknown>;
}

/** A field that failed: its JSON-pointer path (`/projects/0/url`) and why, never its value. */
export interface ProfileIssue {
  readonly path: string;
  readonly code: ProfileProblem;
}

export type ProfileCheck =
  | { readonly ok: true; readonly profile: CvProfile }
  | { readonly ok: false; readonly issues: ReadonlyArray<ProfileIssue> };

/** A path as a JSON pointer (RFC 6901). */
export function jsonPointer(path: ReadonlyArray<PropertyKey>): string {
  return path.map((p) => `/${String(p).replaceAll('~', '~0').replaceAll('/', '~1')}`).join('');
}

function sizeCode(origin: string, big: boolean): ProfileProblem {
  if (origin === 'array') return big ? 'too_many' : 'too_few';
  if (origin === 'string') return big ? 'too_long' : 'too_short';
  return 'out_of_range';
}

function codeOf(issue: z.core.$ZodIssue): ProfileProblem {
  if (issue.code === 'unrecognized_keys') return 'unknown_field';
  if (issue.code === 'invalid_type' && issue.input === undefined) return 'required';
  if ((PROFILE_PROBLEMS as ReadonlyArray<string>).includes(issue.message)) {
    return issue.message as ProfileProblem;
  }
  if (issue.code === 'invalid_type') return 'wrong_type';
  if (issue.code === 'too_big') return sizeCode(issue.origin, true);
  if (issue.code === 'too_small') return sizeCode(issue.origin, false);
  if (issue.code === 'invalid_format') return 'invalid_format';
  return 'invalid_value';
}

/** Zod's issues as contract problems under `prefix`: one per path and code, values never kept. */
export function problemsOf(
  issues: ReadonlyArray<z.core.$ZodIssue>,
  prefix: ReadonlyArray<PropertyKey> = [],
): ProfileIssue[] {
  const seen = new Map<string, ProfileIssue>();
  for (const issue of issues) {
    // An unknown field is reported at its parent's path, never by name.
    const problem = { path: jsonPointer([...prefix, ...issue.path]), code: codeOf(issue) };
    seen.set(`${problem.path} ${problem.code}`, problem);
  }
  return [...seen.values()];
}

/**
 * Checks a profile against `uf-cv-profile/1`, as Mmereko does. The issues carry paths and codes
 * only: a refused value (an ID number, say) is never repeated, in an error, a log or an answer.
 */
export function validateCvProfile(value: unknown): ProfileCheck {
  const parsed = cvProfileSchema.safeParse(value);
  if (parsed.success) return { ok: true, profile: parsed.data };
  return { ok: false, issues: problemsOf(parsed.error.issues) };
}
