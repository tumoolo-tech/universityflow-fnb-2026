import { describe, expect, it } from 'vitest';
import {
  FIRST_WEEK_STEPS,
  isFirstWeekStep,
  PLACE_NEED_IDS,
  PLACE_NEEDS,
  SAFETY_TIPS,
} from './campus';
import { en } from './en';
import { MESSAGE_TEMPLATES } from './messages';

describe('campus, first week and safety wording (Phase 5b)', () => {
  it('has the words for every first-week step, and no words for a step that isn’t one', () => {
    expect(Object.keys(en.firstWeek.steps).sort()).toEqual([...FIRST_WEEK_STEPS].sort());
    for (const step of FIRST_WEEK_STEPS) {
      expect(en.firstWeek.steps[step].title, step).toMatch(/\S/);
      expect(en.firstWeek.steps[step].detail, step).toMatch(/\S/);
    }
    expect(new Set(FIRST_WEEK_STEPS).size).toBe(FIRST_WEEK_STEPS.length);
  });

  it('has the words for every safety tip, and every need the tour groups places by', () => {
    expect(Object.keys(en.safety.tips).sort()).toEqual([...SAFETY_TIPS].sort());
    expect(Object.keys(en.campus.needs).sort()).toEqual([...PLACE_NEED_IDS].sort());
    for (const kinds of Object.values(PLACE_NEEDS)) {
      for (const kind of kinds) expect(en.campus.kinds[kind], kind).toMatch(/\S/);
    }
  });

  it('puts no admission fact, date or number in the steps or the guidance (hard rule 2)', () => {
    const texts = [
      ...Object.values(en.firstWeek.steps).flatMap((s) => [s.title, s.detail]),
      ...Object.values(en.safety.tips).flatMap((t) => [t.title, t.body]),
    ];
    for (const text of texts) {
      expect(text).not.toMatch(/\d/);
      expect(text).not.toMatch(/\bR\s?\d|\bAPS\b|deadline is|closes on/i);
    }
  });

  it('covers every safety subject planning.md §8.6 asks for at Phase 5b', () => {
    const all = Object.values(en.safety.tips)
      .map((t) => `${t.title} ${t.body}`)
      .join(' ');
    for (const subject of [
      /log out/i,
      /remember me/i,
      /password/i,
      /NSFAS/,
      /scam/i,
      /deposit/i,
      /January/,
      /proof of every payment/i,
      /registration/i,
      /back up|cloud storage/i,
    ]) {
      expect(all).toMatch(subject);
    }
  });

  it('says plainly that the app supports a cane, a guide dog and mobility training, never replaces them (5e-4)', () => {
    const { statement } = en.campus.mobility;
    for (const aid of [/cane/, /guide dog/, /mobility training/, /never replaces/]) {
      expect(statement).toMatch(aid);
    }
    // A pointer to the disability unit: by name when the tour lists it, else in general.
    expect(en.campus.mobility.askUnit('Test Disability Unit')).toContain('Test Disability Unit');
    expect(en.campus.mobility.askUnitUnchecked).toMatch(/disability unit/i);
  });

  it('names every walking and Street View control, and says where it goes (5e-1)', () => {
    const t = en.campus;
    for (const label of [
      t.walkThere,
      t.walkThereIn.apple,
      t.walkThereIn.google,
      t.seeIt,
      t.stepFree,
      t.stepFreeIn.apple,
      t.stepFreeIn.google,
      t.readAloud,
      t.stopReading,
    ]) {
      expect(label).toMatch(/\S/);
      // The accessible name starts with the visible label (WCAG 2.5.3) and names the place.
      expect(t.forPlace(label, 'Test Clinic')).toMatch(new RegExp(`^${label}.*Test Clinic$`));
    }
    expect(t.walkThereIn.apple).toContain('Apple Maps');
    expect(t.walkThereIn.google).toContain('Google Maps');
    // The hints promise what the links do: no "here" leaves the phone.
    expect(t.walkHint).toMatch(/from where you are/);
    expect(t.walkHint).toMatch(/don’t see where you are/);
  });

  it('reads a place aloud from templates code fills: no fact of its own, no link (5e-4)', () => {
    const s = en.campus.speech;
    expect(s.place('Test Clinic', 'Clinic')).toBe('Test Clinic, Clinic.');
    expect(s.where('Ground floor, Test Building')).toContain('Ground floor, Test Building');
    expect(s.hours('Mon–Fri 08:00–16:00')).toContain('Mon–Fri 08:00–16:00');
    expect(s.entrance('East door')).toContain('East door');
    expect(s.arrival('The ramp is to the left.')).toContain('The ramp is to the left.');
    const fixed = [s.canWalk, s.noLocation, s.stepFreeRoute];
    for (const text of fixed) {
      expect(text).toMatch(/\S/);
      expect(text).not.toMatch(/\d|https?:/);
    }
  });

  it('says plainly when the voice couldn’t play, with nothing technical (2026-10-22)', () => {
    expect(en.campus.readAloudFailed).toMatch(/\S/);
    expect(en.campus.readAloudFailed).not.toMatch(/\d|ElevenLabs|error|https?:/i);
  });

  it('knows a first-week step when it sees one', () => {
    expect(isFirstWeekStep('register')).toBe(true);
    expect(isFirstWeekStep('toString')).toBe(false);
    expect(isFirstWeekStep(3)).toBe(false);
  });

  it('sends safety guidance by push only, never by SMS or WhatsApp (owner’s decision 4)', () => {
    for (const id of ['safety.offer-accepted', 'safety.move-in'] as const) {
      const t = MESSAGE_TEMPLATES[id];
      expect(t.channels, id).toEqual(['push']);
      expect(t.variables, id).toEqual([]);
      expect(t.learnerSchedulable, id).toBe(false);
    }
    expect(MESSAGE_TEMPLATES['safety.offer-accepted'].opens).toBe('campus');
    expect(MESSAGE_TEMPLATES['safety.move-in'].opens).toBe('first-week');
  });
});
