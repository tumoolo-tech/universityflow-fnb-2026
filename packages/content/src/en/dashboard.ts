/**
 * `en.dashboard`: the signed-in home (`/home`), and the Get help page. Every number on the home is
 * computed by code from the learner's own records (apps/web/lib/home.ts); these are only the words
 * around them. **New wording (2026-10-19): owed the owner's review.**
 */
export const dashboard = {
  title: 'Home',
  welcome: (name: string) => (name ? `Welcome, ${name}` : 'Welcome'),
  /** Before the learner's name, which is shown in the accent colour. */
  welcomeBefore: 'Welcome, ',
  stage: {
    'grade-10': 'Grade 10',
    'grade-11': 'Grade 11',
    matric: 'Matric',
    university: 'University',
  },
  subtitle: {
    /** Stage 0 (G10-4): Grade 10, or 9. New wording (2026-10-22), owed review. */
    'grade-10': 'Grade 10 · your subjects, marks and goal at a glance',
    'grade-11': 'Grade 11 · your results and applications at a glance',
    matric: 'Matric · your results, applications and exams at a glance',
    university: 'University · your first weeks at a glance',
  },
  /** The icon buttons at the top right: their names, for screen readers and on hover. */
  reminders: 'Reminders and messages',
  aboutMe: 'About me',
  sectionsLabel: 'Your sections',
  ask: 'Ask your companion anything',
  /** The journey strip: the stage's steps, each done, current or to do (lib/home.ts). */
  journey: {
    label: 'Your journey',
    status: { done: 'Done', current: 'Now', todo: 'To do' },
    /**
     * Each step's name: one or two words, all of the same kind (what the step is about), so the
     * strip reads evenly. The state is said under it (Done, Now, To do), so a name never claims
     * something has happened.
     */
    steps: {
      report: 'Report',
      subjects: 'Subjects',
      study: 'Study',
      shortlist: 'Shortlist',
      goal: 'Goal',
      applications: 'Applications',
      funding: 'Funding',
      offer: 'Offer',
      'first-week': 'First week',
      modules: 'Modules',
      /** A second or later year at university (A2-66): My plan maps, on My goal. */
      plan: 'Plan',
    },
  },
  next: {
    label: 'Next step',
    /** The visible word on the next step's link. */
    start: 'Start',
    'add-report': 'Add your latest school report',
    shortlist: 'Shortlist the courses you want',
    goal: 'Choose the course you’re aiming for',
    checklist: (university: string) => `Finish your ${university} application checklist`,
    chat: 'Ask your companion what to do next',
    study: 'Practise the subjects your goal needs',
    'first-week': 'Tick off your first-week steps',
    modules: 'Confirm the modules you registered for',
    'fix-modules': 'Sort out the modules that don’t match',
    campus: 'Find your way around campus',
    /** A second or later year, modules confirmed (A2-66). New wording (2026-10-24), owed review. */
    plan: 'Plan the rest of your degree',
  },
  /** Each January, once the grade has moved up (G10-1). */
  gradeCheck: {
    title: (grade: number) => `Are you in Grade ${grade} now?`,
    lead: 'A new school year has started, so we moved your grade up by one.',
    yes: (grade: number) => `Yes, Grade ${grade}`,
    change: 'No, change my grade',
  },
  /** In the 30 days before the 18th birthday, while a guardian's consent covers them (A11-25). Owed the owner's review. */
  turningEighteen: {
    title: (date: string) => `You turn 18 on ${date}`,
    lead: 'From then we need your own OK to keep helping you, and your reminders (exam reminders too) pause until you give it. We’ll ask you the next time you open UniversityFlow.',
  },
  qualify: {
    title: 'Courses you qualify for now',
    /** On Grade 10 marks (G10-3): never "qualify". */
    titleGrade10: 'Courses you’re on track for',
    close: (n: number) => `${n} close`,
    planB: (n: number) => `${n} Plan B`,
    none: 'Not yet: add a school report and we’ll work it out.',
    add: 'Add your latest school report',
    open: 'See all my results',
  },
  nextPaper: (days: number) =>
    days === 0
      ? 'Your next paper is today'
      : days === 1
        ? '1 day to your next paper'
        : `${days} days to your next paper`,
  registration: {
    title: 'Registration',
    opens: (days: number) =>
      days === 1 ? 'day until registration opens' : 'days until registration opens',
    closes: (days: number) =>
      days === 0
        ? 'Registration closes today'
        : days === 1
          ? 'day until registration closes'
          : 'days until registration closes',
    none: 'Not yet: your university hasn’t published its registration dates.',
  },
  promo: {
    goalTitle: 'What do I need?',
    goalLead: 'See the mark to aim for in each subject, for the course you want most.',
    goalAction: 'See what I need',
    chooseGoalAction: 'Choose my goal',
    campusTitle: 'Know your campus',
    campusLead: 'Where to go, who to ask, the clinic and campus safety, before your first day.',
    campusAction: 'Take the campus tour',
    /** A second or later year (A2-66): the campus tour is an arrival's. Owed review. */
    planTitle: 'The rest of your degree',
    planLead: 'Map the steps from this year to graduation, and tick them off as you go.',
    planAction: 'Open my plan maps',
  },
  shortlist: {
    title: 'My shortlist',
    empty: 'Nothing on your shortlist yet. Add courses from your results.',
    unchecked: 'Add marks to check',
    open: 'My results',
    browse: 'Browse my results',
  },
  offers: {
    title: 'My offers',
    empty: 'No offers yet. When one comes, add it on My offers.',
    add: 'Add an offer',
    open: 'My offers',
  },
  applications: {
    title: 'My applications',
    empty: 'No applications yet. Shortlist a course and its university shows here.',
    checklist: (done: number, total: number) => `Checklist ${done}/${total}`,
    open: 'All applications',
    how: 'See how applications work',
  },
  gettingReady: {
    title: 'Getting ready',
    offer: 'Accepted offer',
    firstWeek: 'First-week steps done',
    firstWeekValue: (done: number, total: number) => `${done}/${total}`,
    firstWeekNone: 'Not yet: no checklist for this university.',
    modules: 'Modules confirmed',
    modulesToFix: (n: number) => (n === 1 ? '1 to sort out' : `${n} to sort out`),
    modulesMatch: 'All match your curriculum',
    modulesNone: 'Not yet: confirm the modules you registered for.',
    modulesAction: 'Confirm my modules',
  },
  chart: {
    title: 'My marks over time',
    lead: 'The average of all your subjects on each report you confirmed.',
    axis: 'Average mark (%)',
    /** Each report's short name under the chart. */
    short: {
      'grade-10-june': 'Gr 10 June',
      'grade-10-final': 'Grade 10',
      'grade-11-june': 'Gr 11 June',
      'grade-11-september': 'Gr 11 Sept',
      'grade-11-final': 'Grade 11',
      'grade-12-june': 'June',
      'grade-12-september': 'September',
      'grade-12-final': 'Final',
    },
    report: 'Report',
    percent: (n: number) => `${n}%`,
    noMark: 'None',
    point: (report: string, average: number) => `${report}: ${average}%`,
    showTable: 'Show as a table',
    subject: 'Subject',
    average: 'Average',
    none: 'Your marks over time show here once you’ve confirmed a school report.',
    one: (report: string, average: number) =>
      `One report so far: your ${report} averages ${average}%. Confirm your next report to see how you’re moving.`,
  },
  help: {
    title: 'Get help',
    lead: 'If things feel like too much, you don’t have to deal with it alone. Talking to someone can help, whatever is going on.',
    back: 'Back to UniversityFlow',
    /** The page's search and share description (A6-04, wave 10). Owed the owner's review. */
    description:
      'If things feel like too much, you don’t have to deal with it alone. Helplines you can call or message now, open to anyone, with no sign-in needed.',
  },
  /**
   * A second or later year at university (A2-66, packages/ui `universityYear`): the home is no
   * longer an arriving student's. New wording (2026-10-24), owed the owner's review.
   */
  subtitleYears: {
    middle: 'University · your modules and your year at a glance',
    final: 'Final year · your modules and your last steps at a glance',
  },
  /** The headline card in a second or later year, in place of the registration countdown. */
  year: {
    title: 'Year of study',
    final: 'Your final year',
  },
  /** In a second or later year, in place of "Getting ready" (the offer and the first week). */
  thisYear: {
    title: 'This year',
  },
} as const;
