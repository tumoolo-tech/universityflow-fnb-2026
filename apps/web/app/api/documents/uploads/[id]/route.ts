import {
  checkArrival,
  checkUpload,
  InvalidUploadError,
  type UploadType,
} from '@universityflow/documents';
import { z } from 'zod';
import { readableKind, readersOf, recordAndRead } from '@/lib/server/documents';
import { HttpError, handler, requireReady } from '@/lib/server/http';
import { newStorageKey } from '@/lib/server/keys';
import { getServices } from '@/lib/server/services';

export const maxDuration = 60;

/**
 * Completes a direct upload. The intent is claimed first, once, so the same upload can't be
 * completed twice or by another learner. Then what actually arrived is checked, size and magic
 * bytes, exactly as for an upload through our server; anything that fails is deleted.
 *
 * An accepted file is copied to a fresh key that no ticket can write to, so a ticket reused
 * before it expires can't swap the file after it was checked.
 */
export const POST = handler(
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { student } = await requireReady(request);
    const { id } = await params;
    if (!z.uuid().safeParse(id).success) throw new HttpError(404, 'not-found');
    // Which reader: a report by default, `?kind=acceptance-letter` for an offer letter,
    // `?kind=proof-of-registration` for a proof of registration, `?kind=module-outline` for a
    // module outline.
    const kind = readableKind(new URL(request.url).searchParams.get('kind'));
    const services = await getServices();
    const { files, uploads, catalogue } = services;
    if (!uploads) throw new HttpError(404, 'not-found');

    const intent = await student.claimUploadIntent(id);
    const declared = intent.mimeType as UploadType;
    const arrival = await uploads.inspect(intent.storageKey);
    if (!arrival) throw new HttpError(409, 'upload', 'not-received');

    let bytes: Uint8Array;
    let mimeType: UploadType;
    try {
      // First bytes only, before downloading anything big.
      checkArrival(arrival, declared);
      const file = await files.get(intent.storageKey);
      if (!file) throw new HttpError(409, 'upload', 'not-received');
      // Then the whole file, in case it changed in between.
      mimeType = checkUpload(file.bytes);
      if (mimeType !== declared) throw new InvalidUploadError('unsupported-type');
      bytes = file.bytes;
    } catch (error) {
      await files.delete(intent.storageKey);
      throw error;
    }

    const storageKey = newStorageKey();
    await files.put(storageKey, { bytes, mimeType });
    await files.delete(intent.storageKey);
    return recordAndRead(
      student,
      readersOf(services),
      { storageKey, mimeType, bytes },
      kind,
      catalogue,
      files,
    );
  },
);
