import { describe, expect, it } from 'vitest';
import {
  type Bursary,
  bursariesFor,
  bursarySchema,
  bursaryStatus,
  FUNDER_KINDS,
  FUNDING_FIELDS,
} from './bursary';
import { catalogueView, catalogueViewOf, RAW_CATALOGUE } from './catalogue';
import { isDraft } from './provenance';

/**
 * Bursaries beside NSFAS (planning.md §2.4, §3 Stage 2 "NSFAS and bursaries in the same view",
 * §9.1 "Funding first-class"). Each is a draft researched from the funder's own page (or the
 * administrator the funder names), holding only what that page prints: a date it doesn't print is
 * recorded as not published, never guessed. Only a person adds verifiedOn / verifiedBy.
 */

const RAW = RAW_CATALOGUE.bursaries ?? [];

/**
 * The official site each record cites: the funder's own, or the administrator the funder names
 * (StudyTrust runs the FirstRand Empowerment Foundation, Investec and Old Mutual Imfundo Trust
 * bursaries). Never a bursary directory or a news site.
 */
const OFFICIAL_HOSTS: Readonly<Record<string, ReadonlyArray<string>>> = {
  'funza-lushaka': ['funzalushaka.doe.gov.za'],
  isfap: ['isfap.org.za'],
  thuthuka: ['saica.org.za'],
  sasol: ['sasol.com'],
  'allan-gray-orbis': ['allangrayorbis.org'],
  moshal: ['moshalprogram.org.za'],
  'firstrand-empowerment-foundation': ['studytrust.org.za'],
  'investec-csi': ['studytrust.org.za'],
  'old-mutual-imfundo-trust': ['studytrust.org.za'],
  nedbank: ['nedbank.co.za'],
};

const onHost = (url: string, hosts: ReadonlyArray<string>) => {
  const host = new URL(url).hostname;
  return hosts.some((h) => host === h || host.endsWith(`.${h}`));
};

const SAMPLE: Bursary = {
  sourceUrl: 'https://example.org/bursary',
  academicYear: 2027,
  id: 'sample-bursary',
  name: 'Sample Bursary',
  funder: 'Sample Funder',
  funderKind: 'foundation',
  who: ['South African citizens'],
  fields: ['engineering'],
  fieldsAsPrinted: 'Engineering',
  covers: null,
  opensOn: '2026-06-01',
  closesOn: '2026-09-30',
  windowNote: null,
  howToApply: 'Online.',
  applyUrl: 'https://example.org/apply',
  workBack: { kind: 'not-stated', terms: null },
};

describe('bursary records (hard rule 3: sourced, drafts until a person verifies them)', () => {
  it('holds about ten well-known bursaries, each with a unique id', () => {
    expect(RAW.length).toBeGreaterThanOrEqual(8);
    const ids = RAW.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort()).toEqual(Object.keys(OFFICIAL_HOSTS).sort());
  });

  it.each(RAW.map((b) => [b.id, b] as const))('%s validates', (_id, record) => {
    expect(bursarySchema.parse(record)).toBeTruthy();
  });

  it('mixes government, partnership, professional-body, corporate and foundation funders', () => {
    expect(new Set(RAW.map((b) => b.funderKind))).toEqual(new Set(FUNDER_KINDS));
  });

  it('cites only the funder’s own site or the administrator it names, never a directory', () => {
    for (const b of RAW) {
      const hosts = OFFICIAL_HOSTS[b.id] ?? [];
      expect(onHost(b.sourceUrl, hosts), `${b.id}: ${b.sourceUrl}`).toBe(true);
    }
    expect(onHost('https://www.zabursaries.co.za/x', OFFICIAL_HOSTS['sasol'] ?? [])).toBe(false);
  });

  it('is a draft: no agent adds verifiedOn or verifiedBy', () => {
    for (const b of RAW) {
      expect(isDraft(b)).toBe(true);
      expect('verifiedOn' in b, b.id).toBe(false);
      expect('verifiedBy' in b, b.id).toBe(false);
    }
  });

  it('refuses a window that closes before it opens', () => {
    const r = bursarySchema.safeParse({ ...SAMPLE, opensOn: '2026-10-01', closesOn: '2026-09-01' });
    expect(r.success).toBe(false);
  });

  it('records what the source says when it prints no date, never a blank (no guessing)', () => {
    const r = bursarySchema.safeParse({
      ...SAMPLE,
      opensOn: null,
      closesOn: null,
      windowNote: null,
    });
    expect(r.success).toBe(false);
    const ok = bursarySchema.safeParse({
      ...SAMPLE,
      opensOn: null,
      closesOn: null,
      windowNote: 'The funder has not published dates.',
    });
    expect(ok.success).toBe(true);
  });

  it('names the terms of a work-back obligation the source states', () => {
    const r = bursarySchema.safeParse({ ...SAMPLE, workBack: { kind: 'required', terms: null } });
    expect(r.success).toBe(false);
    const ok = bursarySchema.safeParse({
      ...SAMPLE,
      workBack: { kind: 'required', terms: 'One year of teaching for every year funded.' },
    });
    expect(ok.success).toBe(true);
  });

  it('records Funza Lushaka’s teaching obligation and its 2027 window as its page prints them', () => {
    const funza = RAW.find((b) => b.id === 'funza-lushaka');
    expect(funza?.workBack.kind).toBe('required');
    expect(funza?.opensOn).toBe('2026-10-01');
    expect(funza?.closesOn).toBe('2027-01-31');
    expect(funza?.fields).toEqual(['teaching']);
  });

  it('uses only known fields, and https links', () => {
    for (const b of RAW) {
      for (const f of b.fields) expect(FUNDING_FIELDS).toContain(f);
      expect(b.applyUrl.startsWith('https://')).toBe(true);
    }
  });
});

describe('bursaryStatus (code decides whether a window is open)', () => {
  const on = (iso: string) => new Date(`${iso}T08:00:00Z`);

  it('is open between its dates, inclusive', () => {
    expect(bursaryStatus(SAMPLE, on('2026-06-01'))).toBe('open');
    expect(bursaryStatus(SAMPLE, on('2026-09-30'))).toBe('open');
  });

  it('is not open yet before it opens, and closed after it closes', () => {
    expect(bursaryStatus(SAMPLE, on('2026-05-31'))).toBe('opens-later');
    expect(bursaryStatus(SAMPLE, on('2026-10-01'))).toBe('closed');
  });

  it('is unknown when the source prints no opening date and the close is still ahead', () => {
    const b = { ...SAMPLE, opensOn: null };
    expect(bursaryStatus(b, on('2026-09-01'))).toBe('unknown');
    expect(bursaryStatus(b, on('2026-10-01'))).toBe('closed');
    expect(bursaryStatus({ opensOn: null, closesOn: null }, on('2026-09-01'))).toBe('unknown');
  });

  it('reads the date in South Africa, not UTC (23:30 SAST on the closing day is still open)', () => {
    expect(bursaryStatus(SAMPLE, new Date('2026-09-30T21:30:00Z'))).toBe('open');
    expect(bursaryStatus(SAMPLE, new Date('2026-09-30T22:30:00Z'))).toBe('closed');
  });
});

describe('bursariesFor (the list a learner sees)', () => {
  const today = new Date('2026-10-25T08:00:00Z');

  it('puts open windows first, then not-yet-open, then unknown, then closed', () => {
    const list = bursariesFor(RAW, today);
    const order = { open: 0, 'opens-later': 1, unknown: 2, closed: 3 } as const;
    const ranks = list.map((b) => order[b.status]);
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    expect(list[0]?.bursary.id).toBe('funza-lushaka');
  });

  it('filters by field when one is given, and lists all when none is', () => {
    expect(bursariesFor(RAW, today)).toHaveLength(RAW.length);
    const teaching = bursariesFor(RAW, today, 'teaching');
    expect(teaching.map((b) => b.bursary.id)).toEqual(['funza-lushaka']);
    const accounting = bursariesFor(RAW, today, 'accounting').map((b) => b.bursary.id);
    expect(accounting).toContain('thuthuka');
    expect(accounting).not.toContain('funza-lushaka');
  });
});

describe('the catalogue view (unverified never reaches a student)', () => {
  it('shows no bursary while every one is a draft, and all of them only in preview', () => {
    const today = new Date('2026-10-25T08:00:00Z');
    expect(catalogueView(today, { includeDrafts: false }).bursaries).toEqual([]);
    expect(catalogueView(today, { includeDrafts: true }).bursaries).toHaveLength(RAW.length);
  });

  it('shows a verified bursary without drafts', () => {
    const verified = { ...SAMPLE, verifiedOn: '2026-10-20', verifiedBy: 'A Person' };
    const view = catalogueViewOf(
      { ...RAW_CATALOGUE, bursaries: [verified, SAMPLE] },
      new Date('2026-10-25T08:00:00Z'),
      { includeDrafts: false },
    );
    expect(view.bursaries).toEqual([verified]);
  });
});
