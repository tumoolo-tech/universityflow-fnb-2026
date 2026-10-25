'use client';

import { common, onboarding } from '@universityflow/content';
import { CourseSearch, type SearchableCourse, useCourseSearch } from '@/components/course-search';
import { Select } from '@/components/ui';

/** A course the learner may see, under its university's full name (lib/server/goals.ts). */
export type CourseOption = SearchableCourse;

/**
 * "What would you like to study?": a dropdown of every course the learner may see, grouped by
 * university's full name, with "I don't know yet" (owner's choice, 2026-10-19), and the course
 * search above it (2026-10-21). The answer is still the profile's text (`goal`), saved as
 * "<course>, <university>". An answer typed before the dropdown existed stays selectable as it
 * was, so saving the form never drops it.
 */
export function StudyChoice(props: {
  id: string;
  describedBy?: string | undefined;
  value: string;
  onChange: (value: string) => void;
  options: ReadonlyArray<CourseOption>;
}) {
  const answerFor = (o: CourseOption) => onboarding.goalValue(o.name, o.universityName);
  const search = useCourseSearch(props.options, (o) => answerFor(o) === props.value);
  const universities = [...new Set(search.shown.map((o) => o.universityName))];
  const values = new Set([onboarding.goalUnknown, ...props.options.map(answerFor)]);
  const earlier = props.value && !values.has(props.value) ? props.value : null;
  return (
    <>
      <CourseSearch search={search} total={props.options.length} />
      <Select
        id={props.id}
        aria-describedby={props.describedBy}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
      >
        <option value="">{common.chooseOne}</option>
        <option value={onboarding.goalUnknown}>{onboarding.goalUnknown}</option>
        {earlier ? <option value={earlier}>{earlier}</option> : null}
        {universities.map((u) => (
          <optgroup key={u} label={u}>
            {search.shown
              .filter((o) => o.universityName === u)
              .map((o) => (
                <option key={o.id} value={answerFor(o)}>
                  {o.name}
                </option>
              ))}
          </optgroup>
        ))}
      </Select>
    </>
  );
}
