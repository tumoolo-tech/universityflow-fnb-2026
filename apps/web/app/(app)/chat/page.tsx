import type { Artifact } from '@universityflow/agent';
import { en } from '@universityflow/content';
import { chatWelcome } from '@universityflow/ui';
import type { Metadata } from 'next';
import { learnerPlace } from '@/lib/server/learner-place';
import { getServices } from '@/lib/server/services';
import { readyStudent } from '@/lib/server/session';
import { Chat, type ChatMessage } from './chat';

export const metadata: Metadata = { title: en.chat.title };

export default async function ChatPage() {
  const signed = await readyStudent();
  const { student } = signed;
  const { model, catalogue } = await getServices();
  const conversationId = await student.conversationId();
  const [history, profile, report, reported, place] = await Promise.all([
    student.history(conversationId, 60),
    student.profile(),
    student.latestReport(),
    student.reportedReplies(),
    // Where the learner is: a student at university is never asked for a school report (A2-66).
    learnerPlace(student, catalogue()),
  ]);
  const isReported = new Set(reported);
  const messages: ChatMessage[] = history.map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content,
    artifacts: m.artifacts as Artifact[],
    reported: isReported.has(m.id),
  }));
  return (
    <Chat
      initial={messages}
      name={profile?.displayName?.trim() || null}
      hasReport={report !== null}
      sample={model.isSample}
      welcome={chatWelcome(place.stage, place.universityYear?.group ?? null)}
    />
  );
}
