import type { ProgrammeTypeEntry, TeachOutNotice } from '../../colleges';

/**
 * Where the list of public TVET colleges comes from, and the national teach-outs (research and
 * spot-checks of 2026-10-24). Drafts: a person checks each against its source (hard rule 3).
 */

/**
 * DHET's newest list of public TVET colleges that could be read on dhet.gov.za: "Statistics on
 * Post-School Education and Training in South Africa: 2024", released May 2026, Appendix Table
 * 10.10 (50 colleges, names only). DHET's newest contact list is still March 2020's, which gives
 * each college's province. DHET publishes no searchable register of public colleges.
 */
export const DHET_COLLEGE_LIST = {
  title:
    'Statistics on Post-School Education and Training in South Africa: 2024 (Appendix Table 10.10)',
  datePrinted: 'Released in May 2026',
  url: 'https://www.dhet.gov.za/Information%20Systems%20Management%20Documents/Statistical%20Reports%20and%20Data/Reports/Statistics%20on%20Post-School%20Education%20and%20Training%20in%20South%20Africa%2c%202024.pdf',
  count: 50,
  /** DHET's TVET Colleges page (it links the March 2020 contact list). */
  tvetCollegesPage: 'https://www.dhet.gov.za/SitePages/TVETColleges.aspx',
  /**
   * DHET's Registers page: the Register of Private Colleges and of Private Higher Education
   * Institutions. Linked rather than a dated PDF, whose name changes with every update.
   */
  registersPage: 'https://www.dhet.gov.za/SitePages/DocRegisters.aspx',
} as const;

/**
 * The two teach-out circulars, as copies on Sedibeng TVET College's own portal domain (DHET
 * doesn't post its circulars on dhet.gov.za). TC 0134(B) closes N4: its schedule gives the last
 * N4 first opportunity as 2026; DHET's own Gazette 54858 (17 June 2026) and the Minister's
 * briefing of 11 June 2026 confirm the teach-out without dates.
 */
export const teachOutNotices: TeachOutNotice[] = [
  {
    sourceUrl:
      'https://www.mysedcol.co.za/_CollegeCirculars/Phase_Out_of_Selected_NC(V)_Programmes.pdf',
    academicYear: 2027,
    id: 'tc-0153',
    circular: 'TC 0153',
    title:
      'Teach-out plan for the selected National Certificate (Vocational) NCV programmes in the Technical Vocational Education and Training TVET colleges as part of the rationalisation process',
    datePrinted: '01 July 2026',
    type: 'ncv',
    programmes: [
      'Finance, Economics and Accounting',
      'Management',
      'Marketing',
      'Education and Development',
      'Office Administration',
      'Process Plant Operations',
    ],
    noFirstIntakeFrom: 2027,
    quotes: [
      'For all these programmes below, 2026 was the last year of first intake enrolment. From January 2027, there will be no first-year intake enrolment in these programmes:',
    ],
    hostCollegeId: 'sedibeng',
    supportingUrls: [],
  },
  {
    sourceUrl: 'https://www.mysedcol.co.za/_CollegeCirculars/TC_0134_B.pdf',
    academicYear: 2027,
    id: 'tc-0134-b',
    circular: 'TC 0134 (B)',
    title:
      'Extention provision for the teach out of the NATED Report 191 National N Diploma including N4 – N6 programmes',
    datePrinted: '15 October 2025',
    type: 'n4-n6',
    programmes: null,
    noFirstIntakeFrom: 2027,
    quotes: [
      'Below is the amended guiding teach-out schedule which provides the last enrolment and examination dates of the different N-levels for the last cohort of students on N4 – N6 programmes.',
      'N4 Semester 2 2026 Semester 1 2027 Semester 1 2027',
      'N4 Trimester 2 2026 Trimester 3 2026 Trimester 3 2026',
    ],
    hostCollegeId: 'sedibeng',
    supportingUrls: [
      'https://www.dhet.gov.za/SiteAssets/Gazettes/2026/54858%2017-6%20HighEduTrain.pdf',
      'https://www.dhet.gov.za/SiteAssets/Media%20Advisory%20and%20Statement%202026/Minister%20Manamela%20brief%20media%20on%20developments%20regarding%20modernising%20qualifications.pdf',
    ],
  },
];

/**
 * Where each programme type starts, nationally (A1-84, A10-67), from DHET's own policy documents
 * as linked from its TVET Colleges page (read 2026-10-25). Drafts: a person checks each quote
 * against its page (hard rule 3).
 *
 * - NC(V): "National Certificates (Vocational): Qualifications at Levels 2 to 4 on the NQF",
 *   Government Gazette No. 28677, 29 March 2006, section 3(1), the PDF's page 13 (a scan: the
 *   quote is read from it, so check the wording). Its other routes (an ABET Level 1 certificate,
 *   an NQF Level 1 qualification, a bridging programme) are not school grades, so `orAfter` is null.
 * - N4–N6: Report 191 (NATED), Part 2, "Formal Technical College Instructional Offerings N4–N6",
 *   printed under each N4 programme's admission requirements (N4 Farming Management, the PDF's
 *   page 14, as the example); some programmes add a subject, which the college's own rule shows.
 */
export const programmeTypeEntries: ProgrammeTypeEntry[] = [
  {
    sourceUrl:
      'https://www.dhet.gov.za/FET%20College%20Examination/Other%20TVET%20College%20Examination%20Documents%201/3NCV%20Qualifications%20L2-4%20Mar%202006.pdf',
    academicYear: 2027,
    type: 'ncv',
    afterGrade: 9,
    orAfter: null,
    quote:
      'The minimum entrance requirements for the National Certificate (Vocational) at Level 2 on the NQF are: (a) A Grade 9 Certificate; or (b) An Adult Education and Training (ABET) NQF Level 1 Certificate; or (c) A recognised equivalent qualification obtained at NQF Level 1; or (d) An approved bridging programme …',
    page: 'Section 3(1), PDF page 13 (Government Gazette No. 28677, 29 March 2006)',
  },
  {
    sourceUrl:
      'https://www.dhet.gov.za/FET%20College%20Examination/Other%20TVET%20College%20Examination%20Documents%201/6Report%20191%20Part%202%20NEP%20Formal%20TC%20instructional%20offerings%20N4-6.pdf',
    academicYear: 2027,
    type: 'n4-n6',
    afterGrade: 12,
    orAfter: 'N3',
    quote:
      'A Senior Certificate, or a National Certificate: N3, or a National Senior Certificate, or an equivalent qualification.',
    page: 'Admission requirements, N4 Farming Management, PDF page 14',
  },
];
