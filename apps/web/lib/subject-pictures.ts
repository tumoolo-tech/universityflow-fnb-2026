/**
 * The school subjects' own pictures (cards9, the owner's request of 2026-10-24), for a subject the
 * course cards' ten fields don't show well. Each is one of the owner's Unsplash downloads (free to
 * use under the Unsplash License), credited in public/subject-art/CREDITS.md; none shows a face as
 * its subject, a minor, a university's logo or a campus. Which subject uses which picture is
 * lib/subject-art.ts.
 *
 * No imports, so scripts/assets/generate-subject-art.mjs can read it with Node directly.
 */
export const SUBJECT_PICTURES = {
  mathematics: {
    source: 'mathematics-antoine-dautry-05A-kdOH6Hw-unsplash.jpg',
    photographer: 'Antoine Dautry',
    unsplashId: '05A-kdOH6Hw',
  },
  'mathematical-literacy': {
    source: 'mathematical-literacy-erwan-hesry-aTpgq-1PdrU-unsplash.jpg',
    photographer: 'Erwan Hesry',
    unsplashId: 'aTpgq-1PdrU',
  },
  'technical-mathematics': {
    source: 'technical-mathematics-bozhin-karaivanov-5z70PsbFCMM-unsplash.jpg',
    photographer: 'Bozhin Karaivanov',
    unsplashId: '5z70PsbFCMM',
  },
  'technical-sciences': {
    source: 'technical-sciences-brecht-corbeel-zCZ3s1bInHo-unsplash.jpg',
    photographer: 'Brecht Corbeel',
    unsplashId: 'zCZ3s1bInHo',
  },
  'life-sciences': {
    source: 'life-sciences-markus-winkler-gz7s5Z9Furk-unsplash.jpg',
    photographer: 'Markus Winkler',
    unsplashId: 'gz7s5Z9Furk',
  },
  'computer-applications': {
    source: 'computer-applications-arif-riyanto-vJP-wZ6hGBg-unsplash.jpg',
    photographer: 'Arif Riyanto',
    unsplashId: 'vJP-wZ6hGBg',
  },
} as const satisfies Record<string, { source: string; photographer: string; unsplashId: string }>;

export type SubjectPicture = keyof typeof SUBJECT_PICTURES;
