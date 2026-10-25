import { isSamplePhotoId, samplePhotoPng } from '@universityflow/documents';
import { requireDemo } from '@/lib/server/demo/core';
import { HttpError, handler } from '@/lib/server/http';

/**
 * Judge demo mode: one of the SAMPLE profile pictures, in colour, for the "Choose a sample photo"
 * picker (owner's decision, 2026-10-23). Drawn by code (packages/documents sample-photos.ts): a
 * picture of nobody, the same for everyone, so it may be cached. Not found outside a demo.
 */
export const GET = handler(
  async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
    await requireDemo();
    const { id } = await params;
    if (!isSamplePhotoId(id)) throw new HttpError(404, 'not-found');
    return new Response(new Uint8Array(await samplePhotoPng(id)), {
      headers: {
        'content-type': 'image/png',
        'cache-control': 'public, max-age=86400',
        'x-content-type-options': 'nosniff',
        'cross-origin-resource-policy': 'same-origin',
      },
    });
  },
);
