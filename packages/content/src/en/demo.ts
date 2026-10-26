/**
 * `en.demo`: judge demo mode (UF_DEPLOYMENT=demo, docs/deploy/demo.md). Made-up learners only;
 * no phone, no PIN. Every word here is owed the owner's wording review.
 */
export const demo = {
  /** The banner on every page of the demo. */
  bannerLabel: 'Demo',
  bannerNotice: 'Demo: made-up learners. Don’t type real personal details.',
  switchLearner: 'Switch learner',

  /** The persona picker on `/` and `/sign-in`. */
  pickerTitle: 'Try UniversityFlow as…',
  pickerLead:
    'Pick a made-up learner. You get your own copy to change as you like: nobody else sees it, and it is deleted after 24 hours.',
  judgesLine:
    'For judges: no sign-up, no phone number. Ask the chat anything, tick a plan map, set a goal or try a sample report.',
  tryAs: (name: string) => `Try as ${name}`,
  /** On the pressed button while the learner's copy is made (a few seconds). */
  startingAs: (name: string) => `Making ${name}’s copy…`,
  /** Said once, under the pressed button. */
  startingNote:
    'This takes a few seconds. Keep this page open: you’ll be taken in when it’s ready.',
  tryThisLabel: 'Try this',
  /** The demo starts per address per hour ran out. */
  busy: 'Lots of people are trying the demo from here right now. Wait a few minutes and try again.',
  /** A learner's copy could not be made (the seed failed). */
  unavailable: 'That learner isn’t ready right now. Try another one.',

  /** Before the stand-in's reply, once the demo's daily AI messages are used up. */
  aiCapLine:
    'The demo has used up today’s AI replies, so from here you’ll see practice replies instead. Everything else works as usual.',

  /** Uploads in the demo. */
  sampleOnly:
    'The demo takes only our SAMPLE reports, never a real document or photo. Use “Use a sample report” instead.',
  useSampleReport: 'Use a sample report',
  useSampleReportLead: 'A made-up SAMPLE report for your grade, so you can see how reading works.',

  /** The /sign-in page's title in demo mode, where there is no phone sign-in. */
  signInTitle: 'Try UniversityFlow',

  /**
   * The profile photo in the demo (owner's decision, 2026-10-23): made-up SAMPLE pictures only,
   * drawn by code (packages/documents sample-photos.ts), never a real photo.
   */
  samplePhotoOnly:
    'The demo takes only our made-up SAMPLE pictures, never a real photo. Choose a sample photo instead.',
  samplePhotosLegend: 'Choose a sample photo',
  samplePhotosLead:
    'Made-up pictures of nobody, each marked SAMPLE. The demo never takes a real photo.',
  useSamplePhoto: 'Use this photo',
  /** Each picture's caption, as shown. */
  samplePhotoShort: (n: number) => `Sample photo ${n}`,
  /** Each picture's name, as a screen reader says it (it starts with the caption). */
  samplePhotoName: (n: number, description: string) => `Sample photo ${n}: ${description}`,
  /** What each picture shows, by its id (packages/documents SAMPLE_PHOTO_IDS). */
  samplePhotos: {
    'sample-1': 'a figure in a blue jacket on a yellow background',
    'sample-2': 'a figure with round glasses and a green jumper on a pink background',
    'sample-3': 'a figure in a red hoodie on a teal background',
    'sample-4': 'a figure with a yellow headband and an orange top on a purple background',
    'sample-5': 'a figure with curly hair and a purple top on a mint-green background',
    'sample-6': 'a figure in a cap and a grey top on a coral background',
  },

  /** In the banner while the demo shows the universities' logos (NEXT_PUBLIC_UF_DEMO_LOGOS). */
  logosNotice:
    'University logos are shown for this demo only. UniversityFlow is not affiliated with or endorsed by these universities.',

  /**
   * The picker when the server refuses the demo's configuration (the owner, 2026-10-23, late): no
   * learner can open. The server's log names why; the public is told nothing more.
   */
  notSetUp:
    'The demo isn’t set up yet, so the made-up learners can’t open right now. Please try again later, or tell the person who shared this link.',
  /**
   * A visitor's own photo, beside the samples, only while the demo sets UF_DEMO_REAL_PHOTOS=1 (a
   * hackathon exception, the owner's decision of 2026-10-23). Owed the owner's wording review.
   */
  realPhotoLegend: 'Or use your own photo',
  /** In a 24-hour demo copy (one of the six made-up learners). */
  realPhotoLead:
    'Upload a photo of yourself only. It’s deleted with this demo copy after 24 hours and used for nothing else.',
  /** In a judge's own sign-up account, kept 30 days. */
  realPhotoLeadAccount:
    'Upload a photo of yourself only. It’s deleted with your demo account after 30 days and used for nothing else.',
  /**
   * The search and share description of the demo's picker and its /sign-in (A6-04, wave 10), and
   * /sign-in's own title on the demo, apart from the picker's. Owed the owner's wording review.
   */
  description:
    'Try UniversityFlow as one of six learners, from Grade 10 to a final year at university. Every learner is made up, and your copy is deleted after 24 hours.',
  signInPageTitle: 'Ways into the judges’ demo',
} as const;
