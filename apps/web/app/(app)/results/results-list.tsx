'use client';

import { colleges, common, results } from '@universityflow/content';
import {
  Fragment,
  type ReactNode,
  startTransition,
  useDeferredValue,
  useRef,
  useState,
} from 'react';
import { Button, cardListGap, cx, EmptyState, Input, Select } from '@/components/ui';

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

/** One rendered card, by the id the filter knows it by. */
export interface LoadedCard {
  readonly id: string;
  readonly card: ReactNode;
}

/** What the server action answers with: a collapsed group's cards, in the group's order. */
export interface LoadedGroup {
  readonly cards: ReadonlyArray<LoadedCard>;
}

/** Fetches a collapsed group's cards when the learner opens it (results/actions.ts). */
export type LoadGroup = (id: GroupId) => Promise<LoadedGroup>;

const GROUPS: Record<Exclude<GroupId, 'colleges'>, { title: string; lead: string }> = {
  'qualify-now': { title: results.groups.qualifyNow, lead: results.groups.qualifyNowLead },
  'on-track': { title: results.groups.onTrack, lead: results.groups.onTrackLead },
  close: { title: results.groups.close, lead: results.groups.closeLead },
  'plan-b': { title: results.groups.planB, lead: results.groups.planBLead },
};

/** The colleges' group with no NC(V) entry record (the server words it from the record, A1-84). */
const NO_ENTRY = { title: colleges.groupNoEntry, lead: colleges.groupLeadNoEntry };

const TYPES: ReadonlyArray<InstitutionKind> = ['university', 'public-tvet-college'];

type Fetched = Partial<Record<GroupId, Readonly<Record<string, ReactNode>>>>;
type Status = Partial<Record<GroupId, 'loading' | 'failed'>>;

/**
 * How many of a fetched group's cards mount with the first paint; the rest follow in a transition
 * (A4-20). Mounting 45 college cards at once held a budget phone's main thread for most of a
 * second: this way the first screenful is on the page in a fraction of that, and the rest arrive
 * without blocking a tap or a keystroke.
 */
const FIRST_CARDS = 8;

/**
 * The filter and the groups on /results (audit A4-03).
 *
 * The shown groups' cards are rendered on the server and passed in, keyed by id: this island only
 * decides which to show, so the browser never runs the card code or hydrates a card it doesn't
 * show. Plan B (and the colleges' group) starts collapsed behind a disclosure button and sends no
 * cards with the page (audit A4-19): when opened, the island asks `loadGroup` (the page's server
 * action) for them, keeps them once they arrive, and shows the group again at once the next
 * time. The arrival of 45 college cards is a transition, so the button answers first and typing
 * never waits on it (A4-20). The filter is by institution (a university or a public TVET
 * college) and by type (planning.md §19.1); the lists follow it a frame behind the field.
 */
export function ResultsList({
  groups,
  cards,
  institutions,
  collegesGroup = NO_ENTRY,
  loadGroup,
}: {
  groups: ReadonlyArray<{ id: GroupId; items: ReadonlyArray<ListedProgramme> }>;
  cards: Readonly<Record<string, ReactNode>>;
  institutions: ReadonlyArray<ListedInstitution>;
  /** The colleges' group's title and lead, worded on the server from NC(V)'s entry record. */
  collegesGroup?: { readonly title: string; readonly lead: string };
  loadGroup: LoadGroup;
}) {
  const [institution, setInstitution] = useState('');
  const [type, setType] = useState('');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<Partial<Record<GroupId, boolean>>>({});
  const [fetched, setFetched] = useState<Fetched>({});
  const [status, setStatus] = useState<Status>({});
  // How many of a fetched group's cards are mounted so far (FIRST_CARDS, then all).
  const [revealed, setRevealed] = useState<Partial<Record<GroupId, number>>>({});
  // One request per group at a time, whatever the state of the render.
  const inFlight = useRef(new Set<GroupId>());

  // The fields answer at once; the lists (every card re-chosen) follow in a transition. Three
  // strings, never one object made while rendering, so the deferred render settles.
  const chosenInstitution = useDeferredValue(institution);
  const chosenType = useDeferredValue(type);
  const chosenQuery = useDeferredValue(query);
  const words = chosenQuery.toLowerCase().split(/\s+/).filter(Boolean);
  const matches = (p: ListedProgramme) =>
    (!chosenInstitution || p.institutionId === chosenInstitution) &&
    (!chosenType || p.institutionType === chosenType) &&
    words.every((w) => p.text.includes(w));
  const offered = institutions.filter((i) => !type || i.type === type);

  async function load(id: GroupId) {
    if (inFlight.current.has(id)) return;
    inFlight.current.add(id);
    setStatus((s) => ({ ...s, [id]: 'loading' }));
    try {
      const { cards: loaded } = await loadGroup(id);
      const byId: Record<string, ReactNode> = {};
      for (const { id: cardId, card } of loaded) byId[cardId] = card;
      // The first cards at once; mounting the rest is the heavy part, so it is a transition and
      // the page stays responsive meanwhile.
      setFetched((f) => ({ ...f, [id]: byId }));
      setStatus((s) => ({ ...s, [id]: undefined }));
      setRevealed((r) => ({ ...r, [id]: FIRST_CARDS }));
      startTransition(() => {
        setRevealed((r) => ({ ...r, [id]: Number.POSITIVE_INFINITY }));
      });
    } catch {
      setStatus((s) => ({ ...s, [id]: 'failed' }));
    } finally {
      inFlight.current.delete(id);
    }
  }

  function toggle(id: GroupId) {
    const next = !open[id];
    setOpen((value) => ({ ...value, [id]: next }));
    if (next && !fetched[id]) void load(id);
  }

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
        const { title, lead } = id === 'colleges' ? collegesGroup : GROUPS[id];
        const shown = items.filter(matches);
        const collapsible = id === 'plan-b' || id === 'colleges';
        const isOpen = !collapsible || open[id] === true;
        const listId = `group-${id}-list`;
        const count = <span className="text-muted">({shown.length})</span>;
        // A shown group's cards came with the page; a collapsed group's arrive when opened,
        // the first few with the first paint and the rest in a transition.
        const own = collapsible ? fetched[id] : cards;
        const state = status[id];
        const limit = collapsible
          ? (revealed[id] ?? Number.POSITIVE_INFINITY)
          : Number.POSITIVE_INFINITY;
        const mounted = shown.slice(0, limit);
        const busy = state === 'loading' || mounted.length < shown.length;
        return (
          <section key={id} aria-labelledby={`group-${id}`} className="flex flex-col gap-3">
            <h2 id={`group-${id}`} className="text-xl">
              {collapsible ? (
                <button
                  type="button"
                  className="inline-flex min-h-11 items-center gap-3 text-left"
                  aria-expanded={isOpen}
                  aria-controls={listId}
                  onClick={() => toggle(id)}
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
            {/* Closed: kept, hidden, so opening again is instant (A4-20). */}
            <div id={listId} hidden={!isOpen} aria-busy={busy || undefined}>
              {state === 'loading' ? (
                <p role="status" className="text-muted">
                  {common.loading}
                </p>
              ) : state === 'failed' ? (
                <p role="alert" className="flex flex-wrap items-center gap-3">
                  <span>{results.groups.loadFailed}</span>
                  <Button variant="secondary" onClick={() => void load(id)}>
                    {common.tryAgain}
                  </Button>
                </p>
              ) : !own ? null : shown.length === 0 ? (
                <EmptyState>{results.groups.empty}</EmptyState>
              ) : (
                <ul className={cx('grid md:grid-cols-2', cardListGap)}>
                  {mounted.map((p) => (
                    <Fragment key={p.id}>{own[p.id]}</Fragment>
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
