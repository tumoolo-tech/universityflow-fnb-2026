import { describe, expect, it } from 'vitest';
import { isStopMessage, normaliseKeyword, STOP_WORDS } from './stop';

describe('isStopMessage', () => {
  it.each(STOP_WORDS.map((w) => [w.word, w.language]))('hears %s (%s)', (word) => {
    expect(isStopMessage(word)).toBe(true);
    expect(isStopMessage(word.toLowerCase())).toBe(true);
    expect(isStopMessage(`  ${word}.  `)).toBe(true);
  });

  it.each([
    'Stop',
    'STOP!!',
    'stop please',
    'Stop sending me messages',
    'unsubscribe me',
    'Stop.',
    'opt-out',
    'optout',
    'Hou op',
    'S T O P'.replace(/ /g, ''),
    'stöp',
  ])('hears %j', (text) => {
    expect(isStopMessage(text)).toBe(true);
  });

  it.each([
    '',
    '   ',
    '!!!',
    'Thanks',
    'When does Wits close?',
    "I can't stop thinking about my exams",
    'the end of term',
    'emails',
    'Yes',
  ])('does not take %j as STOP', (text) => {
    expect(isStopMessage(text)).toBe(false);
  });

  // A12-05: WhatsApp's policy asks us to honour every opt-out request, however it is worded.
  it.each([
    'Please stop',
    'please stop messaging me',
    'Pls stop sending these',
    'Stop it',
    'I said STOP',
    'Ok stop.',
    'Asseblief stop',
    'Remove me',
    'Please remove me from this list',
    'unsub',
    'Unsub please',
    'No more messages',
    'no more sms please',
    "Don't message me",
    'Dont text me again',
    'do not contact me',
    'Opt me out',
    'Take me off your list',
    'unsubscribe',
    'Can you unsubscribe me',
  ])('hears the plain-words opt-out %j (A12-05)', (text) => {
    expect(isStopMessage(text)).toBe(true);
  });

  it.each([
    "I can't stop worrying about maths",
    'I cant stop thinking about the exam',
    'How do I stop procrastinating?',
    "Don't stop now, you're doing great",
    'My teacher said we must stop using calculators in the test, but I still need help with the formula sheet for maths',
    'I need more messages about bursaries',
    'Can you remind me about the Wits deadline',
  ])('does not take %j as an opt-out (A12-05)', (text) => {
    expect(isStopMessage(text)).toBe(false);
  });

  it('ignores anything that is not text', () => {
    expect(isStopMessage(undefined as unknown as string)).toBe(false);
  });

  it('marks every non-English word for first-language review', () => {
    for (const w of STOP_WORDS) {
      if (w.language !== 'en') expect(w.reviewed, w.word).toBe(false);
      expect(normaliseKeyword(w.word)).toBe(w.word);
    }
  });
});
