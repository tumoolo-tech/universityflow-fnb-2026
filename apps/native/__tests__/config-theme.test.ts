import { TEXT_PAIRS, tokens } from '@universityflow/tokens';
import { ConfigError, DEV_API_URL, resolveApiUrl } from '../lib/config';
import { REM_PX, theme, toMultiplier, toPx } from '../lib/theme';

describe('the API base URL', () => {
  it('falls back to localhost in development only', () => {
    expect(resolveApiUrl(undefined, true)).toBe(DEV_API_URL);
    expect(resolveApiUrl('  ', true)).toBe(DEV_API_URL);
    expect(() => resolveApiUrl(undefined, false)).toThrow(ConfigError);
  });

  it('takes EXPO_PUBLIC_UF_API_URL without a trailing slash', () => {
    expect(resolveApiUrl('https://app.example.org/', false)).toBe('https://app.example.org');
    expect(resolveApiUrl('http://192.168.1.20:3000', true)).toBe('http://192.168.1.20:3000');
  });

  it('refuses plain http in a release build, and anything that is not a URL', () => {
    expect(() => resolveApiUrl('http://app.example.org', false)).toThrow(ConfigError);
    expect(() => resolveApiUrl('not a url', true)).toThrow(ConfigError);
  });
});

describe('the theme is derived from the tokens, not typed by hand', () => {
  it('converts lengths at 16px per rem', () => {
    expect(REM_PX).toBe(16);
    expect(toPx('1.5rem')).toBe(24);
    expect(toPx('999px')).toBe(999);
    expect(toPx('0')).toBe(0);
    expect(() => toPx('1em')).toThrow(RangeError);
    expect(toMultiplier('1.55')).toBe(1.55);
    expect(() => toMultiplier('normal')).toThrow(RangeError);
  });

  it('holds every token value, converted', () => {
    expect(theme.color).toBe(tokens.color);
    for (const [k, v] of Object.entries(tokens.space)) {
      expect(theme.space[k as keyof typeof theme.space]).toBe(toPx(v));
    }
    for (const [k, v] of Object.entries(tokens.radius)) {
      expect(theme.radius[k as keyof typeof theme.radius]).toBe(toPx(v));
    }
    for (const [k, v] of Object.entries(tokens.font.size)) {
      expect(theme.fontSize[k as keyof typeof theme.fontSize]).toBe(toPx(v));
    }
    for (const [k, v] of Object.entries(tokens.font.weight)) {
      expect(theme.fontWeight[k as keyof typeof theme.fontWeight]).toBe(v);
    }
    expect(Object.keys(theme.border)).toEqual(Object.keys(tokens.border));
    for (const [k, v] of Object.entries(tokens.border)) {
      expect(theme.border[k as keyof typeof theme.border]).toBe(toPx(v));
    }
    expect(theme.target).toBe(toPx(tokens.target));
    expect(theme.target).toBeGreaterThanOrEqual(44);
  });

  it('gives each text style an absolute line height from the token multiplier', () => {
    const multipliers = Object.values(theme.lineHeight);
    for (const style of Object.values(theme.text)) {
      expect(Object.values(theme.fontSize)).toContain(style.fontSize);
      expect(multipliers.map((m) => Math.round(style.fontSize * m))).toContain(style.lineHeight);
      expect(['400', '500', '700']).toContain(style.fontWeight);
    }
  });

  it('uses only text/background pairs that TEXT_PAIRS holds to WCAG AA', () => {
    const tested = new Set(TEXT_PAIRS.map(([fg, bg]) => `${fg}/${bg}`));
    for (const [name, [fg, bg]] of Object.entries(theme.pairs)) {
      expect({ name, pair: `${fg}/${bg}`, tested: tested.has(`${fg}/${bg}`) }).toEqual({
        name,
        pair: `${fg}/${bg}`,
        tested: true,
      });
    }
    expect(theme.on('primary')).toEqual({
      color: tokens.color.onBrand,
      backgroundColor: tokens.color.brand,
    });
  });
});
