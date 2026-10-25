/**
 * The first-week checklist (Phase 5b). The steps are ours; the dates come from the university's
 * registration calendar in the catalogue, never from these words. **Draft wording: owed the
 * owner's review.**
 */
export const firstWeek = {
  title: 'First week',
  lead: 'What to do in your first week, one step at a time. Tick each one off as you go.',
  progress: (done: number, total: number) => `${done} of ${total} done`,
  datesTitle: 'Dates to know',
  datesLead: 'From the university’s registration calendar.',
  registration: (from: string, to: string) => `First-year registration: ${from} to ${to}`,
  registrationCloses: (to: string) => `First-year registration closes: ${to}`,
  orientation: (from: string, to: string) => `Orientation: ${from} to ${to}`,
  changeDeadline: (scope: string, date: string) => `Last day to change modules (${scope}): ${date}`,
  changeDeadlineUnpublished:
    'The university hasn’t published a last day to change modules yet. Ask your faculty office before you change any.',
  changeScopes: {
    all: 'all modules',
    S1: 'first semester',
    S2: 'second semester',
    Y: 'year modules',
    Q1: 'first quarter',
    Q2: 'second quarter',
    Q3: 'third quarter',
    Q4: 'fourth quarter',
  },
  noDates:
    'We haven’t checked this university’s registration dates for the year you arrive yet, and another year’s dates aren’t yours. Its own website and your offer letter have them.',
  steps: {
    register: {
      title: 'Register',
      detail:
        'Register for your programme, online or in person, the way your university asks. Keep the proof of registration it gives you.',
    },
    'student-card': {
      title: 'Get your student card',
      detail:
        'You’ll need it for the library and computer labs, and often for residence. Take your ID and your proof of registration.',
    },
    'faculty-office': {
      title: 'Find your faculty office',
      detail:
        'They answer questions about your modules and your registration. Know where it is before you need it.',
    },
    'email-and-lms': {
      title: 'Set up your university email and learning site',
      detail:
        'Lecturers send notices and post work there. Log in during your first week so you don’t miss anything.',
    },
    'check-modules': {
      title: 'Check your modules',
      detail:
        'Make sure you’re registered for the right modules before the last day to change them.',
    },
    'clinic-and-security': {
      title: 'Find the clinic, and save campus security’s number',
      detail:
        'Know where the campus clinic is, and save campus security’s number in your phone before you need it.',
    },
    'financial-aid': {
      title: 'Sort out your funding',
      detail:
        'If you have NSFAS or a bursary, check with the financial aid office that it is in place for this year.',
    },
    'residence-check-in': {
      title: 'Check in to your residence',
      detail:
        'If you have a place in residence, check in and keep what you sign. Living off campus? Keep your lease and every payment receipt.',
    },
  },
  done: 'Done',
  doneOn: (date: string) => `Done on ${date}`,
  modulesLink: 'Open My modules',
  campusLink: 'Open My campus',
  facultyOfficeTitle: 'Your faculty office',
  email: (address: string) => `Email ${address}`,
  contactPage: 'Contact page',
  saved: 'Saved.',
  safetyTitle: 'Stay safe this week',
} as const;
