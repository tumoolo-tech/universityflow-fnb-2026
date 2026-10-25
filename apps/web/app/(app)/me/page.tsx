import { en } from '@universityflow/content';
import { resolveLook } from '@universityflow/ui';
import type { Metadata } from 'next';
import { goalOptions } from '@/lib/server/goals';
import { demoRealUploads, photoAccess, photoMode, photoState } from '@/lib/server/profile-photo';
import { getServices } from '@/lib/server/services';
import { readyStudent } from '@/lib/server/session';
import { MeView } from './me-view';

export const metadata: Metadata = { title: en.me.title };

/** "What does UniversityFlow know about me?" (planning.md §4.5, §8.1). */
export default async function MePage() {
  const signed = await readyStudent();
  const [profile, memory, messaging, { offeredChannels, catalogue, config, store }] =
    await Promise.all([
      signed.student.profile(),
      signed.student.memory(),
      signed.student.messagingPreferences(),
      getServices(),
    ]);
  return (
    <MeView
      account={signed.account}
      messaging={{
        channels: messaging.channels.map((c) => ({
          channel: c.channel,
          optedIn: c.optedIn,
          optedInAt: c.optedInAt?.toISOString() ?? null,
          optOutSource: c.optOutSource,
        })),
        maxPerWeek: messaging.maxPerWeek,
        offeredChannels: [...offeredChannels],
      }}
      profile={
        profile
          ? {
              displayName: profile.displayName,
              grade: profile.grade,
              schoolName: profile.schoolName,
              province: profile.province,
              goal: profile.goal,
            }
          : null
      }
      look={resolveLook(profile)}
      // Past matric "Grade 12" no longer describes them (A10-38): no sticker.
      lookGrade={profile && !profile.schoolFinished ? profile.grade : null}
      // Only when the server's switch is on (UF_PROFILE_PHOTO) and the learner's consent names the
      // photo (A11-31), or in a judge demo: SAMPLE pictures, and the visitor's own photo only
      // under UF_DEMO_REAL_PHOTOS (a hackathon exception).
      photo={
        await photoState(
          photoMode(config),
          true,
          signed.student,
          photoAccess(config),
          await demoRealUploads(config, store, signed.studentId),
        )
      }
      memory={memory.map((m) => ({ id: m.id, kind: m.kind, body: m.body }))}
      courses={goalOptions(catalogue())}
      // D9: the words for the care a saved goal may ask for.
      careWords={en.planMaps.care}
    />
  );
}
