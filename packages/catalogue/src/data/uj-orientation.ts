import type { Campus, FacultyOffice, Place, RegistrationCalendar } from '../campus';

/**
 * University of Johannesburg (UJ): campuses, the places on them, faculty offices and the
 * registration calendar (planning.md §11, Phase 5b–5c, 5e-2).
 *
 * Fill these arrays only: the catalogue already reads them, and the catalogue tests validate every
 * record added here. Schemas and field notes: `packages/catalogue/src/campus.ts`.
 * - Every record cites a page on uj.ac.za (or a subdomain) as `sourceUrl`, with the
 *   `academicYear` it was published for. Never add `verifiedOn`/`verifiedBy`: a person does.
 * - Ids start with `uj-`. A place's `campusId` is a campus below; a faculty office's
 *   `faculty` is spelled exactly as this university's programmes spell it (data/uj.ts).
 * - Clinic, counselling and security places are safety records: learners see them only once a
 *   person has verified them.
 * - Leave out what the university doesn't publish. Never guess a number, room, date or hour.
 *
 * DRAFT: researched from UJ's own pages, read in a real browser on 2026-10-17. Undated web pages
 * and the 2021-uploaded campus maps carry the year they were read (2026); the first-year letter and
 * the FYE Toolbox are 2026 documents. Not yet verified by a person (hard rule 3).
 *
 * Where UJ's own pages disagree on a value, neither is recorded: the field is left out and the
 * note gives both values with both pages, for the owner to settle (planning.md §11, 5e-2).
 * Coordinates are only those UJ prints (Protection Services' offices); nothing is taken from a
 * map service.
 */

const CONTACT = 'https://www.uj.ac.za/contact-us/';
const VIRTUAL_CAMPUS = 'https://www.uj.ac.za/virtual-campus/';
const PROTECTION = 'https://www.uj.ac.za/support-services/operations/protection-services/';
const PS_SOP =
  'https://www.uj.ac.za/wp-content/uploads/2021/10/ps-sop-awareness-print-out-file.pdf';
const PS_VIGILANCE =
  'https://www.uj.ac.za/wp-content/uploads/2023/10/uj_protec_employee_vigilance.pdf';
const LIBRARY_SAFETY = 'https://www.uj.ac.za/library/about-the-uj-library/safety-tips/';
const GENDER_EQUITY = 'https://www.uj.ac.za/about/transformation-unit/gender-equity/';
const CAMPUS_LIFE = 'https://www.uj.ac.za/admission-aid/campus-life/';
const HEALTH = 'https://www.uj.ac.za/about/registrars-portfolio/centre-for-health-and-wellness/';
const PSYCAD =
  'https://www.uj.ac.za/teaching-and-learning/academic-development-and-support/centre-for-psychological-services-and-career-development-psycad/';
const PSYCAD_CONTACT = `${PSYCAD}contact-us/`;
const PSYCAD_ABOUT = `${PSYCAD}about-us/`;
const LIBRARIES = 'https://www.uj.ac.za/library/about-the-uj-library/campus-libraries/';
const LIBRARY_HOURS = 'https://www.uj.ac.za/library/about-the-uj-library/uj-library-hours/';
const FIRST_YEAR_LETTER =
  'https://www.uj.ac.za/wp-content/uploads/2021/09/undergraduate_first_year_student_registration_2026.pdf';
const ACCOMMODATION =
  'https://www.uj.ac.za/study-uj-and-aid/undergraduate/accommodation-on-campus/';
/** FYE Toolbox 2026 (linked from https://www.uj.ac.za/fys). Printed page = PDF page − 2. */
const TOOLBOX = 'https://www.uj.ac.za/wp-content/uploads/2021/12/toolbox_uj-2026-pdf-jm.pdf';
const APK_MAP = 'https://www.uj.ac.za/wp-content/uploads/2021/05/uj-auckland-park-map.pdf';
const APB_MAP = 'https://www.uj.ac.za/wp-content/uploads/2021/09/uj_bunting_rd_map.pdf';
const DFC_MAP = 'https://www.uj.ac.za/wp-content/uploads/2021/09/uj_doornfontein_map.pdf';
const SWC_MAP = 'https://www.uj.ac.za/wp-content/uploads/2021/09/uj_soweto_campus_map.pdf';
const Y2026 = { academicYear: 2026 } as const;

const APK = 'uj-apk';
const APB = 'uj-apb';
const DFC = 'uj-dfc';
const SWC = 'uj-swc';

/**
 * Names and map links as https://www.uj.ac.za/contact-us/ prints them ("Additional Campuses information"). The schema
 * has no address field; the addresses UJ prints there are, for the verifier:
 * APK "Corner Kingsway and University Road, Auckland Park" (S26 10 54.9 E27 59 53.9);
 * APB "Bunting Road, Auckland Park" (S26 11 25.5 E28 01 09.5; the APB map prints
 * "S26.11 25.2 E28.01 09.4");
 * DFC "Cnr Siemert & Beit Streets, Doornfontein" (S26 11 32.6 E28 03 28.9);
 * SWC "Old Potch, Road Soweto" (S26 15 34.3 E27 55 26.3; the SWC map prints
 * "326 CHRIS HANI ROAD (OLD POTCH ROAD), PIMVILLE").
 * City: UJ's campus-libraries page prints each campus's physical address ending "Johannesburg".
 */
export const ujCampuses: Campus[] = [
  {
    ...Y2026,
    sourceUrl: CONTACT,
    id: APK,
    universityId: 'uj',
    name: 'Auckland Park Kingsway Campus',
    city: 'Johannesburg',
    mapUrl: APK_MAP,
    virtualTourUrl: VIRTUAL_CAMPUS,
  },
  {
    ...Y2026,
    sourceUrl: CONTACT,
    id: APB,
    universityId: 'uj',
    name: 'Auckland Park Bunting Road Campus',
    city: 'Johannesburg',
    mapUrl: APB_MAP,
    virtualTourUrl: VIRTUAL_CAMPUS,
  },
  {
    ...Y2026,
    sourceUrl: CONTACT,
    id: DFC,
    universityId: 'uj',
    name: 'Doornfontein Campus',
    city: 'Johannesburg',
    mapUrl: DFC_MAP,
    virtualTourUrl: VIRTUAL_CAMPUS,
  },
  {
    ...Y2026,
    sourceUrl: CONTACT,
    id: SWC,
    universityId: 'uj',
    name: 'Soweto Campus',
    city: 'Johannesburg',
    mapUrl: SWC_MAP,
    virtualTourUrl: VIRTUAL_CAMPUS,
  },
];

const PS_NAME = 'Protection Services';
const PS_HOURS_NOTE = `${CAMPUS_LIFE} prints "Protection Services personnel are on duty 24 hours a day"; the phone is the campus's "Security Control Room" under "Emergency Contact Numbers", and "where" and the coordinates are from "GPS co-ordinates of all PS offices" on the same page.`;
const CLINIC_HOURS_DISPUTE = `UJ's pages disagree on the clinic hours: "Operational hours: 08:00 – 16:00 on Monday to Friday" (${HEALTH}) and "Consulting hours 08:00 – 15:30 weekdays" (${TOOLBOX}, PDF page 25, printed 23); the owner settles this, so no hours are recorded.`;
const CLINIC_AFTER_HOURS = `${HEALTH} says the clinics "are supported by ER24 providing emergency medical services for after hours and emergencies taking place outside the clinic".`;
const PSYCAD_NAME = 'Centre for Psychological Services and Career Development (PsyCaD)';
const PSYCAD_HOURS =
  'Walk-in consultations: Monday – Friday: 09:00–13:00 and 13:30–15:30 (Lunch Break: 13:00–13:30)';
const CRISIS_LINE = `Crisis line, as printed on ${PSYCAD} and ${PSYCAD_ABOUT}: "The UJ- PsyCaD 24-Hour Mental Health Crisis Line (082 054 1137) is available during the academic year from February to November for UJ Students only." Outside that period the same pages list "Higher Health Helpline (for staff and students): Toll-free: 0800 36 36 36/SMS 43336", "Lifeline: 0861 322 322", "SADAG Suicide Crisis Line: 0800 567 567", "Netcare Akeso Crisis Helpline: 0861 435 787". The walk-in hours are printed once for all campuses; "Students presenting with a psychological emergency will be prioritised."`;
const DU_NAME = 'Disability Unit';
const DU_NOTE = `Printed as "Disability Unit | All campuses – disabilityunit@uj.ac.za | 011 559 3745"; ${PSYCAD_ABOUT} prints "Disability Unit: du@uj.ac.za ; (011) 559-3745". No office is printed for the unit itself: the Disability Services page carries PsyCaD's office line ("APB Impala Court | APK C-Ring 1 | DFC House 2, Louisa Street | SWC Adelaide Tambo Building (Academic Block)"); check on site whether the unit sits there.`;
const LIBRARY_HOURS_TEXT =
  'Monday to Friday: 07:30 – 22:00; Saturdays: 08:00 – 15:00; Public Holidays: Closed; 24-Hour Spaces: Open daily, Monday to Sunday – 24 hours';
const LIBRARY_HOURS_NOTE = `Hours from ${LIBRARY_HOURS} ("Library Hours: 2026"), printed once for all UJ libraries, not per campus; "Access to the UJ Libraries can only be granted if you have a valid UJ Card."`;
const FINANCE_NAME = 'Student Finance (NSFAS / Bursaries / Debtors / Refunds)';
const FINANCE_NO_OFFICE = `No office location is printed: ${TOOLBOX} (PDF page 33, printed 31) only says "Please scan the QR code below for the location, services and contact details".`;
const RESIDENCE_NAME = 'Student Affairs (Student Accommodation and Residence Life)';
const RESIDENCE_PHONES = `UJ's pages disagree on the residence phone per campus: ${TOOLBOX} (PDF page 31, printed 29) and the placement officers' office numbers on ${ACCOMMODATION} differ, and the Toolbox's own residence and SRC tables swap numbers between campuses; the owner settles this, so no phone is recorded. The Toolbox prints one line for all campuses: "Residence Application Status Enquiries & General Enquiries: 011 559 2092".`;
const CARD_NAME = 'Student access card collection';
const CARD_NOTE = `Registration itself is online: "No on-campus facilities will be available for registration. All registrations are completed online and off-campus." (letter §2.2). Section 5: "Student access cards may be collected on campus (after you have registered) from 14 January 2026 until 6 February 2026 between 08:00 to 15:30"; "Please ensure that you have your proof of registration and ID with you when collecting your student card." These are 2026 dates: no 2027 letter was published when read. The 2026 registration start is itself disputed: "13 January – 6 February 2026" (https://www.uj.ac.za/admission-aid/registration/) and "Wednesday, 14 January 2026" (this letter, page 1); the owner settles this.`;
const BUS_NOTE = (label: string) =>
  `Printed on the campus map as "${label}", with no address or times (the map shows where it is). UJ prints no inter-campus bus routes, stops' times or which buses stop here; ${TOOLBOX} (PDF page 39, printed 37) says "There are free bus shuttles that travel across the four UJ campuses".`;

export const ujPlaces: Place[] = [
  // Auckland Park Kingsway (APK)
  {
    ...Y2026,
    sourceUrl: PROTECTION,
    id: 'uj-apk-protection-services',
    campusId: APK,
    kind: 'security',
    name: PS_NAME,
    where: 'Library Bridge Cellar, Ground floor',
    phone: '011 559 2555',
    location: { coordinates: { lat: -26.183381, lng: 27.999476 } },
    note: `${PS_HOURS_NOTE} Printed as "APK / C/of Kingsway and University Road / Auckland Park / Library Bridge Cellar / Ground floor / 26°11’00.2″S 27°59’58.1″E / -26.183381, 27.999476". ${PS_SOP} (page 9) prints the same office and 011 559 2555; ${TOOLBOX} (PDF page 27) prints "Control Room Library Bridge Basement" with "011 559 2555" and "011 559 2000".`,
  },
  {
    ...Y2026,
    sourceUrl: HEALTH,
    id: 'uj-apk-clinic',
    campusId: APK,
    kind: 'clinic',
    name: 'Kingsway Campus Clinic',
    where: 'E Ring Basement',
    phone: '011 559 3837',
    note: `${CLINIC_HOURS_DISPUTE} ${CLINIC_AFTER_HOURS} ${TOOLBOX} (PDF page 25) prints "Afterhours medical emergency … APK: 011 559 2555" and "Doctor’s consultation … APK | Wednesdays | 11:30 – 15:30". ${CONTACT} prints the same 011 559 3837.`,
  },
  {
    ...Y2026,
    sourceUrl: PSYCAD_CONTACT,
    id: 'uj-apk-psycad',
    campusId: APK,
    kind: 'counselling',
    name: PSYCAD_NAME,
    where: 'C Ring 1',
    hours: PSYCAD_HOURS,
    phone: '011 559 2394',
    note: `${CRISIS_LINE} APK's second line on this page: 011 559 3324. ${PSYCAD_ABOUT} prints "APK C-Ring 1 + B5 Building"; ${PSYCAD} prints "B5 Office/ External clients: 011 559 3106"; ${TOOLBOX} (PDF page 22) prints "APK | C-Ring 1 | 011 559 3106 / 011 559 2509".`,
  },
  {
    ...Y2026,
    sourceUrl: PSYCAD_CONTACT,
    id: 'uj-apk-disability-unit',
    campusId: APK,
    kind: 'disability-unit',
    name: DU_NAME,
    phone: '011 559 3745',
    note: DU_NOTE,
  },
  {
    ...Y2026,
    sourceUrl: LIBRARIES,
    id: 'uj-apk-library',
    campusId: APK,
    kind: 'library',
    name: 'Auckland Park Kingsway Campus Library',
    hours: LIBRARY_HOURS_TEXT,
    location: {
      query:
        'Auckland Park Kingsway Campus Library, Cnr Kingsway and University Road, Auckland Park, Johannesburg',
    },
    note: `${LIBRARY_HOURS_NOTE} UJ's pages disagree on the phone: "27 11 559-3198" (${LIBRARIES}) and "011 559 2171" (${TOOLBOX}, PDF page 29, printed 27); the owner settles this, so no phone is recorded.`,
  },
  {
    ...Y2026,
    sourceUrl: CONTACT,
    id: 'uj-apk-student-finance',
    campusId: APK,
    kind: 'financial-aid',
    name: FINANCE_NAME,
    phone: '011 559 3575',
    note: `The phone is "APK Bursaries". The same page prints "APK Debtors: 011 559 3411 / 4741", "APK Refunds: 011 559 3662", "APK Call Centre: 011 559 7300 / 7301 / 7302" and studentaccounts@uj.ac.za. ${FINANCE_NO_OFFICE}`,
  },
  {
    ...Y2026,
    sourceUrl: TOOLBOX,
    id: 'uj-apk-student-affairs',
    campusId: APK,
    kind: 'residence-office',
    name: RESIDENCE_NAME,
    where: 'E-Ring 316',
    note: `Student Affairs "Location and Contact Information", PDF page 30 (printed 28); the division includes Student Accommodation and Residence Life. The APK campus map also labels a "RESIDENCE ADMIN" building. ${RESIDENCE_PHONES}`,
  },
  {
    ...Y2026,
    sourceUrl: FIRST_YEAR_LETTER,
    id: 'uj-apk-student-card-collection',
    campusId: APK,
    kind: 'registration-venue',
    name: CARD_NAME,
    where: 'D1 Lab 208',
    hours: '08:00 to 15:30',
    note: `Printed as "APK - Kingsway Campus | D1 Lab 208" (page 4, §5). ${CARD_NOTE}`,
  },
  {
    ...Y2026,
    sourceUrl: APK_MAP,
    id: 'uj-apk-kingsway-bus-stop',
    campusId: APK,
    kind: 'transport',
    name: 'Kingsway bus stop',
    note: BUS_NOTE('KINGSWAY BUS STOP'),
  },

  // Auckland Park Bunting Road (APB)
  {
    ...Y2026,
    sourceUrl: PROTECTION,
    id: 'uj-apb-protection-services',
    campusId: APB,
    kind: 'security',
    name: PS_NAME,
    where: '15 Bunting road, Cottesloe, Protection Services Building, 1st floor, Office 102',
    phone: '011 559 1312',
    location: { coordinates: { lat: -26.188964, lng: 28.016279 } },
    note: `${PS_HOURS_NOTE} Printed as "APB / 15 Bunting road / Cottesloe / Protection Services Building / 1st floor / Office 102 / 26°11’20.3″S 28°00’58.6″E / -26.188964, 28.016279". ${PS_SOP} (page 9) prints the same office and 011 559 1312. ${TOOLBOX} (PDF page 27) places the control room at "Control Room Cnr Ibis and Bunting Road 011 559 1312": check whether the control room is in the office building. ${GENDER_EQUITY} prints "APB 011 559 1312/1076".`,
  },
  {
    ...Y2026,
    sourceUrl: HEALTH,
    id: 'uj-apb-clinic',
    campusId: APB,
    kind: 'clinic',
    name: 'Bunting Road Campus Clinic',
    where: 'Duiker Court(next to PsyCaD), Ground floor',
    phone: '011 559 1238',
    note: `${CLINIC_HOURS_DISPUTE} ${CLINIC_AFTER_HOURS} ${TOOLBOX} (PDF page 25) prints "APB | House No 3, Duiker Court | 011 559 1238", "Afterhours medical emergency APB: 011 559 1076" and "Doctor’s consultation APB | Mondays | 11:00 – 13:00". "Next to PsyCaD" is as printed, although PsyCaD's APB office is printed as "Impala Court": check on site.`,
  },
  {
    ...Y2026,
    sourceUrl: PSYCAD_CONTACT,
    id: 'uj-apb-psycad',
    campusId: APB,
    kind: 'counselling',
    name: PSYCAD_NAME,
    where: 'Impala Court',
    hours: PSYCAD_HOURS,
    note: `UJ's pages disagree on the phone: "011 559 1318" (${PSYCAD_CONTACT}, also ${PSYCAD_ABOUT}) and "011 559 1334" (${TOOLBOX}, PDF page 22, printed 20); the owner settles this, so no phone is recorded. ${CRISIS_LINE}`,
  },
  {
    ...Y2026,
    sourceUrl: PSYCAD_CONTACT,
    id: 'uj-apb-disability-unit',
    campusId: APB,
    kind: 'disability-unit',
    name: DU_NAME,
    phone: '011 559 3745',
    note: DU_NOTE,
  },
  {
    ...Y2026,
    sourceUrl: LIBRARIES,
    id: 'uj-apb-library',
    campusId: APB,
    kind: 'library',
    name: 'Auckland Park Bunting Road Campus Library',
    hours: LIBRARY_HOURS_TEXT,
    phone: '+27 11 559 1293',
    location: {
      query:
        'Auckland Park Bunting Road Campus Library, Bunting Road, Cottesloe, Auckland Park, Johannesburg',
    },
    note: `${LIBRARY_HOURS_NOTE} Phone printed as "27 11 559-1293"; ${TOOLBOX} (PDF page 29) prints the same 011 559 1293.`,
  },
  {
    ...Y2026,
    sourceUrl: LIBRARIES,
    id: 'uj-apb-fada-library',
    campusId: APB,
    kind: 'library',
    name: 'Faculty of Arts Design and Architecture Library',
    hours: LIBRARY_HOURS_TEXT,
    phone: '+27 11 559 1018',
    location: {
      query:
        'Faculty of Arts Design and Architecture Library, Bunting Road, Cottesloe, Auckland Park, Johannesburg',
    },
    note: `${LIBRARY_HOURS_NOTE} Phone printed as "27 11 559-1018"; ${TOOLBOX} (PDF page 29) prints "FADA | 011 559 1018".`,
  },
  {
    ...Y2026,
    sourceUrl: CONTACT,
    id: 'uj-apb-student-finance',
    campusId: APB,
    kind: 'financial-aid',
    name: FINANCE_NAME,
    phone: '+27 11 559 1530',
    note: `The phone is "APB Bursaries"; no APB debtors or refunds line is printed. ${FINANCE_NO_OFFICE}`,
  },
  {
    ...Y2026,
    sourceUrl: TOOLBOX,
    id: 'uj-apb-student-affairs',
    campusId: APB,
    kind: 'residence-office',
    name: RESIDENCE_NAME,
    where: 'Sable Court',
    note: `Student Affairs "Location and Contact Information", PDF page 30 (printed 28); the division includes Student Accommodation and Residence Life. ${RESIDENCE_PHONES}`,
  },
  {
    ...Y2026,
    sourceUrl: FIRST_YEAR_LETTER,
    id: 'uj-apb-student-card-collection',
    campusId: APB,
    kind: 'registration-venue',
    name: CARD_NAME,
    where: 'Con Cowan Building, Bring-your-own-device venue, 2nd floor',
    hours: '08:00 to 15:30',
    note: `Printed as "APB - Bunting Road Campus | Con Cowan Building, Bring-your-own-device venue, 2nd floor" (page 4, §5). ${CARD_NOTE}`,
  },
  {
    ...Y2026,
    sourceUrl: APB_MAP,
    id: 'uj-apb-bunting-rd-bus-stop',
    campusId: APB,
    kind: 'transport',
    name: 'Bunting Rd bus stop',
    note: `${BUS_NOTE('BUNTING RD BUS STOP')} ${VIRTUAL_CAMPUS} lists an "APB Bus Terminal" tour.`,
  },

  // Doornfontein (DFC)
  {
    ...Y2026,
    sourceUrl: PROTECTION,
    id: 'uj-dfc-protection-services',
    campusId: DFC,
    kind: 'security',
    name: PS_NAME,
    where: '37 Nind street, Doornfontein, Ground floor, Office G01',
    location: { coordinates: { lat: -26.192335, lng: 28.057549 } },
    note: `UJ's pages disagree on the DFC Security Control Room number: "011 559 6085" (${PROTECTION}, also ${PS_SOP} page 9 and ${GENDER_EQUITY}) and "011 559 6450" (${LIBRARY_SAFETY}, also ${PS_VIGILANCE}); ${TOOLBOX} (PDF page 27) prints both under "DFC | Control Room near Main Entrance". The owner settles this, so no phone is recorded. Printed as "DFC / 37 Nind street / Doornfontein / 2028 / Ground floor / Office G01 / 26°11’32.4″S 28°03’27.2″E / -26.192335, 28.057549". ${CAMPUS_LIFE} prints "Protection Services personnel are on duty 24 hours a day".`,
  },
  {
    ...Y2026,
    sourceUrl: HEALTH,
    id: 'uj-dfc-clinic',
    campusId: DFC,
    kind: 'clinic',
    name: 'Doornfontein Campus Clinic',
    phone: '011 559 6544',
    note: `UJ's pages disagree on the building: "House 4, Louisa Street" (${HEALTH}) and "House No 2, Louisa Street" (${TOOLBOX}, PDF page 25, printed 23; House 2 is PsyCaD's DFC address); the owner settles this, so no "where" is recorded. The DFC campus map labels a "CLINIC". ${CLINIC_HOURS_DISPUTE} ${CLINIC_AFTER_HOURS} The Toolbox prints "Afterhours medical emergency … DFC: 011 559 6544" and "Doctor’s consultation DFC | Thursdays | 09:00 – 11:30".`,
  },
  {
    ...Y2026,
    sourceUrl: PSYCAD_CONTACT,
    id: 'uj-dfc-psycad',
    campusId: DFC,
    kind: 'counselling',
    name: PSYCAD_NAME,
    where: 'House 2 Louisa Street',
    hours: PSYCAD_HOURS,
    phone: '011 559 6042',
    note: `${CRISIS_LINE} ${TOOLBOX} (PDF page 22) prints the same 011 559 6042.`,
  },
  {
    ...Y2026,
    sourceUrl: PSYCAD_CONTACT,
    id: 'uj-dfc-disability-unit',
    campusId: DFC,
    kind: 'disability-unit',
    name: DU_NAME,
    phone: '011 559 3745',
    note: DU_NOTE,
  },
  {
    ...Y2026,
    sourceUrl: LIBRARIES,
    id: 'uj-dfc-library',
    campusId: DFC,
    kind: 'library',
    name: 'Doornfontein Campus Library',
    hours: LIBRARY_HOURS_TEXT,
    location: { query: 'Doornfontein Campus Library, 37 Nind Street, Doornfontein, Johannesburg' },
    note: `${LIBRARY_HOURS_NOTE} UJ's pages disagree on the phone: "27 11 559-6752" (${LIBRARIES}) and "011 559 5666" (${TOOLBOX}, PDF page 29; the library page gives 559-5666 to Soweto); the owner settles this, so no phone is recorded. The DFC campus map labels it "LESLIE BOYD LIBRARY".`,
  },
  {
    ...Y2026,
    sourceUrl: CONTACT,
    id: 'uj-dfc-student-finance',
    campusId: DFC,
    kind: 'financial-aid',
    name: FINANCE_NAME,
    phone: '011 559 6063',
    note: `The phone is "DFC Bursaries". The same page prints "DFC Debtors: 011 559 6440" and "DFC Refunds: 011 559 6440". ${FINANCE_NO_OFFICE}`,
  },
  {
    ...Y2026,
    sourceUrl: TOOLBOX,
    id: 'uj-dfc-student-affairs',
    campusId: DFC,
    kind: 'residence-office',
    name: RESIDENCE_NAME,
    where: 'Quardrum Building, opposite Protection Services',
    note: `Student Affairs "Location and Contact Information", PDF page 30 (printed 28); "Quardrum" is as printed. The division includes Student Accommodation and Residence Life. ${RESIDENCE_PHONES}`,
  },
  {
    ...Y2026,
    sourceUrl: FIRST_YEAR_LETTER,
    id: 'uj-dfc-student-card-collection',
    campusId: DFC,
    kind: 'registration-venue',
    name: CARD_NAME,
    where: 'Samsung Venue, 2nd Floor, QK Building',
    hours: '08:00 to 15:30',
    note: `Printed as "DFC - Doornfontein Campus | Samsung Venue, 2nd Floor, QK Building" (page 4, §5). ${CARD_NOTE}`,
  },

  // Soweto (SWC)
  {
    ...Y2026,
    sourceUrl: PROTECTION,
    id: 'uj-swc-protection-services',
    campusId: SWC,
    kind: 'security',
    name: PS_NAME,
    where: 'Administration Building Block D (uKhamba), Ground floor, Office ADD 119',
    phone: '011 559 5555',
    location: { coordinates: { lat: -26.26151, lng: 27.924257 } },
    note: `${PS_HOURS_NOTE} Printed as "SWC / Chris Hani Road / Soweto / Administration Building Block D (uKhamba) / Ground floor / Office ADD 119 / 26°15’41.4″S 27°55’27.3″E / -26.261510, 27.924257". ${TOOLBOX} (PDF page 27) prints "SWC | Control Room near Main Entrance | 011 559 5555".`,
  },
  {
    ...Y2026,
    sourceUrl: HEALTH,
    id: 'uj-swc-clinic',
    campusId: SWC,
    kind: 'clinic',
    name: 'Soweto Campus Clinic',
    where: 'Nthato Motlana Building',
    phone: '011 559 5571',
    note: `${CLINIC_HOURS_DISPUTE} ${CLINIC_AFTER_HOURS} ${TOOLBOX} (PDF page 25) prints "Afterhours medical emergency … SWC: 011 559 5555" and "Doctor’s consultation SWC | Wednesdays | 08:30 – 11:00". The SWC campus map labels it "NTHATO MOTLANA CLINIC".`,
  },
  {
    ...Y2026,
    sourceUrl: PSYCAD_CONTACT,
    id: 'uj-swc-psycad',
    campusId: SWC,
    kind: 'counselling',
    name: PSYCAD_NAME,
    where: 'Adelaide Tambo Building Academic Block B',
    hours: PSYCAD_HOURS,
    phone: '011 559 5752',
    note: `${CRISIS_LINE} ${TOOLBOX} (PDF page 22) prints "011559 5752".`,
  },
  {
    ...Y2026,
    sourceUrl: PSYCAD_CONTACT,
    id: 'uj-swc-disability-unit',
    campusId: SWC,
    kind: 'disability-unit',
    name: DU_NAME,
    phone: '011 559 3745',
    note: DU_NOTE,
  },
  {
    ...Y2026,
    sourceUrl: LIBRARIES,
    id: 'uj-swc-library',
    campusId: SWC,
    kind: 'library',
    name: 'Soweto Campus Library',
    hours: LIBRARY_HOURS_TEXT,
    phone: '+27 11 559 5666',
    location: { query: 'Soweto Campus Library, Chris Hani Road, PowerPark, Soweto, Johannesburg' },
    note: `${LIBRARY_HOURS_NOTE} Phone printed as "27 11 559-5666". ${TOOLBOX} (PDF page 29) lists no Soweto library and prints 011 559 5666 under DFC: check whose line it is. The SWC campus map labels it "ISMAEL MAHOMMED LIBRARY".`,
  },
  {
    ...Y2026,
    sourceUrl: CONTACT,
    id: 'uj-swc-student-finance',
    campusId: SWC,
    kind: 'financial-aid',
    name: FINANCE_NAME,
    phone: '+27 11 559 5187',
    note: `The phone is "SWC Bursaries"; no SWC debtors or refunds line is printed. ${FINANCE_NO_OFFICE}`,
  },
  {
    ...Y2026,
    sourceUrl: TOOLBOX,
    id: 'uj-swc-student-affairs',
    campusId: SWC,
    kind: 'residence-office',
    name: RESIDENCE_NAME,
    where: 'Ukhamba Building, Old NSFAS House',
    note: `Student Affairs "Location and Contact Information", PDF page 30 (printed 28); the division includes Student Accommodation and Residence Life. ${RESIDENCE_PHONES}`,
  },
  {
    ...Y2026,
    sourceUrl: FIRST_YEAR_LETTER,
    id: 'uj-swc-student-card-collection',
    campusId: SWC,
    kind: 'registration-venue',
    name: CARD_NAME,
    where: 'GNA09, Robert Sobukwe Building',
    hours: '08:00 to 15:30',
    note: `Printed as "SWC - Soweto Campus | GNA09, Robert Sobukwe Building" (page 4, §5). ${CARD_NOTE}`,
  },
  {
    ...Y2026,
    sourceUrl: SWC_MAP,
    id: 'uj-swc-student-bus-stop',
    campusId: SWC,
    kind: 'transport',
    name: 'Student bus stop',
    note: BUS_NOTE('STUDENT BUS STOP'),
  },
];

/**
 * None yet. https://www.uj.ac.za/contact-us/ ("Faculty Contacts") prints faculty phones and emails
 * by campus but no office building or room, which the schema requires (`where`).
 */
export const ujFacultyOffices: FacultyOffice[] = [];

/** One per academic year: first-year registration, change deadlines, orientation week. */
export const ujRegistrationCalendars: RegistrationCalendar[] = [
  {
    sourceUrl: 'https://www.uj.ac.za/wp-content/uploads/2025/06/2027-academic-calendar.pdf',
    academicYear: 2027,
    universityId: 'uj',
    firstYearRegistration: { from: '2027-01-11', to: '2027-02-05' },
    // Not printed (gotcha 40): the screens and the checklist say so rather than carry a guess.
    changeDeadlines: [],
    note: 'The "Academic Calendar for 2027 (Senate approved S 221/2025)", page 1, prints "Online registration (for returning and first-year students) | 11 January to 5 February" and "First Semester | 8 February to 21 May". It prints no last day to change modules and no orientation week. UJ\'s 2026 first-year letter says "No on-campus facilities will be available for registration".',
  },
];
