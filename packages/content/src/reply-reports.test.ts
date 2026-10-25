import { describe, expect, it } from 'vitest';
import { en } from './en';
import { isReplyReportReason, REPLY_REPORT_REASONS } from './reply-reports';

describe('reasons to report a reply (A10-35)', () => {
  it('has words for every reason, and a reason for every word', () => {
    expect(Object.keys(en.chat.report.reasons).sort()).toEqual([...REPLY_REPORT_REASONS].sort());
    for (const reason of REPLY_REPORT_REASONS) expect(en.chat.report.reasons[reason]).toMatch(/\S/);
  });

  it('knows its own reasons and nothing else', () => {
    expect(isReplyReportReason('harmful')).toBe(true);
    expect(isReplyReportReason('toString')).toBe(false);
    expect(isReplyReportReason(1)).toBe(false);
  });
});
