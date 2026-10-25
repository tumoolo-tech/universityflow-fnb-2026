import { cv as copy } from '@universityflow/content';
import { signedPdfLink } from '@/lib/server/cv';
import { cvOn } from '@/lib/server/cv-routes';
import { clientIp, handler } from '@/lib/server/http';

/**
 * The public share page (docs/design/mmereko-api-proposal.md §9.3, D5): a recruiter's link,
 * served by UniversityFlow, never by Mmereko (Mmereko never sees who views it). A live link counts
 * a view and redirects to a 60-second signed link to the PDF; a switched-off, expired or unknown
 * one, or a learner who may no longer share, gets the same short page. `noindex`, no referrer,
 * never cached.
 *
 * Each address is held to a limit first (§7.6, "a keyed hash for abuse limits"; CV-A5 A5-18): the
 * store keeps it only as an HMAC. Over it, nothing is looked up, counted, logged or served.
 */

type Params = { params: Promise<{ token: string }> };

/** Opens of share links per address: far above a recruiter's, far below a flood. */
const CV_SHARE_VIEW_LIMIT = { max: 60, windowMs: 60 * 60 * 1000 } as const;

const HEADERS = {
  'cache-control': 'no-store',
  'x-robots-tag': 'noindex, nofollow',
  'referrer-policy': 'no-referrer',
};

/** A plain page with no styles or scripts of its own: two fixed sentences from packages/content. */
function gone(): Response {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex, nofollow"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${copy.share.goneTitle}</title></head><body><main><h1>${copy.share.goneTitle}</h1><p>${copy.share.gone}</p></main></body></html>`;
  return new Response(html, {
    status: 404,
    headers: { ...HEADERS, 'content-type': 'text/html; charset=utf-8' },
  });
}

export const GET = handler(async (request: Request, { params }: Params) => {
  const services = await cvOn();
  const { max, windowMs } = CV_SHARE_VIEW_LIMIT;
  if (
    !(await services.store.allow('cv-share-view', clientIp(request) ?? 'unknown', max, windowMs))
  ) {
    return new Response(null, {
      status: 429,
      headers: { ...HEADERS, 'retry-after': String(Math.ceil(windowMs / 1000)) },
    });
  }
  const { token } = await params;
  const opened = await services.store.cvJobs().openShare(token, services.cvAccess);
  if (!opened) return gone();
  const { url } = signedPdfLink(
    services.config.publicUrl,
    services.config.authSecret,
    opened.documentId,
    new Date(),
  );
  return new Response(null, { status: 307, headers: { ...HEADERS, location: url } });
});
