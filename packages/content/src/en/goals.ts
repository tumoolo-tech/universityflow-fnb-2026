/** `en.goals`. */
export const goals = {
  title: 'My goal and exams',
  lead: 'One course to aim for, where your confirmed marks put you for it now, and the days to your next papers.',
  goalTitle: 'My goal',
  noGoal: 'You haven’t chosen a goal yet. Pick one course to aim for. You can change it any time.',
  choose: 'The course I’m aiming for',
  chooseHint: 'Courses are grouped by university.',
  setGoal: 'Make this my goal',
  change: 'Change my goal',
  clear: 'Remove my goal',
  cleared: 'Goal removed.',
  notAvailable:
    'The course you chose can’t be shown right now. Choose another one, or check again later.',
  noMarks: 'Confirm your marks to see where you stand for this course.',
  noVerdict:
    'We can’t work out your score for this university yet: its scoring rules are still being checked.',
  verdicts: {
    qualifies: 'You meet every published minimum',
    'on-track': 'On track: your marks today would meet every published minimum',
    close: 'You’re close',
    'not-yet': 'Not yet: here’s the gap',
  },
  openPack: (university: string) => `My ${university} application pack`,
  examsTitle: 'Exam countdown',
  examsLead: (year: number) =>
    `Your ${year} final NSC exams, from the official timetable. Always check your school’s copy too.`,
  notPublished: (year: number) =>
    `The ${year} NSC exam timetable isn’t published yet. We’ll add it once it’s out and has been checked. Until then, ask your school.`,
  noSubjects: 'Confirm your marks, or add the subjects you write below, to see your papers.',
  noUpcoming: 'No more papers on your timetable.',
  paper: (subject: string, n: number) => `${subject} Paper ${n}`,
  when: (date: string, time: string) => `${date}, ${time}`,
  duration: (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m === 0 ? `${h} hours` : `${h} h ${m} min`;
  },
  daysLeft: (n: number) => (n <= 0 ? 'Today' : n === 1 ? 'Tomorrow' : `${n} days to go`),
  subjectsTitle: 'My exam subjects',
  subjectsLead:
    'From the marks you confirmed. If the papers you write are different, change them here.',
  fromReport: 'On my confirmed report',
  addedByMe: 'Added by me',
  write: (subject: string) => `I write ${subject}`,
  addSubject: 'Add a subject I write',
  add: 'Add',
} as const;
