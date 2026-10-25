/**
 * The campus tour (Phase 5b): text first, with the university's own maps and virtual tours as
 * links and "open in maps" for each place (owner's decisions 1 and 2). Places, rooms, hours and
 * numbers are catalogue data, never written here. **Draft wording: owed the owner's review.**
 */
export const campus = {
  title: 'My campus',
  lead: 'Where things are on campus, grouped by what you’ll need them for, with links to the university’s own maps.',
  fromOffer: (university: string) => `${university}: the offer you accepted.`,
  exploring: (university: string) => `You’re looking around ${university}.`,
  chooseTitle: 'Choose a university to look around',
  chooseLead:
    'Once you accept an offer under My offers, we show that university here. Until then, you can look around any of them.',
  choose: (university: string) => `Look around ${university}`,
  another: 'Look around another university',
  /** The chooser is a dropdown and one button (owner's request, 2026-10-21). */
  universityLabel: 'University',
  lookAround: 'Look around',
  needs: {
    'getting-started': {
      title: 'Getting started',
      lead: 'Where to register, and where to ask about money.',
    },
    'health-and-safety': {
      title: 'Health and safety',
      lead: 'The campus clinic, counselling and security.',
    },
    study: { title: 'Studying', lead: 'Libraries and computer labs.' },
    'daily-life': { title: 'Daily life', lead: 'Food, getting around and residence.' },
    support: { title: 'Support', lead: 'Help if you have a disability, and other services.' },
  },
  kinds: {
    'registration-venue': 'Registration',
    library: 'Library',
    'computer-lab': 'Computer lab',
    food: 'Food',
    clinic: 'Clinic',
    counselling: 'Counselling',
    security: 'Campus security',
    'financial-aid': 'Financial aid',
    'disability-unit': 'Disability unit',
    'residence-office': 'Residence office',
    transport: 'Transport',
    other: 'Other',
  },
  where: 'Where',
  hours: 'Hours',
  call: (number: string) => `Call ${number}`,
  openInMaps: 'Open in maps',
  officialMap: 'Campus map',
  virtualTour: 'Virtual tour',
  campusOf: (campus: string, city: string) => `${campus}, ${city}`,
  notCheckedYet:
    'We haven’t checked this university’s campus details yet, so we don’t show them. The university’s own website has them in the meantime.',
  noPlaces: 'We haven’t checked the places on this campus yet.',
  safetyNotChecked:
    'The campus clinic, counselling and security show here only once we’ve checked their details, because you might need them in a hurry.',
  checkOnSite: 'Places, hours and numbers can change. Check the university’s own pages too.',
  beforeYouArriveTitle: 'Before you arrive',
  beforeYouArriveLead: 'A few ways to keep your money, your accounts and your work safe.',
  firstWeekLink: 'Your first-week checklist',
  /** The app with no connection: the last campus it loaded, kept on the phone (A7-17). */
  savedCopy:
    'This is the copy of My campus kept on this phone from the last time you were online. Places, hours and numbers may have changed since.',
  lastUpdated: (date: string) => `Last updated ${date}`,
  /**
   * Walk there and See it (Phase 5e-1): links that hand only the destination to the phone's own
   * maps app. On an iPhone both Apple's and Google's walk are offered, so each says which it opens.
   */
  walkThere: 'Walk there',
  walkThereIn: { apple: 'Walk there in Apple Maps', google: 'Walk there in Google Maps' },
  walkHint:
    'Opens walking directions from where you are, in your maps app. We don’t see where you are.',
  seeIt: 'See it',
  seeItHint: 'Opens Google Street View of the spot, so you know it when you get there.',
  stepFree: 'Step-free route',
  stepFreeIn: {
    apple: 'Step-free route in Apple Maps',
    google: 'Step-free route in Google Maps',
  },
  stepFreeHint: 'Opens walking directions to the step-free entrance.',
  /** Labels the published description of the accessible entrance. */
  accessibleEntrance: 'Step-free entrance',
  /** Labels the arrival note: the last metres, as the disability unit or a walk-through puts them. */
  arrival: 'Arriving',
  /**
   * A control's accessible name: its visible label first (WCAG 2.5.3), then the place, so a list
   * of "Walk there" links can be told apart (A3-19).
   */
  forPlace: (label: string, place: string) => `${label}: ${place}`,
  /**
   * Read aloud (Phase 5e-4; owner's choice of 2026-10-22): in the ElevenLabs voice, or through the
   * learner's screen reader when it's on in the app. Shown only when the voice is configured.
   */
  readAloud: 'Read aloud',
  readAloudHint: 'Reads this place’s details out loud. Nothing plays until you choose it.',
  stopReading: 'Stop reading',
  /** The voice couldn't play: offline, busy, or the learner pressed it too often. */
  readAloudFailed: 'Couldn’t read this out loud just now. Try again in a moment.',
  /** What "Read aloud" says, filled by code from the place's record (hard rule 8). */
  speech: {
    place: (name: string, kind: string) => `${name}, ${kind}.`,
    where: (where: string) => `Where: ${where}.`,
    hours: (hours: string) => `Hours: ${hours}.`,
    entrance: (description: string) => `Step-free entrance: ${description}.`,
    arrival: (note: string) => `Arriving: ${note}`,
    canWalk: 'To get there, choose Walk there. Your maps app guides you from where you are.',
    stepFreeRoute: 'For the step-free entrance, choose Step-free route.',
    noLocation: 'Its location isn’t published yet, so there are no walking directions to it.',
  },
  /** Getting around with a disability (Phase 5e-4), on the campus tour. */
  mobility: {
    title: 'Getting around with a disability',
    statement:
      'This app can help you find your way, but it never replaces your cane, your guide dog or mobility training. Keep using them, and trust them over your phone.',
    askUnit: (unit: string) =>
      `For mobility training or a campus orientation, ask ${unit}. It’s listed under Support below.`,
    askUnitUnchecked:
      'For mobility training or a campus orientation, ask the university’s disability unit. We haven’t checked its details yet.',
  },
} as const;
