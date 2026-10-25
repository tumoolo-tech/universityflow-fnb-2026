import { catalogueView } from '@universityflow/catalogue';
import type { ReminderRecord } from '@universityflow/messaging';
import { describe, expect, it } from 'vitest';
import { catalogueResolver } from '../lib/server/reminders';

const reminder = (overrides: Partial<ReminderRecord>): ReminderRecord => ({
  id: '00000000-0000-4000-8000-000000000001',
  studentId: '00000000-0000-4000-8000-000000000002',
  templateId: 'reminder.check-in',
  channel: 'sms',
  params: {},
  desiredAt: new Date('2026-10-14T08:00:00Z'),
  status: 'scheduled',
  reschedules: 0,
  ...overrides,
});
const recipient = { address: 'unused' };
const today = new Date('2026-10-14T08:00:00Z');

describe('catalogueResolver: template variables come from code (hard rule 2)', () => {
  it('never fills a name: no template takes one (A11-02)', () => {
    const resolve = catalogueResolver(() => catalogueView(today, { includeDrafts: false }));
    expect(resolve(reminder({}), recipient)).toEqual({});
    expect(resolve(reminder({ templateId: 'recheck.changed' }), recipient)).toEqual({});
  });

  it('names a subject from the subject list, and refuses an unknown one', () => {
    const resolve = catalogueResolver(() => catalogueView(today, { includeDrafts: false }));
    const study = (subjectId?: string) =>
      reminder({ templateId: 'reminder.study', params: subjectId ? { subjectId } : {} });
    expect(resolve(study('mathematics'), recipient)).toEqual({ subjectName: 'Mathematics' });
    expect(resolve(study('astrology'), recipient)).toBeNull();
    expect(resolve(study(), recipient)).toBeNull();
  });

  it('names a university only from a verified record: never a draft (hard rule 3)', () => {
    const application = (universityId?: string) =>
      reminder({
        templateId: 'reminder.application',
        params: universityId ? { universityId } : {},
      });
    // Every record is still a draft: without the preview flag, no university resolves.
    const verifiedOnly = catalogueResolver(() => catalogueView(today, { includeDrafts: false }));
    expect(verifiedOnly(application('wits'), recipient)).toBeNull();
    const preview = catalogueResolver(() => catalogueView(today, { includeDrafts: true }));
    expect(preview(application('wits'), recipient)).toMatchObject({
      universityName: expect.stringMatching(/Witwatersrand/),
    });
    expect(preview(application('hogwarts'), recipient)).toBeNull();
    expect(preview(application(), recipient)).toBeNull();
  });
});
