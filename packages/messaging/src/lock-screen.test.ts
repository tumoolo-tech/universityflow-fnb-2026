import { RAW_CATALOGUE, SUBJECTS } from '@universityflow/catalogue';
import { MESSAGE_TEMPLATES, type MessageTemplate } from '@universityflow/content';
import { describe, expect, it } from 'vitest';

/**
 * Nothing a lock screen shows names the learner's world (audit A11-09, planning.md check 8). The
 * forbidden words come from the catalogue itself, so a university or subject added there is
 * covered here without anyone remembering to type it in.
 */

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** "isiZulu Home Language" is also forbidden as "isiZulu". */
const subjectWords = SUBJECTS.flatMap((s) => [
  s.name,
  s.name.replace(/ (?:Home|First Additional|Second Additional) Language$/, ''),
]);

/** Full names, case-insensitive: "University of Johannesburg", "Life Sciences". */
const NAMES = new RegExp(
  `\\b(?:${[...new Set([...RAW_CATALOGUE.universities.map((u) => u.name), ...subjectWords])]
    .map(escapeRegExp)
    .join('|')})\\b`,
  'i',
);

/** Short names as written ("UJ", "UP", "Wits"): case-sensitive, so "catch up" is not "UP". */
const SHORT_NAMES = new RegExp(
  `\\b(?:${RAW_CATALOGUE.universities.map((u) => escapeRegExp(u.shortName)).join('|')})\\b`,
);

/** A greeting or a name slot: "Hi Lebo", "Dear Lebo", "Sawubona". */
const GREETING =
  /\b(?:hi|hello|hey|hiya|dear|howzit|sawubona|molo|dumela|dumelang|avuxeni|ndaa|hallo|goeie(?:môre|middag|naand))\b/i;

/** Funding and helpline names a learner's lock screen should not carry either. */
const OTHER = /\b(?:NSFAS|SASSA|CAO|NBT)\b/;

const templates = Object.values(MESSAGE_TEMPLATES) as MessageTemplate[];

describe('a push notification shows nothing from the catalogue on a lock screen (A11-09)', () => {
  it('derives its words from the catalogue (sanity: it would catch the obvious)', () => {
    expect(NAMES.test('A little Life Sciences practice today')).toBe(true);
    expect(NAMES.test('Your University of Johannesburg application')).toBe(true);
    expect(NAMES.test('Time for some isiZulu')).toBe(true);
    expect(SHORT_NAMES.test('Your UJ application')).toBe(true);
    expect(SHORT_NAMES.test('Time to catch up')).toBe(false);
    expect(GREETING.test('Dear Lebo, a reminder')).toBe(true);
    expect(OTHER.test('Your NSFAS form')).toBe(true);
  });

  it('no pushBody names a university, a subject, funding, or greets the learner', () => {
    for (const t of templates) {
      expect(t.pushBody, t.id).not.toMatch(NAMES);
      expect(t.pushBody, t.id).not.toMatch(SHORT_NAMES);
      expect(t.pushBody, t.id).not.toMatch(GREETING);
      expect(t.pushBody, t.id).not.toMatch(OTHER);
    }
  });
});
