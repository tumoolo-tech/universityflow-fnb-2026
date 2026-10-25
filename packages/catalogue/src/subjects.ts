/**
 * National Senior Certificate subjects, as they appear on a learner's report.
 *
 * Source: Department of Basic Education, NSC subject list. Every subject carries 20 credits
 * except Life Orientation (10), which is why most admission scores leave it out or cap it.
 * Languages are offered at Home Language (HL) or First Additional Language (FAL) level, and the
 * level matters: a programme can ask for English HL 4 or English FAL 5 (planning.md §2.3).
 *
 * No zod and no records here: browsers and the phone app load this through
 * `@universityflow/catalogue/client` (audit A4-02). The `subjectId` schema is in
 * subject-schema.ts.
 */

export const OFFICIAL_LANGUAGES = [
  ['english', 'English'],
  ['afrikaans', 'Afrikaans'],
  ['isizulu', 'isiZulu'],
  ['isixhosa', 'isiXhosa'],
  ['isindebele', 'isiNdebele'],
  ['sepedi', 'Sepedi'],
  ['sesotho', 'Sesotho'],
  ['setswana', 'Setswana'],
  ['siswati', 'siSwati'],
  ['tshivenda', 'Tshivenda'],
  ['xitsonga', 'Xitsonga'],
] as const;

export type LanguageId = (typeof OFFICIAL_LANGUAGES)[number][0];

const LANGUAGE_SUBJECTS = OFFICIAL_LANGUAGES.flatMap(([id, name]) => [
  { id: `${id}-hl`, name: `${name} Home Language`, credits: 20, language: id, level: 'hl' },
  {
    id: `${id}-fal`,
    name: `${name} First Additional Language`,
    credits: 20,
    language: id,
    level: 'fal',
  },
]) as ReadonlyArray<LanguageSubject>;

const OTHER_SUBJECTS = [
  ['mathematics', 'Mathematics'],
  ['mathematical-literacy', 'Mathematical Literacy'],
  ['technical-mathematics', 'Technical Mathematics'],
  ['physical-sciences', 'Physical Sciences'],
  ['technical-sciences', 'Technical Sciences'],
  ['life-sciences', 'Life Sciences'],
  ['agricultural-sciences', 'Agricultural Sciences'],
  ['accounting', 'Accounting'],
  ['business-studies', 'Business Studies'],
  ['economics', 'Economics'],
  ['geography', 'Geography'],
  ['history', 'History'],
  ['religion-studies', 'Religion Studies'],
  ['computer-applications-technology', 'Computer Applications Technology'],
  ['information-technology', 'Information Technology'],
  ['engineering-graphics-and-design', 'Engineering Graphics and Design'],
  ['civil-technology', 'Civil Technology'],
  ['electrical-technology', 'Electrical Technology'],
  ['mechanical-technology', 'Mechanical Technology'],
  ['tourism', 'Tourism'],
  ['consumer-studies', 'Consumer Studies'],
  ['hospitality-studies', 'Hospitality Studies'],
  ['dramatic-arts', 'Dramatic Arts'],
  ['visual-arts', 'Visual Arts'],
  ['music', 'Music'],
  ['dance-studies', 'Dance Studies'],
  ['design', 'Design'],
] as const;

export interface LanguageSubject {
  readonly id: `${LanguageId}-${'hl' | 'fal'}`;
  readonly name: string;
  readonly credits: 20;
  readonly language: LanguageId;
  readonly level: 'hl' | 'fal';
}

export interface OtherSubject {
  readonly id: (typeof OTHER_SUBJECTS)[number][0] | 'life-orientation';
  readonly name: string;
  readonly credits: 10 | 20;
}

export type Subject = LanguageSubject | OtherSubject;

export const LIFE_ORIENTATION = 'life-orientation' as const;

export const SUBJECTS: ReadonlyArray<Subject> = [
  ...LANGUAGE_SUBJECTS,
  ...OTHER_SUBJECTS.map(([id, name]) => ({ id, name, credits: 20 as const })),
  { id: LIFE_ORIENTATION, name: 'Life Orientation', credits: 10 },
];

export type SubjectId = Subject['id'];

const BY_ID = new Map<string, Subject>(SUBJECTS.map((subject) => [subject.id, subject]));

export function isSubjectId(value: string): value is SubjectId {
  return BY_ID.has(value);
}

export function subject(id: SubjectId): Subject {
  const found = BY_ID.get(id);
  if (!found) throw new RangeError(`Unknown NSC subject: ${id}`);
  return found;
}

export function isLanguage(s: Subject): s is LanguageSubject {
  return 'language' in s;
}

export function isHomeLanguage(id: SubjectId): boolean {
  const s = subject(id);
  return isLanguage(s) && s.level === 'hl';
}

/** English at either level: the language of learning and teaching at all six launch universities. */
export const ENGLISH = ['english-hl', 'english-fal'] as const satisfies ReadonlyArray<SubjectId>;
