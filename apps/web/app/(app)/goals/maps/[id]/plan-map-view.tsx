'use client';

import {
  missingSlots,
  type OutlineNode,
  outlineOf,
  PLAN_LIMITS,
  type PlanMapView,
  type PlanMoveKind,
  type PlanNode,
  type PlanStatus,
  planMove,
  planTemplate,
  subtreeIds,
} from '@universityflow/ui';
import { useRouter } from 'next/navigation';
import {
  type CSSProperties,
  type ReactNode,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import {
  Button,
  ButtonLink,
  Field,
  Input,
  Notice,
  Page,
  Select,
  StatusLine,
  TextArea,
} from '@/components/ui';
import { type WrittenCare, WrittenCarePanel } from '@/components/written-care';
import { ApiError, api, errorMessage } from '@/lib/client/api';
import { fill } from '@/lib/client/fill';
import { useStatus } from '@/lib/client/status';
import type { PlanCopy, SlotCopy, TemplateCopy } from '@/lib/server/plan-maps-copy';
import { CanvasDialog, MapCanvas } from './plan-map-canvas';

/**
 * One plan map (docs/design/plan-maps-proposal.md §7, §8). **One DOM, two layouts:** the map is
 * always one nested list in reading order (the centre as the `h2`, each stop an `li` with an
 * `h3`, its steps nested); from a set width, globals.css lays the same list out as the picture
 * (a ring, a cloud, a staircase, branches, a road), with the connectors one `aria-hidden` SVG
 * behind it. There is no second copy of the words, so what a screen reader hears can't drift from
 * what is drawn. Editing is buttons, never drag: Edit opens the part in place; More moves it up,
 * down, in or out, or deletes it after asking inside the page.
 *
 * Every save is read by the chat's crisis check on the server (D3): when the words need care the
 * crisis card appears at once under the part, and focus moves to it. Its words come as props.
 */

type Care = { readonly at: string; readonly care: WrittenCare };

const VIEW_KEY = 'uf-plan-map-view';

const STATUS_ORDER: ReadonlyArray<PlanStatus> = ['planned', 'achieved', 'not-achieved'];

/** How long a re-flow takes: the token, 0ms under reduced motion (tokens.css). */
function flipDuration(): number {
  const value = getComputedStyle(document.documentElement).getPropertyValue('--uf-duration-normal');
  const ms = Number.parseFloat(value);
  return Number.isFinite(ms) ? ms : 0;
}

export function PlanMapPage({
  map: initial,
  copy,
  template,
  justCreated,
}: {
  map: PlanMapView;
  copy: PlanCopy;
  template: TemplateCopy;
  /** Just started from My goal: focus goes to the title. */
  justCreated: boolean;
}) {
  const router = useRouter();
  const [map, setMap] = useState(initial);
  const [editing, setEditing] = useState<string | null>(null);
  const [menu, setMenu] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [care, setCare] = useState<Care | null>(null);
  const [status, setStatus] = useStatus();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<'picture' | 'list'>('picture');
  const [focusId, setFocusId] = useState<{ id: string; n: number } | null>(null);
  const [justAchieved, setJustAchieved] = useState<string | null>(null);
  const [adding, setAdding] = useState('');
  /** The picture's canvas is open full screen (plan-map-canvas.tsx). */
  const [canvasOpen, setCanvasOpen] = useState(false);
  /** The canvas was opened and closed: the card's Open takes focus back when it returns. */
  const [canvasClosed, setCanvasClosed] = useState(false);
  const inFlight = useRef(false);
  const title = useRef<HTMLHeadingElement>(null);
  const flip = useRef<Map<string, DOMRect> | null>(null);
  const tpl = planTemplate(map.templateId);
  const outline = outlineOf(map.nodes);

  useEffect(() => {
    if (justCreated) title.current?.focus();
  }, [justCreated]);

  // The learner's choice of Picture or List, in this browser only.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(VIEW_KEY);
      if (saved === 'list' || saved === 'picture') setView(saved);
    } catch {
      // Storage can be off: the picture is the default.
    }
  }, []);

  // Focus never drops to <body> (WCAG 2.4.3): after a change, it goes where the change is.
  useEffect(() => {
    if (focusId) document.getElementById(focusId.id)?.focus();
  }, [focusId]);
  const focusOn = (id: string) => setFocusId((f) => ({ id, n: (f?.n ?? 0) + 1 }));

  // M5: a move or a delete re-flows the list over the normal duration (FLIP by hand), at once
  // under reduced motion (the token is 0ms there).
  useLayoutEffect(() => {
    const before = flip.current;
    flip.current = null;
    if (!before) return;
    const duration = flipDuration();
    if (duration <= 0) return;
    for (const el of document.querySelectorAll<HTMLElement>('[data-node-id]')) {
      const was = before.get(el.dataset['nodeId'] ?? '');
      if (!was || typeof el.animate !== 'function') continue;
      const now = el.getBoundingClientRect();
      const dx = was.left - now.left;
      const dy = was.top - now.top;
      if (dx === 0 && dy === 0) continue;
      el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], {
        duration,
        easing: 'ease-out',
      });
    }
  });
  function measure() {
    const rects = new Map<string, DOMRect>();
    for (const el of document.querySelectorAll<HTMLElement>('[data-node-id]')) {
      rects.set(el.dataset['nodeId'] ?? '', el.getBoundingClientRect());
    }
    flip.current = rects;
  }

  function planError(e: unknown): string {
    if (e instanceof ApiError && e.code === 'state' && e.detail) {
      if (e.detail in copy.limits) return copy.limits[e.detail as keyof PlanCopy['limits']];
      if (e.detail === 'plan-words') return copy.errors.words;
      if (e.detail === 'personal-number') return copy.errors['personal-number'];
    }
    return errorMessage(e);
  }

  /** One request at a time: a press while one runs does nothing (A3-01). */
  async function run<T>(call: () => Promise<T>): Promise<T | null> {
    if (inFlight.current) return null;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    setStatus('');
    try {
      return await call();
    } catch (e) {
      setError(planError(e));
      return null;
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  const slot = (n: PlanNode): SlotCopy | null =>
    n.slotId ? (template.slots[n.slotId] ?? null) : null;
  const nameOf = (n: PlanNode) => slot(n)?.heading || n.text || copy.newStep;
  const statusWord = (s: PlanStatus) => copy.status[s];

  async function save(node: PlanNode, patch: Record<string, unknown>) {
    const result = await run(() =>
      api<{ node: PlanNode; care: WrittenCare | null }>(
        `/api/me/plan-maps/${map.id}/nodes/${node.id}`,
        { method: 'PUT', json: patch },
      ),
    );
    if (!result) return;
    setMap((m) => ({ ...m, nodes: m.nodes.map((n) => (n.id === node.id ? result.node : n)) }));
    setEditing(null);
    if (result.node.status === 'achieved' && node.status !== 'achieved') setJustAchieved(node.id);
    setStatus(fill(copy.savedStatus, nameOf(result.node), statusWord(result.node.status)));
    if (result.care) {
      setCare({ at: node.id, care: result.care });
      // The crisis card moves focus to itself (WrittenCarePanel); a setback line doesn't.
      if (result.care.level === 'setback') focusOn(`edit-${node.id}`);
    } else {
      setCare((c) => (c?.at === node.id ? null : c));
      focusOn(`edit-${node.id}`);
    }
  }

  async function move(node: PlanNode, kind: PlanMoveKind) {
    const to = planMove(map.nodes, node.id, kind);
    if (to === null) return;
    if (typeof to === 'string') {
      setError(copy.limits[to]);
      return;
    }
    const result = await run(() =>
      api<{ map: PlanMapView }>(`/api/me/plan-maps/${map.id}/nodes/${node.id}/move`, {
        method: 'POST',
        json: to,
      }),
    );
    if (!result) return;
    measure();
    setMenu(null);
    setMap(result.map);
    setStatus(copy.moved);
    focusOn(`more-${node.id}`);
  }

  async function remove(node: PlanNode) {
    const done = await run(() =>
      api(`/api/me/plan-maps/${map.id}/nodes/${node.id}`, { method: 'DELETE' }),
    );
    if (done === null) return;
    const gone = new Set(subtreeIds(map.nodes, node.id));
    const siblings = map.nodes
      .filter((n) => n.parentId === node.parentId && !gone.has(n.id))
      .sort((a, b) => a.position - b.position);
    const before = [...siblings].reverse().find((n) => n.position < node.position);
    measure();
    setMap((m) => ({
      ...m,
      nodes: m.nodes
        .filter((n) => !gone.has(n.id))
        .map((n) => {
          const i = siblings.findIndex((s) => s.id === n.id);
          return i === -1 ? n : { ...n, position: i };
        }),
    }));
    setConfirming(null);
    setMenu(null);
    setStatus(copy.deleted);
    focusOn(`edit-${before?.id ?? node.parentId ?? ''}`);
  }

  async function addUnder(parent: PlanNode) {
    const result = await run(() =>
      api<{ node: PlanNode }>(`/api/me/plan-maps/${map.id}/nodes`, {
        method: 'POST',
        json: { parentId: parent.id },
      }),
    );
    if (!result) return;
    setMap((m) => ({ ...m, nodes: [...m.nodes, result.node] }));
    setMenu(null);
    setEditing(result.node.id);
    setStatus(copy.added);
    focusOn(`words-${result.node.id}`);
  }

  const missing = missingSlots(map.templateId, map.nodes);

  async function addStop() {
    const choice = missing.find((m) => m.slotId === adding);
    if (!choice) return;
    const result = await run(async () => {
      await api(`/api/me/plan-maps/${map.id}/nodes`, {
        method: 'POST',
        json: { parentId: choice.parentId, slotId: choice.slotId },
      });
      return api<{ map: PlanMapView }>(`/api/me/plan-maps/${map.id}`);
    });
    if (!result) return;
    setMap(result.map);
    setAdding('');
    setStatus(copy.added);
    const added = result.map.nodes.find((n) => n.slotId === choice.slotId);
    if (added) focusOn(`edit-${added.id}`);
  }

  async function saveTitle(value: string) {
    const result = await run(() =>
      api<{ map: PlanMapView; care: WrittenCare | null }>(`/api/me/plan-maps/${map.id}`, {
        method: 'PATCH',
        json: { title: value.trim() === '' ? null : value },
      }),
    );
    if (!result) return;
    setMap(result.map);
    setStatus(copy.saved);
    setCare(result.care ? { at: 'title', care: result.care } : null);
  }

  async function deleteMap() {
    const done = await run(() => api(`/api/me/plan-maps/${map.id}`, { method: 'DELETE' }));
    if (done !== null) router.push('/goals');
  }

  const pageTitle = map.title ?? template.name;
  const total = outline?.children.length ?? 0;
  const ringLike = tpl.layout === 'ring' || tpl.layout === 'cloud' || tpl.layout === 'branches';
  // More stops than the ring has cells: the picture would hide some, so it is the list.
  const shown = ringLike && total > RING_MAX ? 'list' : view;
  const ring = ringLike && total <= RING_MAX;

  const renderNode = (o: OutlineNode, index: number): ReactNode => {
    const n = o.node;
    const words = slot(n);
    const tone = (index % 6) + 1;
    const cell = ring ? ringCells(total)[index] : undefined;
    const style =
      n.depth === 1
        ? ({
            '--i': index,
            '--uf-map-tone': `var(--uf-color-map-tone${tone})`,
            '--uf-map-soft': `var(--uf-color-map-tone${tone}-soft)`,
            // Only a grid item takes it: in the outline it does nothing.
            ...(cell ? { gridArea: `${cell[0]} / ${cell[1]}` } : {}),
          } as CSSProperties)
        : undefined;
    const name = nameOf(n);
    const parent = map.nodes.find((p) => p.id === n.parentId);
    const hint = words?.hint ?? (parent ? (slot(parent)?.childHint ?? null) : null);
    const Heading = n.depth === 1 ? 'h3' : 'h4';
    const steps = subtreeIds(map.nodes, n.id).length - 1;
    const isOpen = menu === n.id;
    const can = (kind: PlanMoveKind) => planMove(map.nodes, n.id, kind) !== null;
    return (
      <li
        key={n.id}
        data-node-id={n.id}
        data-status={n.status}
        data-just={justAchieved === n.id ? 'achieved' : undefined}
        className={n.depth === 1 ? 'uf-map-branch' : 'uf-map-step'}
        style={style}
      >
        <div className="uf-map-card">
          <Heading id={`heading-${n.id}`} className="uf-map-heading">
            {n.depth === 1 ? (
              <span aria-hidden="true" className="uf-map-number">
                {index + 1}
              </span>
            ) : null}
            {tpl.ordered && n.depth === 1 ? (
              <span className="sr-only">{`${fill(copy.stepOf, index + 1, total)}: `}</span>
            ) : null}
            <span>{name}</span>
            {words?.subtitle ? <span className="uf-map-subtitle"> ({words.subtitle})</span> : null}
          </Heading>
          <p className="uf-map-status">
            <StatusIcon status={n.status} />
            <span>{statusWord(n.status)}</span>
          </p>
          {words && n.text ? <p className="uf-map-words">{n.text}</p> : null}
          {!n.text && hint ? <p className="uf-map-hint">{hint}</p> : null}
          {n.whyNot ? (
            <p className="text-sm">
              <span className="font-medium">
                {n.status === 'achieved' ? copy.learnedLastTime : copy.whyNotShown}:
              </span>{' '}
              {n.whyNot}
            </p>
          ) : null}
          {n.differently ? (
            <p className="text-sm">
              <span className="font-medium">{copy.differentlyShown}:</span> {n.differently}
            </p>
          ) : null}
          {n.targetMonth ? (
            <p className="text-sm text-muted">{fill(copy.targetShown, monthName(n.targetMonth))}</p>
          ) : null}
          {words?.link ? (
            <p className="text-sm">
              <ButtonLink href={words.link.href} variant="quiet" className="px-0">
                {words.link.label}
              </ButtonLink>
            </p>
          ) : null}

          {editing === n.id ? (
            <NodeEditor
              node={n}
              copy={copy}
              hint={hint}
              wordsAllowed={map.wordsAllowed}
              busy={busy}
              onSave={(patch) => void save(n, patch)}
              onCancel={() => {
                setEditing(null);
                focusOn(`edit-${n.id}`);
              }}
            />
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button
                id={`edit-${n.id}`}
                variant="secondary"
                aria-label={fill(copy.editing, name)}
                onClick={() => {
                  setEditing(n.id);
                  setMenu(null);
                }}
              >
                {copy.edit}
              </Button>
              <Button
                id={`more-${n.id}`}
                variant="secondary"
                aria-label={fill(copy.moreFor, name)}
                aria-expanded={isOpen}
                aria-controls={`menu-${n.id}`}
                onClick={() => setMenu(isOpen ? null : n.id)}
              >
                {copy.more}
              </Button>
            </div>
          )}

          {isOpen && confirming !== n.id ? (
            <div id={`menu-${n.id}`} className="flex flex-wrap gap-2">
              {map.wordsAllowed ? (
                <Button
                  variant="quiet"
                  aria-disabled={busy}
                  onClick={() => !busy && void addUnder(n)}
                >
                  {copy.addChild}
                </Button>
              ) : null}
              {(['up', 'down', 'out', 'in'] as const).map((kind) => (
                <Button
                  key={kind}
                  variant="quiet"
                  aria-disabled={busy || !can(kind)}
                  onClick={() => {
                    if (!busy && can(kind)) void move(n, kind);
                  }}
                >
                  {copy[MOVE_LABEL[kind]]}
                </Button>
              ))}
              <Button
                variant="quiet"
                onClick={() => {
                  setConfirming(n.id);
                  focusOn(`confirm-${n.id}`);
                }}
              >
                {copy.delete}
              </Button>
            </div>
          ) : null}

          {confirming === n.id ? (
            <div className="flex flex-col gap-2 rounded-md bg-sunk p-3">
              <p id={`confirm-${n.id}`} tabIndex={-1} className="font-medium">
                {steps === 0
                  ? fill(copy.deleteAskNone, name)
                  : steps === 1
                    ? fill(copy.deleteAskOne, name)
                    : fill(copy.deleteAsk, name, steps)}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="danger"
                  aria-disabled={busy}
                  onClick={() => !busy && void remove(n)}
                >
                  {copy.delete}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setConfirming(null);
                    setMenu(null);
                    focusOn(`more-${n.id}`);
                  }}
                >
                  {copy.keep}
                </Button>
              </div>
            </div>
          ) : null}

          {care?.at === n.id ? (
            <WrittenCarePanel
              care={care.care}
              words={copy.care}
              onSeen={() => {
                setCare(null);
                focusOn(`edit-${n.id}`);
              }}
            />
          ) : null}
        </div>
        {o.children.length > 0 ? (
          <ul className="uf-map-steps">{o.children.map((c, i) => renderNode(c, i))}</ul>
        ) : null}
      </li>
    );
  };

  const Branches = tpl.ordered ? 'ol' : 'ul';
  const centre = outline?.node;
  const centreWords = centre ? slot(centre) : null;

  // The map, drawn once: as the picture it sits on a canvas card (and, opened, in the dialog
  // instead, so there is never a second copy of its words); as the list it is the page's own.
  const mapSection = centre ? (
    <section
      aria-labelledby={`heading-${centre.id}`}
      className={`uf-map uf-map--${tpl.layout}`}
      data-view={shown}
    >
      {ring ? <MapLines count={total} /> : null}
      <div className="uf-map-centre" data-node-id={centre.id}>
        <h2 id={`heading-${centre.id}`} className="text-xl">
          {centreWords?.heading ?? copy.goalCentre}
        </h2>
        {centre.text ? <p className="uf-map-words">{centre.text}</p> : null}
        {!centre.text && centreWords?.hint ? (
          <p className="uf-map-hint">{centreWords.hint}</p>
        ) : null}
        {map.goal ? (
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium">{copy.goalCentre}</p>
            <p>
              {map.goal.kind === 'goal'
                ? fill(copy.goalAt, map.goal.course, map.goal.university)
                : map.goal.kind === 'none'
                  ? copy.goalNone
                  : copy.goalUnavailable}
            </p>
            {map.goal.kind === 'goal' ? (
              <ButtonLink href="/goals" variant="quiet" className="px-0">
                {copy.goalLink}
              </ButtonLink>
            ) : null}
          </div>
        ) : null}
        {map.wordsAllowed ? (
          editing === centre.id ? (
            <NodeEditor
              node={centre}
              copy={copy}
              hint={centreWords?.hint ?? null}
              wordsAllowed
              centre
              busy={busy}
              onSave={(patch) => void save(centre, patch)}
              onCancel={() => {
                setEditing(null);
                focusOn(`edit-${centre.id}`);
              }}
            />
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button
                id={`edit-${centre.id}`}
                variant="secondary"
                aria-label={fill(copy.editing, centreWords?.heading ?? copy.goalCentre)}
                onClick={() => setEditing(centre.id)}
              >
                {copy.edit}
              </Button>
              <Button
                variant="secondary"
                aria-disabled={busy}
                onClick={() => !busy && void addUnder(centre)}
              >
                {copy.addStop}
              </Button>
            </div>
          )
        ) : null}
        {care?.at === centre.id ? (
          <WrittenCarePanel care={care.care} words={copy.care} onSeen={() => setCare(null)} />
        ) : null}
      </div>
      <Branches className="uf-map-branches">
        {outline?.children.map((c, i) => renderNode(c, i))}
      </Branches>
    </section>
  ) : null;

  return (
    <Page title={pageTitle} lead={copy.onlyYou} headingRef={title}>
      <div>
        <ButtonLink href="/goals" variant="quiet" className="px-0">
          {copy.back}
        </ButtonLink>
      </div>
      {error ? <Notice tone="danger">{error}</Notice> : null}
      <StatusLine said={status} />
      {map.wordsAllowed ? null : <Notice tone="info">{copy.wordsWait}</Notice>}

      {map.wordsAllowed ? (
        <TitleForm copy={copy} title={map.title} busy={busy} onSave={(v) => void saveTitle(v)} />
      ) : null}
      {care?.at === 'title' ? (
        <WrittenCarePanel care={care.care} words={copy.care} onSeen={() => setCare(null)} />
      ) : null}

      <div className={`uf-map-toggle uf-map-toggle--from-${tpl.pictureFrom}`}>
        <span className="font-medium">{copy.showAs}</span>
        {(['picture', 'list'] as const).map((v) => (
          <Button
            key={v}
            variant="secondary"
            aria-pressed={view === v}
            onClick={() => {
              setView(v);
              try {
                window.localStorage.setItem(VIEW_KEY, v);
              } catch {
                // Not remembered: fine.
              }
            }}
          >
            {copy[v]}
          </Button>
        ))}
      </div>

      {shown === 'picture' && mapSection ? (
        <>
          {/* The dialog first: its effects run before the card's, so it has closed (and the page
              is no longer inert) when the card's Open takes focus back. */}
          <CanvasDialog
            open={canvasOpen}
            title={pageTitle}
            closeLabel={copy.canvas.close}
            onClose={() => {
              setCanvasOpen(false);
              setCanvasClosed(true);
            }}
          >
            {canvasOpen ? (
              <MapCanvas copy={copy.canvas} layout={tpl.layout} expanded>
                {mapSection}
              </MapCanvas>
            ) : null}
          </CanvasDialog>
          {canvasOpen ? (
            <p className="uf-canvas-away text-muted">{copy.canvas.openNow}</p>
          ) : (
            <MapCanvas
              copy={copy.canvas}
              layout={tpl.layout}
              returnFocus={canvasClosed}
              onOpen={() => setCanvasOpen(true)}
            >
              {mapSection}
            </MapCanvas>
          )}
        </>
      ) : (
        mapSection
      )}

      {missing.length > 0 ? (
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-60 flex-1">
            <Field label={copy.addFromTemplate}>
              {({ id }) => (
                <Select id={id} value={adding} onChange={(e) => setAdding(e.target.value)}>
                  <option value="">{copy.addStop}</option>
                  {missing.map((m) => (
                    <option key={m.slotId} value={m.slotId}>
                      {template.slots[m.slotId]?.heading ?? m.slotId}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>
          <Button
            variant="secondary"
            aria-disabled={busy || adding === ''}
            onClick={() => {
              if (!busy && adding !== '') void addStop();
            }}
          >
            {copy.addStop}
          </Button>
        </div>
      ) : null}

      <p className="text-sm text-muted">{copy.exportNote}</p>

      {confirming === 'map' ? (
        <div className="flex flex-col gap-2 rounded-md bg-sunk p-3">
          <p id="confirm-map" tabIndex={-1} className="font-medium">
            {fill(copy.deleteMapAsk, pageTitle)}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="danger" aria-disabled={busy} onClick={() => !busy && void deleteMap()}>
              {copy.delete}
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setConfirming(null);
                focusOn('delete-map');
              }}
            >
              {copy.keep}
            </Button>
          </div>
        </div>
      ) : (
        <div>
          <Button
            id="delete-map"
            variant="secondary"
            onClick={() => {
              setConfirming('map');
              focusOn('confirm-map');
            }}
          >
            {copy.deleteMap}
          </Button>
        </div>
      )}
    </Page>
  );
}

const MOVE_LABEL = { up: 'moveUp', down: 'moveDown', out: 'moveOut', in: 'moveIn' } as const;

/** "Nov 2028", in South African English, from `2028-11`. */
function monthName(month: string): string {
  return new Date(`${month}-15T12:00:00Z`).toLocaleDateString('en-ZA', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** The twelve months' names, from the browser's own South African English. */
const MONTHS = Array.from({ length: 12 }, (_, i) =>
  new Date(Date.UTC(2026, i, 15)).toLocaleDateString('en-ZA', { month: 'long', timeZone: 'UTC' }),
);

/** The status as an icon beside its word (never colour alone): decoration, so hidden. */
function StatusIcon({ status }: { status: PlanStatus }) {
  return (
    <svg
      aria-hidden="true"
      data-status-icon={status}
      className={`uf-map-icon uf-map-icon--${status}`}
      viewBox="0 0 24 24"
      width="20"
      height="20"
    >
      {status === 'planned' ? <circle cx="12" cy="12" r="8" /> : null}
      {status === 'achieved' ? (
        <>
          <circle cx="12" cy="12" r="10" />
          <path className="uf-map-tick" pathLength={1} d="M7 12.5l3.2 3.2L17 9" />
        </>
      ) : null}
      {status === 'not-achieved' ? <path d="M17.5 8A7 7 0 1 0 19 13M17.5 8V3.5M17.5 8H13" /> : null}
    </svg>
  );
}

/** The most stops a ring, a cloud or the life map lays out around its centre; more is a list. */
const RING_MAX = 8;

/**
 * Where each stop sits around the centre of a 3 by 3 grid, as [row, column], clockwise from the
 * top (picture 2's "read clockwise"), so the picture's order is the list's: up to four on the
 * sides; five or six as picture 1's ring (top, the corners, bottom); seven or eight all round.
 */
function ringCells(count: number): ReadonlyArray<readonly [number, number]> {
  if (count <= 4)
    return [
      [1, 2],
      [2, 3],
      [3, 2],
      [2, 1],
    ];
  if (count <= 6)
    return [
      [1, 2],
      [1, 3],
      [3, 3],
      [3, 2],
      [3, 1],
      [1, 1],
    ];
  return [
    [1, 2],
    [1, 3],
    [2, 3],
    [3, 3],
    [3, 2],
    [3, 1],
    [2, 1],
    [1, 1],
  ];
}

/** The connectors behind the picture: decoration only, from the centre to each stop's cell. */
function MapLines({ count }: { count: number }) {
  const cells = ringCells(count)
    .slice(0, count)
    .map(([row, col]) => [(col - 1) * 100 + 50, (row - 1) * 100 + 50] as const);
  return (
    <svg
      aria-hidden="true"
      className="uf-map-lines"
      viewBox="0 0 300 300"
      preserveAspectRatio="none"
    >
      {cells.map(([x, y], i) => (
        <path
          key={`${x}-${y}`}
          className="uf-map-line"
          pathLength={1}
          style={{ '--i': i } as CSSProperties}
          d={`M150 150 Q ${(150 + x) / 2 + (y - 150) / 4} ${(150 + y) / 2 - (x - 150) / 4} ${x} ${y}`}
        />
      ))}
    </svg>
  );
}

function TitleForm({
  copy,
  title,
  busy,
  onSave,
}: {
  copy: PlanCopy;
  title: string | null;
  busy: boolean;
  onSave: (value: string) => void;
}) {
  const [value, setValue] = useState(title ?? '');
  return (
    <form
      className="flex flex-wrap items-end gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!busy) onSave(value);
      }}
    >
      <div className="min-w-60 flex-1">
        <Field label={copy.mapTitle} hint={copy.mapTitleHint}>
          {({ id, describedBy }) => (
            <Input
              id={id}
              aria-describedby={describedBy}
              value={value}
              maxLength={PLAN_LIMITS.title}
              onChange={(e) => setValue(e.target.value)}
            />
          )}
        </Field>
      </div>
      <Button type="submit" variant="secondary" aria-disabled={busy}>
        {copy.saveTitle}
      </Button>
    </form>
  );
}

/** A part's editor, in place under it (§8.2): its words, how it went, the reflections, a target. */
function NodeEditor({
  node,
  copy,
  hint,
  wordsAllowed,
  centre = false,
  busy,
  onSave,
  onCancel,
}: {
  node: PlanNode;
  copy: PlanCopy;
  hint: string | null;
  wordsAllowed: boolean;
  centre?: boolean;
  busy: boolean;
  onSave: (patch: Record<string, unknown>) => void;
  onCancel: () => void;
}) {
  const ids = useId();
  const [text, setText] = useState(node.text ?? '');
  const [status, setStatus] = useState<PlanStatus>(node.status);
  const [whyNot, setWhyNot] = useState(node.whyNot ?? '');
  const [differently, setDifferently] = useState(node.differently ?? '');
  const [month, setMonth] = useState(node.targetMonth?.slice(5, 7) ?? '');
  const [year, setYear] = useState(node.targetMonth?.slice(0, 4) ?? '');
  const thisYear = new Date().getFullYear();
  const years = Array.from({ length: 11 }, (_, i) => thisYear - 2 + i).filter(
    (y) => y >= PLAN_LIMITS.firstYear && y <= PLAN_LIMITS.lastYear,
  );
  const left = (value: string, max: number) => fill(copy.charactersLeft, max - value.length);

  return (
    <form
      className="uf-map-editor flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (busy) return;
        const target = month && year ? `${year}-${month}` : null;
        onSave({
          ...(wordsAllowed ? { text: text.trim() === '' ? null : text } : {}),
          ...(centre ? {} : { status, targetMonth: target }),
          ...(wordsAllowed && !centre
            ? {
                whyNot: whyNot.trim() === '' ? null : whyNot,
                differently: differently.trim() === '' ? null : differently,
              }
            : {}),
        });
      }}
    >
      {wordsAllowed ? (
        // The placeholder prompt is visible hint text, tied to the field (§7), not a placeholder.
        <div className="flex flex-col gap-1">
          <label htmlFor={`words-${node.id}`} className="font-medium">
            {copy.myWords}
          </label>
          {hint ? (
            <p id={`${ids}-words-hint`} className="text-sm text-muted">
              {hint}
            </p>
          ) : null}
          <TextArea
            id={`words-${node.id}`}
            aria-describedby={[hint ? `${ids}-words-hint` : '', `${ids}-words-left`]
              .filter(Boolean)
              .join(' ')}
            value={text}
            maxLength={PLAN_LIMITS.text}
            onChange={(e) => setText(e.target.value)}
          />
          <p id={`${ids}-words-left`} className="text-sm text-muted">
            {left(text, PLAN_LIMITS.text)}
          </p>
        </div>
      ) : null}

      {centre ? null : (
        <fieldset className="flex flex-col gap-1">
          <legend className="mb-1 font-medium">{copy.statusLegend}</legend>
          <div className="flex flex-wrap gap-2">
            {STATUS_ORDER.map((s) => (
              <label
                key={s}
                className="uf-map-radio flex min-h-11 items-center gap-2 rounded-md px-3"
              >
                <input
                  type="radio"
                  name={`${ids}-status`}
                  value={s}
                  checked={status === s}
                  onChange={() => setStatus(s)}
                  className="size-5 accent-brand"
                />
                <StatusIcon status={s} />
                <span>{copy.status[s]}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {!centre && status === 'not-achieved' && wordsAllowed ? (
        <div className="uf-map-reflect flex flex-col gap-3">
          <Field label={copy.whyNot}>
            {({ id }) => (
              <TextArea
                id={id}
                value={whyNot}
                maxLength={PLAN_LIMITS.reflection}
                onChange={(e) => setWhyNot(e.target.value)}
              />
            )}
          </Field>
          <Field label={copy.differently}>
            {({ id }) => (
              <TextArea
                id={id}
                value={differently}
                maxLength={PLAN_LIMITS.reflection}
                onChange={(e) => setDifferently(e.target.value)}
              />
            )}
          </Field>
        </div>
      ) : null}

      {centre ? null : (
        <fieldset className="flex flex-col gap-1" aria-describedby={`${ids}-target-hint`}>
          <legend className="font-medium">{copy.target}</legend>
          <p id={`${ids}-target-hint`} className="text-sm text-muted">
            {copy.targetHint}
          </p>
          <div className="flex flex-wrap gap-3">
            <div className="min-w-40">
              <Field label={copy.month}>
                {({ id }) => (
                  <Select id={id} value={month} onChange={(e) => setMonth(e.target.value)}>
                    <option value="">{copy.noTarget}</option>
                    {MONTHS.map((name, i) => (
                      <option key={name} value={String(i + 1).padStart(2, '0')}>
                        {name}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            </div>
            <div className="min-w-32">
              <Field label={copy.year}>
                {({ id }) => (
                  <Select id={id} value={year} onChange={(e) => setYear(e.target.value)}>
                    <option value="">{copy.noTarget}</option>
                    {years.map((y) => (
                      <option key={y} value={String(y)}>
                        {y}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            </div>
          </div>
        </fieldset>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" aria-disabled={busy}>
          {copy.save}
        </Button>
        <Button variant="secondary" onClick={onCancel}>
          {copy.cancel}
        </Button>
      </div>
    </form>
  );
}
