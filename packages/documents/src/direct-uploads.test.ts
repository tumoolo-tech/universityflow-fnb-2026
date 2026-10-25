import { describe, expect, it } from 'vitest';
import {
  checkArrival,
  MemoryDirectUploads,
  SNIFF_BYTES,
  TicketRefusedError,
  UPLOAD_TICKET_TTL_SECONDS,
} from './direct-uploads';
import { InvalidKeyError } from './storage';
import { InvalidUploadError, MAX_UPLOAD_BYTES } from './uploads';

const PDF = new TextEncoder().encode('%PDF-1.7 synthetic test file, not a real document');
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);

describe('checkArrival', () => {
  it('accepts a file whose bytes match the declared type', () => {
    expect(
      checkArrival({ size: PDF.length, head: PDF.slice(0, SNIFF_BYTES) }, 'application/pdf'),
    ).toBe('application/pdf');
  });

  it.each([
    ['empty', { size: 0, head: new Uint8Array() }, 'application/pdf'],
    ['too-large', { size: MAX_UPLOAD_BYTES + 1, head: PDF }, 'application/pdf'],
    ['unsupported-type', { size: 6, head: new TextEncoder().encode('<html>') }, 'application/pdf'],
    // A real PNG declared as a PDF: the stored type must be the declared one, so refuse.
    ['unsupported-type', { size: PNG.length, head: PNG }, 'application/pdf'],
  ] as const)('refuses %s', (reason, arrival, declared) => {
    try {
      checkArrival(arrival, declared);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidUploadError);
      expect((error as InvalidUploadError).reason).toBe(reason);
    }
  });
});

describe('MemoryDirectUploads (the stand-in for S3 POST policies)', () => {
  const request = {
    contentType: 'application/pdf' as const,
    maxBytes: 100,
    expiresInSeconds: UPLOAD_TICKET_TTL_SECONDS,
  };

  it('stores a post inside the ticket and inspects it', async () => {
    const uploads = new MemoryDirectUploads();
    const ticket = await uploads.ticket('incoming-00000001', request);
    await uploads.receive(ticket.fields, PDF);
    expect(await uploads.inspect('incoming-00000001')).toEqual({
      size: PDF.length,
      head: PDF.slice(0, SNIFF_BYTES),
    });
    expect(await uploads.inspect('incoming-00000002')).toBeNull();
  });

  it('refuses what S3 would refuse: no ticket, expired, too big, empty, another type', async () => {
    let now = new Date('2026-10-13T08:00:00Z');
    const uploads = new MemoryDirectUploads(undefined, () => now);
    await expect(uploads.receive({ key: 'incoming-00000009' }, PDF)).rejects.toThrow(
      TicketRefusedError,
    );
    const ticket = await uploads.ticket('incoming-00000001', request);
    await expect(uploads.receive(ticket.fields, new Uint8Array(101))).rejects.toThrow(
      TicketRefusedError,
    );
    await expect(uploads.receive(ticket.fields, new Uint8Array())).rejects.toThrow(
      TicketRefusedError,
    );
    await expect(
      uploads.receive({ ...ticket.fields, 'Content-Type': 'text/html' }, PDF),
    ).rejects.toThrow(TicketRefusedError);
    now = new Date(now.getTime() + (UPLOAD_TICKET_TTL_SECONDS + 1) * 1000);
    await expect(uploads.receive(ticket.fields, PDF)).rejects.toThrow(TicketRefusedError);
    expect(await uploads.inspect('incoming-00000001')).toBeNull();
  });

  it('refuses a bad key', async () => {
    await expect(new MemoryDirectUploads().ticket('../x', request)).rejects.toThrow(
      InvalidKeyError,
    );
  });
});
