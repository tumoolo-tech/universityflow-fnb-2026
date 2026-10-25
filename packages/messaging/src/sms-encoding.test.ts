import { describe, expect, it } from 'vitest';
import { isGsm7, replyForChannel, smsSegments, smsSize, toGsm7Typography } from './sms-encoding';

describe('smsSize: segments by encoding, as a provider bills them (A1-14, A12-07)', () => {
  it('GSM-7: 160 in one segment, then 153 per segment', () => {
    expect(smsSize('')).toEqual({ encoding: 'gsm7', units: 0, segments: 0 });
    expect(smsSize('x'.repeat(160))).toEqual({ encoding: 'gsm7', units: 160, segments: 1 });
    expect(smsSize('x'.repeat(161))).toEqual({ encoding: 'gsm7', units: 161, segments: 2 });
    expect(smsSegments('x'.repeat(306))).toBe(2);
    expect(smsSegments('x'.repeat(307))).toBe(3);
    expect(smsSegments('x'.repeat(459))).toBe(3);
    expect(smsSegments('x'.repeat(460))).toBe(4);
  });

  it('GSM-7 extension characters cost two septets and are never split across segments', () => {
    expect(smsSize('€'.repeat(80))).toEqual({ encoding: 'gsm7', units: 160, segments: 1 });
    expect(smsSize('{'.repeat(81)).segments).toBe(2);
    // 152 plain septets, then an escaped one: it can't fit in the first segment's last septet.
    expect(smsSegments(`${'x'.repeat(152)}[${'x'.repeat(152)}`)).toBe(3);
    expect(smsSegments(`${'x'.repeat(151)}[${'x'.repeat(152)}`)).toBe(2);
  });

  it('UCS-2: one character outside GSM-7 sends the whole text at 70, then 67 per segment', () => {
    expect(smsSize('’'.repeat(70))).toEqual({ encoding: 'ucs2', units: 70, segments: 1 });
    expect(smsSize(`it’s ${'x'.repeat(66)}`)).toEqual({ encoding: 'ucs2', units: 71, segments: 2 });
    expect(smsSegments('ŋ'.repeat(134))).toBe(2);
    expect(smsSegments('ŋ'.repeat(135))).toBe(3);
    expect(smsSegments('ŋ'.repeat(201))).toBe(3);
    expect(smsSegments('ŋ'.repeat(202))).toBe(4);
  });

  it('UCS-2: a character outside the BMP is two units and is never split', () => {
    expect(smsSize('🙂'.repeat(35))).toEqual({ encoding: 'ucs2', units: 70, segments: 1 });
    expect(smsSegments(`${'x'.repeat(66)}🙂${'x'.repeat(10)}`)).toBe(2);
    // 66 units, then a pair that would straddle the boundary: it starts the next segment.
    expect(smsSegments(`${'ŋ'.repeat(66)}🙂${'ŋ'.repeat(65)}`)).toBe(2);
    expect(smsSegments(`${'ŋ'.repeat(66)}🙂${'ŋ'.repeat(66)}`)).toBe(3);
  });

  it('knows the GSM-7 alphabet, accents included', () => {
    expect(isGsm7('Thabo, Zoë? No: Zoë is not GSM')).toBe(false);
    expect(isGsm7('Hélène Ñandu à Ørsted @ £5 ¿¡ § {[~]}')).toBe(true);
    expect(isGsm7('Hi Ŋwako')).toBe(false);
    expect(isGsm7('it’s')).toBe(false);
  });
});

describe('toGsm7Typography', () => {
  it('swaps curly quotes, dashes, ellipses and odd spaces for their GSM-7 twins', () => {
    const plain = toGsm7Typography('it’s ‘a’ “b” – — … x y');
    expect(plain).toBe("it's 'a' \"b\" - - ... x y");
    expect(isGsm7(plain)).toBe(true);
  });

  it('replyForChannel: GSM-7 typography on SMS only, and no reply stays no reply', () => {
    expect(replyForChannel('sms', 'You won’t get any more')).toBe("You won't get any more");
    expect(replyForChannel('whatsapp', 'You won’t get any more')).toBe('You won’t get any more');
    expect(replyForChannel('sms', null)).toBeNull();
  });

  it('leaves everything else as written, a learner’s name included', () => {
    expect(toGsm7Typography('Hi Ŋwako 🙂')).toBe('Hi Ŋwako 🙂');
    expect(toGsm7Typography('plain text')).toBe('plain text');
  });
});
