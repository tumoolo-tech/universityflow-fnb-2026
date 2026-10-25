import { describe, expect, it } from 'vitest';
import { documentType } from './document-types';

describe('documentType', () => {
  it('accepts the report that starts the journey', () => {
    expect(documentType.parse('grade-11-report')).toBe('grade-11-report');
  });

  it('accepts a module outline (Phase 6b)', () => {
    expect(documentType.parse('module-outline')).toBe('module-outline');
  });

  it('rejects anything it has no extraction schema for', () => {
    expect(documentType.safeParse('id-document').success).toBe(false);
  });
});
