import { MAX_LINK_LENGTH, normaliseModuleCode } from './basics';
import type { BookMatch, FreeBooksView, LibraryCatalogue, OpenBook } from './books';
import type { UniversityId } from './records';

/**
 * Free books, the pure part (Phase 6, sub-phase 6d; the owner's D5, D6 and D7): the host
 * allow-list and deny-list, ISBN and title normalising, matching an outline's prescribed book,
 * the module card's free-book list and the library search link.
 *
 * No zod and no records here (books.ts holds those). It runs on the server: the web API works out
 * a module card's free books and the app receives the result, as for every other catalogue
 * result. It is deliberately NOT in `@universityflow/catalogue/client`: its host lists are
 * catalogue data the native bundle budget refuses (A4-13). Still React-Native-safe: no Node
 * built-ins, no browser APIs (hard rule 11). We host nothing and download nothing: every link
 * goes to its publisher.
 */

// ---------------------------------------------------------------------------------------------
// Licences and hosts
// ---------------------------------------------------------------------------------------------

/**
 * Open licences only: a book under anything else isn't recorded. No "no derivatives" licence is
 * listed yet; adding one (or any licence) is the owner's call (D5).
 */
export const OPEN_LICENCES = [
  'cc-by-4.0',
  'cc-by-3.0',
  'cc-by-sa-4.0',
  'cc-by-nc-4.0',
  'cc-by-nc-sa-4.0',
  'cc0-1.0',
] as const;
export type OpenLicence = (typeof OPEN_LICENCES)[number];

export const OER_PROVIDERS = [
  'openstax',
  'siyavula',
  'open-uct',
  'wits-wiredspace',
  'up-upspace',
  'uj-ujcontent',
  'tut-tutdor',
  'ukzn-researchspace',
] as const;
export type OerProvider = (typeof OER_PROVIDERS)[number];

export interface OerHost {
  readonly host: string;
  readonly provider: OerProvider;
  /** Set for a university's own open repository. */
  readonly universityId?: UniversityId;
}

/**
 * The hosts a free-book link may point at (D5): OpenStax, Siyavula (bridging maths and science)
 * and each of the six universities' own open repository. Exact host names, never "any subdomain":
 * a university's main site or a student's page is not its open repository. A further host is
 * added only by the owner's decision, with its licence checked.
 */
export const OER_HOSTS: ReadonlyArray<OerHost> = [
  { host: 'openstax.org', provider: 'openstax' },
  { host: 'www.siyavula.com', provider: 'siyavula' },
  { host: 'open.uct.ac.za', provider: 'open-uct', universityId: 'uct' },
  { host: 'wiredspace.wits.ac.za', provider: 'wits-wiredspace', universityId: 'wits' },
  { host: 'repository.up.ac.za', provider: 'up-upspace', universityId: 'up' },
  { host: 'ujcontent.uj.ac.za', provider: 'uj-ujcontent', universityId: 'uj' },
  { host: 'tutvital.tut.ac.za', provider: 'tut-tutdor', universityId: 'tut' },
  { host: 'researchspace.ukzn.ac.za', provider: 'ukzn-researchspace', universityId: 'ukzn' },
];

/**
 * Known piracy and shadow-library hosts (planning.md §8.3, the A10 charter line: no LibGen,
 * Z-Library, "free PDF" sites). The allow-list already keeps them out; this list makes the refusal
 * explicit, so a later widening of the allow-list can never let one of them in. A host matches
 * when it is one of these or a subdomain of one.
 */
export const DENIED_BOOK_HOSTS = [
  'libgen.is',
  'libgen.rs',
  'libgen.st',
  'libgen.li',
  'libgen.lc',
  'libgen.gs',
  'libgen.vg',
  'gen.lib.rus.ec',
  'library.lol',
  'z-lib.org',
  'z-lib.io',
  'z-lib.gs',
  'z-library.sk',
  'z-library.se',
  'zlibrary.to',
  'singlelogin.re',
  '1lib.sk',
  'b-ok.cc',
  'b-ok.org',
  'bookfi.net',
  'annas-archive.org',
  'annas-archive.li',
  'annas-archive.se',
  'sci-hub.se',
  'sci-hub.ru',
  'sci-hub.st',
  'pdfdrive.com',
  'oceanofpdf.com',
  'ebookee.org',
  'vdoc.pub',
  'dokumen.pub',
  'epdf.pub',
  'ebin.pub',
  'pdfcoffee.com',
] as const;

/** Whether a host is a known piracy or shadow-library host, or a subdomain of one. */
export function isDeniedBookHost(host: string): boolean {
  const h = host.toLowerCase();
  return DENIED_BOOK_HOSTS.some((d) => h === d || h.endsWith(`.${d}`));
}

function parsedUrl(url: string): URL | null {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

/** Whether a free-book link may be shown: HTTPS, on an allow-listed host, never a denied one. */
export function isAllowedBookUrl(url: string): boolean {
  const parsed = parsedUrl(url);
  if (!parsed) return false;
  if (parsed.protocol !== 'https:' || parsed.username !== '' || parsed.password !== '') {
    return false;
  }
  const host = parsed.hostname.toLowerCase();
  if (isDeniedBookHost(host)) return false;
  return OER_HOSTS.some((h) => h.host === host);
}

/** Who publishes the book at `url`, or null when the host isn't allow-listed. */
export function oerProviderOf(url: string): OerProvider | null {
  if (!isAllowedBookUrl(url)) return null;
  const host = parsedUrl(url)?.hostname.toLowerCase();
  return OER_HOSTS.find((h) => h.host === host)?.provider ?? null;
}

/**
 * Hosts a library search may run on besides the university's own domain: the discovery services
 * the libraries link to (Ex Libris Primo, ProQuest Summon, OCLC WorldCat Discovery). A university's
 * own subdomain on one of them (uct.primo.exlibrisgroup.com) is what the records hold.
 */
export const LIBRARY_DISCOVERY_DOMAINS = [
  'primo.exlibrisgroup.com',
  'summon.serialssolutions.com',
  'on.worldcat.org',
] as const;

/** Where the search words go in a library's search pattern. */
export const LIBRARY_QUERY = '{query}';

// ---------------------------------------------------------------------------------------------
// The closed lists the records use
// ---------------------------------------------------------------------------------------------

/** What a book is for. Bridging: school-to-university revision (Siyavula's Grade 12 books). */
export const BOOK_LEVELS = ['bridging', 'first-year'] as const;
export type BookLevel = (typeof BOOK_LEVELS)[number];

/** Subject areas a person curates "covers similar ground" matches by (D6). */
export const SUBJECT_AREAS = [
  'mathematics',
  'statistics',
  'physics',
  'chemistry',
  'biology',
  'microbiology',
  'anatomy-and-physiology',
  'economics',
  'accounting',
  'finance',
  'business-management',
  'marketing',
  'information-systems',
  'computer-science',
  'psychology',
  'sociology',
  'political-science',
  'philosophy',
  'anthropology',
  'nursing',
  'pharmacology',
  'academic-writing',
] as const;
export type SubjectArea = (typeof SUBJECT_AREAS)[number];

export const BOOK_MATCH_KINDS = ['is-the-prescribed-book', 'covers-similar-ground'] as const;
export type BookMatchKind = (typeof BOOK_MATCH_KINDS)[number];

// ---------------------------------------------------------------------------------------------
// ISBNs, titles and editions
// ---------------------------------------------------------------------------------------------

/** Whether `s` is 13 digits whose ISBN-13 check digit adds up. */
export function isIsbn13(s: string): boolean {
  if (!/^97[89]\d{10}$/.test(s)) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(s[i]) * (i % 2 === 0 ? 1 : 3);
  return (10 - (sum % 10)) % 10 === Number(s[12]);
}

function isIsbn10(s: string): boolean {
  if (!/^\d{9}[\dX]$/.test(s)) return false;
  let sum = 0;
  for (let i = 0; i < 10; i++) sum += (s[i] === 'X' ? 10 : Number(s[i])) * (10 - i);
  return sum % 11 === 0;
}

/**
 * An ISBN as printed ("978-1-947172-62-3", "0 306 40615 2") as its 13 digits, or null when it
 * isn't a valid ISBN. An ISBN-10 becomes the ISBN-13 of the same book (978 prefix). Spaces,
 * hyphens and soft hyphens (U+00AD) are dropped.
 */
export function normaliseIsbn(printed: string): string | null {
  const s = printed.replace(/[\s­-]/g, '').toUpperCase();
  if (isIsbn13(s)) return s;
  if (!isIsbn10(s)) return null;
  const body = `978${s.slice(0, 9)}`;
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(body[i]) * (i % 2 === 0 ? 1 : 3);
  return `${body}${(10 - (sum % 10)) % 10}`;
}

const ORDINALS: Readonly<Record<string, number>> = {
  first: 1,
  second: 2,
  third: 3,
  fourth: 4,
  fifth: 5,
  sixth: 6,
  seventh: 7,
  eighth: 8,
  ninth: 9,
  tenth: 10,
};

/** Lower case words: "&" as "and", every other non-letter, non-digit a separator. */
function words(printed: string): string[] {
  return printed
    .toLowerCase()
    .replaceAll('&', ' and ')
    .split(/[^a-z0-9]+/)
    .filter((w) => w !== '');
}

/** "3rd", "3" or "third" → 3; anything else → null. */
function ordinal(word: string | undefined): number | null {
  if (word === undefined) return null;
  const n = /^(\d+)(?:st|nd|rd|th)?$/.exec(word);
  if (n) return Number(n[1]);
  return ORDINALS[word] ?? null;
}

/**
 * An edition at the end of a list of words: "2e" (one word), or "2nd edition", "second edition",
 * "3rd ed" (two). Returns the number and how many words it took, or null.
 */
function trailingEdition(ws: ReadonlyArray<string>): { edition: number; words: number } | null {
  const last = ws.at(-1);
  if (last === undefined) return null;
  const short = /^(\d+)e$/.exec(last);
  if (short) return { edition: Number(short[1]), words: 1 };
  if (last === 'edition' || last === 'ed') {
    const n = ordinal(ws.at(-2));
    if (n !== null) return { edition: n, words: 2 };
  }
  return null;
}

/** "2e", "2nd edition", "Second edition", "3rd ed.", "2" → the number; nothing printed → null. */
export function editionNumber(printed: string | null | undefined): number | null {
  if (!printed) return null;
  const ws = words(printed);
  const trailing = trailingEdition(ws);
  if (trailing && trailing.words === ws.length) return trailing.edition;
  return ws.length === 1 ? ordinal(ws[0]) : null;
}

/**
 * A title for comparison: lower case, punctuation as spaces, "&" as "and", one space between
 * words; an edition printed at the end of the title ("Chemistry 2e", "Biology, 2nd edition") is
 * taken off and returned as a number. Deliberately simple and the same on both sides: a near
 * title is not the same book.
 */
export function normaliseBookTitle(printed: string): { title: string; edition: number | null } {
  const ws = words(printed);
  const trailing = trailingEdition(ws);
  const kept = trailing ? ws.slice(0, ws.length - trailing.words) : ws;
  return { title: kept.join(' '), edition: trailing?.edition ?? null };
}

/** Whether a title's own edition and an edition field agree (or either is absent). */
export function editionsAgree(title: string, edition: string | null): boolean {
  const fromTitle = normaliseBookTitle(title).edition;
  const printed = editionNumber(edition);
  return fromTitle === null || printed === null || fromTitle === printed;
}

/** A book's comparable title and edition: from its `edition` field, else from the title. */
function titleKey(title: string, edition: string | null | undefined) {
  const parsed = normaliseBookTitle(title);
  return { title: parsed.title, edition: editionNumber(edition) ?? parsed.edition };
}

// ---------------------------------------------------------------------------------------------
// Matching and links
// ---------------------------------------------------------------------------------------------

/** A prescribed or recommended book as the learner's confirmed outline prints it (6b). */
export interface PrescribedBook {
  readonly title?: string | null;
  readonly edition?: string | null;
  readonly isbn?: string | null;
}

export type ExactMatchBy = 'isbn' | 'title-and-edition';

/**
 * The open book that IS the prescribed book, or null. Only two ways count: the same ISBN, or the
 * same normalised title and the same edition (both absent counts as the same). A valid ISBN that
 * no open book has decides "no": the title is not tried, because the ISBN says it's another book.
 */
export function matchPrescribedBook(
  prescribed: PrescribedBook,
  books: ReadonlyArray<OpenBook>,
): { book: OpenBook; by: ExactMatchBy } | null {
  const isbn = prescribed.isbn ? normaliseIsbn(prescribed.isbn) : null;
  if (isbn) {
    const book = books.find((b) => b.isbns.includes(isbn));
    return book ? { book, by: 'isbn' } : null;
  }
  if (!prescribed.title?.trim()) return null;
  const want = titleKey(prescribed.title, prescribed.edition);
  if (want.title === '') return null;
  const book = books.find((b) => {
    const have = titleKey(b.title, b.edition);
    return have.title === want.title && have.edition === want.edition;
  });
  return book ? { book, by: 'title-and-edition' } : null;
}

export interface FreeBooksQuery {
  readonly universityId: UniversityId;
  readonly moduleCode: string;
  /** Subject areas the module covers, when the caller knows them (a person's curation). */
  readonly subjectAreas?: ReadonlyArray<SubjectArea>;
  /** The prescribed books from the learner's confirmed outline (none when there's no outline). */
  readonly prescribed: ReadonlyArray<PrescribedBook>;
}

export interface FreeBooksResult {
  /** Open books that are the prescribed book: by ISBN, title and edition, or a person's match. */
  readonly prescribedOpen: ReadonlyArray<{
    book: OpenBook;
    by: ExactMatchBy | 'curated';
    prescribed?: PrescribedBook;
  }>;
  /** Curated books that cover similar ground: never the prescribed book, always labelled so. */
  readonly similar: ReadonlyArray<{
    book: OpenBook;
    match: BookMatch;
    label: 'not-your-prescribed-book';
  }>;
  /** True when the view held drafts: the interface labels them (preview only). */
  readonly includesDrafts: boolean;
}

/**
 * The free books for one module card (D6): the prescribed book when it is itself open, then the
 * curated "covers similar ground" books (this module's first, then its subject areas'), each
 * labelled "not your prescribed book". Code decides; the AI only explains this result.
 */
export function freeBooksFor(view: FreeBooksView, query: FreeBooksQuery): FreeBooksResult {
  const code = normaliseModuleCode(query.moduleCode);
  const byId = new Map(view.openBooks.map((b) => [b.id, b]));
  const forModule = (m: BookMatch) =>
    'moduleCode' in m.target &&
    m.target.universityId === query.universityId &&
    normaliseModuleCode(m.target.moduleCode) === code;

  const prescribedOpen: Array<FreeBooksResult['prescribedOpen'][number]> = [];
  const taken = new Set<string>();
  for (const p of query.prescribed) {
    const hit = matchPrescribedBook(p, view.openBooks);
    if (hit && !taken.has(hit.book.id)) {
      taken.add(hit.book.id);
      prescribedOpen.push({ book: hit.book, by: hit.by, prescribed: p });
    }
  }
  for (const m of view.bookMatches) {
    const book = byId.get(m.bookId);
    if (m.kind === 'is-the-prescribed-book' && forModule(m) && book && !taken.has(book.id)) {
      taken.add(book.id);
      prescribedOpen.push({ book, by: 'curated' });
    }
  }

  const areas = new Set(query.subjectAreas ?? []);
  const similarMatches = [
    ...view.bookMatches.filter((m) => m.kind === 'covers-similar-ground' && forModule(m)),
    ...view.bookMatches.filter(
      (m) =>
        m.kind === 'covers-similar-ground' &&
        'subjectArea' in m.target &&
        areas.has(m.target.subjectArea),
    ),
  ];
  const similar: Array<FreeBooksResult['similar'][number]> = [];
  for (const match of similarMatches) {
    const book = byId.get(match.bookId);
    if (!book || taken.has(book.id)) continue;
    taken.add(book.id);
    similar.push({ book, match, label: 'not-your-prescribed-book' });
  }
  return { prescribedOpen, similar, includesDrafts: view.includesDrafts };
}

/** A university's library search, if the view holds one. */
export function libraryFor(
  view: Pick<FreeBooksView, 'libraryCatalogues'>,
  id: UniversityId,
): LibraryCatalogue | undefined {
  return view.libraryCatalogues.find((l) => l.universityId === id);
}

/**
 * A link to search the library for a book: by ISBN when a valid one is given, else by title.
 * Null when there is nothing to search with, or the link would be absurdly long. It says where to
 * search and how, and nothing about whether a copy is there (D7): the library's own page says that.
 */
export function librarySearchLink(
  library: Pick<LibraryCatalogue, 'searchUrl'>,
  book: { isbn?: string | null; title?: string | null },
): { url: string; by: 'isbn' | 'title' } | null {
  const isbn = book.isbn ? normaliseIsbn(book.isbn) : null;
  const title = book.title?.trim().replace(/\s+/g, ' ') ?? '';
  let query: { text: string; by: 'isbn' | 'title' } | null = null;
  if (isbn) query = { text: isbn, by: 'isbn' };
  else if (title) query = { text: title, by: 'title' };
  if (!query) return null;
  const url = library.searchUrl.replace(LIBRARY_QUERY, encodeURIComponent(query.text));
  return url.length > MAX_LINK_LENGTH ? null : { url, by: query.by };
}
