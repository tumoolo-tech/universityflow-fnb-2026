import type { Campus, FacultyOffice, Place, RegistrationCalendar } from '../campus';

/**
 * University of Cape Town (UCT): campuses, the places on them, faculty offices and the
 * registration calendar (planning.md §11, Phase 5b–5c).
 *
 * Fill these arrays only: the catalogue already reads them, and the catalogue tests validate every
 * record added here. Schemas and field notes: `packages/catalogue/src/campus.ts`.
 * - Every record cites a page on uct.ac.za (or a subdomain) as `sourceUrl`, with the
 *   `academicYear` it was published for. Never add `verifiedOn`/`verifiedBy`: a person does.
 * - Ids start with `uct-`. A place's `campusId` is a campus below; a faculty office's
 *   `faculty` is spelled exactly as this university's programmes spell it (data/uct.ts).
 * - Clinic, counselling and security places are safety records: learners see them only once a
 *   person has verified them.
 * - Leave out what the university doesn't publish. Never guess a number, room, date or hour.
 *
 * DRAFT: researched on 2026-10-16 from UCT's 2026 Handbook 5 (Student Support and Services), its
 * 2026 fees booklet (Handbook 12), and pages on uct.ac.za and the faculty subdomains. Not yet
 * verified by a person (hard rule 3).
 *
 * Phone numbers: the schema takes digits and spaces only. Where UCT prints "021 650-2427" or
 * "+27 (0)21 650 4375", the record holds the same digits as "021 650 2427" or "+27 21 650 4375";
 * a place's `note` quotes the number as printed so the verifier can compare.
 */

/** Handbook 5, Student Support and Services, 2026 (final, 26 Jan 2026). */
const HANDBOOK_5 =
  'https://uct.ac.za/sites/default/files/media/documents/uct-handbook-5-2026-final-26-jan-2026.pdf';
const CAMPUS_MAPS = 'https://uct.ac.za/contacts-maps/campus-maps';
const CAMPUS_SAFETY = 'https://uct.ac.za/staff/campus-safety-overview';
const SWS_SERVICE_POINTS = 'https://uct.ac.za/dsa/sws-service-points';
const LAW_REGISTRATION = 'https://uct.ac.za/students/faculty-law-registration';
const HUMANITIES_REGISTRATION = 'https://uct.ac.za/students/faculty-humanities-registration';
const REGISTRATION = 'https://uct.ac.za/students/registration';
const FEES_BOOKLET =
  'https://uct.ac.za/sites/default/files/media/documents/uct_ac_za/49/2026-fees-booklet.pdf';

const MAP_IMAGES = 'https://uct.ac.za/sites/default/files';

export const uctCampuses: Campus[] = [
  {
    sourceUrl: CAMPUS_MAPS,
    academicYear: 2026,
    id: 'uct-upper-campus',
    universityId: 'uct',
    name: 'Upper Campus',
    city: 'Cape Town',
    mapUrl: `${MAP_IMAGES}/media/images/uct_ac_za/uctuppercampus_0.jpg`,
  },
  {
    sourceUrl: CAMPUS_MAPS,
    academicYear: 2026,
    id: 'uct-middle-campus',
    universityId: 'uct',
    name: 'Middle Campus',
    city: 'Cape Town',
    mapUrl: `${MAP_IMAGES}/content_migration/includes/images/uctmiddlelowercampus.jpg`,
  },
  {
    sourceUrl: CAMPUS_MAPS,
    academicYear: 2026,
    id: 'uct-lower-campus',
    universityId: 'uct',
    name: 'Lower Campus',
    city: 'Cape Town',
    mapUrl: `${MAP_IMAGES}/content_migration/includes/images/uctmiddlelowercampus.jpg`,
  },
  {
    sourceUrl: CAMPUS_MAPS,
    academicYear: 2026,
    id: 'uct-health-sciences-campus',
    universityId: 'uct',
    name: 'Health Sciences Campus',
    city: 'Cape Town',
    mapUrl: `${MAP_IMAGES}/content_migration/includes/images/ucthealthsciencecampus.jpg`,
  },
];

const HB5 = { sourceUrl: HANDBOOK_5, academicYear: 2026 } as const;
const SAFETY = { sourceUrl: CAMPUS_SAFETY, academicYear: 2026 } as const;
const SWS = { sourceUrl: SWS_SERVICE_POINTS, academicYear: 2026 } as const;

const CPS_NOTE =
  'The page prints the 24-hour hotline as "021 650 2222/3"; the emergency contacts page (https://uct.ac.za/students/support-emergencies/emergency-contacts) prints "021 650 2222". 24-hour toll-free number, usable without airtime: 080 650 2222. Medical emergencies are reported to this number too.';

export const uctPlaces: Place[] = [
  // Registration venues (2026 first-year registration, as the faculty registration pages publish).
  {
    sourceUrl: LAW_REGISTRATION,
    academicYear: 2026,
    id: 'uct-law-registration-kramer-lt1',
    campusId: 'uct-middle-campus',
    kind: 'registration-venue',
    name: 'Kramer LT1',
    where: 'LT1 Kramer Building, Middle Campus',
    hours: '09:00-15:00',
    location: { query: 'Kramer Law Building, Middle Campus, University of Cape Town' },
    note: 'First-year Law (all new undergraduate students): orientation 9–13 February 2026 and registration on 12 February 2026, both in LT1 Kramer Building, 09:00-15:00.',
  },
  {
    sourceUrl: HUMANITIES_REGISTRATION,
    academicYear: 2026,
    id: 'uct-humanities-advice-robert-leslie-foyer',
    campusId: 'uct-upper-campus',
    kind: 'registration-venue',
    name: 'Robert Leslie Social Science Foyer',
    where: 'Robert Leslie Social Science Foyer',
    hours: '08:30 – 15:30',
    location: {
      query: 'Robert Leslie Social Science Building, Upper Campus, University of Cape Town',
    },
    note: 'BA/BSocSc first-years who attended Orientation Programme 1: in-person curriculum advice on Fri 30 Jan (08:30 – 15:30) and Mon 2 Feb 2026 (08:30 – 12:00), booked in advance; PeopleSoft hold-lifting at the Southside Lab. The registration page names no campus; Upper Campus is from the campus safety page ("Upper Campus – Robert Leslie Social Sciences Building, University Avenue").',
  },
  {
    sourceUrl: HUMANITIES_REGISTRATION,
    academicYear: 2026,
    id: 'uct-humanities-advice-sarah-baartman-hall',
    campusId: 'uct-upper-campus',
    kind: 'registration-venue',
    name: 'Sarah Baartman Hall',
    where: 'Sarah Baartman Hall',
    hours: '08:30 – 15:30',
    location: { query: 'Sarah Baartman Hall, Upper Campus, University of Cape Town' },
    note: 'BA/BSocSc first-years who attended Orientation Programme 2: in-person curriculum advice Mon 9 – Wed 11 Feb 2026, booked in advance; overflow session Thu 12 Feb by permission only; PeopleSoft hold-lifting at the Beattie Lab. The registration page names no campus; Upper Campus is from Handbook 5 (the Chancellor Oppenheimer Library "forms a U-shape around Sarah Baartman Hall on the Upper Campus").',
  },
  // Libraries and computers.
  {
    ...HB5,
    id: 'uct-chancellor-oppenheimer-library',
    campusId: 'uct-upper-campus',
    kind: 'library',
    name: 'Chancellor Oppenheimer Library Complex',
    where: 'Upper Campus, around Sarah Baartman Hall',
    hours:
      'Term (including the short mid-term vacations): Mon-Sun 24/7 study space. Mid-year and year-end vacations: Mon-Fri 08h30-17h00; Sat 09h00-12h30',
    phone: '021 650 3703',
    location: { query: 'Chancellor Oppenheimer Library, Upper Campus, University of Cape Town' },
    note: 'The main library for Science, Engineering, Commerce and Humanities students. Information Desk printed as "021 650-3703/4"; Loans Desk "021 650-3118/3134". Handbook 5 adds: "Opening hours may vary. Check the website for details."',
  },
  {
    ...HB5,
    id: 'uct-brand-van-zyl-law-library',
    campusId: 'uct-middle-campus',
    kind: 'library',
    name: 'Brand van Zyl Law Library',
    where: 'Wilfred & Jules Kramer Law School, Middle Campus',
    hours:
      'Term-time: Mon-Fri 08h30-17h00; Sat 09h00-17h00. Vacations: Mon-Fri 08h30-17h00; Sat closed',
    phone: '021 650 2708',
    location: { query: 'Kramer Law Building, Middle Campus, University of Cape Town' },
    note: 'Phone printed as "021 650-2708".',
  },
  {
    ...HB5,
    id: 'uct-bongani-mayosi-health-sciences-library',
    campusId: 'uct-health-sciences-campus',
    kind: 'library',
    name: 'Bongani Mayosi Health Sciences Library',
    where: 'Anzio Road, Observatory',
    hours:
      'Term-time: Mon – Thurs 08h30–22h00; Fri 08h30–17h00; Sat 09h00–13h00. Vacations: Mon – Fri 08h30–17h00',
    phone: '021 406 6138',
    location: { query: 'Bongani Mayosi Health Sciences Library, Anzio Road, Observatory' },
    note: 'Phone printed as "021 406-6138". Handbook 5 also lists "Impilo Junction: 24/7 Study Space".',
  },
  {
    ...HB5,
    id: 'uct-vincent-kolbe-knowledge-commons',
    campusId: 'uct-upper-campus',
    kind: 'computer-lab',
    name: 'The Vincent Kolbe Knowledge Commons',
    where: 'At the main entrance to the Chancellor Oppenheimer Library Complex, Upper Campus',
    phone: '021 650 4313',
    location: { query: 'Chancellor Oppenheimer Library, Upper Campus, University of Cape Town' },
    note: 'For undergraduates: 100 computers bookable for several hours a day, plus group study rooms (https://lib.uct.ac.za/services-tools/study-spaces/book). Open during library opening hours. Phone printed as "(021) 650 4313".',
  },
  // Food.
  {
    ...HB5,
    id: 'uct-cissy-gool-food-court',
    campusId: 'uct-upper-campus',
    kind: 'food',
    name: 'Cissy Gool Food Court',
    where: 'Steve Biko Students’ Union, Level 3',
    location: { query: 'Steve Biko Students Union, Upper Campus, University of Cape Town' },
    note: 'Handbook 5 lists it under Upper Campus with: Campus Café (halaal), Budget Rolls (halaal), Varsity Foods (halaal), Prashad Foods (vegan), Dans Health Shop. No prices or hours are published. Spelled "Cissy Gool" here; Handbook 5 spells the plaza "Cissie Gool Plaza" elsewhere.',
  },
  // Health and counselling (safety records).
  {
    ...SWS,
    id: 'uct-sws-ivan-toms-building',
    campusId: 'uct-lower-campus',
    kind: 'clinic',
    name: 'Ivan Toms Building (main SWS service point)',
    where: '28 Rhodes Avenue, Mowbray',
    hours: 'Mon–Fri, 08h30–16h30',
    location: { query: 'Ivan Toms Building, 28 Rhodes Avenue, Mowbray' },
    note: 'Student Wellness Service. "Walk-in services and emergencies"; other services need a confirmed booking. The page lists it under Lower Campus. Kept as `clinic` (A13-04): it is the main SWS service point, the one that takes emergencies, and Handbook 5 gives its health appointments line and "clinic hours"; the service-points page itself doesn\'t use the word "clinic": check. Handbook 5 (2026) prints the health appointments line as "021 650-1020" and clinic hours as "Mon – Wed; 08h30 – 16h30, Thurs 09h30 – 16h30 Fri 08h30 – 16h30" (https://uct.ac.za/sites/default/files/media/documents/uct-handbook-5-2026-final-26-jan-2026.pdf).',
  },
  {
    ...SWS,
    id: 'uct-sws-steve-biko-building',
    campusId: 'uct-upper-campus',
    // `other`, not `clinic` (A13-04): the page calls it an "SWS service point" and doesn't say
    // what it offers (SWS runs counselling, medical and pharmacy services).
    kind: 'other',
    name: 'Steve Biko Building',
    where: 'Level 6, Rooms 6.24, North Lane, Rondebosch',
    hours: 'Mon–Fri, 08h30–16h30',
    location: { query: 'Steve Biko Students Union, Upper Campus, University of Cape Town' },
    note: 'Student Wellness Service service point with "Walk-in services" (re-read on 2026-10-17). A confirmed booking is needed except for high-risk symptoms. The page lists it only as an "SWS service point" and doesn\'t say whether it is a clinic, counselling rooms or both, so it is recorded as `other`, not a safety place: ask SWS what it offers before making it a clinic or counselling record.',
  },
  {
    ...SWS,
    id: 'uct-sws-groote-schuur-hospital',
    campusId: 'uct-health-sciences-campus',
    // `other`, not `clinic` (A13-04): the page lists no services for this SWS service point.
    kind: 'other',
    name: 'Groote Schuur Hospital',
    where: 'Ward G26, Room 21.6, Faculty of Health Sciences, Main Road, Observatory',
    hours: 'Mon–Fri, 08h30–16h30',
    location: { query: 'Groote Schuur Hospital, Main Road, Observatory' },
    note: "Student Wellness Service service point (listed under Health Sciences Campus; re-read on 2026-10-17). A confirmed booking is needed except for high-risk symptoms. The page lists no services for it and doesn't call it a clinic, so it is recorded as `other`, not a safety place: ask SWS what it offers before making it a clinic or counselling record.",
  },
  {
    ...HB5,
    id: 'uct-sws-counselling',
    campusId: 'uct-lower-campus',
    kind: 'counselling',
    name: 'Student Wellness Service (SWS)',
    where: 'Ivan Toms Building, 28 Rhodes Avenue, Mowbray',
    phone: '021 650 1017',
    location: { query: 'Ivan Toms Building, 28 Rhodes Avenue, Mowbray' },
    note: 'Counselling appointments line printed as "021 650-1017 (counselling appointments)". Appointments are booked online (https://uct.ac.za/dsa/sws-appointments); therapists also work from satellite offices across campus. "Fees are R100 per session, but the first session is FREE for All students. Students who are on NSFAS are not charged for the sessions." Lower Campus is from the SWS service points page. After hours, the SWS page (https://uct.ac.za/dsa/student-wellness-services) lists "SWS Crisis Line for Psychiatric Emergencies (after hours): 021 650 1271".',
  },
  // Campus Protection Services (safety records).
  {
    ...SAFETY,
    id: 'uct-cps-upper-campus',
    campusId: 'uct-upper-campus',
    kind: 'security',
    name: 'Campus Protection Services (CPS)',
    where: 'Robert Leslie Social Sciences Building, University Avenue',
    hours: '24 hours a day, seven days a week',
    phone: '021 650 2222',
    location: {
      query: 'Robert Leslie Social Science Building, Upper Campus, University of Cape Town',
    },
    note: CPS_NOTE,
  },
  {
    ...SAFETY,
    id: 'uct-cps-middle-campus',
    campusId: 'uct-middle-campus',
    kind: 'security',
    name: 'Campus Protection Services (CPS)',
    where: 'Kramer Law Building',
    hours: '24 hours a day, seven days a week',
    phone: '021 650 2222',
    location: { query: 'Kramer Law Building, Middle Campus, University of Cape Town' },
    note: CPS_NOTE,
  },
  {
    ...SAFETY,
    id: 'uct-cps-health-sciences-campus',
    campusId: 'uct-health-sciences-campus',
    kind: 'security',
    name: 'Campus Protection Services (CPS)',
    where: 'Barnard Fuller Building',
    hours: '24 hours a day, seven days a week',
    phone: '021 650 2222',
    location: { query: 'Barnard Fuller Building, Anzio Road, Observatory' },
    note: `The page calls this service centre "Medical Campus – Barnard Fuller Building". ${CPS_NOTE}`,
  },
  // Money, disability, housing, transport.
  {
    ...HB5,
    id: 'uct-student-financial-aid',
    campusId: 'uct-middle-campus',
    kind: 'financial-aid',
    name: 'Student Financial Aid',
    where: 'Kramer Building, Level 3',
    phone: '021 650 3545',
    location: { query: 'Kramer Law Building, Middle Campus, University of Cape Town' },
    note: 'Undergraduate funding, including NSFAS and GAP funding. Email FinancialAid@uct.ac.za. Phone printed as "021 650-3545". Handbook 5 gives no campus here; it places the Kramer Building on Middle Campus elsewhere (Fees Office, Admissions).',
  },
  {
    ...HB5,
    id: 'uct-disability-service',
    campusId: 'uct-upper-campus',
    kind: 'disability-unit',
    name: 'Disability Service – Office for Inclusivity & Change',
    where: 'Room 6.03, Level 6, Steve Biko Students’ Union, Upper Campus',
    phone: '021 650 2427',
    location: { query: 'Steve Biko Students Union, Upper Campus, University of Cape Town' },
    note: 'Email disabilityservice@uct.ac.za. Phone printed as "021 650-2427".',
  },
  {
    ...HB5,
    id: 'uct-student-housing-admissions',
    campusId: 'uct-middle-campus',
    kind: 'residence-office',
    name: 'Student Housing Admissions & Advocacy Service (SHAAS)',
    where: 'Level 4, Masingene Building, Middle Campus, Rondebosch',
    phone: '021 650 2977',
    location: { query: 'Masingene Building, Middle Campus, University of Cape Town' },
    note: 'Admission enquiries printed as "021 650-2977"; email res@uct.ac.za. The main Student Housing & Residence Life office is at Avenue House, No 5-9 Avenue Road, Mowbray (same number), which Handbook 5 doesn’t place on a campus.',
  },
  {
    ...HB5,
    id: 'uct-university-transport-services',
    campusId: 'uct-lower-campus',
    kind: 'transport',
    name: 'University Transport Services',
    where: 'Tugwell Terminus, Baxter Road, Rondebosch',
    phone: '021 650 5289',
    location: { query: 'Tugwell Terminus, Baxter Road, Rondebosch' },
    note: 'Runs the free UCT Shuttle for students with a valid student card, seven days a week; timetables at https://uct.ac.za/students/services-transport-parking-uct-shuttle/route-maps-timetables. Phone printed as "021 650-5289". Handbook 5 names no campus for the terminus; Lower Campus is the researcher’s reading (Handbook 5 lists Tugwell Hall at "Lower Campus, Rondebosch"). Check it.',
  },
];

export const uctFacultyOffices: FacultyOffice[] = [
  {
    ...HB5,
    id: 'uct-science-faculty-office',
    universityId: 'uct',
    faculty: 'Science',
    campusId: 'uct-upper-campus',
    where: 'Chris Hani Building, Chemistry Road, Upper Campus',
    contactUrl: 'https://uct.ac.za/general-contacts',
    email: 'sci-science@uct.ac.za',
    phone: '021 650 2712',
  },
  {
    sourceUrl: 'https://ebe.uct.ac.za/contact-us',
    academicYear: 2026,
    id: 'uct-ebe-faculty-office',
    universityId: 'uct',
    faculty: 'Engineering & the Built Environment',
    campusId: 'uct-upper-campus',
    where: '5th level, New Engineering Building, Madiba Circle, Upper Campus',
    contactUrl: 'https://ebe.uct.ac.za/contact-us',
    email: 'ebe-faculty@uct.ac.za',
    phone: '021 650 2699',
  },
  {
    sourceUrl: 'https://health.uct.ac.za/contact-us-0',
    academicYear: 2026,
    id: 'uct-health-sciences-faculty-office',
    universityId: 'uct',
    faculty: 'Health Sciences',
    campusId: 'uct-health-sciences-campus',
    where: 'Faculty Office, Barnard Fuller Building, Anzio Road, Observatory',
    contactUrl: 'https://health.uct.ac.za/contact-us-0',
    email: 'fhs-ug-admiss@uct.ac.za',
    phone: '+27 21 650 3020',
    hours: '08:00–16:30',
  },
  {
    sourceUrl: 'https://commerce.uct.ac.za/contact-us',
    academicYear: 2026,
    id: 'uct-commerce-faculty-office',
    universityId: 'uct',
    faculty: 'Commerce',
    campusId: 'uct-upper-campus',
    where: 'Leslie Commerce Building, Engineering Mall, Upper Campus',
    contactUrl: 'https://commerce.uct.ac.za/contact-us',
    email: 'com.registration@uct.ac.za',
    phone: '+27 21 650 4375',
  },
  {
    sourceUrl: 'https://law.uct.ac.za/general-faculty-contacts',
    academicYear: 2026,
    id: 'uct-law-faculty-office',
    universityId: 'uct',
    faculty: 'Law',
    campusId: 'uct-middle-campus',
    where: 'Faculty Office, Kramer Building, Level 4, Middle Campus',
    contactUrl: 'https://law.uct.ac.za/general-faculty-contacts',
    email: 'law-studies@uct.ac.za',
    phone: '+27 21 650 3086',
  },
  {
    sourceUrl: 'https://humanities.uct.ac.za/contact',
    academicYear: 2026,
    id: 'uct-humanities-faculty-office',
    universityId: 'uct',
    faculty: 'Humanities',
    campusId: 'uct-upper-campus',
    where: 'Room 110 Beattie Building, University Avenue South, Upper Campus',
    contactUrl: 'https://humanities.uct.ac.za/contact',
    email: 'hum-ugrad@uct.ac.za',
    phone: '021 650 2717',
    hours:
      'Mon–Wed and Fri 08:30–12:30, 13:00–16:30; Thu 09:30–12:30, 13:00–16:30; closed weekends and public holidays',
  },
];

/** One per academic year: first-year registration, change deadlines, orientation week. */
export const uctRegistrationCalendars: RegistrationCalendar[] = [
  {
    sourceUrl: REGISTRATION,
    academicYear: 2026,
    universityId: 'uct',
    firstYearRegistration: { from: '2026-01-19', to: '2026-02-13' },
    orientation: { from: '2026-02-02', to: '2026-02-13' },
    changeDeadlines: [
      { appliesTo: 'S1', lastDay: '2026-02-20' },
      { appliesTo: 'Y', lastDay: '2026-02-20' },
      { appliesTo: 'S2', lastDay: '2026-07-31' },
    ],
    note: `Registration window is "Online registration 19 January – 13 February 2026", the page's window for all students ("Registration dates differ across faculties and programmes"). First-year dates per faculty: Health Sciences 26 January (online programme enrolment); EBE 30 January; Commerce 31 January (Cape Town based) and 7 February (out of Cape Town); Humanities BA/BSocSc advice 30 January – 12 February (BSW tasks open 21 January); Science 6 February; Law 12 February. Most faculty pages say all students must be registered by 13 February 2026. First-Year Campus Reception 31 January – 2 February 2026. Change deadlines are the "Last date to add a course" (also the last date to drop with a 100% fee adjustment) from the 2026 fees booklet, ${FEES_BOOKLET}: whole-year and first-semester courses 20 February, second-semester courses 31 July. Courses that don't run for a semester or a year have other deadlines (e.g. the Friday of the course's first week).`,
  },
];
