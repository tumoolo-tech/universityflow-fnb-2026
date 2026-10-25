import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { type Database, rowsOf } from './client';
import { InvalidStateError } from './errors';
import { adultStudent, testDatabase, testStore } from './testing';

/**
 * A10-49 (migration 0036): which provider wrote each AI reply, on the stored reply and on a report
 * of it, so a person looking at a report knows which provider's output it was. A provider name and
 * a model id only (hard rule 4). 'system' is a reply no model wrote (the reviewed crisis reply, or
 * our own kind line), with no model id. Null on both: not recorded (every row before 0036).
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

async function learner() {
  const session = await adultStudent(h.store);
  const student = h.store.forStudent(session.studentId);
  const conversationId = await student.conversationId();
  return { ...session, student, conversationId };
}

async function writerOf(id: string) {
  const [row] = rowsOf<{ reply_provider: string | null; reply_model: string | null }>(
    await h.database.db.execute(
      sql`select reply_provider, reply_model from messages where id = ${id}::uuid`,
    ),
  );
  return row;
}

/** A raw insert as the database owner, past the store, to prove the database's own checks. */
async function rawInsert(studentId: string, conversationId: string, values: string) {
  await h.database.exec(
    `insert into messages (conversation_id, student_id, role, content, reply_provider, reply_model)
     values ('${conversationId}', '${studentId}', ${values})`,
  );
}

describe('the stored reply says who wrote it (A10-49)', () => {
  it('records the provider and model id of a reply, and gives them back with the history', async () => {
    const { student, conversationId } = await learner();
    const reply = await student.appendMessage({
      conversationId,
      role: 'assistant',
      content: 'A synthetic reply.',
      writtenBy: { provider: 'anthropic', model: 'claude-test-model' },
    });
    expect(await writerOf(reply?.id as string)).toEqual({
      reply_provider: 'anthropic',
      reply_model: 'claude-test-model',
    });
    const [stored] = await student.history(conversationId);
    expect(stored).toMatchObject({ replyProvider: 'anthropic', replyModel: 'claude-test-model' });
  });

  it('records a reply no model wrote as the system, with no model id', async () => {
    const { student, conversationId } = await learner();
    const reply = await student.appendMessage({
      conversationId,
      role: 'assistant',
      content: 'A synthetic crisis reply.',
      crisis: true,
      writtenBy: { provider: 'system', model: null },
    });
    expect(await writerOf(reply?.id as string)).toEqual({
      reply_provider: 'system',
      reply_model: null,
    });
  });

  it('leaves a reply written without a writer as not recorded (null), never a guess', async () => {
    const { student, conversationId } = await learner();
    const reply = await student.appendMessage({
      conversationId,
      role: 'assistant',
      content: 'A synthetic reply.',
    });
    expect(await writerOf(reply?.id as string)).toEqual({
      reply_provider: null,
      reply_model: null,
    });
  });

  it('keeps the provider but not a model id that is not one (it could hold anything)', async () => {
    const { student, conversationId } = await learner();
    const reply = await student.appendMessage({
      conversationId,
      role: 'assistant',
      content: 'A synthetic reply.',
      writtenBy: { provider: 'gemini', model: 'not a model id <b>' },
    });
    expect(await writerOf(reply?.id as string)).toEqual({
      reply_provider: 'gemini',
      reply_model: null,
    });
  });

  it('refuses a writer on the learner’s own message', async () => {
    const { student, conversationId } = await learner();
    await expect(
      student.appendMessage({
        conversationId,
        role: 'student',
        content: 'hi',
        writtenBy: { provider: 'anthropic', model: 'claude-test-model' },
      }),
    ).rejects.toThrow(InvalidStateError);
  });

  it('refuses an unknown provider', async () => {
    const { student, conversationId } = await learner();
    await expect(
      student.appendMessage({
        conversationId,
        role: 'assistant',
        content: 'A synthetic reply.',
        writtenBy: { provider: 'someone' as never, model: 'm' },
      }),
    ).rejects.toThrow(InvalidStateError);
  });

  it('the database itself refuses a writer it should never hold', async () => {
    const { studentId, conversationId } = await learner();
    // An unknown provider; a model id on the system; a writer on the learner's own message; a
    // model id with no provider; a model id that is not one.
    for (const values of [
      `'assistant', 'x', 'someone', 'm'`,
      `'assistant', 'x', 'system', 'claude-test-model'`,
      `'student', 'x', 'anthropic', 'claude-test-model'`,
      `'assistant', 'x', null, 'claude-test-model'`,
      `'assistant', 'x', 'anthropic', 'has spaces in it'`,
    ]) {
      await expect(rawInsert(studentId, conversationId, values)).rejects.toThrow();
    }
    // And takes each kind it should.
    for (const values of [
      `'assistant', 'x', 'anthropic', 'claude-opus-5'`,
      `'assistant', 'x', 'gemini', 'gemini-3.8-flash'`,
      `'assistant', 'x', 'local', 'sample-chat-model'`,
      `'assistant', 'x', 'system', null`,
      `'assistant', 'x', 'anthropic', null`,
      `'assistant', 'x', null, null`,
      `'student', 'x', null, null`,
    ]) {
      await rawInsert(studentId, conversationId, values);
    }
  });
});

describe('a report says who wrote the reported reply (A10-49)', () => {
  it('copies the reply’s provider and model id onto the report, and says them back', async () => {
    const { student, conversationId } = await learner();
    const reply = await student.appendMessage({
      conversationId,
      role: 'assistant',
      content: 'A synthetic reply.',
      writtenBy: { provider: 'gemini', model: 'gemini-test-model' },
    });
    const id = reply?.id as string;
    expect(await student.reportReply(id, 'wrong')).toEqual({
      status: 'reported',
      writtenBy: { provider: 'gemini', model: 'gemini-test-model' },
    });
    const [row] = rowsOf<{ reply_provider: string | null; reply_model: string | null }>(
      await h.database.db.execute(
        sql`select reply_provider, reply_model from reply_reports where message_id = ${id}::uuid`,
      ),
    );
    expect(row).toEqual({ reply_provider: 'gemini', reply_model: 'gemini-test-model' });
    expect((await student.reportReply(id, 'harmful')).status).toBe('already-reported');
  });

  it('a reply whose writer was not recorded is reported as not recorded', async () => {
    const { student, conversationId } = await learner();
    const reply = await student.appendMessage({
      conversationId,
      role: 'assistant',
      content: 'A synthetic reply.',
    });
    expect(await student.reportReply(reply?.id as string, 'other')).toEqual({
      status: 'reported',
      writtenBy: null,
    });
  });

  it('the database refuses a report whose writer is not one', async () => {
    const { studentId, student, conversationId } = await learner();
    const reply = await student.appendMessage({
      conversationId,
      role: 'assistant',
      content: 'A synthetic reply.',
    });
    await expect(
      h.database.exec(
        `insert into reply_reports (student_id, message_id, reason, reply_provider, reply_model)
         values ('${studentId}', '${reply?.id}', 'other', 'system', 'claude-test-model')`,
      ),
    ).rejects.toThrow();
  });
});
