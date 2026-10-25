import { z } from 'zod';
import { PROVINCES } from './basics';
import { logoAssetId, logoPermissionSchema } from './logo-permission';
import { sourced } from './provenance';
import { subjectId } from './subject-schema';

export { dialable, PROVINCES } from './basics';

/**
 * The record types the catalogue holds. Each one is `sourced` (hard rule 3), so every fact a
 * student sees can be traced to the official page it came from.
 *
 * Names, faculties and the universities' own selection notes are data, quoted from the source,
 * not interface copy: the interface around them comes from `packages/content` (hard rule 8).
 */

export const UNIVERSITY_IDS = ['wits', 'uj', 'up', 'uct', 'tut', 'ukzn'] as const;
export const universityId = z.enum(UNIVERSITY_IDS);
export type UniversityId = z.infer<typeof universityId>;

/**
 * Each university's own web domain. A record about a university cites a page on its own domain
 * (or a subdomain of it), never a directory or a news site. UKZN's applications also cite the
 * CAO, which runs them; that exception lives with the application records, not here.
 */
export const UNIVERSITY_DOMAINS: Readonly<Record<UniversityId, string>> = {
  wits: 'wits.ac.za',
  uj: 'uj.ac.za',
  up: 'up.ac.za',
  uct: 'uct.ac.za',
  tut: 'tut.ac.za',
  ukzn: 'ukzn.ac.za',
};

/** Whether `url` is on the university's own domain or a subdomain of it. */
export function isUniversitySource(id: UniversityId, url: string): boolean {
  const host = new URL(url).hostname;
  const domain = UNIVERSITY_DOMAINS[id];
  return host === domain || host.endsWith(`.${domain}`);
}

const isoDate = z.iso.date();
const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'lower-case words joined by hyphens');

export const universitySchema = sourced({
  id: universityId,
  name: z.string().min(3),
  shortName: z.string().min(2),
  city: z.string().min(2),
  province: z.enum(PROVINCES),
  /** UKZN and other KwaZulu-Natal institutions take applications through the CAO. */
  applicationRoute: z.enum(['direct', 'cao']),
  applyUrl: z.url({ protocol: /^https$/ }),
  /**
   * The university's written permission to show its logo (logo-permission.ts). Absent for every
   * university today, so each is shown with our neutral mark. Only a person adds one.
   */
  logoPermission: logoPermissionSchema.optional(),
}).refine((u) => !u.logoPermission || logoAssetId(u.logoPermission.asset) === u.id, {
  message: "A university's logoPermission names its own file: logos/<its id>.png",
  path: ['logoPermission', 'asset'],
});
export type University = z.infer<typeof universitySchema>;

export const QUALIFICATION_TYPES = [
  'degree',
  'extended-degree',
  'diploma',
  'extended-diploma',
  'higher-certificate',
] as const;
export const qualificationType = z.enum(QUALIFICATION_TYPES);
export type QualificationType = z.infer<typeof qualificationType>;

/** The NSC pass a programme asks for, lowest to highest. */
export const PASS_TYPES = ['higher-certificate', 'diploma', 'bachelor'] as const;
export const passType = z.enum(PASS_TYPES);
export type RequiredPass = z.infer<typeof passType>;

/**
 * One way to meet a subject minimum: any of `subjects` at the given level or percentage. A
 * minimum is an NSC level, a percentage, or both when the source gives both; the stricter one
 * applies.
 */
export const subjectOptionSchema = z
  .object({
    subjects: z.array(subjectId).min(1),
    minLevel: z.int().min(1).max(7).optional(),
    minPercent: z.int().min(0).max(100).optional(),
  })
  .refine((r) => r.minLevel !== undefined || r.minPercent !== undefined, {
    message: 'A subject requirement needs a minimum level or percentage',
  });
export type SubjectOption = z.infer<typeof subjectOptionSchema>;

/**
 * One subject minimum. Most are met by any one of their options ("Mathematics 5"; "English
 * Home Language 4 or English First Additional Language 5"). Some programmes also ask for a
 * number of *other* subjects at a level ("any three additional subjects at level 4"): those
 * count subjects not already used for another requirement, never Life Orientation.
 */
export const subjectRequirementSchema = z.union([
  z.object({ options: z.array(subjectOptionSchema).min(1) }),
  z.object({
    otherSubjects: z
      .object({
        count: z.int().min(1).max(6),
        minLevel: z.int().min(1).max(7).optional(),
        minPercent: z.int().min(0).max(100).optional(),
      })
      .refine((r) => r.minLevel !== undefined || r.minPercent !== undefined, {
        message: 'A subject requirement needs a minimum level or percentage',
      }),
  }),
]);
export type SubjectRequirement = z.infer<typeof subjectRequirementSchema>;
export type OptionsRequirement = Extract<SubjectRequirement, { options: unknown }>;
export type OtherSubjectsRequirement = Extract<SubjectRequirement, { otherSubjects: unknown }>;

export function isOptionsRequirement(r: SubjectRequirement): r is OptionsRequirement {
  return 'options' in r;
}

/** One of several options, e.g. `either(requires(['mathematics'], {level: 5}), requires(...))`. */
export function either(...requirements: OptionsRequirement[]): OptionsRequirement {
  return { options: requirements.flatMap((r) => r.options) };
}

/** "Any `count` other subjects at `minimum`" (never Life Orientation). */
export function otherSubjects(
  count: number,
  minimum: { level?: number; percent?: number },
): OtherSubjectsRequirement {
  return {
    otherSubjects: {
      count,
      ...(minimum.level === undefined ? {} : { minLevel: minimum.level }),
      ...(minimum.percent === undefined ? {} : { minPercent: minimum.percent }),
    },
  };
}

/**
 * A university's published admission bands (UCT's A/B/C). Shown with the programme so a learner
 * sees which band their score reaches and who each band is open to.
 */
export const scoreBandSchema = z.object({
  band: z.string().min(1),
  /** The threshold on the band's own basis, or null when the source gives a range in words. */
  threshold: z.number().nullable(),
  /** FPS is the plain score; WPS adds the university's disadvantage weighting. */
  basis: z.enum(['score', 'weighted-score']),
  who: z.string().min(3),
  outcome: z.string().min(3),
});
export type ScoreBand = z.infer<typeof scoreBandSchema>;

/** Shorthand for the common single-option requirement. */
export function requires(
  subjects: SubjectOption['subjects'],
  minimum: { level?: number; percent?: number },
): OptionsRequirement {
  return {
    options: [
      {
        subjects,
        ...(minimum.level === undefined ? {} : { minLevel: minimum.level }),
        ...(minimum.percent === undefined ? {} : { minPercent: minimum.percent }),
      },
    ],
  };
}

export const programmeSchema = sourced({
  id: slug,
  universityId,
  name: z.string().min(3),
  faculty: z.string().min(3),
  qualification: qualificationType,
  /** Null when the source doesn't state it. */
  durationYears: z.number().min(1).max(7).nullable(),
  /** The minimum admission score, on the university's own scale. Null when it sets none. */
  minimumScore: z.number().min(0).nullable(),
  /**
   * A higher minimum that applies when the learner offers Mathematical Literacy instead of
   * Mathematics or Technical Mathematics (TUT publishes these per programme).
   */
  minimumScoreWithMathematicalLiteracy: z.number().min(0).optional(),
  /** Published admission bands, when the university uses them (UCT). */
  scoreBands: z.array(scoreBandSchema).optional(),
  /**
   * The score method this programme is measured on, when it isn't the university's default
   * (a faculty can weight subjects differently). An id from `packages/admissions`.
   */
  scoreMethod: z.string().optional(),
  requiredPass: passType,
  subjectRequirements: z.array(subjectRequirementSchema),
  nbt: z.enum(['none', 'required', 'recommended']),
  /**
   * Anything beyond the minimums, quoted from the source: limited places, interviews,
   * portfolios, "meeting the minimum does not guarantee a place".
   */
  selection: z.string().min(3).nullable(),
  /** A programme-specific closing date, when it closes before the university's general date. */
  closesOn: isoDate.nullable(),
});
export type Programme = z.infer<typeof programmeSchema>;

export const applicationWindowSchema = sourced({
  universityId,
  /** Null when the university doesn't publish one. */
  opensOn: isoDate.nullable(),
  closesOn: isoDate,
  earlierClosings: z.array(z.object({ scope: z.string().min(3), closesOn: isoDate })),
  /** Whether final Grade 11 results are used for provisional offers. */
  grade11ResultsAccepted: z.boolean(),
  /** In rand. Zero when the university charges South African applicants nothing. */
  feeZar: z.number().min(0).nullable(),
  feeNote: z.string().min(3).nullable(),
}).refine((w) => w.opensOn === null || w.opensOn <= w.closesOn, {
  message: 'A window must open before it closes',
});
export type ApplicationWindow = z.infer<typeof applicationWindowSchema>;

export const nsfasSchema = sourced({
  opensOn: isoDate.nullable(),
  closesOn: isoDate.nullable(),
  /** Combined gross household income per year, in rand. */
  incomeThresholdZar: z.number().int().positive(),
  incomeThresholdDisabilityZar: z.number().int().positive(),
  sassaNote: z.string().min(3),
  documents: z.array(z.string().min(3)).min(1),
  nPlusRule: z.string().min(3),
  applyUrl: z.url({ protocol: /^https$/ }),
});
export type Nsfas = z.infer<typeof nsfasSchema>;

export const helplineSchema = sourced({
  id: slug,
  name: z.string().min(3),
  numbers: z
    .array(
      z.object({
        kind: z.enum(['call', 'sms', 'whatsapp']),
        /** As printed by the organisation, e.g. "0800 36 36 36". */
        value: z.string().regex(/^[\d +]{3,20}$/),
      }),
    )
    .min(1),
  hours: z.string().min(3),
  purpose: z.string().min(3),
  /** Which situations it is offered for, so the crisis card shows the right ones (§4.3). */
  topics: z.array(z.enum(['distress', 'suicide', 'substance', 'abuse', 'emergency', 'child'])),
});
export type Helpline = z.infer<typeof helplineSchema>;
