/** `en.confirm`. */
export const confirm = {
  title: 'Check your marks',
  lead: 'We read these from your report. Check every row against the report itself and fix anything that’s wrong. Nothing is used until you confirm.',
  sampleLead:
    'Local stand-in: no AI is connected, so these are sample marks, not read from your file. Change them to your real marks.',
  subject: 'Subject',
  asPrinted: (name: string) => `On your report: “${name}”`,
  percent: 'Mark (%)',
  /** The mark field's accessible name: which subject it belongs to (A3-03). */
  percentFor: (subject: string) => `Mark (%), ${subject}`,
  /** A row whose subject isn't chosen yet, by its place in the list. */
  subjectNumber: (n: number) => `Subject ${n}`,
  chooseSubject: 'Choose the subject',
  addRow: 'Add a subject',
  removeRow: 'Remove this row',
  confirm: 'These marks are correct',
  manualTitle: 'Type in your marks',
  manualLead: 'Add each subject and the percentage on your report.',
  issues: {
    'unknown-subject': 'We couldn’t tell which subject this is. Choose it from the list.',
    'missing-percent': 'We couldn’t read this mark. Type it in.',
    'out-of-range': 'This mark doesn’t look right. Check it.',
    duplicate: 'This subject appears twice. Remove one.',
  },
  warnings: {
    'not-a-report':
      'This doesn’t look like a school report. Check that you uploaded the right page.',
    'partly-unreadable': 'Part of your report was hard to read. Check every mark carefully.',
    'not-grade-11':
      'This looks like a report from a different grade. That’s fine: just make sure you choose the right report type.',
    'few-subjects': 'We found fewer than six subjects. Add any that are missing.',
  },
  errors: {
    invalid: 'Fix the highlighted rows, then confirm.',
    duplicate: 'Each subject can only appear once.',
  },
  saved: 'Saved. Here’s what you can apply for.',
} as const;
