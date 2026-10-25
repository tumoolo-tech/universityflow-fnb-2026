'use client';

import { type ReactNode, useId, useRef, useState } from 'react';
import { Button, Card, Checkbox, Field, Input, Notice, TextArea } from '@/components/ui';
import { type WrittenCare, WrittenCarePanel } from '@/components/written-care';
import { api } from '@/lib/client/api';
import { fill } from '@/lib/client/fill';
import type { CvSelection, CvSelectionView } from './cv-types';
import { CvError, type CvKit } from './cv-view';

/**
 * "What goes on my CV" (§10.5): the ticks, grouped by section, each group saying where it comes
 * from. Contact details are typed here for the CV only, never the sign-in phone and never an ID
 * or student number (D9); marks start unticked (D11). Saved with one PUT of the whole selection;
 * the summary and the line about the learner are their own words, crisis-checked on save (§7.5).
 */

type Text = 'surname' | 'label' | 'summary' | 'email' | 'phone' | 'city' | 'region';

const clean = (value: string | null) => {
  const trimmed = value?.trim() ?? '';
  return trimmed === '' ? null : trimmed;
};

export function CvSelectionCard({
  headingId,
  view,
  kit,
  onView,
}: {
  headingId: string;
  view: CvSelectionView;
  kit: CvKit;
  onView: (view: CvSelectionView) => void;
}) {
  const { copy } = kit;
  const w = copy.what;
  const [sel, setSel] = useState<CvSelection>(view.selection);
  const [care, setCare] = useState<WrittenCare | null>(null);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const { available } = view;

  // An entry deleted or added below: its tick follows the list the page now holds.
  const entryIds = sel.entryIds.filter((id) => available.entries.some((e) => e.id === id));

  const toggle = (key: 'subjectIds' | 'moduleCodes' | 'entryIds', value: string) =>
    setSel((s) => ({
      ...s,
      [key]: s[key].includes(value) ? s[key].filter((v) => v !== value) : [...s[key], value],
    }));
  const text = (key: Text, label: string, hint?: string, long?: boolean) => (
    // A refusal that names this field goes on it (A2-52).
    <Field label={label} hint={hint} error={kit.fieldError('what', key)}>
      {({ id, describedBy, invalid }) =>
        long ? (
          <TextArea
            id={id}
            aria-describedby={describedBy}
            aria-invalid={invalid}
            rows={4}
            value={sel[key] ?? ''}
            onChange={(e) => setSel((s) => ({ ...s, [key]: e.target.value }))}
          />
        ) : (
          <Input
            id={id}
            aria-describedby={describedBy}
            aria-invalid={invalid}
            type={key === 'email' ? 'email' : key === 'phone' ? 'tel' : 'text'}
            autoComplete={key === 'email' ? 'email' : key === 'phone' ? 'tel' : 'off'}
            value={sel[key] ?? ''}
            onChange={(e) => setSel((s) => ({ ...s, [key]: e.target.value }))}
          />
        )
      }
    </Field>
  );

  async function save() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    try {
      const body: CvSelection = {
        ...sel,
        surname: clean(sel.surname),
        label: clean(sel.label),
        summary: clean(sel.summary),
        email: clean(sel.email),
        phone: clean(sel.phone),
        city: clean(sel.city),
        region: clean(sel.region),
        entryIds,
      };
      const next = await api<CvSelectionView & { care: WrittenCare | null }>(
        '/api/me/cv/selection',
        { method: 'PUT', json: body },
      );
      const { care: nextCare, ...saved } = next;
      onView(saved);
      setSel(saved.selection);
      setCare(nextCare);
      kit.say(w.saved);
    } catch (e) {
      kit.fail(e, 'what');
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  const offerName = available.offer
    ? available.offer.course && available.offer.university
      ? fill(w.offer, available.offer.course, available.offer.university)
      : (available.offer.course ?? available.offer.university)
    : null;
  const omitted = [...new Set(view.omitted.map((o) => o.reason))];

  return (
    <Card aria-labelledby={headingId} className="flex flex-col gap-4">
      <h2 id={headingId} tabIndex={-1} className="text-lg">
        {w.title}
      </h2>
      <p className="text-muted">{w.lead}</p>
      <form
        className="flex flex-col gap-5"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <Group legend={w.about} from={w.from.typed}>
          {text('surname', w.surname, w.surnameHint)}
          {text('label', w.label, w.labelHint)}
          {text('summary', w.summary, undefined, true)}
        </Group>
        <Group legend={w.contact} from={w.from.typed} hint={w.contactHint}>
          {text('email', w.email)}
          {text('phone', w.phone)}
          {text('city', w.city)}
          {text('region', w.region)}
        </Group>
        <Group legend={w.school} from={w.from.profile}>
          {available.school ? (
            <Tick
              label={available.school.name}
              checked={sel.includeSchool}
              onChange={() => setSel((s) => ({ ...s, includeSchool: !s.includeSchool }))}
            />
          ) : (
            <p className="text-sm text-muted">{w.nothing}</p>
          )}
        </Group>
        <Group legend={w.subjects} from={w.from.report} hint={w.subjectsHint}>
          {available.subjects.length > 0 ? (
            available.subjects.map((s) => (
              <Tick
                key={s.id}
                label={fill(w.subject, s.name, s.percent)}
                checked={sel.subjectIds.includes(s.id)}
                onChange={() => toggle('subjectIds', s.id)}
              />
            ))
          ) : (
            <p className="text-sm text-muted">{w.nothing}</p>
          )}
        </Group>
        <Group legend={w.university} from={w.from.offer}>
          {offerName ? (
            <Tick
              label={offerName}
              checked={sel.includeOffer}
              onChange={() => setSel((s) => ({ ...s, includeOffer: !s.includeOffer }))}
            />
          ) : (
            <p className="text-sm text-muted">{w.nothing}</p>
          )}
        </Group>
        <Group legend={w.modules} from={w.from.registration}>
          {available.modules.length > 0 ? (
            available.modules.map((m) => (
              <Tick
                key={`${m.year}-${m.code}`}
                label={m.name ? fill(w.module, m.code, m.name) : m.code}
                checked={sel.moduleCodes.includes(m.code)}
                onChange={() => toggle('moduleCodes', m.code)}
              />
            ))
          ) : (
            <p className="text-sm text-muted">{w.nothing}</p>
          )}
        </Group>
        <Group legend={w.entries} from={w.from.entries}>
          {available.entries.length > 0 ? (
            available.entries.map((e) => (
              <Tick
                key={e.id}
                label={e.title}
                checked={entryIds.includes(e.id)}
                onChange={() => toggle('entryIds', e.id)}
              />
            ))
          ) : (
            <p className="text-sm text-muted">{w.nothing}</p>
          )}
        </Group>
        <CvError kit={kit} at="what" />
        <div>
          <Button type="submit" aria-disabled={busy || undefined}>
            {w.save}
          </Button>
        </div>
      </form>
      {care ? (
        <WrittenCarePanel care={care} words={copy.care} onSeen={() => setCare(null)} />
      ) : null}
      {view.missing.length > 0 ? (
        <Notice tone="info" title={w.missingTitle}>
          <ul className="list-disc pl-5">
            {view.missing.map((m) => (
              <li key={m}>{w.missing[m]}</li>
            ))}
          </ul>
        </Notice>
      ) : null}
      {omitted.map((reason) => (
        <p key={reason} className="text-sm text-muted">
          {w.omitted[reason]}
        </p>
      ))}
    </Card>
  );
}

/** One section of ticks or fields: its name, where it comes from, and any hint. */
function Group({
  legend,
  from,
  hint,
  children,
}: {
  legend: string;
  from: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="font-bold">{legend}</legend>
      <p className="text-sm text-muted">{from}</p>
      {hint ? <p className="text-sm">{hint}</p> : null}
      {children}
    </fieldset>
  );
}

function Tick({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  const id = useId();
  return (
    <label htmlFor={id} className="flex min-h-11 cursor-pointer items-center gap-3">
      <Checkbox id={id} checked={checked} onChange={onChange} />
      {label}
    </label>
  );
}
