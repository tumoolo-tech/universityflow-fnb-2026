import { describe, expect, it } from 'vitest';
import {
  BOOK_LEVELS,
  DENIED_BOOK_HOSTS,
  editionNumber,
  freeBooksFor,
  isAllowedBookUrl,
  isDeniedBookHost,
  isIsbn13,
  libraryFor,
  librarySearchLink,
  matchPrescribedBook,
  normaliseBookTitle,
  normaliseIsbn,
  OER_HOSTS,
  OPEN_LICENCES,
  oerProviderOf,
} from './book-links';
import {
  type BookMatch,
  bookMatchSchema,
  FREE_BOOKS_RAW,
  type FreeBooksRecords,
  freeBooksView,
  freeBooksViewOf,
  type LibraryCatalogue,
  libraryCatalogueSchema,
  type OpenBook,
  openBookSchema,
} from './books';
import { isDraft } from './provenance';
import { isUniversitySource } from './records';

const TODAY = new Date('2026-10-24T08:00:00Z');
const { openBooks, bookMatches, libraryCatalogues } = FREE_BOOKS_RAW;

/** Synthetic records (hard rule 4): shaped like the real ones, made up for the test. */
const BOOK: OpenBook = {
  sourceUrl: 'https://openstax.org/details/books/test-book',
  academicYear: 2026,
  id: 'openstax-test-book',
  title: 'Test Chemistry 2e',
  authors: ['A. Author', 'B. Author'],
  edition: '2e',
  isbns: ['9781947172623'],
  licence: 'cc-by-nc-sa-4.0',
  url: 'https://openstax.org/details/books/test-book',
  subjectAreas: ['chemistry'],
  level: 'first-year',
  accessedOn: '2026-10-24',
};

const SIMILAR: BookMatch = {
  sourceUrl: 'https://www.uct.ac.za/test-handbook.pdf',
  academicYear: 2026,
  id: 'match-test-similar',
  bookId: BOOK.id,
  target: { universityId: 'uct', moduleCode: 'TST1000F' },
  kind: 'covers-similar-ground',
  note: 'A synthetic match for the test: covers the same first-year ground.',
};

const LIBRARY: LibraryCatalogue = {
  sourceUrl: 'https://www.lib.uct.ac.za/',
  academicYear: 2026,
  universityId: 'uct',
  name: 'Test Libraries',
  searchUrl:
    'https://uct.primo.exlibrisgroup.com/discovery/search?query=any,contains,{query}&vid=X',
  accessedOn: '2026-10-24',
};

const verified = <T extends object>(r: T) => ({
  ...r,
  verifiedOn: '2026-10-20',
  verifiedBy: 'A Person',
});

describe('openBook records (hard rule 3, D5)', () => {
  it.each(openBooks.map((b) => [b.id, b]))('%s validates', (_id, record) => {
    expect(openBookSchema.parse(record)).toBeTruthy();
  });

  it('holds every record as a draft: no agent adds verifiedOn or verifiedBy', () => {
    const all = [...openBooks, ...bookMatches, ...libraryCatalogues];
    expect(openBooks.length).toBeGreaterThanOrEqual(30);
    for (const r of all) {
      expect(isDraft(r)).toBe(true);
      expect(r).not.toHaveProperty('verifiedOn');
      expect(r).not.toHaveProperty('verifiedBy');
    }
  });

  it('gives each book a unique id and each ISBN to one book only', () => {
    const ids = openBooks.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
    const isbns = openBooks.flatMap((b) => b.isbns);
    expect(new Set(isbns).size).toBe(isbns.length);
  });

  it('records only open licences, from a closed list', () => {
    expect(OPEN_LICENCES).not.toContain('all-rights-reserved');
    for (const b of openBooks) expect(OPEN_LICENCES).toContain(b.licence);
    expect(openBookSchema.safeParse({ ...BOOK, licence: 'all-rights-reserved' }).success).toBe(
      false,
    );
    expect(openBookSchema.safeParse({ ...BOOK, licence: 'free-pdf' }).success).toBe(false);
  });

  it('refuses a book with no source, no author, a bad ISBN or two clashing editions', () => {
    expect(openBookSchema.safeParse(BOOK).success).toBe(true);
    const { sourceUrl: _s, ...noSource } = BOOK;
    expect(openBookSchema.safeParse(noSource).success).toBe(false);
    expect(openBookSchema.safeParse({ ...BOOK, authors: [] }).success).toBe(false);
    // One digit off: the check digit no longer adds up.
    expect(openBookSchema.safeParse({ ...BOOK, isbns: ['9781947172624'] }).success).toBe(false);
    expect(openBookSchema.safeParse({ ...BOOK, isbns: ['978-1-947172-62-3'] }).success).toBe(false);
    expect(
      openBookSchema.safeParse({ ...BOOK, isbns: ['9781947172623', '9781947172623'] }).success,
    ).toBe(false);
    // The title prints "2e" but the edition says 3e.
    expect(openBookSchema.safeParse({ ...BOOK, edition: '3e' }).success).toBe(false);
    expect(openBookSchema.safeParse({ ...BOOK, level: 'postgraduate' }).success).toBe(false);
    expect(BOOK_LEVELS).toEqual(['bridging', 'first-year']);
  });
});

describe('the host allow-list (D5): only OpenStax, the six universities’ open repositories and Siyavula', () => {
  it('lets every allow-listed host through, over HTTPS only', () => {
    for (const { host } of OER_HOSTS) {
      expect(isAllowedBookUrl(`https://${host}/some/book`), host).toBe(true);
      expect(isAllowedBookUrl(`http://${host}/some/book`), host).toBe(false);
    }
    expect(OER_HOSTS.map((h) => h.provider).sort()).toEqual(
      [
        'openstax',
        'siyavula',
        'open-uct',
        'wits-wiredspace',
        'up-upspace',
        'uj-ujcontent',
        'tut-tutdor',
        'ukzn-researchspace',
      ].sort(),
    );
  });

  it('names the provider of an allowed link, and none for any other', () => {
    expect(oerProviderOf('https://open.uct.ac.za/items/x')).toBe('open-uct');
    expect(oerProviderOf('https://openstax.org/details/books/biology-2e')).toBe('openstax');
    expect(oerProviderOf('https://libgen.is/book')).toBeNull();
    expect(oerProviderOf('https://www.uct.ac.za/')).toBeNull();
  });

  it('puts every university repository on that university’s own domain', () => {
    const domains = ['uct.ac.za', 'wits.ac.za', 'up.ac.za', 'uj.ac.za', 'tut.ac.za', 'ukzn.ac.za'];
    const repositories = OER_HOSTS.filter((h) => h.universityId !== undefined);
    expect(repositories).toHaveLength(6);
    for (const r of repositories) {
      expect(
        domains.some((d) => r.host.endsWith(`.${d}`)),
        r.host,
      ).toBe(true);
    }
  });

  it('refuses any other host, and the usual tricks for dressing one up as an allowed host', () => {
    for (const url of [
      'https://example.com/calculus.pdf',
      'https://openstax.org.evil.example/details/books/calculus-volume-1',
      'https://evil-openstax.org/details/books/calculus-volume-1',
      'https://openstax.org@libgen.is/book',
      'https://student.uct.ac.za/notes.pdf', // a university domain, but not its open repository
      'https://www.uct.ac.za/handbook.pdf',
      'https://drive.google.com/file/d/xyz',
      'ftp://openstax.org/book',
      'not a url',
    ]) {
      expect(isAllowedBookUrl(url), url).toBe(false);
    }
  });

  it('can never let a known piracy or shadow-library host through (deny-list)', () => {
    expect(DENIED_BOOK_HOSTS.length).toBeGreaterThanOrEqual(20);
    for (const host of DENIED_BOOK_HOSTS) {
      expect(isDeniedBookHost(host), host).toBe(true);
      for (const url of [
        `https://${host}/book/calculus-volume-1`,
        `https://www.${host}/search?q=openstax.org`,
        `https://mirror.${host}/openstax.org/chemistry-2e.pdf`,
      ]) {
        expect(isAllowedBookUrl(url), url).toBe(false);
        expect(openBookSchema.safeParse({ ...BOOK, url }).success, url).toBe(false);
        expect(openBookSchema.safeParse({ ...BOOK, sourceUrl: url }).success, url).toBe(false);
      }
    }
    // No allowed host is on the deny-list, and no record links to a denied one.
    for (const { host } of OER_HOSTS) expect(isDeniedBookHost(host), host).toBe(false);
    for (const b of openBooks) {
      expect(isDeniedBookHost(new URL(b.url).hostname), b.id).toBe(false);
      expect(isAllowedBookUrl(b.url), b.id).toBe(true);
      expect(isAllowedBookUrl(b.sourceUrl), b.id).toBe(true);
    }
  });

  it('refuses a book whose link or source is off the allow-list', () => {
    expect(
      openBookSchema.safeParse({ ...BOOK, url: 'https://pdf-books.example/chemistry.pdf' }).success,
    ).toBe(false);
    expect(
      openBookSchema.safeParse({ ...BOOK, sourceUrl: 'https://blog.example/openstax' }).success,
    ).toBe(false);
  });
});

describe('bookMatch records (D6)', () => {
  it.each(bookMatches.map((m) => [m.id, m]))('%s validates and names a real book', (_id, m) => {
    expect(bookMatchSchema.parse(m)).toBeTruthy();
    expect(
      openBooks.some((b) => b.id === m.bookId),
      m.bookId,
    ).toBe(true);
  });

  it('gives each match a unique id, and never matches the same book twice to one target', () => {
    const ids = bookMatches.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    const keys = bookMatches.map(
      (m) =>
        `${m.bookId}|${'subjectArea' in m.target ? m.target.subjectArea : `${m.target.universityId}:${m.target.moduleCode}`}`,
    );
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('drafts no "is the prescribed book" match: that needs a person who has read the outline', () => {
    expect(bookMatches.filter((m) => m.kind === 'is-the-prescribed-book')).toEqual([]);
  });

  it('refuses a "prescribed" claim for a whole subject area, or one not sourced from the university', () => {
    expect(bookMatchSchema.safeParse(SIMILAR).success).toBe(true);
    expect(
      bookMatchSchema.safeParse({
        ...SIMILAR,
        kind: 'is-the-prescribed-book',
        target: { subjectArea: 'chemistry' },
      }).success,
    ).toBe(false);
    expect(
      bookMatchSchema.safeParse({
        ...SIMILAR,
        kind: 'is-the-prescribed-book',
        sourceUrl: 'https://openstax.org/details/books/test-book',
      }).success,
    ).toBe(false);
    expect(bookMatchSchema.safeParse({ ...SIMILAR, kind: 'is-the-prescribed-book' }).success).toBe(
      true,
    );
    expect(bookMatchSchema.safeParse({ ...SIMILAR, note: '' }).success).toBe(false);
    expect(bookMatchSchema.safeParse({ ...SIMILAR, kind: 'same-book' }).success).toBe(false);
  });

  it('cites the module’s own rule book for a module match, or an allow-listed book page for an area', () => {
    for (const m of bookMatches) {
      if ('moduleCode' in m.target) {
        expect(isUniversitySource(m.target.universityId, m.sourceUrl), m.id).toBe(true);
      } else {
        expect(isAllowedBookUrl(m.sourceUrl), m.id).toBe(true);
      }
    }
  });
});

describe('libraryCatalogue records and the search link (D7)', () => {
  it.each(libraryCatalogues.map((l) => [l.universityId, l]))('%s validates', (_id, l) => {
    expect(libraryCatalogueSchema.parse(l)).toBeTruthy();
  });

  it('has at most one per university, each sourced from the university’s own site', () => {
    const ids = libraryCatalogues.map((l) => l.universityId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBeGreaterThanOrEqual(5);
  });

  it('refuses a pattern without exactly one {query}, off HTTPS, or on a stranger’s host', () => {
    expect(libraryCatalogueSchema.safeParse(LIBRARY).success).toBe(true);
    const bad = (searchUrl: string) =>
      libraryCatalogueSchema.safeParse({ ...LIBRARY, searchUrl }).success;
    expect(bad('https://uct.primo.exlibrisgroup.com/discovery/search?vid=X')).toBe(false);
    expect(bad('https://uct.primo.exlibrisgroup.com/s?q={query}&r={query}')).toBe(false);
    expect(bad('http://innopac.uct.ac.za/search/?searcharg={query}')).toBe(false);
    expect(bad('https://library-search.example/?q={query}')).toBe(false);
    expect(bad('https://libgen.is/search.php?req={query}')).toBe(false);
    expect(bad('https://innopac.uct.ac.za/search/?searcharg={query}')).toBe(true);
    expect(
      libraryCatalogueSchema.safeParse({ ...LIBRARY, sourceUrl: 'https://www.wits.ac.za/library/' })
        .success,
    ).toBe(false);
  });

  it('builds the link with the ISBN first, else the title, encoded, and claims nothing', () => {
    const byIsbn = librarySearchLink(LIBRARY, { isbn: '978-1-947172-62-3', title: 'Chemistry 2e' });
    expect(byIsbn).toEqual({
      url: 'https://uct.primo.exlibrisgroup.com/discovery/search?query=any,contains,9781947172623&vid=X',
      by: 'isbn',
    });
    const byTitle = librarySearchLink(LIBRARY, {
      isbn: 'not an isbn',
      title: '  Chemistry & Society 1 ',
    });
    expect(byTitle).toEqual({
      url: 'https://uct.primo.exlibrisgroup.com/discovery/search?query=any,contains,Chemistry%20%26%20Society%201&vid=X',
      by: 'title',
    });
    expect(librarySearchLink(LIBRARY, { title: '   ' })).toBeNull();
    expect(librarySearchLink(LIBRARY, {})).toBeNull();
    // Nothing about availability: only where to search, and how.
    expect(Object.keys(byIsbn ?? {}).sort()).toEqual(['by', 'url']);
    // A pasted title can't make the link absurdly long.
    expect(librarySearchLink(LIBRARY, { title: 'x'.repeat(5000) })).toBeNull();
  });

  it('finds the library of a university only when the view holds it', () => {
    const view = freeBooksViewOf(
      { openBooks: [], bookMatches: [], libraryCatalogues: [verified(LIBRARY)] },
      TODAY,
      { includeDrafts: false },
    );
    expect(libraryFor(view, 'uct')?.name).toBe('Test Libraries');
    expect(libraryFor(view, 'tut')).toBeUndefined();
  });
});

describe('matching an outline’s prescribed book (exact ISBN, or title and edition)', () => {
  const books = [
    BOOK,
    {
      ...BOOK,
      id: 'openstax-calc',
      title: 'Calculus Volume 1',
      edition: null,
      isbns: ['9781938168024'],
    },
  ];

  it('normalises ISBNs: hyphens and spaces go, an ISBN-10 becomes its ISBN-13, a bad one is refused', () => {
    expect(normaliseIsbn('978-1-947172-62-3')).toBe('9781947172623');
    expect(normaliseIsbn(' 978 1 947172 62 3 ')).toBe('9781947172623');
    expect(normaliseIsbn('0-306-40615-2')).toBe('9780306406157');
    expect(normaliseIsbn('978-1-947172-62-4')).toBeNull();
    expect(normaliseIsbn('12345')).toBeNull();
    expect(isIsbn13('9781947172623')).toBe(true);
    expect(isIsbn13('9781947172624')).toBe(false);
  });

  it('normalises titles and editions the same way on both sides', () => {
    expect(normaliseBookTitle('Chemistry: Atoms First 2e')).toEqual(
      normaliseBookTitle('chemistry  atoms first, 2nd edition'),
    );
    expect(normaliseBookTitle('Chemistry 2e')).toEqual({ title: 'chemistry', edition: 2 });
    expect(normaliseBookTitle('Calculus Volume 1')).toEqual({
      title: 'calculus volume 1',
      edition: null,
    });
    expect(editionNumber('2e')).toBe(2);
    expect(editionNumber('Second edition')).toBe(2);
    expect(editionNumber('3rd ed.')).toBe(3);
    expect(editionNumber('')).toBeNull();
    expect(editionNumber(null)).toBeNull();
  });

  it('matches by exact ISBN, whatever the printed title', () => {
    expect(
      matchPrescribedBook({ isbn: '978-1-947172-62-3', title: 'Something else' }, books),
    ).toEqual({
      book: BOOK,
      by: 'isbn',
    });
  });

  it('matches by normalised title and the same edition', () => {
    expect(matchPrescribedBook({ title: 'Test Chemistry', edition: '2nd edition' }, books)).toEqual(
      {
        book: BOOK,
        by: 'title-and-edition',
      },
    );
    expect(matchPrescribedBook({ title: 'calculus volume 1' }, books)?.by).toBe(
      'title-and-edition',
    );
  });

  it('never matches on a near title, another edition, a missing edition, or an ISBN that disagrees', () => {
    expect(matchPrescribedBook({ title: 'Test Chemistry', edition: '3e' }, books)).toBeNull();
    expect(matchPrescribedBook({ title: 'Test Chemistry' }, books)).toBeNull();
    expect(matchPrescribedBook({ title: 'Test Chemistry 2e Volume 2' }, books)).toBeNull();
    expect(matchPrescribedBook({ title: 'Chemistry 2e' }, books)).toBeNull();
    expect(matchPrescribedBook({ title: 'Calculus', edition: null }, books)).toBeNull();
    expect(
      matchPrescribedBook({ isbn: '9780306406157', title: 'Test Chemistry', edition: '2e' }, books),
    ).toBeNull();
    expect(matchPrescribedBook({}, books)).toBeNull();
  });
});

describe('freeBooksFor: what a module card shows', () => {
  const area: BookMatch = {
    ...SIMILAR,
    id: 'match-test-area',
    sourceUrl: BOOK.sourceUrl,
    target: { subjectArea: 'chemistry' },
  };
  const other: OpenBook = {
    ...BOOK,
    id: 'openstax-other',
    title: 'Other Chemistry',
    edition: null,
    isbns: [],
  };
  const records: FreeBooksRecords = {
    openBooks: [verified(BOOK), verified(other)],
    bookMatches: [verified(SIMILAR), verified({ ...area, bookId: other.id })],
    libraryCatalogues: [verified(LIBRARY)],
  };
  const view = freeBooksViewOf(records, TODAY, { includeDrafts: false });

  it('labels the prescribed book when it is itself open, and every other book "not your prescribed book"', () => {
    const result = freeBooksFor(view, {
      universityId: 'uct',
      moduleCode: 'tst 1000f',
      subjectAreas: ['chemistry'],
      prescribed: [{ title: 'Test Chemistry', edition: '2e' }],
    });
    expect(result.prescribedOpen.map((p) => [p.book.id, p.by])).toEqual([
      ['openstax-test-book', 'title-and-edition'],
    ]);
    // The prescribed book is not listed again as "similar".
    expect(result.similar.map((s) => [s.book.id, s.label])).toEqual([
      ['openstax-other', 'not-your-prescribed-book'],
    ]);
    expect(result.includesDrafts).toBe(false);
  });

  it('shows the curated module match first, then the subject area’s, all labelled', () => {
    const result = freeBooksFor(view, {
      universityId: 'uct',
      moduleCode: 'TST1000F',
      subjectAreas: ['chemistry'],
      prescribed: [],
    });
    expect(result.prescribedOpen).toEqual([]);
    expect(result.similar.map((s) => [s.book.id, s.match.id])).toEqual([
      ['openstax-test-book', 'match-test-similar'],
      ['openstax-other', 'match-test-area'],
    ]);
    expect(result.similar.every((s) => s.label === 'not-your-prescribed-book')).toBe(true);
  });

  it('a person’s "is the prescribed book" match counts as prescribed, not similar', () => {
    const prescribedMatch = verified({
      ...SIMILAR,
      id: 'm-p',
      kind: 'is-the-prescribed-book' as const,
    });
    const v = freeBooksViewOf({ ...records, bookMatches: [prescribedMatch] }, TODAY, {
      includeDrafts: false,
    });
    const result = freeBooksFor(v, { universityId: 'uct', moduleCode: 'TST1000F', prescribed: [] });
    expect(result.prescribedOpen.map((p) => [p.book.id, p.by])).toEqual([
      ['openstax-test-book', 'curated'],
    ]);
    expect(result.similar).toEqual([]);
  });

  it('ignores another university’s module with the same code, and gives nothing for an unknown module', () => {
    expect(
      freeBooksFor(view, { universityId: 'wits', moduleCode: 'TST1000F', prescribed: [] }).similar,
    ).toEqual([]);
    expect(
      freeBooksFor(view, { universityId: 'uct', moduleCode: 'NOPE101', prescribed: [] }),
    ).toEqual({ prescribedOpen: [], similar: [], includesDrafts: false });
  });

  it('hides drafts from learners and shows them only in preview, flagged', () => {
    expect(freeBooksView(TODAY, { includeDrafts: false })).toEqual({
      openBooks: [],
      bookMatches: [],
      libraryCatalogues: [],
      includesDrafts: false,
    });
    const preview = freeBooksView(TODAY, { includeDrafts: true });
    expect(preview.openBooks).toHaveLength(openBooks.length);
    expect(preview.includesDrafts).toBe(true);
    // A verified match to an unverified book never shows: the book must be shown too.
    const v = freeBooksViewOf(
      { openBooks: [BOOK], bookMatches: [verified(SIMILAR)], libraryCatalogues: [] },
      TODAY,
      { includeDrafts: false },
    );
    expect(v.bookMatches).toEqual([]);
  });

  it('finds the drafted real records in preview: UCT’s Introductory Statistics gets IntroSTAT', () => {
    const preview = freeBooksView(TODAY, { includeDrafts: true });
    const result = freeBooksFor(preview, {
      universityId: 'uct',
      moduleCode: 'STA1000S',
      prescribed: [],
    });
    expect(result.similar.map((s) => s.book.id)).toContain('openuct-introstat');
    expect(result.includesDrafts).toBe(true);
  });
});
