/**
 * `en.subjects`: "Do my subjects keep doors open?" (G10-4, planning.md §9 item 7), the My subjects
 * page and its card on the home. Which courses are open or closed is worked out by code from each
 * university's published requirements (packages/admissions `subjectDoors`); these are only the
 * words around it. **New wording (2026-10-22): owed the owner's review.**
 */
const courses = (n: number) => (n === 1 ? '1 course' : `${n} courses`);

export const subjects = {
  title: 'My subjects',
  lead: 'Some courses need a subject you choose at school, like Mathematics rather than Mathematical Literacy. This checks which courses your subjects keep open, from each university’s published requirements. Your marks don’t change it.',
  yours: 'Your subjects',
  /** The report the subjects come from (hard rule 6: confirmed by the learner). */
  fromReport: (report: string) => `From your ${report}, as you confirmed it.`,
  none: 'Add your school report and we’ll check which courses your subjects keep open.',
  add: 'Add my report',
  unknown:
    'We can’t check yet: no course has been checked against its university’s own requirements.',
  allOpen: (n: number) => `Your subjects keep all ${courses(n)} here open.`,
  someClosed: (closed: number, checked: number) =>
    `Your subjects close ${closed} of the ${courses(checked)} here, whatever your marks.`,
  opensTitle: 'What would open them',
  /** "Mathematics: 12 courses"; several subjects are joined with `or`. */
  opens: (names: string, n: number) => `${names}: ${courses(n)}`,
  or: ' or ',
  showCourses: 'Show the courses',
  higherTitle: 'Open, with a higher bar',
  higherLead: 'These courses take your subjects, but ask for a higher mark or score with them.',
  talk: 'Thinking of changing a subject? Talk to your school first: what you can change, and when, depends on your school.',
  draft: 'Preview: these courses are not yet verified.',

  /*
   * The redesign (G10-4, round 2, the owner's approved proposal, 2026-10-22): the verdict first,
   * by university, the closed courses by what they need, the higher bar's reason, and "Try a
   * different subject". **New wording: owed the owner's review.**
   */
  /** The page's one-sentence lead; the longer `lead` sits under "How this works". */
  intro:
    'Some courses need a subject you choose at school. This checks which ones your subjects keep open.',
  /** Under the verdict's meter (the meter itself is decoration). */
  meterLegend: (open: number, closed: number) => `${open} open · ${closed} closed`,
  /** Beside the report the subjects come from: a link to Documents. */
  notRight: 'Not right? Add a newer report',
  goalLabel: 'Your goal',
  goalOpen: 'Your subjects keep it open.',
  goalHigher: 'Open, with a higher bar.',
  /** One list of subject names per requirement the goal misses, joined with `and`. */
  goalNeeds: (names: string) => `Needs ${names}.`,
  byUniversityTitle: 'By university',
  /** Each university's row (a link that shows only its courses). */
  universityClosed: (closed: number, checked: number) => `${closed} of ${courses(checked)} closed`,
  closesTitle: 'Courses your subjects close',
  /** The title while one university is chosen, so the heading list says it. */
  closesTitleAt: (university: string) => `Courses your subjects close at ${university}`,
  /** A group's summary: the subjects (joined with `or`), one of which would meet its requirement. */
  needs: (names: string) => `Needs ${names}`,
  count: (n: number) => courses(n),
  /** A group's count while one university is chosen. */
  countAt: (n: number, total: number) => `${n} of ${courses(total)}`,
  /** A closed course's other missing requirements, each joined with `and`. */
  alsoNeeds: (names: string) => `also needs ${names}`,
  and: ' and ',
  filterLabel: 'Show courses at',
  allUniversities: 'All universities',
  show: 'Show',
  showing: (university: string) => `Showing ${university} only.`,
  showAll: 'Show every university',
  noneAt: (university: string) => `Your subjects close no course at ${university}.`,
  /** A higher bar's reasons, from the catalogue's numbers. */
  higherScore: (subject: string, score: number, otherwise: number) =>
    `With ${subject}: a score of ${score}, not ${otherwise}.`,
  higherScoreOnly: (subject: string, score: number) => `With ${subject}: a score of ${score}.`,
  higherOption: (yours: string, lowest: string) => `${yours}, where ${lowest} would do.`,
  atBar: (names: string, bar: string) => `${names} at ${bar}`,
  level: (level: number) => `level ${level}`,
  percent: (percent: number) => `${percent}%`,
  levelAndPercent: (level: number, percent: number) => `level ${level} (${percent}%)`,
  whatIfTitle: 'Try a different subject',
  whatIfLead:
    'See what would change if you swapped one subject. It’s only a what-if: your report isn’t changed.',
  dropLabel: 'Instead of',
  takeLabel: 'Take',
  check: 'Check',
  checking: 'Checking…',
  whatIfHeading: (take: string, drop: string) =>
    `If your school lets you take ${take} instead of ${drop}`,
  whatIfVerdict: (closed: number, checked: number) =>
    `Your subjects would close ${closed} of the ${courses(checked)} here.`,
  whatIfOpens: (n: number) =>
    n === 1 ? '1 more course would open.' : `${n} more courses would open.`,
  whatIfCloses: (n: number) => `${courses(n)} would close:`,
  whatIfSame: 'No course would open or close.',
  reportUnchanged: 'Your report isn’t changed: this is only a what-if.',
  howItWorks: 'How this works',
  /** The app: each control's name, with what it is set to. */
  filterButton: (university: string) => `Show courses at: ${university}`,
  dropButton: (name: string) => `Instead of: ${name}`,
  takeButton: (name: string) => `Take: ${name}`,
  groupLabel: (names: string, n: number) => `Needs ${names}, ${courses(n)}`,

  /** The home's card. */
  card: {
    title: 'Your subjects',
    closed: (n: number) => `${courses(n)} need a subject you don’t take`,
    open: 'Your subjects keep every course here open',
    unknown: 'Not yet: no course has been checked.',
    none: 'Not yet: add your school report to check your subjects.',
    action: 'Check my subjects',
  },
} as const;
