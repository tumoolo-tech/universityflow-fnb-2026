/** `en.agent`. */
export const agent = {
  sample: {
    noReport:
      'I’d love to help with that. First, upload your latest school report (or type in your marks), so everything I tell you is based on your own results.',
    results: (qualify: number, close: number, planB: number) =>
      `Here’s what your marks open up. You meet the minimums for ${qualify} degree${qualify === 1 ? '' : 's'}, you’re close to ${close} more, and there ${planB === 1 ? 'is 1 Plan B option' : `are ${planB} Plan B options`}. Open the course list to see each one and exactly what to improve.`,
    /** On Grade 10 marks (G10-3, A10-37): "on track", no Plan B. Owed the owner's review. */
    resultsGrade10: (onTrack: number, close: number) =>
      `Here’s where your marks are heading. You’re on track for ${onTrack} course${onTrack === 1 ? '' : 's'} and close to ${close} more. Universities use your final Grade 11 report and matric results, so there’s time to grow. Open the course list to see each one and what to work on.`,
    programme: (name: string, verdict: string) =>
      `Here’s how your marks compare for ${name}: ${verdict}. The breakdown shows how the university works out your score.`,
    notFound: 'I couldn’t find that course. Try My results to see everything I can check.',
    deadlines:
      'Here are the application dates I have. Always check the university’s website too, because dates can change.',
    funding:
      'Here’s how NSFAS works and what to get ready. Applying is free; never pay anyone to do it for you.',
    pack: (university: string) => `Here’s everything you need to apply to ${university}.`,
    remembered: 'Got it. I’ve noted that, and you can see or remove it under About me.',
    goal: (programme: string) =>
      `Your goal is ${programme}. The card shows where your confirmed marks put you for it now.`,
    noGoal:
      'You haven’t chosen a goal yet. Pick one course to aim for under My goal, or tell me which one.',
    exams: (n: number) =>
      `Here ${n === 1 ? 'is your next paper' : `are your next ${n} papers`}, from the official timetable. Always check your school’s copy too.`,
    noExams:
      'I don’t have exam dates for you yet. Either the timetable for your exams isn’t published, or I don’t know your subjects: confirm your marks first.',
    fallback:
      'I can help with your results, courses, application deadlines, what to prepare for each application, and NSFAS. What would you like to look at?',
    greeting: 'Hi! How are you doing today? When you’re ready, tell me what you’d like to work on.',
    practice: (subjects: number) =>
      `Here’s free practice for ${subjects === 1 ? 'the subject that matters most' : `the ${subjects} subjects that matter most`} right now. It’s all free on Siyavula; for the practice questions you sign up first.`,
    noPractice:
      'I can find free practice once I know what matters most for you. Tell me which subject you’d like to work on, set a goal, or confirm your marks.',
    offers: (n: number) =>
      `Here ${n === 1 ? 'is your offer' : `are your ${n} offers`}. Each card says what kind of offer it is: only a final offer is a place, so a provisional or conditional one still depends on your final results or the conditions in your letter.`,
    noOffers:
      'Congratulations on hearing back! Add the offer under My offers, or upload the letter, and I’ll help you keep track of what kind it is and when to reply.',
    campus:
      'Here’s the campus, grouped by what you’ll need. Places and numbers come from the university’s own pages: check them there too.',
    firstWeek:
      'Here’s your first-week checklist. Tick each step off as you go, and keep the dates in mind.',
    campusAsk:
      'Which university would you like to look around? Once you accept an offer under My offers, I’ll show you that one.',
    modules: (differences: number) =>
      differences === 0
        ? 'I checked your modules against your course’s published first-year curriculum, and they match. The faculty office has the final word.'
        : `I checked your modules against your course’s published first-year curriculum and found ${differences === 1 ? '1 thing' : `${differences} things`} to fix. The panel says who to see, has a message you can send, and the last day to change.`,
    modulesNoCurriculum:
      'I don’t have your course’s published first-year curriculum yet, so I can’t check your modules, and I won’t guess. The panel says who at your faculty can check them with you.',
    noRegistration:
      'Once you’ve registered, upload your proof of registration under My modules, or type your modules in, and I’ll check them against your course’s curriculum.',
    care: {
      setback:
        'I’m sorry, that’s a hard result to get, and I’m glad you told me. How are you feeling about it? A trial or June mark isn’t your final result: universities decide on your final matric marks. When you’re ready, we can look at what’s still possible from here, one subject at a time.',
      'giving-up':
        'It makes sense to feel like that after all this work. You don’t have to decide anything today. Your goal is still yours, and there’s more than one way to get there. Would it help to look at your options together?',
      'family-pressure':
        // A10-16, as A10-09 for the guidance: never say why the family is pushing, or that it
        // is well meant. Ask how things are at home instead. Wording owed review.
        'That’s a lot of pressure to carry, and it’s real. How are things at home right now? If it would help, we can think through what you could say to them, or to a teacher or school counsellor you trust. And if you ever don’t feel safe at home, please tell me.',
      comparison:
        'It’s hard not to compare, but their marks don’t change what’s possible for you. Let’s look at your own marks against your own goal: that’s the only comparison that counts here.',
      'exam-stress':
        'Exams are stressful, and what you’re feeling is real. Let’s keep it small: one paper and one topic at a time. Getting some sleep before a paper helps too. If it ever stops you sleeping or eating, please talk to your school counsellor.',
      // Phase 5d: arriving at university. Never a phone number here: a campus line comes only
      // from its verified record, through a tool.
      'offer-lost':
        'I’m so sorry. Losing an offer you worked for is a real loss, and it’s okay to feel it. How are you doing? This doesn’t decide what you can become. When you’re ready, your offers show what the final-results check found and the Plan B routes that are still open, and the university’s admissions office can tell you about any appeal.',
      'money-stress':
        'That’s a lot of stress to carry, and you’re not the only one going through it. Have you eaten today? Here’s how NSFAS works and what you can follow up. The university’s financial aid office is there for exactly this, and many campuses have food support for students. Never pay anyone who offers to speed up your funding.',
      homesickness:
        'Missing home is really common in the first weeks, and it’s okay to feel it. How are you finding it so far? One small thing can help: a call home at a set time, or one society or study group. If it starts to stop you eating, sleeping or going to lectures, the campus counselling service is there to talk to.',
      'culture-shock':
        'That’s a lot to carry, and being the first, or feeling different, doesn’t mean you don’t belong. You got here. Would it help to find one person to ask, like a mentor, a tutor or the student support office?',
      'arrival-anxiety':
        'Starting somewhere new is scary, and lots of first-years feel exactly like this. Let’s take it one step at a time: what to do first this week, and where things are on campus. If it starts to stop you sleeping or going to lectures, the campus counselling service is there to talk to.',
    },
    verdicts: {
      qualifies: 'you meet every published minimum',
      'on-track': 'you’re on track: your marks today would meet every published minimum',
      close: 'you’re close',
      'not-yet': 'not yet, but here’s the gap',
    },
  },
} as const;
