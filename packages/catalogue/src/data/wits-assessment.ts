import type { UniversityAssessment } from '../assessment';

/**
 * University of the Witwatersrand (Wits): how marks work (Phase 6a). Schema:
 * `packages/catalogue/src/assessment.ts`.
 *
 * DRAFT: researched on 2026-10-24 from the 2026 Rules and Syllabuses books (the newest; no 2027
 * books yet) and wits.ac.za's exams pages. Not yet verified by a person (hard rule 3): never add
 * `verifiedOn`/`verifiedBy`. A rule Wits doesn't print is left out (gotcha 40).
 *
 * - The General Rules (G) are printed word for word in every faculty book; the Science book is cited.
 *   G7.10 sets 50% and a 35% subminimum "Unless specified otherwise in a course outline": a learner's
 *   confirmed outline overrides them field by field (D2).
 * - Supplementary ranges and caps sit in the Faculty Standing Orders, which aren't public: not
 *   recorded. Module schemes are on the LMS: learners' cards come from their outline (D1).
 */

const SCIENCE_BOOK =
  'https://www.wits.ac.za/media/wits-university/students/academic-matters/documents/Sci_eBook.pdf';

export const witsAssessment: UniversityAssessment = {
  rules: [
    {
      sourceUrl: SCIENCE_BOOK,
      academicYear: 2026,
      id: 'wits-general-rules',
      universityId: 'wits',
      title:
        'University Rules and Syllabuses for Degrees, Diplomas and Certificates, 2026: General Rules',
      passMark: {
        value: 50,
        quote:
          '7.10 Sub-minimum rule. Unless specified otherwise in a course outline, a student will not be allowed to obtain credit for a course unless s/he achieves: a) a final mark of at least 50 percent for that course',
        page: 'Rule G7.10, p. 23',
      },
      examSubminimum: {
        value: 35,
        quote:
          'b) a sub-minimum of 35 percent in each of the components of that course as well as in the summative assessment for that course.',
        page: 'Rule G7.10, p. 23',
      },
      componentSubminimum: {
        value: 35,
        fromWeight: 25,
        quote:
          'b) a sub-minimum of 35 percent in each of the components of that course as well as in the summative assessment for that course. Such a sub-minimum criterion applies only to components which contribute 25 percent or more towards a course, unless specified otherwise in the course outline.',
        page: 'Rule G7.10, p. 23',
      },
      examAdmission: {
        term: 'eligibility for assessment',
        conditions: [
          'attendance',
          'assignments completed',
          'tutorials participated in',
          'practical experiments, clinical work, field work and outside work',
        ],
        quote:
          'A student may be disqualified from presenting herself/himself for any assessment if s/he has not satisfied such requirements, including satisfactory participation in the work of the class, as may be prescribed by the Senate. These requirements include, but are not limited to: attendance, assignments completed, tutorials participated in, practical experiments, clinical work, field work and outside work. It is incumbent on each student to ascertain from the head of school what is required to qualify for presentation for assessment for each course.',
        page: 'Rule G13.3, p. 30',
      },
      supplementary: {
        result: { kind: 'recorded-pass-or-fail' },
        quote:
          'A student who has failed a course may be permitted by the Senate to present herself/himself for a supplementary assessment where such assessment is permitted by the rules of the faculty which teaches and examines the course, unless otherwise agreed by the faculties concerned. (G13.5) Where a supplementary assessment is granted, the final resultant mark may only be recorded as a pass (with the appropriate minimum pass mark) or a fail. (wits.ac.za/exams/supplementary-exams/)',
        page: 'Rule G13.5, p. 30; https://www.wits.ac.za/exams/supplementary-exams/',
      },
      deferredExam: {
        quote:
          'Students must apply to write a deferred assessment on the university system within three (3) working days of the date of the assessment. Students applying for a deferred assessment/s on medical grounds must seek medical attention from their doctor on the day of their assessment. Only a valid doctor’s certificate is accepted.',
        page: 'Rule G13.6.1, p. 30',
      },
      otherRules: [
        {
          quote:
            'Unless the Senate is satisfied that there was good and sufficient reason, a student who is absent from an assessment, in a course for which … s/he is required, permitted or entitled to present herself/himself, fails that course.',
          page: 'Rule G13.8, p. 31',
        },
        {
          quote:
            'The Senate may require a student to present herself/himself for an oral or other form of assessment if, on the marks obtained by her/him after prescribed assessment/s, s/he is, in the opinion of the Senate, on the borderline of the pass mark',
          page: 'Rule G13.4, p. 30',
        },
      ],
      note: 'The supplementary result ("pass … or a fail") was read through a page summariser on wits.ac.za/exams/supplementary-exams/: check the exact words. No supplementary mark range, DP minimum, rounding or distinction percentage is printed in the G rules; the Faculty Standing Orders that hold the supplementary conditions are not public.',
    },
    {
      sourceUrl: 'https://www.wits.ac.za/exams/frequently-asked-questions/',
      academicYear: 2026,
      id: 'wits-science-rules',
      universityId: 'wits',
      faculty: 'Science',
      title: 'Wits Examinations: Frequently Asked Questions',
      supplementary: {
        offered: false,
        quote:
          'Supplementary examinations are only applicable to students registered in the Faculties of Commerce, Law and Management; Health Sciences and Engineering and the Built Environment; Faculty of Humanities(Education students only).',
      },
      note: 'Science is not in the list, and the 2026 Science rules print no supplementary provision. The FAQ was returned in two parts by the fetch tool: check the sentence on the page.',
    },
    {
      sourceUrl:
        'https://www.wits.ac.za/media/wits-university/faculties-and-schools/health-sciences/student-documents/undergraduate/Information%20for%20all%20New%20and%20Returning%20Undergraduate%20Students%20in%20the%20Faculty%20of%20Health%20Sciences%20-%202026.pdf',
      academicYear: 2026,
      id: 'wits-health-sciences-rules',
      universityId: 'wits',
      faculty: 'Health Sciences',
      title:
        'Information for all New and Returning Undergraduate Students in the Faculty of Health Sciences - 2026',
      supplementary: {
        notWhen: [
          'If any of your other course results are below 40% then you will not be granted any supplementary examinations.',
        ],
        quote:
          'If any of your other course results are below 40% then you will not be granted any supplementary examinations. … If a student is awarded a supplementary examination and they are absent, they will face exclusion.',
        page: 'pp. 5–6',
      },
      note: 'The faculty rules (HSci book 2026, Rule 7.1.3.3(b), pp. 47–48) say supplementaries for MBBCh I–II, BDS I–IV, BNursing I–III, BPharm I–IV, BSc(OT) I–III and BSc(Physio) I–III "will normally be held in December", under the Faculty Standing Orders (not public). No range or cap is printed.',
    },
    {
      sourceUrl:
        'https://www.wits.ac.za/media/wits-university/students/academic-matters/documents/EBE_eBook.pdf',
      academicYear: 2026,
      id: 'wits-ebe-rules',
      universityId: 'wits',
      faculty: 'Engineering and the Built Environment',
      title: '2026 Senate Rules for the Faculty of Engineering and the Built Environment',
      supplementary: {
        notWhen: [
          'except in the following courses: (the list printed in Rule 2.1.3.2 (1.2) b) ii), including FEBE1000A, FEBE1002A, FEBE1004A, MCBG1000A, PHIL1002A, HIST1011A and the design, laboratory and project courses listed there)',
        ],
        quote:
          'b) A student who obtains the minimum aggregate but who fails to obtain the minimum mark in one or more courses may nevertheless be granted credit in all the courses in her/his curriculum. In deciding whether or not to grant credit in terms of this rule, the Senate may: i) require such a student to present himself/herself for an oral or other additional assessment in one or more or all of the courses in which s/he has failed to obtain the minimum mark, or ii) permit such a student to present herself/ himself without further attendance for a supplementary examination in one or more or all of the courses which s/he has failed to pass except in the following courses:',
        page: 'Rule 2.1.3.2 (1.2), pp. 57–59 (BSc (Eng))',
      },
      note: 'BSc (Eng) credit is aggregate-based: "the minimum aggregate as determined from time to time by the Senate" and the minimum course mark are not printed as numbers. The excluded-course list is long: verify it against the book. The BAS, BSc (Construction Studies), Property Studies and URP rules (2.2.2.8 (2)) have their own exclusion list.',
    },
  ],
  modules: [],
  calendars: [
    {
      sourceUrl: 'https://www.wits.ac.za/students/academic-matters/term-dates/2027-term-dates/',
      academicYear: 2027,
      universityId: 'wits',
      title: '2027 Term Dates',
      examPeriods: [
        {
          label: 'Examinations/Assessment Period (mid-year)',
          dates: { from: '2027-05-31', to: '2027-06-28' },
        },
        {
          label: 'Examinations/Assessment Period (year-end)',
          dates: { from: '2027-11-01', to: '2027-11-26' },
        },
      ],
      note: 'Wits prints teaching blocks, not semesters (Block 1: 8 Feb–24 Mar; 2: 12 Apr–27 May; 3: 19 Jul–3 Sep; 4: 13 Sep–26 Oct 2027), so no semester dates are recorded. "Faculty of Health Sciences Term Dates may vary." No supplementary period, supplementary registration or DP-list date is printed; the 2026–2027 results table (deferred and supplementary results published by about 21 Dec 2026 to 26 Jan 2027, by faculty) lost its columns in extraction and is not recorded.',
    },
  ],
};
