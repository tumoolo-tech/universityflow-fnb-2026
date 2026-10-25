/**
 * My modules: the registration check (Phase 5c). Code compares the learner's confirmed modules
 * with the programme's published first-year curriculum; these words explain each kind of
 * difference, who to see, the message to send and the last day to change. Nothing here decides
 * anything, and no verdict is given without a curriculum record. **Draft wording: the difference
 * explanations, the suggested message, the deadline texts and the empty states are owed the
 * owner's review.**
 */
export const modules = {
  title: 'My modules',
  lead: 'Check the modules you registered for against your course’s published first-year curriculum: what’s missing or wrong, who to see, and by when.',
  empty:
    'Nothing to check yet. Once you’ve registered, upload your proof of registration or type your modules in, and we’ll check them against your course’s curriculum.',
  notFirstYear:
    'We only have first-year curricula so far. If you’re past first year, your faculty office can check your registration with you.',

  uploadTitle: 'Upload your proof of registration',
  uploadLead:
    'A clear photo or a PDF. We read your course code, year of study and modules. Your student number, ID number, name, address and fees are never read or kept.',
  chooseProof: 'Choose a photo or PDF',
  reading: 'Reading your proof of registration…',
  unreadable: 'We couldn’t read that file. You can type your modules in instead.',
  typeIn: 'Type my modules in',

  confirmTitle: 'Check your modules',
  confirmLead:
    'We read these from your proof of registration. Check every row against it: fix anything that’s wrong, add a module we missed, and remove any that aren’t on it. Nothing is checked until you confirm.',
  typeLead:
    'Add each module on your proof of registration: its code as printed, and the semester if it shows one.',
  sampleLead:
    'Local stand-in: no AI is connected, so these are sample modules, not read from your file. Change them to match your real proof of registration.',
  programme: 'Your course',
  programmeHint:
    'The course you registered for. If you accepted an offer, it’s chosen for you: change it if you registered for another.',
  chooseProgramme: 'Choose your course',
  programmeCodeAsPrinted: (code: string) =>
    `Your proof of registration gives the course code “${code}”.`,
  academicYear: 'Academic year',
  yearOfStudy: 'Year of study (optional)',
  notSure: 'Not sure',
  moduleCode: (n: number) => `Module ${n}: code`,
  moduleName: (n: number) => `Module ${n}: name (optional)`,
  moduleTerm: (n: number) => `Module ${n}: semester or term`,
  moduleCredits: (n: number) => `Module ${n}: credits (optional)`,
  termAsPrinted: (printed: string) => `Printed as “${printed}”`,
  addModule: 'Add a module',
  removeModule: (n: number) => `Remove module ${n}`,
  invalidCode:
    'Write the module code as printed: letters and numbers, with spaces, dots, slashes or hyphens if it has them.',
  /** Above the form, naming the rows whose code can't be read (A3-14). */
  checkRows: (rows: ReadonlyArray<number>) =>
    rows.length === 1
      ? `Check the code of module ${rows[0]}.`
      : `Check the codes of modules ${rows.slice(0, -1).join(', ')} and ${rows[rows.length - 1]}.`,
  needOneModule: 'Add at least one module.',
  confirm: 'These are my modules: check them',
  saved: 'Saved. Your check is below.',
  warnings: {
    'not-a-proof':
      'This doesn’t look like a proof of registration. Check that you uploaded the right file.',
    'partly-unreadable':
      'Part of your proof of registration was hard to read. Check every row carefully.',
    'no-modules':
      'We couldn’t find any modules on it. Type them in from your proof of registration.',
    'modules-cut': 'There were more modules than we can keep. Check the list against your proof.',
    'term-unclear':
      'We couldn’t tell the semester for some modules. Choose it from your proof, or leave “Not sure”.',
    'code-unclear': 'Some module codes didn’t read clearly. Fix them from your proof.',
  },

  /** When a module runs, in words. */
  terms: {
    S1: 'first semester',
    S2: 'second semester',
    Y: 'whole year',
    Q1: 'first quarter',
    Q2: 'second quarter',
    Q3: 'third quarter',
    Q4: 'fourth quarter',
    either: 'either semester',
  },
  /** A curriculum module whose rule book prints no term: never guessed. */
  termNotPrinted: 'term not printed',
  /** How alternative sets of module codes are joined in words: "A and B, or C". */
  setJoin: { and: ' and ', or: ', or ' },

  checkedAgainst: (year: number) => `Checked against the ${year} first-year curriculum.`,
  registeredFor: (year: number) => `Your registration for ${year}`,
  matches:
    'Your modules match the published first-year curriculum. Nothing to fix. The faculty office has the final word.',
  differencesTitle: (n: number) => (n === 1 ? '1 thing to fix' : `${n} things to fix`),
  /** One explanation per kind of difference (admissions `DIFFERENCE_KINDS`), filled by code. */
  differences: {
    'missing-compulsory': (module: string) =>
      `You’re not registered for ${module}. Every first-year in your course must take it.`,
    'wrong-semester': (module: string, registered: string, offered: string) =>
      `You’re registered for ${module} in the ${registered}, but the curriculum offers it in the ${offered}.`,
    'not-in-curriculum': (module: string) =>
      `${module} isn’t in your course’s first-year curriculum. Check the code: it may be a typo, or a module from another course.`,
    'registered-twice': (module: string, times: number) =>
      `${module} is on your registration ${times} times. It only counts once.`,
    'elective-group-credits': (group: string, short: number) =>
      `“${group}”: you need ${short} more credits from this group.`,
    'elective-group-count': (group: string, short: number) =>
      `“${group}”: you need ${short === 1 ? '1 more module' : `${short} more modules`} from this group.`,
    /** A group of alternative sets: one whole set, and nothing from the others (A13-05). */
    'elective-group-set': (group: string, sets: string) =>
      `“${group}”: take one of these in full, not a mix: ${sets}.`,
    'credits-short': (registered: number, min: number) =>
      `Your modules add up to ${registered} credits. The curriculum asks for at least ${min}.`,
    'credits-over': (registered: number, max: number) =>
      `Your modules add up to ${registered} credits. The curriculum allows at most ${max}.`,
  },
  uncounted: (codes: string) =>
    `We couldn’t count the credits for ${codes}, so we haven’t checked your credit total.`,
  registeredTitle: 'What you registered for',
  expectedTitle: 'What the curriculum expects',
  compulsory: 'Compulsory',
  elective: 'Elective',
  registered: 'Registered',
  notRegistered: 'Not registered',
  notInCurriculum: 'Not in the curriculum',
  credits: (n: number) => (n === 1 ? '1 credit' : `${n} credits`),
  totalCredits: (registered: number, min: number, max: number) =>
    min === max
      ? `${registered} credits registered; the curriculum asks for ${min}.`
      : `${registered} credits registered; the curriculum asks for ${min} to ${max}.`,
  noCurriculum:
    'We don’t have your course’s published first-year curriculum for the year you registered for yet, so we can’t check your registration, and we won’t guess with another year’s. Your faculty office can check it with you.',
  noProgramme:
    'This course isn’t in the list we can show right now, so we can’t check your registration. Your faculty office can check it with you.',
  curriculumSource: 'The faculty’s rule book',

  whoTitle: 'Who to see',
  whoLead: (faculty: string) =>
    `The ${faculty} faculty office helps with changes to your registration.`,
  where: 'Where',
  hours: 'Hours',
  email: 'Email',
  phone: 'Phone',
  contactPage: 'The faculty’s contact page',
  noOffice:
    'We don’t have this faculty office’s details yet. Ask at your university’s registration venue or student service centre.',

  messageTitle: 'A message you can send',
  messageLead:
    'Copy it into an email to the faculty office, or show it at the office. Add your student number and full name when you send it: we don’t keep them.',
  copy: 'Copy the message',
  copied: 'Copied.',
  copyFailed: 'Couldn’t copy. Select the message and copy it yourself.',
  /** The message, put together by code from these parts (never by the AI). */
  message: {
    greeting: 'Good day,',
    intro: (programme: string, university: string, year: number) =>
      `I am a first-year student registered for ${programme} at ${university} for ${year}. When I checked my registration against the faculty’s published first-year curriculum, I found:`,
    lines: {
      'missing-compulsory': (module: string) =>
        `I am not registered for ${module}, which the curriculum lists as compulsory.`,
      'wrong-semester': (module: string, registered: string, offered: string) =>
        `I am registered for ${module} in the ${registered}, but the curriculum offers it in the ${offered}.`,
      'not-in-curriculum': (module: string) =>
        `I am registered for ${module}, which I can’t find in the first-year curriculum.`,
      'registered-twice': (module: string) =>
        `${module} appears more than once on my registration.`,
      'elective-group-credits': (group: string, short: number) =>
        `For “${group}”, I seem to be ${short} credits short.`,
      'elective-group-count': (group: string, short: number) =>
        `For “${group}”, I seem to need ${short === 1 ? '1 more module' : `${short} more modules`}.`,
      'elective-group-set': (group: string, sets: string) =>
        `For “${group}”, I don’t seem to be registered for exactly one of ${sets}.`,
      'credits-short': (registered: number, min: number) =>
        `My modules add up to ${registered} credits, below the ${min} the curriculum asks for.`,
      'credits-over': (registered: number, max: number) =>
        `My modules add up to ${registered} credits, above the ${max} the curriculum allows.`,
    },
    ask: 'Could you please help me correct my registration, or tell me if I have misunderstood? I can bring my proof of registration.',
    thanks: 'Thank you.',
  },

  deadlineTitle: 'Last day to change your registration',
  deadlineScopes: {
    all: 'All modules',
    S1: 'First-semester modules',
    S2: 'Second-semester modules',
    Y: 'Year modules',
    Q1: 'First-quarter modules',
    Q2: 'Second-quarter modules',
    Q3: 'Third-quarter modules',
    Q4: 'Fourth-quarter modules',
  },
  daysLeft: (n: number) =>
    n === 0 ? 'Today is the last day' : n === 1 ? '1 day left' : `${n} days left`,
  deadlinePassed:
    'This date has passed. Ask the faculty office straight away whether a late change is still possible.',
  noDeadline: (year: number) =>
    `We don’t have your university’s published last day to change modules for ${year}. Ask the faculty office, and don’t wait: changes usually close early in the term.`,
  unpublished: (scopes: string) => `No published last day for ${scopes}: ask the faculty office.`,
  reminderSet: (date: string) => `We’ll remind you on ${date}.`,
  reminderOff:
    'Turn on reminders under About me, and we’ll remind you before the last day to change.',
  calendarSource: 'The university’s calendar',

  checkAgain: 'Upload another proof of registration',
  remove: 'Remove my modules',
  removed: 'Removed.',
} as const;
