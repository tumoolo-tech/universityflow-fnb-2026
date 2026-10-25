import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { type Database, rowsOf } from './client';
import { ConsentRequiredError, InvalidStateError, NotFoundError } from './errors';
import { adultStudent, signIn, syntheticPhone, testDatabase, testStore } from './testing';

/**
 * A10-35: a learner reports an AI reply for a person to look at (Films and Publications Act s24C;
 * the app stores). A report points at the stored reply by id and holds a reason from a fixed list:
 * no text of its own (hard rule 4). Behind row-level security and the consent gate like every
 * learner row, exported with the account and deleted with it.
 */

let database: Database;
let h: ReturnType<typeof testStore>;

beforeAll(async () => {
  database = await testDatabase();
});
afterAll(async () => {
  await database.close();
});
beforeEach(() => {
  h = testStore(database);
});

async function withReply() {
  const session = await adultStudent(h.store);
  const student = h.store.forStudent(session.studentId);
  const conversationId = await student.conversationId();
  const asked = await student.appendMessage({ conversationId, role: 'student', content: 'hi' });
  const reply = await student.appendMessage({
    conversationId,
    role: 'assistant',
    content: 'A synthetic reply.',
  });
  return { ...session, student, asked: asked?.id as string, reply: reply?.id as string };
}

describe('reporting a reply (A10-35)', () => {
  it('records a report of the learner’s own reply once, and says so the second time', async () => {
    const { student, reply } = await withReply();
    expect((await student.reportReply(reply, 'harmful')).status).toBe('reported');
    expect((await student.reportReply(reply, 'wrong')).status).toBe('already-reported');
    expect(await student.reportedReplies()).toEqual([reply]);
    const [row] = rowsOf<{ reason: string }>(
      await h.database.db.execute(
        sql`select reason from reply_reports where message_id = ${reply}::uuid`,
      ),
    );
    expect(row?.reason).toBe('harmful');
  });

  it('logs the report by id and reason only', async () => {
    const { studentId, student, reply } = await withReply();
    await student.reportReply(reply, 'other');
    const audit = rowsOf<{ action: string; reason: string | null }>(
      await h.database.db.execute(
        sql`select action, reason from audit_log where student_id = ${studentId}::uuid and action = 'reply.reported'`,
      ),
    );
    expect(audit).toEqual([{ action: 'reply.reported', reason: 'other' }]);
  });

  it('refuses a learner’s own message, an unknown reason and a malformed id', async () => {
    const { student, asked, reply } = await withReply();
    await expect(student.reportReply(asked, 'harmful')).rejects.toThrow(InvalidStateError);
    await expect(student.reportReply(reply, 'rude' as never)).rejects.toThrow(InvalidStateError);
    await expect(student.reportReply('not-an-id', 'harmful')).rejects.toThrow(NotFoundError);
  });

  it('never reaches another learner’s reply', async () => {
    const { reply } = await withReply();
    const other = await adultStudent(h.store);
    await expect(h.store.forStudent(other.studentId).reportReply(reply, 'harmful')).rejects.toThrow(
      NotFoundError,
    );
    const rows = rowsOf<{ n: number }>(
      await h.database.db.execute(
        sql`select count(*)::int as n from reply_reports where message_id = ${reply}::uuid`,
      ),
    );
    expect(rows[0]?.n).toBe(0);
  });

  it('holds nothing for a minor before a guardian agrees (hard rule 5)', async () => {
    const { studentId } = await signIn(h.store, syntheticPhone());
    await h.store.setDateOfBirth(studentId, '2010-03-03');
    await expect(
      h.store.forStudent(studentId).reportReply('00000000-0000-4000-8000-000000000001', 'harmful'),
    ).rejects.toThrow(ConsentRequiredError);
  });

  it('goes with the export, and is deleted with the account', async () => {
    const { studentId, student, reply } = await withReply();
    await student.reportReply(reply, 'wrong');
    const exported = await student.exportAll();
    expect(exported.personal?.replyReports).toEqual([
      expect.objectContaining({ messageId: reply, reason: 'wrong' }),
    ]);
    await student.deleteAccount();
    const left = rowsOf<{ n: number }>(
      await h.database.db.execute(
        sql`select count(*)::int as n from reply_reports where student_id = ${studentId}::uuid`,
      ),
    );
    expect(left[0]?.n).toBe(0);
  });
});
