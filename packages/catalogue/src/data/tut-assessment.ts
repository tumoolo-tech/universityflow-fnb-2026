import type { UniversityAssessment } from '../assessment';

/**
 * Tshwane University of Technology (TUT): how marks work (Phase 6a). Schema:
 * `packages/catalogue/src/assessment.ts`.
 *
 * DRAFT: researched on 2026-10-24 (read in full, not snippets). Not yet verified by a person
 * (hard rule 3): never add `verifiedOn`/`verifiedBy`. Every number is quoted as printed; a rule
 * TUT doesn't print is left out (gotcha 40).
 *
 * - General rules: "Chapter 4, Examination Rules and Regulations" of the Students' Rules and
 *   Regulations. The PDF prints no year: its file name says 2024, and it is the version TUT links
 *   as current from its exams page in October 2026 (no 2025–2027 chapter is published), so it is
 *   recorded for 2026, the year it was read as current. A person confirms that reading. A learner
 *   in 2028 is shown it only once a person confirms it is still current and re-records it for that
 *   year (rules are used for the learner's own year only).
 * - Module schemes: none. Chapter 4 puts each module's formula in its study guide, which isn't
 *   public; TUT learners' cards come from their own outline (D1).
 * - Calendar: the 2027 Academic Core Calendar.
 *
 * TUT's own word for exam admission is the "predicate mark", used as printed.
 */

const CHAPTER_4 =
  'https://www.tut.ac.za/media/tshwane-interim/site-content/documents/exams/Chapter_4_2024.pdf';

export const tutAssessment: UniversityAssessment = {
  rules: [
    {
      sourceUrl: CHAPTER_4,
      academicYear: 2026,
      id: 'tut-general-rules',
      universityId: 'tut',
      title: 'Students’ Rules and Regulations, Chapter 4: Examination Rules and Regulations',
      passMark: {
        value: 50,
        quote:
          'A student shall pass a module/subject by obtaining a final mark of 50% or more for that module/subject, subject to rules 4.1.3.6 and 4.1.9',
        page: 'Rule 4.1.12.1, p. 14',
      },
      examAdmission: {
        term: 'predicate mark',
        minimumYearMark: 40,
        conditions: [
          'In cases where laboratory work and/or practical assignments form part of a module/subject, the marks obtained for such work shall be taken into account for admission to the examination.',
        ],
        quote:
          'A student shall not be admitted to an examination in a module/subject with its own alpha-numerical code, consisting of seven characters, if he or she has not been officially registered for that module/subject and has not obtained the required predicate mark of at least 40%.',
        page: 'Rules 4.1.3.6–4.1.3.7, p. 6',
      },
      examSubminimum: {
        value: 40,
        quote:
          'In addition to the final mark of 50%, a student should obtain a subminimum mark of at least 40% in a theoretical examination in order to pass, and where the examination in a module/subject consists of two (2) or more question papers, he or she should obtain a subminimum mark of at least 40% for each paper.',
        page: 'Rule 4.1.12.2, p. 14',
      },
      supplementary: {
        eligibleFinalMark: { from: 45 },
        alsoWhen: [
          'A student who obtains a final mark of 50% but failed the minimum subminimum also qualifies for a supplementary examination.',
        ],
        result: { kind: 'replaces-exam' },
        notWhen: [
          'No supplementary examination opportunities will be granted in modules/subjects that are assessed in a non-examination terminating mode.',
          'No supplementary examination shall be granted on the basis of marks obtained in a special examination.',
          'Only one (1) opportunity to take a supplementary examination shall be granted for a specific module/subject per academic period.',
        ],
        quote:
          'A student who fails the main examination in a module/subject, but obtains a final mark of at least 45%, qualifies for a supplementary examination. … The predicate mark obtained for admission to the main examination shall also apply to the supplementary examination. … A supplementary examination shall be conducted and its marks calculated in the same manner as that of the main examination.',
        page: 'Rules 4.1.14.2, 4.1.14.3, 4.1.14.5, 4.1.14.9, 4.1.14.10, 4.1.14.12, pp. 16–17',
      },
      deferredExam: {
        quote:
          'A special examination may be granted, subject to the approval of the Registrar or his or her designate to a student who was prevented from preparing for the main examination, or who was prevented from writing the main examination during an examination period, as a result of illness, or as a result of circumstances beyond his or her control (e.g. technology failure in computer-based assessment). … within three (3) working days of the date of the examination that the student has failed to take',
        page: 'Rule 4.1.15(b), (g), p. 17',
      },
      distinction: {
        value: 75,
        quote:
          'A student shall pass a module/subject with distinction by obtaining a final mark of 75% or more in that module/subject.',
        page: 'Rule 4.1.12.7, p. 15',
      },
      otherRules: [
        {
          quote:
            'In modules/subjects where students take formal examinations, the final mark shall be calculated by combining the predicate mark and the examination mark at a 50:50 ratio. Deviating ratios, approved by Senate.',
          page: 'Rule 4.1.12.4, p. 15',
        },
        {
          quote:
            'In addition to the final mark of 50%, a student should obtain a subminimum mark of at least 50% practical examination module/subject.',
          page: 'Rule 4.1.12.3, p. 15',
        },
        {
          quote:
            'A student who does not take or does not complete a supplementary examination for any reason whatsoever, shall fail the relevant module/subject.',
          page: 'Rule 4.1.14.10, p. 16',
        },
        {
          quote:
            'The University has an official predicate day, at least five (5) working days before the classes officially end, on which these marks will be announced.',
          page: 'Rule 4.1.4.1, p. 6',
        },
      ],
      note: 'The supplementary result is recorded as "replaces-exam" from rules 4.1.14.2 and 4.1.14.5 (the predicate mark carries over and the supplementary is calculated like the main examination); no cap is printed. The range is printed only as "at least 45%" with "fails the main examination". The 50:50 predicate-to-exam ratio is a default with Senate-approved deviations, so it is quoted, not used as a module weighting. Table 4.1.12.12 (p. 15), "Special examinations" row, prints "required to pass a supplementary examination" (apparently a copy slip). The file name says 2024; recorded for 2026 because TUT links it as the current chapter (read 2026-10-24): confirm.',
    },
  ],
  modules: [],
  calendars: [
    {
      sourceUrl:
        'https://www.tut.ac.za/media/tshwane-interim/site-content/documents/2027-Academic-Core-Calendar.pdf',
      academicYear: 2027,
      universityId: 'tut',
      title: 'Tshwane University of Technology 2027 Academic Core Calendar',
      semesters: [
        { term: 'S1', dates: { from: '2027-02-01', to: '2027-06-25' } },
        { term: 'S2', dates: { from: '2027-07-12', to: '2027-12-03' } },
      ],
      examPeriods: [
        {
          label: 'Main examinations (year modules’ classes continue)',
          dates: { from: '2027-05-24', to: '2027-06-11' },
        },
        { label: 'Main examination', dates: { from: '2027-11-01', to: '2027-11-19' } },
      ],
      supplementaryExams: [
        {
          label: 'Supplementary examinations for semester modules',
          dates: { from: '2027-06-14', to: '2027-06-28' },
        },
        { label: 'Supplementary examination', dates: { from: '2027-11-22', to: '2027-12-03' } },
      ],
      dpLists: [
        { label: 'Predicate day for semester modules', date: '2027-05-17' },
        { label: 'Predicate day', date: '2027-10-25' },
      ],
      note: 'Footed "Last update: 15 April 2026 / Served at SCTL: 15 April 2026". No supplementary registration is printed: TUT\'s exams page says "Students who qualify for supplementary examinations cannot apply for such an examination." Semester dates are the first day of the first term to the last day of the second term. Confirmation of predicate marks: 17–21 May and 25–29 October 2027.',
    },
  ],
};
