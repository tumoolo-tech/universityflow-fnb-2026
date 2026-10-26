/**
 * `en.moduleCard`: the module card and its mark calculator (Phase 6c; docs/plans/phase-6-proposal.md,
 * D2, D11, D13). Every number on the card comes from code (packages/admissions, from the learner's
 * confirmed outline or a sourced catalogue record); these strings only word it. There is no pass
 * mark, DP, subminimum or cap of our own anywhere here (hard rule 2, gotcha 40): a rule nobody
 * publishes is "not published", with who to ask.
 *
 * `calculator` is sent to the browser as templates (`{0}`, `{1}` in place of each value), so none
 * of its functions branches on what it is given.
 */
export const moduleCard = {
  pageTitle: 'Module card',
  back: 'Back to My modules',
  /** The link on a My modules row; its visible words are `open`. */
  open: 'Module card',
  openFor: (code: string) => `Module card for ${code}`,
  termAndYear: (term: string, year: number) => `${term}, ${year}`,
  notFound: 'We couldn’t find that module in your confirmed registration. Open it from My modules.',
  demoSample:
    'SAMPLE: this module’s outline and marks are made up for the demo. A real learner’s card is built from their own module outline and their university’s published rules.',
  previewNote: 'Preview: not yet checked by a person. Don’t rely on it yet.',

  how: {
    title: 'How marks work',
    lead: 'Each rule says where it comes from. Where nothing is published, we say so: we never fill in a usual number.',
    labels: {
      weighting: 'What counts',
      passMark: 'Pass mark',
      examAdmission: 'To write the exam',
      examSubminimum: 'Exam subminimum',
      componentSubminimum: 'Subminimum for each part',
      supplementary: 'Supplementary exam',
      deferredExam: 'If you miss the exam',
      rounding: 'Rounding',
      distinction: 'Distinction',
    },
    percent: (n: number) => `${n}%`,
    component: (name: string, weight: number) => `${name}: ${weight}%`,
    bestOf: (count: number, of: number) => `the best ${count} of ${of} count`,
    componentOwnSubminimum: (n: number) => `at least ${n}% needed`,
    yearAndExam: (year: number, exam: number) => `Year mark ${year}%, exam ${exam}%`,
    /** The university's own word for exam admission, when it prints none. */
    admissionTerm: 'Exam admission',
    admissionNumber: (term: string, n: number) => `${term}: a year mark of at least ${n}%`,
    admissionNoNumber: (term: string) => `${term}: the rules name conditions, not a mark`,
    conditionsTitle: 'Also needed (yours to check)',
    componentSubminimumAll: (n: number) => `At least ${n}% in each part`,
    componentSubminimumFrom: (n: number, weight: number) =>
      `At least ${n}% in each part worth ${weight}% or more of the final mark`,
    supplementaryRange: (from: number, to: number) =>
      `A final mark from ${from}% to ${to}% may lead to one`,
    supplementaryFrom: (from: number) =>
      `A final mark of at least ${from}%, below the pass mark, may lead to one`,
    supplementaryNotOffered: 'The rules say supplementary exams are not offered',
    supplementaryNoRange: 'The rules allow one, but don’t say for which final marks',
    supplementaryCapped: (cap: number) => `Its result is capped at ${cap}%`,
    supplementaryResults: {
      'replaces-exam': 'Its mark replaces your exam mark',
      'stands-alone': 'Its mark stands on its own',
      'recorded-pass-or-fail': 'It is recorded only as a pass or a fail',
    },
    supplementaryResultNotPublished: 'What its result counts for isn’t published',
    alsoWhen: (words: string) => `Also when: ${words}`,
    notWhen: (words: string) => `Not when: ${words}`,
    roundings: {
      'half-up': 'Final marks are rounded to the nearest whole percent',
      down: 'Final marks are rounded down to a whole percent',
      up: 'Final marks are rounded up to a whole percent',
    },
    notPublishedLecturer: 'Not published. Ask your lecturer.',
    notPublishedOffice: 'Not published. Ask the faculty office.',
    otherRulesTitle: 'Other rules to read',
    conflict: 'These disagree: ask your lecturer.',
    conflictOther: (source: string, value: string) => `${source} says: ${value}`,
    /** A1-81: the learner's confirmed outline breaks a rule the card applies, so it was left out. */
    outlineNotUsed:
      'We couldn’t use the module outline you confirmed: two parts have the same name, or the parts don’t add up to exactly 100%. What you see here is the published rules only. Check your outline and confirm it again.',
  },

  sources: {
    outline: (date: string) => `From your module outline, confirmed by you on ${date}`,
    sampleOutline: (date: string) =>
      `From the SAMPLE module outline (made up for the demo), confirmed on ${date}`,
    module: (code: string, year: number) =>
      `From the university’s published scheme for ${code} (${year})`,
    rules: (title: string, year: number) => `From “${title}” (${year})`,
    checkedOn: (date: string) => `Checked by a person on ${date}`,
    link: 'See the source',
  },

  dates: {
    title: 'Dates',
    fromOutline: 'From your module outline',
    fromCalendar: (university: string, year: number) => `From ${university}’s ${year} calendar`,
    examPeriods: 'Exam periods',
    supplementaryExams: 'Supplementary exams',
    supplementaryRegistration: 'Register for a supplementary exam by',
    dpLists: 'Exam admission (DP) lists published',
    range: (from: string, to: string) => `${from} to ${to}`,
    past: 'Past',
    none: 'No dates for this module are published here yet. Your module outline usually lists them, and the faculty office has the exam timetable.',
  },

  books: {
    title: 'Books',
    prescribed: 'Prescribed',
    recommended: 'Recommended',
    by: (authors: string) => `by ${authors}`,
    edition: (edition: string) => `Edition: ${edition}`,
    isbn: (isbn: string) => `ISBN ${isbn}`,
    noOutline: 'Your module outline lists the prescribed books. Add your outline to see them here.',
    addOutline: 'Add your module outline',
    notInOutline: 'Your module outline lists no books.',
  },

  people: {
    title: 'Who teaches it',
    fromOutline: 'From your module outline (work details only)',
    notPublished:
      'Who teaches it isn’t published here. Your module outline usually names your lecturer and when they see students.',
    email: 'Email',
    phone: 'Office phone',
    office: 'Office',
    consultation: 'Consultation times',
    askOffice: (faculty: string) =>
      `For a question about exam admission (DP), an exam or a supplementary exam, the ${faculty} office can help.`,
  },

  /** Template-safe: sent to the browser as `{0}`-templates (see the file comment). */
  calculator: {
    title: 'Mark calculator',
    lead: 'Type the marks you’ve got back. We work out the rest on this device: nothing is sent until you save.',
    markLabel: (name: string) => `${name}: your mark`,
    attemptLabel: (name: string, attempt: number) => `${name}, attempt ${attempt}: your mark`,
    yearMarkLabel: 'Your year mark (class mark)',
    markHint: 'A percentage, like 62, or a score, like 18/24. Leave it empty if it isn’t back yet.',
    markInvalid: 'Type a mark from 0 to 100, or a score like 18/24.',
    examNote: (name: string) => `${name}: the calculator works out what you need.`,
    targetLabel: 'Your target for this module (%)',
    targetHint: 'Optional. A whole or decimal percentage.',
    targetInvalid: 'Type a target from 0 to 100.',
    noWeighting:
      'How this module’s marks are weighted isn’t published, so we can’t work anything out yet. Your module outline usually says: add it, or ask your lecturer.',
    resultTitle: 'What this means',
    yearMarkSoFar: (percent: string) => `Your year mark so far: ${percent}%`,
    nothingYet: 'Type a mark to see your year mark.',
    stillToWrite: (names: string) => `Still to write: ${names}`,
    dp: {
      met: (term: string, n: number) => `${term}: on these marks you reach the year mark of ${n}%.`,
      'on-track': (term: string, n: number) =>
        `${term}: on track. Your average so far reaches the year mark of ${n}%.`,
      'at-risk': (term: string, n: number) =>
        `${term}: at risk. Your average so far is below the year mark of ${n}%, but you can still reach it.`,
      'not-met': (term: string, n: number) =>
        `${term}: these marks can’t reach the year mark of ${n}% any more. Talk to your lecturer or the faculty office now, and ask what happens next.`,
      'not-published': (term: string) =>
        `${term}: the rule for writing the exam isn’t published here. Ask your lecturer.`,
      'no-number': (term: string) =>
        `${term}: the rules name conditions, not a year mark. Check them yourself.`,
      'nothing-written': (term: string) => `${term}: type a mark to see whether you’re on track.`,
      'weighting-not-published': (term: string) =>
        `${term}: we can’t work this out until the module’s weighting is known.`,
    },
    /** The university's own word for exam admission, when it prints none. */
    admissionTerm: 'Exam admission',
    fixFirst: 'Fix the marks marked above to see what they mean.',
    conditionsNote: 'Also needed, and yours to check (we don’t judge these):',
    passTitle: 'To pass',
    targetTitle: (percent: string) => `To reach your ${percent}% target`,
    passNotPublished:
      'The pass mark for this module isn’t published, so we can’t say what you need to pass. Ask your lecturer or the faculty office.',
    noTarget: 'Set a target above to see what it needs.',
    readings: {
      'remaining-like-average': 'If the rest of your coursework goes like your average so far',
      'nothing-more': 'If you score nothing more before the exam',
      'all-written': 'With all your coursework in',
      'all-remaining': 'This module has no exam: across everything still to write',
    },
    needed: (n: number) => `You need ${n}% in the exam.`,
    neededAverage: (n: number) => `You need an average of ${n}% on what’s left.`,
    roundedUp: (exact: string) => `Rounded up from ${exact}%.`,
    bindsSubminimum: (n: number) =>
      `That is the exam subminimum of ${n}%: below it the rules say you can’t pass, whatever your year mark.`,
    secured:
      'Your marks so far already reach this, whatever your exam mark. Check with your lecturer whether you still need to write it.',
    impossible: 'This can’t be reached any more on these marks, even with 100% in the exam.',
    impossibleNext:
      'What happens next: talk to your lecturer or the faculty office soon. They can tell you about a supplementary exam, repeating the module, and support.',
    blocked: (names: string) =>
      `A subminimum isn’t met in: ${names}. The rules say that blocks a pass whatever the total. Talk to your lecturer.`,
    supplementaryTitle: 'Supplementary exam',
    supplementaryRange: (from: number, to: number) =>
      `If your final mark ends up from ${from}% to ${to}%, the rules say you may qualify for a supplementary exam. The faculty decides.`,
    supplementaryBelowPass: (from: number, passMark: number) =>
      `If your final mark ends up at least ${from}% but below the pass mark of ${passMark}%, the rules say you may qualify for a supplementary exam. The faculty decides.`,
    supplementaryCapped: (cap: number) => `Its result is capped at ${cap}%.`,
    supplementaryResultNotPublished: 'What its result counts for isn’t published.',
    supplementaryResults: {
      'replaces-exam': 'Its mark replaces your exam mark.',
      'stands-alone': 'Its mark stands on its own.',
      'recorded-pass-or-fail': 'It is recorded only as a pass or a fail.',
    },
    supplementaryNotOffered: 'The rules say supplementary exams are not offered for this module.',
    supplementaryNotPublished:
      'Whether a supplementary exam is possible isn’t published here. Ask the faculty office.',
    supplementaryNoRange:
      'The rules allow a supplementary exam but don’t say for which final marks. Ask the faculty office.',
    bestFinal: (percent: string) => `The best final mark you can still reach is ${percent}%.`,
    bestFinalMayQualify:
      'That is in the range where the rules say you may qualify for a supplementary exam. The faculty decides.',
    bestFinalBelow: 'That is below the range where the rules allow a supplementary exam.',
    save: 'Save my marks',
    saved: 'Marks saved.',
    sampleMarks: 'Sample marks, made up for the demo.',
    /** A1-82: secured on coursework, but the rules here print no exam subminimum (not "none"). */
    securedSubminimumNotPublished:
      'Your marks so far already reach this on the weighting alone. But no exam subminimum is published here, and the exam may still have one: check with your lecturer before you decide how much to prepare.',
    /** A1-82: secured on coursework, but exam admission (DP) isn't reached on these marks. */
    securedDpNotMet:
      'Your marks so far would reach this, but only if you may write the exam, and on these marks you don’t reach exam admission (see above). Talk to your lecturer or the faculty office now.',
  },

  /** The home's journey step after My modules (Stage 6). */
  journeyStep: 'Set up your semester',
} as const;
