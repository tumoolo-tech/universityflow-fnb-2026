/**
 * The course cards' pictures (cards8, the owner's request of 2026-10-24): one photo per field of
 * study behind each course card, a painting behind an arts course, code behind computing, and a
 * neutral library for a field this list doesn't know.
 *
 * The field is read from what the catalogue already holds, the programme's name first (it is the
 * most specific: "Bachelor of Laws" in a "Commerce, Law and Management" faculty), then its
 * faculty. A design decision, not an admission fact: it changes only a picture, never a word or a
 * verdict (hard rule 2). test/course-art.test.ts holds every programme and every faculty the
 * catalogue uses to a field of its own, so a new course can't silently get the default.
 *
 * No imports, so the chat's client bundle carries only this list, and
 * scripts/assets/generate-course-art.mjs can read it with Node directly.
 */

export const COURSE_FIELDS = [
  'computing',
  'engineering',
  'health',
  'law',
  'education',
  'commerce',
  'social',
  'arts',
  'science',
  'general',
] as const;

export type CourseField = (typeof COURSE_FIELDS)[number];

/**
 * In this order: the first that matches wins. Engineering before computing (UP's faculty is
 * "Engineering, Built Environment and Information Technology"; a computing course there is told by
 * its own name), health before science ("Nursing Science"), commerce before science ("Accounting
 * Science"), social before arts ("Bachelor of Arts or Social Science"). `\binformatics` so
 * "Geoinformatics" stays science.
 */
const RULES: ReadonlyArray<readonly [Exclude<CourseField, 'general'>, RegExp]> = [
  ['engineering', /engineering|built environment/i],
  [
    'computing',
    /computer|computing|\binformatics|information technology|communication technology/i,
  ],
  [
    'health',
    /medicine|surgery|mbchb|mbbch|nursing|pharmacy|physiotherapy|occupational therapy|dentistry|health/i,
  ],
  ['law', /\blaws?\b|\bllb\b|policing/i],
  ['education', /education|teaching/i],
  [
    'commerce',
    /commerce|accounting|accountancy|auditing|actuarial|marketing|management|hospitality|business|economic|finance/i,
  ],
  ['social', /social (?:work|science)/i],
  ['arts', /\barts?\b|humanities|music|drama|design/i],
  ['science', /scien|chemistry|physics|geology|biology|mathematics|agricultur/i],
];

const match = (text: string): CourseField | null =>
  RULES.find(([, pattern]) => pattern.test(text))?.[0] ?? null;

/** The field a programme's picture comes from: its name, else its faculty, else `general`. */
export function courseField(programme: { name: string; faculty: string }): CourseField {
  return match(programme.name) ?? match(programme.faculty) ?? 'general';
}

/**
 * Each field's photo: the owner's Unsplash download it is made from (free to use under the
 * Unsplash License; kept in the main checkout's git-ignored photos/course-cards/, named for its
 * field, then its Unsplash name), and its photographer, credited in public/course-art/CREDITS.md. None shows a
 * face as its subject, a university's logo or a campus that names one.
 */
export const COURSE_ART: Readonly<
  Record<CourseField, { source: string; photographer: string; unsplashId: string }>
> = {
  computing: {
    source: 'computing-radowan-nakif-rehan-cYyqhdbJ9TI-unsplash.jpg',
    photographer: 'Radowan Nakif Rehan',
    unsplashId: 'cYyqhdbJ9TI',
  },
  engineering: {
    source: 'engineering-mahmoud-amer-Ia7I7oMnvcA-unsplash.jpg',
    photographer: 'Mahmoud Amer',
    unsplashId: 'Ia7I7oMnvcA',
  },
  health: {
    source: 'health-brano-Mm1VIPqd0OA-unsplash.jpg',
    photographer: 'Brano',
    unsplashId: 'Mm1VIPqd0OA',
  },
  law: {
    source: 'law-sasun-bughdaryan-YFz39MOmxnQ-unsplash.jpg',
    photographer: 'Sasun Bughdaryan',
    unsplashId: 'YFz39MOmxnQ',
  },
  education: {
    source: 'education-jeswin-thomas--hgJu2ykh4E-unsplash.jpg',
    photographer: 'Jeswin Thomas',
    unsplashId: '-hgJu2ykh4E',
  },
  commerce: {
    source: 'commerce-krists-luhaers-dq701jterEA-unsplash.jpg',
    photographer: 'Krists Luhaers',
    unsplashId: 'dq701jterEA',
  },
  social: {
    source: 'social-jan-kopriva-SCEywLgwj2E-unsplash.jpg',
    photographer: 'Jan Kopriva',
    unsplashId: 'SCEywLgwj2E',
  },
  arts: {
    source: 'arts-jade-stephens-WhVO1xKiDVw-unsplash.jpg',
    photographer: 'Jade Stephens',
    unsplashId: 'WhVO1xKiDVw',
  },
  science: {
    source: 'science-artturi-jalli-gYrYa37fAKI-unsplash.jpg',
    photographer: 'Artturi Jalli',
    unsplashId: 'gYrYa37fAKI',
  },
  general: {
    source: 'general-priscilla-du-preez-ggeZ9oyI-PE-unsplash.jpg',
    photographer: 'Priscilla Du Preez',
    unsplashId: 'ggeZ9oyI-PE',
  },
};

/** The widths each picture is made at: a phone's card and a laptop's (2:1, like the card's top). */
export const COURSE_ART_WIDTHS = [400, 800] as const;
export const COURSE_ART_FORMATS = ['avif', 'webp'] as const;

/** What a card's `<picture>` uses, all same-origin static files (no next/image). */
export interface CardArt {
  readonly avifSrcSet: string;
  readonly webpSrcSet: string;
  readonly src: string;
}

/**
 * A picture's files in a folder of public/, at every width and format, the way
 * scripts/assets/generate-course-art.mjs names them: `<folder>/<name>-<width>.<format>`.
 * Shared with the subject cards' pictures (lib/subject-art.ts, cards9).
 */
export function cardArtFiles(folder: string, name: string): CardArt {
  const file = (width: number, format: string) => `/${folder}/${name}-${width}.${format}`;
  const srcSet = (format: string) =>
    COURSE_ART_WIDTHS.map((w) => `${file(w, format)} ${w}w`).join(', ');
  return { avifSrcSet: srcSet('avif'), webpSrcSet: srcSet('webp'), src: file(800, 'webp') };
}

/** The URLs a card's `<picture>` uses, all same-origin static files (no next/image). */
export function courseArt(programme: { name: string; faculty: string }) {
  const field = courseField(programme);
  return { field, ...cardArtFiles('course-art', field) };
}

/**
 * A card about one course, which may be gone from the catalogue the learner may see (hard rule
 * 3): its field's picture, or the neutral one. The offer card (cards9) and the module card.
 */
export function programmeArt(programme: { name: string; faculty: string } | null) {
  return programme
    ? courseArt(programme)
    : { field: 'general' as const, ...cardArtFiles('course-art', 'general') };
}

/**
 * Phase 6's module card (not built yet, cards9): a module takes the picture of the programme the
 * learner registered for (MyModulesArtifact `programme`, its name then its faculty), so a
 * first-year's modules all show their course's field. A module's own code or name is not read:
 * "ECO1010F" in an engineering curriculum still belongs to that learner's engineering year.
 */
export function moduleArt(module: { programme: { name: string; faculty: string } | null }) {
  return programmeArt(module.programme);
}
