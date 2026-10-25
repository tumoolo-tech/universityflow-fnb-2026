import type { SubjectId } from '@universityflow/catalogue/client';
import { type CardArt, type CourseField, cardArtFiles } from './course-art';
import type { SubjectPicture } from './subject-pictures';

/**
 * The school subjects' pictures on My subjects (cards9, the owner's request of 2026-10-24): each
 * subject a picture of its own (lib/subject-pictures.ts) or, where one of the course cards' ten
 * fits, that field's (a globe for Geography, a painting for Visual Arts). A design decision, never
 * an admission fact: it changes a picture, not a word (hard rule 2).
 *
 * Every NSC subject is either here or in SUBJECTS_AWAITING_PICTURE (test/subject-art.test.ts), so
 * a new subject can't silently get the default; an awaiting subject shows the neutral library
 * until the owner adds a photo for it.
 */

type SubjectArtKey = { readonly picture: SubjectPicture } | { readonly field: CourseField };

const picture = (name: SubjectPicture) => ({ picture: name }) as const;
const field = (name: CourseField) => ({ field: name }) as const;

/** Books: the library suits a language better than any field does. */
const LANGUAGE = field('general');

export const SUBJECT_ART: Readonly<Partial<Record<SubjectId, SubjectArtKey>>> = {
  'english-hl': LANGUAGE,
  'english-fal': LANGUAGE,
  'afrikaans-hl': LANGUAGE,
  'afrikaans-fal': LANGUAGE,
  'isizulu-hl': LANGUAGE,
  'isizulu-fal': LANGUAGE,
  'isixhosa-hl': LANGUAGE,
  'isixhosa-fal': LANGUAGE,
  'isindebele-hl': LANGUAGE,
  'isindebele-fal': LANGUAGE,
  'sepedi-hl': LANGUAGE,
  'sepedi-fal': LANGUAGE,
  'sesotho-hl': LANGUAGE,
  'sesotho-fal': LANGUAGE,
  'setswana-hl': LANGUAGE,
  'setswana-fal': LANGUAGE,
  'siswati-hl': LANGUAGE,
  'siswati-fal': LANGUAGE,
  'tshivenda-hl': LANGUAGE,
  'tshivenda-fal': LANGUAGE,
  'xitsonga-hl': LANGUAGE,
  'xitsonga-fal': LANGUAGE,
  mathematics: picture('mathematics'),
  'mathematical-literacy': picture('mathematical-literacy'),
  'technical-mathematics': picture('technical-mathematics'),
  'physical-sciences': field('science'),
  'technical-sciences': picture('technical-sciences'),
  'life-sciences': picture('life-sciences'),
  // A calculator on a page of sums.
  accounting: field('engineering'),
  'business-studies': field('commerce'),
  economics: field('commerce'),
  geography: field('social'),
  tourism: field('social'),
  'computer-applications-technology': picture('computer-applications'),
  'information-technology': field('computing'),
  // Drawing templates, a ruler and a calculator.
  'engineering-graphics-and-design': field('engineering'),
  'civil-technology': field('engineering'),
  'electrical-technology': field('engineering'),
  'mechanical-technology': field('engineering'),
  'dramatic-arts': field('arts'),
  'visual-arts': field('arts'),
  music: field('arts'),
  'dance-studies': field('arts'),
  design: field('arts'),
};

/** No fitting photo among the owner's downloads yet: the neutral library until one is added. */
export const SUBJECTS_AWAITING_PICTURE: ReadonlyArray<SubjectId> = [
  'agricultural-sciences',
  'history',
  'religion-studies',
  'consumer-studies',
  'hospitality-studies',
  'life-orientation',
];

const DEFAULT: SubjectArtKey = field('general');

/** The URLs a subject card's `<picture>` uses; the neutral library for an id it doesn't know. */
export function subjectArt(id: string): CardArt {
  const key = SUBJECT_ART[id as SubjectId] ?? DEFAULT;
  return 'picture' in key
    ? cardArtFiles('subject-art', key.picture)
    : cardArtFiles('course-art', key.field);
}
