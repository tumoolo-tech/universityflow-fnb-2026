'use client';

import type { PlanMapsResponse, PlanTemplateId } from '@universityflow/ui';
import { PLAN_LIMITS } from '@universityflow/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';
import { Button, Card, Checkbox, Field, Input, Notice, panelLook } from '@/components/ui';
import { api, errorMessage } from '@/lib/client/api';
import { fill } from '@/lib/client/fill';
import type { PlanCopy, TemplateChoices } from '@/lib/server/plan-maps-copy';

/**
 * My plan maps on My goal (docs/design/plan-maps-proposal.md §4, §8.4; D10: after "Change my
 * goal"): the learner's maps, and "Start a new map" with the five templates as one radio group
 * and, while writing is on, the map's own name (RT-06: the learner names it; the template is only
 * its layout; a name is needed here, and the field says why). Its words come as props (the
 * launch standard), so this page carries no other copy for it. One press, one request; focus
 * never drops to the page (A3-01).
 */
export function PlanMapsCard({
  initial,
  copy,
  templates,
  hasGoal,
}: {
  initial: PlanMapsResponse;
  copy: PlanCopy;
  templates: TemplateChoices;
  /** The learner has a goal: "Use my goal in the middle" starts ticked. */
  hasGoal: boolean;
}) {
  const router = useRouter();
  const titleId = useId();
  const groupId = useId();
  const [picking, setPicking] = useState(false);
  const [templateId, setTemplateId] = useState<PlanTemplateId>(templates[0]?.id ?? 'six-stops');
  const [linksGoal, setLinksGoal] = useState(hasGoal);
  const [name, setName] = useState('');
  const [nameMissing, setNameMissing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const firstRadio = useRef<HTMLInputElement>(null);
  const nameInput = useRef<HTMLInputElement>(null);
  const startButton = useRef<HTMLButtonElement>(null);
  const [focusStart, setFocusStart] = useState(0);

  useEffect(() => {
    if (picking) firstRadio.current?.focus();
  }, [picking]);
  useEffect(() => {
    if (focusStart > 0) startButton.current?.focus();
  }, [focusStart]);

  const names = new Map(templates.map((t) => [t.id, t.name]));
  const full = initial.maps.length >= initial.max;

  async function start() {
    if (inFlight.current) return;
    if (initial.wordsAllowed && name.trim() === '') {
      setNameMissing(true);
      nameInput.current?.focus();
      return;
    }
    setNameMissing(false);
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const { map } = await api<{ map: { id: string } }>('/api/me/plan-maps', {
        method: 'POST',
        json: initial.wordsAllowed
          ? { templateId, linksGoal, title: name.trim() }
          : { templateId, linksGoal },
      });
      // The map page puts focus on its title (`new`).
      router.push(`/goals/maps/${map.id}?new=1`);
    } catch (e) {
      setError(errorMessage(e));
      inFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <Card aria-labelledby={titleId} className="flex flex-col gap-3">
      <h2 id={titleId} className="text-lg">
        {copy.title}
      </h2>
      <p className="text-muted">{initial.wordsAllowed ? copy.lead : copy.leadTickOnly}</p>
      {error ? <Notice tone="danger">{error}</Notice> : null}

      {initial.maps.length === 0 ? (
        <p className="text-muted">{copy.empty}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {initial.maps.map((m) => {
            const name = m.title ?? names.get(m.templateId) ?? '';
            return (
              <li key={m.id} className={`${panelLook} p-3`}>
                <Link
                  href={`/goals/maps/${m.id}`}
                  className="inline-flex min-h-11 items-center font-bold"
                >
                  {name}
                </Link>
                <p className="text-sm text-muted">
                  {m.title ? `${names.get(m.templateId) ?? ''} · ` : ''}
                  {fill(copy.counts, m.counts.achieved, m.counts.notAchieved, m.counts.planned)}
                </p>
              </li>
            );
          })}
        </ul>
      )}

      {full ? (
        <p className="text-muted">{copy.full}</p>
      ) : picking ? (
        <form
          className="flex flex-col gap-3"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            if (!busy) void start();
          }}
        >
          {initial.wordsAllowed ? (
            <Field
              label={copy.naming.label}
              hint={copy.naming.hint}
              error={nameMissing ? copy.naming.needed : undefined}
            >
              {({ id, describedBy }) => (
                <Input
                  ref={nameInput}
                  id={id}
                  aria-describedby={describedBy}
                  aria-invalid={nameMissing || undefined}
                  required
                  value={name}
                  maxLength={PLAN_LIMITS.title}
                  onChange={(e) => setName(e.target.value)}
                />
              )}
            </Field>
          ) : null}
          <fieldset className="flex flex-col gap-2" aria-describedby={undefined}>
            <legend id={groupId} className="mb-2 font-medium">
              {copy.chooseTemplate}
            </legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {templates.map((t, i) => (
                <label
                  key={t.id}
                  className="uf-plan-choice flex min-h-11 cursor-pointer items-start gap-3 rounded-md border-thick border-line-strong bg-surface p-3"
                >
                  <input
                    ref={i === 0 ? firstRadio : undefined}
                    type="radio"
                    name="plan-template"
                    value={t.id}
                    checked={templateId === t.id}
                    onChange={() => setTemplateId(t.id)}
                    className="mt-1 size-5 shrink-0 accent-brand"
                  />
                  <span aria-hidden="true" className={`uf-plan-thumb uf-plan-thumb--${t.id}`} />
                  <span className="flex flex-col">
                    <span className="font-bold">{t.name}</span>
                    <span className="text-sm text-muted">{t.line}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="flex flex-col">
            <label htmlFor={`${groupId}-goal`} className="flex min-h-11 items-center gap-3">
              <Checkbox
                id={`${groupId}-goal`}
                checked={linksGoal}
                onChange={(e) => setLinksGoal(e.target.checked)}
                aria-describedby={`${groupId}-goal-hint`}
              />
              <span>{copy.useGoal}</span>
            </label>
            <p id={`${groupId}-goal-hint`} className="ml-8 text-sm text-muted">
              {copy.useGoalHint}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button type="submit" aria-disabled={busy}>
              {copy.create}
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                if (busy) return;
                setPicking(false);
                setFocusStart((n) => n + 1);
              }}
              aria-disabled={busy}
            >
              {copy.cancel}
            </Button>
          </div>
        </form>
      ) : (
        <div>
          <Button ref={startButton} variant="secondary" onClick={() => setPicking(true)}>
            {copy.start}
          </Button>
        </div>
      )}
      <p className="text-sm text-muted">{copy.exportNote}</p>
    </Card>
  );
}
