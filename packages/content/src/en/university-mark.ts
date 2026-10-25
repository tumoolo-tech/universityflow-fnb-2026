/**
 * `en.universityMark`: the words around the neutral university mark (the owner's decision,
 * option A, 2026-10-23; packages/ui university-mark.ts). The mark's letters are the university's
 * short name from the catalogue, which is data, not copy. Beside the name the mark is decoration
 * and says nothing; a mark shown alone is named by the university's name. Owed the owner's
 * wording review.
 */
export const universityMark = {
  /** A permitted real logo shown without the name beside it (no university has permitted one). */
  logoAlt: (name: string) => `${name} logo`,
};
