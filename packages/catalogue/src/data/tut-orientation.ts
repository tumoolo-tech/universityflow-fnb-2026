import type { Campus, FacultyOffice, Place, RegistrationCalendar } from '../campus';

/**
 * Tshwane University of Technology (TUT): campuses, the places on them, faculty offices and the
 * registration calendar (planning.md §11, Phase 5b–5c).
 *
 * Fill these arrays only: the catalogue already reads them, and the catalogue tests validate every
 * record added here. Schemas and field notes: `packages/catalogue/src/campus.ts`.
 * - Every record cites a page on tut.ac.za (or a subdomain) as `sourceUrl`, with the
 *   `academicYear` it was published for. Never add `verifiedOn`/`verifiedBy`: a person does.
 * - Ids start with `tut-`. A place's `campusId` is a campus below; a faculty office's
 *   `faculty` is spelled exactly as this university's programmes spell it (data/tut.ts).
 * - Clinic, counselling and security places are safety records: learners see them only once a
 *   person has verified them.
 * - Leave out what the university doesn't publish. Never guess a number, room, date or hour.
 *
 * DRAFT: researched from TUT's own site on 2026-10-16. TUT publishes no campus map or virtual
 * tour that research could find, no Campus Protection Services number or office, no registration
 * venue (first-year registration is online), no computer-lab or cafeteria page. Those are left out.
 */

const PROSPECTUS = 'https://www.tut.ac.za/media/tshwane-interim/site-content/images/prospectus/';
/** 2026 Prospectus Part 1, Students' Rules and Regulations: the campus contact list (p. 2). */
const RULES_2026 = {
  sourceUrl: `${PROSPECTUS}Part1_Students_Rules_and_Regulations.pdf`,
  academicYear: 2026,
} as const;
const ICT_2026 = {
  sourceUrl: `${PROSPECTUS}Part6_ICT_Prospectus.pdf`,
  academicYear: 2026,
} as const;
const HUMANITIES_2026 = {
  sourceUrl: `${PROSPECTUS}PART_5_Humanities_Prospectus_-2026.pdf`,
  academicYear: 2026,
} as const;
const FEBE_2026 = {
  sourceUrl: `${PROSPECTUS}Part4_FEBE_Prospectus.pdf`,
  academicYear: 2026,
} as const;
const SCIENCE_2026 = { sourceUrl: `${PROSPECTUS}Part8_Science.pdf`, academicYear: 2026 } as const;
const ECONOMICS_2026 = {
  sourceUrl: `${PROSPECTUS}Part3_Economics-and-Finance_Prospectus.pdf`,
  academicYear: 2026,
} as const;
const MANAGEMENT_2026 = {
  sourceUrl: `${PROSPECTUS}Part7_Management-Sciences_Prospectus.pdf`,
  academicYear: 2026,
} as const;
/** 2027 General Information for First Year Enrolment ("Printed January 2026"), pp. 9–14. */
const GENERAL_INFO_2027 = {
  sourceUrl:
    'https://www.tut.ac.za/media/tshwane-interim/site-content/documents/General-Information-First-Year-Enrolment.pdf',
  academicYear: 2027,
} as const;
/** 2027 First Year Course Information, p. 4 ("Prospective students with disabilities"). */
const COURSE_INFO_2027 = {
  sourceUrl:
    'https://www.tut.ac.za/media/tshwane-interim/site-content/documents/First-Year-Course_Information.pdf',
  academicYear: 2027,
} as const;
const LIBRARIES = 'https://libraries.tut.ac.za/tutnew/index.php/component/content/article/';

export const tutCampuses: Campus[] = [
  {
    ...RULES_2026,
    id: 'tut-pretoria',
    universityId: 'tut',
    name: 'Pretoria Campus',
    city: 'Pretoria',
  },
  {
    ...ICT_2026,
    id: 'tut-soshanguve-south',
    universityId: 'tut',
    name: 'Soshanguve South Campus',
    city: 'Soshanguve',
  },
  {
    ...HUMANITIES_2026,
    id: 'tut-soshanguve-north',
    universityId: 'tut',
    name: 'Soshanguve North Campus',
    city: 'Soshanguve',
  },
  {
    ...RULES_2026,
    id: 'tut-arcadia',
    universityId: 'tut',
    name: 'Arcadia Campus',
    city: 'Pretoria',
  },
  {
    ...RULES_2026,
    id: 'tut-ga-rankuwa',
    universityId: 'tut',
    name: 'Ga-Rankuwa Campus',
    city: 'Ga-Rankuwa',
  },
  {
    ...RULES_2026,
    id: 'tut-emalahleni',
    universityId: 'tut',
    name: 'eMalahleni Campus',
    city: 'eMalahleni',
  },
  {
    ...RULES_2026,
    id: 'tut-mbombela',
    universityId: 'tut',
    name: 'Mbombela Campus',
    city: 'Mbombela',
  },
  {
    ...RULES_2026,
    id: 'tut-polokwane',
    universityId: 'tut',
    name: 'Polokwane Campus',
    city: 'Polokwane',
  },
];

const at = (campus: string) => ({ query: `Tshwane University of Technology ${campus}` });

/** The H&W per-campus numbers on p. 14; the building is not given with them. */
const HEALTH_NOTE =
  'The Directorate of Health and Wellness "Contact us" box (p. 14) gives this number for the campus but no building or hours. ';
/** p. 13 prints a second per-campus table, headed "Extracurricular Development Contact Details". */
const HEALTH_P13 = (detail: string) =>
  `${HEALTH_NOTE}A table on p. 13 headed "Extracurricular Development Contact Details" lists ${detail}; confirm which is the campus clinic.`;
const COUNSELLING_NOTE =
  'The number is TUT\'s "24 hour toll-free personal counselling telephone line", for all campuses; appointment enquiries go to counselling@tut.ac.za. Where personal counselling is offered on this campus is not published (p. 10 gives Pretoria Campus, Building 6, Room 361 for career counselling only).';
const FINAID_NOTE = (email: string) =>
  `Financial Aid contact for the campus (p. 9), e-mail ${email}. The office's building is not published.`;
const ARLC_NOTE = (printed: string, email: string) =>
  `"ARLC Residence Accommodation" contact for the campus (p. 11), printed as ${printed}, e-mail ${email}. The office's building is not published.`;
const LIBRARY_HOURS =
  'TUT\'s library hours page (libraries.tut.ac.za/tutnew/index.php/about-lis/library-hours.html) gives one timetable for "Library Services", not per campus: academic term Mon–Thu 08:00–22:00, Fri 08:00–16:00, Sat 09:00–17:00.';

export const tutPlaces: Place[] = [
  // Pretoria Campus: civil and electrical engineering, nursing, marketing, hospitality.
  {
    sourceUrl: `${LIBRARIES}91-pretoria-library.html`,
    academicYear: 2026,
    id: 'tut-pretoria-library',
    campusId: 'tut-pretoria',
    kind: 'library',
    name: 'Pretoria Library',
    where: 'Pretoria Campus',
    location: at('Pretoria Campus Library'),
    note: `The library's page gives no building or address, and no year (it lists the 2026 DHET journals). ${LIBRARY_HOURS}`,
  },
  {
    ...GENERAL_INFO_2027,
    id: 'tut-pretoria-clinic',
    campusId: 'tut-pretoria',
    kind: 'clinic',
    name: 'Directorate of Health and Wellness',
    where: 'Pretoria Campus',
    phone: '012 3826612',
    location: at('Pretoria Campus'),
    note: HEALTH_P13(
      '"Pretoria Campus … (Senior Practitioner)", Tel 012 382 4158, Building 4 Room G08; the directorate\'s own office is Building 4 Room 142/142A, Pretoria Campus, Tel 012 382 6611/6613',
    ),
  },
  // One record for the all-campus line (A13-06): it is a phone line, not a place on a campus, so it
  // is filed once (under Pretoria Campus, the main campus) and says it serves every campus.
  {
    ...GENERAL_INFO_2027,
    id: 'tut-pretoria-counselling',
    campusId: 'tut-pretoria',
    kind: 'counselling',
    name: 'Student Development and Support: 24-hour personal counselling line',
    where: 'By phone, for every TUT campus (no walk-in place is published)',
    hours: '24 hours',
    phone: '0800 68 78 88',
    location: at('Pretoria Campus'),
    note: `${COUNSELLING_NOTE} Filed once, under Pretoria Campus, since it serves every campus; the Soshanguve South copy was removed (A13-06). The maps link is only the campus, not a counselling room.`,
  },
  {
    ...GENERAL_INFO_2027,
    id: 'tut-pretoria-financial-aid',
    campusId: 'tut-pretoria',
    kind: 'financial-aid',
    name: 'Financial Aid',
    where: 'Pretoria Campus',
    phone: '012 382 4289',
    location: at('Pretoria Campus'),
    note: FINAID_NOTE('finaidpta@tut.ac.za'),
  },
  {
    ...COURSE_INFO_2027,
    id: 'tut-pretoria-disability-unit',
    campusId: 'tut-pretoria',
    kind: 'disability-unit',
    name: 'Disability Coordinator',
    where: 'Pretoria Campus',
    phone: '012 382 5072',
    location: at('Pretoria Campus'),
    note: 'Published as "Contact the campus where you wish to enrol or the Disability Coordinator at the Pretoria Campus". The 2027 General Information (p. 10) gives the Disability Unit e-mail ptadisability@tut.ac.za. No building is published.',
  },
  {
    ...GENERAL_INFO_2027,
    id: 'tut-pretoria-residence-office',
    campusId: 'tut-pretoria',
    kind: 'residence-office',
    name: 'ARLC Residence Accommodation',
    where: 'Pretoria Campus',
    phone: '012 382 5511',
    location: at('Pretoria Campus'),
    note: ARLC_NOTE('012 382 5511/14', 'resadminp@tut.ac.za'),
  },
  {
    ...GENERAL_INFO_2027,
    id: 'tut-pretoria-transport',
    campusId: 'tut-pretoria',
    kind: 'transport',
    name: 'Intercampus shuttle service',
    where: 'Pretoria Campus',
    location: at('Pretoria Campus'),
    note: 'For residence students (p. 12): "Arcadia to Pretoria Campus", "Legae Residence to Pretoria Campus", "Monitor Residence to Pretoria Campus". Non-residence students register for bus transport "at various Transport Offices" (not located in the source); a levy is debited from the student account.',
  },

  // Soshanguve South Campus: IT, computer science, law, policing.
  {
    sourceUrl: `${LIBRARIES}88-soshanguve-south-library.html`,
    academicYear: 2026,
    id: 'tut-soshanguve-south-library',
    campusId: 'tut-soshanguve-south',
    kind: 'library',
    name: 'Soshanguve South Library',
    where: 'Building 6, ground and first floor',
    location: { query: 'Soshanguve South Library, 2 Aubrey Matlala Road, Block K, Soshanguve' },
    note: `Published as "situated at 2 Aubrey Matlala Road, Block K Soshanguve, in the building 6 occupies ground and first floor". The page shows no year (it lists the 2026 DHET journals). ${LIBRARY_HOURS}`,
  },
  {
    ...GENERAL_INFO_2027,
    id: 'tut-soshanguve-south-clinic',
    campusId: 'tut-soshanguve-south',
    kind: 'clinic',
    name: 'Directorate of Health and Wellness',
    where: 'Soshanguve Campus',
    phone: '012 3829184',
    location: at('Soshanguve South Campus'),
    note: `Published for "Soshanguve", without saying South or North. ${HEALTH_P13('"Soshanguve Campus … (Senior Practitioner)", Tel 012 382 9243, Building 21 Room 101')}`,
  },
  {
    ...GENERAL_INFO_2027,
    id: 'tut-soshanguve-south-financial-aid',
    campusId: 'tut-soshanguve-south',
    kind: 'financial-aid',
    name: 'Financial Aid',
    where: 'Soshanguve South Campus',
    phone: '012 382 9272',
    location: at('Soshanguve South Campus'),
    note: FINAID_NOTE('finaidsoshs@tut.ac.za'),
  },
  {
    ...GENERAL_INFO_2027,
    id: 'tut-soshanguve-south-residence-office',
    campusId: 'tut-soshanguve-south',
    kind: 'residence-office',
    name: 'ARLC Residence Accommodation',
    where: 'Soshanguve Campus',
    phone: '012 382 9274',
    location: at('Soshanguve South Campus'),
    note: `${ARLC_NOTE('012 382 9274/9715', 'resadmins@tut.ac.za')} Published for "Soshanguve Campus", without saying South or North.`,
  },
  {
    ...GENERAL_INFO_2027,
    id: 'tut-soshanguve-south-transport',
    campusId: 'tut-soshanguve-south',
    kind: 'transport',
    name: 'Intercampus shuttle service',
    where: 'Soshanguve Campus',
    location: at('Soshanguve South Campus'),
    note: 'For residence students (p. 12), Soshanguve Campus: "Soshanguve South and North residences, including Telkom Residence". Non-residence students register for bus transport "at various Transport Offices" (not located in the source).',
  },

  // Soshanguve North Campus: BEd Foundation Phase.
  {
    ...GENERAL_INFO_2027,
    id: 'tut-soshanguve-north-financial-aid',
    campusId: 'tut-soshanguve-north',
    kind: 'financial-aid',
    name: 'Financial Aid',
    where: 'Soshanguve North Campus',
    phone: '012 382 9895',
    location: at('Soshanguve North Campus'),
    note: FINAID_NOTE('finaidsoshn@tut.ac.za'),
  },

  // Arcadia Campus: BPharm.
  {
    ...GENERAL_INFO_2027,
    id: 'tut-arcadia-financial-aid',
    campusId: 'tut-arcadia',
    kind: 'financial-aid',
    name: 'Financial Aid',
    where: 'Arcadia Campus',
    phone: '012 382 6295',
    location: at('Arcadia Campus'),
    note: FINAID_NOTE('finaidarc@tut.ac.za'),
  },

  // Ga-Rankuwa Campus: accounting, internal auditing.
  {
    ...GENERAL_INFO_2027,
    id: 'tut-ga-rankuwa-clinic',
    campusId: 'tut-ga-rankuwa',
    kind: 'clinic',
    name: 'Directorate of Health and Wellness',
    where: 'Ga-Rankuwa Campus',
    phone: '012 3820572',
    location: at('Ga-Rankuwa Campus'),
    note: HEALTH_P13(
      '"Ga-Rankuwa Campus … (Senior Practitioner)", Tel 012 382 0561, Building 22 Room G11',
    ),
  },
  {
    ...GENERAL_INFO_2027,
    id: 'tut-ga-rankuwa-financial-aid',
    campusId: 'tut-ga-rankuwa',
    kind: 'financial-aid',
    name: 'Financial Aid',
    where: 'Ga-Rankuwa Campus',
    phone: '012 382 0797',
    location: at('Ga-Rankuwa Campus'),
    note: FINAID_NOTE('finaidgar@tut.ac.za'),
  },
  {
    ...GENERAL_INFO_2027,
    id: 'tut-ga-rankuwa-residence-office',
    campusId: 'tut-ga-rankuwa',
    kind: 'residence-office',
    name: 'ARLC Residence Accommodation',
    where: 'Ga-Rankuwa Campus',
    phone: '012 382 0564',
    location: at('Ga-Rankuwa Campus'),
    note: ARLC_NOTE('012 382 0564', 'resadming@tut.ac.za'),
  },

  // eMalahleni Campus: computer science, electrical engineering.
  {
    ...GENERAL_INFO_2027,
    id: 'tut-emalahleni-clinic',
    campusId: 'tut-emalahleni',
    kind: 'clinic',
    name: 'Directorate of Health and Wellness',
    where: 'eMalahleni Campus',
    phone: '012 382 3122',
    location: at('eMalahleni Campus'),
    note: HEALTH_P13(
      '"eMalahleni Campus … (Extracurricular Development Officer)", Tel 012 382 3674, Building 18 Room G35',
    ),
  },
  {
    ...GENERAL_INFO_2027,
    id: 'tut-emalahleni-financial-aid',
    campusId: 'tut-emalahleni',
    kind: 'financial-aid',
    name: 'Financial Aid',
    where: 'eMalahleni Campus',
    phone: '012 382 3121',
    location: at('eMalahleni Campus'),
    note: FINAID_NOTE('finaidema@tut.ac.za'),
  },
  {
    ...GENERAL_INFO_2027,
    id: 'tut-emalahleni-residence-office',
    campusId: 'tut-emalahleni',
    kind: 'residence-office',
    name: 'ARLC Residence Accommodation',
    where: 'eMalahleni Campus',
    phone: '012 382 3193',
    location: at('eMalahleni Campus'),
    note: ARLC_NOTE('012 382 3193', 'resadmine@tut.ac.za'),
  },

  // Mbombela Campus: accounting, internal auditing, marketing, law.
  {
    ...GENERAL_INFO_2027,
    id: 'tut-mbombela-clinic',
    campusId: 'tut-mbombela',
    kind: 'clinic',
    name: 'Directorate of Health and Wellness',
    where: 'Mbombela Campus',
    phone: '012 382 3691',
    location: at('Mbombela Campus'),
    note: HEALTH_P13('"Mbombela Campus", Tel 012 382-3632, Building 1 Room 1-G76'),
  },
  {
    ...GENERAL_INFO_2027,
    id: 'tut-mbombela-financial-aid',
    campusId: 'tut-mbombela',
    kind: 'financial-aid',
    name: 'Financial Aid',
    where: 'Mbombela Campus',
    phone: '012 382 3761',
    location: at('Mbombela Campus'),
    note: FINAID_NOTE('finaidmbom@tut.ac.za'),
  },
  {
    ...GENERAL_INFO_2027,
    id: 'tut-mbombela-residence-office',
    campusId: 'tut-mbombela',
    kind: 'residence-office',
    name: 'ARLC Residence Accommodation',
    where: 'Mbombela Campus',
    phone: '012 382 3615',
    location: at('Mbombela Campus'),
    note: ARLC_NOTE('012 382 3615', 'resadminm@tut.ac.za'),
  },

  // Polokwane Campus: computer science, accounting, internal auditing.
  {
    ...GENERAL_INFO_2027,
    id: 'tut-polokwane-clinic',
    campusId: 'tut-polokwane',
    kind: 'clinic',
    name: 'Directorate of Health and Wellness',
    where: 'Polokwane Campus',
    phone: '012 382 0906',
    location: at('Polokwane Campus'),
    note: HEALTH_P13('"Polokwane Campus … (Administrative Assistant)", Building G255, no phone'),
  },
  {
    ...GENERAL_INFO_2027,
    id: 'tut-polokwane-financial-aid',
    campusId: 'tut-polokwane',
    kind: 'financial-aid',
    name: 'Financial Aid',
    where: 'Polokwane Campus',
    phone: '012 382 0976',
    location: at('Polokwane Campus'),
    note: FINAID_NOTE('finaidpol@tut.ac.za'),
  },
];

/**
 * Each faculty's Assistant Registrar's office as the 2026 faculty prospectus prints it ("At the
 * time of publication"). The faculty web pages list only the Dean's office staff, with no building.
 */
export const tutFacultyOffices: FacultyOffice[] = [
  {
    ...ICT_2026,
    id: 'tut-ict-faculty-office',
    universityId: 'tut',
    faculty: 'Information and Communication Technology',
    campusId: 'tut-soshanguve-south',
    where: 'Assistant Registrar: Building 7G, Room 11, Soshanguve South Campus',
    contactUrl: 'https://www.tut.ac.za/ict/',
  },
  {
    ...FEBE_2026,
    id: 'tut-febe-faculty-office',
    universityId: 'tut',
    faculty: 'Engineering and the Built Environment',
    campusId: 'tut-pretoria',
    where: 'Assistant Registrar: Dinokeng Building, Room G125, Pretoria Campus',
    contactUrl: 'https://www.tut.ac.za/engineering/',
  },
  {
    ...SCIENCE_2026,
    id: 'tut-science-faculty-office',
    universityId: 'tut',
    faculty: 'Science (Health Sciences)',
    campusId: 'tut-arcadia',
    where: 'Assistant Registrar: Building 1, Room G21, Arcadia Campus',
    contactUrl: 'https://www.tut.ac.za/science/',
    phone: '012 382 6248',
  },
  {
    ...ECONOMICS_2026,
    id: 'tut-economics-and-finance-faculty-office',
    universityId: 'tut',
    faculty: 'Economics and Finance',
    campusId: 'tut-ga-rankuwa',
    where: 'Assistant Registrar: Building 1, Room G06B, Ga-Rankuwa Campus',
    contactUrl: 'https://www.tut.ac.za/economics-and-finance/',
  },
  {
    ...HUMANITIES_2026,
    id: 'tut-humanities-faculty-office',
    universityId: 'tut',
    faculty: 'Humanities',
    campusId: 'tut-soshanguve-south',
    where: 'Assistant Registrar: Building 07, Room G14, Soshanguve South Campus',
    contactUrl: 'https://www.tut.ac.za/humanities/',
    phone: '012 382 9037',
  },
  {
    ...MANAGEMENT_2026,
    id: 'tut-management-sciences-faculty-office',
    universityId: 'tut',
    faculty: 'Management Sciences',
    campusId: 'tut-pretoria',
    where: 'Assistant Registrar: Dinokeng Building, Room G119, Pretoria Campus',
    contactUrl: 'https://www.tut.ac.za/management-sciences/',
  },
];

/** One per academic year: first-year registration, change deadlines, orientation week. */
export const tutRegistrationCalendars: RegistrationCalendar[] = [
  {
    sourceUrl:
      'https://www.tut.ac.za/media/tshwane-interim/site-content/documents/2027-Academic-Core-Calendar.pdf',
    academicYear: 2027,
    universityId: 'tut',
    firstYearRegistration: { from: '2027-01-14', to: '2027-01-31' },
    changeDeadlines: [
      { appliesTo: 'S1', lastDay: '2027-02-28' },
      { appliesTo: 'S2', lastDay: '2027-08-06' },
    ],
    orientation: { from: '2027-02-01', to: '2027-02-05' },
    note: 'The 2027 Academic Core Calendar ("Last update: 15 April 2026") gives "14 - 31 January - 2027 Online registration" and "31 January 2027 Closing date for registration"; classes start 1 February. 28 February is the "Closing date for registration corrections/changes and adding of first semester modules"; 6 August the "Closing date for second semester registration corrections/changes and adding of second semester and year modules". No first-semester deadline for year modules is printed. Both exclude specific block-based and research-based M and D programmes. Orientation is "Newcomer students report for orientation"; residence orientation for first-years is 18 January 2027. The calendar marks the NSC results date as awaiting USAf confirmation.',
  },
];
