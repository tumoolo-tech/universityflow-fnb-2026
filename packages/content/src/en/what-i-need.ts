/** "What I need per subject" (Phase 4c). Every number comes from packages/admissions. */
export const whatINeed = {
  title: 'What I need',
  open: 'What I need for this course',
  lead: 'The mark each subject needs for you to meet every published minimum for this course, worked out from the marks you confirmed.',
  statuses: {
    qualifies:
      'You already meet every published minimum for this course. Nothing needs to change: keep your marks where they are.',
    'on-track':
      'You’re on track: your marks today would meet every published minimum for this course. Keep them there through Grade 11 and matric, the marks universities use.',
    reachable: 'Here is one way to get there.',
    unreachable: 'With the subjects you take, no marks would meet this course’s minimums.',
  },
  totalGap: (points: number) =>
    points === 1
      ? '1 more percentage point across your subjects.'
      : `${points} more percentage points across your subjects.`,
  blockers: {
    subjectNotTaken: (subjects: string) => `This course needs ${subjects}, and you don’t take it.`,
    notEnoughSubjects: (needed: number, available: number) =>
      `This needs ${needed} subjects, and your report has ${available} that count.`,
    noHomeLanguage: 'A matric pass needs a home language at 40% or more, and your report has none.',
    noEnglish: 'This pass needs English at 30% or more, and your report has no English.',
    scoreOutOfReach: (label: string, best: number, required: number) =>
      `Even 100% in every subject would give you ${label} ${best}, and this course needs ${required}.`,
    talkToSomeone:
      'Talk to your teacher or the university’s admissions office about other routes in, and look at your Plan B options.',
  },
  subject: 'Subject',
  now: 'Now',
  target: 'Aim for',
  gap: 'To go',
  gapValue: (points: number) => (points === 0 ? 'Already there' : `+${points}`),
  /** One subject as a sentence, for the mobile app's list. */
  row: (subject: string, now: number, target: number) =>
    now === target
      ? `${subject}: ${now}%, already there`
      : `${subject}: ${now}% now, aim for ${target}%`,
  reasons: {
    'subject-minimum': 'This course’s minimum for this subject',
    'other-subjects': 'One of the other subjects this course counts',
    pass: 'Needed for the matric pass this course asks for',
    score: 'Raises your score',
  },
  score: (label: string, now: number, atTarget: number) =>
    `Your ${label}: ${now} now, ${atTarget} with these marks`,
  pass: (pass: string) => `Pass with these marks: ${pass}`,
  howChosen:
    'How we chose: first each subject’s own minimum, then the matric pass, then the score, raising the subject closest to its next level first, never above 100%. There are other ways to get there; this is one you can work towards.',
  notAPromise:
    'Meeting the minimum isn’t a guarantee of a place: many courses choose from everyone who meets it.',
  notFound: 'We couldn’t find that course in your results.',
  back: 'Back to My results',
} as const;
