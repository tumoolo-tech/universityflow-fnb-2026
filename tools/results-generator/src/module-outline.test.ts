import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  draftFromModuleOutline,
  isGeneratedSamplePdf,
  SAMPLE_NOTICE,
  SampleModuleOutlineReader,
  sampleModuleOutline,
} from '@universityflow/documents';
import { describe, expect, it } from 'vitest';
import { demoOutlinePdf, demoOutlinesSource } from './module-outline';
import { readTextRuns } from './pdf-text';

/**
 * The SAMPLE module outlines judge demo mode offers (Phase 6b): plainly samples, accepted by the
 * demo's sample-only upload check, carrying exactly the stand-in reader's values, and committed
 * into the web app unchanged.
 */

const WEB_MODULE = fileURLToPath(
  new URL('../../../apps/web/lib/server/demo/sample-outlines.ts', import.meta.url),
);

describe('the demo sample module outlines', () => {
  it.each([1, 2, 3] as const)(
    'year %s: a generated sample, SAMPLE on it, made-up throughout',
    (year) => {
      const bytes = demoOutlinePdf(year);
      expect(isGeneratedSamplePdf(bytes)).toBe(true);
      const text = readTextRuns(bytes)
        .map((r) => r.text)
        .join('\n');
      expect(text).toContain(SAMPLE_NOTICE);
      expect(text).toContain(`DEMO${year}001`);
      expect(text).toContain('Dr A. Sample (made-up)');
      expect(text).toContain('a.sample@example.org');
      expect(text).toContain('Sample Student 1 (made-up)');
      // Every value the stand-in reader returns for it is printed on it.
      const outline = sampleModuleOutline(year);
      for (const c of outline.components) expect(text).toContain(c.name);
      for (const d of outline.dates) expect(text).toContain(d.dateAsPrinted);
    },
  );

  it('the stand-in reader reads each as its own year, and the draft drops the class list', async () => {
    const reader = new SampleModuleOutlineReader();
    for (const year of [1, 2, 3] as const) {
      const extracted = await reader.read({
        bytes: demoOutlinePdf(year),
        mimeType: 'application/pdf',
      });
      expect(extracted).toEqual(sampleModuleOutline(year));
      expect(JSON.stringify(draftFromModuleOutline(extracted))).not.toContain('Sample Student');
    }
  });

  it('the web app holds exactly what the generator makes', () => {
    expect(readFileSync(WEB_MODULE, 'utf8')).toBe(demoOutlinesSource());
  });
});
