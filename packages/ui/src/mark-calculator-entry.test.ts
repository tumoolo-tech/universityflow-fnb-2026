import { describe, expect, it, vi } from 'vitest';

/**
 * `@universityflow/ui/mark-calculator`: what the browser's calculator loads (Phase 6c). It must
 * bring no copy and no catalogue record: the ui barrel's module card imports the free-book words
 * (their providers, "Siyavula" among them), and the web's client-chunk budget fails on those. Each
 * module that would bring them is replaced by one that fails the moment it loads.
 */
const { loaded } = vi.hoisted(() => ({
  loaded: (name: string) => () => {
    throw new Error(`the calculator entry loaded ${name}`);
  },
}));
vi.mock('@universityflow/content/app', loaded('the app copy'));
vi.mock('@universityflow/content', loaded('the content barrel'));
vi.mock('@universityflow/catalogue', loaded('the catalogue barrel'));
vi.mock('@universityflow/admissions', loaded('the admissions barrel'));
vi.mock('./module-card', loaded('the module card (copy, free-book words)'));
vi.mock('./index', loaded('the ui barrel'));

describe('@universityflow/ui/mark-calculator', () => {
  it('works a result out with words it is given, loading no copy or catalogue data', async () => {
    const calc = await import('./mark-calculator');
    expect(calc.parseMark('18/24')).toBe(75);
    expect(calc.fill('You need {0}% in the exam.', 56)).toBe('You need 56% in the exam.');
  });

  it('is exported as a subpath', async () => {
    const pkg = (await import('../package.json')).default as { exports: Record<string, string> };
    expect(pkg.exports['./mark-calculator']).toBe('./src/mark-calculator.ts');
  });
});
