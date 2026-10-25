import { assertKey, type FileStore, MemoryFileStore } from './storage';
import { InvalidUploadError, MAX_UPLOAD_BYTES, sniffType, type UploadType } from './uploads';

/**
 * Uploads that go straight from the learner's phone to storage, so the file never passes through
 * our server's request body (Vercel caps that at 4.5 MB; status.md open finding 3).
 *
 * 1. The server issues a ticket: a short-lived signed form that lets the browser put exactly one
 *    object, at a key the server chose, of one declared type and at most `maxBytes`. Storage
 *    itself enforces those limits (an S3 POST policy).
 * 2. The browser posts the file to storage.
 * 3. The browser tells the server it's done. The server inspects what arrived (its size and first
 *    bytes) and runs the same magic-byte checks as a direct upload before accepting it.
 *
 * Behind an interface (D8): S3 in production, `MemoryDirectUploads` in tests.
 */

export interface UploadTicket {
  /** Where the browser posts the form. */
  readonly url: string;
  /** Form fields to send before the file, exactly as given. */
  readonly fields: Readonly<Record<string, string>>;
  readonly expiresAt: Date;
}

export interface TicketRequest {
  readonly contentType: UploadType;
  readonly maxBytes: number;
  readonly expiresInSeconds: number;
}

/** What arrived at a key: its size and first bytes. */
export interface Arrival {
  readonly size: number;
  readonly head: Uint8Array;
}

export interface DirectUploads {
  ticket(key: string, request: TicketRequest): Promise<UploadTicket>;
  /** What arrived at `key`, or null when nothing did. Reads at most `SNIFF_BYTES`. */
  inspect(key: string): Promise<Arrival | null>;
}

/** A ticket is good for five minutes: long enough for a 10 MB photo on a slow connection. */
export const UPLOAD_TICKET_TTL_SECONDS = 5 * 60;

/** Enough of a file to recognise every type we accept (WebP needs 12). */
export const SNIFF_BYTES = 16;

/**
 * The same checks as `checkUpload`, on what arrived rather than on a request body. The type must
 * also be the one declared when the ticket was issued, so the stored type can't be chosen by the
 * browser.
 */
export function checkArrival(arrival: Arrival, declared: UploadType): UploadType {
  if (arrival.size === 0) throw new InvalidUploadError('empty');
  if (arrival.size > MAX_UPLOAD_BYTES) throw new InvalidUploadError('too-large');
  const type = sniffType(arrival.head);
  if (!type || type !== declared) throw new InvalidUploadError('unsupported-type');
  return type;
}

export class TicketRefusedError extends Error {
  override readonly name = 'TicketRefusedError';
}

/**
 * The stand-in: tickets point at a memory store, and `receive` plays the part of storage
 * enforcing the ticket's policy (expiry, size, type) when the browser posts.
 */
export class MemoryDirectUploads implements DirectUploads {
  readonly #tickets = new Map<string, TicketRequest & { expiresAt: Date }>();
  readonly #clock: () => Date;

  constructor(
    readonly store: FileStore = new MemoryFileStore(),
    clock: () => Date = () => new Date(),
  ) {
    this.#clock = clock;
  }

  async ticket(key: string, request: TicketRequest): Promise<UploadTicket> {
    assertKey(key);
    const expiresAt = new Date(this.#clock().getTime() + request.expiresInSeconds * 1000);
    this.#tickets.set(key, { ...request, expiresAt });
    return {
      url: 'memory://uploads',
      fields: { key, 'Content-Type': request.contentType },
      expiresAt,
    };
  }

  /** The browser's post, refused the way S3 refuses a form outside its policy. */
  async receive(fields: Readonly<Record<string, string>>, bytes: Uint8Array): Promise<void> {
    const key = fields['key'] ?? '';
    const ticket = this.#tickets.get(key);
    if (!ticket) throw new TicketRefusedError('No ticket for this key');
    if (this.#clock() > ticket.expiresAt) throw new TicketRefusedError('Ticket expired');
    if (bytes.length < 1 || bytes.length > ticket.maxBytes) {
      throw new TicketRefusedError('Outside the content-length-range');
    }
    if (fields['Content-Type'] !== ticket.contentType) {
      throw new TicketRefusedError('Content-Type differs from the policy');
    }
    await this.store.put(key, { bytes, mimeType: ticket.contentType });
  }

  async inspect(key: string): Promise<Arrival | null> {
    const file = await this.store.get(key);
    if (!file) return null;
    return { size: file.bytes.length, head: file.bytes.slice(0, SNIFF_BYTES) };
  }
}
