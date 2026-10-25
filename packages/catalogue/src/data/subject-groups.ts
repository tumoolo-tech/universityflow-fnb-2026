import { OFFICIAL_LANGUAGES, type SubjectId } from '../subjects';

/**
 * Subject groups the data files use, so a programme says `[...ENGLISH_ANY]` rather than
 * repeating the same list. These are names for sets of NSC subjects, not admission facts.
 */

export const ENGLISH_ANY: SubjectId[] = ['english-hl', 'english-fal'];
export const ENGLISH_HL: SubjectId[] = ['english-hl'];
export const ENGLISH_FAL: SubjectId[] = ['english-fal'];
export const MATHS: SubjectId[] = ['mathematics'];
export const MATHS_OR_TECH: SubjectId[] = ['mathematics', 'technical-mathematics'];
export const MATHS_LIT: SubjectId[] = ['mathematical-literacy'];
export const PHYSICAL: SubjectId[] = ['physical-sciences'];
export const PHYSICAL_OR_TECH: SubjectId[] = ['physical-sciences', 'technical-sciences'];
export const LIFE_SCI: SubjectId[] = ['life-sciences'];
export const LO: SubjectId[] = ['life-orientation'];
export const ACCOUNTING: SubjectId[] = ['accounting'];

export const HOME_LANGUAGES = OFFICIAL_LANGUAGES.map(([id]) => `${id}-hl` as SubjectId);
export const ADDITIONAL_LANGUAGES = OFFICIAL_LANGUAGES.map(([id]) => `${id}-fal` as SubjectId);
export const ANY_LANGUAGE = [...HOME_LANGUAGES, ...ADDITIONAL_LANGUAGES];
