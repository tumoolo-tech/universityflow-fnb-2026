import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';
import {
  allRecordKeys,
  carryTicks,
  OPEN_QUESTIONS,
  renderChecklists,
  SAFETY_KINDS,
  withoutTicks,
} from './checklists.mjs';
import { loadCatalogue, ROOT } from './load-catalogue.mjs';

/**
 * The verification checklists must list every record the catalogue holds, so a record added to
 * the data can't slip past the owner's verification pass (hard rule 3). Run by `pnpm check:test`.
 */

const catalogue = await loadCatalogue();
const files = renderChecklists(catalogue);
const everything = Object.values(files).join('\n');
const marker = (key) => `<!-- record:${key} -->`;

describe('verification checklists', () => {
  it('list every record in the catalogue, each exactly once', () => {
    const keys = allRecordKeys(catalogue.raw, catalogue.methods);
    assert.ok(keys.length > 90, `expected the whole catalogue, got ${keys.length} records`);
    for (const key of keys) {
      const count = everything.split(marker(key)).length - 1;
      assert.equal(count, 1, `${key} appears ${count} times in the checklists`);
    }
  });

  it('put each programme in its own university’s file', () => {
    for (const p of catalogue.raw.programmes) {
      assert.ok(files[`${p.universityId}.md`]?.includes(marker(p.id)), `${p.id} not in its file`);
    }
  });

  it('put each public TVET college in its province’s file: register, site and programmes (§19.1)', () => {
    const { colleges, collegeProgrammes, teachOutNotices } = catalogue.raw;
    assert.equal(colleges.length, 50);
    for (const c of colleges) {
      const file = `colleges-${c.province.toLowerCase().replace(/[^a-z]+/g, '-')}.md`;
      assert.ok(files[file]?.includes(marker(`college:${c.id}`)), `${c.id} not in ${file}`);
      if (c.site) assert.ok(files[file].includes(marker(`college-site:${c.id}`)));
      for (const p of collegeProgrammes.filter((x) => x.collegeId === c.id)) {
        assert.ok(files[file].includes(marker(`college-programme:${p.id}`)), `${p.id} in ${file}`);
      }
    }
    for (const n of teachOutNotices) {
      assert.ok(files['colleges-teach-outs.md'].includes(marker(`teach-out:${n.id}`)));
    }
    // A value the college doesn't print reads "not published", never a default (gotcha 40).
    const lovedale = files['colleges-eastern-cape.md'];
    assert.match(lovedale, /No site record: no website of the college's own could be read/);
    assert.match(everything, /\| yearPrinted \| not published \|/);
    assert.match(everything, /\| entryQuote \(word for word\?\) \| not published \|/);
  });

  it('pick up a record added to the data, even at an unknown university', () => {
    const template = catalogue.raw.programmes[0];
    const added = { ...template, id: 'zz-new-programme' };
    const elsewhere = { ...template, id: 'zz-elsewhere', universityId: 'nowhere' };
    const raw = { ...catalogue.raw, programmes: [...catalogue.raw.programmes, added, elsewhere] };
    const output = Object.values(renderChecklists({ ...catalogue, raw })).join('\n');
    assert.ok(output.includes(marker('zz-new-programme')));
    assert.ok(output.includes(marker('zz-elsewhere')));
  });

  it('put campus, registration and curriculum records in their university’s file', () => {
    // Synthetic records (hard rule 4), shaped as the research agents will add them.
    const source = { sourceUrl: 'https://www.uct.ac.za/test-page/', academicYear: 2028 };
    const programme = catalogue.raw.programmes.find((p) => p.universityId === 'uct');
    const raw = {
      ...catalogue.raw,
      campuses: [
        {
          ...source,
          id: 'uct-test-campus',
          universityId: 'uct',
          name: 'Test Campus',
          city: 'Testville',
        },
      ],
      places: [
        {
          ...source,
          id: 'uct-test-clinic',
          campusId: 'uct-test-campus',
          kind: 'clinic',
          name: 'Test Clinic',
          where: 'Test Building',
          phone: '021 000 0000',
          location: { query: 'Test Building', coordinates: { lat: -33.95, lng: 18.46 } },
        },
        // Its campus is missing: it must still be listed, not lost.
        {
          ...source,
          id: 'uct-test-library',
          campusId: 'uct-nowhere',
          kind: 'library',
          name: 'Test Library',
          where: 'Test Building',
          location: { query: 'Test Library' },
        },
        // Its source prints no building or location, and its number comes from another page.
        {
          ...source,
          id: 'uct-test-unplaced-clinic',
          campusId: 'uct-test-campus',
          kind: 'clinic',
          name: 'Test Unplaced Clinic',
          phone: '021 000 0001',
          phoneSourceUrl: 'https://www.uct.ac.za/test-contacts/',
        },
      ],
      facultyOffices: [
        {
          ...source,
          id: 'uct-test-office',
          universityId: 'uct',
          faculty: programme.faculty,
          where: 'Room 1',
          contactUrl: 'https://www.uct.ac.za/test-contact/',
        },
      ],
      registrationCalendars: [
        {
          ...source,
          universityId: 'uct',
          firstYearRegistration: { from: '2028-01-20', to: '2028-02-05' },
          changeDeadlines: [{ appliesTo: 'S1', lastDay: '2028-02-20' }],
        },
        // A calendar that prints no change deadline (gotcha 40): the checklist says so.
        {
          ...source,
          academicYear: 2029,
          universityId: 'uct',
          firstYearRegistration: { from: '2029-01-20', to: '2029-02-05' },
          changeDeadlines: [],
        },
      ],
      curricula: [
        {
          ...source,
          programmeId: programme.id,
          yearOfStudy: 1,
          modules: [
            { code: 'TEST101', name: 'Test One', semester: 'S1', credits: 18, compulsory: true },
            {
              code: 'TEST102',
              name: 'Test Two',
              semester: 'S2',
              credits: 18,
              compulsory: false,
              alternativeCodes: ['TEST102X', 'TEST102Y'],
            },
            // The rule book prints no term for it: no semester at all.
            { code: 'TEST103', name: 'Test Three', credits: 0, compulsory: true },
          ],
          electiveGroups: [
            { label: 'Choose one', choose: { count: 1 }, from: ['TEST102'] },
            {
              label: 'Either a) or b)',
              choose: { oneSetOf: [['TEST201', 'TEST202'], ['TEST203']] },
              from: ['TEST201', 'TEST202', 'TEST203'],
            },
          ],
          openElectiveCredits: { credits: 18, note: 'Any first-year course from another faculty' },
          totalCredits: { min: 36, max: 36 },
        },
        // Its programme is missing: listed under the university its id names.
        {
          ...source,
          programmeId: 'uct-test-nope',
          yearOfStudy: 1,
          modules: [],
          electiveGroups: [],
          totalCredits: { min: 0, max: 0 },
        },
      ],
    };
    const out = renderChecklists({ ...catalogue, raw });
    const uct = out['uct.md'];
    for (const key of allRecordKeys(raw, catalogue.methods).filter((k) =>
      /test|calendar:|curriculum:/.test(k),
    )) {
      assert.ok(uct.includes(marker(key)), `${key} not in uct.md`);
      assert.equal(Object.values(out).join('\n').split(marker(key)).length - 1, 1, `${key} twice`);
    }
    assert.ok(uct.includes('> **Safety record.**'), 'the clinic is flagged as a safety record');
    assert.ok(uct.includes('| phone (dial-tested?) | 021 000 0000 |'));
    assert.ok(
      uct.includes(
        `| open in maps (lands on the right building?) | ${catalogue.mapsLink({ coordinates: { lat: -33.95, lng: 18.46 } })} |`,
      ),
    );
    // A13-11: what the source doesn't print says so, and a phone from another page names it.
    const unplaced = uct.slice(uct.indexOf('### Place: `uct-test-unplaced-clinic`'));
    const section = unplaced.slice(0, unplaced.indexOf('<!-- record:'));
    assert.ok(section.includes('| where (building, room) | not published |'));
    assert.ok(section.includes('| location | not published |'));
    assert.ok(!section.includes('open in maps'), 'no maps link without a location');
    assert.ok(section.includes('| phone (dial-tested?) | 021 000 0001 |'));
    assert.ok(
      section.includes(
        '| phone source (check the number on this page) | https://www.uct.ac.za/test-contacts/ |',
      ),
    );
    assert.ok(uct.includes('| module TEST101 | Test One; S1; 18 credits; compulsory |'));
    assert.ok(
      uct.includes(
        '| module TEST102 | Test Two; S2; 18 credits; elective; also printed as TEST102X, TEST102Y |',
      ),
    );
    assert.ok(
      uct.includes('| module TEST103 | Test Three; term not printed; 0 credits; compulsory |'),
    );
    assert.ok(uct.includes('| elective group: Choose one | at least 1 module(s) from TEST102 |'));
    assert.ok(
      uct.includes(
        '| elective group: Either a) or b) | every module of exactly one set, never a mix: (TEST201 and TEST202) or (TEST203) |',
      ),
    );
    assert.ok(
      uct.includes(
        '| open electives (modules no list holds) | up to 18 credits; "Any first-year course from another faculty" |',
      ),
    );
    assert.ok(uct.includes('| last day to change modules (S1) | 2028-02-20 |'));
    assert.ok(uct.includes('| last day to change modules | not published |'));
    assert.ok(!out['wits.md'].includes('uct-test'), 'nothing leaks into another university’s file');
    // An empty section still renders: uj has no calendar or curriculum records.
    assert.ok(files['uj.md'].includes('## First-year curricula (0)\n\nCheck'));
  });

  it('show a place’s step-free entrance, arrival note and Street View, or say they aren’t published (5e)', () => {
    // Synthetic records (hard rule 4).
    const source = { sourceUrl: 'https://www.uct.ac.za/test-page/', academicYear: 2028 };
    const at = { lat: -33.95, lng: 18.46 };
    const door = { lat: -33.9501, lng: 18.4602 };
    const raw = {
      ...catalogue.raw,
      campuses: [
        {
          ...source,
          id: 'uct-test-campus',
          universityId: 'uct',
          name: 'Test Campus',
          city: 'Testville',
        },
      ],
      places: [
        {
          ...source,
          id: 'uct-test-library',
          campusId: 'uct-test-campus',
          kind: 'library',
          name: 'Test Library',
          location: { query: 'Test Library', coordinates: at },
          accessibleEntrance: {
            location: { coordinates: door },
            description: 'East door, by the ramp',
          },
          arrivalNote: 'The ramp is to the left of the main doors.',
          arrivalSourceUrl: 'https://www.uct.ac.za/test-disability/',
        },
        {
          ...source,
          id: 'uct-test-food',
          campusId: 'uct-test-campus',
          kind: 'food',
          name: 'Test Food',
          location: { query: 'Test Food Court' },
        },
      ],
    };
    const uct = renderChecklists({ ...catalogue, raw })['uct.md'];
    const sectionOf = (id) => {
      const from = uct.slice(uct.indexOf(`### Place: \`${id}\``));
      return from.slice(0, from.indexOf('<!-- record:'));
    };
    const library = sectionOf('uct-test-library');
    assert.ok(
      library.includes(
        `| see it: Street View (shows the right spot?) | ${catalogue.streetViewLink({ coordinates: at })} |`,
      ),
    );
    assert.ok(library.includes('| step-free entrance: coordinates | -33.9501, 18.4602 |'));
    assert.ok(library.includes('| step-free entrance: description | East door, by the ramp |'));
    assert.ok(
      library.includes(
        `| step-free route (walks to the right door?) | ${catalogue.walkingLink({ coordinates: door })} |`,
      ),
    );
    assert.ok(
      library.includes(
        '| arrival note (walk it: still true?) | The ramp is to the left of the main doors. |',
      ),
    );
    assert.ok(
      library.includes(
        '| arrival note source (check the note on this page) | https://www.uct.ac.za/test-disability/ |',
      ),
    );
    // Gotcha 40: what isn't recorded says so, so the verifier knows to look for it.
    const food = sectionOf('uct-test-food');
    assert.ok(food.includes('| step-free entrance | not published |'));
    assert.ok(food.includes('| arrival note | not published |'));
    assert.ok(!food.includes('Street View'), 'no Street View without coordinates');
  });

  it('put every safety note in its university’s file, quoted, and flag an expired one', () => {
    // Synthetic records (hard rule 4).
    const note = {
      sourceUrl: 'https://www.uct.ac.za/test-safety/',
      academicYear: 2027,
      id: 'uct-test-walk-in-groups',
      universityId: 'uct',
      kind: 'walk-in-groups',
      quote: 'Test advice | quoted exactly.',
      area: 'Test Park / Test Hill',
      validFrom: '2027-01-10',
      validUntil: '2027-04-10',
    };
    const old = {
      ...note,
      id: 'uct-test-old-advice',
      validFrom: '2026-01-10',
      validUntil: '2026-04-10',
    };
    const raw = { ...catalogue.raw, safetyAdvice: [note, old] };
    const today = new Date('2027-02-01T08:00:00Z');
    const out = renderChecklists({ ...catalogue, raw }, today);
    const uct = out['uct.md'];
    for (const id of [note.id, old.id]) {
      assert.ok(uct.includes(marker(id)), `${id} not in uct.md`);
      assert.equal(Object.values(out).join('\n').split(marker(id)).length - 1, 1, `${id} twice`);
    }
    assert.ok(allRecordKeys(raw, catalogue.methods).includes(note.id));
    const section = (id) => {
      const from = uct.slice(uct.indexOf(`### Safety note: \`${id}\``));
      return from.slice(0, from.indexOf('<!-- record:'));
    };
    const current = section(note.id);
    assert.ok(
      current.includes(
        '| quote (word for word as the page prints it?) | Test advice \\| quoted exactly. |',
      ),
    );
    assert.ok(current.includes('| area (the university’s own words?) | Test Park / Test Hill |'));
    assert.ok(current.includes('| publishedOn (date printed on the page) | not published |'));
    assert.ok(current.includes('| validUntil (shown until) | 2027-04-10 |'));
    assert.ok(!current.includes('expired: re-check'));
    const expired = section(old.id);
    assert.ok(expired.includes('**Expired: re-check.**'), 'an expired note is flagged');
    assert.ok(expired.includes('| Status | expired: re-check (last day 2026-04-10)'));
    assert.ok(!out['wits.md'].includes('uct-test-walk-in-groups'));
  });

  it('put how-marks-work records in their university’s file, saying what isn’t published (Phase 6a)', () => {
    // Synthetic records (hard rule 4).
    const source = { sourceUrl: 'https://www.uct.ac.za/test-rules/', academicYear: 2028 };
    const raw = {
      ...catalogue.raw,
      assessmentRules: [
        {
          ...source,
          id: 'uct-test-rules',
          universityId: 'uct',
          title: 'Test Rules',
          passMark: { value: 50, quote: 'The pass mark is 50%.', page: 'p. 1' },
          supplementary: {
            eligibleFinalMark: { from: 45 },
            result: { kind: 'capped-at', cap: 50 },
            quote: 'Test supplementary.',
          },
        },
        {
          ...source,
          id: 'uct-test-unread',
          universityId: 'uct',
          title: 'Test Unread',
          unread: 'Refused: needs a person in a browser',
        },
      ],
      moduleAssessments: [
        {
          ...source,
          universityId: 'uct',
          code: 'TST1001F',
          components: [
            { name: 'Tests', kind: 'test', weight: 40, bestOf: { count: 2, of: 3 } },
            { name: 'Exam', kind: 'exam', weight: 60, subminimum: 40 },
          ],
          yearMarkWeight: 40,
          examWeight: 60,
          quote: 'Tests 40% (best 2 of 3), exam 60%, subminimum 40%.',
        },
      ],
      academicCalendars: [
        {
          ...source,
          universityId: 'uct',
          examPeriods: [{ label: 'June exams', dates: { from: '2028-05-29', to: '2028-06-16' } }],
        },
      ],
    };
    const out = renderChecklists({ ...catalogue, raw });
    const uct = out['uct.md'];
    for (const key of [
      'uct-test-rules',
      'uct-test-unread',
      'module-assessment:uct:TST1001F:2028',
      'exam-dates:uct:2028',
    ]) {
      assert.ok(allRecordKeys(raw, catalogue.methods).includes(key), `${key} is a record key`);
      assert.equal(Object.values(out).join('\n').split(marker(key)).length - 1, 1, `${key} once`);
      assert.ok(uct.includes(marker(key)), `${key} in uct.md`);
    }
    assert.ok(uct.includes('| pass mark | 50: "The pass mark is 50%." (p. 1) |'));
    assert.ok(uct.includes('| exam subminimum | not published |'), 'gotcha 40: absent says so');
    assert.ok(
      uct.includes(
        '| supplementary: final marks that may lead to one | 45% to below the pass mark ("at least") |',
      ),
    );
    assert.ok(uct.includes('| supplementary: result | capped at 50% |'));
    assert.ok(uct.includes('> **Not read yet:** Refused: needs a person in a browser'));
    assert.ok(uct.includes('| component: Tests | test, 40% of the final mark, best 2 of 3 |'));
    assert.ok(uct.includes('| component: Exam | exam, 60% of the final mark, subminimum 40% |'));
    assert.ok(uct.includes('| DP: minimum year mark | not published |'));
    assert.ok(uct.includes('| exam period: June exams | 2028-05-29 to 2028-06-16 |'));
    assert.ok(uct.includes('| supplementary exams | not published |'));
    assert.ok(!out['wits.md'].includes('uct-test-rules'));
  });

  it('flag the same place kinds as safety records as the catalogue does', () => {
    assert.deepEqual(SAFETY_KINDS, [...catalogue.safetyPlaceKinds]);
  });

  it('put every NSC exam paper in exam-timetable.md, with its date and time from the data', () => {
    assert.ok(catalogue.raw.examPapers.length > 40, 'expected the exam timetable');
    for (const p of catalogue.raw.examPapers) {
      const file = files['exam-timetable.md'];
      assert.ok(file.includes(marker(p.id)), `${p.id} not in exam-timetable.md`);
      assert.ok(file.includes(`| date | ${p.date} |`), `${p.id} date missing`);
      assert.ok(file.includes(`| startsAt (SAST) | ${p.startsAt} |`), `${p.id} time missing`);
    }
    assert.ok(files['exam-timetable.md'].includes('DRAFT (no verifiedOn / verifiedBy)'));
  });

  it('put every practice record in practice.md, with its link and access from the data', () => {
    assert.ok(catalogue.raw.practice.length >= 18, 'expected the Siyavula records');
    const file = files['practice.md'];
    for (const r of catalogue.raw.practice) {
      assert.ok(file.includes(marker(r.id)), `${r.id} not in practice.md`);
      assert.ok(file.includes(`| url (opens the right page?) | ${r.url} |`), `${r.id} url missing`);
      assert.ok(file.includes(`| access (still free?) | ${r.access} |`), `${r.id} access missing`);
    }
    assert.ok(file.includes('DRAFT (no verifiedOn / verifiedBy)'));
    assert.ok(!file.includes('siyavula.ts`.'), 'every record points at its own line');
  });

  it('put every free book, match and library search in free-books.md (6d)', () => {
    const { openBooks, bookMatches, libraryCatalogues } = catalogue.raw;
    assert.ok(openBooks.length >= 30, 'expected the open books');
    assert.ok(bookMatches.length >= 30, 'expected the curated matches');
    assert.ok(libraryCatalogues.length >= 5, 'expected the library searches');
    const file = files['free-books.md'];
    assert.ok(file, 'free-books.md is generated');
    const keys = allRecordKeys(catalogue.raw, catalogue.methods);
    for (const b of openBooks) {
      assert.ok(keys.includes(`book:${b.id}`), `${b.id} has no record key`);
      assert.ok(file.includes(marker(`book:${b.id}`)), `${b.id} not in free-books.md`);
      assert.ok(file.includes(`| url (opens the book, on its publisher’s site?) | ${b.url} |`));
      assert.ok(file.includes(`| licence (as the source states it?) | ${b.licence} |`));
      for (const isbn of b.isbns) assert.ok(file.includes(isbn), `${b.id} ISBN ${isbn} missing`);
    }
    for (const m of bookMatches) {
      assert.ok(file.includes(marker(`book-match:${m.id}`)), `${m.id} not in free-books.md`);
    }
    for (const l of libraryCatalogues) {
      const key = `library:${l.universityId}`;
      assert.ok(file.includes(marker(key)), `${key} not in free-books.md`);
      assert.ok(file.includes(`| searchUrl pattern | ${l.searchUrl} |`));
    }
    assert.ok(file.includes('DRAFT (no verifiedOn / verifiedBy)'));
    assert.ok(!file.includes('open-books.ts`.'), 'every record points at its own line');
  });

  it('show the values the data holds, not hand-typed ones', () => {
    for (const p of catalogue.raw.programmes) {
      if (p.minimumScore !== null) {
        assert.ok(
          files[`${p.universityId}.md`].includes(`| minimumScore | ${p.minimumScore} |`),
          `${p.id} minimum score missing`,
        );
      }
    }
    for (const h of catalogue.raw.helplines) {
      for (const n of h.numbers) {
        assert.ok(files['helplines.md'].includes(`| ${n.value} |`), `${h.id} ${n.value} missing`);
      }
    }
  });

  it('only point open questions at records that exist', () => {
    const keys = new Set(allRecordKeys(catalogue.raw, catalogue.methods));
    for (const key of Object.keys(OPEN_QUESTIONS)) {
      if (key.startsWith('programmes:') || key.endsWith(':all')) continue;
      assert.ok(keys.has(key), `open-question key ${key} matches no record`);
    }
  });

  it('keep a tick only while its row is unchanged', () => {
    const before = files['nsfas.md'];
    const ticked = before.replace(
      /\| closesOn \| ([^|]+) \| {2}\| ☐ \|/,
      '| closesOn | $1 | 31 Oct on site | ☑ |',
    );
    assert.notEqual(ticked, before);
    assert.equal(carryTicks(before, ticked), ticked, 'unchanged row keeps its tick');
    const changed = before.replace(/\| closesOn \| [^|]+ \|/, '| closesOn | 2099-01-01 |');
    assert.equal(carryTicks(changed, ticked), changed, 'changed value loses its tick');
    assert.equal(withoutTicks(ticked), before, 'drift check ignores ticks');
  });

  it('are committed up to date with the data (run `pnpm verification:checklists`)', () => {
    for (const [name, generated] of Object.entries(files)) {
      const path = resolve(ROOT, 'docs/verification', name);
      assert.ok(existsSync(path), `docs/verification/${name} is missing`);
      const committed = readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
      assert.equal(withoutTicks(committed), withoutTicks(generated), `${name} is stale`);
    }
  });
});
