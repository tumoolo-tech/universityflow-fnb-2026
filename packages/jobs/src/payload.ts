/**
 * What a job may carry: IDs, and nothing else (hard rule 4; planning §16.1, "Job payloads
 * carry IDs only"). A job's payload ends up in a queue table, in a hosted scheduler's dashboard
 * and in its logs, so a phone number, a name or a message body in one is a leak. The job looks
 * everything else up when it runs, and finds nothing if the learner has since been deleted.
 *
 * Enforced three ways:
 * - **Types.** A payload is a flat record whose keys are fixed by its job kind and whose values
 *   are `EntityId`s, which only `entityId()` makes, after checking the value is a UUID.
 * - **At runtime**, on every schedule and again before every run: exactly the kind's fields,
 *   each a UUID string. Anything else is refused, and the error never repeats the value.
 * - **In the database** (the Postgres stand-in): a check constraint refuses non-UUID values.
 */

export class InvalidJobError extends Error {
  override readonly name: string = 'InvalidJobError';
}

/** A payload, a job kind or an idempotency key that could carry more than IDs. */
export class InvalidJobPayloadError extends InvalidJobError {
  override readonly name = 'InvalidJobPayloadError';
}

declare const ENTITY_ID: unique symbol;

/** A row's id (a UUID), checked. The only kind of value a job payload holds. */
export type EntityId = string & { readonly [ENTITY_ID]: true };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** True for a lower-case, hyphenated UUID, the form Postgres returns. */
export function isEntityId(value: unknown): value is EntityId {
  return typeof value === 'string' && UUID.test(value);
}

/** Checks that a value is a row id and brands it, so it can go into a job payload. */
export function entityId(value: string): EntityId {
  if (!isEntityId(value)) throw new InvalidJobPayloadError('Not an ID (a lower-case UUID)');
  return value;
}

/** A named kind of job and the ID fields its payload holds. Build with `defineJobKind`. */
export interface JobKind<Name extends string = string, Field extends string = string> {
  readonly name: Name;
  readonly fields: readonly Field[];
}

/** The payload a kind of job carries: exactly its ID fields. */
export type JobPayloadOf<K extends JobKind> =
  K extends JobKind<string, infer Field> ? { readonly [F in Field]: EntityId } : never;

/** Any job's payload, as stored. */
export type JobPayload = Readonly<Record<string, EntityId>>;

/** `reminder.send`, `matric.check-in`: lower-case words, dot-separated. */
const KIND_NAME = /^[a-z][a-z0-9]*(?:\.[a-z][a-z0-9-]*)*$/;
/** `reminderId`, `studentId`: a field holds an ID, and says so. */
const FIELD_NAME = /^[a-z][A-Za-z0-9]*Id$/;
export const MAX_JOB_FIELDS = 8;

/**
 * Declares a kind of job. Field names must end in `Id`, so a payload's shape says what it is:
 * `defineJobKind('reminder.send', ['reminderId'])`.
 */
export function defineJobKind<const Name extends string, const Field extends string>(
  name: Name,
  fields: readonly Field[],
): JobKind<Name, Field> {
  if (name.length > 64 || !KIND_NAME.test(name)) {
    throw new InvalidJobError('A job kind is lower-case words separated by dots');
  }
  if (fields.length === 0 || fields.length > MAX_JOB_FIELDS) {
    throw new InvalidJobPayloadError(`A job carries between 1 and ${MAX_JOB_FIELDS} IDs`);
  }
  for (const field of fields) {
    if (field.length > 64 || !FIELD_NAME.test(field)) {
      throw new InvalidJobPayloadError(`Job field ${field} must be camelCase ending in "Id"`);
    }
  }
  if (new Set(fields).size !== fields.length) {
    throw new InvalidJobPayloadError('A job kind lists each field once');
  }
  return Object.freeze({ name, fields: Object.freeze([...fields]) });
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * Checks a payload against its kind: a plain object holding exactly the kind's fields, each a
 * UUID string. Errors name the kind's own fields at most, never a value or an unexpected key
 * (either could be the personal data being refused).
 */
export function validateJobPayload<K extends JobKind>(
  kind: K,
  payload: unknown,
): asserts payload is JobPayloadOf<K> {
  if (!isPlainObject(payload)) {
    throw new InvalidJobPayloadError(`A ${kind.name} payload must be a flat record of IDs`);
  }
  const keys = Object.keys(payload);
  const expected = new Set<string>(kind.fields);
  if (keys.some((key) => !expected.has(key))) {
    throw new InvalidJobPayloadError(`A ${kind.name} payload holds a field it doesn't declare`);
  }
  for (const field of kind.fields) {
    if (!Object.hasOwn(payload, field)) {
      throw new InvalidJobPayloadError(`A ${kind.name} payload needs ${field}`);
    }
    if (!isEntityId(payload[field])) {
      throw new InvalidJobPayloadError(`${kind.name}.${field} must be an ID (a lower-case UUID)`);
    }
  }
}

/** A frozen copy holding only the kind's fields, in the kind's order. */
export function copyJobPayload<K extends JobKind>(kind: K, payload: unknown): JobPayloadOf<K> {
  validateJobPayload(kind, payload);
  const copy: Record<string, EntityId> = {};
  for (const field of kind.fields) copy[field] = (payload as JobPayload)[field] as EntityId;
  return Object.freeze(copy) as JobPayloadOf<K>;
}

/** True when two stored payloads hold the same IDs. */
export function samePayload(a: JobPayload, b: JobPayload): boolean {
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((key) => a[key] === b[key]);
}

const IDEMPOTENCY_KEY = /^[a-z0-9][a-z0-9:._-]{0,199}$/;
const UUID_ANYWHERE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g;

/**
 * An idempotency key names one logical job (`deadline:<reminderId>:2027-03-01`), so scheduling
 * it twice makes one job. It is stored and shown like a payload, so it is held to the same
 * standard as far as text can be: lower-case letters, digits and `: . _ -` only (no `+`, `@`
 * or spaces), and, outside the UUIDs it contains, no run of seven or more digits (a phone or ID
 * number). Build keys from a label, IDs and dates; never from anything a person typed.
 */
export function validateIdempotencyKey(key: string): void {
  if (!IDEMPOTENCY_KEY.test(key)) {
    throw new InvalidJobPayloadError(
      'An idempotency key is up to 200 lower-case letters, digits and : . _ -',
    );
  }
  if (/\d{7}/.test(key.replace(UUID_ANYWHERE, ':'))) {
    throw new InvalidJobPayloadError(
      'An idempotency key holds IDs, not numbers that could be a phone or ID number',
    );
  }
}
