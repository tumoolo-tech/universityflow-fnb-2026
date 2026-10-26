import { APPLICATION_CHECKLIST } from '@universityflow/agent';
import { catalogueView } from '@universityflow/catalogue';
import type { StudentStore } from '@universityflow/db';
import { describe, expect, it } from 'vitest';
import { applicationSummaries } from '@/lib/server/applications';

/**
 * The applications summary (the home's tiles and /applications) asks for every university's
 * checklist at once: one wait for the database, not one per university. On the judge demo each
 * wait is a round trip from Cape Town to London (the slow home, 2026-10-25).
 */

const NOW = new Date('2026-10-23T08:00:00Z');
const VIEW = catalogueView(NOW, { includeDrafts: true });
const FIRST = APPLICATION_CHECKLIST[0];

describe('applicationSummaries', () => {
  it('reads every university’s checklist at the same time, keeping the catalogue’s order', async () => {
    let inFlight = 0;
    let peak = 0;
    const asked: string[] = [];
    const student = {
      shortlist: async () =>
        ['wits-bcom', 'uj-ba', 'uct-bsc-computer-science'].map((programmeId, i) => ({
          programmeId,
          rank: i + 1,
        })),
      applications: async () => [],
      latestReport: async () => null,
      profile: async () => null,
      checklist: async (scope: string) => {
        asked.push(scope);
        peak = Math.max(peak, ++inFlight);
        await new Promise((resolve) => setTimeout(resolve, 10));
        inFlight--;
        return scope === 'application:uj' ? [{ item: FIRST, doneAt: NOW }] : [];
      },
    } as unknown as StudentStore;

    const { applications } = await applicationSummaries(student, VIEW, NOW);

    expect(asked).toHaveLength(3);
    expect(peak).toBe(3);
    const order = VIEW.universities
      .map((u) => u.id)
      .filter((id) => ['wits', 'uj', 'uct'].includes(id));
    expect(applications.map((a) => a.university.id)).toEqual(order);
    // Each university gets its own checklist back, not another's.
    for (const a of applications) {
      expect(a.checklist.find((c) => c.item === FIRST)?.done, a.university.id).toBe(
        a.university.id === 'uj',
      );
    }
  });
});
