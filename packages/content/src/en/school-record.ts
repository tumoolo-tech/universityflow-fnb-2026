/**
 * `en.schoolRecord`: the school record on *My results*, web and app (planning.md §18.7 C2). Every
 * report the learner confirmed, side by side, with each mark's achievement level, the change since
 * the earliest report and the pass the marks would give. The numbers (levels, the key's bands, the
 * pass) come from packages/admissions; these are only the words around them. Owed the owner's
 * wording review.
 */
export const schoolRecord = {
  title: 'My school record',
  lead: 'Every report you confirmed, from Grade 10 to matric, side by side.',
  /** The table's caption on the web. */
  caption: 'Your marks on each report you confirmed, with the achievement level of each',
  subject: 'Subject',
  /** The last column: newest mark minus earliest, in percentage points. */
  changeHeading: 'Change since your first report',
  change: (points: number) =>
    points > 0 ? `+${points}` : points < 0 ? `−${Math.abs(points)}` : '0',
  noChange: 'Only on one report',
  percent: (n: number) => `${n}%`,
  level: (n: number) => `Level ${n}`,
  /** A subject a report has no mark for. */
  noMark: 'Not on this report',
  pass: 'The pass these marks give',
  passNote: 'Worked out from your marks. Only your final matric results earn a pass.',
  /** Who entered a mark (C4 adds official results later). */
  source: {
    learner: 'Entered by you',
  },
  /** One mark, in full, for a screen reader. */
  markLabel: (report: string, subject: string, percent: number, level: number, source: string) =>
    `${subject}, ${report}: ${percent}%, level ${level}. ${source}`,
  levelsTitle: 'Achievement levels',
  levelRange: (level: number, from: number, to: number) => `${level}: ${from}–${to}%`,
  correct: 'A mark wrong? Confirm that report again with the right marks.',
  correctLink: 'Add or correct a report',
  /** My results' lead when the latest report is Grade 11's June or September one. */
  resultsLeadInterim:
    'Based on the Grade 11 June or September marks you confirmed. Universities use your final Grade 11 report, so this shows where you’re heading, not what you qualify for.',
};
