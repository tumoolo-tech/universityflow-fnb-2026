import { z } from 'zod';
import {
  BOOK_LEVELS,
  BOOK_MATCH_KINDS,
  editionsAgree,
  isAllowedBookUrl,
  isDeniedBookHost,
  isIsbn13,
  LIBRARY_DISCOVERY_DOMAINS,
  LIBRARY_QUERY,
  OPEN_LICENCES,
  SUBJECT_AREAS,
} from './book-links';
import { bookMatches, libraryCatalogues, openBooks } from './data/open-books';
import { isPublishable, type Provenance, provenanceSchema, sourced } from './provenance';
import { isUniversitySource, type UniversityId, universityId } from './records';

/**
 * Free books, the records (planning.md §8.3; Phase 6, sub-phase 6d; the owner's D5, D6, D7).
 *
 * Three sourced record types, drafts until a person verifies them (hard rule 3):
 * - `openBook`: a book that is legitimately free, under an open licence, on an allow-listed host.
 * - `bookMatch`: a person's link between an open book and a module (or a subject area): either
 *   "this is the prescribed book" or "this covers similar ground".
 * - `libraryCatalogue`: a university library's own search, as a URL pattern.
 *
 * The pure code a module card calls (matching, the library link, the allow-list) is in
 * book-links.ts, which the phone app may load without zod or these records. Pure data here too:
 * no Node built-ins, no browser APIs (hard rule 11).
 */

export const subjectArea = z.enum(SUBJECT_AREAS);

const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'lower-case words joined by hyphens');

export const openBookSchema = sourced({
  id: slug,
  /** As the publisher prints it. */
  title: z.string().trim().min(2),
  /** As the publisher prints them (its senior or lead authors). */
  authors: z.array(z.string().trim().min(2)).min(1),
  /** As printed ("2e"); null when the publisher prints none. */
  edition: z.string().trim().min(1).nullable(),
  /** Every ISBN the publisher prints for it (print, digital), 13 digits, no hyphens. */
  isbns: z.array(z.string().refine(isIsbn13, 'An ISBN-13, 13 digits, check digit right')),
  licence: z.enum(OPEN_LICENCES),
  /** The page the learner opens: on an allow-listed host (D5). `sourceUrl` states the licence. */
  url: z.url({ protocol: /^https$/ }),
  subjectAreas: z.array(subjectArea).min(1),
  level: z.enum(BOOK_LEVELS),
  /** The day research read the source (ISO). Not a verification: see hard rule 3. */
  accessedOn: z.iso.date(),
  /** Something research could not settle, shown to the verifier. */
  note: z.string().min(3).optional(),
})
  .refine((b) => isAllowedBookUrl(b.url) && isAllowedBookUrl(b.sourceUrl), {
    message: 'A free book and its source must both be on an allow-listed host (D5)',
  })
  .refine((b) => new Set(b.isbns).size === b.isbns.length, { message: 'Each ISBN once' })
  .refine((b) => editionsAgree(b.title, b.edition), {
    message: 'The edition in the title and the edition field disagree',
    path: ['edition'],
  });
export type OpenBook = z.infer<typeof openBookSchema>;

const moduleTarget = z.object({ universityId, moduleCode: z.string().trim().min(3) });
const areaTarget = z.object({ subjectArea });

export const bookMatchSchema = sourced({
  id: slug,
  bookId: slug,
  /** A university's module, or (for "covers similar ground" only) a whole subject area. */
  target: z.union([moduleTarget, areaTarget]),
  kind: z.enum(BOOK_MATCH_KINDS),
  /** A person's note: why it fits, what to check. Shown to the verifier, not to learners. */
  note: z.string().trim().min(10),
}).refine(
  (m) =>
    m.kind !== 'is-the-prescribed-book' ||
    ('universityId' in m.target && isUniversitySource(m.target.universityId, m.sourceUrl)),
  {
    message:
      'A prescribed-book match is for one module (never a whole subject area) and cites the university’s own page',
    path: ['sourceUrl'],
  },
);
export type BookMatch = z.infer<typeof bookMatchSchema>;

/** Whether a library pattern is HTTPS, has {query} once, and runs where the library does. */
function isLibrarySearch(university: UniversityId, pattern: string): boolean {
  if (pattern.split(LIBRARY_QUERY).length !== 2) return false;
  let url: URL;
  try {
    url = new URL(pattern.replace(LIBRARY_QUERY, 'x'));
  } catch {
    return false;
  }
  if (url.protocol !== 'https:') return false;
  const host = url.hostname.toLowerCase();
  if (isDeniedBookHost(host)) return false;
  return (
    isUniversitySource(university, url.href) ||
    LIBRARY_DISCOVERY_DOMAINS.some((d) => host.endsWith(`.${d}`))
  );
}

export const libraryCatalogueSchema = sourced({
  universityId,
  /** The library's own name for itself or its catalogue. */
  name: z.string().trim().min(3),
  /** The library's search as a pattern with `{query}` exactly once, where the search words go. */
  searchUrl: z.string().min(10),
  /** The day research read the source (ISO). Not a verification. */
  accessedOn: z.iso.date(),
  note: z.string().min(3).optional(),
})
  .refine((l) => isUniversitySource(l.universityId, l.sourceUrl), {
    message: 'A library record cites the university’s own site',
    path: ['sourceUrl'],
  })
  .refine((l) => isLibrarySearch(l.universityId, l.searchUrl), {
    message:
      'A library search is HTTPS, has {query} once, and runs on the university’s domain or its discovery service',
    path: ['searchUrl'],
  });
export type LibraryCatalogue = z.infer<typeof libraryCatalogueSchema>;

// ---------------------------------------------------------------------------------------------
// The records and their view
// ---------------------------------------------------------------------------------------------

export interface FreeBooksRecords {
  readonly openBooks: ReadonlyArray<OpenBook>;
  readonly bookMatches: ReadonlyArray<BookMatch>;
  readonly libraryCatalogues: ReadonlyArray<LibraryCatalogue>;
}

/** Every free-book record, drafts included. For tests and the verification checklists only. */
export const FREE_BOOKS_RAW: FreeBooksRecords = { openBooks, bookMatches, libraryCatalogues };

export interface FreeBooksView extends FreeBooksRecords {
  /** True when drafts were included, so the interface must label them (preview only). */
  readonly includesDrafts: boolean;
}

/**
 * The free-book records a learner may see: verified ones only, unless the caller asks for drafts
 * (preview, never production), exactly as `catalogueView` gates every other record. A match shows
 * only when its book does.
 */
export function freeBooksView(today: Date, options: { includeDrafts: boolean }): FreeBooksView {
  return freeBooksViewOf(FREE_BOOKS_RAW, today, options);
}

/** The same gate over records the caller supplies (tests). Production reads `freeBooksView`. */
export function freeBooksViewOf(
  records: FreeBooksRecords,
  today: Date,
  options: { includeDrafts: boolean },
): FreeBooksView {
  const keep = <T extends Provenance>(r: T) =>
    isPublishable(r, today) || (options.includeDrafts && provenanceSchema.safeParse(r).success);
  const books = records.openBooks.filter((b) => keep(b) && openBookSchema.safeParse(b).success);
  const shown = new Set(books.map((b) => b.id));
  return {
    openBooks: books,
    bookMatches: records.bookMatches.filter((m) => keep(m) && shown.has(m.bookId)),
    libraryCatalogues: records.libraryCatalogues.filter(keep),
    includesDrafts: options.includeDrafts,
  };
}
