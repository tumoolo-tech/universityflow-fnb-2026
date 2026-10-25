'use client';

import { colleges, results } from '@universityflow/content';
import { Fragment, type ReactNode, useState } from 'react';
import { cx, EmptyState, Input, Select } from '@/components/ui';

export type GroupId = 'qualify-now' | 'on-track' | 'close' | 'plan-b' | 'colleges';

/** What kind of institution a card is from (packages/catalogue `INSTITUTION_TYPES`, built ones). */
export type InstitutionKind = 'university' | 'public-tvet-college';

/** What the filter needs to know about a card. The card itself arrives rendered. */
export interface ListedProgramme {
  readonly id: string;
  /** The university's or the college's id. */
  readonly institutionId: string;
  readonly institutionType: InstitutionKind;
  /** Name and faculty (or a college's courses), lower case, for the search box. */
  readonly text: string;
}

/** An institution the filter offers. */
export interface ListedInstitution {
  readonly id: string;
  readonly name: string;
  readonly type: InstitutionKind;
}

const GROUPS: Record<GroupId, { title: string; lead: string }> = {
  'qualify-now': { title: results.groups.qualifyNow, lead: results.groups.qualifyNowLead },
  'on-track': { title: results.groups.onTrack, lead: results.groups.onTrackLead },
  close: { title: results.groups.close, lead: results.groups.closeLead },
  'plan-b': { title: results.groups.planB, lead: results.groups.planBLead },
  colleges: { title: colleges.group, lead: colleges.groupLead },
};

const TYPES: ReadonlyArray<InstitutionKind> = ['university', 'public-tvet-college'];

/**
 * The filter and the groups on /results (audit A4-03).
 *
 * The cards are rendered on the server and passed in, keyed by id: this island only decides
 * which to show, so the browser never runs the card code or hydrates a card it doesn't show.
 * Plan B (and the colleges' group) starts collapsed behind a disclosure button and is rendered
 * when opened. The filter is by institution (a university or a public TVET college) and by type
 * (planning.md §19.1).
 */
export function ResultsList({
  groups,
  cards,
  institutions,
}: {
  groups: ReadonlyArray<{ id: GroupId; items: ReadonlyArray<ListedProgramme> }>;
  cards: Readonly<Record<string, ReactNode>>;
  institutions: ReadonlyArray<ListedInstitution>;
}) {
  const [institution, setInstitution] = useState('');
  const [type, setType] = useState('');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<Partial<Record<GroupId, boolean>>>({});

  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const matches = (p: ListedProgramme) =>
    (!institution || p.institutionId === institution) &&
    (!type || p.institutionType === type) &&
    words.every((w) => p.text.includes(w));
  const offered = institutions.filter((i) => !type || i.type === type);

  return (
    <>
      <div className="flex flex-wrap gap-3">
        <label className="flex min-w-48 flex-1 flex-col gap-1" htmlFor="filter-search">
          <span className="text-sm font-medium">{results.filters.search}</span>
          <Input
            id="filter-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        {/*
         * The label sits beside its select, never around it: a label that wraps a select takes the
         * chosen option into the select's accessible name in browsers ("Type All types"), so a
         * screen reader, and getByLabel, gets more than the label.
         */}
        <div className="flex min-w-0 flex-col gap-1">
          <label className="text-sm font-medium" htmlFor="filter-type">
            {colleges.filters.type}
          </label>
          <Select
            id="filter-type"
            value={type}
            onChange={(e) => {
              setType(e.target.value);
              setInstitution('');
            }}
          >
            <option value="">{colleges.filters.allTypes}</option>
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {colleges.institutionTypes[t]}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <label className="text-sm font-medium" htmlFor="filter-institution">
            {colleges.filters.institution}
          </label>
          <Select
            id="filter-institution"
            value={institution}
            onChange={(e) => setInstitution(e.target.value)}
          >
            <option value="">{colleges.filters.allInstitutions}</option>
            {offered.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </Select>
        </div>
      </div>
      {groups.map(({ id, items }) => {
        const { title, lead } = GROUPS[id];
        const shown = items.filter(matches);
        const collapsible = id === 'plan-b' || id === 'colleges';
        const isOpen = !collapsible || open[id] === true;
        const listId = `group-${id}-list`;
        const count = <span className="text-muted">({shown.length})</span>;
        return (
          <section key={id} aria-labelledby={`group-${id}`} className="flex flex-col gap-3">
            <h2 id={`group-${id}`} className="text-xl">
              {collapsible ? (
                <button
                  type="button"
                  className="inline-flex min-h-11 items-center gap-3 text-left"
                  aria-expanded={isOpen}
                  aria-controls={listId}
                  onClick={() => setOpen((value) => ({ ...value, [id]: !value[id] }))}
                >
                  <span>
                    {title} {count}
                  </span>
                  <span
                    aria-hidden="true"
                    className={cx(
                      'inline-block size-2.5 border-r-thick border-b-thick border-current motion-safe:transition-transform',
                      isOpen ? 'rotate-45' : '-rotate-45',
                    )}
                  />
                </button>
              ) : (
                <>
                  {title} {count}
                </>
              )}
            </h2>
            <p className="text-muted">{lead}</p>
            <div id={listId}>
              {!isOpen ? null : shown.length === 0 ? (
                <EmptyState>{results.groups.empty}</EmptyState>
              ) : (
                <ul className="grid gap-3 md:grid-cols-2">
                  {shown.map((p) => (
                    <Fragment key={p.id}>{cards[p.id]}</Fragment>
                  ))}
                </ul>
              )}
            </div>
          </section>
        );
      })}
    </>
  );
}
