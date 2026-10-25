'use client';

import type { PracticeArtifact } from '@universityflow/agent';
import { SUBJECTS } from '@universityflow/catalogue/client';
import { common, goals } from '@universityflow/content';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { CourseOptions, CourseSearch, useCourseSearch } from '@/components/course-search';
import { ExamCountdown, GoalCard } from '@/components/goals';
import { PracticeCard } from '@/components/practice';
import { Button, Card, Checkbox, Field, Notice, Page, Select, StatusLine } from '@/components/ui';
import { api, errorMessage } from '@/lib/client/api';
import { useStatus } from '@/lib/client/status';
import type { ExamsResponse, GoalResponse } from '@/lib/server/goals';

/**
 * My goal and exams: choose a target course, see the countdown and free practice for what matters,
 * adjust exam subjects.
 */
export function GoalsView({
  goal: initialGoal,
  exams: initialExams,
  practice: initialPractice,
  plans,
}: {
  goal: GoalResponse;
  exams: ExamsResponse;
  practice: PracticeArtifact;
  /** My plan maps (D10): the card after "Change my goal", built by the page with its own copy. */
  plans?: ReactNode;
}) {
  const [goal, setGoal] = useState(initialGoal);
  const [exams, setExams] = useState(initialExams);
  const [practice, setPractice] = useState(initialPractice);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useStatus();
  const [busy, setBusy] = useState(false);
  const [choice, setChoice] = useState(initialGoal.goalId ?? '');
  const [adding, setAdding] = useState('');
  const search = useCourseSearch(goal.options, (o) => o.id === choice);
  /** Bumped after a save that changes the goal card, to move focus to its heading. */
  const [focusGoal, setFocusGoal] = useState(0);
  const goalHeading = useRef<HTMLHeadingElement>(null);
  const t = goals;

  // Focus never drops to <body> (A3-01, WCAG 2.4.3). Controls are `aria-disabled` while a request
  // runs, never `disabled` (which blurs them), and presses are ignored. After setting or removing
  // the goal, the card it changed is where focus goes: the button may be gone or inert.
  useEffect(() => {
    if (focusGoal > 0) goalHeading.current?.focus();
  }, [focusGoal]);

  /** One save at a time: a press while one runs does nothing. */
  const inFlight = useRef(false);

  async function run<T>(call: () => Promise<T>, apply: (value: T) => void, done: string) {
    if (inFlight.current) return false;
    inFlight.current = true;
    setError(null);
    setStatus('');
    setBusy(true);
    try {
      apply(await call());
      setStatus(done);
      return true;
    } catch (e) {
      setError(errorMessage(e));
      return false;
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  // A new goal changes which subjects matter, so the practice list follows it.
  const refreshPractice = async () => setPractice(await api<PracticeArtifact>('/api/me/practice'));
  const saveGoal = async () => {
    const saved = await run(
      async () => {
        const next = await api<GoalResponse>('/api/me/goal', {
          method: 'PUT',
          json: { programmeId: choice },
        });
        await refreshPractice();
        return next;
      },
      setGoal,
      common.saved,
    );
    if (saved) setFocusGoal((n) => n + 1);
  };
  const clearGoal = async () => {
    const cleared = await run(
      async () => {
        const next = await api<GoalResponse>('/api/me/goal', { method: 'DELETE' });
        await refreshPractice();
        return next;
      },
      (next) => {
        setGoal(next);
        setChoice('');
      },
      t.cleared,
    );
    // "Remove my goal" is gone now: focus can't stay on it.
    if (cleared) setFocusGoal((n) => n + 1);
  };
  const cannotSave = busy || choice === '' || choice === goal.goalId;
  const cannotAdd = busy || adding === '';
  const changeSubject = (subjectId: string, included: boolean | null) =>
    run(
      () => api<ExamsResponse>('/api/me/exams', { method: 'PUT', json: { subjectId, included } }),
      setExams,
      common.saved,
    );

  const listed = new Set(exams.subjects.map((s) => s.subjectId));
  const addable = SUBJECTS.filter((s) => s.id !== 'life-orientation' && !listed.has(s.id));

  return (
    <Page title={t.title} lead={t.lead}>
      {error ? <Notice tone="danger">{error}</Notice> : null}
      <StatusLine said={status} />

      {goal.card ? (
        <GoalCard artifact={goal.card} headingRef={goalHeading} />
      ) : (
        <Card className="flex flex-col gap-3">
          <h2 className="text-lg" ref={goalHeading} tabIndex={-1}>
            {t.goalTitle}
          </h2>
          <p className="text-muted">{goal.goalId ? t.notAvailable : t.noGoal}</p>
        </Card>
      )}

      <Card className="flex flex-col gap-3">
        <h2 className="text-lg">{goal.goalId ? t.change : t.setGoal}</h2>
        <Field label={t.choose} hint={t.chooseHint}>
          {({ id, describedBy }) => (
            <>
              <CourseSearch search={search} total={goal.options.length} />
              <Select
                id={id}
                aria-describedby={describedBy}
                value={choice}
                onChange={(e) => setChoice(e.target.value)}
              >
                <CourseOptions courses={search.shown} />
              </Select>
            </>
          )}
        </Field>
        <div className="flex flex-wrap gap-3">
          <Button
            onClick={() => {
              if (!cannotSave) void saveGoal();
            }}
            aria-disabled={cannotSave}
          >
            {t.setGoal}
          </Button>
          {goal.goalId ? (
            <Button
              variant="secondary"
              onClick={() => {
                if (!busy) void clearGoal();
              }}
              aria-disabled={busy}
            >
              {t.clear}
            </Button>
          ) : null}
        </div>
      </Card>

      {plans}

      <ExamCountdown artifact={exams.countdown} />

      {/* The Grade 10 journey's Study step lands here (/goals#practice, G10-4). */}
      <div id="practice">
        <PracticeCard artifact={practice} />
      </div>

      <Card className="flex flex-col gap-3">
        <h2 className="text-lg">{t.subjectsTitle}</h2>
        <p className="text-muted">{t.subjectsLead}</p>
        <ul className="flex flex-col gap-2">
          {exams.subjects.map((s) => {
            const id = `writes-${s.subjectId}`;
            return (
              <li key={s.subjectId} className="flex flex-col">
                <label htmlFor={id} className="flex min-h-11 items-center gap-3">
                  <Checkbox
                    id={id}
                    checked={s.writes}
                    aria-disabled={busy}
                    onChange={(e) => {
                      // Busy: the box stays as it is (it's controlled) and keeps focus.
                      if (busy) return;
                      void changeSubject(
                        s.subjectId,
                        // Back to what the report says: forget the change.
                        e.target.checked === s.onReport ? null : e.target.checked,
                      );
                    }}
                  />
                  <span>{t.write(s.name)}</span>
                </label>
                <p className="ml-8 text-sm text-muted">{s.onReport ? t.fromReport : t.addedByMe}</p>
              </li>
            );
          })}
        </ul>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-60 flex-1">
            <Field label={t.addSubject}>
              {({ id }) => (
                <Select id={id} value={adding} onChange={(e) => setAdding(e.target.value)}>
                  <option value="">{common.chooseOne}</option>
                  {addable.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>
          <Button
            variant="secondary"
            aria-disabled={cannotAdd}
            onClick={() => {
              if (cannotAdd) return;
              const id = adding;
              setAdding('');
              void changeSubject(id, true);
            }}
          >
            {t.add}
          </Button>
        </div>
      </Card>
    </Page>
  );
}
