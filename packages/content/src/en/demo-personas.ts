/**
 * `en.demoPersonas`: the six made-up learners of the judges' demo (UF_DEPLOYMENT=demo), and the
 * "coming next" cards a university student sees on the home once their first week is behind them.
 * The personas are synthetic: first names only, and nothing that could be a real person. Owed the
 * owner's wording review.
 *
 * The persona keys are the demo's fixed persona ids (apps/web/lib/server/demo/types.ts).
 */
export const demoPersonas = {
  personas: {
    'demo-grade-10': {
      name: 'Thabo',
      stage: 'Grade 10',
      tryThis: 'Open My subjects and try another subject to see which courses it opens or closes.',
    },
    'demo-grade-11': {
      name: 'Naledi',
      stage: 'Grade 11',
      tryThis: 'Open My results to see what she’s on track for, then What I need for a course.',
    },
    'demo-grade-12': {
      name: 'Amahle',
      stage: 'Grade 12',
      tryThis: 'Open Applications to see her checklists, then Funding for NSFAS.',
    },
    'demo-first-year': {
      name: 'Lerato',
      stage: 'First year',
      tryThis: 'Open First week and tick a step, then take the campus tour.',
    },
    'demo-second-year': {
      name: 'Sipho',
      stage: 'Second year',
      tryThis: 'Open My modules, then ask the chat how to find a place on campus.',
    },
    'demo-final-year': {
      name: 'Kagiso',
      stage: 'Final year',
      tryThis: 'Open the campus tour, then see what’s coming next on the home page.',
    },
  },
  /** A guardian's name on a made-up learner's consent record. */
  guardianName: 'Demo guardian',
  /**
   * A module row on a made-up registration where the catalogue has no curriculum for that year
   * (UJ has none yet; second and later years nowhere): never a real-looking code or name.
   */
  sampleModule: (n: number) => `Sample module ${n} (demo)`,
  comingNext: {
    title: 'Coming next',
    lead: 'We’re still building these for your university years. They aren’t ready yet.',
    label: (thing: string) => `${thing}: coming next`,
    items: {
      studyCoach: {
        name: 'Study coach',
        line: 'Help to plan your study weeks around your modules, tests and assignments.',
      },
      marks: {
        name: 'Marks and weak spots',
        line: 'Keep your module marks in one place and see early where you need help.',
      },
      lifePlan: {
        name: 'A plan that fits your life',
        line: 'A week that makes room for classes, travel, work, family and rest.',
      },
      portfolio: {
        name: 'Year-to-year portfolio',
        line: 'What you did each year, kept together for bursaries, internships and jobs.',
      },
    },
  },
  /**
   * `/demo/guide`: a one-page guide for a judge with three minutes, linked from the picker (demo
   * only). What to try as each learner, and plainly what is made up or a stand-in. Every "try"
   * names something the learner's seed really has (apps/web/lib/server/demo/personas.ts). Owed the
   * owner's wording review.
   */
  guide: {
    pickerLink: 'New here? A three-minute guide',
    title: 'A three-minute guide for judges',
    lead: 'Pick one learner, try two or three things, then press “Switch learner” and pick another. Each one shows a different part of the journey, from Grade 10 to a final year at university.',
    honestTitle: 'What’s real here, and what’s a stand-in',
    honest: [
      'Everyone here is made up: the learners, their marks and their reports. Your copy is deleted after 24 hours.',
      'University facts come from each university’s published pages. Many are still being checked, and those say “Not yet verified”.',
      'The chat is the real AI, with every safety check on. If a page says “no AI connected”, the replies come from a simple practice script instead.',
      'Uploads take only our SAMPLE reports and pictures, never a real document or photo.',
      'Nothing is sent to a phone: no texts, WhatsApp messages or app notifications in the demo.',
      'Study help, marks, a weekly plan and a portfolio for the university years are still being built. They show as “Coming next”.',
    ],
    triesTitle: 'Things to try',
    /** One heading per learner: "Thabo, Grade 10". */
    personaHeading: (name: string, stage: string) => `${name}, ${stage}`,
    tries: {
      'demo-grade-10': [
        'Open My subjects: see which courses his subjects close, then try another subject to see what it opens.',
        'Open My goal, then his plan map, and tick a stop as done.',
        'Ask the chat: “What subjects do I need for Computer Science at Wits?”',
      ],
      'demo-grade-11': [
        'Open My results: what she’s on track for, worked out from her Grade 10 marks.',
        'On Home, press “See what I need” for the mark to aim for in each subject for her goal.',
        'Ask the chat: “Am I on track for BSc Computer Science at Wits?”',
        'Open Documents and press “Use a sample report” to see a SAMPLE report read and checked with her.',
      ],
      'demo-grade-12': [
        'Open Applications: Wits is sent, UJ is still open. Tick off what’s left on the UJ checklist.',
        'Open Funding to see the NSFAS documents she still needs.',
        'Open My results: the courses she qualifies for now, the close ones and her Plan B.',
      ],
      'demo-first-year': [
        'Open First week and tick off the next step.',
        'Open My campus and take the campus tour.',
        'Open My offers: the UJ offer she accepted and the Wits one she turned down.',
      ],
      'demo-second-year': [
        'Open My modules: who to see at Wits about changing his registration.',
        'Open My campus: where to go and who to ask.',
        'Ask the chat: “Where do I go at Wits if I need the clinic?”',
      ],
      'demo-final-year': [
        'Scroll to the end of Home: what’s coming next for the university years.',
        'Open About me, press “Make it yours” and give him a SAMPLE photo and a new look.',
        'Open My goal and look at his plan map, nearly all ticked.',
      ],
    },
    back: 'Back to the learners',
  },
  /**
   * The school on every made-up learner's profile (My CV's education needs one; a hackathon
   * exception of 2026-10-24). Plainly not a real school. Owed the owner's wording review.
   */
  schoolName: 'Sample High School (demo)',
  /**
   * On My CV in the judge demo (a hackathon exception of 2026-10-24): CVs there are made by a
   * built-in stand-in, never Mmereko (D14). Owed the owner's wording review.
   */
  cvStandIn:
    'In this demo, CVs are made by a simple built-in stand-in, not by Mmereko: nothing leaves UniversityFlow, and no AI writes or fits them.',
} as const;
