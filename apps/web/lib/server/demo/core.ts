import 'server-only';
import { ConfigError, isDemo, logConfigRefusal } from '../config';
import { HttpError } from '../http';
import { getServices, type Services } from '../services';
import { currentStudent, sessionToken } from '../session';

/**
 * Judge demo mode (UF_DEPLOYMENT=demo, docs/deploy/demo.md): the plumbing the demo routes share.
 * Ids only in anything logged (hard rule 4).
 */

/**
 * Demo starts per address an hour (the existing rate-limit table). A judging room shares one
 * address behind its NAT, so this is generous; it only bounds how fast one address can fill the
 * synthetic demo database with copies (each swept after 24 hours).
 */
export const DEMO_STARTS_PER_IP_PER_HOUR = 120;

/**
 * The judges' real sign-up (a hackathon exception, docs/deploy/demo.md): sign-ins per address an
 * hour. Each is one verified Google/Firebase identity, so a judging room needs few; this bounds
 * how fast one address can make accounts.
 */
export const DEMO_SIGNUPS_PER_IP_PER_HOUR = 30;

/** The demo's own routes: not found anywhere but a demo. */
export async function requireDemo(): Promise<Services> {
  const services = await getServices();
  if (!services.config.demo) throw new HttpError(404, 'not-found');
  return services;
}

/**
 * The demo's routes behind its plain form posts (the picker, "Switch learner"): the services, or,
 * when the server refuses the demo's configuration, a 303 back to the picker, which says the demo
 * isn't set up yet (the refusal logged with its message, never shown). A JSON post, and anything
 * outside a demo, throws as `requireDemo` does: the handler answers it.
 */
export async function requireDemoForForm(request: Request): Promise<Services | Response> {
  try {
    return await requireDemo();
  } catch (error) {
    if (isFormPost(request) && error instanceof ConfigError && isDemo()) {
      logConfigRefusal(error);
      return seeOther(request, '/demo?demo=setup');
    }
    throw error;
  }
}

/** Phone sign-in and SMS routes: not found on a demo, where there is nothing to send. */
export async function refuseInDemo(): Promise<void> {
  if ((await getServices()).config.demo) throw new HttpError(404, 'not-found');
}

/** Deletes stored files, never failing the request for one that is already gone. */
export async function deleteFiles(services: Services, keys: ReadonlyArray<string>): Promise<void> {
  await Promise.all(keys.map((key) => services.files.delete(key).catch(() => undefined)));
}

/**
 * The lazy sweep: copies made more than a day ago go, with their files, and the judges' own
 * accounts (the real sign-up) 30 days after they were made. A failure never stops a judge
 * starting: the next start or sign-in sweeps again.
 */
export async function sweepOldCopies(services: Services): Promise<void> {
  try {
    const { fileKeys } = await services.store.sweepDemoStudents();
    await deleteFiles(services, fileKeys);
    const signups = await services.store.sweepDemoSignups();
    await deleteFiles(services, signups.fileKeys);
  } catch (error) {
    console.error(`demo sweep failed (${(error as Error)?.name ?? 'Error'})`);
  }
}

/**
 * Ends this browser's demo session. A made-up learner's copy is deleted with it (it is this
 * browser's alone); a judge's own account (the real sign-up) is only signed out of: it keeps its
 * 30 days, and only the sweep or the judge deletes it.
 */
export async function leaveCurrent(services: Services): Promise<void> {
  const signed = await currentStudent();
  if (signed && !(await services.store.isDemoSignup(signed.studentId))) {
    await deleteFiles(services, await signed.student.deleteAccount());
  }
  const token = await sessionToken();
  if (token) await services.store.signOut(token);
}

/** A plain HTML form post (the picker and the banner work without script). */
export function isFormPost(request: Request): boolean {
  const type = request.headers.get('content-type') ?? '';
  return (
    type.startsWith('application/x-www-form-urlencoded') || type.startsWith('multipart/form-data')
  );
}

/** A 303 to a path on this site, so the browser follows it with a GET. */
export function seeOther(request: Request, path: string): Response {
  return new Response(null, {
    status: 303,
    headers: { location: new URL(path, request.url).toString(), 'cache-control': 'no-store' },
  });
}
