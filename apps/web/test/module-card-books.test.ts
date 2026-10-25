import { freeBooks } from '@universityflow/content';
import { describe, expect, it, vi } from 'vitest';

/**
 * A module card's free books and library links, worded on the server (Phase 6c, 6d): labelled as
 * the prescribed book or "not your prescribed book", with the library's own search and what it
 * doesn't promise (D7). The words never reach the browser or the app's bundles (A4-13). Synthetic.
 */

vi.mock('server-only', () => ({}));
const { cardBooks } = await import('../lib/server/module-card-books');

const BOOK = {
  id: 'openstax-test',
  title: 'Open Test Book',
  authors: ['B. Writer'],
  url: 'https://openstax.org/details/books/test',
  provider: 'openstax' as const,
  licence: 'cc-by-4.0' as const,
  level: 'first-year' as const,
  kind: 'similar' as const,
  draft: true,
};

describe('a card’s books, in words', () => {
  it('labels each free book and links the library’s own search', () => {
    const books = cardBooks({
      free: [
        BOOK,
        {
          ...BOOK,
          id: 'b',
          title: 'Prescribed Open',
          kind: 'prescribed',
          provider: null,
          url: 'https://open.uct.ac.za/x',
        },
      ],
      library: {
        name: 'Test Library',
        links: [{ title: 'Sample Studies', url: 'https://library.example.ac.za/?q=1' }],
        draft: false,
      },
      outlineBooks: 1,
    });
    expect(books.free.books).toEqual([
      {
        label: freeBooks.notPrescribed,
        title: 'Open Test Book',
        link: freeBooks.openOn('Open Test Book', 'OpenStax'),
        url: BOOK.url,
        details: [freeBooks.levels['first-year'], freeBooks.licences['cc-by-4.0']],
        draft: true,
      },
      expect.objectContaining({
        label: freeBooks.prescribedOpen,
        link: freeBooks.openOn('Prescribed Open', 'open.uct.ac.za'),
      }),
    ]);
    expect(books.free.none).toBeNull();
    expect(books.library).toEqual({
      links: [
        {
          label: `${freeBooks.searchLibrary('Test Library')}: Sample Studies`,
          url: 'https://library.example.ac.za/?q=1',
        },
      ],
      note: freeBooks.libraryNote,
      draft: false,
    });
  });

  it('says when there is no free book, and when the library’s search isn’t known', () => {
    const books = cardBooks({ free: [], library: null, outlineBooks: 2 });
    expect(books.free.none).toBe(freeBooks.none);
    expect(books.library).toBeNull();
    expect(books.noLibrary).toBe(freeBooks.noLibrary);
    expect(cardBooks({ free: [], library: null, outlineBooks: 0 }).noLibrary).toBeNull();
  });
});
