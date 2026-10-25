/**
 * A small seeded random number generator (mulberry32 over an FNV-1a hash of the seed), so the
 * same seed always makes the same synthetic learners and the same PDFs.
 */

export type Random = () => number;

function hash(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function seeded(seed: string): Random {
  let state = hash(seed);
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick<T>(random: Random, items: ReadonlyArray<T>): T {
  const item = items[Math.floor(random() * items.length)];
  if (item === undefined) throw new RangeError('Nothing to pick from');
  return item;
}

/** A shuffled copy (Fisher–Yates). */
export function shuffled<T>(random: Random, items: ReadonlyArray<T>): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j] as T, copy[i] as T];
  }
  return copy;
}
