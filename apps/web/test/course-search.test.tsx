// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { common, onboarding } from '@universityflow/content';
import { afterEach, describe, expect, it } from 'vitest';
import { filterCourses, matchesCourse } from '../components/course-search';
import { StudyChoice } from '../components/study-choice';

/**
 * The search box above every course dropdown (owner's request, 2026-10-21). Synthetic courses
 * (hard rule 4), under full university names as goalOptions gives them, with their short names.
 */

afterEach(cleanup);

const COURSES = [
  {
    id: 'a-law',
    name: 'Bachelor of Laws',
    universityName: 'University of Johannesburg',
    universityShortName: 'UJ',
    faculty: 'Law',
  },
  {
    id: 'a-eng',
    name: 'BEng Civil Engineering',
    universityName: 'University of Johannesburg',
    universityShortName: 'UJ',
    faculty: 'Engineering and the Built Environment',
  },
  {
    id: 'b-law',
    name: 'Bachelor of Laws',
    universityName: 'University of the Witwatersrand',
    universityShortName: 'Wits',
    faculty: 'Commerce, Law and Management',
  },
  {
    id: 'b-sci',
    name: 'BSc Économie',
    universityName: 'University of the Witwatersrand',
    universityShortName: 'Wits',
    faculty: 'Science',
  },
];

const UJ = 'University of Johannesburg';
const WITS = 'University of the Witwatersrand';

describe('the university and faculty filters (owner, 2026-10-21)', () => {
  it('a university keeps only its courses; a faculty only that faculty’s', () => {
    const at = (university: string, faculty = '') =>
      filterCourses(COURSES, { query: '', university, faculty }).map((c) => c.id);
    expect(at(UJ)).toEqual(['a-law', 'a-eng']);
    expect(at(WITS, `${WITS} / Science`)).toEqual(['b-sci']);
    expect(at('', `${UJ} / Law`)).toEqual(['a-law']);
  });

  it('the filters and the words typed narrow together, and the choice still stays', () => {
    expect(
      filterCourses(COURSES, { query: 'law', university: WITS, faculty: '' }).map((c) => c.id),
    ).toEqual(['b-law']);
    expect(
      filterCourses(
        COURSES,
        { query: '', university: UJ, faculty: '' },
        (c) => c.id === 'b-sci',
      ).map((c) => c.id),
    ).toEqual(['a-law', 'a-eng', 'b-sci']);
  });

  it('the search finds a faculty by name too', () => {
    expect(filterCourses(COURSES, 'built environment').map((c) => c.id)).toEqual(['a-eng']);
  });
});

describe('matching', () => {
  it('finds a course by its name, its university, or the short name', () => {
    expect(filterCourses(COURSES, 'law').map((c) => c.id)).toEqual(['a-law', 'b-law']);
    expect(filterCourses(COURSES, 'johannesburg').map((c) => c.id)).toEqual(['a-law', 'a-eng']);
    expect(filterCourses(COURSES, 'UJ').map((c) => c.id)).toEqual(['a-law', 'a-eng']);
  });

  it('needs every word typed, in any order and any case, with accents ignored', () => {
    expect(filterCourses(COURSES, 'wits LAW').map((c) => c.id)).toEqual(['b-law']);
    expect(filterCourses(COURSES, 'law wits').map((c) => c.id)).toEqual(['b-law']);
    expect(matchesCourse(COURSES[3] as (typeof COURSES)[number], 'economie')).toBe(true);
  });

  it('lists everything with nothing typed', () => {
    expect(filterCourses(COURSES, '   ')).toHaveLength(4);
  });

  it('never drops the course already chosen, whatever is typed', () => {
    const shown = filterCourses(COURSES, 'engineering', (c) => c.id === 'b-law');
    expect(shown.map((c) => c.id)).toEqual(['a-eng', 'b-law']);
  });
});

describe('the search above "What would you like to study?"', () => {
  function study(value = '') {
    let chosen = value;
    render(
      <>
        <label htmlFor="study">Study</label>
        <StudyChoice
          id="study"
          value={value}
          onChange={(v) => {
            chosen = v;
          }}
          options={COURSES}
        />
      </>,
    );
    return { chosen: () => chosen };
  }
  const courseNames = () =>
    within(screen.getByRole('combobox', { name: 'Study' }))
      .getAllByRole('option')
      .map((o) => o.textContent);

  it('is a labelled search box with a visible hint, and says how many courses there are', () => {
    study();
    const box = screen.getByRole('searchbox', { name: common.courseSearch });
    expect(box.getAttribute('aria-describedby')).toBeTruthy();
    expect(screen.getByText(common.courseSearchHint)).toBeTruthy();
    expect(screen.getByText(common.courseMatches(4, 4))).toBeTruthy();
  });

  it('narrows the dropdown as the learner types, and says so politely', () => {
    study();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'UJ law' } });
    expect(courseNames()).toEqual([common.chooseOne, onboarding.goalUnknown, 'Bachelor of Laws']);
    const count = screen.getByText(common.courseMatches(1, 4));
    expect(count.getAttribute('aria-live')).toBe('polite');
  });

  it('says when nothing matches, and keeps "I don’t know yet" to choose', () => {
    study();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'zzz' } });
    expect(screen.getByText(common.courseNoMatch)).toBeTruthy();
    expect(courseNames()).toEqual([common.chooseOne, onboarding.goalUnknown]);
  });

  it('keeps the learner’s answer in the dropdown while they search for another', () => {
    const answer = onboarding.goalValue('BEng Civil Engineering', 'University of Johannesburg');
    study(answer);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'wits' } });
    const select = screen.getByRole('combobox', { name: 'Study' }) as HTMLSelectElement;
    expect(select.value).toBe(answer);
    expect(courseNames()).toContain('BEng Civil Engineering');
  });

  const universityFilter = () => screen.getByRole('combobox', { name: common.courseUniversity });
  const facultyFilter = () => screen.getByRole('combobox', { name: common.courseFaculty });
  const facultyChoices = () =>
    within(facultyFilter())
      .getAllByRole('option')
      .map((o) => o.textContent);

  it('has a University and a Faculty filter in one labelled group', () => {
    study();
    expect(screen.getByRole('group', { name: common.courseFilters })).toBeTruthy();
    expect(
      within(universityFilter())
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual([common.courseAnyUniversity, UJ, WITS]);
    // With no university chosen, every faculty, grouped under its university.
    expect(facultyChoices()).toEqual([
      common.courseAnyFaculty,
      'Engineering and the Built Environment',
      'Law',
      'Commerce, Law and Management',
      'Science',
    ]);
  });

  it('a university narrows the courses and its faculties; a faculty narrows further', () => {
    study();
    fireEvent.change(universityFilter(), { target: { value: WITS } });
    expect(courseNames()).toEqual([
      common.chooseOne,
      onboarding.goalUnknown,
      'Bachelor of Laws',
      'BSc Économie',
    ]);
    expect(facultyChoices()).toEqual([
      common.courseAnyFaculty,
      'Commerce, Law and Management',
      'Science',
    ]);
    fireEvent.change(facultyFilter(), { target: { value: `${WITS} / Science` } });
    expect(courseNames()).toEqual([common.chooseOne, onboarding.goalUnknown, 'BSc Économie']);
    expect(screen.getByText(common.courseMatches(1, 4))).toBeTruthy();
  });

  it('choosing another university clears a faculty that belongs to the first', () => {
    study();
    fireEvent.change(facultyFilter(), { target: { value: `${WITS} / Science` } });
    fireEvent.change(universityFilter(), { target: { value: UJ } });
    expect((facultyFilter() as HTMLSelectElement).value).toBe('');
    expect(courseNames()).toEqual([
      common.chooseOne,
      onboarding.goalUnknown,
      'Bachelor of Laws',
      'BEng Civil Engineering',
    ]);
  });
});
