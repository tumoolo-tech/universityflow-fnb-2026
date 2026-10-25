import type { Campus, FacultyOffice, Place, RegistrationCalendar } from '../campus';

/**
 * University of Pretoria (UP): campuses, the places on them, faculty offices and the
 * registration calendar (planning.md §11, Phase 5b–5c).
 *
 * Fill these arrays only: the catalogue already reads them, and the catalogue tests validate every
 * record added here. Schemas and field notes: `packages/catalogue/src/campus.ts`.
 * - Every record cites a page on up.ac.za (or a subdomain) as `sourceUrl`, with the
 *   `academicYear` it was published for. Never add `verifiedOn`/`verifiedBy`: a person does.
 * - Ids start with `up-`. A place's `campusId` is a campus below; a faculty office's
 *   `faculty` is spelled exactly as this university's programmes spell it (data/up.ts).
 * - Clinic, counselling and security places are safety records: learners see them only once a
 *   person has verified them.
 * - Leave out what the university doesn't publish. Never guess a number, room, date or hour.
 *
 * DRAFT: researched on 2026-10-16. www.up.ac.za refused automated access (Cloudflare, HTTP 403),
 * so every record here comes from two official files that could be opened: UP's 2026 InfoGuide
 * (drupalwebprod-files.up.ac.za, produced by the Department of Enrolment and Student
 * Administration in December 2025) and the amended 2027 academic calendar (linus.up.ac.za).
 * UP prints numbers as "+27 (0)12 420 2500"; the schema doesn't take "(0)" or a second number
 * after a slash, so `phone` drops the "(0)" and keeps the first number, and the printed form is
 * in the note where it differs. Nothing here reaches a learner until a person verifies it.
 */

/** UP's 2026 InfoGuide: campuses, student services, libraries, labs, dining halls, security. */
const INFOGUIDE_2026 =
  'https://drupalwebprod-files.up.ac.za/Public/2025-12/UP_InfoGuide%202026_V5-c.pdf?VersionId=YU5nXdDSjwMxm._3LDBbY1C2tyZoUpvz';
/** UP's academic calendar 2027 (Amended), main dates (S0002/26). */
const CALENDAR_2027 = 'https://linus.up.ac.za/calendars/2027_MAINDATES.pdf';
/** "UP campus maps are available at www.up.ac.za/maps" (InfoGuide 2026, section 14). */
const MAPS = 'https://www.up.ac.za/maps';

const guide = { sourceUrl: INFOGUIDE_2026, academicYear: 2026 } as const;

export const upCampuses: Campus[] = [
  {
    ...guide,
    id: 'up-hatfield',
    universityId: 'up',
    name: 'Hatfield Campus',
    city: 'Pretoria',
    mapUrl: MAPS,
  },
  {
    ...guide,
    id: 'up-groenkloof',
    universityId: 'up',
    name: 'Groenkloof Campus',
    city: 'Pretoria',
    mapUrl: MAPS,
  },
  {
    ...guide,
    id: 'up-prinshof',
    universityId: 'up',
    name: 'Prinshof Campus',
    city: 'Pretoria',
    mapUrl: MAPS,
  },
  {
    ...guide,
    id: 'up-hillcrest',
    universityId: 'up',
    name: 'Hillcrest Campus',
    city: 'Pretoria',
    mapUrl: MAPS,
  },
];

export const upPlaces: Place[] = [
  // Hatfield Campus: Economic and Management Sciences; Engineering, Built Environment and
  // Information Technology; Humanities; Law; Natural and Agricultural Sciences.
  {
    ...guide,
    id: 'up-hatfield-student-health-services',
    campusId: 'up-hatfield',
    kind: 'clinic',
    name: 'Student Health Services',
    where: 'Natural Sciences 2 building, Room 4-11, 4th floor, Hatfield Campus',
    hours: 'Mondays to Fridays 08:00–15:30',
    phone: '+27 12 420 2500',
    location: {
      query: 'Natural Sciences 2 Building, University of Pretoria Hatfield Campus, Pretoria',
    },
    note: "Printed as '+27 (0)12 420 2500'; email info.shs@up.ac.za. 'SHS is located in Natural Sciences 2, Floor 4, while the Hatfield Campus Clinic is being renovated': check it hasn't moved back. 'Walk-in emergencies are also attended to.' Hours are the clinic hours; doctors' consulting hours are shorter.",
  },
  {
    ...guide,
    id: 'up-hatfield-student-counselling-unit',
    campusId: 'up-hatfield',
    kind: 'counselling',
    name: 'Student Counselling Unit (SCU)',
    where: 'Student Centre (opposite TuksFM), Hatfield Campus',
    hours: 'Office hours 07:30–16:00',
    phone: '+27 12 420 2333',
    location: { query: 'Student Centre, University of Pretoria Hatfield Campus, Pretoria' },
    note: "Central Office. Printed as '+27 (0)12 420 2333' (office hours); after hours '+27 (0)12 420 2310/2760'; email studentcounselling@up.ac.za. The 24/7 UP Counselling Careline is printed as '+27 (0)80 074 7747' (pages 26 and 49) and '+27 (0)800 747 747' (page 24), the same digits. The TuksRes Guide 2026 gives 'Monday to Friday – 7:30 to 15:30' for the Student Support Division: the hours conflict.",
  },
  {
    ...guide,
    id: 'up-hatfield-operational-management-centre',
    campusId: 'up-hatfield',
    kind: 'security',
    name: '24-hour Operational Management Centre (Department of Security Services)',
    where: 'Administration Building (eastern entrance), Hatfield Campus',
    hours: '24 hours',
    phone: '+27 12 420 2310',
    location: {
      query: 'Administration Building, University of Pretoria Hatfield Campus, Pretoria',
    },
    note: "Printed as '+27 (0)12 420 2310/2760': the second number is 012 420 2760. 'All medical incidents need to be reported to the above numbers for assistance and activation of an ambulance.' The building comes from the lost-property paragraph (section 13.5). The 24-hour crisis line is printed as '+27 (0)80 000 6428 (toll-free)' (pages 6 and 49) and '+27 (0)800 006 428' (page 24), the same digits. Green Route escorts run 18:00–06:00 from any entrance gate.",
  },
  {
    ...guide,
    id: 'up-merensky-2-library',
    campusId: 'up-hatfield',
    kind: 'library',
    name: 'Merensky 2 Library',
    where: 'Department of Library Services, Lynnwood Road, Hatfield',
    phone: '+27 12 420 2235',
    location: { query: 'Merensky 2 Library, University of Pretoria Hatfield Campus, Pretoria' },
    note: "Printed as '+27 (0)12 420 2235/6'; email library.enquiries@up.ac.za. The InfoGuide lists Merensky 2 among the '24/7 study areas'. Library hours are published on up-za.libcal.com, not on up.ac.za, so they are left out.",
  },
  {
    ...guide,
    id: 'up-hatfield-open-lab',
    campusId: 'up-hatfield',
    kind: 'computer-lab',
    name: 'Open Lab',
    where: 'IT Building, Hatfield Campus',
    location: { query: 'IT Building, University of Pretoria Hatfield Campus, Pretoria' },
    note: "'Computer facility offering open access to any registered UP student'.",
  },
  {
    ...guide,
    id: 'up-hatfield-informatorium',
    campusId: 'up-hatfield',
    kind: 'computer-lab',
    name: 'Informatorium',
    where: 'IT Building, Hatfield Campus',
    location: { query: 'IT Building, University of Pretoria Hatfield Campus, Pretoria' },
    note: "'Classroom computer access and software support for students from the School of IT and the Department of Statistics'.",
  },
  {
    ...guide,
    id: 'up-hatfield-aim-labs',
    campusId: 'up-hatfield',
    kind: 'computer-lab',
    name: 'AIM Labs',
    where: 'Technical Services Building, Hatfield Campus',
    location: {
      query: 'Technical Services Building, University of Pretoria Hatfield Campus, Pretoria',
    },
    note: "'Support for students enrolled in AIM'. AIM 111 and AIM 121 are 'compulsory for all new first-year students, except for those in the School of Engineering'.",
  },
  {
    ...guide,
    id: 'up-hatfield-engineering-labs',
    campusId: 'up-hatfield',
    kind: 'computer-lab',
    name: 'Engineering Labs',
    where: 'Natural Sciences Building II, Hatfield Campus',
    location: {
      query: 'Natural Sciences 2 Building, University of Pretoria Hatfield Campus, Pretoria',
    },
    note: "'Classroom computer access for engineering students'.",
  },
  {
    ...guide,
    id: 'up-monastery-hall',
    campusId: 'up-hatfield',
    kind: 'food',
    name: 'Monastery Hall',
    where: 'Next to the UP Chapel, Hatfield Campus',
    location: { query: 'Monastery Hall, University of Pretoria Hatfield Campus, Pretoria' },
    note: 'A dining hall day students (non-residence students) may use. Meals are booked and paid with the student card after paying in by EFT or at the cashiers in the Student Service Centre (+27 (0)12 420 3111, ssc@up.ac.za). No prices or hours are published in the InfoGuide.',
  },
  {
    ...guide,
    id: 'up-access-disability-inclusion-services',
    campusId: 'up-hatfield',
    kind: 'disability-unit',
    name: 'Access, Disability and Inclusion Services (ADIS)',
    where: 'Old Chemistry Building, Hatfield Campus',
    phone: '+27 12 420 2064',
    location: { query: 'Old Chemistry Building, University of Pretoria Hatfield Campus, Pretoria' },
    note: "Printed as '+27 (012) 420 2064' with 'du@up.ac.za' (InfoGuide 2026, section 7.3). The TuksRes Guide 2026 lists ADIS at 012 420 4281 with the same email: the numbers conflict. The Student Development and Disability Unit itself is 'located in Natural Sciences 2, Floor 4 on Hatfield Campus, while the Student Affairs building is being renovated' (+27 (0)12 420 2370).",
  },
  {
    ...guide,
    id: 'up-student-service-centre',
    campusId: 'up-hatfield',
    kind: 'other',
    name: 'Student Service Centre',
    where: 'cnr Lynnwood Road and Roper Street, Hatfield',
    phone: '+27 12 420 3111',
    location: {
      query: 'Student Service Centre, University of Pretoria, Lynnwood Road, Hatfield, Pretoria',
    },
    note: "Printed as '+27 (0)12 420 3111'; email ssc@up.ac.za. The Student Accounts Division (fees, bursary confirmation letters, meal payments) is here. The InfoGuide publishes no walk-in financial aid office: UP financial aid is applied for on the UP Student Portal.",
  },
  {
    ...guide,
    id: 'up-hillcrest-park-and-ride',
    campusId: 'up-hillcrest',
    kind: 'transport',
    name: 'PR01—Hillcrest Campus Park-and-Ride',
    where: 'Hillcrest Campus',
    phone: '+27 12 420 2530',
    location: { query: 'University of Pretoria Hillcrest Campus, Pretoria' },
    note: "Printed as '+27 (0)12 420 2530/3900' (UP bus services). 'A park-and-ride commuter service between the Hillcrest Campus, Groenkloof Campus and Hatfield Campus is available for use by students.' UP buses are free for registered students; timetables are on clickUP.",
  },

  // Groenkloof Campus: Faculty of Education.
  {
    ...guide,
    id: 'up-groenkloof-student-health-services',
    campusId: 'up-groenkloof',
    kind: 'clinic',
    name: 'Student Health Services',
    where: 'Room 2-10, 2nd floor, Letlotlo Building, Groenkloof Campus',
    hours: 'Mondays, Tuesdays, Wednesdays and Fridays 08:00–15:30',
    phone: '+27 12 420 5233',
    location: { query: 'Letlotlo Building, University of Pretoria Groenkloof Campus, Pretoria' },
    note: "Printed as '+27 (0)12 420 5233'; the table also prints '+27 (0)12 420 3423' for this campus, and it isn't clear which is the clinic's. Doctor's consulting hours: Tuesdays 8:00–10:00.",
  },
  {
    ...guide,
    id: 'up-groenkloof-student-counselling-unit',
    campusId: 'up-groenkloof',
    kind: 'counselling',
    name: 'Student Counselling Unit (SCU), Groenkloof Campus',
    where: 'Letlotlo Building 1-28',
    phone: '+27 12 420 6240',
    location: { query: 'Letlotlo Building, University of Pretoria Groenkloof Campus, Pretoria' },
    note: "Printed as '+27 (0)12 420 6240'. The InfoGuide prints Groenkloof and Mamelodi side by side; this room and number are read from the Groenkloof column: check the layout.",
  },
  {
    ...guide,
    id: 'up-education-library',
    campusId: 'up-groenkloof',
    kind: 'library',
    name: 'Education Library',
    where: 'Media Centre Building, Cnr George Storrar Drive and Leyds Street, Groenkloof',
    phone: '+27 12 420 5536',
    location: {
      query: 'Media Centre Building, University of Pretoria Groenkloof Campus, Pretoria',
    },
    note: "Printed as '+27 (0)12 420 5536'. One of the '24/7 study areas'. Hours are published on up-za.libcal.com, not on up.ac.za.",
  },
  {
    ...guide,
    id: 'up-groenkloof-it-labs',
    campusId: 'up-groenkloof',
    kind: 'computer-lab',
    name: 'Groenkloof IT Labs',
    where: 'Aldoel Building, Groenkloof Campus',
    location: { query: 'Aldoel Building, University of Pretoria Groenkloof Campus, Pretoria' },
    note: "'IT facilities and software support for students studying at Groenkloof Campus'.",
  },

  // Prinshof Campus: Faculty of Health Sciences.
  {
    ...guide,
    id: 'up-prinshof-student-health-services',
    campusId: 'up-prinshof',
    kind: 'clinic',
    name: 'Student Health Services',
    where: 'Room 3-8, Tšwelopele Building, Prinshof Campus',
    hours: 'Tuesdays, Wednesdays, Thursdays and Fridays 08:00–15:30',
    phone: '+27 12 319 3051',
    location: { query: 'Tswelopele Building, University of Pretoria Prinshof Campus, Pretoria' },
    note: "Printed as '+27 (0)12 319 3051/3052'. Doctor's consulting hours: Wednesdays 12:00–14:00.",
  },
  {
    ...guide,
    id: 'up-prinshof-student-counselling-unit',
    campusId: 'up-prinshof',
    kind: 'counselling',
    name: 'Student Counselling Unit (SCU), Prinshof Campus',
    where: 'Tšwelopele Building 3-12',
    phone: '+27 12 319 3054',
    location: { query: 'Tswelopele Building, University of Pretoria Prinshof Campus, Pretoria' },
    note: "Printed as '+27 (0)12 319 3054'. The InfoGuide prints Onderstepoort and Prinshof side by side; this room and number are read from the Prinshof column: check the layout.",
  },
  {
    ...guide,
    id: 'up-medical-library',
    campusId: 'up-prinshof',
    kind: 'library',
    name: 'Medical Library',
    where: 'HW Snyman Building, 31 Bophelo Road, Gezina',
    phone: '+27 12 356 3190',
    location: { query: 'HW Snyman Building, University of Pretoria Prinshof Campus, Pretoria' },
    note: "Printed as '+27 (0)12 356 3190'; the InfoGuide prints the building as 'HW Synman Building Building' here and 'HW Snyman Building' elsewhere. One of the '24/7 study areas'.",
  },
  {
    ...guide,
    id: 'up-prinshof-it-labs',
    campusId: 'up-prinshof',
    kind: 'computer-lab',
    name: 'Medical Sciences IT Labs',
    where: 'HW Snyman Building, Prinshof Campus',
    location: { query: 'HW Snyman Building, University of Pretoria Prinshof Campus, Pretoria' },
    note: "'IT facilities and software support for students studying at Prinshof Campus'.",
  },
];

/**
 * The faculties' Student Administration offices (InfoGuide 2026, section 1.2). The faculties' own
 * contact pages are on www.up.ac.za, which refused automated access, so `contactUrl` is the
 * InfoGuide page that publishes them: replace it with each faculty's page when verifying. The
 * InfoGuide gives no phone numbers or hours for these offices.
 */
export const upFacultyOffices: FacultyOffice[] = [
  {
    ...guide,
    id: 'up-ems-student-administration',
    universityId: 'up',
    faculty: 'Economic and Management Sciences',
    campusId: 'up-hatfield',
    where: 'Room 1-12, Economic and Management Sciences Building, Hatfield Campus',
    contactUrl: INFOGUIDE_2026,
    email: 'ems@up.ac.za',
  },
  {
    ...guide,
    id: 'up-education-student-administration',
    universityId: 'up',
    faculty: 'Education',
    campusId: 'up-groenkloof',
    where: 'Administration Building, Groenkloof Campus',
    contactUrl: INFOGUIDE_2026,
    email: 'ssc@up.ac.za',
  },
  {
    ...guide,
    id: 'up-ebit-student-administration',
    universityId: 'up',
    faculty: 'Engineering, Built Environment and Information Technology',
    campusId: 'up-hatfield',
    where: '6th floor, Engineering Building 1, Hatfield Campus',
    contactUrl: INFOGUIDE_2026,
    email: 'ebit@up.ac.za',
  },
  {
    ...guide,
    id: 'up-health-sciences-student-administration',
    universityId: 'up',
    faculty: 'Health Sciences',
    campusId: 'up-prinshof',
    where: 'Room 3-54, Student Administration Centre, Tšwelopele Building, Prinshof Campus',
    contactUrl: INFOGUIDE_2026,
    email: 'healthsciences@up.ac.za',
  },
  {
    ...guide,
    id: 'up-humanities-student-administration',
    universityId: 'up',
    faculty: 'Humanities',
    campusId: 'up-hatfield',
    where: 'Room 2-9, IT Building, Hatfield Campus',
    contactUrl: INFOGUIDE_2026,
    email: 'hum-student-admin@up.ac.za',
  },
  {
    ...guide,
    id: 'up-law-student-administration',
    universityId: 'up',
    faculty: 'Law',
    campusId: 'up-hatfield',
    where: 'Room 1-56, Law Building, Hatfield Campus',
    contactUrl: INFOGUIDE_2026,
    email: 'kgolane.makua@up.ac.za',
  },
  {
    ...guide,
    id: 'up-nas-student-administration',
    universityId: 'up',
    faculty: 'Natural and Agricultural Sciences',
    campusId: 'up-hatfield',
    where: 'Ground floor, Agricultural Sciences Building, Hatfield Campus',
    contactUrl: INFOGUIDE_2026,
    email: 'nas.undergradhelp@up.ac.za',
  },
];

/** One per academic year: first-year registration, change deadlines, orientation week. */
export const upRegistrationCalendars: RegistrationCalendar[] = [
  {
    sourceUrl: CALENDAR_2027,
    academicYear: 2027,
    universityId: 'up',
    firstYearRegistration: { to: '2027-01-30' },
    changeDeadlines: [
      { appliesTo: 'S1', lastDay: '2027-02-19' },
      { appliesTo: 'Q1', lastDay: '2027-02-19' },
      { appliesTo: 'Q2', lastDay: '2027-02-19' },
      { appliesTo: 'S2', lastDay: '2027-07-30' },
      { appliesTo: 'Q3', lastDay: '2027-07-30' },
      { appliesTo: 'Q4', lastDay: '2027-07-30' },
    ],
    orientation: { from: '2027-02-01', to: '2027-02-05' },
    note: "The 2027 calendar does NOT say when first-year registration opens, so `from` is left out. It gives 4 January as 'Start of the academic year' and 'Start of online registration for senior students', and 30 January as 'Closing date for registration: New first-year students' (also Welcome Day). Find the 2027 first-year opening date on up.ac.za/registration before verifying (for 2026 the InfoGuide said online registration for first-years opened 19 January, and the EMS orientation programme said 21 January). Change deadlines are the calendar's 'Last day of registration' for Q1, Q2 and S1 (19 February) and for Q3, Q4 and S2 (30 July); none is given for year modules. Reading 'last day of registration' as the last day to add, drop or change modules is an interpretation (A13-08): UP doesn't say so in those words, and it errs early. Verifier: confirm it with UP, or use the amendment dates below. Separately, 8 March (first half) and 16 August (second half) are the 'Closing date: Amendments to or cancellation of modules (year, semester and quarter modules) after this date will affect fees and GPA'. Orientation is 'Orientation for First-year students (Hatfield & Groenkloof)'; lectures start 8 February.",
  },
];
