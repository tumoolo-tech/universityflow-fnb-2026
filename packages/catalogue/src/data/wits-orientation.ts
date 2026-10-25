import type { Campus, FacultyOffice, Place, RegistrationCalendar } from '../campus';

/**
 * University of the Witwatersrand (Wits): campuses, the places on them, faculty offices and the
 * registration calendar (planning.md §11, Phase 5b–5c).
 *
 * Fill these arrays only: the catalogue already reads them, and the catalogue tests validate every
 * record added here. Schemas and field notes: `packages/catalogue/src/campus.ts`.
 * - Every record cites a page on wits.ac.za (or a subdomain) as `sourceUrl`, with the
 *   `academicYear` it was published for. Never add `verifiedOn`/`verifiedBy`: a person does.
 * - Ids start with `wits-`. A place's `campusId` is a campus below; a faculty office's
 *   `faculty` is spelled exactly as this university's programmes spell it (data/wits.ts).
 * - Clinic, counselling and security places are safety records: learners see them only once a
 *   person has verified them.
 * - Leave out what the university doesn't publish. Never guess a number, room, date or hour.
 *
 * DRAFT: researched on 2026-10-16 from wits.ac.za pages and PDFs (the 2026 Undergraduate Student
 * Guide, the 2026 Gateway to Success booklets, the maps, security, campus health, accommodation,
 * financial aid and bus pages). Not yet verified by a person (hard rule 3). Phone numbers are
 * written in dialable form (parentheses and "/" alternatives dropped); every other number printed
 * beside one is in the record's note.
 */

const SITE = 'https://www.wits.ac.za';
/** The 2026 Undergraduate Student Guide (Division of Student Affairs). */
const GUIDE_2026 = `${SITE}/media/wits-university/students/fye/undergraduate-student-guide-2026.pdf`;
/** "Security on campus": 24-hour walk-in points and numbers per campus. */
const SECURITY = `${SITE}/campus-life/security-on-campus/`;
/** Faculty of Health Sciences 2026 Gateway to Success booklet (lists the orientation computer labs). */
const GTS_HS_2026 = `${SITE}/media/wits-university/students/gts/HS-gts-booklet2026.pdf`;
const BUS = `${SITE}/students/wits-bus-service/`;
const BRAAMFONTEIN_MAP = `${SITE}/media/wits-university/about-wits/documents/2025-Braamfontein-Campus-map.pdf`;
const PARKTOWN_MAP = `${SITE}/media/wits-university/about-wits/documents/2025-Parktown-Campus.pdf`;
/** Aerial drone tour and 4K East and West Campus walking tours ("from East to West"). */
const VIRTUAL_TOURS = `${SITE}/alumni/campus-tours/virtual-tours/`;

const YEAR_2026 = { academicYear: 2026 } as const;
const EAST = 'wits-braamfontein-east';
const WEST = 'wits-braamfontein-west';
const EDUCATION = 'wits-education-campus';
const PARKTOWN = 'wits-parktown';

/** "Open in maps" search text: the building as published, then the campus and the city. */
const at = (building: string, campus: string) => ({
  query: `${building}, ${campus}, University of the Witwatersrand, Johannesburg`,
});
const EAST_NAME = 'Braamfontein Campus East';
const WEST_NAME = 'Braamfontein Campus West';
const EDUCATION_NAME = 'Wits Education Campus, Parktown';
const PARKTOWN_NAME = 'Parktown Campus';

export const witsCampuses: Campus[] = [
  {
    ...YEAR_2026,
    sourceUrl: `${SITE}/maps/braamfontein-campus-east-/`,
    id: EAST,
    universityId: 'wits',
    name: 'Braamfontein Campus East',
    city: 'Johannesburg',
    mapUrl: BRAAMFONTEIN_MAP,
    virtualTourUrl: VIRTUAL_TOURS,
  },
  {
    ...YEAR_2026,
    sourceUrl: `${SITE}/maps/braamfontein-campus-west/`,
    id: WEST,
    universityId: 'wits',
    name: 'Braamfontein Campus West',
    city: 'Johannesburg',
    mapUrl: BRAAMFONTEIN_MAP,
    virtualTourUrl: VIRTUAL_TOURS,
  },
  {
    // BEd and parts of the Health Sciences first year (the Khanya Building) are taught here.
    ...YEAR_2026,
    sourceUrl: `${SITE}/maps/education-campus/`,
    id: EDUCATION,
    universityId: 'wits',
    name: 'Education Campus',
    city: 'Johannesburg',
  },
  {
    // The Faculty of Health Sciences (Phillip V Tobias Building) is here.
    ...YEAR_2026,
    sourceUrl: `${SITE}/maps/parktown-campus/`,
    id: PARKTOWN,
    universityId: 'wits',
    name: 'Parktown Campus',
    city: 'Johannesburg',
    mapUrl: PARKTOWN_MAP,
  },
];

export const witsPlaces: Place[] = [
  // ── Braamfontein Campus East (Humanities; most student services) ──────────────────────────
  {
    ...YEAR_2026,
    sourceUrl: `${SITE}/library/hours/`,
    id: 'wits-wartenweiler-library',
    campusId: EAST,
    kind: 'library',
    name: 'Wartenweiler Library',
    where: 'Wartenweiler Library',
    hours: 'Mon–Fri 08:00–17:00; Sat closed; Sun closed',
    location: at('Wartenweiler Library', EAST_NAME),
    note: `The hours page names no campus and no term or vacation variation. East Campus is from ${SITE}/library/interlibrary-loans/ ("First floor of the Wartenweiler Library (East Campus)").`,
  },
  {
    ...YEAR_2026,
    sourceUrl: GTS_HS_2026,
    id: 'wits-sh1101-computer-lab',
    campusId: EAST,
    kind: 'computer-lab',
    name: 'SH1101',
    where: 'SH1101, East Campus',
    location: at('SH1101', EAST_NAME),
    note: 'Listed as a computer laboratory "with tutors available to assist with technical aspects of the online activities" for Gateway to Success 2026. The building is not named, nor whether first-years may use it after orientation, nor its hours.',
  },
  {
    ...YEAR_2026,
    sourceUrl: GUIDE_2026,
    id: 'wits-main-dining-hall',
    campusId: EAST,
    kind: 'food',
    name: 'Main Dining Hall',
    where: 'Main Dining Hall, Braamfontein Campus East',
    phone: '011 717 1795',
    location: at('Main Dining Hall', EAST_NAME),
    note: 'The guide says the Main Dining Hall (East Campus) and Highfield Dining Hall (Education Campus) "are now open to all students and staff for meals paid via card services". No prices or hours are published. The phone is Dining Hall Catering Services.',
  },
  {
    ...YEAR_2026,
    sourceUrl: GUIDE_2026,
    id: 'wits-campus-health-east',
    campusId: EAST,
    kind: 'clinic',
    name: 'Campus Health and Wellness Centre',
    where: 'Students Union Building, lower Ground Floor of the Matrix, Braamfontein Campus East',
    hours: 'Mon–Fri 08:00–16:30; closed weekends and public holidays',
    phone: '011 717 9111',
    location: at('The Matrix, Students Union Building', EAST_NAME),
    note: `Printed as "011 717 9111/9113" (and "011 717 9111/13" for emergencies during office hours); after hours the guide says to report emergencies to Res Wardens (ER24). Appointments are booked 08:00–16:00. ${SITE}/campushealth/where-to-find-us/ gives the same place: "Lower Ground floor of the Student Union Building below the Matrix".`,
  },
  {
    ...YEAR_2026,
    sourceUrl: SECURITY,
    id: 'wits-protection-services-east',
    campusId: EAST,
    kind: 'security',
    name: 'Campus Protection Services',
    where: 'Room 1, Robert Sobukwe Block, East Campus',
    hours: '24 hours',
    phone: '011 717 4444',
    location: at('Robert Sobukwe Block', EAST_NAME),
    note: `Printed "East Campus: (011) 717 4444 / 6666". The 2026 Undergraduate Student Guide prints "011 717 4444/6666 (24 hours service)" and, separately, "011 717 6666 011 717 4444 011 717 2222" without campuses; the 2025 campus maps print 4444 as East and 6666 as West, while this page gives West Campus (011) 717 1842. Recorded as this page has it (the most specific); check.`,
  },
  {
    ...YEAR_2026,
    sourceUrl: `${SITE}/study-at-wits/financial-aid-and-scholarships-administration/contact-us/`,
    id: 'wits-faso',
    campusId: EAST,
    kind: 'financial-aid',
    name: 'Financial Aid and Scholarships Office (FASO)',
    where: 'Solomon Mahlangu House, Ground Floor, Braamfontein Campus East',
    phone: '+27 11 717 1071',
    location: at('Solomon Mahlangu House', EAST_NAME),
    note: `The phone is the "Central Office (Manager)" line; NSFAS liaison lines 27 11 717 1083, 011 717 1084 and 27 11 717 1072 are also printed. ${SITE}/study-at-wits/financial-aid-and-scholarships-administration/ gives walk-in hours "8:00am – 12:00pm" (from Monday, 20 April 2026) and the Student Finance call centre "011 717-1566/69/7579/1582/7181"; FASO answers queries only through ISM (witshelp-ism.saasiteu.com), not by email.`,
  },
  {
    ...YEAR_2026,
    sourceUrl: GUIDE_2026,
    id: 'wits-dru-east',
    campusId: EAST,
    kind: 'disability-unit',
    name: 'Disability Rights Unit (DRU)',
    where: '1st Floor, Solomon Mahlangu House, East Wing, Braamfontein Campus East',
    phone: '011 717 9154',
    location: at('Solomon Mahlangu House, East Wing', EAST_NAME),
    note: `Printed "Tel: 011 717 9154 / 9152 / 9158". ${SITE}/disability-rights-unit/contact-us-/ adds "the closest entrance is on Jorissen Street", and a Tuesday-only desk in the Office of Student Success, Room 4C01, Health Sciences Campus. No hours are published.`,
  },
  {
    ...YEAR_2026,
    sourceUrl: `${SITE}/accommodation/contact-us/`,
    id: 'wits-central-accommodation-office',
    campusId: EAST,
    kind: 'residence-office',
    name: 'Central Accommodation Office',
    where: 'Ground Floor, Room SH045, Solomon Mahlangu House, Braamfontein',
    hours: 'Mon–Fri 08:00–16:00',
    phone: '+27 11 717 9172',
    location: at('Solomon Mahlangu House', EAST_NAME),
    note: 'Printed "+27 (0)11 717 9172 / +27 (0)11 717 9173 / +27 (0)11 717 9174"; email accommodation@wits.ac.za. The page says "Braamfontein" without East or West; the FASO contact page places Solomon Mahlangu House on Braamfontein Campus East.',
  },
  {
    ...YEAR_2026,
    sourceUrl: GUIDE_2026,
    id: 'wits-ict-service-desk',
    campusId: EAST,
    kind: 'other',
    name: 'ICT Service Desk',
    where: 'Solomon Mahlangu Building, Ground floor, Room 99',
    phone: '011 717 1717',
    location: at('Solomon Mahlangu House', EAST_NAME),
    note: 'Email ithelp@wits.ac.za. No hours published. Campus inferred from Solomon Mahlangu House being on Braamfontein Campus East (FASO contact page): check.',
  },
  {
    ...YEAR_2026,
    sourceUrl: GUIDE_2026,
    id: 'wits-transport-office-matrix',
    campusId: EAST,
    kind: 'transport',
    name: 'Transport office (Transport, Fleet and Logistics Unit)',
    where: 'Braamfontein main Campus, East Campus, at Matrix, Office/Shop 20',
    hours: '08:00–17:00',
    phone: '011 717 1754',
    location: at('The Matrix', EAST_NAME),
    note: 'Printed "Passenger Transport/Bus Services: Tel: 011 717 1754/1308", email Transport.OFMD@wits.ac.za; handles all transport services "including Lost and Found in the buses". The guide gives no days for the hours.',
  },
  {
    ...YEAR_2026,
    sourceUrl: `${SITE}/media/wits-university/faculties-and-schools/health-sciences/student-documents/undergraduate/Information%20for%20all%20New%20and%20Returning%20Undergraduate%20Students%20in%20the%20Faculty%20of%20Health%20Sciences%20-%202026.pdf`,
    id: 'wits-icam-office-braamfontein',
    campusId: EAST,
    kind: 'other',
    name: 'ICAM office (student cards)',
    where: 'Ground floor of Solomon Mahlangu House (formerly known as Senate House)',
    location: at('Solomon Mahlangu House', EAST_NAME),
    note: 'Where Braamfontein students collect or renew the Kudu Card (student card) after registration. The same pamphlet names an ICAM office on the first floor of the Administration block, Wits Education Campus, for Parktown students. No hours or phone published.',
  },

  // ── Braamfontein Campus West (Science, EBE, CLM) ───────────────────────────────────────────
  {
    ...YEAR_2026,
    sourceUrl: `${SITE}/media/wits-university/faculties-and-schools/health-sciences/student-documents/undergraduate/Information%20for%20all%20New%20and%20Returning%20Undergraduate%20Students%20in%20the%20Faculty%20of%20Health%20Sciences%20-%202026.pdf`,
    id: 'wits-flower-hall',
    campusId: WEST,
    kind: 'registration-venue',
    name: 'Flower Hall',
    where: 'Flower Hall, Wits West Campus',
    location: at('Flower Hall', WEST_NAME),
    note: 'The Health Sciences 2026 pamphlet calls it "the registration venue in Flower Hall, Wits West Campus" (where student cards can also be renewed). The university-wide pages say new first-years register online through the Self-Service Portal, or on campus by the deadline in their firm offer letter, without naming a venue. No dates or hours here.',
  },
  {
    ...YEAR_2026,
    sourceUrl: GTS_HS_2026,
    id: 'wits-fnb105-computer-lab',
    campusId: WEST,
    kind: 'computer-lab',
    name: 'FNB105',
    where: 'FNB105, First National Bank Building (Margo Steele School of Accountancy), West Campus',
    location: at('First National Bank Building', WEST_NAME),
    note: 'Listed (with FNB 2B) as a computer laboratory "with tutors available to assist with technical aspects of the online activities" for Gateway to Success 2026. The Science and EBE booklets also list a "CLM computer laboratory" on West Campus. Availability after orientation and hours are not published there.',
  },
  {
    ...YEAR_2026,
    sourceUrl: GUIDE_2026,
    id: 'wits-ccdu-west',
    campusId: WEST,
    kind: 'counselling',
    name: 'Counselling and Careers Development Unit (CCDU)',
    where: 'CCDU Building, Braamfontein Campus West',
    hours: 'Mon–Fri 08:00–16:30',
    phone: '011 717 9140',
    location: at('CCDU Building', WEST_NAME),
    note: 'Printed "Tel: 011 717 9140/32"; email info.ccdu@wits.ac.za. For after hours the guide gives the 24/7 toll-free student crisis line 0800 111 331 (Lyra Wellbeing, formerly ICAS); that line belongs with the helplines, not this place.',
  },
  {
    ...YEAR_2026,
    sourceUrl: SECURITY,
    id: 'wits-protection-services-west',
    campusId: WEST,
    kind: 'security',
    name: 'Campus Protection Services',
    where: 'FNB Building, West Campus',
    hours: '24 hours',
    phone: '011 717 1842',
    location: at('First National Bank Building', WEST_NAME),
    note: 'Printed "West Campus (011) 717 1842". The 2025 Braamfontein map prints Protection Services "Tel: 27 (11) 717 6666 (West)" instead: the two official sources disagree; check.',
  },
  {
    ...YEAR_2026,
    sourceUrl: BUS,
    id: 'wits-bus-stop-amic-deck',
    campusId: WEST,
    kind: 'transport',
    name: 'Wits Inter Campus Bus: Main Campus stop',
    where: 'Amic Deck, Yale Road, Braamfontein',
    phone: '011 717 1794',
    location: { query: 'Amic Deck, Yale Road, Braamfontein, Johannesburg' },
    note: 'Printed "Wits Main Campus (East & West Campus) - Amic Deck, Yale Road, Braamfontein"; filed under West here, check which campus it belongs to. Transport and Fleet Management "(011) 717-1794, (011) 717-1754 or (011) 717-1614". Only registered Wits students with a valid student card may ride; "NO WITS INTER CAMPUS BUSES DIRECTLY TO THE HEALTH SCIENCE CAMPUS": ride to the Education Campus and walk. Times are in the term schedule PDF (CampusBusSchedule2026.pdf).',
  },

  // ── Education Campus, Parktown (BEd; some Health Sciences first-year teaching) ─────────────
  {
    ...YEAR_2026,
    sourceUrl: GTS_HS_2026,
    id: 'wits-glass-lab-computer-lab',
    campusId: EDUCATION,
    kind: 'computer-lab',
    name: 'Glass Laboratory',
    where: 'Glass Laboratory, Education Campus',
    location: at('Glass Laboratory', EDUCATION_NAME),
    note: 'Listed as a computer laboratory for Gateway to Success 2026 online activities. Building, availability after orientation and hours are not published there.',
  },
  {
    ...YEAR_2026,
    sourceUrl: GUIDE_2026,
    id: 'wits-highfield-dining-hall',
    campusId: EDUCATION,
    kind: 'food',
    name: 'Highfield Dining Hall',
    where: 'Highfield Dining Hall, Parktown Education Campus',
    phone: '011 717 1795',
    location: at('Highfield House', EDUCATION_NAME),
    note: 'The guide says it is "now open to all students and staff for meals paid via card services". No prices or hours published. The phone is Dining Hall Catering Services.',
  },
  {
    ...YEAR_2026,
    sourceUrl: `${SITE}/campushealth/where-to-find-us/`,
    id: 'wits-campus-health-education',
    campusId: EDUCATION,
    kind: 'clinic',
    name: 'Campus Health and Wellness Centre (Satellite Clinic)',
    where: 'Highfield Accommodation House, ground floor, Education Campus, Parktown',
    phone: '011 717 3294',
    location: at('Highfield House', EDUCATION_NAME),
    note: `This page gives no hours. The 2026 Undergraduate Student Guide (${GUIDE_2026}) says the satellite service is "in the Highfield House close to the residence dining hall. Operations are daily from 08:30 to 16:00" and that "The Clinic is closed over weekends and during public holidays".`,
  },
  {
    ...YEAR_2026,
    sourceUrl: GUIDE_2026,
    id: 'wits-ccdu-education',
    campusId: EDUCATION,
    kind: 'counselling',
    name: 'Counselling and Careers Development Unit (CCDU), Education Campus',
    where: 'Marang Building, Ground Floor, Room 14',
    hours: 'Mon–Fri 08:00–16:30',
    phone: '011 717 3269',
    location: at('Marang Building', EDUCATION_NAME),
  },
  {
    ...YEAR_2026,
    sourceUrl: SECURITY,
    id: 'wits-protection-services-education',
    campusId: EDUCATION,
    kind: 'security',
    name: 'Campus Protection Services',
    where: 'Administration Block, Education Campus',
    hours: '24 hours',
    phone: '011 717 3340',
    location: at('Administration Block', EDUCATION_NAME),
    note: 'Printed "Education Campus: (011) 717 3340".',
  },
  {
    ...YEAR_2026,
    sourceUrl: GUIDE_2026,
    id: 'wits-dru-education',
    campusId: EDUCATION,
    kind: 'disability-unit',
    name: 'Disability Rights Unit (DRU), Education Campus',
    where: '1st Floor, Admin Block, Parktown Education Campus',
    phone: '011 717 9154',
    location: at('Administration Block', EDUCATION_NAME),
    note: 'The guide prints one set of numbers for both DRU offices: "Tel: 011 717 9154 / 9152 / 9158". No hours published.',
  },
  {
    ...YEAR_2026,
    sourceUrl: BUS,
    id: 'wits-bus-stop-bohlaleng',
    campusId: EDUCATION,
    kind: 'transport',
    name: 'Wits Inter Campus Bus: Education Campus stop',
    where: 'Bohlaleng Block, Parktown',
    phone: '011 717 1794',
    location: at('Bohlaleng Block', EDUCATION_NAME),
    note: 'Printed "Wits Education Campus - Bohlaleng Block, Parktown". Health Sciences students ride here and walk to the Health Sciences Campus (no inter-campus bus goes there). Registered students with a valid student card only.',
  },

  // ── Parktown Campus (Faculty of Health Sciences) ────────────────────────────────────────────
  {
    ...YEAR_2026,
    sourceUrl: SECURITY,
    id: 'wits-protection-services-health-sciences',
    campusId: PARKTOWN,
    kind: 'security',
    name: 'Campus Protection Services',
    where: 'Main foyer, Ground floor, Faculty of Health Sciences',
    hours: '24 hours',
    phone: '011 717 2222',
    location: at('Faculty of Health Sciences', PARKTOWN_NAME),
    note: 'Printed "Health Sciences Campus: (011) 717 2222 / 2232".',
  },
];

export const witsFacultyOffices: FacultyOffice[] = [
  {
    ...YEAR_2026,
    sourceUrl: `${SITE}/science/contact-us/`,
    id: 'wits-science-faculty-office',
    universityId: 'wits',
    faculty: 'Science',
    campusId: WEST,
    where: 'TW Kambule Building (Mathematical Sciences Building), West Campus',
    contactUrl: `${SITE}/science/contact-us/`,
    email: 'science.ug@wits.ac.za',
    phone: '011 717 6014',
  },
  {
    // Location from the guide; the call centre and registration email are on contactUrl (and
    // in the EBE Gateway to Success booklet), which gives no building.
    ...YEAR_2026,
    sourceUrl: GUIDE_2026,
    id: 'wits-ebe-faculty-office',
    universityId: 'wits',
    faculty: 'Engineering and the Built Environment',
    campusId: WEST,
    where:
      'Faculty Registry, WITS Africa Rainbow Minerals (ARM) building, Braamfontein Campus West',
    contactUrl: `${SITE}/ebe/contact-us/`,
    email: 'FacultyRegistrar.EBE@wits.ac.za',
    phone: '011 717 7007',
  },
  {
    // Location, hours and phone from the guide; the registrations email is on contactUrl.
    ...YEAR_2026,
    sourceUrl: GUIDE_2026,
    id: 'wits-health-sciences-faculty-office',
    universityId: 'wits',
    faculty: 'Health Sciences',
    campusId: PARKTOWN,
    where:
      "Faculty Registrar's Office, 2nd Floor Phillip V Tobias Health Sciences Building, Parktown North",
    contactUrl: `${SITE}/health/contact-us/`,
    email: 'registrations-fhs@wits.ac.za',
    phone: '011 717 2006',
    hours: 'Mon–Fri 08:00–16:30',
  },
  {
    ...YEAR_2026,
    sourceUrl: `${SITE}/clm/contact-us/`,
    id: 'wits-clm-faculty-office',
    universityId: 'wits',
    faculty: 'Commerce, Law and Management',
    campusId: WEST,
    where: 'Braamfontein West Campus',
    contactUrl: `${SITE}/clm/contact-us/`,
    phone: '+27 11 717 8001',
  },
  {
    // Location and hours from the guide; the faculty email and enquiries line are on contactUrl
    // ("SWE Building, Braamfontein - East Campus").
    ...YEAR_2026,
    sourceUrl: GUIDE_2026,
    id: 'wits-humanities-faculty-office',
    universityId: 'wits',
    faculty: 'Humanities',
    campusId: EAST,
    where: 'Braamfontein East Campus, South-West Engineering Building, Ground Floor',
    contactUrl: `${SITE}/humanities/contact-us/`,
    email: 'help.humanities@wits.ac.za',
    phone: '+27 11 717 4001',
    hours: 'Mon–Fri 08:00–16:30',
  },
  {
    // The Humanities office for BEd students.
    ...YEAR_2026,
    sourceUrl: `${SITE}/humanities/contact-us/`,
    id: 'wits-humanities-education-campus-office',
    universityId: 'wits',
    faculty: 'Humanities',
    campusId: EDUCATION,
    where: 'Room A209, 2nd Floor, Administration Building, Education Campus, Parktown',
    contactUrl: `${SITE}/humanities/contact-us/`,
    email: 'help.humanities@wits.ac.za',
    phone: '+27 11 717 3271',
    hours: 'Mon–Fri 08:00–16:30',
  },
];

/**
 * One per academic year: first-year registration, change deadlines, orientation week.
 *
 * Empty on purpose: Wits publishes no university-wide first-year registration close (new
 * first-years register "before the deadline stipulated in the firm offer letter"), and the schema
 * needs at least `firstYearRegistration.to` (`from` is already optional, A13-09). The orientation
 * and change dates the research found are in the research report: owed, for a person to add once
 * a close date is published (or the schema allows a calendar without one).
 */
export const witsRegistrationCalendars: RegistrationCalendar[] = [];
