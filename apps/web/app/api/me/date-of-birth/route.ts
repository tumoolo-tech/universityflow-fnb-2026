import { AdultsOnlyError, TooYoungError } from '@universityflow/db';
import { z } from 'zod';
import { deleteFiles } from '@/lib/server/demo/core';
import { handler, json, parseBody, requireSignedIn } from '@/lib/server/http';
import { getServices } from '@/lib/server/services';
import { clearSessionCookie, sessionToken } from '@/lib/server/session';

const Body = z.object({ dateOfBirth: z.iso.date() });

export const POST = handler(async (request: Request) => {
  const { studentId, student } = await requireSignedIn(request);
  const { dateOfBirth } = await parseBody(request, Body);
  const services = await getServices();
  try {
    const status = await services.store.setDateOfBirth(studentId, dateOfBirth);
    return json({ consentStatus: status });
  } catch (error) {
    // The judge demo's real sign-up is adults only (a hackathon exception, docs/deploy/demo.md):
    // a judge's own account refused for age keeps nothing about a minor, so it goes at once and
    // this browser is signed out. The refusal itself is the store's; its reason reaches the page.
    if (
      (error instanceof AdultsOnlyError || error instanceof TooYoungError) &&
      services.config.demo &&
      (await services.store.isDemoSignup(studentId))
    ) {
      await deleteFiles(services, await student.deleteAccount());
      const token = await sessionToken();
      if (token) await services.store.signOut(token);
      await clearSessionCookie();
    }
    throw error;
  }
});
