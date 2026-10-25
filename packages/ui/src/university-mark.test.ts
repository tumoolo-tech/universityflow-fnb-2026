import { logoWebPath, RAW_CATALOGUE } from '@universityflow/catalogue';
import { NON_TEXT_PAIRS, TEXT_PAIRS, tokens } from '@universityflow/tokens';
import { describe, expect, it } from 'vitest';
import {
  MONOGRAM_MAX,
  UNIVERSITY_LOGOS,
  UNIVERSITY_MARK_COLORS,
  universityMark,
  universityMonogram,
} from './university-mark';

/**
 * The neutral university mark (the owner's decision, option A, 2026-10-23): our own letters in our
 * own greys beside every university's name, never its logo or its colours. A real logo shows only
 * where the catalogue holds the university's written permission (`logoPermission`).
 */

describe('universityMonogram', () => {
  it.each([
    ['wits', 'Wits'],
    ['uj', 'UJ'],
    ['up', 'UP'],
    ['uct', 'UCT'],
    ['tut', 'TUT'],
    ['ukzn', 'UKZN'],
  ])("gives %s the letters of its short name: '%s'", (id, letters) => {
    const university = RAW_CATALOGUE.universities.find((u) => u.id === id);
    expect(universityMonogram(university?.shortName ?? '')).toBe(letters);
  });

  it('covers every university in the catalogue, each in at most four letters', () => {
    for (const u of RAW_CATALOGUE.universities) {
      const letters = universityMonogram(u.shortName);
      expect(letters.length, u.id).toBeGreaterThan(0);
      expect(letters.length, u.id).toBeLessThanOrEqual(MONOGRAM_MAX);
    }
  });

  it('turns a longer name into its initials, leaving out the small words', () => {
    expect(universityMonogram('University of the Witwatersrand')).toBe('UW');
    expect(universityMonogram('Tshwane University of Technology')).toBe('TUT');
    expect(universityMonogram('  Nelson   Mandela University ')).toBe('NMU');
    expect(universityMonogram('Cape Peninsula University of Technology and Design Arts')).toBe(
      'CPUT',
    );
  });

  it('keeps a whole first letter in any script, and never returns nothing', () => {
    expect(universityMonogram('éCole Supérieure')).toBe('ÉS');
    expect(universityMonogram('')).toBe('?');
    expect(universityMonogram('   ')).toBe('?');
  });

  it('keeps a long single word to its first four letters', () => {
    expect(universityMonogram('Stellenbosch')).toBe('Stel');
  });
});

describe('universityMark', () => {
  it('shows our letters and no logo for every university today (none has given permission)', () => {
    for (const u of RAW_CATALOGUE.universities) {
      expect(universityMark(u.shortName)).toEqual({
        monogram: universityMonogram(u.shortName),
        logo: null,
      });
    }
  });

  it('shows a logo only for a name the logo list holds', () => {
    const logos = { Wits: '/logos/wits.png' };
    expect(universityMark('Wits', logos)).toEqual({ monogram: 'Wits', logo: '/logos/wits.png' });
    expect(universityMark('UJ', logos)).toEqual({ monogram: 'UJ', logo: null });
  });
});

describe('UNIVERSITY_LOGOS', () => {
  it("is exactly the catalogue's written permissions, by short name: none today", () => {
    const permitted = Object.fromEntries(
      RAW_CATALOGUE.universities.flatMap((u) =>
        u.logoPermission ? [[u.shortName, logoWebPath(u.logoPermission)]] : [],
      ),
    );
    expect(UNIVERSITY_LOGOS).toEqual(permitted);
    expect(UNIVERSITY_LOGOS).toEqual({});
  });
});

describe('the mark’s colours', () => {
  const { ground, ink, edge } = UNIVERSITY_MARK_COLORS;

  it('are tested pairs: the letters on the ground (text), the edge on the ground (non-text)', () => {
    expect(TEXT_PAIRS).toContainEqual([ink, ground]);
    expect(NON_TEXT_PAIRS).toContainEqual([edge, ground]);
  });

  it('are neutral greys, so no university’s colours are borrowed', () => {
    for (const token of [ground, ink, edge]) {
      const hex = tokens.color[token];
      const [r, g, b] = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16)) as [
        number,
        number,
        number,
      ];
      expect(Math.max(r, g, b) - Math.min(r, g, b), token).toBeLessThanOrEqual(12);
    }
  });
});
