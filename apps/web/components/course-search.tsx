'use client';

import { common } from '@universityflow/content';
import { useId, useState } from 'react';
import { Input, Select } from '@/components/ui';

/**
 * The search above every course dropdown (owner's requests, 2026-10-21): about 86 courses at six
 * universities is too long a list to scroll on a phone. A university and a faculty filter and a
 * search box narrow the dropdown under them; the dropdown stays a native `select`, so the
 * keyboard, screen readers and the phone's own picker work as before. The course already chosen
 * always stays in the list, so narrowing never drops it. (No campus filter: the catalogue doesn't
 * record which campus a course runs on; planning §18 notes the research it needs.)
 */

export interface SearchableCourse {
  readonly id: string;
  readonly name: string;
  readonly universityName: string;
  /** "UJ" as well as "University of Johannesburg". */
  readonly universityShortName?: string | undefined;
  /** In the university's own words ("Humanities", "College of Humanities"). */
  readonly faculty?: string | undefined;
}

/** What the learner has narrowed by: words typed, a university, a faculty (`''` = any). */
export interface CourseFilter {
  readonly query: string;
  readonly university: string;
  /** A faculty's key: its university's name and its own (faculties repeat across universities). */
  readonly faculty: string;
}

const NO_FILTER: CourseFilter = { query: '', university: '', faculty: '' };

/** A faculty's key, unique across universities. */
export const facultyKey = (course: SearchableCourse) =>
  course.faculty ? `${course.universityName} / ${course.faculty}` : '';

/** Lower case, accents off, so "Université" and "universite" match. */
const fold = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Every word typed must appear in the course's name, faculty or its university's names. */
export function matchesCourse(course: SearchableCourse, query: string): boolean {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const text = fold(
    `${course.name} ${course.faculty ?? ''} ${course.universityName} ${course.universityShortName ?? ''}`,
  );
  return words.every((w) => text.includes(w));
}

function passes(course: SearchableCourse, filter: CourseFilter): boolean {
  return (
    matchesCourse(course, filter.query) &&
    (filter.university === '' || course.universityName === filter.university) &&
    (filter.faculty === '' || facultyKey(course) === filter.faculty)
  );
}

/**
 * The courses to list for `filter` (or words typed), keeping the one `keep` says (the current
 * choice).
 */
export function filterCourses<T extends SearchableCourse>(
  courses: ReadonlyArray<T>,
  filter: CourseFilter | string,
  keep?: (course: T) => boolean,
): T[] {
  const f = typeof filter === 'string' ? { ...NO_FILTER, query: filter } : filter;
  return courses.filter((c) => passes(c, f) || (keep?.(c) ?? false));
}

/** The filters' state, the courses they leave, and the choices each filter offers. */
export function useCourseSearch<T extends SearchableCourse>(
  courses: ReadonlyArray<T>,
  keep?: (course: T) => boolean,
) {
  const [filter, setFilter] = useState<CourseFilter>(NO_FILTER);
  const universities = [...new Set(courses.map((c) => c.universityName))];
  // The faculties of the chosen university, or every faculty when none is chosen.
  const faculties = [
    ...new Map(
      courses
        .filter(
          (c) => c.faculty && (filter.university === '' || c.universityName === filter.university),
        )
        .map((c) => [facultyKey(c), c] as const),
    ).values(),
  ].sort((a, b) => facultyKey(a).localeCompare(facultyKey(b)));
  return {
    filter,
    query: filter.query,
    setQuery: (query: string) => setFilter((f) => ({ ...f, query })),
    // A new university clears a faculty that belongs to another one.
    setUniversity: (university: string) =>
      setFilter((f) => ({
        ...f,
        university,
        faculty: f.faculty === '' || f.faculty.startsWith(`${university} / `) ? f.faculty : '',
      })),
    setFaculty: (faculty: string) => setFilter((f) => ({ ...f, faculty })),
    universities,
    faculties,
    shown: filterCourses(courses, filter, keep),
  };
}

export type CourseSearchState = ReturnType<typeof useCourseSearch>;

/**
 * A course dropdown's options, valued by course id: "Choose one", then `first` (e.g. the courses
 * a letter matched) under `firstLabel`, then every course under its university's full name.
 */
export function CourseOptions(props: {
  courses: ReadonlyArray<SearchableCourse>;
  first?: ReadonlyArray<SearchableCourse> | undefined;
  firstLabel?: string | undefined;
  /** The empty choice's words ("Choose one" unless a page says it its own way). */
  none?: string | undefined;
}) {
  const universities = [...new Set(props.courses.map((c) => c.universityName))];
  const first = props.first ?? [];
  return (
    <>
      <option value="">{props.none ?? common.chooseOne}</option>
      {first.length > 0 ? (
        <optgroup label={props.firstLabel}>
          {first.map((c) => (
            <option key={`first-${c.id}`} value={c.id}>
              {c.universityName}: {c.name}
            </option>
          ))}
        </optgroup>
      ) : null}
      {universities.map((u) => (
        <optgroup key={u} label={u}>
          {props.courses
            .filter((c) => c.universityName === u)
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
        </optgroup>
      ))}
    </>
  );
}

/**
 * The filters themselves: University, Faculty and a search box, side by side from a tablet's
 * width and stacked on a phone, with how many courses match said politely to a screen reader as
 * the list narrows. Place it right above the course dropdown it narrows.
 */
export function CourseSearch(props: { search: CourseSearchState; total: number }) {
  const id = useId();
  const { search } = props;
  const narrowed =
    search.filter.query.trim() !== '' ||
    search.filter.university !== '' ||
    search.filter.faculty !== '';
  let count: string = common.courseMatches(props.total, props.total);
  if (narrowed) {
    count =
      search.shown.length === 0
        ? common.courseNoMatch
        : common.courseMatches(search.shown.length, props.total);
  }
  const facultyUniversities = [...new Set(search.faculties.map((c) => c.universityName))];
  return (
    <fieldset className="flex flex-col gap-2 rounded-md bg-sunk p-3">
      <legend className="sr-only">{common.courseFilters}</legend>
      <div className="grid gap-3 md:grid-cols-3">
        <div className="flex flex-col gap-1">
          <label htmlFor={`${id}-university`} className="text-sm font-medium">
            {common.courseUniversity}
          </label>
          <Select
            id={`${id}-university`}
            value={search.filter.university}
            onChange={(e) => search.setUniversity(e.target.value)}
          >
            <option value="">{common.courseAnyUniversity}</option>
            {search.universities.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={`${id}-faculty`} className="text-sm font-medium">
            {common.courseFaculty}
          </label>
          <Select
            id={`${id}-faculty`}
            value={search.filter.faculty}
            onChange={(e) => search.setFaculty(e.target.value)}
          >
            <option value="">{common.courseAnyFaculty}</option>
            {facultyUniversities.map((u) => (
              <optgroup key={u} label={u}>
                {search.faculties
                  .filter((c) => c.universityName === u)
                  .map((c) => (
                    <option key={facultyKey(c)} value={facultyKey(c)}>
                      {c.faculty}
                    </option>
                  ))}
              </optgroup>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={id} className="text-sm font-medium">
            {common.courseSearch}
          </label>
          <Input
            id={id}
            type="search"
            aria-describedby={`${id}-hint`}
            value={search.filter.query}
            onChange={(e) => search.setQuery(e.target.value)}
            autoComplete="off"
            enterKeyHint="search"
          />
        </div>
      </div>
      <p id={`${id}-hint`} className="text-sm text-muted">
        {common.courseSearchHint}
      </p>
      <p className="text-sm font-medium" aria-live="polite">
        {count}
      </p>
    </fieldset>
  );
}
