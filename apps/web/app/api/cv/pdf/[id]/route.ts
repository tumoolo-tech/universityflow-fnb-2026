import { verifyPdfLink } from '@/lib/server/cv';
import { cvOn } from '@/lib/server/cv-routes';
import { HttpError, handler } from '@/lib/server/http';

/**
 * A CV's PDF by a link that works for 60 seconds (docs/design/mmereko-api-proposal.md §9.3,
 * §10.3), signed by the server for the learner's own download (GET /api/me/cv/documents/[id]) or
 * a recruiter's share link (/cv/s/[token]). No cookie needed, so the app's system viewer and a
 * recruiter's browser can open it; nothing else can, and not for long. Served from our own files
 * (S3 in af-south-1). Anything wrong is the same 404: the route says nothing about why.
 */

type Params = { params: Promise<{ id: string }> };

export const GET = handler(async (request: Request, { params }: Params) => {
  const services = await cvOn();
  const { id } = await params;
  const url = new URL(request.url);
  const ok = verifyPdfLink(
    services.config.authSecret,
    id,
    url.searchParams.get('exp'),
    url.searchParams.get('sig'),
    new Date(),
  );
  const key = ok ? await services.store.cvJobs().fileOf(id) : null;
  const file = key ? await services.files.get(key) : null;
  if (!file) throw new HttpError(404, 'not-found');
  return new Response(new Uint8Array(file.bytes), {
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': 'inline; filename="cv.pdf"',
      'cache-control': 'private, no-store',
      'x-content-type-options': 'nosniff',
      'x-robots-tag': 'noindex, nofollow',
      'referrer-policy': 'no-referrer',
    },
  });
});
