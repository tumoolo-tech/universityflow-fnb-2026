'use client';

import { useId, useRef, useState } from 'react';
import { Button, Card, Field, Input, panelLook, Select, TextArea } from '@/components/ui';
import { type WrittenCare, WrittenCarePanel } from '@/components/written-care';
import { api } from '@/lib/client/api';
import { fill } from '@/lib/client/fill';
import type { CvEntry, CvEntryKind, EvidenceKind } from './cv-types';
import { CvError, type CvKit } from './cv-view';

/**
 * "My projects and skills" (§3.3, §10.5): the learner's own entries, each its own small form with
 * evidence links (printed on the CV, never fetched, D10). Every save is read by the chat's crisis
 * check (§7.5): the words are saved anyway, and when they need care the crisis card shows here
 * and takes focus. Delete asks in the page first.
 */

const KINDS: ReadonlyArray<CvEntryKind> = [
  'project',
  'skill',
  'work',
  'volunteer',
  'award',
  'language',
  'certificate',
];
const EVIDENCE: ReadonlyArray<EvidenceKind> = ['repository', 'demo', 'document', 'video', 'other'];
/** At most five links an entry (CV_LIMITS.evidence). */
const MAX_LINKS = 5;

const editId = (id: string) => `cv-edit-${id}`;
/** An entry's form, `new` for the add form: focus goes to its first field when it opens (A2-44). */
const formId = (id: string) => `cv-form-${id}`;
/** "Delete …?": focus goes to the question when it replaces the Delete button (A2-44). */
const askId = (id: string) => `cv-ask-${id}`;

/** The first field of an entry's form, once it is on screen. */
const firstField = (id: string) =>
  document.getElementById(formId(id))?.querySelector<HTMLElement>('input, select, textarea');

export function CvEntries({
  entries,
  kit,
  onAdded,
  onSaved,
  onRemoved,
}: {
  entries: ReadonlyArray<CvEntry>;
  kit: CvKit;
  onAdded: (entry: CvEntry) => void;
  onSaved: (entry: CvEntry) => void;
  onRemoved: (id: string) => void;
}) {
  const { copy } = kit;
  const e = copy.entries;
  const titleId = useId();
  const addId = useId();
  /** The entry open for editing, `new` for the add form, or null. */
  const [open, setOpen] = useState<string | null>(null);
  const [asking, setAsking] = useState<string | null>(null);
  const [care, setCare] = useState<WrittenCare | null>(null);
  const inFlight = useRef(false);

  async function remove(entry: CvEntry) {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      await api(`/api/me/cv/entries/${entry.id}`, { method: 'DELETE' });
      setAsking(null);
      onRemoved(entry.id);
      kit.say(fill(e.removed, entry.title));
      kit.focusAfter(() => document.getElementById(addId));
    } catch (error) {
      kit.fail(error, 'entries');
    } finally {
      inFlight.current = false;
    }
  }

  return (
    <Card aria-labelledby={titleId} className="flex flex-col gap-3">
      <h2 id={titleId} className="text-lg">
        {e.title}
      </h2>
      <p className="text-muted">{e.lead}</p>
      {entries.length === 0 ? (
        <p className="text-muted">{e.empty}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {entries.map((entry) => (
            <li key={entry.id} className={`${panelLook} flex flex-col gap-2 p-3`}>
              {open === entry.id ? (
                <EntryForm
                  id={formId(entry.id)}
                  entry={entry}
                  kit={kit}
                  onCancel={() => {
                    setOpen(null);
                    kit.clear('entry-form');
                    kit.focusAfter(() => document.getElementById(editId(entry.id)));
                  }}
                  onDone={(saved, nextCare) => {
                    setOpen(null);
                    onSaved(saved);
                    setCare(nextCare);
                    kit.say(fill(e.saved, saved.title));
                    if (!nextCare || nextCare.level === 'setback') {
                      kit.focusAfter(() => document.getElementById(editId(saved.id)));
                    }
                  }}
                />
              ) : (
                <>
                  <p className="font-bold">{entry.title}</p>
                  <p className="text-sm text-muted">
                    {e.kinds[entry.kind]}
                    {entry.organisation ? ` · ${entry.organisation}` : ''}
                  </p>
                  {asking === entry.id ? (
                    <div className="flex flex-col gap-2">
                      <p id={askId(entry.id)} tabIndex={-1} className="font-medium">
                        {fill(e.removeAsk, entry.title)}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Button variant="danger" onClick={() => void remove(entry)}>
                          {e.removeYes}
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={() => {
                            setAsking(null);
                            kit.focusAfter(() => document.getElementById(editId(entry.id)));
                          }}
                        >
                          {e.keep}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        id={editId(entry.id)}
                        variant="secondary"
                        onClick={() => {
                          setOpen(entry.id);
                          kit.focusAfter(() => firstField(entry.id));
                        }}
                      >
                        {fill(e.edit, entry.title)}
                      </Button>
                      <Button
                        variant="quiet"
                        onClick={() => {
                          setAsking(entry.id);
                          kit.focusAfter(() => document.getElementById(askId(entry.id)));
                        }}
                      >
                        {fill(e.remove, entry.title)}
                      </Button>
                    </div>
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      <CvError kit={kit} at="entries" />
      {care ? (
        <WrittenCarePanel care={care} words={copy.care} onSeen={() => setCare(null)} />
      ) : null}
      {open === 'new' ? (
        <EntryForm
          id={formId('new')}
          entry={null}
          kit={kit}
          onCancel={() => {
            setOpen(null);
            kit.clear('entry-form');
            kit.focusAfter(() => document.getElementById(addId));
          }}
          onDone={(added, nextCare) => {
            setOpen(null);
            onAdded(added);
            setCare(nextCare);
            kit.say(fill(e.added, added.title));
            if (!nextCare || nextCare.level === 'setback') {
              kit.focusAfter(() => document.getElementById(editId(added.id)));
            }
          }}
        />
      ) : (
        <div>
          <Button
            id={addId}
            variant="secondary"
            onClick={() => {
              setOpen('new');
              kit.focusAfter(() => firstField('new'));
            }}
          >
            {e.add}
          </Button>
        </div>
      )}
    </Card>
  );
}

interface LinkRow {
  readonly key: number;
  readonly kind: EvidenceKind;
  readonly url: string;
  readonly label: string;
}

const list = (text: string, by: RegExp) =>
  text
    .split(by)
    .map((v) => v.trim())
    .filter((v) => v !== '');
const orNull = (text: string) => (text.trim() === '' ? null : text.trim());

/** A link's index in what is sent: links with no address are left out of `evidence`. */
function places(links: ReadonlyArray<LinkRow>): ReadonlyArray<number | null> {
  let next = 0;
  return links.map((l) => (l.url.trim() === '' ? null : next++));
}

/** One entry's form: a new one (with its kind), or a change to one (its kind stays). */
function EntryForm({
  id,
  entry,
  kit,
  onCancel,
  onDone,
}: {
  id: string;
  entry: CvEntry | null;
  kit: CvKit;
  onCancel: () => void;
  onDone: (entry: CvEntry, care: WrittenCare | null) => void;
}) {
  const e = kit.copy.entries;
  const [kind, setKind] = useState<CvEntryKind>(entry?.kind ?? 'project');
  const [title, setTitle] = useState(entry?.title ?? '');
  const [organisation, setOrganisation] = useState(entry?.organisation ?? '');
  const [role, setRole] = useState(entry?.role ?? '');
  const [start, setStart] = useState(entry?.startDate ?? '');
  const [end, setEnd] = useState(entry?.endDate ?? '');
  const [description, setDescription] = useState(entry?.description ?? '');
  const [highlights, setHighlights] = useState(entry?.highlights.join('\n') ?? '');
  const [keywords, setKeywords] = useState(entry?.keywords.join(', ') ?? '');
  const [modules, setModules] = useState(entry?.linkedModules.join(', ') ?? '');
  const nextKey = useRef(0);
  const [links, setLinks] = useState<ReadonlyArray<LinkRow>>(
    (entry?.evidence ?? []).map((l) => ({
      key: nextKey.current++,
      kind: l.kind,
      url: l.url,
      label: l.label ?? '',
    })),
  );
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const name = entry ? fill(e.edit, entry.title) : e.add;
  /** Each link's place among the links sent, as a refusal names it (A2-52); null if not sent. */
  const sentAt = places(links);

  async function submit() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    const fields = {
      title: title.trim(),
      organisation: orNull(organisation),
      role: orNull(role),
      startDate: orNull(start),
      endDate: orNull(end),
      description: orNull(description),
      highlights: list(highlights, /\r?\n/),
      keywords: list(keywords, /,/),
      evidence: links
        .filter((l) => l.url.trim() !== '')
        .map((l) => ({ kind: l.kind, url: l.url.trim(), label: orNull(l.label) })),
      linkedModules: list(modules, /,/),
    };
    try {
      const { entry: saved, care } = await api<{ entry: CvEntry; care: WrittenCare | null }>(
        entry ? `/api/me/cv/entries/${entry.id}` : '/api/me/cv/entries',
        entry ? { method: 'PATCH', json: fields } : { method: 'POST', json: { kind, ...fields } },
      );
      onDone(saved, care);
    } catch (error) {
      kit.fail(error, 'entry-form');
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <form
      id={id}
      aria-label={name}
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      {entry ? null : (
        <Field label={e.kind}>
          {({ id }) => (
            <Select
              id={id}
              value={kind}
              onChange={(event) => setKind(event.target.value as CvEntryKind)}
            >
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {e.kinds[k]}
                </option>
              ))}
            </Select>
          )}
        </Field>
      )}
      <Field label={e.name} error={kit.fieldError('entry-form', 'title')}>
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            aria-describedby={describedBy}
            aria-invalid={invalid}
            required
            value={title}
            onChange={(ev) => setTitle(ev.target.value)}
          />
        )}
      </Field>
      <Field label={e.organisation} error={kit.fieldError('entry-form', 'organisation')}>
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            aria-describedby={describedBy}
            aria-invalid={invalid}
            value={organisation}
            onChange={(ev) => setOrganisation(ev.target.value)}
          />
        )}
      </Field>
      <Field label={e.role} error={kit.fieldError('entry-form', 'role')}>
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            aria-describedby={describedBy}
            aria-invalid={invalid}
            value={role}
            onChange={(ev) => setRole(ev.target.value)}
          />
        )}
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={e.start} hint={e.dateHint} error={kit.fieldError('entry-form', 'startDate')}>
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              aria-describedby={describedBy}
              aria-invalid={invalid}
              inputMode="numeric"
              pattern="(19|20)\d{2}(-(0[1-9]|1[0-2]))?"
              value={start}
              onChange={(ev) => setStart(ev.target.value)}
            />
          )}
        </Field>
        <Field label={e.end} hint={e.dateHint} error={kit.fieldError('entry-form', 'endDate')}>
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              aria-describedby={describedBy}
              aria-invalid={invalid}
              inputMode="numeric"
              pattern="(19|20)\d{2}(-(0[1-9]|1[0-2]))?"
              value={end}
              onChange={(ev) => setEnd(ev.target.value)}
            />
          )}
        </Field>
      </div>
      <Field label={e.description} error={kit.fieldError('entry-form', 'description')}>
        {({ id, describedBy, invalid }) => (
          <TextArea
            id={id}
            aria-describedby={describedBy}
            aria-invalid={invalid}
            rows={3}
            value={description}
            onChange={(ev) => setDescription(ev.target.value)}
          />
        )}
      </Field>
      <Field label={e.highlights} error={kit.fieldError('entry-form', 'highlights')}>
        {({ id, describedBy, invalid }) => (
          <TextArea
            id={id}
            aria-describedby={describedBy}
            aria-invalid={invalid}
            rows={3}
            value={highlights}
            onChange={(ev) => setHighlights(ev.target.value)}
          />
        )}
      </Field>
      <Field label={e.keywords} error={kit.fieldError('entry-form', 'keywords')}>
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            aria-describedby={describedBy}
            aria-invalid={invalid}
            value={keywords}
            onChange={(ev) => setKeywords(ev.target.value)}
          />
        )}
      </Field>
      <Field label={e.modules} error={kit.fieldError('entry-form', 'linkedModules')}>
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            aria-describedby={describedBy}
            aria-invalid={invalid}
            value={modules}
            onChange={(ev) => setModules(ev.target.value)}
          />
        )}
      </Field>
      <fieldset className="flex flex-col gap-3">
        <legend className="font-medium">{e.evidence}</legend>
        {links.map((link, i) => {
          const sent = sentAt[i];
          const linkError = (part: string) =>
            sent === null || sent === undefined
              ? null
              : kit.fieldError('entry-form', `evidence.${sent}.${part}`);
          return (
            <fieldset
              key={link.key}
              className="flex flex-col gap-2 rounded-md border border-line p-3"
            >
              <legend className="text-sm font-medium">{fill(e.link, i + 1)}</legend>
              <Field label={e.evidenceKind}>
                {({ id }) => (
                  <Select
                    id={id}
                    value={link.kind}
                    onChange={(ev) =>
                      setLinks((all) =>
                        all.map((l) =>
                          l.key === link.key ? { ...l, kind: ev.target.value as EvidenceKind } : l,
                        ),
                      )
                    }
                  >
                    {EVIDENCE.map((k) => (
                      <option key={k} value={k}>
                        {e.evidenceKinds[k]}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label={e.evidenceUrl} error={linkError('url')}>
                {({ id, describedBy, invalid }) => (
                  <Input
                    id={id}
                    aria-describedby={describedBy}
                    aria-invalid={invalid}
                    type="url"
                    inputMode="url"
                    value={link.url}
                    onChange={(ev) =>
                      setLinks((all) =>
                        all.map((l) => (l.key === link.key ? { ...l, url: ev.target.value } : l)),
                      )
                    }
                  />
                )}
              </Field>
              <Field label={e.evidenceLabel} error={linkError('label')}>
                {({ id, describedBy, invalid }) => (
                  <Input
                    id={id}
                    aria-describedby={describedBy}
                    aria-invalid={invalid}
                    value={link.label}
                    onChange={(ev) =>
                      setLinks((all) =>
                        all.map((l) => (l.key === link.key ? { ...l, label: ev.target.value } : l)),
                      )
                    }
                  />
                )}
              </Field>
              <div>
                <Button
                  variant="quiet"
                  onClick={() => {
                    setLinks((all) => all.filter((l) => l.key !== link.key));
                    // The button goes with its link: focus to "Add a link" (A2-44).
                    kit.focusAfter(() => document.getElementById(`${id}-add-link`));
                  }}
                >
                  {fill(e.removeLink, i + 1)}
                </Button>
              </div>
            </fieldset>
          );
        })}
        {links.length < MAX_LINKS ? (
          <div>
            <Button
              id={`${id}-add-link`}
              variant="secondary"
              onClick={() =>
                setLinks((all) => [
                  ...all,
                  { key: nextKey.current++, kind: 'repository', url: '', label: '' },
                ])
              }
            >
              {e.addLink}
            </Button>
          </div>
        ) : null}
      </fieldset>
      <CvError kit={kit} at="entry-form" />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" aria-disabled={busy || undefined}>
          {e.save}
        </Button>
        <Button variant="secondary" onClick={onCancel}>
          {e.cancel}
        </Button>
      </div>
    </form>
  );
}
