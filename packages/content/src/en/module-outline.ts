/**
 * Module outlines (Phase 6b, docs/plans/phase-6-proposal.md): the learner uploads the outline or
 * study guide for a module, we read it, and they check it part by part (how marks work, dates,
 * books, who teaches it) before anything uses it (hard rule 6). "Not in my outline" is a valid
 * answer for every part. Weights that don't add up to 100% are refused, never changed for them.
 *
 * Plain strings and string functions only (hard rule 11).
 */
export const moduleOutline = {
  title: 'Module outlines',
  lead: 'Upload the outline or study guide for a module. We read it, then you check every part before we use it.',
  /** The card on My modules that leads here. */
  fromModules: {
    title: 'Module outlines',
    lead: 'Add the outline for a module: how its marks work, the dates, the books and who teaches it.',
    link: 'Add a module outline',
  },
  uploadTitle: 'Add a module outline',
  uploadLead: 'A clear photo or PDF of your module outline or study guide.',
  choose: 'Choose your module outline',
  reading: 'Reading your outline…',
  typeIn: 'Type it in instead',
  unreadable: 'We couldn’t read that outline. Try a clearer photo or the PDF, or type it in.',
  /** Under consent wording that doesn't name module outlines yet (D9). */
  consentNotYet:
    'Module outlines need your consent to name them first. We’ll ask when the new wording is ready.',
  useSample: 'Use a sample module outline',
  useSampleLead: 'A made-up outline marked SAMPLE, for your made-up module.',
  sampleLead: 'These values come from a sample outline, not a real one.',

  confirmTitle: 'Check your module outline',
  confirmLead:
    'Check each part against your outline and fix anything we got wrong. If a part isn’t in your outline, say so.',
  step: (n: number, total: number) => `Part ${n} of ${total}`,
  moduleCode: 'Module code',
  moduleName: 'Module name',
  academicYear: 'Academic year',
  term: 'Semester or term',
  notSure: 'Not sure',
  termAsPrinted: (printed: string) => `Your outline says: ${printed}`,
  invalidCode: 'Check the module code: letters, numbers and spaces, like COMS1018A.',

  sections: {
    components: 'How marks work',
    dates: 'Dates',
    books: 'Books',
    people: 'Who teaches it',
  },
  sectionLeads: {
    components: 'The tests, assignments and exams, and how much each counts.',
    dates: 'Tests, hand-ins and exams, with their dates.',
    books: 'The prescribed and recommended books.',
    people:
      'Lecturers and tutors with their work details only. We never keep a personal cellphone number or email.',
  },
  notInOutline: 'Not in my outline',
  notInOutlineSaid: 'You said this isn’t in your outline.',
  confirmPart: 'Confirm and continue',
  back: 'Back',
  save: 'Save my outline',
  printedAs: (printed: string) => `Your outline says: ${printed}`,
  needOneRow: 'Add at least one row, or choose “Not in my outline”.',
  checkRows: (rows: ReadonlyArray<number>) =>
    rows.length === 1 ? `Check row ${rows[0]}.` : `Check rows ${rows.join(', ')}.`,

  components: {
    name: (n: number) => `Name (part ${n})`,
    kind: (n: number) => `What it is (part ${n})`,
    weight: (n: number) => `Counts for, in % (part ${n})`,
    subminimum: (n: number) => `Subminimum in %, if any (part ${n})`,
    kinds: {
      test: 'Test',
      assignment: 'Assignment',
      practical: 'Practical',
      tutorial: 'Tutorial',
      exam: 'Exam',
      project: 'Project',
      other: 'Other',
    },
    add: 'Add a part',
    remove: (n: number) => `Remove part ${n}`,
    total: (total: number) => `Together they count for ${total}%.`,
    notHundred: (total: number) =>
      `The parts add up to ${total}%, not 100%. Check them against your outline: we won’t change them for you.`,
    weightMissing: 'Every part needs what it counts for.',
    dpPercent: 'Year mark you need to write the exam (DP), in %',
    dpQuote: 'The DP rule in your outline’s words',
    examSubminimum: 'Exam subminimum, in %',
    supplementary: 'What your outline says about supplementary exams',
    percentInvalid: 'A percentage from 0 to 100.',
  },
  dates: {
    label: (n: number) => `What is due (date ${n})`,
    date: (n: number) => `Date (date ${n})`,
    add: 'Add a date',
    remove: (n: number) => `Remove date ${n}`,
    dateMissing: 'Choose the date.',
  },
  books: {
    role: (n: number) => `Prescribed or recommended (book ${n})`,
    roles: { prescribed: 'Prescribed', recommended: 'Recommended' },
    title: (n: number) => `Title (book ${n})`,
    authors: (n: number) => `Authors (book ${n})`,
    edition: (n: number) => `Edition (book ${n})`,
    isbn: (n: number) => `ISBN (book ${n})`,
    isbnInvalid: 'Check the ISBN: 10 or 13 digits, as printed on the book.',
    add: 'Add a book',
    remove: (n: number) => `Remove book ${n}`,
  },
  people: {
    name: (n: number) => `Name (person ${n})`,
    role: (n: number) => `Role, like Lecturer (person ${n})`,
    email: (n: number) => `Work email (person ${n})`,
    phone: (n: number) => `Office phone (person ${n})`,
    office: (n: number) => `Office (person ${n})`,
    consultation: (n: number) => `Consultation times (person ${n})`,
    emailInvalid: 'A work email address only, like name@university.ac.za.',
    phoneInvalid: 'An office number only. We never keep a cellphone number.',
    add: 'Add a person',
    remove: (n: number) => `Remove person ${n}`,
  },
  /** Something in a part that the server refused (a personal number, a cellphone number). */
  refused:
    'Something in this outline can’t be kept: an ID or student number, or a cellphone number. Take it out and save again.',

  warnings: {
    'not-an-outline': 'This doesn’t look like a module outline. Check every value carefully.',
    'partly-unreadable': 'Parts of the outline were hard to read. Check them against your copy.',
    'code-unclear': 'Check the module code.',
    'term-unclear': 'We couldn’t tell the semester. Choose it below.',
    'no-components':
      'We didn’t find how the marks work. Add the parts, or say it isn’t in your outline.',
    'weight-unclear': 'We couldn’t read what some parts count for. Type them in.',
    'weights-dont-add-up':
      'The parts we read don’t add up to 100%. Check them against your outline: we won’t change them for you.',
    'date-unclear': 'Some dates weren’t clear. Set them below.',
    'isbn-unclear': 'An ISBN didn’t look right. Check it against the book.',
    'personal-contact-dropped':
      'We left out a personal cellphone number or email. We keep work details only.',
    'personal-number-dropped': 'We left out something that looked like an ID or student number.',
    'rows-cut': 'Your outline had more rows than we keep. Check nothing important is missing.',
  },

  saved: 'Your module outline is saved.',
  removed: 'Module outline removed.',
  savedTitle: 'Your module outlines',
  empty: 'No module outlines yet.',
  heading: (code: string, year: number) => `${code} · ${year}`,
  fromOutline: (date: string) => `From your module outline, checked by you on ${date}`,
  typedIn: (date: string) => `Typed in by you on ${date}`,
  notInYourOutline: 'Not in your outline',
  componentLine: (name: string, weight: number) => `${name}: ${weight}%`,
  subminimumLine: (percent: number) => `subminimum ${percent}%`,
  dpLine: (percent: number) => `To write the exam (DP): a year mark of ${percent}%`,
  examSubminimumLine: (percent: number) => `Exam subminimum: ${percent}%`,
  remove: (code: string) => `Remove the outline for ${code}`,
  /** A1-81: two parts with one name, which the module card's rules can't tell apart. */
  duplicateNames:
    'Two parts have the same name. Give each part its own name, like “Test 1” and “Test 2”.',
} as const;
