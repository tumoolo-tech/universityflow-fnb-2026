import { en } from '@universityflow/content';
import { z } from 'zod';
import { sendCvDeletions } from '@/lib/server/cv-routes';
import { assertSameOrigin, handler, json, parseBody } from '@/lib/server/http';
import { getServices } from '@/lib/server/services';

const Body = z.object({ action: z.enum(['grant', 'withdraw']) });

/** The guardian's answer. The link token is the only credential; no account is needed. */
export const POST = handler(
  async (request: Request, { params }: { params: Promise<{ token: string }> }) => {
    assertSameOrigin(request);
    const { token } = await params;
    const { action } = await parseBody(request, Body);
    const services = await getServices();
    const { store, jobs } = services;
    // The version recorded is the wording this server shows the guardian (A11-01).
    if (action === 'grant') await store.grantConsent(token, en.consent.version);
    else {
      // The withdrawal has already dropped the learner's reminders and cancelled their jobs in
      // the database's own queue (A11-05); a hosted scheduler keeps its own, so cancel there too.
      const withdrawn = await store.withdrawConsent(token);
      for (const jobId of withdrawn.jobIds) await jobs.cancel(jobId);
      // The profile photo goes with the withdrawal (A11-31): its file too.
      for (const key of withdrawn.fileKeys) await services.files.delete(key);
      // My CV (§7.3, §11): the CV engine is asked to delete what it holds for the learner.
      await sendCvDeletions(services);
    }
    return json({ ok: true, status: (await store.consentRequest(token)).status });
  },
);
