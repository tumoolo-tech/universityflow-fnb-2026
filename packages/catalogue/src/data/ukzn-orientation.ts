import type { Campus, FacultyOffice, Place, RegistrationCalendar } from '../campus';

/**
 * University of KwaZulu-Natal (UKZN): campuses, the places on them, faculty offices and the
 * registration calendar (planning.md §11, Phase 5b–5c).
 *
 * Fill these arrays only: the catalogue already reads them, and the catalogue tests validate every
 * record added here. Schemas and field notes: `packages/catalogue/src/campus.ts`.
 * - Every record cites a page on ukzn.ac.za (or a subdomain) as `sourceUrl`, with the
 *   `academicYear` it was published for. Never add `verifiedOn`/`verifiedBy`: a person does.
 * - Ids start with `ukzn-`. A place's `campusId` is a campus below; a faculty office's
 *   `faculty` is spelled exactly as this university's programmes spell it (data/ukzn.ts).
 * - Clinic, counselling and security places are safety records: learners see them only once a
 *   person has verified them.
 * - Leave out what the university doesn't publish. Never guess a number, room, date or hour.
 *
 * DRAFT: researched from UKZN's own pages on 2026-10-16. Undated web pages carry the year they
 * were read (2026). Not yet verified by a person (hard rule 3).
 */

const CAES_CAMPUSES = 'https://caes.ukzn.ac.za/campuses/';
const DIRECTIONS = 'https://ukzn.ac.za/about-ukzn/directions-to-campuses/';
const RMS = 'https://rms.ukzn.ac.za/';
const COH_BASICS =
  'https://ww2.coh.ukzn.ac.za/orientation-for-first-year-students/some-important-basics/';
const COH_CONTACTS =
  'https://ww2.coh.ukzn.ac.za/orientation-for-first-year-students/important-contact-numbers/';
const CLINICS = 'https://chs.ukzn.ac.za/campus-health-clinics/';
const COH_SUPPORT = 'https://coh.ukzn.ac.za/college-office/student-support-services/contact-us/';
const CLMS_SUPPORT = 'https://ww2.clms.ukzn.ac.za/student-support-services/';
const STUDENT_FUNDING = 'https://studentfunding.ukzn.ac.za/contact-us/';
const DSU = 'https://dsu.ukzn.ac.za/contact-us-2/';
const SHUTTLE = 'https://ukzn.ac.za/shuttle-timetable/';
const Y2026 = { academicYear: 2026 } as const;

const HOWARD = 'ukzn-howard-college';
const WESTVILLE = 'ukzn-westville';
const PMB = 'ukzn-pietermaritzburg';
const EDGEWOOD = 'ukzn-edgewood';
const MEDICAL = 'ukzn-medical-school';

export const ukznCampuses: Campus[] = [
  {
    ...Y2026,
    sourceUrl: CAES_CAMPUSES,
    id: HOWARD,
    universityId: 'ukzn',
    name: 'Howard College',
    city: 'Durban',
    mapUrl: 'https://caes.ukzn.ac.za/wp-content/uploads/2019/07/Howard-College-map.pdf',
    // The page links http://virtualtours.ukzn.ac.za/ukzn-howard/; the same tour answers on https.
    virtualTourUrl: 'https://virtualtours.ukzn.ac.za/ukzn-howard/',
  },
  {
    ...Y2026,
    sourceUrl: CAES_CAMPUSES,
    id: WESTVILLE,
    universityId: 'ukzn',
    name: 'Westville Campus',
    city: 'Durban',
    mapUrl: 'https://caes.ukzn.ac.za/wp-content/uploads/2019/07/Westville-campus-map.pdf',
    virtualTourUrl: 'https://virtualtours.ukzn.ac.za/ukzn-westville/',
  },
  {
    ...Y2026,
    sourceUrl: CAES_CAMPUSES,
    id: PMB,
    universityId: 'ukzn',
    // The Main Campus (King Edward Avenue). UKZN also lists Agriculture and Golf Road campuses in
    // Pietermaritzburg; the Main Campus map and tour are used here.
    name: 'Pietermaritzburg Campus',
    city: 'Pietermaritzburg',
    mapUrl: 'https://caes.ukzn.ac.za/wp-content/uploads/2021/03/PMB-Main-campus-map.pdf',
    virtualTourUrl: 'https://virtualtours.ukzn.ac.za/ukzn-main/',
  },
  {
    ...Y2026,
    sourceUrl: DIRECTIONS,
    id: EDGEWOOD,
    universityId: 'ukzn',
    name: 'Edgewood',
    city: 'Pinetown',
  },
  {
    ...Y2026,
    sourceUrl: DIRECTIONS,
    id: MEDICAL,
    universityId: 'ukzn',
    name: 'Medical School',
    city: 'Durban',
  },
];

const RMS_NAME = 'Risk Management Services (RMS) Security Control Room';
const RMS_WHERE =
  'RMS publishes control-room numbers per campus but not the control room’s building.';
const FUNDING_NAME = 'Department of Student Funding: Financial Aid Advisors';
const COH_SSS = 'College of Humanities Student Support Services';
const CLMS_SSS = 'College of Law and Management Studies Student Support Services';
const collegeOnly = (college: string) =>
  `Student support (counselling) at UKZN is run per college: this office is for ${college} students.`;
/**
 * A13-11 (owner's decision, 2026-10-17): the Campus Health Services page lists clinic staff per
 * campus, not a clinic line; the administrator's line is recorded as the clinic's phone. The page
 * was re-read on 2026-10-17 and prints no clinic building, location or hours.
 */
const adminLine = (heading: string) =>
  `The phone is the clinic administrator's line as listed under "${heading}" in the "STAFF CONTACT DETAILS" table on ${CLINICS} (owner's decision on A13-11).`;
const SHUTTLE_TIMES =
  'Second Semester 2026 timetable: departures 07h00, 08h00, 10h00, 12h00, 14h30, 17h00, 18h30, 21h00 from each end. Student or staff card required to board. Recheck the timetable each semester.';

export const ukznPlaces: Place[] = [
  // Howard College
  {
    ...Y2026,
    sourceUrl: 'https://library.ukzn.ac.za/howard-college-libraries/',
    id: 'ukzn-hc-eg-malherbe-library',
    campusId: HOWARD,
    kind: 'library',
    name: 'EG Malherbe Library',
    where: 'Near the Student’s Union and Business Concourse',
    phone: '+27 31 260 2323',
    location: { query: 'EG Malherbe Library, Howard College Campus, UKZN, Durban' },
    note: 'Phone printed as "+27-31-260 2323 /2322". The library hours page carries 2019–2021 notices, so no hours are recorded.',
  },
  {
    ...Y2026,
    sourceUrl: COH_BASICS,
    id: 'ukzn-hc-campus-health-clinic',
    campusId: HOWARD,
    kind: 'clinic',
    name: 'Campus Health Clinic',
    where: 'Opposite the main library',
    phone: '031 260 3285',
    phoneSourceUrl: CLINICS,
    location: { query: 'Campus Health Clinic, Howard College Campus, UKZN, Durban' },
    note: `No phone on the cited page. ${adminLine('HOWARD CAMPUS')} ${COH_CONTACTS} lists 031 260 3284/3285.`,
  },
  {
    ...Y2026,
    sourceUrl: RMS,
    id: 'ukzn-hc-rms-control-room',
    campusId: HOWARD,
    kind: 'security',
    name: RMS_NAME,
    where: 'Howard College Campus',
    phone: '031 260 2540',
    location: { query: 'Howard College Campus, UKZN, Mazisi Kunene Road, Glenwood, Durban' },
    note: `Second control-room line: 031 260 2542. ${RMS_WHERE} CONFLICT: ${COH_BASICS} gives the Howard College RMS emergency number as 031 260 3777; the RMS site's own number is recorded here.`,
  },
  {
    ...Y2026,
    sourceUrl: COH_SUPPORT,
    id: 'ukzn-hc-coh-student-support',
    campusId: HOWARD,
    kind: 'counselling',
    name: COH_SSS,
    where: 'Old Student Counselling & Careers Building (next to Francis Stock)',
    phone: '031 260 2668',
    location: { query: 'Francis Stock Building, Howard College Campus, UKZN, Durban' },
    note: collegeOnly('College of Humanities'),
  },
  {
    ...Y2026,
    sourceUrl: CLMS_SUPPORT,
    id: 'ukzn-hc-clms-student-support',
    campusId: HOWARD,
    kind: 'counselling',
    name: CLMS_SSS,
    where: 'Shepstone Level 5, C504 & C507',
    hours: '08h00 to 16h30',
    phone: '+27 31 260 7337',
    location: { query: 'Shepstone Building, Howard College Campus, UKZN, Durban' },
    note: `${collegeOnly('College of Law and Management Studies')} The page gives hours without days.`,
  },
  {
    ...Y2026,
    sourceUrl: STUDENT_FUNDING,
    id: 'ukzn-hc-student-funding',
    campusId: HOWARD,
    kind: 'financial-aid',
    name: FUNDING_NAME,
    where: 'Shepstone Building – Level 4',
    location: { query: 'Shepstone Building, Howard College Campus, UKZN, Durban' },
    note: 'The page lists advisors by name and extension only; no office line.',
  },
  {
    ...Y2026,
    sourceUrl: DSU,
    id: 'ukzn-hc-disability-support-unit',
    campusId: HOWARD,
    kind: 'disability-unit',
    name: 'Disability Support Unit',
    where: 'Shepstone Building level 5',
    location: { query: 'Shepstone Building, Howard College Campus, UKZN, Durban' },
    note: 'The page lists staff numbers only; no unit line recorded.',
  },
  {
    ...Y2026,
    sourceUrl: SHUTTLE,
    id: 'ukzn-hc-intercampus-shuttle',
    campusId: HOWARD,
    kind: 'transport',
    name: 'Intercampus shuttle to Westville',
    where: 'Gate 8, Howard College Campus',
    hours: 'Weekdays in term time (excluding public holidays) 07h00–21h00',
    location: { query: 'Gate 8, Howard College Campus, UKZN, Durban' },
    note: SHUTTLE_TIMES,
  },

  // Westville
  {
    ...Y2026,
    sourceUrl: 'https://library.ukzn.ac.za/westville-libraries/',
    id: 'ukzn-wv-main-library',
    campusId: WESTVILLE,
    kind: 'library',
    name: 'Main Library',
    where: 'B Block, near the Quad',
    phone: '+27 31 260 8058',
    location: { query: 'B Block, Westville Campus, UKZN, University Road, Westville' },
    note: 'Phone printed as "+27-31-2608058 or +27-31-2607390".',
  },
  {
    ...Y2026,
    sourceUrl: RMS,
    id: 'ukzn-wv-rms-control-room',
    campusId: WESTVILLE,
    kind: 'security',
    name: RMS_NAME,
    where: 'Westville Campus',
    phone: '031 260 7133',
    location: { query: 'Westville Campus, UKZN, University Road, Westville' },
    note: `Second control-room line: 031 260 7265. ${RMS_WHERE}`,
  },
  {
    ...Y2026,
    sourceUrl: CLINICS,
    id: 'ukzn-wv-campus-health-clinic',
    campusId: WESTVILLE,
    kind: 'clinic',
    name: 'Campus Health Clinic',
    phone: '031 260 7302',
    note: `${adminLine('WESTVILLE CAMPUS')} The page (titled "Campus Health Clinics") prints no building, location or hours for the clinic, so none is recorded. ${DSU} places the Disability Support Unit at "E Block Next to the Campus Health Clinic": confirm the clinic's building on site before adding one.`,
  },
  {
    ...Y2026,
    sourceUrl: CLMS_SUPPORT,
    id: 'ukzn-wv-clms-student-support',
    campusId: WESTVILLE,
    kind: 'counselling',
    name: CLMS_SSS,
    where: '3rd Floor, L Block',
    hours: '08h00 to 16h30',
    phone: '+27 31 260 7337',
    location: { query: 'L Block, Westville Campus, UKZN, Westville' },
    note: `${collegeOnly('College of Law and Management Studies')} The page gives hours without days.`,
  },
  {
    ...Y2026,
    sourceUrl: STUDENT_FUNDING,
    id: 'ukzn-wv-student-funding',
    campusId: WESTVILLE,
    kind: 'financial-aid',
    name: FUNDING_NAME,
    where: 'Oliver Tambo Building – 2nd Floor',
    location: { query: 'Oliver Tambo Building, Westville Campus, UKZN, Westville' },
    note: 'The central Student Funding office (help desk, NSFAS) is at "Westville Block D, Level 1, Room 127" on the same page.',
  },
  {
    ...Y2026,
    sourceUrl: DSU,
    id: 'ukzn-wv-disability-support-unit',
    campusId: WESTVILLE,
    kind: 'disability-unit',
    name: 'Disability Support Unit',
    where: 'E Block Next to the Campus Health Clinic',
    location: { query: 'E Block, Westville Campus, UKZN, Westville' },
  },
  {
    ...Y2026,
    sourceUrl: SHUTTLE,
    id: 'ukzn-wv-intercampus-shuttle',
    campusId: WESTVILLE,
    kind: 'transport',
    name: 'Intercampus shuttle to Howard College',
    where: 'Joosub Hall (Main Hall) and the Makhabane bus stop',
    hours: 'Weekdays in term time (excluding public holidays) 07h00–21h00',
    location: { query: 'Joosub Hall, Westville Campus, UKZN, Westville' },
    note: SHUTTLE_TIMES,
  },

  // Pietermaritzburg
  {
    ...Y2026,
    sourceUrl: COH_BASICS,
    id: 'ukzn-pmb-campus-health-clinic',
    campusId: PMB,
    kind: 'clinic',
    name: 'Campus Health Clinic',
    where: 'House 5, Milner Road, main campus',
    phone: '033 260 5208',
    phoneSourceUrl: CLINICS,
    location: { query: '5 Milner Road, Pietermaritzburg Campus, UKZN, Scottsville' },
    note: `No phone on the cited page. ${adminLine('PMB CAMPUS')} ${COH_CONTACTS} lists 033 260 6102/5208.`,
  },
  {
    ...Y2026,
    sourceUrl: RMS,
    id: 'ukzn-pmb-rms-control-room',
    campusId: PMB,
    kind: 'security',
    name: RMS_NAME,
    where: 'Pietermaritzburg Campus',
    phone: '033 260 5211',
    location: { query: 'Pietermaritzburg Campus, UKZN, King Edward Avenue, Scottsville' },
    note: `Second control-room line: 033 260 5231. ${RMS_WHERE} ${COH_BASICS} gives the same 033 260 5211.`,
  },
  {
    ...Y2026,
    sourceUrl: COH_SUPPORT,
    id: 'ukzn-pmb-coh-student-support',
    campusId: PMB,
    kind: 'counselling',
    name: COH_SSS,
    where: 'Milner Road (next to the Clinic)',
    phone: '031 260 5233',
    location: { query: 'Milner Road, Pietermaritzburg Campus, UKZN, Scottsville' },
    note: `${collegeOnly('College of Humanities')} The number is printed with the Durban 031 code although Pietermaritzburg numbers elsewhere use 033: check it.`,
  },
  {
    ...Y2026,
    sourceUrl: CLMS_SUPPORT,
    id: 'ukzn-pmb-clms-student-support',
    campusId: PMB,
    kind: 'counselling',
    name: CLMS_SSS,
    where: 'College office, 1 Golf Road',
    hours: '08h00 to 16h30',
    phone: '+27 31 260 7337',
    location: { query: '1 Golf Road, Scottsville, Pietermaritzburg' },
    note: `${collegeOnly('College of Law and Management Studies')} UKZN lists Golf Road as its own Pietermaritzburg campus. The page gives hours without days.`,
  },
  {
    ...Y2026,
    sourceUrl: STUDENT_FUNDING,
    id: 'ukzn-pmb-student-funding',
    campusId: PMB,
    kind: 'financial-aid',
    name: FUNDING_NAME,
    where: 'No. 5 Milner Road',
    location: { query: '5 Milner Road, Pietermaritzburg Campus, UKZN, Scottsville' },
    note: 'The clinic is published at "House 5, Milner Road" too: check whether they share the building.',
  },
  {
    ...Y2026,
    sourceUrl: DSU,
    id: 'ukzn-pmb-disability-support-unit',
    campusId: PMB,
    kind: 'disability-unit',
    name: 'Disability Support Unit',
    where: 'Main Campus 2 Milner Road Next to Finance',
    location: { query: '2 Milner Road, Pietermaritzburg Campus, UKZN, Scottsville' },
  },

  // Edgewood
  {
    ...Y2026,
    sourceUrl: COH_BASICS,
    id: 'ukzn-ew-campus-health-clinic',
    campusId: EDGEWOOD,
    kind: 'clinic',
    name: 'Campus Health Clinic',
    where: 'Dining Hall',
    phone: '031 260 3252',
    phoneSourceUrl: CLINICS,
    location: { query: 'Edgewood Campus, UKZN, Marianhill Road, Pinetown' },
    note: `No phone on the cited page. ${adminLine('EDGEWOOD CAMPUS')} ${COH_CONTACTS} lists the same 031 260 3252.`,
  },
  {
    ...Y2026,
    sourceUrl: RMS,
    id: 'ukzn-ew-rms-control-room',
    campusId: EDGEWOOD,
    kind: 'security',
    name: RMS_NAME,
    where: 'Edgewood Campus',
    phone: '031 260 3462',
    location: { query: 'Edgewood Campus, UKZN, Marianhill Road, Pinetown' },
    note: `Second control-room line: 031 260 3493 (the number ${COH_BASICS} gives). ${RMS_WHERE}`,
  },
  {
    ...Y2026,
    sourceUrl: COH_SUPPORT,
    id: 'ukzn-ew-coh-student-support',
    campusId: EDGEWOOD,
    kind: 'counselling',
    name: COH_SSS,
    where: 'Dining Hall',
    phone: '031 260 3653',
    location: { query: 'Edgewood Campus, UKZN, Marianhill Road, Pinetown' },
    note: collegeOnly('College of Humanities'),
  },
  {
    ...Y2026,
    sourceUrl: STUDENT_FUNDING,
    id: 'ukzn-ew-student-funding',
    campusId: EDGEWOOD,
    kind: 'financial-aid',
    name: FUNDING_NAME,
    where: 'Admin Building – Next to RMS',
    location: { query: 'Edgewood Campus, UKZN, Marianhill Road, Pinetown' },
  },
  {
    ...Y2026,
    sourceUrl: DSU,
    id: 'ukzn-ew-disability-support-unit',
    campusId: EDGEWOOD,
    kind: 'disability-unit',
    name: 'Disability Support Unit',
    where: 'New Conference Building –below the Dining Hall',
    location: { query: 'Edgewood Campus, UKZN, Marianhill Road, Pinetown' },
  },

  // Medical School
  {
    ...Y2026,
    sourceUrl: RMS,
    id: 'ukzn-ms-rms-control-room',
    campusId: MEDICAL,
    kind: 'security',
    name: RMS_NAME,
    where: 'Medical School Campus',
    phone: '031 260 4516',
    location: { query: 'Medical School Campus, UKZN, Umbilo Road, Durban' },
    note: RMS_WHERE,
  },
  {
    ...Y2026,
    sourceUrl: CLINICS,
    id: 'ukzn-ms-campus-health-clinic',
    campusId: MEDICAL,
    kind: 'clinic',
    name: 'Campus Health Clinic',
    phone: '031 260 4506',
    note: `${adminLine('MEDICAL SCHOOL')} The page (titled "Campus Health Clinics") prints no building, location or hours for the clinic, so none is recorded.`,
  },
  {
    ...Y2026,
    sourceUrl: STUDENT_FUNDING,
    id: 'ukzn-ms-student-funding',
    campusId: MEDICAL,
    kind: 'financial-aid',
    name: FUNDING_NAME,
    where: 'Main Building – 2nd Floor',
    location: { query: 'Medical School Campus, UKZN, Umbilo Road, Durban' },
  },
];

/**
 * One office per college (the catalogue finds a programme's office by faculty). Each college also
 * has offices on its other campuses; the Howard College one is recorded where it was published.
 * The College of Agriculture, Engineering and Science publishes no office location (only email
 * addresses per campus), so it has no record yet.
 */
export const ukznFacultyOffices: FacultyOffice[] = [
  {
    ...Y2026,
    sourceUrl:
      'https://ww2.coh.ukzn.ac.za/orientation-for-first-year-students/student-academic-services/',
    id: 'ukzn-humanities-student-academic-services',
    universityId: 'ukzn',
    faculty: 'College of Humanities',
    campusId: HOWARD,
    where: 'MTB Building, Room G056',
    contactUrl: 'https://coh.ukzn.ac.za/college-office/students-academic-services/contact-details/',
    phone: '031 260 1123',
  },
  {
    ...Y2026,
    sourceUrl: 'https://clms.ukzn.ac.za/registration/student-services/',
    id: 'ukzn-clms-college-office',
    universityId: 'ukzn',
    faculty: 'College of Law and Management Studies',
    campusId: HOWARD,
    where: 'College Office, Shepstone Level 5',
    contactUrl: 'https://clms.ukzn.ac.za/registration/college-office/',
  },
  {
    ...Y2026,
    sourceUrl: 'https://ww2.chs.ukzn.ac.za/professionalservices/academicservices/',
    id: 'ukzn-chs-academic-services',
    universityId: 'ukzn',
    faculty: 'College of Health Sciences',
    campusId: HOWARD,
    where: 'Desmond Clarence Building, level 1, Room 4',
    contactUrl: 'https://ww2.chs.ukzn.ac.za/registration-contact-details/',
  },
];

/** One per academic year: first-year registration, change deadlines, orientation week. */
export const ukznRegistrationCalendars: RegistrationCalendar[] = [
  {
    sourceUrl: 'https://registrar.ukzn.ac.za/sessional-dates-2027/',
    academicYear: 2027,
    universityId: 'ukzn',
    // "Fri, 12 Feb — Deadline for first semester academic registration" (A13-03): the close as
    // printed. No opening date for all first-years: the FTEN week below is the dedicated week, and
    // "Schools to communicate dates for individual programmes", so `from` is left out.
    firstYearRegistration: { to: '2027-02-12' },
    // "Dedicated remote online registration week and orientation for First Time Entering
    // Undergraduate (FTEN) students": Mon, 01 – Sat, 06 Feb.
    orientation: { from: '2027-02-01', to: '2027-02-06' },
    changeDeadlines: [
      { appliesTo: 'S1', lastDay: '2027-02-12' },
      { appliesTo: 'S2', lastDay: '2027-07-30' },
    ],
    note: 'Registration closes on "Fri, 12 Feb — Deadline for first semester academic registration" (re-read on 2026-10-17); the same page prints "Mon, 01 – Sat, 06 Feb — Dedicated remote online registration week and orientation for First Time Entering Undergraduate (FTEN) students", recorded as orientation, and no opening date for every first-year. Change deadlines are the "Deadline for submission of curriculum change requests". FTEN registration is remote (online), not at a venue, and "Schools to communicate dates for individual programmes on a per programme basis, including FTEN students". MBChB 1st-year orientation is listed in the same week. 1st–3rd year BEd students have their own semester 2 curriculum change deadline, Fri 20 Aug 2027. Module withdrawal deadlines: Thu 25 Mar (S1) and Fri 03 Sep (S2).',
  },
];
