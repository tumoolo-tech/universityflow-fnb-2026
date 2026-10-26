import type { Bursary } from '../bursary';

/**
 * Well-known bursaries for school leavers and first-year students, beside NSFAS (data/support.ts).
 *
 * DRAFT: researched on 2026-10-25 from each funder's own page, or from the administrator the funder
 * names (StudyTrust). Only what that page prints is recorded; a window it doesn't date is said in
 * its own words (`windowNote`). None is verified: a person checks each against its source and adds
 * verifiedOn / verifiedBy (docs/verification/bursaries.md). Agents never do.
 *
 * Left out after research (no current page of the funder's own could be read): Eskom (its careers
 * site was down for maintenance), Transnet (no bursary page found on transnet.net), SANRAL (its
 * newest brochure is for the 2025 academic year), Anglo American (no current page found), and
 * Standard Bank (its bursary starts in the second year, not for school leavers).
 */
export const bursaries: Bursary[] = [
  {
    // Dates and how to apply: this page. Who, fields, what it covers and the teaching obligation:
    // its FAQ, https://www.funzalushaka.doe.gov.za/Home/Faq (questions 7, 8, 15, 20, 29, 31-33, 36).
    sourceUrl: 'https://www.funzalushaka.doe.gov.za/',
    academicYear: 2027,
    id: 'funza-lushaka',
    name: 'Funza Lushaka Bursary',
    funder: 'Department of Basic Education',
    funderKind: 'government',
    who: [
      'South African citizens with a valid South African ID number',
      'Accepted into a BEd or PGCE qualification at an accredited public university',
      'All first-time applicants must be 30 years or younger',
      'Good academic ability and a commitment to teaching',
    ],
    fields: ['teaching'],
    fieldsAsPrinted:
      'Bachelor of Education (BEd) and the Postgraduate Certificate in Education (PGCE), with preference for priority areas such as Foundation Phase (with preference for South African Indigenous Languages), Languages, Mathematics, Natural Science and Technology, Accounting, Physical Sciences and Information Technology',
    covers:
      'Expenses covered may include tuition fees, accommodation including meals, books and learning materials, and, if possible, a small monthly living allowance. Each allocation is capped, and costs above the cap are the student’s to pay.',
    opensOn: '2026-10-01',
    closesOn: '2027-01-31',
    windowNote:
      'New applications close on 31 January 2027. Re-applications from current bursars close on 30 November 2026.',
    howToApply:
      'Register and log in on the government e-Services portal, choose the Funza Lushaka Bursary Scheme, enter the one-time PIN, accept the terms and complete the 2027 application.',
    applyUrl: 'https://www.eservices.gov.za/',
    workBack: {
      kind: 'required',
      terms:
        'Teach one year for every year the bursary was received, taking up a teaching post straight after qualifying. Not meeting the conditions can mean repaying the bursary in full, with interest.',
    },
  },
  {
    sourceUrl: 'https://www.isfap.org.za/students',
    academicYear: 2027,
    id: 'isfap',
    name: 'ISFAP funding',
    funder: 'Ikusasa Student Financial Aid Programme (ISFAP)',
    funderKind: 'partnership',
    who: [
      'South African citizens',
      'Enrolled or planning to enrol at an accredited South African university',
      'Studying for a qualification in an Occupation of High Demand',
      'Financial need, shown through means testing',
      'Keeping up academic performance standards, and committed to completing your studies',
    ],
    fields: ['accounting', 'commerce', 'science', 'engineering', 'technology', 'health'],
    fieldsAsPrinted:
      'Occupations of High Demand: actuaries, accountants, data scientists, engineers, IT professionals, medical doctors, nurses and related fields',
    covers:
      'Funding plus wraparound support: tutoring and mentorship, psychosocial counselling, career guidance and skills development.',
    opensOn: null,
    closesOn: null,
    windowNote: 'The page publishes no opening or closing date.',
    howToApply: 'Apply online on ISFAP’s application site.',
    applyUrl: 'https://applyonline.isfap.org.za/',
    workBack: { kind: 'not-stated', terms: null },
  },
  {
    sourceUrl: 'https://www.saica.org.za/initiatives/thuthuka/apply-to-the-thuthuka-bursary-fund',
    academicYear: 2027,
    id: 'thuthuka',
    name: 'Thuthuka Bursary',
    funder: 'South African Institute of Chartered Accountants (SAICA)',
    funderKind: 'professional-body',
    who: [
      'South African citizens who are Black African or Coloured',
      'In Grade 12, out of school for no more than two years, or already in a CA-stream BCom degree',
      'At least 60% (level 5) in Mathematics in Grade 11',
      'Applied, or applying, for a CA-stream BCom Accounting degree at a university offering the Thuthuka programme',
      'A combined family income of R350 000 a year or less',
      'Apply for and write the National Benchmark Tests (NBT) before the end of August, or submit existing results',
    ],
    fields: ['accounting'],
    fieldsAsPrinted: 'Undergraduate BCom Accounting degrees (CA stream), towards becoming a CA(SA)',
    covers:
      'Tuition, books, meals, residence fees and accommodation, with academic, social and emotional support, work-readiness training, mentoring and counselling.',
    opensOn: null,
    closesOn: null,
    windowNote:
      'The page prints no opening or closing date. The NBT must be written before the end of August.',
    howToApply: 'Apply through the Thuthuka Bursary Fund link on SAICA’s page.',
    applyUrl: 'https://www.saica.org.za/initiatives/thuthuka/apply-to-the-thuthuka-bursary-fund',
    workBack: { kind: 'not-stated', terms: null },
  },
  {
    // Sasol's media release of 2 April 2026.
    sourceUrl:
      'https://www.sasol.com/media-centre/media-releases/sasol-bursaries-now-open-applications-invited-for-2027-engineering-and-science-studies',
    academicYear: 2027,
    id: 'sasol',
    name: 'Sasol Bursary Programme',
    funder: 'Sasol',
    funderKind: 'corporate',
    who: [
      'South African citizens by birth who live permanently in South Africa',
      'Registered in 2027 for full-time undergraduate study at a Sasol-approved public university in South Africa (not UNISA)',
      'First-year applicants are assessed on their Grade 12 results',
      'BEng and BScEng: Mathematics and Physical Science at level 6 (70–79%), and English at level 5 (60–69%) as a home or first additional language, or level 4 (50–59%) as a second additional language',
      'BEng Tech (Mine Surveying only): Mathematics and Physical Science at level 5 (60–69%), and English at the same levels',
    ],
    fields: ['engineering', 'science', 'technology'],
    fieldsAsPrinted:
      'Chemical, Civil, Electrical, Electronic, Industrial, Mechanical, Mining and Metallurgical Engineering; Chemistry and Metallurgy (Honours required); Geology (Honours mandatory); Data Science (Computer Science, Mathematics, Operations Research or Statistics); Mine Surveying (University of Johannesburg only)',
    covers: 'Tuition and a living allowance, with psychosocial support.',
    opensOn: '2026-04-01',
    closesOn: '2026-05-17',
    windowNote: 'Outcomes are communicated at the end of September 2026.',
    howToApply: 'Apply at sasolbursaries.com and complete the online psychometric tests.',
    applyUrl: 'https://www.sasolbursaries.com/',
    workBack: { kind: 'not-stated', terms: null },
  },
  {
    sourceUrl: 'https://allangrayorbis.org/programmes/fellowship/',
    academicYear: 2027,
    id: 'allan-gray-orbis',
    name: 'Allan Gray Orbis Fellowship',
    funder: 'Allan Gray Orbis Foundation',
    funderKind: 'foundation',
    who: [
      'South African citizens in Grade 12 in the year of application, and under 21 that year',
      'Final Grade 11 results: at least 60% in Pure Mathematics or at least 80% in Mathematical Literacy',
      'Final Grade 11 results: an average of at least 70%, excluding Life Orientation',
    ],
    fields: ['commerce', 'science', 'engineering', 'law', 'humanities', 'arts', 'health'],
    fieldsAsPrinted:
      'Commerce, Science, Engineering, Law, Humanities, Arts and Health Science degrees (not Medicine, Veterinary Science or Dentistry) at Wits, UJ, UCT, NMU, RU, UWC, SU, UP, UFS, UKZN or TSiBA',
    covers:
      'Households earning R1 million a year or less: full funding for university accommodation, meals, textbooks and a tutoring allowance, and a monthly stipend. Above that: needs-based funding.',
    opensOn: null,
    closesOn: '2026-04-30',
    windowNote:
      'Grade 12 applications closed on 30 April 2026 at 17:00, with interviews in July and a selection camp in September 2026. The page prints no opening date.',
    howToApply:
      'Apply online, by hand or by post, with a certified copy of your most recent final Grade 11 report and of your ID.',
    applyUrl: 'https://allangrayorbis.org/programmes/fellowship/',
    workBack: { kind: 'not-stated', terms: null },
  },
  {
    sourceUrl: 'https://www.moshalprogram.org.za/candidates/',
    academicYear: 2027,
    id: 'moshal',
    name: 'Moshal Program scholarship',
    funder: 'Moshal Program',
    funderKind: 'foundation',
    who: [
      'A household income of up to R200 000 a year (before deductions)',
      'At least 70% for English, Maths, and Physics or Accounting',
      'Accepted at an institution the program funds',
      'An in-person interview and successful selection',
    ],
    fields: ['health', 'technology', 'engineering', 'science', 'commerce', 'accounting'],
    fieldsAsPrinted:
      'Medicine (MBChB), Pharmacy (UKZN only), Veterinary Science; Computer Science, Data Science, Information Science, Information Systems, Information Technology; Biomedical, Chemical, Civil, Electrical, Electronic, Mechanical and Mechatronic Engineering; Actuarial Science, Econometrics, Mathematics, Statistics; Accounting, Economics, Financial Sciences, Investment Management, Management Sciences; at UCT, SUN, UWC, Wits, UP, UKZN, UFS and UJ (subject to change at the program’s discretion)',
    covers:
      'A full funding scholarship with living and meal allowances, personal support from a Program Coordinator, professional workshops, training and mentoring, and career guidance.',
    opensOn: null,
    closesOn: null,
    windowNote: 'The page says applications are open, but prints no closing date.',
    howToApply:
      'Complete the online application form; shortlisted applicants are interviewed in person.',
    applyUrl: 'https://moshal-sa.formtitan.com/ftproject/ftaafc8724957246d9a1811a1d925f4480',
    workBack: { kind: 'not-stated', terms: null },
  },
  {
    sourceUrl: 'https://studytrust.org.za/fref-bursary/',
    academicYear: 2027,
    id: 'firstrand-empowerment-foundation',
    name: 'FirstRand Empowerment Foundation Undergraduate Bursary',
    funder: 'FirstRand Empowerment Foundation',
    funderKind: 'foundation',
    administeredBy: 'StudyTrust',
    who: [
      'Black South African citizens, as defined by the BBBEE Act',
      'Not older than 21 in the first year of study',
      'At least level 5 for Mathematics in Grade 12',
      'A combined gross family income of up to R700 000 a year',
      'Starting a first degree in 2027: in Grade 12 now, or finished Grade 12 not more than 3 years ago',
      'Full-time study at a South African public traditional university',
    ],
    fields: [
      'agriculture',
      'commerce',
      'accounting',
      'engineering',
      'science',
      'technology',
      'law',
      'humanities',
      'arts',
      'health',
    ],
    fieldsAsPrinted:
      'Agricultural Sciences; Commercial Sciences (Accounting, Actuarial Science, Economics, Financial Management); Engineering; Environmental Sciences (Climate Sciences, Renewable Energy); Information Sciences; Mathematical Sciences; Natural Sciences (Biosciences, Electronics, Physics); Social Sciences and Law; Arts (Psychology, Digital Arts, Fine Arts, Multimedia, Architecture, Art and Design); Health Sciences (Medicine, Nursing, Physiotherapy, Occupational Therapy, Public Health, Pharmacy)',
    covers:
      'Tuition fees, accommodation, meals, learning resources, a monthly stipend, and a computer for first-year students.',
    opensOn: null,
    closesOn: null,
    windowNote: 'Application season: 01 June to 30 September (the page prints no year).',
    howToApply:
      'Apply on StudyTrust’s online application platform, after reading its Bursary Applications page.',
    applyUrl: 'https://studytrust.org.za/bursary-applications/',
    workBack: { kind: 'not-stated', terms: null },
  },
  {
    sourceUrl: 'https://studytrust.org.za/investec/',
    academicYear: 2027,
    id: 'investec-csi',
    name: 'Investec CSI Bursary',
    funder: 'Investec',
    funderKind: 'corporate',
    administeredBy: 'StudyTrust',
    who: [
      'South African citizens',
      'In Grade 12, in a gap year after Grade 12, or in the first year of university',
      'Grade 12: at least 60% in all subjects, at least 70% in Mathematics (not Mathematical Literacy), and 70% in English First Additional Language or 65% in English Home Language',
      'First year: an average above 60% in the first-semester examinations',
      'Financial need',
    ],
    fields: ['commerce', 'engineering', 'technology', 'law', 'health'],
    fieldsAsPrinted:
      'Commerce, Business Science, Engineering, Computer Science, Information Technology, a Commercial LLB, or Medicine (MBChB); not at private tertiary institutions',
    covers: 'Full-cost bursaries.',
    opensOn: null,
    closesOn: null,
    windowNote:
      'Application season: 01 June to 30 September, for a bursary for the next year (the page prints no year).',
    howToApply:
      'Apply on StudyTrust’s online application platform, with all supporting documents certified.',
    applyUrl: 'https://studytrust.org.za/bursary-applications/',
    workBack: { kind: 'not-stated', terms: null },
  },
  {
    sourceUrl: 'https://studytrust.org.za/old-mutual/',
    academicYear: 2027,
    id: 'old-mutual-imfundo-trust',
    name: 'Old Mutual Investment Group Imfundo Trust Scholarship',
    funder: 'Old Mutual Investment Group Imfundo Trust',
    funderKind: 'corporate',
    administeredBy: 'StudyTrust',
    who: [
      'South African citizens in their first or second year of study in 2027',
      'Grade 12 applicants: an average of at least 70% in the mid-year Grade 12 examinations, with at least 70% in Mathematics and 70% in English First Additional Language or 60% in English Home Language',
      'Current first-years: an average of 65% or more in the latest (mid-year) examinations',
      'Preference for applicants from rural and township backgrounds',
    ],
    fields: ['commerce', 'technology', 'science', 'engineering'],
    fieldsAsPrinted:
      'Business, Commerce, Finance and Management Sciences; Computer Science and related qualifications; Data Science; Engineering',
    covers: null,
    opensOn: null,
    closesOn: null,
    windowNote: 'Application season: 01 June to 30 September (the page prints no year).',
    howToApply:
      'Apply on StudyTrust’s online application platform. Shortlisted applicants are interviewed.',
    applyUrl: 'https://studytrust.org.za/bursary-applications/',
    workBack: { kind: 'not-stated', terms: null },
  },
  {
    sourceUrl: 'https://group.nedbank.co.za/careers/graduates-and-bursaries.html',
    academicYear: 2027,
    id: 'nedbank',
    name: 'Nedbank External Bursary Programme',
    funder: 'Nedbank',
    funderKind: 'corporate',
    who: [
      'South African citizens who intend to study for an undergraduate or honours degree',
      'An average of 65% in the year of applying',
      'A proven financial need, as determined by household income',
      'Applicants who completed Grade 12 with Mathematical Literacy will not qualify',
      'Admission to a South African public university or university of technology for the qualification',
    ],
    fields: ['science', 'technology', 'engineering'],
    fieldsAsPrinted:
      'Science, technology, engineering, mathematics (STEM) or green economy development',
    covers: 'Financing for full-time study for those who are in need.',
    opensOn: null,
    closesOn: null,
    windowNote:
      'Applications for the 2027 academic year are closed. Applications for the 2028 academic year open in 2027.',
    howToApply:
      'Apply online through the link on Nedbank’s page; incomplete applications are rejected.',
    applyUrl: 'https://group.nedbank.co.za/careers/graduates-and-bursaries.html',
    workBack: { kind: 'not-stated', terms: null },
  },
];
