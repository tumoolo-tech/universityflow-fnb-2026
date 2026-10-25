import 'server-only';
import type { BookLevel, OerProvider, OpenLicence } from '@universityflow/catalogue';
import { freeBooks } from '@universityflow/content';
import type { CardBooks } from '@universityflow/ui';

/**
 * The module card's free books and library links, worded here on the server (Phase 6c, 6d;
 * A4-13: the book rules and the free-book words stay off the browser and out of the app's
 * bundles, whose budgets refuse catalogue words). The server runs the catalogue's `freeBooksFor`,
 * then this, and sends the result in `ModuleCardData.books`; the page and the app only lay it out.
 */

/** A free book the server's `freeBooksFor` found: an allow-listed link (D5), never a guess. */
export interface CardFreeBook {
  readonly id: string;
  readonly title: string;
  readonly authors: ReadonlyArray<string>;
  readonly url: string;
  readonly provider: OerProvider | null;
  readonly licence: OpenLicence;
  readonly level: BookLevel;
  /** `prescribed`: it IS the prescribed book; `similar`: covers similar ground (D6). */
  readonly kind: 'prescribed' | 'similar';
  readonly draft: boolean;
}

/** The free books and the library's own search for a card, in words. */
export function cardBooks(input: {
  readonly free: ReadonlyArray<CardFreeBook>;
  /** The library's own search for each book the outline names (D7), or null without one. */
  readonly library: {
    readonly name: string;
    readonly links: ReadonlyArray<{ readonly title: string; readonly url: string }>;
    readonly draft: boolean;
  } | null;
  /** How many books the learner's confirmed outline names. */
  readonly outlineBooks: number;
}): CardBooks {
  const books = input.free.map((b) => {
    const provider = b.provider ? freeBooks.providers[b.provider] : new URL(b.url).hostname;
    return {
      label: b.kind === 'prescribed' ? freeBooks.prescribedOpen : freeBooks.notPrescribed,
      title: b.title,
      link: freeBooks.openOn(b.title, provider),
      url: b.url,
      details: [freeBooks.levels[b.level], freeBooks.licences[b.licence]],
      draft: b.draft,
    };
  });
  const library = input.library;
  return {
    free: {
      title: freeBooks.title,
      lead: freeBooks.lead,
      books,
      none: books.length === 0 ? freeBooks.none : null,
      onlyLegal: freeBooks.onlyLegal,
    },
    library:
      library && library.links.length > 0
        ? {
            links: library.links.map((l) => ({
              label: `${freeBooks.searchLibrary(library.name)}: ${l.title}`,
              url: l.url,
            })),
            note: freeBooks.libraryNote,
            draft: library.draft,
          }
        : null,
    noLibrary: library === null && input.outlineBooks > 0 ? freeBooks.noLibrary : null,
  };
}
