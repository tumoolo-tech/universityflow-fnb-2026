/**
 * `en.planMaps`: My plan maps, the mind maps under My goal (docs/design/plan-maps-proposal.md,
 * approved 2026-10-23). The template keys are `packages/ui` plan-maps.ts's template and slot ids
 * (a slot is stored as `slot:<key>`), so a word can be reworded without a data migration, but a
 * key must never be renamed.
 *
 * Templates name stages only (§6, hard rule 2): no requirement, score, fee or date, held by
 * plan-maps.test.ts. Placeholders are shown greyed in an empty part and are never saved as the
 * learner's words. The prompts never shame (planning.md §4.1): "What got in the way?", never
 * "Why did you fail?". Every string here is owed the owner's wording review (D5).
 */
export const planMaps = {
  // ── The card on My goal (§4) ────────────────────────────────────────────────────────────────
  title: 'My plan maps',
  lead: 'Map your plan from Grade 10 to graduation, in your own words. Only you can see it.',
  /** While writing waits for the new consent wording: ticking works today. */
  leadTickOnly:
    'Map your plan from Grade 10 to graduation, and tick off each part as you go. Only you can see it.',
  empty: 'You don’t have a plan map yet.',
  start: 'Start a new map',
  counts: (achieved: number, notAchieved: number, planned: number) =>
    `${achieved} achieved · ${notAchieved} not achieved · ${planned} planned`,
  full: 'You have as many maps as you can keep. Delete one to start another.',
  updated: (date: string) => `Changed ${date}`,

  // ── Choosing a template (§8.4) ──────────────────────────────────────────────────────────────
  chooseTemplate: 'Choose a template',
  useGoal: 'Use my goal in the middle',
  useGoalHint: 'The middle shows the course you’re aiming for, and changes when your goal does.',
  create: 'Start',
  cancel: 'Cancel',
  created: 'Map started.',

  // ── The map page (§7, §8) ───────────────────────────────────────────────────────────────────
  back: 'Back to My goal',
  onlyYou: 'Only you can see this map.',
  showAs: 'Show as',
  picture: 'Picture',
  list: 'List',
  mapTitle: 'Map title',
  mapTitleHint: 'Leave it empty to use the template’s name.',
  saveTitle: 'Save title',
  goalCentre: 'My goal',
  goalNone: 'Choose a goal on My goal to show it here.',
  goalUnavailable: 'The course you chose can’t be shown right now.',
  goalLink: 'Where I stand for this course',
  goalAt: (course: string, university: string) => `${course}, ${university}`,
  status: { planned: 'Planned', achieved: 'Achieved', 'not-achieved': 'Not achieved' },
  statusLegend: 'How did this go?',
  myWords: 'My words',
  whyNot: 'What got in the way?',
  differently: 'What could I try differently?',
  whyNotShown: 'Got in the way',
  differentlyShown: 'Try differently',
  learnedLastTime: 'What I learned last time',
  target: 'My target',
  targetHint: 'Your own aim, not a real date. Real dates are on the pages that work them out.',
  month: 'Month',
  year: 'Year',
  noTarget: 'No target',
  targetShown: (when: string) => `My target: ${when}`,
  charactersLeft: (n: number) => `${n} characters left`,
  stepOf: (n: number, total: number) => `Step ${n} of ${total}`,
  edit: 'Edit',
  editing: (name: string) => `Edit ${name}`,
  more: 'More',
  moreFor: (name: string) => `More for ${name}`,
  save: 'Save',
  saved: 'Saved.',
  savedStatus: (name: string, status: string) => `Saved. ${name}: ${status}.`,
  addChild: 'Add a step under this',
  moveUp: 'Move up',
  moveDown: 'Move down',
  moveOut: 'Move out a level',
  moveIn: 'Move in a level',
  moved: 'Moved.',
  delete: 'Delete',
  keep: 'Keep',
  deleteAsk: (name: string, steps: number) =>
    steps === 0
      ? `Delete “${name}”?`
      : `Delete “${name}” and the ${steps === 1 ? 'step' : `${steps} steps`} under it?`,
  deleted: 'Deleted.',
  newStep: 'New step',
  addFromTemplate: 'Add a stop from this template',
  addStop: 'Add a stop',
  added: 'Added.',
  deleteMap: 'Delete this map',
  deleteMapAsk: (title: string) => `Delete “${title}” and everything in it?`,
  mapDeleted: 'Map deleted.',
  exportNote: 'Your maps are in Download my data, and are deleted with your account.',
  /** Writing waits for consent wording that names plan maps (the owner's switch, D2). */
  wordsWait:
    'Writing in your own words comes once the new consent wording is agreed. Until then you can choose a template and tick off each part.',
  limits: {
    'too-many-maps': 'You have as many maps as you can keep. Delete one to start another.',
    'too-many-nodes': 'This map is full. Delete a part to add another.',
    'too-many-children': 'This part has as many steps as it can hold.',
    'too-deep': 'Steps can only go three levels deep.',
    'not-found': 'That part isn’t on this map any more.',
  },
  errors: {
    words: 'Writing in your own words isn’t available yet. You can still tick off each part.',
    'personal-number':
      'That looks like an ID or student number. Take it out and save again: your map doesn’t need it.',
  },

  // ── When the words need care (§5.2, D3): the crisis card itself is `en.crisis`, its title
  // ("Talk to someone now") first, where focus goes ───────────────────────────────────────────
  care: {
    crisisLead: 'What you wrote matters. You don’t have to carry it alone.',
    concernLead:
      'Thank you for writing this down. If it’s weighing on you, you don’t have to carry it alone.',
    companion: 'Talk it through with my companion',
    seen: 'I’ve seen this',
    /** A hard moment that isn't distress (a setback, giving up on the goal): no card. */
    setback: 'A step that didn’t work out is part of the road, not the end of it.',
  },

  // ── Links from a stop to the page that computes its facts (§6) ──────────────────────────────
  links: {
    goal: 'Where I stand for my goal',
    applications: 'Application dates and documents',
    results: 'See what I need per subject',
    offers: 'My offers',
    modules: 'My modules',
    subjects: 'My subjects',
  },

  // ── The five templates (§2, D5). `slots` keys are packages/ui's slot keys ────────────────────
  templates: {
    'six-stops': {
      name: 'Six stops',
      line: 'Six steps around one plan.',
      centre: { heading: 'My plan', hint: 'What I want to be doing when I finish studying' },
      slots: {
        'grade-10': {
          heading: 'Grade 10',
          hint: 'Subjects I’m taking, and what I want from this year',
        },
        'grade-11': { heading: 'Grade 11', hint: 'The marks I’m working on, and how' },
        matric: { heading: 'Matric', hint: 'How I’ll prepare for my final exams' },
        applying: {
          heading: 'Applying',
          hint: 'Where I’ll apply, and who will help me with forms and funding',
        },
        'first-year': {
          heading: 'First year',
          hint: 'How I’ll settle in: where I’ll live, how I’ll study',
        },
        finishing: {
          heading: 'Finishing my qualification',
          hint: 'What I want to have done by the end',
        },
        'before-grade-10': {
          heading: 'Before Grade 10',
          hint: 'What got me here',
        },
      },
    },
    'thinking-cloud': {
      name: 'Thinking cloud',
      line: 'Get your ideas down before you plan.',
      centre: { heading: 'The life I want', hint: 'The life I want after my studies' },
      slots: {
        why: { heading: 'Why I want it', hint: 'What matters to me about this' },
        'good-at': { heading: 'What I’m good at', hint: 'Things people say I do well' },
        learn: {
          heading: 'What I want to learn',
          hint: 'Subjects, skills or courses I’m curious about',
        },
        'who-can-help': {
          heading: 'Who can help me',
          hint: 'A teacher, a family member, a friend, a mentor',
        },
        'in-the-way': {
          heading: 'What might get in the way',
          hint: 'Money, distance, time, marks: write what’s real for me',
        },
        'first-step': { heading: 'My first small step', hint: 'Something I can do this week' },
      },
    },
    staircase: {
      name: 'Staircase',
      line: 'One step at a time, from where you are to graduation.',
      centre: { heading: 'Where I want to reach', hint: 'The top of my staircase' },
      slots: {
        'where-i-am-now': {
          heading: 'Where I am now',
          hint: 'My grade, my subjects, how I feel about school right now',
        },
        'finish-grade-10': {
          heading: 'Finish Grade 10',
          hint: 'One thing I want to get better at',
        },
        'finish-grade-11': {
          heading: 'Finish Grade 11',
          hint: 'My plan for my end-of-year report',
        },
        'write-matric': { heading: 'Write matric', hint: 'How I’ll study for my finals' },
        'get-in': { heading: 'Get in', hint: 'Applications and funding I’ll sort out' },
        'pass-first-year': {
          heading: 'Pass first year',
          hint: 'How I’ll keep up with my modules',
        },
        'each-year-after': { heading: 'Each year after', hint: 'What I’ll do to keep going' },
        graduate: { heading: 'Graduate', hint: 'What I want to do next' },
        'before-grade-10': { heading: 'Before Grade 10', hint: 'What got me here' },
        habits: { heading: 'My habits', hint: 'The habits that keep me climbing' },
        focus: { heading: 'Focus', hint: 'What this looks like for me' },
        planning: { heading: 'Planning', hint: 'What this looks like for me' },
        action: { heading: 'Action', hint: 'What this looks like for me' },
        'self-belief': { heading: 'Self-belief', hint: 'What this looks like for me' },
        motivation: { heading: 'Motivation', hint: 'What this looks like for me' },
        'keeping-at-it': { heading: 'Keeping at it', hint: 'What this looks like for me' },
      },
    },
    'life-map': {
      name: 'Life map',
      line: 'Who you are, what you want, and the path between.',
      centre: { heading: 'Me, and where I’m going', hint: 'Three words for me, in my words' },
      slots: {
        'who-i-am': {
          heading: 'Who I am',
          subtitle: 'my strengths',
          hint: 'Three things I like about how I work',
        },
        'holds-me-back': {
          heading: 'What holds me back',
          hint: 'Thoughts or things that slow me down',
        },
        'what-i-want': {
          heading: 'What I want',
          subtitle: 'by the end of my studies',
          hint: 'Up to four things, in my words',
        },
        'my-path': {
          heading: 'My path',
          subtitle: 'school to graduation',
          hint: 'The big steps, in order',
        },
        'path-grade-10': { heading: 'Grade 10', hint: 'What I want from this year' },
        'path-grade-11': { heading: 'Grade 11', hint: 'The marks I’m working on' },
        'path-matric': { heading: 'Matric', hint: 'How I’ll prepare for my finals' },
        'path-applying': { heading: 'Applying', hint: 'Where I’ll apply' },
        'path-first-year': { heading: 'First year', hint: 'How I’ll settle in' },
        'path-graduate': { heading: 'Graduate', hint: 'What I want to do next' },
        'turning-it-around': {
          heading: 'Turning it around',
          hint: 'For each thing that holds me back: what I’ll tell myself instead',
        },
        'my-people': { heading: 'My people', hint: 'Who I can ask, and for what' },
        'my-week': {
          heading: 'My week',
          hint: 'Mornings, school days, evenings: one thing for each',
        },
      },
    },
    'the-road': {
      name: 'The road',
      line: 'Milestones along the road to your big goal.',
      centre: { heading: 'My big goal', hint: 'Where the road ends for me' },
      slots: {
        'where-i-am-now': { heading: 'Where I am now', hint: 'Where my road starts' },
        'grades-10-11': {
          heading: 'Grade 10 and 11 done',
          hint: 'The report I want to walk away with',
          childHint: 'Step I’ll take',
        },
        'matric-done': {
          heading: 'Matric done',
          hint: 'How I want to finish school',
          childHint: 'Step I’ll take',
        },
        accepted: {
          heading: 'Accepted',
          hint: 'Where I’ll be studying',
          childHint: 'Step I’ll take',
        },
        'first-year-passed': {
          heading: 'First year passed',
          hint: 'How I’ll know it went well',
          childHint: 'Step I’ll take',
        },
        graduated: {
          heading: 'Graduated',
          hint: 'What it will feel like',
          childHint: 'Step I’ll take',
        },
        'before-grade-10': { heading: 'Before Grade 10', hint: 'What got me here' },
      },
    },
  },

  /**
   * DRAFT, NOT LIVE. The line proposed for guardian consent v4 and adult-v3 (§5.3, D2). Owed
   * legal review, with the profile photo's v4 in the same bump. Nothing reads it: the live
   * consent wording (`en.consent`, `en.adultConsent`) and its version are unchanged.
   */
  consentDraft: {
    status: 'Draft, owed legal review: not shown to anyone, and not part of the live consent.',
    guardianLine:
      'Plans and mind maps they write in their own words, including what got in the way. Only they can see them. They are not sent to our AI provider.',
    adultLine:
      'Plans and mind maps I write in my own words, including what got in the way. Only I can see them. They are not sent to our AI provider.',
  },

  // ── The canvas (2026-10-24): the picture on a card, moved and zoomed ─────────────────────────
  canvas: {
    /** The map's window: a labelled region the learner moves around and zooms. */
    label: 'Your map, on a canvas',
    /** Said to a screen reader with the label: how to move around without a mouse. */
    keys: 'Drag the map, scroll, or use the arrow keys to move around it. The plus and minus keys zoom in and out, and the zero key fits the whole map in view.',
    tools: 'Map controls',
    zoomIn: 'Zoom in',
    zoomOut: 'Zoom out',
    /** Before the zoom level, for a screen reader: "Zoom 100 %" is drawn as the number alone. */
    zoom: 'Zoom',
    fit: 'Fit to view',
    reset: 'Back to the middle',
    open: 'Open the canvas',
    close: 'Close the canvas',
    /** The pointer's tips on the buttons: the key that does the same. */
    zoomInKey: 'Zoom in (the plus key)',
    zoomOutKey: 'Zoom out (the minus key)',
    fitKey: 'Fit to view (the zero key)',
    /** Where the map was on the page, while the canvas is open over it. */
    openNow: 'Your map is open on the full-screen canvas.',
  },
} as const;
