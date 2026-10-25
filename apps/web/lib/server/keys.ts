import 'server-only';
import { randomBytes } from 'node:crypto';

/** A storage key for an upload: random, never derived from a name or anything personal. */
export function newStorageKey(): string {
  return `doc-${randomBytes(16).toString('hex')}`;
}

/**
 * Where a direct upload lands before it is checked. Only these keys ever get an upload ticket;
 * an accepted file is copied to a `doc-` key, which no ticket can write to. Anything left under
 * `incoming-` is abandoned, so a storage lifecycle rule can expire it after a day.
 */
export function newIncomingKey(): string {
  return `incoming-${randomBytes(16).toString('hex')}`;
}

/** A profile photo's key (migration 0029 holds this shape): random, never from a name. */
export function newPhotoKey(): string {
  return `photo-${randomBytes(16).toString('hex')}`;
}
