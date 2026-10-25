/**
 * Builds the owner's verification checklists (docs/verification/<file>.md) from the catalogue.
 *
 * Pure functions only: give `renderChecklists` the loaded catalogue and it returns
 * `{ fileName: markdown }`. Nothing here writes to the catalogue; the CLI in
 * generate-checklists.mjs writes the markdown files and nothing else.
 *
 * Every value in a table is read from the data, never typed by hand, so the checklists can't
 * drift from what a learner would see. Ticks the owner has made survive a regeneration only
 * while the row they ticked is unchanged: if a value changes, its box clears, because the new
 * value hasn't been checked.
 */

import { collegeChecklists, collegeRecordKeys } from './college-checklists.mjs';

export const UNCHECKED = '☐';
/** Marks the owner may put in a box: matches the source, or differs from it. */
export const CHECKED_MARKS = ['☑', '☒'];

/**
 * Open questions in docs/data-verification.md and docs/verification/open-questions.md, by the
 * record they affect. Keys are record keys (see `recordKey`); the test proves every key exists.
 */
export const OPEN_QUESTIONS = {
  'method:ukzn-aps': [1],
  'university:uj': [2],
  'window:uj': [2],
  'programmes:uj': [2, 5],
  'uj-bnursing': [3],
  'uj-beng-civil': [4],
  'uj-beng-electrical': [4],
  'method:wits-aps': [6, 7],
  'window:wits': [8],
  'wits-mbbch': [9],
  'wits-bpharm': [9],
  'wits-bnurs': [9],
  'method:up-aps': [10],
  'window:up': [11],
  'uct-bsceng-civil': [12],
  'uct-mbchb': [13],
  'uct-bsc-physiotherapy': [13],
  'method:tut-aps': [14],
  'tut-bed-foundation-phase': [15],
  'window:ukzn': [16],
  nsfas: [17],
  'helplines:all': [18],
  'exams:all': [19, 21],
  'nsc-2026-physical-sciences-p2': [20],
  'practice:all': [22],
};

const UNIVERSITY_FILES = ['wits', 'uj', 'up', 'uct', 'tut', 'ukzn'];

/** Every record key the catalogue holds, so tests can prove none is left out. */
export function allRecordKeys(raw, methods) {
  return [
    ...raw.universities.map((u) => `university:${u.id}`),
    ...raw.windows.map((w) => `window:${w.universityId}`),
    ...raw.programmes.map((p) => p.id),
    'nsfas',
    ...raw.helplines.map((h) => h.id),
    ...methods.map((m) => `method:${m.id}`),
    ...(raw.examPapers ?? []).map((p) => p.id),
    ...(raw.practice ?? []).map((r) => r.id),
    ...(raw.campuses ?? []).map((c) => c.id),
    ...(raw.places ?? []).map((p) => p.id),
    ...(raw.facultyOffices ?? []).map((o) => o.id),
    ...(raw.registrationCalendars ?? []).map(calendarKey),
    ...(raw.curricula ?? []).map(curriculumKey),
    ...(raw.safetyAdvice ?? []).map((a) => a.id),
    // Phase 6d: free books (prefixed: a match id could otherwise read like a programme id).
    ...(raw.openBooks ?? []).map((b) => `book:${b.id}`),
    ...(raw.bookMatches ?? []).map((m) => `book-match:${m.id}`),
    ...(raw.libraryCatalogues ?? []).map((l) => `library:${l.universityId}`),
    // Phase 6a: how marks work.
    ...(raw.assessmentRules ?? []).map((r) => r.id),
    ...(raw.moduleAssessments ?? []).map(moduleAssessmentKey),
    ...(raw.academicCalendars ?? []).map(academicCalendarKey),
    // Public TVET colleges (planning.md §19.1): register, site, programme and teach-out records.
    ...collegeRecordKeys(raw),
  ];
}

/** A module scheme's record key: one per university, module, year (and faculty, when labelled). */
export const moduleAssessmentKey = (m) =>
  `module-assessment:${m.universityId}:${m.code}:${m.academicYear}${m.faculty ? `:${m.faculty}` : ''}`;
/** An academic calendar's record key: one per university and academic year. */
export const academicCalendarKey = (c) => `exam-dates:${c.universityId}:${c.academicYear}`;

/** A registration calendar's record key: one per university and academic year. */
export const calendarKey = (c) => `calendar:${c.universityId}:${c.academicYear}`;
/** A curriculum's record key: one per programme and rule-book year. */
export const curriculumKey = (c) => `curriculum:${c.programmeId}:${c.academicYear}`;

/** Safety places, as `SAFETY_PLACE_KINDS` in packages/catalogue/src/basics.ts (test-checked). */
export const SAFETY_KINDS = ['clinic', 'counselling', 'security'];

/** Markdown-safe table cell: no pipes, no line breaks. */
export function cell(value) {
  if (value === null || value === undefined) return '_(none)_';
  const text = String(value);
  if (text.trim() === '') return '_(empty)_';
  return text.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

/** Finds the 1-based line of the first line containing `needle`, or null. */
export function lineOf(source, needle) {
  const index = source.lines.findIndex((line) => line.includes(needle));
  return index === -1 ? null : index + 1;
}

/**
 * The doc comment that states a score method's rule in methods.ts: the nearest `/** … *\/`
 * above the `export const` that declares the method with this id.
 */
export function methodRule(source, id) {
  const idLine = source.lines.findIndex((line) => line.includes(`id: '${id}'`));
  if (idLine === -1) return null;
  let i = idLine;
  while (i >= 0 && !source.lines[i].startsWith('export const')) i--;
  while (i >= 0 && !source.lines[i].trim().endsWith('*/')) i--;
  const end = i;
  while (i >= 0 && !source.lines[i].trim().startsWith('/**')) i--;
  if (i < 0) return null;
  return source.lines
    .slice(i, end + 1)
    .map((line) =>
      line
        .trim()
        .replace(/^\/\*\*\s?|\s?\*\/$/g, '')
        .replace(/^\*\s?/, ''),
    )
    .filter((line) => line !== '')
    .join(' ');
}

function where(source, needle) {
  const line = lineOf(source, needle);
  return line === null ? `\`${source.path}\`` : `\`${source.path}:${line}\``;
}

function questionsFor(...keys) {
  const numbers = [...new Set(keys.flatMap((k) => OPEN_QUESTIONS[k] ?? []))].sort((a, b) => a - b);
  if (numbers.length === 0) return '';
  const links = numbers.map((n) => `[Q${n}](open-questions.md#q${n})`).join(', ');
  return `> **Settle first:** open question${numbers.length > 1 ? 's' : ''} ${links}.\n`;
}

function status(record) {
  if (record.verifiedOn && record.verifiedBy) {
    return `Verified on ${record.verifiedOn} by ${record.verifiedBy}`;
  }
  return 'DRAFT (no verifiedOn / verifiedBy)';
}

/** Human names for subject lists, collapsing the language groups the data files use. */
export function subjectNamer(subjects, languages) {
  const names = new Map(subjects.map((s) => [s.id, s.name]));
  const hl = languages.map(([id]) => `${id}-hl`);
  const fal = languages.map(([id]) => `${id}-fal`);
  return (ids) => {
    let rest = [...ids];
    const groups = [];
    const take = (group, label) => {
      if (group.every((id) => rest.includes(id))) {
        rest = rest.filter((id) => !group.includes(id));
        groups.push(label);
      }
    };
    take([...hl, ...fal], 'any official language (Home or First Additional)');
    take(hl, 'any Home Language');
    take(fal, 'any First Additional Language');
    return [...rest.map((id) => names.get(id) ?? id), ...groups].join(' or ');
  };
}

function minimum({ minLevel, minPercent }) {
  const parts = [];
  if (minLevel !== undefined) parts.push(`level ${minLevel}`);
  if (minPercent !== undefined) parts.push(`${minPercent}%`);
  return parts.join(' and ');
}

/** One subject requirement as words, e.g. "Mathematics level 5 OR Mathematical Literacy level 6". */
export function describeRequirement(requirement, nameOf) {
  if ('otherSubjects' in requirement) {
    const o = requirement.otherSubjects;
    return `any ${o.count} other subject${o.count > 1 ? 's' : ''} (not Life Orientation, not already counted) at ${minimum(o)}`;
  }
  return requirement.options
    .map((option) => `${nameOf(option.subjects)} at ${minimum(option)}`)
    .join(' **OR** ');
}

const HEADER =
  '| Field | Value in the data | Source says (only if different) | ✓ |\n|---|---|---|---|';

function row(field, value) {
  return `| ${cell(field)} | ${cell(value)} |  | ${UNCHECKED} |`;
}

function recordFooter(key) {
  return [
    row(
      'Whole record matches the source',
      'Then add `verifiedOn` and `verifiedBy` ([how](README.md#how-to-record-a-verification-the-exact-edit))',
    ),
    '',
    `<!-- record:${key} -->`,
    '',
  ].join('\n');
}

function provenanceRows(record) {
  return [
    row('sourceUrl (opens?)', record.sourceUrl),
    row('academicYear', record.academicYear),
    `| Status | ${cell(status(record))} | — | — |`,
  ];
}

function universitySection(u, sources, sourceKey) {
  const key = `university:${u.id}`;
  return [
    `## University record: \`${u.id}\``,
    '',
    `Edit at ${where(sources[sourceKey], `export const ${u.id}: University`)}.`,
    '',
    questionsFor(key),
    HEADER,
    ...provenanceRows(u),
    row('name', u.name),
    row('shortName', u.shortName),
    row('city', u.city),
    row('province', u.province),
    row('applicationRoute', u.applicationRoute),
    row('applyUrl (opens, right page?)', u.applyUrl),
    recordFooter(key),
  ].join('\n');
}

function windowSection(w, sources, sourceKey) {
  const key = `window:${w.universityId}`;
  return [
    `## Application window: \`${w.universityId}\``,
    '',
    `Edit at ${where(sources[sourceKey], `export const ${w.universityId}Window`)}.`,
    '',
    questionsFor(key),
    HEADER,
    ...provenanceRows(w),
    row('opensOn', w.opensOn),
    row('closesOn', w.closesOn),
    ...(w.earlierClosings.length === 0
      ? [row('earlierClosings', 'none')]
      : w.earlierClosings.map((e) => row(`earlier closing: ${e.scope}`, e.closesOn))),
    row('grade11ResultsAccepted', w.grade11ResultsAccepted ? 'yes' : 'no'),
    row('feeZar (rand)', w.feeZar),
    row('feeNote', w.feeNote),
    recordFooter(key),
  ].join('\n');
}

function methodSection(m, isDefault, sources) {
  const key = `method:${m.id}`;
  return [
    `## Score method: \`${m.id}\`${isDefault ? ' (default for this university)' : ''}`,
    '',
    `Rule and quoted wording at ${where(sources.methods, `id: '${m.id}'`)}; worked examples in \`packages/admissions/src/universities/methods.test.ts\`. Re-run \`pnpm --filter @universityflow/admissions test\` after any change.`,
    '',
    questionsFor(key),
    HEADER,
    ...provenanceRows(m.source),
    row('label', m.label),
    row('unit', m.unit),
    row('maximum', m.maximum),
    row(
      'rule as the code states it (subjects counted, Life Orientation, points table)',
      methodRule(sources.methods, m.id),
    ),
    row(
      'worked example printed in the prospectus is reproduced in methods.test.ts',
      're-run the test',
    ),
    recordFooter(key),
  ].join('\n');
}

function programmeSection(p, sources, sourceKey, nameOf, defaultMethod) {
  const rows = [
    ...provenanceRows(p),
    row('name', p.name),
    row('faculty', p.faculty),
    row('qualification', p.qualification),
    row('durationYears', p.durationYears),
    row('minimumScore', p.minimumScore),
  ];
  if (p.minimumScoreWithMathematicalLiteracy !== undefined) {
    rows.push(row('minimumScoreWithMathematicalLiteracy', p.minimumScoreWithMathematicalLiteracy));
  }
  rows.push(row('score method', p.scoreMethod ?? `${defaultMethod} (university default)`));
  for (const b of p.scoreBands ?? []) {
    rows.push(
      row(
        `band ${b.band}`,
        `${b.threshold ?? 'range in words'} (${b.basis === 'score' ? 'plain score' : 'weighted score'}); ${b.who}; ${b.outcome}`,
      ),
    );
  }
  rows.push(row('requiredPass', p.requiredPass));
  if (p.subjectRequirements.length === 0) {
    rows.push(row('subject requirements', 'none'));
  }
  p.subjectRequirements.forEach((r, i) => {
    rows.push(row(`subject requirement ${i + 1}`, describeRequirement(r, nameOf)));
  });
  rows.push(row('nbt', p.nbt));
  rows.push(row('selection (quoted faithfully?)', p.selection));
  rows.push(row('closesOn (programme-specific)', p.closesOn));
  return [
    `### \`${p.id}\``,
    '',
    `${cell(p.name)}. Edit at ${where(sources[sourceKey], `id: '${p.id}'`)}. Source: <${p.sourceUrl}>`,
    '',
    questionsFor(p.id),
    HEADER,
    ...rows,
    recordFooter(p.id),
  ].join('\n');
}

const NOT_PUBLISHED = 'not published';

function optionalRow(field, value) {
  return value === undefined ? [] : [row(field, value)];
}

function campusSection(c, source) {
  return [
    `### Campus: \`${c.id}\``,
    '',
    `${cell(c.name)}. Edit at ${where(source, `id: '${c.id}'`)}.`,
    '',
    HEADER,
    ...provenanceRows(c),
    row('name', c.name),
    row('city', c.city),
    ...optionalRow('mapUrl (the university’s own map? opens?)', c.mapUrl),
    ...optionalRow('virtualTourUrl (the university’s own tour? opens?)', c.virtualTourUrl),
    recordFooter(c.id),
  ].join('\n');
}

const latLng = (c) => c && `${c.lat}, ${c.lng}`;

function placeSection(p, source, { mapsLink, walkingLink, streetViewLink }) {
  const safety = SAFETY_KINDS.includes(p.kind);
  // A13-11, gotcha 40: what the source doesn't print is said to be unpublished, never left blank.
  const locationRows = p.location
    ? [
        ...optionalRow('location: search text', p.location.query),
        ...optionalRow('location: coordinates', latLng(p.location.coordinates)),
        row('open in maps (lands on the right building?)', mapsLink(p.location)),
        // "See it" (5e-1): only with coordinates, as learners get it.
        ...optionalRow(
          'see it: Street View (shows the right spot?)',
          streetViewLink(p.location) ?? undefined,
        ),
      ]
    : [row('location', NOT_PUBLISHED)];
  // 5e-1 and 5e-4: rarely published, so said to be unpublished, for a walk-through to fill.
  const entrance = p.accessibleEntrance;
  const accessRows = [
    ...(entrance
      ? [
          ...optionalRow('step-free entrance: search text', entrance.location.query),
          ...optionalRow('step-free entrance: coordinates', latLng(entrance.location.coordinates)),
          ...optionalRow('step-free entrance: description', entrance.description),
          row('step-free route (walks to the right door?)', walkingLink(entrance.location)),
        ]
      : [row('step-free entrance', NOT_PUBLISHED)]),
    row(
      p.arrivalNote ? 'arrival note (walk it: still true?)' : 'arrival note',
      p.arrivalNote ?? NOT_PUBLISHED,
    ),
    ...optionalRow('arrival note source (check the note on this page)', p.arrivalSourceUrl),
  ];
  return [
    `### Place: \`${p.id}\``,
    '',
    `${cell(p.name)} (${p.kind}) on \`${p.campusId}\`. Edit at ${where(source, `id: '${p.id}'`)}.`,
    '',
    safety
      ? '> **Safety record.** Learners see it only once verified, and the crisis card may show it. Check the number on the university’s own page, dial-test it, and re-check it every release (like the helplines).\n'
      : '',
    HEADER,
    ...provenanceRows(p),
    row('kind', p.kind),
    row('name', p.name),
    row('where (building, room)', p.where ?? NOT_PUBLISHED),
    ...optionalRow('hours', p.hours),
    ...optionalRow(safety ? 'phone (dial-tested?)' : 'phone', p.phone),
    ...optionalRow('phone source (check the number on this page)', p.phoneSourceUrl),
    ...locationRows,
    ...accessRows,
    ...optionalRow('note', p.note),
    recordFooter(p.id),
  ].join('\n');
}

function facultyOfficeSection(o, source) {
  return [
    `### Faculty office: \`${o.id}\``,
    '',
    `${cell(o.faculty)}. Edit at ${where(source, `id: '${o.id}'`)}.`,
    '',
    HEADER,
    ...provenanceRows(o),
    row('faculty (as the programmes spell it)', o.faculty),
    ...optionalRow('campusId', o.campusId),
    row('where (building, room)', o.where),
    row('contactUrl (opens?)', o.contactUrl),
    ...optionalRow('email', o.email),
    ...optionalRow('phone', o.phone),
    ...optionalRow('hours', o.hours),
    recordFooter(o.id),
  ].join('\n');
}

function calendarSection(c, source) {
  const key = calendarKey(c);
  return [
    `### Registration calendar: \`${key}\``,
    '',
    `Edit at ${where(source, 'firstYearRegistration')}.`,
    '',
    HEADER,
    ...provenanceRows(c),
    row(
      'first-year registration',
      c.firstYearRegistration.from
        ? `${c.firstYearRegistration.from} to ${c.firstYearRegistration.to}`
        : `closes ${c.firstYearRegistration.to} (opening date not published)`,
    ),
    ...(c.changeDeadlines.length === 0
      ? [row('last day to change modules', 'not published')]
      : c.changeDeadlines.map((d) =>
          row(`last day to change modules (${d.appliesTo})`, d.lastDay),
        )),
    ...optionalRow(
      'orientation week',
      c.orientation && `${c.orientation.from} to ${c.orientation.to}`,
    ),
    ...optionalRow('note', c.note),
    recordFooter(key),
  ].join('\n');
}

/** What an elective group asks for, in the verifier's words. */
function groupRule(g) {
  if ('oneSetOf' in g.choose) {
    const sets = g.choose.oneSetOf.map((set) => `(${set.join(' and ')})`).join(' or ');
    return `every module of exactly one set, never a mix: ${sets}`;
  }
  const amount =
    'credits' in g.choose
      ? `at least ${g.choose.credits} credits`
      : `at least ${g.choose.count} module(s)`;
  return `${amount} from ${g.from.join(', ')}`;
}

function curriculumSection(c, source, programmes) {
  const key = curriculumKey(c);
  const programme = programmes.find((p) => p.id === c.programmeId);
  return [
    `### Curriculum: \`${key}\``,
    '',
    `${cell(programme?.name ?? 'UNKNOWN PROGRAMME')}, year ${c.yearOfStudy}. Edit at ${where(source, `programmeId: '${c.programmeId}'`)}. Source: <${c.sourceUrl}>`,
    '',
    HEADER,
    ...provenanceRows(c),
    ...optionalRow('programmeCode', c.programmeCode),
    ...c.modules.map((m) =>
      row(
        `module ${m.code}`,
        `${m.name}; ${m.semester ?? 'term not printed'}; ${m.credits} credits; ${m.compulsory ? 'compulsory' : 'elective'}${m.alternativeCodes?.length ? `; also printed as ${m.alternativeCodes.join(', ')}` : ''}`,
      ),
    ),
    ...c.electiveGroups.map((g) => row(`elective group: ${g.label}`, groupRule(g))),
    ...optionalRow(
      'open electives (modules no list holds)',
      c.openElectiveCredits &&
        `up to ${c.openElectiveCredits.credits} credits; "${c.openElectiveCredits.note.replaceAll('"', "'")}"`,
    ),
    row('total credits (min to max)', `${c.totalCredits.min} to ${c.totalCredits.max}`),
    ...optionalRow('note', c.note),
    recordFooter(key),
  ].join('\n');
}

/** The South African day of `at`, as the catalogue's view counts a note's days (SAST, UTC+2). */
function sastDay(at) {
  return new Date(at.getTime() + 2 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/**
 * One safety note (Phase 5e-3). Expired on `today`: learners no longer see it, so it is flagged
 * for a person to re-read the page and move its dates on ("expired: re-check").
 */
function safetyNoteSection(a, source, today) {
  const expired = sastDay(today) > a.validUntil;
  const at = source
    ? where(source, `id: '${a.id}'`)
    : `\`packages/catalogue/src/data/${a.universityId}-safety.ts\``;
  return [
    `### Safety note: \`${a.id}\``,
    '',
    `${a.kind}${a.campusId ? ` on \`${a.campusId}\`` : ', the whole university'}. Edit at ${at}.`,
    '',
    expired
      ? `> **Expired: re-check.** Its last day was ${a.validUntil}, so learners no longer see it. Re-read the page; if the advice still stands word for word, move \`adviceValidity\` to the day you read it.\n`
      : '> **Safety record.** Learners see it only once verified and until it expires. Check the quote word for word on the university’s own page, and have a second person sign it off.\n',
    HEADER,
    row('sourceUrl (opens?)', a.sourceUrl),
    row('academicYear', a.academicYear),
    `| Status | ${cell(`${expired ? `expired: re-check (last day ${a.validUntil}); ` : ''}${status(a)}`)} | — | — |`,
    row('kind', a.kind),
    row('quote (word for word as the page prints it?)', a.quote),
    ...optionalRow('area (the university’s own words?)', a.area),
    ...optionalRow('campusId', a.campusId),
    ...optionalRow('placeId', a.placeId),
    ...optionalRow('days', a.days),
    ...optionalRow('hours', a.hours),
    row('publishedOn (date printed on the page)', a.publishedOn ?? NOT_PUBLISHED),
    row('validFrom (read on)', a.validFrom),
    row('validUntil (shown until)', a.validUntil),
    ...optionalRow('note', a.note),
    recordFooter(a.id),
  ].join('\n');
}

/** A printed value with its words and where, for a fast check against the source (Phase 6a). */
function quoted(value, q) {
  if (!q) return NOT_PUBLISHED;
  const at = q.page ? ` (${q.page})` : '';
  return value === undefined ? `"${q.quote}"${at}` : `${value}: "${q.quote}"${at}`;
}

function supplementaryRows(s) {
  if (!s) return [row('supplementary', NOT_PUBLISHED)];
  const range = s.eligibleFinalMark
    ? `${s.eligibleFinalMark.from}% to ${s.eligibleFinalMark.to === undefined ? 'below the pass mark ("at least")' : `${s.eligibleFinalMark.to}%`}`
    : NOT_PUBLISHED;
  const result = !s.result
    ? NOT_PUBLISHED
    : s.result.kind === 'capped-at'
      ? `capped at ${s.result.cap}%`
      : s.result.kind;
  return [
    ...(s.offered === false ? [row('supplementary offered', 'no (not normally)')] : []),
    row('supplementary: final marks that may lead to one', range),
    row('supplementary: result', result),
    ...(s.alsoWhen ?? []).map((w) => row('supplementary: also when', w)),
    ...(s.notWhen ?? []).map((w) => row('supplementary: not when', w)),
    row('supplementary: quote (word for word?)', quoted(undefined, s)),
  ];
}

/** General or faculty rules (Phase 6a). What isn't printed says so, never a default (gotcha 40). */
function assessmentRulesSection(r, source) {
  const a = r.examAdmission;
  return [
    `### Assessment rules: \`${r.id}\``,
    '',
    `${cell(r.title)}${r.faculty ? `, faculty: ${cell(r.faculty)}` : ', the whole university'}. Edit at ${where(source, `id: '${r.id}'`)}.`,
    '',
    r.unread ? `> **Not read yet:** ${cell(r.unread)}\n` : '',
    HEADER,
    ...provenanceRows(r),
    row('title', r.title),
    ...optionalRow('faculty (as the programmes spell it)', r.faculty),
    row('pass mark', quoted(r.passMark?.value, r.passMark)),
    row(
      `exam admission${a?.term ? ` (${a.term})` : ''}: minimum year mark`,
      a?.minimumYearMark === undefined ? NOT_PUBLISHED : `${a.minimumYearMark}%`,
    ),
    ...(a?.conditions ?? []).map((c) => row('exam admission: condition', c)),
    ...(a ? [row('exam admission: quote (word for word?)', quoted(undefined, a))] : []),
    row('exam subminimum', quoted(r.examSubminimum?.value, r.examSubminimum)),
    ...optionalRow(
      'component subminimum',
      r.componentSubminimum &&
        quoted(
          `${r.componentSubminimum.value}%${r.componentSubminimum.fromWeight === undefined ? '' : ` on components of ${r.componentSubminimum.fromWeight}% or more`}`,
          r.componentSubminimum,
        ),
    ),
    ...supplementaryRows(r.supplementary),
    row('deferred exam', quoted(undefined, r.deferredExam)),
    row('rounding', quoted(r.rounding?.method, r.rounding)),
    row('distinction', quoted(r.distinction?.value, r.distinction)),
    ...(r.otherRules ?? []).map((o) => row('other rule', quoted(undefined, o))),
    ...optionalRow('unread (what a person must read)', r.unread),
    ...optionalRow('note', r.note),
    recordFooter(r.id),
  ].join('\n');
}

/** A module's published scheme (Phase 6a): weights must add to 100 (the schema refuses otherwise). */
function moduleAssessmentSection(m, source) {
  const key = moduleAssessmentKey(m);
  const dp = m.dpRequirement;
  const weights =
    m.yearMarkWeight === undefined
      ? NOT_PUBLISHED
      : `year mark ${m.yearMarkWeight}%, exam ${m.examWeight}%`;
  return [
    `### Module scheme: \`${key}\``,
    '',
    `${cell(m.name ?? m.code)}${m.page ? `, ${m.page}` : ''}. Edit at ${where(source, `'${m.code}'`)}. Source: <${m.sourceUrl}>`,
    '',
    HEADER,
    ...provenanceRows(m),
    row('code', m.code),
    ...optionalRow('also printed as', m.alternativeCodes?.join(', ')),
    ...optionalRow('faculty (whose handbook prints this entry)', m.faculty),
    ...(m.components ?? []).map((c) =>
      row(
        `component: ${c.name}`,
        `${c.kind}, ${c.weight}% of the final mark${c.subminimum === undefined ? '' : `, subminimum ${c.subminimum}%`}${c.bestOf ? `, best ${c.bestOf.count} of ${c.bestOf.of}` : ''}`,
      ),
    ),
    ...(m.components ? [] : [row('components', NOT_PUBLISHED)]),
    row('year mark / exam weights', weights),
    row(
      'DP: minimum year mark',
      dp?.minimumYearMark === undefined ? NOT_PUBLISHED : `${dp.minimumYearMark}%`,
    ),
    ...(dp?.conditions ?? []).map((c) => row('DP: condition', c)),
    row('exam subminimum', m.examSubminimum === undefined ? NOT_PUBLISHED : `${m.examSubminimum}%`),
    row(
      'pass mark (the module’s own)',
      m.passMark === undefined ? NOT_PUBLISHED : `${m.passMark}%`,
    ),
    ...optionalRow('exam papers', m.examPapers),
    ...(m.otherRules ?? []).map((o) => row('other rule (not applied by code)', o)),
    row('quote (word for word as the handbook prints it?)', m.quote),
    ...optionalRow('note', m.note),
    recordFooter(key),
  ].join('\n');
}

function academicCalendarSection(c, source) {
  const key = academicCalendarKey(c);
  const range = (r) => `${r.from} to ${r.to}`;
  const list = (field, items, show) =>
    items === undefined
      ? [row(field, NOT_PUBLISHED)]
      : items.map((x) => row(`${field}: ${x.label ?? x.term}`, show(x)));
  return [
    `### Academic calendar: \`${key}\``,
    '',
    `${cell(c.title ?? 'Calendar')}. Edit at ${where(source, `sourceUrl: '${c.sourceUrl}'`)}.`,
    '',
    HEADER,
    ...provenanceRows(c),
    ...list('semester', c.semesters, (s) => range(s.dates)),
    ...list('exam period', c.examPeriods, (p) => range(p.dates)),
    ...list('supplementary exams', c.supplementaryExams, (p) => range(p.dates)),
    ...list('supplementary registration closes', c.supplementaryRegistration, (d) => d.date),
    ...list('DP lists published', c.dpLists, (d) => d.date),
    ...optionalRow('unread', c.unread),
    ...optionalRow('note', c.note),
    recordFooter(key),
  ].join('\n');
}

/** A university's Phase 6a records: rules, then module schemes, then the exam calendar. */
function assessmentParts(id, raw, sources) {
  const rules = (raw.assessmentRules ?? []).filter((r) => r.universityId === id);
  const modules = (raw.moduleAssessments ?? []).filter((m) => m.universityId === id);
  const calendars = (raw.academicCalendars ?? []).filter((c) => c.universityId === id);
  const source = sources[`${id}-assessment`];
  const count = rules.length + modules.length + calendars.length;
  return {
    count,
    parts: [
      `## How marks work (${count})\n\nThe university’s and faculties’ assessment rules, the modules’ published schemes and the exam calendar (Phase 6a). Check every number against its quote and page; anything marked "not published" must really be absent from the source (never a usual 50% or 40%). Every source must be on the university’s own site.\n`,
      ...(count === 0 ? ['None researched yet.\n'] : []),
      ...rules.map((r) => assessmentRulesSection(r, source)),
      ...modules.map((m) => moduleAssessmentSection(m, source)),
      ...calendars.map((c) => academicCalendarSection(c, source)),
    ],
  };
}

/** A university's Phase 5 records: campuses and places, offices, calendars, then curricula. */
function orientationParts(id, raw, sources, links, today) {
  const campuses = (raw.campuses ?? []).filter((c) => c.universityId === id);
  const onCampus = new Set(campuses.map((c) => c.id));
  // A place whose campus is missing still shows, under the university its id names.
  const places = (raw.places ?? []).filter(
    (p) =>
      onCampus.has(p.campusId) || (!campusExists(raw, p.campusId) && p.id.startsWith(`${id}-`)),
  );
  const offices = (raw.facultyOffices ?? []).filter((o) => o.universityId === id);
  const calendars = (raw.registrationCalendars ?? []).filter((c) => c.universityId === id);
  const programmes = raw.programmes.filter((p) => p.universityId === id);
  const ownProgrammes = new Set(programmes.map((p) => p.id));
  const curricula = (raw.curricula ?? []).filter(
    (c) =>
      ownProgrammes.has(c.programmeId) ||
      (!raw.programmes.some((p) => p.id === c.programmeId) && c.programmeId.startsWith(`${id}-`)),
  );
  const notes = (raw.safetyAdvice ?? []).filter((a) => a.universityId === id);
  const none = 'None researched yet.\n';
  const orientation = sources[`${id}-orientation`];
  const count = campuses.length + places.length + offices.length + calendars.length;
  return {
    count: count + curricula.length + notes.length,
    parts: [
      `## Campus, orientation and registration (${count})\n\nCampuses, places on them, faculty offices and the registration calendar. Every source must be on the university’s own site.\n`,
      ...(count === 0 ? [none] : []),
      ...campuses.map((c) => campusSection(c, orientation)),
      ...places.map((p) => placeSection(p, orientation, links)),
      ...offices.map((o) => facultyOfficeSection(o, orientation)),
      ...calendars.map((c) => calendarSection(c, orientation)),
      `## First-year curricula (${curricula.length})\n\nCheck every module code, semester and credit value against the faculty rule book, and that the elective groups and totals read as the book prints them. A registration check is only as right as this record.\n`,
      ...(curricula.length === 0 ? [none] : []),
      ...curricula.map((c) => curriculumSection(c, sources[`${id}-curricula`], programmes)),
      `## Safety notes (${notes.length})\n\nThe university’s own safety advice, quoted. Each must match its page word for word, name an area only in the university’s words, and expire within 90 days of being read.\n`,
      ...(notes.length === 0 ? [none] : []),
      ...notes.map((a) => safetyNoteSection(a, sources[`${id}-safety`], today)),
    ],
  };
}

function campusExists(raw, campusId) {
  return (raw.campuses ?? []).some((c) => c.id === campusId);
}

function preamble(title, intro, count) {
  return [
    `# ${title}: verification checklist`,
    '',
    '<!-- GENERATED by `pnpm verification:checklists` from packages/catalogue. Edit the data, then regenerate. -->',
    '',
    '> Generated from the catalogue: every value below is what the data holds today, not what the',
    '> source says. Open each source, compare, and mark the last column **☑** (matches) or **☒**',
    '> (differs: write what the source says in the third column, and add it to',
    '> [proposed-corrections.md](proposed-corrections.md)). A tick survives `pnpm verification:checklists`',
    '> only while its row is unchanged. The durable record of verification is `verifiedOn` and',
    '> `verifiedBy` in the data file, never a tick here. See [README.md](README.md).',
    '',
    intro,
    '',
    `Records in this file: **${count}**.`,
    '',
  ].join('\n');
}

/**
 * Renders every checklist file. Returns `{ 'wits.md': markdown, ... }`. `today` decides which
 * safety notes have expired: once one does, the committed checklist is out of date until it is
 * regenerated and the note re-checked.
 */
export function renderChecklists(catalogue, today = new Date()) {
  const { raw, methods, defaultMethod, sources, subjects, languages } = catalogue;
  const links = {
    mapsLink: catalogue.mapsLink,
    walkingLink: catalogue.walkingLink,
    streetViewLink: catalogue.streetViewLink,
  };
  const nameOf = subjectNamer(subjects, languages);
  const files = {};

  for (const id of UNIVERSITY_FILES) {
    const u = raw.universities.find((x) => x.id === id);
    if (!u) throw new Error(`No university record ${id}`);
    const w = raw.windows.find((x) => x.universityId === id);
    const programmes = raw.programmes.filter((p) => p.universityId === id);
    const own = methods.filter((m) => m.universityId === id);
    const phase5 = orientationParts(id, raw, sources, links, today);
    const phase6 = assessmentParts(id, raw, sources);
    const parts = [
      preamble(
        u.name,
        `Order: score method${own.length > 1 ? 's' : ''} first, then the university and window records, then each programme, then campus, registration and curriculum records, then how marks work.`,
        1 + (w ? 1 : 0) + own.length + programmes.length + phase5.count + phase6.count,
      ),
      ...own.map((m) => methodSection(m, defaultMethod[id] === m.id, sources)),
      universitySection(u, sources, id),
      w
        ? windowSection(w, sources, id)
        : `## Application window\n\n**MISSING**: no window record.\n`,
      `## Programmes (${programmes.length})\n\n${questionsFor(`programmes:${id}`)}`,
      ...programmes.map((p) => programmeSection(p, sources, id, nameOf, defaultMethod[id])),
      ...phase5.parts,
      ...phase6.parts,
    ];
    files[`${id}.md`] = `${parts.join('\n')}`.replace(/\n{3,}/g, '\n\n');
  }

  // Programmes whose university has no checklist would be invisible: put them where they show.
  const orphans = raw.programmes.filter((p) => !UNIVERSITY_FILES.includes(p.universityId));
  if (orphans.length > 0) {
    files['other.md'] = [
      preamble(
        'Programmes at other universities',
        'Universities without their own checklist yet.',
        orphans.length,
      ),
      ...orphans.map((p) => programmeSection(p, sources, 'support', nameOf, 'unknown')),
    ].join('\n');
  }

  const n = raw.nsfas;
  files['nsfas.md'] = [
    preamble(
      'NSFAS',
      'One record: the NSFAS application window, thresholds, documents and the N+ rule.',
      1,
    ),
    '## NSFAS record: `nsfas`',
    '',
    `Edit at ${where(sources.support, 'export const nsfas')}.`,
    '',
    questionsFor('nsfas'),
    HEADER,
    ...provenanceRows(n),
    row('opensOn', n.opensOn),
    row('closesOn', n.closesOn),
    row('incomeThresholdZar (rand, per year)', n.incomeThresholdZar),
    row('incomeThresholdDisabilityZar (rand, per year)', n.incomeThresholdDisabilityZar),
    row('sassaNote', n.sassaNote),
    ...n.documents.map((d, i) => row(`document ${i + 1}`, d)),
    row('nPlusRule', n.nPlusRule),
    row('applyUrl (opens, right page?)', n.applyUrl),
    recordFooter('nsfas'),
  ]
    .join('\n')
    .replace(/\n{3,}/g, '\n\n');

  files['helplines.md'] = [
    preamble(
      'Crisis and support helplines',
      'A wrong crisis number is the worst error this product could make. Check every number on the **organisation’s own website** (not a directory or a provincial page), dial-test it if you can, and re-check every three months.',
      raw.helplines.length,
    ),
    questionsFor('helplines:all'),
    ...raw.helplines.map((h) =>
      [
        `## \`${h.id}\``,
        '',
        `${cell(h.name)}. Edit at ${where(sources.support, `id: '${h.id}'`)}. Evidence found so far: [open-questions.md, Q18](open-questions.md#q18).`,
        '',
        HEADER,
        ...provenanceRows(h),
        row('name', h.name),
        ...h.numbers.map((num) => row(`number (${num.kind})`, num.value)),
        row('hours', h.hours),
        row('purpose', h.purpose),
        row('topics (when the crisis card shows it)', h.topics.join(', ')),
        recordFooter(h.id),
      ].join('\n'),
    ),
  ]
    .join('\n\n')
    .replace(/\n{3,}/g, '\n\n');

  const papers = [...(raw.examPapers ?? [])].sort((a, b) =>
    `${a.date} ${a.startsAt} ${a.id}`.localeCompare(`${b.date} ${b.startsAt} ${b.id}`),
  );
  const subjectName = subjectNamer(subjects, languages);
  files['exam-timetable.md'] = [
    preamble(
      'NSC exam timetable',
      'One record per paper, in the order they are written. A wrong exam date is as harmful as a wrong deadline: the reminder pipeline keeps quiet during each paper, and the countdown shows learners the days left. Check every date, session, start time and duration against the **Department of Basic Education’s** published timetable (a provincial copy is acceptable only if it reproduces the DBE document unchanged). End times are computed from the start and the duration; the timetable prints durations only.',
      papers.length,
    ),
    questionsFor('exams:all'),
    ...papers.map((p) =>
      [
        `## \`${p.id}\``,
        '',
        `${cell(subjectName([p.subjectId]))} Paper ${p.paper}. Edit at ${where(sources.exams, `paper('${p.subjectId}', ${p.paper},`)}.`,
        '',
        questionsFor(p.id),
        HEADER,
        ...provenanceRows(p),
        row('examination', p.examination),
        row('subject', `${subjectName([p.subjectId])} (\`${p.subjectId}\`)`),
        row('paper', p.paper),
        row('date', p.date),
        row('session', p.session),
        row('startsAt (SAST)', p.startsAt),
        row('durationMinutes', p.durationMinutes),
        ...(p.note ? [row('note (shown to learners)', p.note)] : []),
        recordFooter(p.id),
      ].join('\n'),
    ),
  ]
    .join('\n\n')
    .replace(/\n{3,}/g, '\n\n');

  const practice = raw.practice ?? [];
  files['practice.md'] = [
    preamble(
      'Free practice and open textbooks (Siyavula)',
      'One record per book or service and subject. Learners see a link only once its record is verified. For each: open the link (does it open the right book or page?), check on the source page that it is **still free for learners**, and that the access (no account, or a free account) is right. Only free resources may be recorded (planning.md §8.3). Link only: never copy Siyavula content, use its logo or imply a partnership.',
      practice.length,
    ),
    questionsFor('practice:all'),
    ...practice.map((r) => {
      const at =
        lineOf(sources.practice, `id: '${r.id}'`) === null
          ? where(sources.practice, `'${r.title}'`)
          : where(sources.practice, `id: '${r.id}'`);
      return [
        `## \`${r.id}\``,
        '',
        `${cell(r.title)} (${r.kind}). Edit at ${at}.`,
        '',
        HEADER,
        ...provenanceRows(r),
        row('url (opens the right page?)', r.url),
        row('subject', `${subjectName([r.subjectId])} (\`${r.subjectId}\`)`),
        row('grades', r.grades.join(', ')),
        row('kind', r.kind),
        row('access (still free?)', r.access),
        row('licence', r.licence),
        row('accessedOn (research, not verification)', r.accessedOn),
        ...(r.note ? [row('note', r.note)] : []),
        recordFooter(r.id),
      ].join('\n');
    }),
  ]
    .join('\n\n')
    .replace(/\n{3,}/g, '\n\n');

  files['free-books.md'] = freeBooksChecklist(raw, sources.books);

  // Public TVET colleges (planning.md §19.1): one file per province, and the teach-outs.
  Object.assign(files, collegeChecklists(raw, sources, catalogue.provinces ?? []));

  for (const [name, text] of Object.entries(files)) {
    files[name] = `${text.replace(/\n{3,}/g, '\n\n').trimEnd()}\n`;
  }
  return files;
}

/** A match's target in words: a university's module, or a whole subject area. */
function matchTarget(m) {
  return 'moduleCode' in m.target
    ? `${m.target.universityId} module ${m.target.moduleCode}`
    : `subject area: ${m.target.subjectArea}`;
}

/**
 * Phase 6d: open books, the curated matches and each library's search (D5–D7). Each link must be
 * on its publisher's own site under the licence recorded; each match must be one a person agrees
 * with; each library pattern must open the library's own search.
 */
function freeBooksChecklist(raw, source) {
  const books = raw.openBooks ?? [];
  const matches = raw.bookMatches ?? [];
  const libraries = raw.libraryCatalogues ?? [];
  const bookLine = (b) => {
    const slug = b.id.replace(/^openstax-/, '');
    return lineOf(source, `id: '${b.id}'`) === null
      ? where(source, `'${slug}',`)
      : where(source, `id: '${b.id}'`);
  };
  const matchLine = (m) =>
    'moduleCode' in m.target
      ? where(source, `'${m.target.moduleCode}',`)
      : where(source, 'const areaMatches');
  return [
    preamble(
      'Free books, their matches and library searches',
      'Three kinds of record (Phase 6d). **Open books**: open the link and the source, check the book is still free on its publisher’s own site, and that the licence, authors, edition and ISBNs are as printed. Never record a book from any other host (the allow-list, D5), and never a "free PDF" copy. **Matches**: a person agrees the book covers similar ground for the module or area (D6); an "is the prescribed book" match needs the outline that prescribes it. **Libraries**: open the pattern with a real search and check it opens the library’s own results; the link claims nothing about whether a copy is there (D7).',
      books.length + matches.length + libraries.length,
    ),
    `## Open books (${books.length})\n`,
    ...books.map((b) =>
      [
        `### Book: \`book:${b.id}\``,
        '',
        `${cell(b.title)}. Edit at ${bookLine(b)}.`,
        '',
        HEADER,
        ...provenanceRows(b),
        row('title (as printed)', b.title),
        row('authors (as printed)', b.authors.join('; ')),
        row('edition', b.edition ?? NOT_PUBLISHED),
        row('ISBNs (as printed)', b.isbns.length ? b.isbns.join(', ') : NOT_PUBLISHED),
        row('licence (as the source states it?)', b.licence),
        row('url (opens the book, on its publisher’s site?)', b.url),
        row('subject areas', b.subjectAreas.join(', ')),
        row('level', b.level),
        row('accessedOn (research, not verification)', b.accessedOn),
        ...optionalRow('note', b.note),
        recordFooter(`book:${b.id}`),
      ].join('\n'),
    ),
    `## Matches (${matches.length})\n`,
    ...matches.map((m) =>
      [
        `### Match: \`book-match:${m.id}\``,
        '',
        `${cell(matchTarget(m))} ↔ \`${m.bookId}\`. Edit at ${matchLine(m)}.`,
        '',
        HEADER,
        ...provenanceRows(m),
        row('target', matchTarget(m)),
        row('book', m.bookId),
        row('kind (a person agrees?)', m.kind),
        row('note', m.note),
        recordFooter(`book-match:${m.id}`),
      ].join('\n'),
    ),
    `## Library searches (${libraries.length})\n\nOne per university at most. A university without one shows no library link.\n`,
    ...libraries.map((l) =>
      [
        `### Library: \`library:${l.universityId}\``,
        '',
        `${cell(l.name)}. Edit at ${where(source, `universityId: '${l.universityId}'`)}.`,
        '',
        HEADER,
        ...provenanceRows(l),
        row('name', l.name),
        row('searchUrl pattern', l.searchUrl),
        row('a real search opens results? (try an ISBN and a title)', 'try it'),
        row('accessedOn (research, not verification)', l.accessedOn),
        ...optionalRow('note', l.note),
        recordFooter(`library:${l.universityId}`),
      ].join('\n'),
    ),
  ]
    .join('\n\n')
    .replace(/\n{3,}/g, '\n\n');
}

/** The key of a table row, for carrying a tick across a regeneration: record + field + value. */
function rowKeys(markdown) {
  const keys = new Map();
  let record = '';
  for (const line of markdown.split('\n')) {
    const heading = line.match(/^#{2,3} .*?`([^`]+)`/);
    if (heading) record = heading[1];
    const cells = line.startsWith('| ') ? line.split(/(?<!\\)\|/).slice(1, -1) : null;
    if (cells && cells.length === 4) {
      keys.set(`${record}␟${cells[0].trim()}␟${cells[1].trim()}`, line);
    }
  }
  return keys;
}

/**
 * Carries the owner's ticks and notes from `previous` into freshly generated `next`, for rows
 * whose record, field and value are unchanged. A changed value starts unchecked again.
 */
export function carryTicks(next, previous) {
  if (!previous) return next;
  const old = rowKeys(previous);
  let record = '';
  return next
    .split('\n')
    .map((line) => {
      const heading = line.match(/^#{2,3} .*?`([^`]+)`/);
      if (heading) record = heading[1];
      const cells = line.startsWith('| ') ? line.split(/(?<!\\)\|/).slice(1, -1) : null;
      if (cells?.length !== 4 || cells[3].trim() !== UNCHECKED) return line;
      const before = old.get(`${record}␟${cells[0].trim()}␟${cells[1].trim()}`);
      return before ?? line;
    })
    .join('\n');
}

/** Normalises ticks back to empty boxes, so a drift check ignores the owner's progress. */
export function withoutTicks(markdown) {
  return markdown
    .split('\n')
    .map((line) => {
      if (!line.startsWith('| ')) return line;
      const cells = line.split(/(?<!\\)\|/);
      if (cells.length !== 6) return line;
      const box = cells[4].trim();
      if (!CHECKED_MARKS.includes(box) && box !== UNCHECKED) return line;
      cells[3] = '  ';
      cells[4] = ` ${UNCHECKED} `;
      return cells.join('|');
    })
    .join('\n');
}
