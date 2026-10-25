import type { SubjectArea } from '../book-links';
import type { BookMatch, LibraryCatalogue, OpenBook } from '../books';
import type { UniversityId } from '../records';

/**
 * Free books (Phase 6, sub-phase 6d): open textbooks, the curated matches to first-year modules,
 * and each university library's own search.
 *
 * DRAFT: researched on 2026-10-24. No record carries `verifiedOn` or `verifiedBy`: a person opens
 * each source, checks it, and adds them (hard rule 3). Nothing here is hosted or downloaded by us:
 * every record is a link to the publisher's own page.
 *
 * - **OpenStax** (openstax.org): titles, slugs, licences, senior authors and ISBNs from OpenStax's
 *   own content API, https://openstax.org/apps/cms/api/v2/pages/?type=books.Book&fields=_,title,slug,authors,book_state,license_url,print_isbn_13,digital_isbn_13&limit=200
 *   (read 2026-10-24). Only books the API marks `live` are recorded. **Every one is licensed
 *   CC BY-NC-SA 4.0 today**, including books older lists show as CC BY 4.0 (OpenStax re-licensed
 *   its current editions; the retired editions keep CC BY). The book page
 *   (openstax.org/details/books/<slug>) shows the licence; it renders in the browser, so a person
 *   checks it there. Authors are the ones the API flags as senior authors, as printed.
 * - **Siyavula** (www.siyavula.com): the Grade 12 Mathematics and Physical Sciences books, as
 *   bridging for first-year maths and science. Each read page says "released under the terms of a
 *   Creative Commons Attribution License" linking CC BY 3.0 (read 2026-10-24); embedded videos and
 *   simulations from other sources may not be covered. No ISBN is printed on the read pages.
 * - **OpenUCT** (open.uct.ac.za), UCT's own open repository: two records with an explicit CC
 *   licence (read 2026-10-24). Nothing first-year with an open licence was found on Wits's
 *   WIReDSpace, UP's UPSpace, UJ's UJContent, TUT's TUTDoR or UKZN's ResearchSpace (research
 *   output and theses only, as far as research could see; TUTDoR refused automated access).
 * - **Matches** are all `covers-similar-ground`, drafted from the module's **name** in the
 *   drafted curricula only. Nobody has read these modules' outlines, so no `is-the-prescribed-book`
 *   match is drafted: a person adds one only after reading the outline that prescribes it.
 * - **Libraries**: each library's own page and the catalogue it links to (see each record's note
 *   for whether the pattern was seen to return results). TUT has no record: its library page has a
 *   "Search Primo Discovery" box, but research could not find its Primo address.
 */

const ACCESSED = '2026-10-24';
const YEAR = 2026;
const NC_SA = 'cc-by-nc-sa-4.0';

const openstaxPage = (slug: string) => `https://openstax.org/details/books/${slug}`;

/** One OpenStax book: the book page is both the link and the source of its licence. */
function openstax(
  slug: string,
  title: string,
  edition: string | null,
  authors: string[],
  isbns: string[],
  subjectAreas: SubjectArea[],
  level: OpenBook['level'] = 'first-year',
  note?: string,
): OpenBook {
  return {
    sourceUrl: openstaxPage(slug),
    academicYear: YEAR,
    id: `openstax-${slug}`,
    title,
    authors,
    edition,
    isbns,
    licence: NC_SA,
    url: openstaxPage(slug),
    subjectAreas,
    level,
    accessedOn: ACCESSED,
    ...(note ? { note } : {}),
  };
}

const SIYAVULA_NOTE =
  'Free to read online, no account. School (NSC) Grade 12 work: bridging for a first-year module, never a university textbook. No ISBN printed on the read page.';

export const openBooks: OpenBook[] = [
  // Mathematics and statistics
  openstax(
    'calculus-volume-1',
    'Calculus Volume 1',
    null,
    ['Gilbert Strang', 'Edwin “Jed” Herman'],
    ['9781938168024', '9781947172135'],
    ['mathematics'],
  ),
  openstax(
    'calculus-volume-2',
    'Calculus Volume 2',
    null,
    ['Gilbert Strang', 'Edwin “Jed” Herman'],
    ['9781938168062', '9781947172142'],
    ['mathematics'],
  ),
  openstax(
    'precalculus-2e',
    'Precalculus 2e',
    '2e',
    ['Jay Abramson'],
    ['9781711494005', '9781951693398'],
    ['mathematics'],
    'bridging',
  ),
  openstax(
    'introductory-statistics-2e',
    'Introductory Statistics 2e',
    '2e',
    ['Barbara Illowsky', 'Susan Dean'],
    ['9781711472577', '9781961584327'],
    ['statistics'],
  ),
  openstax(
    'introductory-business-statistics-2e',
    'Introductory Business Statistics 2e',
    '2e',
    ['Alexander Holmes', 'Barbara Illowsky', 'Susan Dean'],
    ['9781711472591', '9781961584334'],
    ['statistics'],
  ),
  // Physical sciences
  openstax(
    'university-physics-volume-1',
    'University Physics Volume 1',
    null,
    ['William Moebs', 'Samuel J. Ling', 'Jeff Sanny'],
    ['9781938168277', '9781947172203'],
    ['physics'],
  ),
  openstax(
    'university-physics-volume-2',
    'University Physics Volume 2',
    null,
    ['Samuel J. Ling', 'William Moebs', 'Jeff Sanny'],
    ['9781938168161', '9781947172210'],
    ['physics'],
  ),
  openstax(
    'college-physics-2e',
    'College Physics 2e',
    '2e',
    ['Paul Peter Urone', 'Roger Hinrichs'],
    ['9781711470832', '9781951693602'],
    ['physics'],
  ),
  openstax(
    'chemistry-2e',
    'Chemistry 2e',
    '2e',
    ['Paul Flowers', 'Klaus Theopold', 'Richard Langley', 'William R. Robinson, PhD'],
    ['9781947172623', '9781947172616'],
    ['chemistry'],
  ),
  openstax(
    'chemistry-atoms-first-2e',
    'Chemistry: Atoms First 2e',
    '2e',
    [
      'Paul Flowers',
      'Edward J. Neth',
      'William R. Robinson, PhD',
      'Klaus Theopold',
      'Richard Langley',
    ],
    ['9781947172647', '9781947172630'],
    ['chemistry'],
  ),
  // Life and health sciences
  openstax(
    'biology-2e',
    'Biology 2e',
    '2e',
    ['Mary Ann Clark', 'Matthew Douglas', 'Jung Choi'],
    ['9781947172517', '9781947172524'],
    ['biology'],
  ),
  openstax(
    'concepts-biology',
    'Concepts of Biology',
    null,
    ['Samantha Fowler', 'Rebecca Roush', 'James Wise'],
    ['9781938168116', '9781947172036'],
    ['biology'],
  ),
  openstax(
    'microbiology',
    'Microbiology',
    null,
    ['Nina Parker', 'Mark Schneegurt', 'Anh-Hue Thi Tu', 'Philip Lister', 'Brian M. Forster'],
    ['9781938168147', '9781947172234'],
    ['microbiology'],
    'first-year',
    'The API prints the print ISBN with soft hyphens ("978-­1-­938168-­14-­7"); recorded as its 13 digits.',
  ),
  openstax(
    'anatomy-and-physiology-2e',
    'Anatomy and Physiology 2e',
    '2e',
    [
      'J. Gordon Betts',
      'Kelly A. Young',
      'James A. Wise',
      'Eddie Johnson',
      'Brandon Poe',
      'Dean H. Kruse',
      'Oksana Korol',
      'Jody E. Johnson',
      'Mark Womble',
      'Peter DeSaix',
    ],
    ['9781711494067', '9781951693428'],
    ['anatomy-and-physiology'],
  ),
  openstax(
    'fundamentals-nursing',
    'Fundamentals of Nursing',
    null,
    ['Christy Bowen', 'Lindsay Draper', 'Heather Moore'],
    ['9781711472850', '9781961584419'],
    ['nursing'],
    'first-year',
    'Written for US nursing programmes: practice, law and scope differ from South Africa’s (SANC). Check with the lecturer before relying on it.',
  ),
  openstax(
    'pharmacology',
    'Pharmacology for Nurses',
    null,
    ['Tina Barbour-Taylor', 'Leah Mueller (Sabato)', 'Donna Paris', 'Dorie Weaver'],
    ['9781711472799', '9781961584372'],
    ['pharmacology', 'nursing'],
    'first-year',
    'Written for US nursing programmes: medicine names and scheduling differ from South Africa’s. Check with the lecturer before relying on it.',
  ),
  // Economic and management sciences
  openstax(
    'principles-economics-3e',
    'Principles of Economics 3e',
    '3e',
    ['Steven A. Greenlaw', 'David Shapiro', 'Daniel MacDonald'],
    ['9781711471457', '9781951693633'],
    ['economics'],
  ),
  openstax(
    'principles-microeconomics-3e',
    'Principles of Microeconomics 3e',
    '3e',
    ['David Shapiro', 'Daniel MacDonald', 'Steven A. Greenlaw'],
    ['9781711471495', '9781951693657'],
    ['economics'],
  ),
  openstax(
    'principles-macroeconomics-3e',
    'Principles of Macroeconomics 3e',
    '3e',
    ['David Shapiro', 'Daniel MacDonald', 'Steven A. Greenlaw'],
    ['9781711471471', '9781951693640'],
    ['economics'],
  ),
  openstax(
    'principles-financial-accounting',
    'Principles of Accounting, Volume 1: Financial Accounting',
    null,
    ['Mitchell Franklin', 'Patty Graybeal', 'Dixon Cooper'],
    ['9781947172685', '9781947172678'],
    ['accounting'],
    'first-year',
    'Follows US GAAP; South African modules teach IFRS. Covers the same basics (double entry, statements), not the same standards.',
  ),
  openstax(
    'principles-managerial-accounting',
    'Principles of Accounting, Volume 2: Managerial Accounting',
    null,
    ['Mitchell Franklin', 'Patty Graybeal', 'Dixon Cooper'],
    ['9781947172609', '9781947172593'],
    ['accounting'],
  ),
  openstax(
    'principles-finance-2e',
    'Principles of Finance 2e',
    '2e',
    ['Julie Dahlquist', 'Rainford Knight'],
    ['9798319731555', '9798900950112'],
    ['finance'],
  ),
  openstax(
    'introduction-business-2e',
    'Introduction to Business 2e',
    '2e',
    [
      'Lawrence J. Gitman',
      'Carl McDaniel',
      'Amit Shah',
      'Monique Reece',
      'Linda Koffel',
      'Bethann Talsma',
      'James C. Hyatt',
    ],
    ['9798319713988'],
    ['business-management'],
    'first-year',
    'The API printed no digital ISBN for this edition.',
  ),
  openstax(
    'principles-management',
    'Principles of Management',
    null,
    ['David S. Bright', 'Anastasia H. Cortes', 'Eva Hartmann', 'K. Praveen Parboteeah'],
    ['9780998625768', '9780998625775'],
    ['business-management'],
    'first-year',
    'The API flags no senior author for this book: these are the first four authors it lists.',
  ),
  openstax(
    'principles-marketing',
    'Principles of Marketing',
    null,
    ['Dr. Maria Gomez Albrecht', 'Dr. Mark Green', 'Linda Hoffman'],
    ['9781711471518', '9781951693886'],
    ['marketing'],
  ),
  openstax(
    'foundations-information-systems',
    'Foundations of Information Systems',
    null,
    ['Dr. Mahesh S. Raisinghani'],
    ['9781711472959', '9781961584631'],
    ['information-systems'],
  ),
  // Computing
  openstax(
    'introduction-computer-science',
    'Introduction to Computer Science',
    null,
    ['Dr. Jean-Claude Franchitti'],
    ['9781711471839', '9781961584587'],
    ['computer-science'],
  ),
  openstax(
    'introduction-python-programming',
    'Introduction to Python Programming',
    null,
    ['Udayan Das', 'Aubrey Lawson', 'Chris Mayfield', 'Narges Norouzi'],
    ['9781961584457'],
    ['computer-science'],
    'first-year',
    'The API printed no print ISBN for this book. Useful only where the module teaches Python: check the outline.',
  ),
  // Humanities and social sciences
  openstax(
    'psychology-2e',
    'Psychology 2e',
    '2e',
    ['Rose M. Spielman', 'William J. Jenkins', 'Marilyn D. Lovett'],
    ['9781975076450', '9781951693237'],
    ['psychology'],
  ),
  openstax(
    'introduction-sociology-3e',
    'Introduction to Sociology 3e',
    '3e',
    ['Tonja R. Conerly', 'Kathleen Holmes', 'Asha Lal Tamang'],
    ['9781711493985', '9781951693367'],
    ['sociology'],
  ),
  openstax(
    'introduction-political-science',
    'Introduction to Political Science',
    null,
    ['Mark Carl Rom', 'Masaki Hidaka', 'Rachel Bzostek Walker'],
    ['9781711470689', '9781951693565'],
    ['political-science'],
  ),
  openstax(
    'introduction-philosophy',
    'Introduction to Philosophy',
    null,
    ['Nathan Smith'],
    ['9781711470795', '9781951693596'],
    ['philosophy'],
  ),
  openstax(
    'introduction-anthropology',
    'Introduction to Anthropology',
    null,
    ['Jennifer Hasty', 'David G. Lewis', 'Marjorie M. Snipes'],
    ['9781711494999', '9781951693992'],
    ['anthropology'],
  ),
  openstax(
    'writing-guide',
    'Writing Guide with Handbook',
    null,
    ['Michelle Bachelor Robinson', 'Maria Jerskey', 'featuring Toby Fulwiler'],
    ['9781711494852', '9781951693473'],
    ['academic-writing'],
  ),
  // Siyavula: bridging from school
  {
    sourceUrl: 'https://www.siyavula.com/read/za/mathematics/grade-12',
    academicYear: YEAR,
    id: 'siyavula-mathematics-grade-12',
    title: 'Mathematics Grade 12',
    authors: ['Siyavula'],
    edition: null,
    isbns: [],
    licence: 'cc-by-3.0',
    url: 'https://www.siyavula.com/read/za/mathematics/grade-12',
    subjectAreas: ['mathematics'],
    level: 'bridging',
    accessedOn: ACCESSED,
    note: SIYAVULA_NOTE,
  },
  {
    sourceUrl: 'https://www.siyavula.com/read/za/physical-sciences/grade-12',
    academicYear: YEAR,
    id: 'siyavula-physical-sciences-grade-12',
    title: 'Physical Sciences Grade 12',
    authors: ['Siyavula'],
    edition: null,
    isbns: [],
    licence: 'cc-by-3.0',
    url: 'https://www.siyavula.com/read/za/physical-sciences/grade-12',
    subjectAreas: ['physics', 'chemistry'],
    level: 'bridging',
    accessedOn: ACCESSED,
    note: SIYAVULA_NOTE,
  },
  // OpenUCT, UCT's own open repository
  {
    sourceUrl: 'https://open.uct.ac.za/items/dbd89bc1-5b4e-4d60-8f10-84b77f91cee9/full',
    academicYear: YEAR,
    id: 'openuct-introstat',
    title: 'INTROSTAT (Statistics textbook)',
    authors: ['Underhill, Les', 'Bradfield, Dave'],
    edition: null,
    isbns: [],
    licence: NC_SA,
    url: 'https://open.uct.ac.za/items/dbd89bc1-5b4e-4d60-8f10-84b77f91cee9',
    subjectAreas: ['statistics'],
    level: 'first-year',
    accessedOn: ACCESSED,
    note: 'dc.rights "Attribution-NonCommercial-ShareAlike 4.0 International"; dc.date.issued 2013; handle http://hdl.handle.net/11427/4150. No edition or ISBN printed.',
  },
  {
    sourceUrl: 'https://open.uct.ac.za/items/1b1b91a2-c2a0-42f9-a522-d96ba9b07d01/full',
    academicYear: YEAR,
    id: 'openuct-introduction-to-complex-numbers',
    title: 'Introduction to Complex Numbers',
    authors: ['Mokhithi, Mashudu', 'Shock, Jonathan'],
    edition: null,
    isbns: [],
    licence: 'cc-by-4.0',
    url: 'https://open.uct.ac.za/items/1b1b91a2-c2a0-42f9-a522-d96ba9b07d01',
    subjectAreas: ['mathematics'],
    level: 'first-year',
    accessedOn: ACCESSED,
    note: 'dc.rights.uri creativecommons.org/licenses/by/4.0; issued 2020-04; one chapter of "Introduction to University Level Mathematics for a South African Audience" (dc.source); subjects include MAM1000W, which no drafted curriculum holds. Handle https://hdl.handle.net/11427/31769.',
  },
];

// ---------------------------------------------------------------------------------------------
// Matches (D6): drafts, all "covers similar ground"
// ---------------------------------------------------------------------------------------------

const FROM_NAME =
  'Drafted from the module’s name in the faculty rule book only; a person checks the outline’s topics before verifying.';

/** A module's curated "covers similar ground" book, cited to the rule book that lists the module. */
function similar(
  universityId: UniversityId,
  moduleCode: string,
  moduleName: string,
  book: string,
  sourceUrl: string,
  extra?: string,
): BookMatch {
  return {
    sourceUrl,
    academicYear: YEAR,
    id: `${universityId}-${moduleCode.toLowerCase()}-${book}`,
    bookId: book,
    target: { universityId, moduleCode },
    kind: 'covers-similar-ground',
    note: `${moduleName}. ${FROM_NAME}${extra ? ` ${extra}` : ''}`,
  };
}

/** A subject area's curated book, cited to the book's own page. */
function forArea(area: SubjectArea, book: OpenBook): BookMatch {
  return {
    sourceUrl: book.sourceUrl,
    academicYear: YEAR,
    id: `area-${area}-${book.id}`,
    bookId: book.id,
    target: { subjectArea: area },
    kind: 'covers-similar-ground',
    note: `A general first-year ${area.replaceAll('-', ' ')} text, offered beside any module in the area. Not a prescribed book.`,
  };
}

const UCT_COMMERCE =
  'https://uct.ac.za/sites/default/files/media/documents/2026-commerce-handbook-6a-final-web.pdf';
const UCT_HUMANITIES =
  'https://uct.ac.za/sites/default/files/media/documents/2026-hum-handbook-9a-final-web.pdf';
const UCT_HEALTH =
  'https://uct.ac.za/sites/default/files/media/documents/2026-fhs-handbook-8a-final-web.pdf';
const UCT_HEALTH_ERRATA =
  'https://uct.ac.za/sites/default/files/media/documents/uct_ac_za/49/errata-in-the-health-sciences-undergraduate-handbook-v2-2026.docx';
const UCT_EBE =
  'https://uct.ac.za/sites/default/files/media/documents/2026-ebe-handbook-7a-final-web.pdf';
const WITS_BA =
  'https://www.wits.ac.za/media/wits-university/study/undergraduate/2026%20letter%20BA%20General%20(ABA00)%20first%20year.pdf';
const WITS_CLM =
  'https://www.wits.ac.za/media/wits-university/students/academic-matters/documents/CLM_eBook.pdf';
const WITS_SCIENCE =
  'https://www.wits.ac.za/media/wits-university/students/academic-matters/documents/HSCi_eBook.pdf';
const TUT_FEBE =
  'https://www.tut.ac.za/media/tshwane-interim/site-content/images/prospectus/Part4_FEBE_Prospectus.pdf';
const TUT_SCIENCE =
  'https://www.tut.ac.za/media/tshwane-interim/site-content/images/prospectus/Part8_Science.pdf';
const TUT_ECONOMICS =
  'https://www.tut.ac.za/media/tshwane-interim/site-content/images/prospectus/Part3_Economics-and-Finance_Prospectus.pdf';
const TUT_MANAGEMENT =
  'https://www.tut.ac.za/media/tshwane-interim/site-content/images/prospectus/Part7_Management-Sciences_Prospectus.pdf';
const UKZN_CAES = 'https://saa.ukzn.ac.za/wp-content/uploads/2026/07/CAES-2026.pdf';
const UKZN_HEALTH =
  'https://ww2.chs.ukzn.ac.za/wp-content/uploads/2026/01/Health-Sciences-HB-2026-1.pdf';
const UKZN_CLMS = 'https://clms.ukzn.ac.za/wp-content/uploads/2026/01/UKZN-CLMS-Handbook-2026.pdf';
const UKZN_HUMANITIES =
  'https://coh.ukzn.ac.za/wp-content/uploads/2026/02/Humanities-2026-Handbook-min.pdf';

const BRIDGING =
  'An augmented (extended) module: Siyavula’s Grade 12 book is for revising school work alongside it.';

const moduleMatches: BookMatch[] = [
  // UCT
  similar('uct', 'STA1000S', 'Introductory Statistics', 'openuct-introstat', UCT_COMMERCE),
  similar(
    'uct',
    'STA1000S',
    'Introductory Statistics',
    'openstax-introductory-statistics-2e',
    UCT_COMMERCE,
  ),
  similar(
    'uct',
    'ECO1010F',
    'Microeconomics',
    'openstax-principles-microeconomics-3e',
    UCT_COMMERCE,
  ),
  similar(
    'uct',
    'ECO1011S',
    'Macroeconomics',
    'openstax-principles-macroeconomics-3e',
    UCT_COMMERCE,
  ),
  similar(
    'uct',
    'ACC1006F',
    'Financial Accounting',
    'openstax-principles-financial-accounting',
    UCT_COMMERCE,
  ),
  similar(
    'uct',
    'SOC1001F',
    'Introduction to Sociology',
    'openstax-introduction-sociology-3e',
    UCT_HUMANITIES,
  ),
  similar(
    'uct',
    'PSY1004F',
    'Introduction to Psychology Part 1',
    'openstax-psychology-2e',
    UCT_HEALTH_ERRATA,
  ),
  similar(
    'uct',
    'PSY1010S',
    'Introduction to Psychology Part 2',
    'openstax-psychology-2e',
    UCT_HUMANITIES,
  ),
  similar(
    'uct',
    'HUB1019F',
    'Anatomy and Physiology IA',
    'openstax-anatomy-and-physiology-2e',
    UCT_HEALTH_ERRATA,
  ),
  similar(
    'uct',
    'HUB1020S',
    'Anatomy and Physiology IB',
    'openstax-anatomy-and-physiology-2e',
    UCT_HEALTH_ERRATA,
  ),
  similar('uct', 'CEM1011F', 'Chemistry for Medical Students', 'openstax-chemistry-2e', UCT_HEALTH),
  similar(
    'uct',
    'PHY1012F',
    'Physics A for Engineers',
    'openstax-university-physics-volume-1',
    UCT_EBE,
  ),
  similar('uct', 'MAM1020F', 'Mathematics IA for Engineers', 'openstax-calculus-volume-1', UCT_EBE),
  // Wits
  similar('wits', 'PSYC1009A', 'Psychology I', 'openstax-psychology-2e', WITS_BA),
  similar(
    'wits',
    'PHIL1003A',
    'Introduction to Philosophy – Knowledge & Reality I',
    'openstax-introduction-philosophy',
    WITS_BA,
  ),
  similar(
    'wits',
    'POLS1007A',
    'Introduction to Political Studies',
    'openstax-introduction-political-science',
    WITS_BA,
  ),
  similar(
    'wits',
    'ECON1012A',
    'Economics IA - Microeconomics',
    'openstax-principles-microeconomics-3e',
    WITS_CLM,
  ),
  similar(
    'wits',
    'ECON1014A',
    'Economics IB - Macroeconomics',
    'openstax-principles-macroeconomics-3e',
    WITS_CLM,
  ),
  similar(
    'wits',
    'ACCN1010A',
    'Financial Accounting I',
    'openstax-principles-financial-accounting',
    WITS_CLM,
  ),
  similar(
    'wits',
    'STAT1000A',
    'Business Statistics I',
    'openstax-introductory-business-statistics-2e',
    WITS_CLM,
  ),
  similar('wits', 'CHEM1048A', 'Chemistry I', 'openstax-chemistry-2e', WITS_SCIENCE),
  similar('wits', 'PHYS1008A', 'Physics I', 'openstax-university-physics-volume-1', WITS_SCIENCE),
  // TUT
  similar(
    'tut',
    'FAA115D',
    'Financial Accounting IA',
    'openstax-principles-financial-accounting',
    TUT_ECONOMICS,
  ),
  similar(
    'tut',
    'MIC115D',
    'Microeconomics I',
    'openstax-principles-microeconomics-3e',
    TUT_ECONOMICS,
  ),
  similar(
    'tut',
    'MAE115D',
    'Macroeconomic I',
    'openstax-principles-macroeconomics-3e',
    TUT_ECONOMICS,
  ),
  similar(
    'tut',
    'BSM115D',
    'Business Management I',
    'openstax-introduction-business-2e',
    TUT_ECONOMICS,
  ),
  similar(
    'tut',
    'BSM105D',
    'Business Management I',
    'openstax-principles-management',
    TUT_MANAGEMENT,
  ),
  similar('tut', 'MKT105D', 'Marketing I', 'openstax-principles-marketing', TUT_MANAGEMENT),
  similar('tut', 'GMB115P', 'General Microbiology', 'openstax-microbiology', TUT_SCIENCE),
  similar('tut', 'SEH115D', 'Chemistry', 'openstax-chemistry-2e', TUT_FEBE),
  similar('tut', 'SEP115D', 'Physics', 'openstax-college-physics-2e', TUT_FEBE),
  // UKZN
  similar(
    'ukzn',
    'STAT130',
    'Introduction to Statistics',
    'openstax-introductory-statistics-2e',
    UKZN_CAES,
  ),
  similar('ukzn', 'MATH130', 'Introduction to Calculus', 'openstax-calculus-volume-1', UKZN_CAES),
  similar(
    'ukzn',
    'PHYS110',
    'Mechanics, Optics and Thermal Physics',
    'openstax-university-physics-volume-1',
    UKZN_CAES,
  ),
  similar(
    'ukzn',
    'COMP100',
    'Introduction to Computer Science',
    'openstax-introduction-computer-science',
    UKZN_CAES,
  ),
  similar(
    'ukzn',
    'MATH195',
    'Introduction to Calculus – Augmented',
    'siyavula-mathematics-grade-12',
    UKZN_CAES,
    BRIDGING,
  ),
  similar(
    'ukzn',
    'PHYS195',
    'Mechanics, Optics & Thermal Physics – Augmented',
    'siyavula-physical-sciences-grade-12',
    UKZN_CAES,
    BRIDGING,
  ),
  similar(
    'ukzn',
    'CHEM195',
    'General Principles of Chemistry – Augmented',
    'siyavula-physical-sciences-grade-12',
    UKZN_CAES,
    BRIDGING,
  ),
  similar(
    'ukzn',
    'BIOL103',
    'Introductory Biology for Health Sciences',
    'openstax-concepts-biology',
    UKZN_HEALTH,
  ),
  similar('ukzn', 'HPHS1NU', 'Physiology 1', 'openstax-anatomy-and-physiology-2e', UKZN_HEALTH),
  similar(
    'ukzn',
    'ECON101',
    'Principles of Microeconomics',
    'openstax-principles-microeconomics-3e',
    UKZN_CAES,
  ),
  similar(
    'ukzn',
    'ECON102',
    'Principles of Macroeconomics',
    'openstax-principles-macroeconomics-3e',
    UKZN_CLMS,
  ),
  similar(
    'ukzn',
    'SOCY101',
    'Introduction to Sociology',
    'openstax-introduction-sociology-3e',
    UKZN_CLMS,
  ),
  similar(
    'ukzn',
    'POLS101',
    'Introduction to Political Science',
    'openstax-introduction-political-science',
    UKZN_CLMS,
  ),
  similar(
    'ukzn',
    'PSYC101',
    'Introduction to Psychology A',
    'openstax-psychology-2e',
    UKZN_HUMANITIES,
  ),
  similar(
    'ukzn',
    'PSYC102',
    'Introduction to Psychology B',
    'openstax-psychology-2e',
    UKZN_HUMANITIES,
  ),
];

/** One general book per subject area (the first-year books; bridging ones stay module-level). */
const areaMatches: BookMatch[] = openBooks
  .filter((b) => b.level === 'first-year' && b.id.startsWith('openstax-'))
  .flatMap((b) => b.subjectAreas.map((area) => forArea(area, b)));

export const bookMatches: BookMatch[] = [...moduleMatches, ...areaMatches];

// ---------------------------------------------------------------------------------------------
// Libraries (D7): each library's own search, linked to, never integrated
// ---------------------------------------------------------------------------------------------

export const libraryCatalogues: LibraryCatalogue[] = [
  {
    sourceUrl: 'https://www.wits.ac.za/library/',
    academicYear: YEAR,
    universityId: 'wits',
    name: 'Wits Library catalogue (e-Wits Catalogue)',
    searchUrl: 'https://innopac.wits.ac.za/search/?searchtype=X&searcharg={query}',
    accessedOn: ACCESSED,
    note: 'The library page links "e-Wits Catalogue" to https://innopac.wits.ac.za/ ("Search the Library Catalogue"). The keyword pattern returned results for "calculus" (1,235) on 2026-10-24. Wits also offers Summon (wits.summon.serialssolutions.com), not used here.',
  },
  {
    sourceUrl: 'https://ujlink.uj.ac.za/',
    academicYear: YEAR,
    universityId: 'uj',
    name: 'UJ Library catalogue (UJLink)',
    searchUrl: 'https://ujlink.uj.ac.za/search/?searchtype=X&searcharg={query}',
    accessedOn: ACCESSED,
    note: 'www.uj.ac.za/library refuses automated access, so the source is the catalogue itself (ujlink.uj.ac.za, UJ’s domain). A search snippet names https://www.uj.ac.za/library/information-resources/uj-library-catalogue/ as the library’s catalogue page: open it in a browser and check it links here. The pattern returned results for "calculus" (4,416) on 2026-10-24.',
  },
  {
    sourceUrl: 'https://www.library.up.ac.za/',
    academicYear: YEAR,
    universityId: 'up',
    name: 'UP Library (WorldCat Discovery)',
    searchUrl: 'https://univofpretoria.on.worldcat.org/search?queryString={query}',
    accessedOn: ACCESSED,
    note: 'The library page’s "Advanced Search" links https://univofpretoria.on.worldcat.org/advancedsearch. The search pattern is WorldCat Discovery’s standard one; the page loads by JavaScript, so research did not see results. Open it in a browser and check it searches.',
  },
  {
    sourceUrl: 'https://www.lib.uct.ac.za/',
    academicYear: YEAR,
    universityId: 'uct',
    name: 'UCT Libraries (Primo)',
    searchUrl:
      'https://uct.primo.exlibrisgroup.com/discovery/search?query=any,contains,{query}&vid=27UCT_INST:27UCT&sortby=rank',
    accessedOn: ACCESSED,
    note: 'The library page’s "Books, articles and more" links https://uct.primo.exlibrisgroup.com/discovery/search?vid=27UCT_INST:27UCT&sortby=rank; the query part is Primo’s standard one. Primo loads by JavaScript, so research did not see results. Open it in a browser and check it searches.',
  },
  {
    sourceUrl: 'https://library.ukzn.ac.za/',
    academicYear: YEAR,
    universityId: 'ukzn',
    name: 'UKZN Libraries (iCatalogue)',
    searchUrl: 'https://ukzn.on.worldcat.org/search?queryString={query}',
    accessedOn: ACCESSED,
    note: 'The library page’s "iCatalogue" links https://ukzn.on.worldcat.org/discovery. The search pattern is WorldCat Discovery’s standard one; the page loads by JavaScript, so research did not see results. Open it in a browser and check it searches.',
  },
];
