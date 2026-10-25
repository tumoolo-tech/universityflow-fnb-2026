import { z } from 'zod';
import { PROVINCES } from './basics';
import { isPublishable, provenanceSchema, sourced } from './provenance';

/**
 * Public TVET colleges (planning.md §19.1; the owner's decision of 2026-10-24: every province, as
 * drafts). An institution type beside the universities, with the same rule (hard rule 3): every
 * record has its source and year, and only a person adds `verifiedOn`/`verifiedBy`.
 *
 * Two sources, two records:
 * - **What is a public college** comes from the Department of Higher Education and Training's own
 *   publications (`sourceUrl` on dhet.gov.za): the college's DHET name and province. This is what
 *   "Is this college registered?" reads.
 * - **What a college offers** comes from the college's own website (`site`, and each programme):
 *   its own name, the abbreviations it prints, where it is, where to apply, and each programme
 *   with its entry rule quoted word for word. A value the college doesn't print is null, never a
 *   usual value (gotcha 40).
 *
 * No data here: the records live in data/colleges/ and load only through
 * `@universityflow/catalogue/colleges`, so neither the phone app nor any page that reads the
 * universities' catalogue carries them. This file is schemas and pure functions.
 */

/** What kind of institution a record is. Only the first two are built (2026-10-24). */
export const INSTITUTION_TYPES = [
  'university',
  'public-tvet-college',
  'private-higher-education',
  'private-college',
] as const;
export type InstitutionType = (typeof INSTITUTION_TYPES)[number];

/** The college programmes in scope: NC(V) starts after Grade 9, N4–N6 (Report 191) after matric or N3. */
export const COLLEGE_PROGRAMME_TYPES = ['ncv', 'n4-n6'] as const;
export type CollegeProgrammeType = (typeof COLLEGE_PROGRAMME_TYPES)[number];

/** DHET's 19 NC(V) programmes ("NCV Subject Matrix 2015"), as DHET names them. */
export const NCV_PROGRAMMES = [
  'Civil Engineering and Building Construction',
  'Drawing Office Practice',
  'Education and Development',
  'Electrical Infrastructure Construction',
  'Engineering and Related Design',
  'Finance, Economics and Accounting',
  'Hospitality',
  'Information Technology and Computer Science',
  'Management',
  'Marketing',
  'Mechatronics',
  'Office Administration',
  'Primary Agriculture',
  'Primary Health',
  'Process Instrumentation',
  'Process Plant Operations',
  'Safety in Society',
  'Tourism',
  'Transport and Logistics',
] as const;

/** The N4–N6 programmes of DHET's Report 191, by the names it groups them under. */
export const N4_N6_PROGRAMMES = [
  'Business Management',
  'Financial Management',
  'Human Resource Management',
  'Marketing Management',
  'Public Management',
  'Management Assistant',
  'Legal Secretary',
  'Medical Secretary',
  'Public Relations',
  'Educare',
  'Tourism',
  'Hospitality and Catering Services',
  'Art and Design',
  'Farming Management',
  'Clothing Production',
  'Hair Care',
  'Interior Decorating',
  'Popular Music',
  'Engineering Studies: Electrical',
  'Engineering Studies: Mechanical',
  'Engineering Studies: Civil',
  'Engineering Studies: Chemical',
  'Engineering Studies: Other',
] as const;

/** A programme the college offers that none of DHET's names fits: its own name is the one shown. */
export const OTHER_PROGRAMME = 'OTHER';

export const NATIONAL_PROGRAMMES: Readonly<Record<CollegeProgrammeType, ReadonlyArray<string>>> = {
  ncv: [...NCV_PROGRAMMES, OTHER_PROGRAMME],
  'n4-n6': [...N4_N6_PROGRAMMES, OTHER_PROGRAMME],
};

/** DHET's own domain: the only source of what is a public college. */
export const DHET_DOMAIN = 'dhet.gov.za';

const https = z.url({ protocol: /^https$/ });
const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'lower-case words joined by hyphens');
const domain = z
  .string()
  .regex(/^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/, 'a bare domain, like college.edu.za');

/** Whether `url`'s host is `domain` or a subdomain of it. */
function onDomain(url: string, root: string): boolean {
  const host = new URL(url).hostname;
  return host === root || host.endsWith(`.${root}`);
}

export const isDhetSource = (url: string): boolean => onDomain(url, DHET_DOMAIN);

/**
 * What the college's own website says about it. Its own `sourceUrl` (the page that prints the
 * town, or the home page) and its own verification: a person checks it against the site, which
 * is a different check from DHET's register.
 */
export const collegeSiteSchema = sourced({
  /** The name the college's own site uses. */
  name: z.string().min(3),
  /** Only abbreviations the college itself prints ("SWGC"). Never one we made up. */
  abbreviations: z.array(z.string().min(2)),
  website: https.nullable(),
  /**
   * The college's own domains: the website's, and any other the website itself links to as its
   * own (a portal on another domain). Every site and programme source must be on one of them.
   */
  domains: z.array(domain).min(1),
  /** Town or city of the central office or main campus, as printed. Null when not printed. */
  mainTown: z.string().min(2).nullable(),
  /** The college's own online application page. Null when it has none on its own domains. */
  applyUrl: https.nullable(),
});
export type CollegeSite = z.infer<typeof collegeSiteSchema>;

const onSiteDomains = (site: CollegeSite, url: string | null) =>
  url === null || site.domains.some((d) => onDomain(url, d));

export const collegeSchema = sourced({
  id: slug,
  /** Only public TVET colleges are built; private institutions come later (§19.2). */
  type: z.literal('public-tvet-college'),
  /** The name as DHET's list prints it. */
  dhetName: z.string().min(3),
  /**
   * Other names DHET prints for this college (an older list's, or another spelling in the same
   * document), so the registration check finds it either way.
   */
  otherDhetNames: z.array(z.string().min(3)).optional(),
  province: z.enum(PROVINCES),
  /** The DHET page that gives the province, when it isn't the `sourceUrl` itself. */
  provinceSourceUrl: https.optional(),
  /** Null when the college has no site we could read over HTTPS: a register record only. */
  site: collegeSiteSchema.nullable(),
})
  .refine((c) => isDhetSource(c.sourceUrl), {
    message: "A college's register record cites DHET's own domain (dhet.gov.za)",
    path: ['sourceUrl'],
  })
  .refine((c) => c.provinceSourceUrl === undefined || isDhetSource(c.provinceSourceUrl), {
    message: "A college's province comes from DHET's own domain (dhet.gov.za)",
    path: ['provinceSourceUrl'],
  })
  .refine(
    (c) =>
      c.site === null ||
      [c.site.sourceUrl, c.site.website, c.site.applyUrl].every((u) =>
        onSiteDomains(c.site as CollegeSite, u),
      ),
    { message: "A college's site facts cite the college's own domains", path: ['site'] },
  );
export type College = z.infer<typeof collegeSchema>;

export const collegeProgrammeSchema = sourced({
  id: slug,
  collegeId: slug,
  type: z.enum(COLLEGE_PROGRAMME_TYPES),
  /** DHET's name for the programme (NATIONAL_PROGRAMMES), or OTHER. */
  programme: z.string().min(3),
  /** The programme as the college prints it. */
  nameAtCollege: z.string().min(2),
  /** The campuses the college prints for it; null when it prints none. */
  campuses: z.array(z.string().min(2)).nullable(),
  /** The intake year the page prints; null when the page prints no year. */
  yearPrinted: z.int().min(2024).max(2100).nullable(),
  /** The entry requirement, word for word as the college prints it. Null when none is printed. */
  entryQuote: z.string().min(2).nullable(),
  entryQuoteUrl: https.nullable(),
  /**
   * The quote is only part of the rule: the page adds conditions it doesn't hold, or says "some
   * programmes may have additional requirements". Code then decides nothing from it.
   */
  entryQuoteIncomplete: z.literal(true).optional(),
})
  .refine((p) => NATIONAL_PROGRAMMES[p.type].includes(p.programme), {
    message: "A college programme's name is one of DHET's for its type, or OTHER",
    path: ['programme'],
  })
  .refine((p) => (p.entryQuote === null) === (p.entryQuoteUrl === null), {
    message: 'An entry quote and the page that prints it go together',
    path: ['entryQuoteUrl'],
  });
export type CollegeProgramme = z.infer<typeof collegeProgrammeSchema>;

/**
 * A national teach-out (a DHET TVET numbered circular): from `noFirstIntakeFrom`, no first-year
 * intake in these programmes anywhere, whatever a college's own (often older) pages still list.
 * Plan B never offers a programme a notice has closed (packages/admissions colleges.ts).
 *
 * DHET doesn't publish its circulars on dhet.gov.za; colleges post copies. So the source may be a
 * college's copy (`hostCollegeId`, on that college's own domains), with DHET's own statements of
 * the same rule, where it made any, in `supportingUrls`.
 */
export const teachOutNoticeSchema = sourced({
  id: slug,
  /** The circular's number, as printed ("TC 0153"). */
  circular: z.string().min(3),
  /** Its title, as printed. */
  title: z.string().min(3),
  /** Its date, as printed. */
  datePrinted: z.string().min(4),
  type: z.enum(COLLEGE_PROGRAMME_TYPES),
  /** DHET's names of the programmes it closes; null when it closes every programme of `type`. */
  programmes: z.array(z.string().min(3)).min(1).nullable(),
  /** The first academic year with no first-year intake. */
  noFirstIntakeFrom: z.int().min(2025).max(2100),
  /** The sentences that say so, word for word. */
  quotes: z.array(z.string().min(3)).min(1),
  /** The college whose copy `sourceUrl` is, when it isn't DHET's own. */
  hostCollegeId: slug.optional(),
  /** DHET's own statements of the same rule, on dhet.gov.za. */
  supportingUrls: z.array(https),
})
  .refine((n) => n.hostCollegeId !== undefined || isDhetSource(n.sourceUrl), {
    message: "A teach-out cites DHET's own domain, or names the college whose copy it cites",
    path: ['sourceUrl'],
  })
  .refine(
    (n) =>
      n.programmes === null || n.programmes.every((p) => NATIONAL_PROGRAMMES[n.type].includes(p)),
    {
      message: "A teach-out names DHET's programmes for its type",
      path: ['programmes'],
    },
  )
  .refine((n) => n.supportingUrls.every(isDhetSource), {
    message: "A teach-out's supporting statements are DHET's own (dhet.gov.za)",
    path: ['supportingUrls'],
  });
export type TeachOutNotice = z.infer<typeof teachOutNoticeSchema>;

/** Every college record, drafts included: the shape of the data, and what `collegeViewOf` reads. */
export interface CollegeRecords {
  readonly colleges: ReadonlyArray<College>;
  readonly programmes: ReadonlyArray<CollegeProgramme>;
  readonly notices?: ReadonlyArray<TeachOutNotice>;
}

/** Whether `url` is on one of the college's own domains (its site record's). */
export function isCollegeSource(college: Pick<College, 'site'>, url: string): boolean {
  return college.site !== null && onSiteDomains(college.site, url);
}

/**
 * What schemas can't see, because it spans records: a programme's sources on its own college's
 * domains, known colleges, unique ids, one record per national programme and type, and
 * `verifiedOn`/`verifiedBy` together. Empty when the data is sound. colleges-data.test.ts holds
 * the real data to it.
 */
export function collegeProblems(records: CollegeRecords): string[] {
  const problems: string[] = [];
  const byId = new Map<string, College>();
  for (const c of records.colleges) {
    if (byId.has(c.id)) problems.push(`college ${c.id} is listed twice`);
    byId.set(c.id, c);
  }
  const ids = new Set<string>();
  const offered = new Set<string>();
  for (const p of records.programmes) {
    if (ids.has(p.id)) {
      problems.push(`programme ${p.id} is listed twice`);
      continue;
    }
    ids.add(p.id);
    problems.push(...programmeProblems(p, byId.get(p.collegeId), offered));
  }
  for (const n of records.notices ?? []) {
    const host = n.hostCollegeId === undefined ? undefined : byId.get(n.hostCollegeId);
    if (n.hostCollegeId !== undefined && !(host && isCollegeSource(host, n.sourceUrl))) {
      problems.push(`teach-out ${n.id}: ${n.sourceUrl} is not on ${n.hostCollegeId}'s own domains`);
    }
  }
  const halfVerified = (r: { verifiedOn?: string | undefined; verifiedBy?: string | undefined }) =>
    (r.verifiedOn === undefined) !== (r.verifiedBy === undefined);
  for (const c of records.colleges) {
    if (halfVerified(c) || (c.site && halfVerified(c.site))) {
      problems.push(`college ${c.id}: verifiedOn and verifiedBy go together`);
    }
  }
  for (const p of records.programmes) {
    if (halfVerified(p)) problems.push(`programme ${p.id}: verifiedOn and verifiedBy go together`);
  }
  return problems;
}

function programmeProblems(
  p: CollegeProgramme,
  college: College | undefined,
  offered: Set<string>,
): string[] {
  if (!college) return [`${p.id}: no college ${p.collegeId}`];
  if (college.site === null) {
    return [`${p.id}: ${college.id} has no site record, so nothing can source its programmes`];
  }
  const problems = [p.sourceUrl, p.entryQuoteUrl]
    .filter((url): url is string => url !== null && !isCollegeSource(college, url))
    .map((url) => `${p.id}: sourceUrl ${url} is not on ${college.id}'s own domains`);
  const key = `${p.collegeId}|${p.type}|${p.programme}`;
  if (p.programme !== OTHER_PROGRAMME && offered.has(key)) {
    problems.push(`${p.id}: ${p.collegeId} lists ${p.type} ${p.programme} twice`);
  }
  offered.add(key);
  return problems;
}

/**
 * The notice that closes a programme to first-year students in `intakeYear`, if any. An OTHER
 * programme is never matched by name: only a notice for its whole type closes it.
 */
export function closingNotice(
  programme: Pick<CollegeProgramme, 'type' | 'programme'>,
  notices: ReadonlyArray<TeachOutNotice>,
  intakeYear: number,
): TeachOutNotice | undefined {
  return notices.find(
    (n) =>
      n.type === programme.type &&
      n.noFirstIntakeFrom <= intakeYear &&
      (n.programmes === null || n.programmes.includes(programme.programme)),
  );
}

// ── The view: the gate hard rule 3 describes, as catalogueView is for universities ──────────

export interface CollegeView {
  /** Colleges on the register the learner may see. `site` is null unless it may be shown too. */
  readonly colleges: ReadonlyArray<College>;
  /** Programmes of the colleges shown whose site may be shown. */
  readonly programmes: ReadonlyArray<CollegeProgramme>;
  /** National teach-outs, every sourced one, drafts included (they only close programmes). */
  readonly notices: ReadonlyArray<TeachOutNotice>;
  /** True when drafts were included, so the interface must label them. */
  readonly includesDrafts: boolean;
}

/**
 * Only verified records, as of `today`; drafts too when the caller asks (the web app refuses to
 * in production). A college's site facts and programmes are shown only when the college is.
 */
export function collegeViewOf(
  records: CollegeRecords,
  today: Date,
  options: { readonly includeDrafts: boolean },
): CollegeView {
  const keep = (record: z.infer<typeof provenanceSchema>) =>
    isPublishable(record, today) ||
    (options.includeDrafts && provenanceSchema.safeParse(record).success);
  const colleges = records.colleges
    .filter(keep)
    .map((c) => (c.site === null || keep(c.site) ? c : { ...c, site: null }));
  const withSite = new Set(colleges.filter((c) => c.site !== null).map((c) => c.id));
  return {
    colleges,
    programmes: records.programmes.filter((p) => keep(p) && withSite.has(p.collegeId)),
    // A teach-out only ever closes options, so a sourced one applies before it is verified (as
    // examPapersForSuppression does for exam dates): offering a programme DHET has closed to new
    // students would cost a learner an application and a year; hiding one costs a check.
    notices: (records.notices ?? []).filter((n) => teachOutNoticeSchema.safeParse(n).success),
    includesDrafts: options.includeDrafts,
  };
}

export function collegeById(view: CollegeView, id: string): College | undefined {
  return view.colleges.find((c) => c.id === id);
}

/** A college's programmes, in the order the data lists them. */
export function programmesAt(view: CollegeView, collegeId: string): CollegeProgramme[] {
  return view.programmes.filter((p) => p.collegeId === collegeId);
}

/** The name a learner sees: the college's own, or DHET's when we couldn't read its site. */
export function collegeName(college: College): string {
  return college.site?.name ?? college.dhetName;
}

// ── "Is this college registered?" ───────────────────────────────────────────────────────────

/**
 * A name as the check compares it: lower case, accents and punctuation gone, "&" as "and",
 * "TVET" and "FET" (and "for TVET") gone, spaces collapsed. Nothing else is forgiven: "College"
 * and every other word stay, so a different college's name can't become a listed one.
 */
export function normaliseCollegeName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/\./g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\bfor (?:tvet|fet)\b/g, ' ')
    .replace(/\b(?:tvet|fet)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export type RegistrationCheck =
  /** The name is one on DHET's list (or the college's own name or a printed abbreviation). */
  | { readonly status: 'listed'; readonly query: string; readonly college: College }
  /** Not on the list. `similar`: listed names that share every word, offered only as "did you mean". */
  | {
      readonly status: 'not-found';
      readonly query: string;
      readonly similar: ReadonlyArray<College>;
    }
  /** Nothing to check: the box was empty. */
  | { readonly status: 'empty'; readonly query: string }
  /** No college may be shown yet (none verified, outside preview): we can't say either way. */
  | { readonly status: 'unavailable'; readonly query: string };

/** The names a college is known by on the list, normalised. */
function namesOf(college: College): string[] {
  return [
    college.dhetName,
    ...(college.otherDhetNames ?? []),
    ...(college.site ? [college.site.name, ...college.site.abbreviations] : []),
  ].map(normaliseCollegeName);
}

/** How many "did you mean" names the check offers. */
export const SIMILAR_LIMIT = 5;

/**
 * Whether a college's name is on DHET's list of public TVET colleges, as the catalogue holds it.
 * **Never a false yes**: only a whole name (or a printed abbreviation) that matches after
 * forgiving case, punctuation, "TVET" and "FET" counts. A part of a name, a misspelling or an
 * extra word is "not found", with listed names that share its words offered as suggestions.
 */
export function registrationCheck(view: CollegeView, query: string): RegistrationCheck {
  const asked = normaliseCollegeName(query);
  if (asked === '') return { status: 'empty', query };
  if (view.colleges.length === 0) return { status: 'unavailable', query };
  const college = view.colleges.find((c) => namesOf(c).includes(asked));
  if (college) return { status: 'listed', query, college };
  const words = asked.split(' ').filter((w) => w !== 'college');
  const similar =
    words.length === 0
      ? []
      : view.colleges
          .filter((c) => {
            const has = new Set(namesOf(c).flatMap((n) => n.split(' ')));
            return words.every((w) => has.has(w));
          })
          .slice(0, SIMILAR_LIMIT);
  return { status: 'not-found', query, similar };
}

export function isRegistered(view: CollegeView, query: string): boolean {
  return registrationCheck(view, query).status === 'listed';
}
