/**
 * `en.cv`: My CV, made by Mmereko as UniversityFlow's operator
 * (docs/design/mmereko-api-proposal.md, approved 2026-10-23). The CV API's status words and the
 * words for each reason it refuses, so the web page and the app say the same thing. The page's
 * own copy (the opt-in card, the sections, the buttons) is added with the page, in this section.
 * Every string here is owed the owner's wording review.
 */
export const cv = {
  /**
   * The version of the CV opt-in wording a learner agrees to, recorded with their opt-in
   * (`cv_links.consent_version`) and sent to Mmereko as the consent's version. A change to the
   * opt-in card's words is a new version.
   */
  optInVersion: 'cv-optin-v1',

  /** A CV's state, as its list shows it (§10.5). Never colour alone. */
  status: {
    queued: 'Being made',
    submitted: 'Being made',
    ready: 'Ready',
    failed: 'Couldn’t be made, try again',
  },

  /** Why the CV API said no: the `detail` of a refusal. */
  errors: {
    'cv-consent':
      'Making a CV waits for the new consent wording that names Mmereko. Nothing has been sent.',
    'cv-share-age':
      'Sharing a CV with a recruiter is for learners aged 18 and over, who agreed in their own name.',
    'cv-share-unchecked': 'Check that every line of this CV is true before you share it.',
    'cv-busy': 'A CV is still being made. Wait for it to finish, then try again.',
    'cv-limit': 'Your CV has as many of these as it can hold. Delete one to add another.',
    'cv-not-ready': 'This CV isn’t ready yet.',
    'cv-opted-in': 'You’ve already chosen to make a CV.',
    'cv-incomplete':
      'Add your name and at least one school or university to your CV before you make it.',
    'personal-number':
      'That looks like an ID or student number. Take it out and save again: your CV doesn’t need it.',
    'rate-limited': 'You’ve made a lot of CVs today. Try again tomorrow.',
    'cv-unavailable': 'We couldn’t reach the CV service just now. Try again in a few minutes.',
  },

  /** The public share page (`/cv/s/<token>`), seen by whoever holds the link. */
  share: {
    goneTitle: 'This CV isn’t available',
    gone: 'This CV link has expired or was switched off.',
  },

  // ── The page (/cv) and the app screen (§10.5). Owed the owner's wording review. ──────────────

  /** The page's title, and its link in the sidebar's University group. */
  title: 'My CV',
  lead: 'A CV made from what you choose: your school, your marks if you want them, and your projects and skills in your own words.',
  /** The app, when the server's CV switch is off. */
  unavailable: 'My CV isn’t available yet.',

  /**
   * The opt-in card: §9.2's draft wording, owed legal review and the owner's wording review. A
   * change to `body` is a new `optInVersion`.
   */
  optIn: {
    title: 'Make a CV with Mmereko',
    body: 'Mmereko is a company that turns what you choose into a CV file. We send it only what you tick on this page, never your phone number or ID number. It keeps it only until your CV is made, at most one day, in South Africa. You can stop any time.',
    agree: 'Yes, make my CV with Mmereko',
    /** 18+ in their own name only (§9.3). */
    share: 'Also let me share my CV with a recruiter by a link',
    shareHint:
      'Anyone with the link can see that CV until it expires or you switch it off. You choose when to make a link.',
    given: (date: string) => `You chose to make a CV with Mmereko on ${date}.`,
    addShare: 'Let me share my CV with a recruiter',
    shareAdded: 'You can now make a link to share a CV.',
  },

  /** "What goes on my CV": ticks grouped by section, each with where it came from. */
  what: {
    title: 'What goes on my CV',
    lead: 'Tick what you want on it. Nothing goes to Mmereko until you press Make my CV.',
    about: 'About you',
    surname: 'Surname',
    surnameHint: 'Your first name comes from About me.',
    label: 'One line about you',
    labelHint: 'For example: Grade 12 learner who likes building things.',
    summary: 'A few sentences about you',
    contact: 'How a recruiter can reach you',
    contactHint:
      'Only what you type here goes on your CV. We never use the number you sign in with, and never your ID or student number.',
    email: 'Email',
    phone: 'Phone number',
    city: 'Town or city',
    region: 'Province',
    school: 'School',
    subjects: 'Marks',
    subjectsHint: 'Marks stay off your CV unless you tick them.',
    subject: (name: string, percent: number) => `${name}: ${percent}%`,
    university: 'University',
    offer: (course: string, university: string) => `${course}, ${university}`,
    modules: 'Modules',
    module: (code: string, name: string) => `${code} ${name}`,
    entries: 'Projects and skills',
    /** Where each tickable thing comes from. */
    from: {
      profile: 'From About me',
      report: 'From your confirmed school report',
      offer: 'From the offer you accepted',
      registration: 'From your confirmed module registration',
      entries: 'From My projects and skills, below',
      typed: 'Typed here, for your CV only',
    },
    nothing: 'Nothing to tick here yet.',
    save: 'Save what goes on my CV',
    saved: 'Saved what goes on your CV.',
    missingTitle: 'Before you can make your CV',
    missing: {
      name: 'Your name: add your first name on About me, and your surname here.',
      education: 'Your school or university: tick at least one.',
    },
    omitted: {
      unconfirmed:
        'Something you ticked waits for you to confirm it on My documents, so it was left off.',
      unverified: 'A university or course name we haven’t checked yet was left off.',
    },
  },

  /** "My projects and skills": the learner's own entries, each its own small form. */
  entries: {
    title: 'My projects and skills',
    lead: 'In your own words. Add links that show your work, like your code, a video or a live demo.',
    empty: 'You haven’t added a project or skill yet.',
    add: 'Add a project or skill',
    edit: (title: string) => `Edit ${title}`,
    remove: (title: string) => `Delete ${title}`,
    removeAsk: (title: string) => `Delete “${title}”?`,
    removeYes: 'Delete',
    keep: 'Keep it',
    kind: 'What is it?',
    kinds: {
      project: 'A project',
      skill: 'A skill',
      work: 'Work',
      volunteer: 'Volunteering',
      award: 'An award',
      language: 'A language',
      certificate: 'A certificate',
    },
    name: 'Name',
    organisation: 'Where, or who with',
    role: 'Your role, or how well you speak it',
    start: 'Started',
    end: 'Finished',
    dateHint: 'Year and month, like 2026-03. Leave it empty if you don’t know.',
    description: 'What you did',
    highlights: 'What you’re proud of, one per line',
    keywords: 'Skills it shows, with commas between them',
    modules: 'Module codes it used, with commas between them',
    evidence: 'Links to your work',
    evidenceKind: 'What the link is',
    evidenceKinds: {
      repository: 'Code',
      demo: 'A live demo',
      document: 'A document',
      video: 'A video',
      other: 'Something else',
    },
    evidenceUrl: 'Link, starting with https://',
    evidenceLabel: 'What it shows',
    addLink: 'Add a link',
    removeLink: (n: number) => `Remove link ${n}`,
    link: (n: number) => `Link ${n}`,
    save: 'Save',
    cancel: 'Cancel',
    added: (title: string) => `Added ${title}.`,
    saved: (title: string) => `Saved ${title}.`,
    removed: (title: string) => `Deleted ${title}.`,
  },

  /** "Make my CV". */
  make: {
    title: 'Make my CV',
    lead: 'We send what you ticked to Mmereko, and it makes your CV. It takes a minute or two.',
    button: 'Make my CV',
    waiting: 'A CV is being made. You can make another once it’s done.',
    started: 'Your CV is being made.',
    /**
     * After the crisis card, when what would be sent holds words that worry us (CV-A10, A10-55,
     * A10-56): nothing was sent; a second press sends it. Also under "Fit it to a job".
     */
    held: 'Nothing was sent. If these words belong on your CV, press the button again to send them. You can also change what you wrote or ticked first.',
  },

  /** The list of CVs, with their status words (`status`). */
  list: {
    title: 'My CVs',
    empty: 'You haven’t made a CV yet.',
    draft: 'My CV',
    tailored: (title: string) => `Fitted to ${title}`,
    tailoredAt: (title: string, company: string) => `Fitted to ${title} at ${company}`,
    made: (date: string) => `Asked for on ${date}`,
    open: 'Open',
    openName: (name: string, date: string) => `Open ${name}, ${date}`,
    ready: 'Your CV is ready.',
    failed: 'Your CV couldn’t be made. Try again.',
  },

  /** One CV: the text, then Download PDF, the gaps, and "Check every line is true". */
  preview: {
    title: (name: string) => `${name}: preview`,
    download: 'Download PDF',
    downloadHint: 'Opens your CV as a PDF. The link works for one minute.',
    gaps: 'What could make it stronger',
    check: 'Check every line is true',
    checkLead:
      'Read it through. If a line isn’t true, don’t use this CV: change your ticks or your entries and make a new one.',
    confirm: 'Every line is true',
    confirmed: (date: string) => `You checked every line on ${date}.`,
    close: 'Close the preview',
    /** Above a fitted CV's text (CV-A10, A10-57): an AI wrote it, so it is the learner's draft. */
    tailoredNote:
      'An AI fitted this CV to the advert from what you ticked. It can get things wrong or say more than is true, so check every line before you use it.',
  },

  /** "Fit it to a job": a pasted advert, a tailored CV, and its ATS score. */
  tailor: {
    title: 'Fit it to a job',
    lead: 'Paste a job advert. We make a CV fitted to it and show how much of what the advert asks for your CV covers. The advert is deleted once your CV is made.',
    jobTitle: 'Job title',
    company: 'Company',
    advert: 'The job advert',
    button: 'Fit my CV to this job',
    started: 'Your fitted CV is being made.',
    score: 'How much of the advert your CV covers',
    scoreValue: (percent: number) => `${percent}% of the advert’s keywords`,
    missing: 'Keywords from the advert your CV doesn’t have',
    missingMust: 'Must-haves your CV doesn’t have',
    noneMissing: 'Your CV has every keyword we found in the advert.',
    /**
     * Said where the advert is pasted (audit CV-A11, A11-37): a fitted CV is written by the AI
     * provider abroad (D4), though the opt-in card says Mmereko works in South Africa. Owed the
     * owner's wording review and the legal review with consent v4.
     */
    aiNote:
      'To fit your CV, Mmereko sends what you ticked and the advert to our AI provider, Anthropic, which works outside South Africa and doesn’t use it to train its AI.',
  },

  /** 18+ only (§9.3): a link a recruiter can open. */
  sharing: {
    title: 'Share with a recruiter',
    lead: 'Make a link to this CV. Anyone with the link can see it until it expires or you switch it off.',
    days: 'How long the link works',
    daysOption: (n: number) => `${n} days`,
    create: 'Make a link',
    link: 'Your link',
    linkOnce: 'Copy it now: we show it only once.',
    copy: 'Copy the link',
    copied: 'Link copied.',
    made: 'Link made.',
    /** No plural in it: the page fills it from a template (`{0}`, `{1}`). */
    active: (date: string, views: number) => `Works until ${date}. Views so far: ${views}.`,
    off: 'Switch off',
    offName: (date: string) => `Switch off the link that works until ${date}`,
    switchedOff: 'Link switched off.',
  },

  /** "Stop using Mmereko" (§9.2, D15): the download is offered first. */
  withdraw: {
    title: 'Stop using Mmereko',
    body: 'Stop using Mmereko? We’ll switch off your share links and ask Mmereko to delete anything it still has. You can download your CVs first.',
    start: 'Stop using Mmereko',
    downloadFirst: 'Your CVs, to download first',
    confirm: 'Yes, stop and delete my CVs',
    keep: 'Keep using it',
    done: 'You’ve stopped using Mmereko. Your CVs and share links are deleted.',
  },

  /**
   * "Report this CV" under a fitted CV (A10-58; design §11, A10-35's pattern): a reason from the
   * fixed list (`CV_REPORT_REASONS`), never free text, and a person looks at it. Owed the owner's
   * wording review.
   */
  report: {
    open: 'Report this CV',
    question: 'What’s wrong with it?',
    /** One for each of CV_REPORT_REASONS. */
    reasons: {
      untrue: 'It says something about me that isn’t true',
      harmful: 'It’s harmful or upsetting',
      other: 'Something else',
    },
    send: 'Send report',
    cancel: 'Cancel',
    sent: 'Thanks. A person at UniversityFlow will look at it.',
    /** After "harmful or upsetting": where to find someone now. */
    helpLead: 'If you need someone to talk to now:',
    help: 'Get help',
    reported: 'Reported',
    error: 'We couldn’t send your report. Please try again.',
  },

  /** Deleting one CV (A11-38, D13: kept until the learner deletes it), asked on the page first. */
  remove: {
    button: 'Delete',
    name: (name: string, date: string) => `Delete ${name}, ${date}`,
    ask: (name: string) =>
      `Delete “${name}”? Its text, its PDF and any share links to it are deleted for good.`,
    yes: 'Yes, delete it',
    keep: 'Keep it',
    done: (name: string) => `Deleted ${name}.`,
  },
} as const;
