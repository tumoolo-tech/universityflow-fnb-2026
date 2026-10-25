import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { MemoryJobScheduler } from './memory';
import {
  copyJobPayload,
  defineJobKind,
  entityId,
  InvalidJobError,
  InvalidJobPayloadError,
  isEntityId,
  samePayload,
  validateIdempotencyKey,
  validateJobPayload,
} from './payload';
import { retryDelayMs } from './scheduler';

const REMINDER = defineJobKind('reminder.send', ['reminderId']);

describe('defineJobKind', () => {
  it('declares a kind by name and ID fields, frozen', () => {
    const kind = defineJobKind('matric.check-in', ['studentId', 'planId']);
    expect(kind).toEqual({ name: 'matric.check-in', fields: ['studentId', 'planId'] });
    expect(Object.isFrozen(kind) && Object.isFrozen(kind.fields)).toBe(true);
  });

  it.each([
    ['an upper-case name', 'Reminder', ['reminderId'], InvalidJobError],
    ['a name with spaces', 'send reminder', ['reminderId'], InvalidJobError],
    ['a long name', `a${'b'.repeat(64)}`, ['reminderId'], InvalidJobError],
    ['no fields', 'reminder.send', [], InvalidJobPayloadError],
    [
      'too many fields',
      'reminder.send',
      'abcdefghi'.split('').map((c) => `${c}Id`),
      InvalidJobPayloadError,
    ],
    ['a field that is not an ID', 'reminder.send', ['phone'], InvalidJobPayloadError],
    ['a field that is not camelCase', 'reminder.send', ['Reminder_Id'], InvalidJobPayloadError],
    ['a long field', 'reminder.send', [`a${'b'.repeat(64)}Id`], InvalidJobPayloadError],
    ['a field twice', 'reminder.send', ['reminderId', 'reminderId'], InvalidJobPayloadError],
  ])('refuses %s', (_label, name, fields, error) => {
    expect(() => defineJobKind(name, fields)).toThrow(error);
  });
});

describe('entityId', () => {
  it('accepts a lower-case UUID and nothing else', () => {
    const id = randomUUID();
    expect(entityId(id)).toBe(id);
    expect(isEntityId(id)).toBe(true);
    for (const bad of [id.toUpperCase(), `${id}x`, 'thandi', '', `+27${'82'}${'0000123'}`]) {
      expect(isEntityId(bad)).toBe(false);
      expect(() => entityId(bad)).toThrow(InvalidJobPayloadError);
    }
    expect(isEntityId(42)).toBe(false);
  });

  it('is required by the types: a plain string is not a payload value', () => {
    const scheduler = new MemoryJobScheduler();
    const reminderId = entityId(randomUUID());
    const typed = () => scheduler.schedule({ kind: REMINDER, payload: { reminderId }, delayMs: 0 });
    const untyped = () =>
      // @ts-expect-error a raw string isn't an EntityId
      scheduler.schedule({ kind: REMINDER, payload: { reminderId: 'thandi' }, delayMs: 0 });
    const extra = () =>
      scheduler.schedule({
        kind: REMINDER,
        // @ts-expect-error a field the kind doesn't declare
        payload: { reminderId, phone: reminderId },
        delayMs: 0,
      });
    const missing = () =>
      // @ts-expect-error a field the kind needs
      scheduler.schedule({ kind: REMINDER, payload: {}, delayMs: 0 });
    expect([typed, untyped, extra, missing]).toHaveLength(4);
  });
});

describe('validateJobPayload and copyJobPayload', () => {
  it('copies only the declared fields, frozen', () => {
    const reminderId = entityId(randomUUID());
    const copy = copyJobPayload(REMINDER, { reminderId });
    expect(copy).toEqual({ reminderId });
    expect(Object.isFrozen(copy)).toBe(true);
    expect(() => validateJobPayload(REMINDER, Object.create(null))).toThrow(/needs reminderId/);
  });

  it('accepts a null-prototype record', () => {
    const payload = Object.assign(Object.create(null), { reminderId: randomUUID() });
    expect(() => validateJobPayload(REMINDER, payload)).not.toThrow();
  });
});

describe('samePayload', () => {
  it('compares IDs by field', () => {
    const a = entityId(randomUUID());
    const b = entityId(randomUUID());
    expect(samePayload({ x: a, y: b }, { y: b, x: a })).toBe(true);
    expect(samePayload({ x: a }, { x: b })).toBe(false);
    expect(samePayload({ x: a }, { x: a, y: b })).toBe(false);
  });
});

describe('validateIdempotencyKey', () => {
  it('accepts a label, IDs and dates', () => {
    expect(() => validateIdempotencyKey(`deadline:${randomUUID()}:2027-03-01`)).not.toThrow();
    // A UUID's digits don't count as a phone number.
    expect(() => validateIdempotencyKey('x:12345678-1234-4123-8123-123456789012')).not.toThrow();
  });

  it.each(['Upper', 'with space', 'plus+sign', 'at@sign', 'digits:1234567', ':starts-with-colon'])(
    'refuses %s',
    (key) => {
      expect(() => validateIdempotencyKey(key)).toThrow(InvalidJobPayloadError);
    },
  );
});

describe('retryDelayMs', () => {
  it('backs off 1, 2, 4 minutes, and never beyond an hour', () => {
    expect([1, 2, 3].map(retryDelayMs)).toEqual([60_000, 120_000, 240_000]);
    expect(retryDelayMs(20)).toBe(3_600_000);
    expect(retryDelayMs(0)).toBe(60_000);
  });
});
