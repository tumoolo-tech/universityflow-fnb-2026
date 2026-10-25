import { cv, cvMmereko, demoPersonas } from '@universityflow/content';
import type { CvDocumentRecord, CvShareRecord } from '@universityflow/db';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Notice, Page } from '@/components/ui';
import { cvCopy } from '@/lib/server/cv-copy';
import { mmerekoCanvasFor } from '@/lib/server/cv-mmereko';
import { adultInOwnName, selectionView } from '@/lib/server/cv-routes';
import { learnerPlace } from '@/lib/server/learner-place';
import { getServices } from '@/lib/server/services';
import { readyStudent } from '@/lib/server/session';
import type { CvDocument, CvInitial, CvShare } from './cv-types';
import { CvView } from './cv-view';
import { MmerekoCanvas } from './mmereko-canvas';

export const metadata: Metadata = { title: cv.title };

/** A CV as the page takes it: dates as ISO strings (a prop must be serialisable). */
function documentJson(d: CvDocumentRecord): CvDocument {
  return {
    ...d,
    confirmedAt: d.confirmedAt?.toISOString() ?? null,
    createdAt: d.createdAt.toISOString(),
    finishedAt: d.finishedAt?.toISOString() ?? null,
  };
}

function shareJson(s: CvShareRecord): CvShare {
  return {
    ...s,
    createdAt: s.createdAt.toISOString(),
    expiresAt: s.expiresAt.toISOString(),
    revokedAt: s.revokedAt?.toISOString() ?? null,
  };
}

/**
 * My CV (docs/design/mmereko-api-proposal.md §10.5), only while the server's `UF_CV` switch is
 * on (D8): otherwise there is no such page. Everything is read here, on the server, once; the
 * page's one client island takes it with its words as props, and calls the same CV API as the
 * app. Sharing is offered only to an adult in their own name (§9.3, D6).
 */
export default async function CvPage() {
  // First, as on every signed-in page: no data is read for a learner who can't be processed yet.
  const signed = await readyStudent();
  const services = await getServices();
  if (!services.config.cv || !services.cv) notFound();
  const { student, account } = signed;
  const canShare = adultInOwnName(account);
  // "Open Mmereko" (2026-10-24): 18 or over, or at university, with the switch on. Decided here,
  // so an under-18 school learner's page never carries the button, the dialog or the frame.
  const canvas = services.config.mmerekoCanvas;
  const mmereko =
    canvas && mmerekoCanvasFor(account, (await learnerPlace(student, services.catalogue())).stage)
      ? canvas
      : null;
  const [state, entries, view, documents, shares, reported] = await Promise.all([
    student.cvState(services.cvAccess),
    student.cvEntries(),
    selectionView(student, services),
    student.cvDocuments(),
    canShare ? student.cvShares() : Promise.resolve([]),
    student.reportedCvDocuments(),
  ]);
  const initial: CvInitial = {
    optIn: state.link
      ? {
          optedInAt: state.link.optedInAt.toISOString(),
          version: state.link.consentVersion,
          purposes: [...state.link.purposes],
        }
      : null,
    wordingCovers: state.wordingCovers,
    canShare,
    entries,
    view: {
      selection: view.selection,
      available: view.available,
      ready: view.ready,
      missing: view.missing,
      omitted: view.omitted,
    },
    documents: documents.map(documentJson),
    shares: shares.map(shareJson),
    reported,
    // The judge demo's stand-in makes the CVs: no AI notes (a hackathon exception, 2026-10-24).
    standIn: services.config.demo,
  };
  return (
    <Page title={cv.title} lead={cv.lead}>
      {/* A hackathon exception (2026-10-24): the demo's CVs come from the stand-in, never Mmereko. */}
      {services.config.demo ? <Notice>{demoPersonas.cvStandIn}</Notice> : null}
      {mmereko ? (
        <MmerekoCanvas copy={cvMmereko} loginUrl={mmereko.loginUrl} siteUrl={mmereko.siteUrl} />
      ) : null}
      <CvView initial={initial} copy={cvCopy()} />
    </Page>
  );
}
