import { SCHOOL_GRADES } from '@universityflow/catalogue';
import {
  AVATAR_IDS,
  BADGE_IDS,
  MAX_BADGES,
  resolveLook,
  TAGLINE_IDS,
  THEME_IDS,
} from '@universityflow/ui';
import { z } from 'zod';
import { sendCvDeletions } from '@/lib/server/cv-routes';
import { handler, json, parseBody, requireReady, requireSignedIn } from '@/lib/server/http';
import { careForStudent } from '@/lib/server/plan-care';
import { demoRealUploads, photoAccess, photoMode, photoState } from '@/lib/server/profile-photo';
import { getServices } from '@/lib/server/services';
import { clearSessionCookie, isReady } from '@/lib/server/session';

/** A stored profile with its look made safe to draw: an id a later list dropped falls back. */
function withLook<T extends Parameters<typeof resolveLook>[0]>(profile: T) {
  return profile ? { ...profile, ...resolveLook(profile) } : profile;
}

/**
 * The account and, once consent allows, the profile. `photo` (profile-look-proposal §5.3): null
 * when no photo is offered (the switch is off, before consent, or consent wording that doesn't
 * name the photo: A11-31), else its version or null, and
 * in a judge demo the SAMPLE pictures to choose from.
 */
export const GET = handler(async (request: Request) => {
  const { account, student, studentId } = await requireSignedIn(request);
  const ready = isReady(account);
  const profile = ready ? withLook(await student.profile()) : null;
  const { config, store } = await getServices();
  const photo = await photoState(
    photoMode(config),
    ready,
    student,
    photoAccess(config),
    await demoRealUploads(config, store, studentId),
  );
  return json({ account, profile, ready, photo });
});

const Profile = z.object({
  displayName: z.string().trim().max(40).nullable().optional(),
  // The grades UniversityFlow serves, 10 to 12 (A1-39).
  grade: z
    .int()
    .refine((g) => (SCHOOL_GRADES as ReadonlyArray<number>).includes(g))
    .nullable()
    .optional(),
  schoolName: z.string().trim().max(120).nullable().optional(),
  province: z.string().trim().max(40).nullable().optional(),
  goal: z.string().trim().max(200).nullable().optional(),
  // The look (docs/design/profile-look-proposal.md): ids from the fixed lists, never free text.
  theme: z.enum(THEME_IDS).optional(),
  avatar: z.enum(AVATAR_IDS).optional(),
  taglineId: z.enum(TAGLINE_IDS).nullable().optional(),
  badgeIds: z
    .array(z.enum(BADGE_IDS))
    .max(MAX_BADGES)
    .transform((ids) => [...new Set(ids)])
    .optional(),
});

export const PATCH = handler(async (request: Request) => {
  const { student } = await requireReady(request);
  const patch = await parseBody(request, Profile);
  const clean = Object.fromEntries(
    Object.entries(patch)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => [k, typeof v === 'string' && v === '' ? null : v]),
  );
  const profile = withLook(await student.updateProfile(clean));
  // D9: the goal in the learner's own words gets the chat's crisis check, as a plan map's words
  // do (D3): saved anyway, and the answer carries the care it asks for. Never logged.
  const goal = clean['goal'];
  const care =
    typeof goal === 'string'
      ? await careForStudent(student, (await getServices()).catalogue(), { texts: [goal] })
      : null;
  return json({ profile, care });
});

/**
 * Deletes the account, every uploaded file and every scheduled reminder. Jobs are cancelled in
 * the scheduler first (a hosted one keeps its own queue), then the database purges its own queue
 * rows with the account, in one transaction. My CV (§7.3): the CVs' PDFs go with the files, and
 * the tombstone the account left carries the deletion to the CV engine.
 */
export const DELETE = handler(async (request: Request) => {
  const { student } = await requireSignedIn(request);
  const services = await getServices();
  const { files, jobs } = services;
  for (const jobId of await student.scheduledJobIds()) await jobs.cancel(jobId);
  const keys = await student.deleteAccount();
  await Promise.all(keys.map((key) => files.delete(key)));
  await sendCvDeletions(services);
  await clearSessionCookie();
  return json({ ok: true });
});
