import type { CardArt } from '@/lib/course-art';

/**
 * A card's picture and its scrim (cards8; shared with the subject and offer cards, cards9): the
 * first two children of a `.uf-course-card`, behind its words (globals.css). Decoration only, the
 * words carry the meaning: no alt text, hidden from screen readers. Lazy and low priority, so it
 * never holds up the first screen; its size is set, so nothing moves when it arrives. No
 * next/image: same-origin static files from public/.
 */
export function CardArtLayers({ art, sizes }: { art: CardArt; sizes: string }) {
  return (
    <>
      <div className="uf-course-art" aria-hidden="true">
        <picture>
          <source type="image/avif" srcSet={art.avifSrcSet} sizes={sizes} />
          <img
            src={art.src}
            srcSet={art.webpSrcSet}
            sizes={sizes}
            alt=""
            width={800}
            height={400}
            loading="lazy"
            decoding="async"
            fetchPriority="low"
          />
        </picture>
      </div>
      <div className="uf-course-art-scrim" aria-hidden="true" />
    </>
  );
}

/** A card is the page's width on a phone, and at most about 40rem in a column or the chat. */
export const CARD_ART_SIZES = '(min-width: 48rem) 40rem, 100vw';
