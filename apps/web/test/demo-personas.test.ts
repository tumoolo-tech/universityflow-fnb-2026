import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  catalogueView,
  isDraft,
  programmeById,
  RAW_CATALOGUE,
  universityById,
} from '@universityflow/catalogue';
import { en, FIRST_WEEK_STEPS } from '@universityflow/content';
import {
  AGE_OF_MAJORITY,
  ageOn,
  ConsentOutdatedError,
  type Database,
  migrate,
  openDatabase,
  Store,
  StudentStore,
  sastDate,
} from '@universityflow/db';
import { draftFromModuleOutline, sampleModuleOutline } from '@universityflow/documents';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { showsComingNext } from '@/components/coming-next';
import { DEMO_DRAFT_ADULT_CONSENT_VERSION } from '@/lib/server/demo/outline-consent';
import { cloneDemoPersona, DEMO_PERSONAS, demoPersona, together } from '@/lib/server/demo/personas';
import { type DemoPersonaId, isDemoPersonaId } from '@/lib/server/demo/types';
import { homeData } from '@/lib/server/home';

/**
 * The judges' demo personas (scratchpad demo-spec, "Seed"): six made-up learners, each cloned
 * into a brand-new private student through the store's own methods, so every consent rule,
 * row-level security policy and audit row applies (hard rule 5). Real embedded Postgres.
 */

const NOW = new Date('2026-10-23T08:00:00Z');
const VIEW = catalogueView(NOW, { includeDrafts: true });
const FIXTURE = JSON.parse(
  readFileSync(
    fileURLToPath(
      new URL('../../../packages/documents/fixtures/sample-results.json', import.meta.url),
    ),
    'utf8',
  ),
) as { learners: Array<{ examNumber: string; reports: Array<{ period: string }> }> };

const IDS: DemoPersonaId[] = [
  'demo-grade-10',
  'demo-grade-11',
  'demo-grade-12',
  'demo-first-year',
  'demo-second-year',
  'demo-final-year',
];

let database: Database;
let store: Store;

beforeAll(async () => {
  database = openDatabase('pglite:memory');
  await migrate(database);
  store = new Store(database, { secret: 's'.repeat(40), clock: () => NOW });
});

afterAll(async () => {
  await database.close();
});

/** Everything a persona's story is made of, without ids or times, to compare two clones. */
async function snapshot(studentId: string) {
  const s = store.forStudent(studentId);
  const account = await store.account(studentId);
  const profile = await s.profile();
  const registration = await s.registration();
  const firstWeek = registration
    ? (await s.firstWeekSteps(registration.universityId)).map((f) => f.step).sort()
    : [];
  return {
    dateOfBirth: account.dateOfBirth,
    consent: account.consentStatus,
    profile: profile && {
      displayName: profile.displayName,
      grade: profile.grade,
      theme: profile.theme,
      avatar: profile.avatar,
      taglineId: profile.taglineId,
      badgeIds: profile.badgeIds,
    },
    reports: (await s.recentReports(12)).map((r) => ({ kind: r.kind, marks: r.marks })),
    goal: (await s.goal())?.programmeId ?? null,
    shortlist: (await s.shortlist()).map((r) => r.programmeId),
    applications: (await s.applications()).map((a) => [a.universityId, a.status]),
    nsfas: (await s.checklist('funding:nsfas')).map((c) => c.item).sort(),
    offers: (await s.offers()).map((o) => [o.programmeId, o.kind, o.status]),
    registration: registration && {
      programmeId: registration.programmeId,
      academicYear: registration.academicYear,
      yearOfStudy: registration.yearOfStudy,
      modules: registration.modules,
    },
    firstWeek,
    planMaps: (await s.planMaps()).map((m) => ({
      templateId: m.templateId,
      linksGoal: m.linksGoal,
      nodes: m.nodes.map((n) => [n.slotId, n.status, n.text, n.targetMonth]),
    })),
  };
}

async function home(studentId: string) {
  const account = await store.account(studentId);
  return homeData(store.forStudent(studentId), VIEW, NOW, account);
}

describe('the six demo personas', () => {
  it('are the six fixed ids, in journey order, each with a card from content', () => {
    expect(DEMO_PERSONAS.map((p) => p.id)).toEqual(IDS);
    for (const p of DEMO_PERSONAS) {
      const words = en.demoPersonas.personas[p.id];
      expect(p).toMatchObject({ name: words.name, stage: words.stage, tryThis: words.tryThis });
      expect(isDemoPersonaId(p.id)).toBe(true);
      expect(demoPersona(p.id)).toBe(p);
    }
    expect(isDemoPersonaId('demo-grade-9')).toBe(false);
    expect(isDemoPersonaId(undefined)).toBe(false);
  });

  it('name the university of each university year from the catalogue: UJ, Wits, UCT', () => {
    const named = Object.fromEntries(DEMO_PERSONAS.map((p) => [p.id, p.university]));
    expect(named).toEqual({
      'demo-grade-10': undefined,
      'demo-grade-11': undefined,
      'demo-grade-12': undefined,
      'demo-first-year': universityById(VIEW, 'uj')?.name,
      'demo-second-year': universityById(VIEW, 'wits')?.name,
      'demo-final-year': universityById(VIEW, 'uct')?.name,
    });
  });

  it('take their marks from the generator’s synthetic learners (hard rule 4)', () => {
    for (const p of DEMO_PERSONAS) {
      if (!p.sampleExamNumber) continue;
      expect(p.sampleExamNumber).toMatch(/^SAMPLE-[A-HJ-NP-Z2-9]{6}$/);
      expect(FIXTURE.learners.map((l) => l.examNumber)).toContain(p.sampleExamNumber);
    }
  });

  it('refuse an id that is not a persona, creating nothing', async () => {
    await expect(cloneDemoPersona(store, 'demo-grade-9' as DemoPersonaId, NOW)).rejects.toThrow();
  });
});

describe.each(IDS)('cloning %s', (id) => {
  let studentId: string;

  beforeAll(async () => {
    studentId = await cloneDemoPersona(store, id, NOW);
  }, 60_000);

  it('makes a new student whose data may be processed: consent recorded first (hard rule 5)', async () => {
    expect(studentId).toMatch(/^[0-9a-f-]{36}$/);
    const account = await store.account(studentId);
    expect(account.needsAdultConsent).toBe(false);
    expect(await store.forStudent(studentId).mayProcess()).toBe(true);
    const age = ageOn(account.dateOfBirth ?? '', sastDate(NOW));
    const history = (await store.forStudent(studentId).exportAll()).accessHistory;
    const actions = history.map((h) => `${h.actorType}:${h.action}`);
    if (id.startsWith('demo-grade-')) {
      // A minor (about 15, 16, 17): a guardian's consent, granted through the link's own method.
      expect(age).toBeLessThan(AGE_OF_MAJORITY);
      const ages: Partial<Record<DemoPersonaId, number>> = {
        'demo-grade-10': 15,
        'demo-grade-11': 16,
        'demo-grade-12': 17,
      };
      expect(age).toBe(ages[id]);
      expect(account.consentStatus).toBe('granted');
      expect(actions).toContain('student:consent.requested');
      expect(actions).toContain('guardian:consent.granted');
    } else {
      expect(age).toBeGreaterThanOrEqual(AGE_OF_MAJORITY);
      expect(account.consentStatus).toBe('not-required');
      expect(actions).toContain('student:consent.adult');
    }
    expect(actions).toContain('student:account.created');
  });

  it('a university year records the DRAFT adult-v3, so the SAMPLE module outline uploads (hackathon exception I); a school year the live wording', async () => {
    const student = store.forStudent(studentId);
    const exported = await student.exportAll();
    const upload = {
      kind: 'module-outline',
      storageKey: `outline-${crypto.randomUUID()}`,
      mimeType: 'application/pdf',
      sizeBytes: 10,
    };
    if (id.startsWith('demo-grade-')) {
      // The production gate is untouched: a school-year persona's live wording doesn't name outlines.
      await expect(student.addDocument(upload)).rejects.toThrow(ConsentOutdatedError);
      return;
    }
    expect(exported.account?.adultConsentVersion).toBe(DEMO_DRAFT_ADULT_CONSENT_VERSION);
    const document = await student.addDocument(upload);
    const registration = await student.registration();
    const year =
      (registration?.yearOfStudy ?? 1) >= 3 ? 3 : ((registration?.yearOfStudy ?? 1) as 1 | 2);
    const draft = draftFromModuleOutline(sampleModuleOutline(year));
    // The sample is the first module on the persona's own made-up registration.
    expect(registration?.modules[0]?.code).toBe(draft.moduleCode);
    const saved = await student.saveModuleOutline({
      moduleCode: draft.moduleCode ?? '',
      moduleName: draft.moduleName,
      academicYear: registration?.academicYear ?? 2026,
      term: draft.term,
      components: {
        status: 'confirmed',
        items: draft.components.map((c) => ({
          name: c.name,
          kind: c.kind ?? 'other',
          weight: c.weight ?? 0,
          subminimum: c.subminimum,
        })),
        dpRequirement: { percent: draft.dpPercent, quote: draft.dpQuote },
        examSubminimum: draft.examSubminimum,
        supplementaryQuote: draft.supplementaryQuote,
      },
      dates: { status: 'not-in-outline' },
      books: { status: 'not-in-outline' },
      people: { status: 'not-in-outline' },
      documentId: document?.id ?? null,
    });
    expect(saved.fileKey).toBe(upload.storageKey);
  });

  it('builds the home without an error, with the persona’s name and look', async () => {
    const data = await home(studentId);
    const persona = demoPersona(id);
    expect(data.name).toBe(persona.name);
    expect(data.look.avatar).not.toBe('initials');
  });

  it('keeps plan maps to ticks: no words of their own (the words switch stays off)', async () => {
    const maps = await store.forStudent(studentId).planMaps();
    expect(maps.length).toBe(1);
    const nodes = maps.flatMap((m) => m.nodes);
    expect(nodes.every((n) => n.text === null && n.whyNot === null)).toBe(true);
    expect(nodes.some((n) => n.status === 'achieved')).toBe(true);
    expect(maps[0]?.title).toBeNull();
  });

  it('names only courses the catalogue holds (hard rule 2)', async () => {
    const snap = await snapshot(studentId);
    const programmes = [
      snap.goal,
      ...snap.shortlist,
      ...snap.offers.map((o) => o[0] as string),
      snap.registration?.programmeId,
    ].filter((p): p is string => typeof p === 'string');
    for (const p of programmes) expect(programmeById(VIEW, p), p).toBeDefined();
  });

  // A2-61 (DEMO-walk): as /api/me/goal and the agent's set_goal do, a goal is on the shortlist,
  // so the goal card's "Open the … application pack" link opens a pack rather than a 404.
  it('keeps its goal on its shortlist, as the app does (A2-61)', async () => {
    const snap = await snapshot(studentId);
    if (snap.goal) expect(snap.shortlist).toContain(snap.goal);
  });

  it('never invents a module: a catalogue code, or a row labelled as a demo sample', async () => {
    const registration = await store.forStudent(studentId).registration();
    const codes = new Set(
      RAW_CATALOGUE.curricula.flatMap((c) => c.modules.flatMap((m) => [m.code])),
    );
    for (const m of registration?.modules ?? []) {
      if (codes.has(m.code)) continue;
      expect(m.code).toMatch(/^DEMO\d{4}$/);
      expect(m.name).toMatch(/\(demo\)$/);
      expect(m.credits).toBeNull();
    }
  });
});

describe('each persona’s story', () => {
  const clone = (id: DemoPersonaId) => cloneDemoPersona(store, id, NOW);

  it('Thabo, Grade 10: Stage 0, his subjects checked, a goal he is on track for', async () => {
    const data = await home(await clone('demo-grade-10'));
    expect(data.stage).toBe('grade-10');
    expect(data.subjects).not.toBeNull();
    expect(data.subjects?.status).toBe('some-closed');
    expect(data.qualify).toMatchObject({ basis: 'progress', now: 0, planB: 0 });
    expect(data.qualify?.onTrack).toBeGreaterThan(0);
    expect(data.goalProgrammeId).not.toBeNull();
    expect(data.marks.map((m) => m.kind)).toEqual(['grade-10-final']);
    expect(data.next).toEqual({ id: 'study', href: '/goals#practice' });
  });

  it('Naledi, Grade 11: on track and close, a goal and a shortlist of three', async () => {
    const data = await home(await clone('demo-grade-11'));
    expect(data.stage).toBe('grade-11');
    expect(data.qualify?.basis).toBe('progress');
    expect(data.qualify?.onTrack).toBeGreaterThan(0);
    expect(data.qualify?.close).toBeGreaterThan(0);
    expect(data.shortlist.length).toBe(3);
    expect(new Set(data.shortlist.map((s) => s.verdict))).toEqual(new Set(['onTrack', 'close']));
    expect(data.goalProgrammeId).not.toBeNull();
  });

  // A2-62 (DEMO-walk): her unfinished application is one whose window is still open on the
  // judging day (UJ closes 31 October 2026), never Wits' (closed 30 September), so her next step
  // is one a judge can act on.
  it('Amahle, Grade 12: Qualify now, Close and Plan B; two applications under way; NSFAS', async () => {
    const id = await clone('demo-grade-12');
    const data = await home(id);
    expect(data.stage).toBe('matric');
    expect(data.qualify?.basis).toBe('admission');
    expect(data.qualify?.now).toBeGreaterThan(0);
    expect(data.qualify?.close).toBeGreaterThan(0);
    expect(data.qualify?.planB).toBeGreaterThan(0);
    expect(new Set(data.shortlist.map((s) => s.verdict))).toEqual(
      new Set(['qualifyNow', 'close', 'planB']),
    );
    expect(data.applications.map((a) => [a.universityId, a.status]).sort()).toEqual([
      ['uj', 'in-progress'],
      ['wits', 'submitted'],
    ]);
    const uj = data.applications.find((a) => a.universityId === 'uj');
    expect(uj?.done).toBeGreaterThan(0);
    expect(uj?.done).toBeLessThan(uj?.total ?? 0);
    const window = VIEW.windows.find((w) => w.universityId === 'uj');
    expect(window?.closesOn ?? '').toBeTruthy();
    expect((window?.closesOn ?? '') >= sastDate(NOW)).toBe(true);
    expect(data.marks.map((m) => m.kind)).toEqual([
      'grade-11-final',
      'grade-12-june',
      'grade-12-september',
    ]);
    expect((await snapshot(id)).nsfas.length).toBeGreaterThan(0);
    expect(data.next).toEqual({
      id: 'checklist',
      href: '/applications/uj',
      universityName: 'UJ',
    });
  });

  it('Lerato, first year at UJ: an accepted offer, modules confirmed, first week part done', async () => {
    const id = await clone('demo-first-year');
    const data = await home(id);
    expect(data.stage).toBe('university');
    expect(data.offers.map((o) => o.status).sort()).toEqual(['accepted', 'declined']);
    const accepted = (await store.forStudent(id).offers()).find((o) => o.status === 'accepted');
    expect(accepted?.universityId).toBe('uj');
    expect(data.modules?.confirmed).toBeGreaterThan(0);
    expect(data.firstWeek?.done).toBeGreaterThan(0);
    expect(data.firstWeek?.done).toBeLessThan(data.firstWeek?.total ?? 0);
    expect(data.next).toEqual({ id: 'first-week', href: '/first-week' });
    const registration = await store.forStudent(id).registration();
    // Confirmed in October, a registration is for next year (registration.ts likelyAcademicYear).
    expect(registration).toMatchObject({ universityId: 'uj', academicYear: 2027, yearOfStudy: 1 });
    expect(showsComingNext(data)).toBe(false);
    // An arrival, as the home has always been for a first year (A2-66).
    expect(data.universityYear).toMatchObject({ group: 'arriving', yearOfStudy: 1 });
  });

  // A2-66 (DEMO-walk): Sipho and Kagiso got an arriving student's home, its next step the campus
  // tour "before your first day". Their year comes from the registration and the course's
  // duration in the catalogue (wits-bcom and uct-bsc-computer-science: three years).
  it.each([
    ['demo-second-year', 'wits', 2, 'middle'],
    ['demo-final-year', 'uct', 3, 'final'],
  ] as const)(
    '%s: registered at %s in year %i, a %s year: the modules and the plan, not an arrival’s home (A2-66)',
    async (persona, _university, year, group) => {
      const id = await clone(persona);
      const data = await home(id);
      const registration = await store.forStudent(id).registration();
      const programme = programmeById(VIEW, registration?.programmeId ?? '');
      expect(programme?.durationYears).toBe(3);
      expect(data.universityYear).toEqual({
        group,
        yearOfStudy: year,
        draft: group === 'final' && programme !== undefined && isDraft(programme),
      });
      expect(data.next).toEqual({ id: 'plan', href: '/goals' });
    },
  );

  it.each([
    ['demo-second-year', 'wits', 2],
    ['demo-final-year', 'uct', 3],
  ] as const)(
    '%s: registered at %s in year %i, first week behind them, the "coming next" cards',
    async (persona, university, year) => {
      const id = await clone(persona);
      const data = await home(id);
      expect(data.stage).toBe('university');
      const registration = await store.forStudent(id).registration();
      expect(registration).toMatchObject({
        universityId: university,
        academicYear: 2026,
        yearOfStudy: year,
      });
      expect(data.firstWeek).toEqual({
        done: FIRST_WEEK_STEPS.length,
        total: FIRST_WEEK_STEPS.length,
      });
      expect(data.modules?.confirmed).toBeGreaterThan(0);
      expect(showsComingNext(data)).toBe(true);
    },
  );
});

describe('a judge’s copy', () => {
  it('is a new, separate student each time: changing one leaves the other as it was', async () => {
    const a = await cloneDemoPersona(store, 'demo-grade-11', NOW);
    const b = await cloneDemoPersona(store, 'demo-grade-11', NOW);
    expect(a).not.toBe(b);
    const before = await snapshot(b);
    await store.forStudent(a).setGoal('wits-bcom');
    await store.forStudent(a).addToShortlist('uj-ba');
    expect(await snapshot(b)).toEqual(before);
    expect((await snapshot(a)).goal).toBe('wits-bcom');
  });

  it('is deterministic: two clones of a persona hold exactly the same story', async () => {
    for (const id of IDS) {
      const a = await snapshot(await cloneDemoPersona(store, id, NOW));
      const b = await snapshot(await cloneDemoPersona(store, id, NOW));
      expect(a, id).toEqual(b);
    }
  }, 120_000);
});

describe('making a copy quickly (the slow start, 2026-10-25)', () => {
  /** Counts the calls of these StudentStore methods in flight at once, each and all together. */
  function inFlight(names: ReadonlyArray<keyof StudentStore>) {
    const peak = new Map<string, number>();
    const now = new Map<string, number>();
    let all = 0;
    let allPeak = 0;
    const proto = StudentStore.prototype as unknown as Record<
      string,
      (...args: unknown[]) => Promise<unknown>
    >;
    const spies = names.map((name) => {
      const real = proto[name] as (...args: unknown[]) => Promise<unknown>;
      return vi.spyOn(proto, name as string).mockImplementation(async function (
        this: unknown,
        ...args: unknown[]
      ) {
        now.set(name, (now.get(name) ?? 0) + 1);
        peak.set(name, Math.max(peak.get(name) ?? 0, now.get(name) ?? 0));
        allPeak = Math.max(allPeak, ++all);
        try {
          return await real.apply(this, args);
        } finally {
          now.set(name, (now.get(name) ?? 0) - 1);
          all--;
        }
      });
    });
    return {
      peak: (name: string) => peak.get(name) ?? 0,
      allPeak: () => allPeak,
      restore: () => {
        for (const spy of spies) spy.mockRestore();
      },
    };
  }

  it('writes what doesn’t depend on each other at the same time, and keeps ordered things in order', async () => {
    const seen = inFlight([
      'updateProfile',
      'saveConfirmedReport',
      'setGoal',
      'addToShortlist',
      'updateApplication',
      'setChecklistItem',
      'createPlanMap',
      'savePlanNode',
    ]);
    let studentId: string;
    try {
      studentId = await cloneDemoPersona(store, 'demo-grade-12', NOW);
    } finally {
      seen.restore();
    }
    // One after another, the copy waited for every write in turn: 20 to 40 seconds on the live demo.
    expect(seen.allPeak()).toBeGreaterThan(4);
    expect(seen.peak('setChecklistItem')).toBeGreaterThan(1);
    // "The latest report" is the last confirmed, and each shortlist rank follows the last.
    expect(seen.peak('saveConfirmedReport')).toBe(1);
    expect(seen.peak('addToShortlist')).toBe(1);
    expect((await store.forStudent(studentId).shortlist()).map((s) => s.rank)).toEqual([
      1, 2, 3, 4,
    ]);
  });

  it('keeps a university year’s offers in the order made, and answers them together', async () => {
    const seen = inFlight(['addOffer', 'acceptOffer', 'declineOffer', 'setFirstWeekStep']);
    let studentId: string;
    try {
      studentId = await cloneDemoPersona(store, 'demo-first-year', NOW);
    } finally {
      seen.restore();
    }
    expect(seen.peak('addOffer')).toBe(1);
    expect(seen.peak('setFirstWeekStep')).toBeGreaterThan(1);
    const offers = await store.forStudent(studentId).offers();
    expect(offers.map((o) => [o.programmeId, o.status])).toEqual([
      ['uj-bsc-it-computer-science', 'accepted'],
      ['wits-bsc-computer-science', 'declined'],
    ]);
  });

  it('deletes a copy whose seed fails only once every write has ended', async () => {
    const order: string[] = [];
    const failing = vi
      .spyOn(StudentStore.prototype, 'createPlanMap')
      .mockRejectedValue(new Error('synthetic failure'));
    const saveConfirmedReport = StudentStore.prototype.saveConfirmedReport;
    const slow = vi
      .spyOn(StudentStore.prototype, 'saveConfirmedReport')
      .mockImplementation(async function (this: StudentStore, input) {
        await new Promise((resolve) => setTimeout(resolve, 50));
        try {
          return await saveConfirmedReport.call(this, input);
        } finally {
          order.push('report ended');
        }
      });
    const deleteAccount = StudentStore.prototype.deleteAccount;
    const deleted = vi
      .spyOn(StudentStore.prototype, 'deleteAccount')
      .mockImplementation(async function (this: StudentStore) {
        order.push('deleted');
        return deleteAccount.call(this);
      });
    try {
      await expect(cloneDemoPersona(store, 'demo-grade-11', NOW)).rejects.toThrow(
        'synthetic failure',
      );
    } finally {
      failing.mockRestore();
      slow.mockRestore();
      deleted.mockRestore();
    }
    // Naledi has reports: each ends (stored, or refused once the copy is gone) before the delete.
    expect(order.at(-1)).toBe('deleted');
    expect(order.filter((o) => o === 'deleted')).toHaveLength(1);
    expect(order).toContain('report ended');
  });
});

describe('together', () => {
  it('waits for every task, then raises the first failure', async () => {
    const ended: string[] = [];
    const late = new Promise((resolve) => setTimeout(resolve, 30)).then(() => ended.push('late'));
    await expect(together([Promise.reject(new Error('first')), late])).rejects.toThrow('first');
    expect(ended).toEqual(['late']);
  });

  it('resolves when every task does', async () => {
    await expect(together([Promise.resolve(1), Promise.resolve(2)])).resolves.toBeUndefined();
  });
});
