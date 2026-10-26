import { CV_REPORT_REASONS, type CvReportReason, en } from '@universityflow/content/app';
import {
  type CrisisCardArtifact,
  type CvInline,
  cvInlineText,
  cvTextBlocks,
} from '@universityflow/ui';
import { Fragment, type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { CrisisCard } from '../components/artifact-card';
import {
  announce,
  Body,
  Button,
  Card,
  Checkbox,
  Field,
  focusOn,
  Heading,
  Notice,
  PageHeader,
  Radio,
  RadioGroup,
  Screen,
  SectionTitle,
  SourceLink,
  useAnnounce,
} from '../components/ui';
import { ApiError, api, errorMessage } from '../lib/api';
import { apiUrl } from '../lib/config';
import { formatDate } from '../lib/format';
import { theme } from '../lib/theme';

/**
 * My CV in the app (docs/design/mmereko-api-proposal.md §10.5): the web page's sections as an
 * outline, on the same API (the app never holds keys or calls Mmereko). The opt-in card first
 * (§9.2's draft wording); then what goes on the CV, the learner's projects and skills (added and
 * deleted here, changed on the web), Make my CV, Fit it to a job, the list with its status words,
 * a preview whose PDF opens through its 60-second link in the phone's own viewer (`Linking`, so no
 * new native module), sharing for an adult in their own name only (D6), and Stop using Mmereko
 * with each CV's download offered first (D15). While a CV is being made the list is read again
 * every few seconds. Nothing animates (the app's rule): the status is a word.
 *
 * Wave 5: "Report this CV" under a fitted CV (A10-58), Delete on each CV asked on the screen first
 * (A11-38), and the preview's CV as headers, bullet lines and paragraphs (A2-47).
 */

const t = en.cv;
const POLL_MS = 5000;
const SHARE_DAYS = [7, 14, 30, 60, 90] as const;

type Care =
  | { readonly level: 'crisis' | 'concern'; readonly card: CrisisCardArtifact }
  | { readonly level: 'setback' };

interface OptIn {
  readonly optedInAt: string;
  readonly purposes: ReadonlyArray<string>;
}
interface OptInState {
  readonly optIn: OptIn | null;
  readonly wordingCovers: boolean;
  readonly canShare: boolean;
}
interface Entry {
  readonly id: string;
  readonly kind: keyof typeof t.entries.kinds;
  readonly title: string;
  readonly organisation: string | null;
}
interface Selection {
  readonly surname: string | null;
  readonly label: string | null;
  readonly summary: string | null;
  readonly email: string | null;
  readonly phone: string | null;
  readonly city: string | null;
  readonly region: string | null;
  readonly includeSchool: boolean;
  readonly subjectIds: ReadonlyArray<string>;
  readonly includeOffer: boolean;
  readonly moduleCodes: ReadonlyArray<string>;
  readonly entryIds: ReadonlyArray<string>;
}
interface SelectionView {
  readonly selection: Selection;
  readonly available: {
    readonly school: { readonly name: string } | null;
    readonly subjects: ReadonlyArray<{ id: string; name: string; percent: number }>;
    readonly offer: { readonly university: string | null; readonly course: string | null } | null;
    readonly modules: ReadonlyArray<{ code: string; name: string | null; year: number }>;
    readonly entries: ReadonlyArray<{ id: string; title: string }>;
  };
  readonly ready: boolean;
  readonly missing: ReadonlyArray<'name' | 'education'>;
}
interface Doc {
  readonly id: string;
  readonly kind: 'draft' | 'tailored';
  readonly status: keyof typeof t.status;
  readonly advertTitle: string | null;
  readonly advertCompany: string | null;
  readonly markdown: string | null;
  readonly gaps: ReadonlyArray<string>;
  readonly atsCoverage: number | null;
  readonly atsMissing: ReadonlyArray<string>;
  readonly atsMissingMust: ReadonlyArray<string>;
  readonly hasPdf: boolean;
  readonly confirmedAt: string | null;
  readonly createdAt: string;
}
interface Share {
  readonly id: string;
  readonly documentId: string;
  readonly expiresAt: string;
  readonly revokedAt: string | null;
  readonly viewCount: number;
}

const pending = (d: Doc) => d.status === 'queued' || d.status === 'submitted';
const orNull = (text: string | null) => (text?.trim() ? text.trim() : null);

function docName(d: Doc): string {
  if (d.kind === 'draft' || !d.advertTitle) return t.list.draft;
  return d.advertCompany
    ? t.list.tailoredAt(d.advertTitle, d.advertCompany)
    : t.list.tailored(d.advertTitle);
}

/**
 * Where an error shows: in the card whose press it answers, not at the top of a long screen
 * scrolled away from (WCAG 3.3.1; audit CV-A2, A2-43). `page` is the top, for the first read.
 */
type ErrorAt =
  | 'page'
  | 'opt-in'
  | 'what'
  | 'entries'
  | 'make'
  | 'preview'
  | 'tailor'
  | 'withdraw'
  // The list of CVs: a delete refused (A11-38).
  | 'list';

type Focusable = View | Text | null | undefined;

/**
 * Puts the screen reader on what `find` returns once the next render is on screen: for a press
 * that takes away the control it came from, or opens something below it (WCAG 2.4.3; audit
 * CV-A2, A2-45; the pattern of A2-36).
 */
function useFocusLater() {
  const pending = useRef<(() => Focusable) | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const find = pending.current;
    pending.current = null;
    if (tick > 0 && find) focusOn(find() ?? null);
  }, [tick]);
  return useCallback((find: () => Focusable) => {
    pending.current = find;
    setTick((n) => n + 1);
  }, []);
}

/** A card's error, in the card (A2-43). Notice announces it on both platforms. */
function CardError({ error }: { error: string | null }) {
  return error ? <Notice tone="danger">{error}</Notice> : null;
}

/** The CV routes' reasons, in `cv.errors`; anything else is the app's usual sentence. */
function cvError(error: unknown): string {
  const reasons = t.errors as Record<string, string>;
  if (error instanceof ApiError) {
    if (error.detail && Object.hasOwn(reasons, error.detail)) return reasons[error.detail] ?? '';
    if (Object.hasOwn(reasons, error.code)) return reasons[error.code] ?? '';
  }
  return errorMessage(error);
}

export default function CvScreen() {
  const [loaded, setLoaded] = useState<'loading' | 'off' | 'on'>('loading');
  const [state, setState] = useState<OptInState | null>(null);
  const [entries, setEntries] = useState<ReadonlyArray<Entry>>([]);
  const [view, setView] = useState<SelectionView | null>(null);
  const [docs, setDocs] = useState<ReadonlyArray<Doc>>([]);
  const [shares, setShares] = useState<ReadonlyArray<Share>>([]);
  /** The ids of the CVs the learner reported (A10-58). */
  const [reported, setReported] = useState<ReadonlyArray<string>>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<{ readonly text: string; readonly at: ErrorAt } | null>(null);
  useAnnounce(status);

  const say = (text: string) => {
    setError(null);
    setStatus(text);
  };
  const fail = (e: unknown, at: ErrorAt = 'page') => {
    setStatus(null);
    setError({ text: cvError(e), at });
  };
  /** The error a card shows, and its own `fail`. */
  const errorAt = (at: ErrorAt) => (error?.at === at ? error.text : null);
  const failAt = (at: ErrorAt) => (e: unknown) => fail(e, at);

  const loadAll = useCallback(async (opt: OptInState) => {
    const [e, s, d, sh] = await Promise.all([
      api<{ entries: Entry[] }>('/api/me/cv/entries'),
      api<SelectionView>('/api/me/cv/selection'),
      api<{ documents: Doc[]; reported?: string[] }>('/api/me/cv/documents'),
      opt.canShare
        ? api<{ shares: Share[] }>('/api/me/cv/shares')
        : Promise.resolve({ shares: [] as Share[] }),
    ]);
    setEntries(e.entries);
    setView(s);
    setDocs(d.documents);
    setReported(d.reported ?? []);
    setShares(sh.shares);
  }, []);

  useEffect(() => {
    let live = true;
    api<OptInState>('/api/me/cv/opt-in')
      .then(async (opt) => {
        if (!live) return;
        setState(opt);
        if (opt.optIn) await loadAll(opt);
        if (live) setLoaded('on');
      })
      .catch((e) => {
        if (!live) return;
        // 404: the server's switch is off (UF_CV); anything else is said as an error.
        if (e instanceof ApiError && e.status === 404) setLoaded('off');
        else {
          setError({ text: cvError(e), at: 'page' });
          setLoaded('off');
        }
      });
    return () => {
      live = false;
    };
  }, [loadAll]);

  // While a CV is being made, read the list again.
  const waiting = docs.some(pending);
  useEffect(() => {
    if (!waiting) return;
    const timer = setTimeout(() => {
      api<{ documents: Doc[] }>('/api/me/cv/documents')
        .then(({ documents }) => {
          const done = documents.find(
            (d) => !pending(d) && docs.some((o) => o.id === d.id && pending(o)),
          );
          setDocs(documents);
          if (done) setStatus(done.status === 'ready' ? t.list.ready : t.list.failed);
        })
        .catch(() => setDocs((d) => [...d]));
    }, POLL_MS);
    return () => clearTimeout(timer);
  }, [docs, waiting]);

  /** Opens a CV's PDF through its 60-second link; a refusal shows in `at`. */
  const download = (at: ErrorAt) => async (id: string) => {
    try {
      const { pdf } = await api<{ pdf: { url: string } | null }>(`/api/me/cv/documents/${id}`);
      if (pdf) await Linking.openURL(pdf.url);
    } catch (e) {
      fail(e, at);
    }
  };

  const optIn = state?.optIn ?? null;
  return (
    <Screen belowHeader>
      <PageHeader title={t.title} lead={t.lead} />
      {status ? <Body strong>{status}</Body> : null}
      <CardError error={errorAt('page')} />
      {loaded === 'off' && !error ? <Body>{t.unavailable}</Body> : null}
      {loaded === 'on' && state && !optIn ? (
        <OptInCard
          state={state}
          error={errorAt('opt-in')}
          onError={failAt('opt-in')}
          onOptedIn={async (next) => {
            const opt = { ...state, optIn: next };
            setState(opt);
            try {
              await loadAll(opt);
            } catch (e) {
              fail(e);
            }
          }}
        />
      ) : null}
      {loaded === 'on' && state && optIn && view ? (
        <>
          <Body pair="pageMuted">{t.optIn.given(formatDate(optIn.optedInAt))}</Body>
          <SelectionCard
            view={view}
            say={say}
            fail={failAt('what')}
            error={errorAt('what')}
            onView={setView}
          />
          <EntriesCard
            entries={entries}
            say={say}
            fail={failAt('entries')}
            error={errorAt('entries')}
            onAdded={(entry) => {
              setEntries((list) => [...list, entry]);
              setView((v) =>
                v
                  ? {
                      ...v,
                      available: {
                        ...v.available,
                        entries: [...v.available.entries, { id: entry.id, title: entry.title }],
                      },
                    }
                  : v,
              );
            }}
            onRemoved={(id) => {
              setEntries((list) => list.filter((e) => e.id !== id));
              setView((v) =>
                v
                  ? {
                      ...v,
                      selection: {
                        ...v.selection,
                        entryIds: v.selection.entryIds.filter((e) => e !== id),
                      },
                      available: {
                        ...v.available,
                        entries: v.available.entries.filter((e) => e.id !== id),
                      },
                    }
                  : v,
              );
            }}
          />
          <MakeCard
            disabled={waiting || !view.ready}
            waiting={waiting}
            say={say}
            fail={failAt('make')}
            error={errorAt('make')}
            onQueued={(doc) => setDocs((list) => [doc, ...list])}
          />
          <DocumentsCard
            docs={docs}
            shares={shares}
            sharing={state.canShare && optIn.purposes.includes('cv.share')}
            reported={reported}
            download={download('preview')}
            say={say}
            fail={failAt('preview')}
            error={errorAt('preview')}
            failList={failAt('list')}
            listError={errorAt('list')}
            onDoc={(doc) => setDocs((list) => list.map((d) => (d.id === doc.id ? doc : d)))}
            onShares={setShares}
            onReported={(id) => setReported((list) => [...list, id])}
            onRemoved={(id) => {
              setDocs((list) => list.filter((d) => d.id !== id));
              // Its share links went with it (the database cascades them).
              setShares((list) => list.filter((s) => s.documentId !== id));
            }}
          />
          <TailorCard
            disabled={waiting || !view.ready}
            say={say}
            fail={failAt('tailor')}
            error={errorAt('tailor')}
            onQueued={(doc) => setDocs((list) => [doc, ...list])}
          />
          <WithdrawCard
            docs={docs}
            download={download('withdraw')}
            fail={failAt('withdraw')}
            error={errorAt('withdraw')}
            onWithdrawn={() => {
              setState({ ...state, optIn: null });
              setEntries([]);
              setDocs([]);
              setShares([]);
              say(t.withdraw.done);
            }}
          />
        </>
      ) : null}
    </Screen>
  );
}

function OptInCard({
  state,
  error,
  onError,
  onOptedIn,
}: {
  state: OptInState;
  error: string | null;
  onError: (e: unknown) => void;
  onOptedIn: (optIn: OptIn) => void;
}) {
  const [share, setShare] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <Card>
      <Heading>{t.optIn.title}</Heading>
      <Body pair="card">{t.optIn.body}</Body>
      {state.wordingCovers ? (
        <>
          {state.canShare ? (
            <>
              {/* The hint is the text under it, read in turn: not also as the box's hint (A2-50). */}
              <Checkbox label={t.optIn.share} checked={share} onPress={() => setShare((s) => !s)} />
              <Body pair="cardMuted" small>
                {t.optIn.shareHint}
              </Body>
            </>
          ) : null}
          <Button
            label={t.optIn.agree}
            busy={busy}
            busyLabel={en.common.saving}
            onPress={async () => {
              setBusy(true);
              try {
                const { optIn } = await api<{ optIn: OptIn }>('/api/me/cv/opt-in', {
                  method: 'POST',
                  json: { share },
                });
                onOptedIn(optIn);
              } catch (e) {
                onError(e);
              } finally {
                setBusy(false);
              }
            }}
          />
          <CardError error={error} />
        </>
      ) : (
        <Notice tone="info">{t.errors['cv-consent']}</Notice>
      )}
    </Card>
  );
}

const TEXT_FIELDS = [
  ['surname', t.what.surname],
  ['label', t.what.label],
  ['summary', t.what.summary],
] as const;
const CONTACT_FIELDS = [
  ['email', t.what.email],
  ['phone', t.what.phone],
  ['city', t.what.city],
  ['region', t.what.region],
] as const;

function SelectionCard({
  view,
  say,
  fail,
  error,
  onView,
}: {
  view: SelectionView;
  say: (text: string) => void;
  fail: (e: unknown) => void;
  error: string | null;
  onView: (view: SelectionView) => void;
}) {
  const [sel, setSel] = useState<Selection>(view.selection);
  const [care, setCare] = useState<Care | null>(null);
  const [busy, setBusy] = useState(false);
  const { available } = view;
  const entryIds = sel.entryIds.filter((id) => available.entries.some((e) => e.id === id));
  const toggle = (key: 'subjectIds' | 'moduleCodes' | 'entryIds', value: string) =>
    setSel((s) => ({
      ...s,
      [key]: s[key].includes(value) ? s[key].filter((v) => v !== value) : [...s[key], value],
    }));
  const offer = available.offer
    ? available.offer.course && available.offer.university
      ? t.what.offer(available.offer.course, available.offer.university)
      : (available.offer.course ?? available.offer.university)
    : null;

  return (
    <Card testID="cv-what">
      <Heading>{t.what.title}</Heading>
      <Body pair="cardMuted">{t.what.lead}</Body>
      <SectionTitle>{t.what.about}</SectionTitle>
      <Body pair="cardMuted" small>
        {t.what.from.typed}
      </Body>
      {TEXT_FIELDS.map(([key, label]) => (
        <Field
          key={key}
          label={label}
          {...(key === 'surname' ? { hint: t.what.surnameHint } : {})}
          value={sel[key] ?? ''}
          multiline={key === 'summary'}
          onChangeText={(text) => setSel((s) => ({ ...s, [key]: text }))}
        />
      ))}
      <SectionTitle>{t.what.contact}</SectionTitle>
      <Body pair="cardMuted" small>
        {t.what.from.typed}
      </Body>
      <Body pair="card" small>
        {t.what.contactHint}
      </Body>
      {CONTACT_FIELDS.map(([key, label]) => (
        <Field
          key={key}
          label={label}
          value={sel[key] ?? ''}
          keyboardType={
            key === 'email' ? 'email-address' : key === 'phone' ? 'phone-pad' : 'default'
          }
          autoCapitalize={key === 'email' ? 'none' : 'sentences'}
          onChangeText={(text) => setSel((s) => ({ ...s, [key]: text }))}
        />
      ))}
      <Group title={t.what.school} from={t.what.from.profile}>
        {available.school ? (
          <Checkbox
            label={available.school.name}
            checked={sel.includeSchool}
            onPress={() => setSel((s) => ({ ...s, includeSchool: !s.includeSchool }))}
          />
        ) : null}
      </Group>
      <Group title={t.what.subjects} from={t.what.from.report} hint={t.what.subjectsHint}>
        {available.subjects.map((s) => (
          <Checkbox
            key={s.id}
            label={t.what.subject(s.name, s.percent)}
            checked={sel.subjectIds.includes(s.id)}
            onPress={() => toggle('subjectIds', s.id)}
          />
        ))}
      </Group>
      <Group title={t.what.university} from={t.what.from.offer}>
        {offer ? (
          <Checkbox
            label={offer}
            checked={sel.includeOffer}
            onPress={() => setSel((s) => ({ ...s, includeOffer: !s.includeOffer }))}
          />
        ) : null}
      </Group>
      <Group title={t.what.modules} from={t.what.from.registration}>
        {available.modules.map((m) => (
          <Checkbox
            key={`${m.year}-${m.code}`}
            label={m.name ? t.what.module(m.code, m.name) : m.code}
            checked={sel.moduleCodes.includes(m.code)}
            onPress={() => toggle('moduleCodes', m.code)}
          />
        ))}
      </Group>
      <Group title={t.what.entries} from={t.what.from.entries}>
        {available.entries.map((e) => (
          <Checkbox
            key={e.id}
            label={e.title}
            checked={entryIds.includes(e.id)}
            onPress={() => toggle('entryIds', e.id)}
          />
        ))}
      </Group>
      <CardError error={error} />
      <Button
        label={t.what.save}
        busy={busy}
        busyLabel={en.common.saving}
        onPress={async () => {
          setBusy(true);
          try {
            const body: Selection = {
              ...sel,
              surname: orNull(sel.surname),
              label: orNull(sel.label),
              summary: orNull(sel.summary),
              email: orNull(sel.email),
              phone: orNull(sel.phone),
              city: orNull(sel.city),
              region: orNull(sel.region),
              entryIds,
            };
            const next = await api<SelectionView & { care: Care | null }>('/api/me/cv/selection', {
              method: 'PUT',
              json: body,
            });
            const { care: nextCare, ...saved } = next;
            onView(saved);
            setSel(saved.selection);
            setCare(nextCare);
            say(t.what.saved);
          } catch (e) {
            fail(e);
          } finally {
            setBusy(false);
          }
        }}
      />
      {care ? <CareNote care={care} onSeen={() => setCare(null)} /> : null}
      {view.missing.length > 0 ? (
        <Notice tone="info">
          {[t.what.missingTitle, ...view.missing.map((m) => t.what.missing[m])].join('\n')}
        </Notice>
      ) : null}
    </Card>
  );
}

/** One group of ticks: its name, where it comes from, any hint, or "nothing to tick". */
function Group(props: { title: string; from: string; hint?: string; children: ReactNode }) {
  const empty = Array.isArray(props.children) ? props.children.length === 0 : !props.children;
  return (
    <View style={styles.group}>
      <SectionTitle>{props.title}</SectionTitle>
      <Body pair="cardMuted" small>
        {props.from}
      </Body>
      {props.hint ? (
        <Body pair="card" small>
          {props.hint}
        </Body>
      ) : null}
      {empty ? (
        <Body pair="cardMuted" small>
          {t.what.nothing}
        </Body>
      ) : (
        props.children
      )}
    </View>
  );
}

/** When a save needs care (§7.5): the crisis card for a crisis or concern, a kind line otherwise. */
function CareNote({ care, onSeen }: { care: Care; onSeen: () => void }) {
  if (care.level === 'setback') return <Body pair="cardMuted">{en.planMaps.care.setback}</Body>;
  return (
    <View style={styles.group}>
      <Notice tone="info">
        {care.level === 'crisis' ? en.planMaps.care.crisisLead : en.planMaps.care.concernLead}
      </Notice>
      <CrisisCard artifact={care.card} />
      <Button label={en.planMaps.care.seen} variant="secondary" onPress={onSeen} />
    </View>
  );
}

function EntriesCard({
  entries,
  say,
  fail,
  error,
  onAdded,
  onRemoved,
}: {
  entries: ReadonlyArray<Entry>;
  say: (text: string) => void;
  fail: (e: unknown) => void;
  error: string | null;
  onAdded: (entry: Entry) => void;
  onRemoved: (id: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [asking, setAsking] = useState<string | null>(null);
  const [care, setCare] = useState<Care | null>(null);
  const [kind, setKind] = useState<Entry['kind']>('project');
  const [title, setTitle] = useState('');
  const [organisation, setOrganisation] = useState('');
  const [role, setRole] = useState('');
  const [description, setDescription] = useState('');
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  // Where the screen reader goes when the button pressed goes away (A2-45).
  const focusLater = useFocusLater();
  const addRef = useRef<View>(null);
  const kindRef = useRef<View>(null);
  const yesRef = useRef<View>(null);
  const removeRefs = useRef(new Map<string, View>());

  async function add() {
    setBusy(true);
    try {
      const { entry, care: nextCare } = await api<{ entry: Entry; care: Care | null }>(
        '/api/me/cv/entries',
        {
          method: 'POST',
          json: {
            kind,
            title: title.trim(),
            organisation: orNull(organisation),
            role: orNull(role),
            startDate: null,
            endDate: null,
            description: orNull(description),
            highlights: [],
            keywords: [],
            evidence: url.trim() ? [{ kind: 'other', url: url.trim(), label: null }] : [],
            linkedModules: [],
          },
        },
      );
      onAdded(entry);
      setCare(nextCare);
      setAdding(false);
      setTitle('');
      setOrganisation('');
      setRole('');
      setDescription('');
      setUrl('');
      say(t.entries.added(entry.title));
      // The new entry, unless the crisis card needs reading first.
      if (!nextCare || nextCare.level === 'setback') {
        focusLater(() => removeRefs.current.get(entry.id));
      }
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card testID="cv-entries">
      <Heading>{t.entries.title}</Heading>
      <Body pair="cardMuted">{t.entries.lead}</Body>
      {entries.length === 0 ? <Body pair="cardMuted">{t.entries.empty}</Body> : null}
      {entries.map((entry) => (
        <View key={entry.id} style={styles.row}>
          <Body pair="card" strong>
            {entry.title}
          </Body>
          <Body pair="cardMuted" small>
            {t.entries.kinds[entry.kind]}
            {entry.organisation ? ` · ${entry.organisation}` : ''}
          </Body>
          {asking === entry.id ? (
            <>
              <Body pair="card">{t.entries.removeAsk(entry.title)}</Body>
              <Button
                ref={yesRef}
                label={t.entries.removeYes}
                variant="danger"
                onPress={async () => {
                  try {
                    await api(`/api/me/cv/entries/${entry.id}`, { method: 'DELETE' });
                    setAsking(null);
                    onRemoved(entry.id);
                    say(t.entries.removed(entry.title));
                    focusLater(() => addRef.current);
                  } catch (e) {
                    fail(e);
                  }
                }}
              />
              <Button
                label={t.entries.keep}
                variant="secondary"
                onPress={() => {
                  setAsking(null);
                  focusLater(() => removeRefs.current.get(entry.id));
                }}
              />
            </>
          ) : (
            <Button
              ref={(node: View | null) => {
                if (node) removeRefs.current.set(entry.id, node);
                else removeRefs.current.delete(entry.id);
              }}
              label={t.entries.remove(entry.title)}
              variant="quiet"
              onPress={() => {
                setAsking(entry.id);
                focusLater(() => yesRef.current);
              }}
            />
          )}
        </View>
      ))}
      {adding ? null : <CardError error={error} />}
      {care ? <CareNote care={care} onSeen={() => setCare(null)} /> : null}
      {adding ? (
        <View style={styles.group}>
          <RadioGroup ref={kindRef} label={t.entries.kind} pair="card">
            {(Object.keys(t.entries.kinds) as Array<Entry['kind']>).map((k) => (
              <Radio
                key={k}
                label={t.entries.kinds[k]}
                selected={kind === k}
                onPress={() => setKind(k)}
              />
            ))}
          </RadioGroup>
          <Field label={t.entries.name} value={title} onChangeText={setTitle} />
          <Field
            label={t.entries.organisation}
            value={organisation}
            onChangeText={setOrganisation}
          />
          <Field label={t.entries.role} value={role} onChangeText={setRole} />
          <Field
            label={t.entries.description}
            value={description}
            onChangeText={setDescription}
            multiline
          />
          <Field
            label={t.entries.evidenceUrl}
            value={url}
            onChangeText={setUrl}
            keyboardType="url"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <CardError error={error} />
          <Button
            label={t.entries.save}
            busy={busy}
            busyLabel={en.common.saving}
            disabled={title.trim() === ''}
            onPress={() => void add()}
          />
          <Button
            label={t.entries.cancel}
            variant="secondary"
            onPress={() => {
              setAdding(false);
              focusLater(() => addRef.current);
            }}
          />
        </View>
      ) : (
        <Button
          ref={addRef}
          label={t.entries.add}
          variant="secondary"
          onPress={() => {
            setAdding(true);
            focusLater(() => kindRef.current);
          }}
        />
      )}
    </Card>
  );
}

function DocumentsCard({
  docs,
  shares,
  sharing,
  reported,
  download,
  say,
  fail,
  error,
  failList,
  listError,
  onDoc,
  onShares,
  onReported,
  onRemoved,
}: {
  docs: ReadonlyArray<Doc>;
  shares: ReadonlyArray<Share>;
  sharing: boolean;
  /** The ids of the CVs the learner reported (A10-58). */
  reported: ReadonlyArray<string>;
  download: (id: string) => Promise<void>;
  say: (text: string) => void;
  fail: (e: unknown) => void;
  error: string | null;
  /** A delete refused shows in the list (A11-38, A2-43). */
  failList: (e: unknown) => void;
  listError: string | null;
  onDoc: (doc: Doc) => void;
  onShares: (shares: ReadonlyArray<Share>) => void;
  onReported: (id: string) => void;
  /** A CV deleted (A11-38): gone from the list. */
  onRemoved: (id: string) => void;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const [asking, setAsking] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const shown = docs.find((d) => d.id === open && d.status === 'ready') ?? null;
  // The preview opens below the list: the screen reader goes to its title, and back to its Open
  // button when it closes; a pressed button that goes hands over to what replaces it (A2-45).
  const focusLater = useFocusLater();
  const titleRef = useRef<Text>(null);
  const confirmedRef = useRef<Text>(null);
  const openRefs = useRef(new Map<string, View>());
  // Deleting (A11-38): the question replaces Delete; Keep it brings Delete back; once deleted,
  // the list's title, since the row went with its buttons.
  const listTitleRef = useRef<Text>(null);
  const askRef = useRef<Text>(null);
  const removeRefs = useRef(new Map<string, View>());

  async function remove(d: Doc) {
    if (busy) return;
    setBusy(true);
    try {
      await api(`/api/me/cv/documents/${d.id}`, { method: 'DELETE' });
      setAsking(null);
      if (open === d.id) setOpen(null);
      onRemoved(d.id);
      say(t.remove.done(docName(d)));
      focusLater(() => listTitleRef.current);
    } catch (e) {
      failList(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Card testID="cv-list">
        <Heading ref={listTitleRef}>{t.list.title}</Heading>
        {docs.length === 0 ? <Body pair="cardMuted">{t.list.empty}</Body> : null}
        {docs.map((d) => (
          <View key={d.id} style={styles.row}>
            <Body pair="card" strong>
              {docName(d)}
            </Body>
            <Body pair="cardMuted" small>
              {t.list.made(formatDate(d.createdAt))}
            </Body>
            <Body pair="card">{t.status[d.status]}</Body>
            {d.status === 'ready' ? (
              <Button
                ref={(node: View | null) => {
                  if (node) openRefs.current.set(d.id, node);
                  else openRefs.current.delete(d.id);
                }}
                label={t.list.open}
                accessibilityLabel={t.list.openName(docName(d), formatDate(d.createdAt))}
                variant="secondary"
                onPress={() => {
                  setOpen(d.id);
                  focusLater(() => titleRef.current);
                }}
              />
            ) : null}
            {pending(d) ? null : asking === d.id ? (
              <>
                <Body ref={askRef} pair="card">
                  {t.remove.ask(docName(d))}
                </Body>
                <Button
                  label={t.remove.yes}
                  variant="danger"
                  busy={busy}
                  busyLabel={en.common.saving}
                  onPress={() => void remove(d)}
                />
                <Button
                  label={t.remove.keep}
                  variant="secondary"
                  onPress={() => {
                    setAsking(null);
                    focusLater(() => removeRefs.current.get(d.id));
                  }}
                />
              </>
            ) : (
              <Button
                ref={(node: View | null) => {
                  if (node) removeRefs.current.set(d.id, node);
                  else removeRefs.current.delete(d.id);
                }}
                label={t.remove.button}
                accessibilityLabel={t.remove.name(docName(d), formatDate(d.createdAt))}
                variant="quiet"
                onPress={() => {
                  setAsking(d.id);
                  focusLater(() => askRef.current);
                }}
              />
            )}
          </View>
        ))}
        <CardError error={listError} />
      </Card>
      {shown ? (
        <Card testID="cv-preview">
          <Heading ref={titleRef}>{t.preview.title(docName(shown))}</Heading>
          {/* An AI wrote a fitted CV: it is the learner's draft to check (A10-57). */}
          {shown.kind === 'tailored' ? (
            <Body pair="cardMuted">{t.preview.tailoredNote}</Body>
          ) : null}
          {/* The CV's text as headers, bullet lines and paragraphs, never its marks (A2-47). */}
          <CvTextView markdown={shown.markdown} />
          {/* An AI wrote it: the learner can report it for a person to look at (A10-58, §11). */}
          {shown.kind === 'tailored' ? (
            <ReportCv
              documentId={shown.id}
              reported={reported.includes(shown.id)}
              onReported={onReported}
            />
          ) : null}
          {shown.hasPdf ? (
            <>
              <Button
                label={t.preview.download}
                hint={t.preview.downloadHint}
                onPress={() => void download(shown.id)}
              />
              <Body pair="cardMuted" small>
                {t.preview.downloadHint}
              </Body>
            </>
          ) : null}
          {shown.gaps.length > 0 ? (
            <>
              <SectionTitle>{t.preview.gaps}</SectionTitle>
              {shown.gaps.map((gap) => (
                <Body key={gap} pair="card">{`• ${gap}`}</Body>
              ))}
            </>
          ) : null}
          {shown.kind === 'tailored' && shown.atsCoverage !== null ? (
            <>
              <SectionTitle>{t.tailor.score}</SectionTitle>
              <Body pair="card" strong>
                {t.tailor.scoreValue(shown.atsCoverage)}
              </Body>
              {shown.atsMissingMust.length > 0 ? (
                <Body pair="card">{`${t.tailor.missingMust}: ${shown.atsMissingMust.join(', ')}`}</Body>
              ) : null}
              <Body pair="card">
                {shown.atsMissing.length > 0
                  ? `${t.tailor.missing}: ${shown.atsMissing.join(', ')}`
                  : t.tailor.noneMissing}
              </Body>
            </>
          ) : null}
          <SectionTitle>{t.preview.check}</SectionTitle>
          {shown.confirmedAt ? (
            <Body ref={confirmedRef} pair="card">
              {t.preview.confirmed(formatDate(shown.confirmedAt))}
            </Body>
          ) : (
            <>
              <Body pair="cardMuted">{t.preview.checkLead}</Body>
              <Button
                label={t.preview.confirm}
                variant="secondary"
                onPress={async () => {
                  try {
                    const { document } = await api<{ document: Doc }>(
                      `/api/me/cv/documents/${shown.id}/confirm`,
                      { method: 'POST' },
                    );
                    onDoc(document);
                    say(t.preview.confirmed(formatDate(document.confirmedAt ?? '')));
                    focusLater(() => confirmedRef.current);
                  } catch (e) {
                    fail(e);
                  }
                }}
              />
            </>
          )}
          {sharing ? (
            <Sharing doc={shown} shares={shares} say={say} fail={fail} onShares={onShares} />
          ) : null}
          <CardError error={error} />
          <Button
            label={t.preview.close}
            variant="secondary"
            onPress={() => {
              setOpen(null);
              focusLater(() => openRefs.current.get(shown.id));
            }}
          />
        </Card>
      ) : null}
    </>
  );
}

/** Inline runs of a CV line: bold, italic and safe https links (`cvTextBlocks`, packages/ui). */
function CvRuns({ runs }: { runs: ReadonlyArray<CvInline> }) {
  return (
    <>
      {runs.map((run, i) => {
        // The runs never reorder: their place is their key.
        const key = `${run.kind}-${i}`;
        if (run.kind === 'text') return run.text;
        if (run.kind === 'strong') {
          return (
            <Text key={key} style={theme.text.bodyStrong}>
              <CvRuns runs={run.children} />
            </Text>
          );
        }
        if (run.kind === 'em') {
          return (
            <Text key={key} style={styles.em}>
              <CvRuns runs={run.children} />
            </Text>
          );
        }
        return (
          <Text
            key={key}
            accessibilityRole="link"
            style={styles.link}
            onPress={() => void Linking.openURL(run.url).catch(() => undefined)}
          >
            <CvRuns runs={run.children} />
          </Text>
        );
      })}
    </>
  );
}

/**
 * The CV's text in the preview as structure (audit CV-A2, A2-47): its name, sections and entries
 * as headers TalkBack and VoiceOver can move by, its bullets as bullet lines (the dot itself
 * hidden from them), the rest as paragraphs. Never the Markdown marks; nothing but text.
 */
function CvTextView({ markdown }: { markdown: string | null }) {
  return (
    <View style={[styles.cvText, styles.group]}>
      {cvTextBlocks(markdown).map((block, i) => {
        const key = `${block.kind}-${i}`;
        if (block.kind === 'heading') {
          return (
            <Text
              key={key}
              accessibilityRole="header"
              accessibilityLabel={cvInlineText(block.content)}
              style={[block.level === 1 ? theme.text.heading : theme.text.bodyStrong, styles.ink]}
            >
              <CvRuns runs={block.content} />
            </Text>
          );
        }
        if (block.kind === 'list') {
          return (
            <View key={key} style={styles.group}>
              {block.items.map((item, j) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: the CV's lines never reorder.
                <View key={j} style={styles.bullet}>
                  <Text
                    accessibilityElementsHidden
                    importantForAccessibility="no"
                    style={[theme.text.body, styles.ink]}
                  >
                    •
                  </Text>
                  <Text selectable style={[theme.text.body, styles.ink, styles.bulletText]}>
                    <CvRuns runs={item} />
                  </Text>
                </View>
              ))}
            </View>
          );
        }
        return (
          <Text key={key} selectable style={[theme.text.body, styles.ink]}>
            {block.lines.map((line, j) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: the CV's lines never reorder.
              <Fragment key={j}>
                {j > 0 ? '\n' : null}
                <CvRuns runs={line} />
              </Fragment>
            ))}
          </Text>
        );
      })}
    </View>
  );
}

/**
 * "Report this CV" under a fitted CV (A10-58; design §11), as "Report this reply" in the chat
 * (components/report-reply.tsx): a quiet button that opens the reasons in place, a reason from
 * the fixed list and never free text (hard rule 4). The screen reader goes to the question when it
 * opens and back to the button on Cancel (A2-45); the thank-you is announced (A3-02);
 * "harmful or upsetting" adds Get help, which opens the web's help page.
 */
function ReportCv({
  documentId,
  reported,
  onReported,
}: {
  documentId: string;
  reported: boolean;
  onReported: (id: string) => void;
}) {
  const r = t.report;
  const [state, setState] = useState<'closed' | 'open' | 'sent'>('closed');
  const [reason, setReason] = useState<CvReportReason | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const focusLater = useFocusLater();
  const openRef = useRef<View>(null);
  const questionRef = useRef<View>(null);

  if (reported && state !== 'sent') {
    return (
      <Body small pair="cardMuted">
        {r.reported}
      </Body>
    );
  }

  async function send() {
    if (!reason || busy) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/api/me/cv/documents/${documentId}/report`, {
        method: 'POST',
        json: { reason },
      });
      setState('sent');
      onReported(documentId);
      announce(r.sent);
    } catch {
      setError(r.error);
    } finally {
      setBusy(false);
    }
  }

  if (state === 'sent') {
    return (
      <View style={styles.group}>
        <Body small pair="card">
          {r.sent}
        </Body>
        {reason === 'harmful' ? (
          <>
            <Body small pair="cardMuted">
              {r.helpLead}
            </Body>
            <SourceLink url={`${apiUrl()}/help`} pair="cardBrand">
              {r.help}
            </SourceLink>
          </>
        ) : null}
      </View>
    );
  }

  if (state === 'closed') {
    return (
      <View style={styles.start}>
        <Button
          ref={openRef}
          label={r.open}
          variant="quiet"
          expanded={false}
          onPress={() => {
            setState('open');
            focusLater(() => questionRef.current);
          }}
        />
      </View>
    );
  }

  return (
    <View style={[styles.group, styles.reportBox]}>
      <RadioGroup ref={questionRef} label={r.question} pair="card">
        {CV_REPORT_REASONS.map((reasonId) => (
          <Radio
            key={reasonId}
            label={r.reasons[reasonId]}
            selected={reason === reasonId}
            onPress={() => setReason(reasonId)}
          />
        ))}
      </RadioGroup>
      {error ? <Notice tone="danger">{error}</Notice> : null}
      <Button
        label={r.send}
        busy={busy}
        busyLabel={en.common.saving}
        disabled={!reason}
        onPress={() => void send()}
      />
      <Button
        label={r.cancel}
        variant="secondary"
        disabled={busy}
        onPress={() => {
          setState('closed');
          setError(null);
          focusLater(() => openRef.current);
        }}
      />
    </View>
  );
}

function Sharing({
  doc,
  shares,
  say,
  fail,
  onShares,
}: {
  doc: Doc;
  shares: ReadonlyArray<Share>;
  say: (text: string) => void;
  fail: (e: unknown) => void;
  onShares: (shares: ReadonlyArray<Share>) => void;
}) {
  const [days, setDays] = useState<number>(30);
  const [made, setMade] = useState<string | null>(null);
  const focusLater = useFocusLater();
  const titleRef = useRef<Text>(null);
  const now = Date.now();
  const live = shares.filter(
    (s) => s.documentId === doc.id && !s.revokedAt && Date.parse(s.expiresAt) > now,
  );
  return (
    <View style={styles.group}>
      <SectionTitle ref={titleRef}>{t.sharing.title}</SectionTitle>
      <Body pair="cardMuted">{t.sharing.lead}</Body>
      {doc.confirmedAt ? (
        <>
          <RadioGroup label={t.sharing.days} pair="card">
            {SHARE_DAYS.map((n) => (
              <Radio
                key={n}
                label={t.sharing.daysOption(n)}
                selected={days === n}
                onPress={() => setDays(n)}
              />
            ))}
          </RadioGroup>
          <Button
            label={t.sharing.create}
            onPress={async () => {
              try {
                const { share, url } = await api<{ share: Share; url: string }>(
                  '/api/me/cv/shares',
                  { method: 'POST', json: { documentId: doc.id, days } },
                );
                onShares([share, ...shares]);
                setMade(url);
                say(t.sharing.made);
              } catch (e) {
                fail(e);
              }
            }}
          />
        </>
      ) : (
        <Body pair="card">{t.errors['cv-share-unchecked']}</Body>
      )}
      {made ? (
        <>
          <Body pair="card" strong>
            {t.sharing.link}
          </Body>
          {/* Selectable: hold it to copy (no clipboard module in this build). */}
          <Text selectable style={[theme.text.body, styles.cvText]}>
            {made}
          </Text>
          <Body pair="cardMuted" small>
            {t.sharing.linkOnce}
          </Body>
        </>
      ) : null}
      {live.map((s) => (
        <View key={s.id} style={styles.row}>
          <Body pair="card">{t.sharing.active(formatDate(s.expiresAt), s.viewCount)}</Body>
          <Button
            label={t.sharing.off}
            accessibilityLabel={t.sharing.offName(formatDate(s.expiresAt))}
            variant="secondary"
            onPress={async () => {
              try {
                await api('/api/me/cv/shares', { method: 'DELETE', json: { id: s.id } });
                onShares(shares.filter((x) => x.id !== s.id));
                say(t.sharing.switchedOff);
                // Its button goes with it (A2-45).
                focusLater(() => titleRef.current);
              } catch (e) {
                fail(e);
              }
            }}
          />
        </View>
      ))}
    </View>
  );
}

function TailorCard({
  disabled,
  say,
  fail,
  error,
  onQueued,
}: {
  disabled: boolean;
  say: (text: string) => void;
  fail: (e: unknown) => void;
  error: string | null;
  onQueued: (doc: Doc) => void;
}) {
  const [title, setTitle] = useState('');
  const [company, setCompany] = useState('');
  const [text, setText] = useState('');
  const held = useHeldCare();
  // Changed words are read again: the next press is a first press.
  const edit = (set: (value: string) => void) => (value: string) => {
    set(value);
    held.reset();
  };
  return (
    <Card testID="cv-tailor">
      <Heading>{t.tailor.title}</Heading>
      <Body pair="cardMuted">{t.tailor.lead}</Body>
      {/* Before the advert goes: a fitted CV is written by the AI abroad (A11-37). */}
      <Body pair="card">{t.tailor.aiNote}</Body>
      <HeldCare held={held} />
      <Field label={t.tailor.jobTitle} value={title} onChangeText={edit(setTitle)} />
      <Field label={t.tailor.company} value={company} onChangeText={edit(setCompany)} />
      <Field label={t.tailor.advert} value={text} onChangeText={edit(setText)} multiline />
      <CardError error={error} />
      <Button
        label={t.tailor.button}
        disabled={disabled || title.trim() === '' || text.trim() === ''}
        onPress={async () => {
          try {
            const answer = await api<Sent>('/api/me/cv/tailorings', {
              method: 'POST',
              json: {
                advert: { title: title.trim(), company: orNull(company), text },
                ...(held.held ? { sendAnyway: true } : {}),
              },
            });
            if (held.answered(answer)) {
              onQueued(answer.document);
              setText('');
              say(t.tailor.started);
            }
          } catch (e) {
            fail(e);
          }
        }}
      />
    </Card>
  );
}

function MakeCard({
  disabled,
  waiting,
  say,
  fail,
  error,
  onQueued,
}: {
  disabled: boolean;
  waiting: boolean;
  say: (text: string) => void;
  fail: (e: unknown) => void;
  error: string | null;
  onQueued: (doc: Doc) => void;
}) {
  const held = useHeldCare();
  return (
    <Card testID="cv-make">
      <Heading>{t.make.title}</Heading>
      <Body pair="cardMuted">{waiting ? t.make.waiting : t.make.lead}</Body>
      <HeldCare held={held} />
      <Button
        label={t.make.button}
        disabled={disabled}
        onPress={async () => {
          try {
            const answer = await api<Sent>('/api/me/cv/drafts', {
              method: 'POST',
              ...(held.held ? { json: { sendAnyway: true } } : {}),
            });
            if (held.answered(answer)) {
              onQueued(answer.document);
              say(t.make.started);
            }
          } catch (e) {
            fail(e);
          }
        }}
      />
      <CardError error={error} />
    </Card>
  );
}

/** What "Make my CV" and "Fit it to a job" answer: the CV queued, or held with the crisis card. */
type Sent =
  | { readonly document: Doc; readonly care: Care | null }
  | { readonly document: null; readonly care: Care };

/**
 * The crisis card when what would be sent holds words that worry us (A10-55, A10-56): nothing was
 * sent, and the next press of the same button sends it (`sendAnyway`). A concern goes ahead with
 * the card beside it.
 */
function useHeldCare() {
  const [care, setCare] = useState<Care | null>(null);
  const [held, setHeld] = useState(false);
  return {
    care,
    held,
    seen: () => setCare(null),
    reset: () => setHeld(false),
    /** True when the CV was queued. */
    answered(answer: Sent): answer is Sent & { document: Doc } {
      setCare(answer.care && answer.care.level !== 'setback' ? answer.care : null);
      setHeld(answer.document === null);
      return answer.document !== null;
    },
  };
}

function HeldCare({ held }: { held: ReturnType<typeof useHeldCare> }) {
  if (!held.care && !held.held) return null;
  return (
    <View style={styles.group}>
      {held.care ? <CareNote care={held.care} onSeen={held.seen} /> : null}
      {held.held ? (
        <Body pair="card" strong>
          {t.make.held}
        </Body>
      ) : null}
    </View>
  );
}

function WithdrawCard({
  docs,
  download,
  fail,
  error,
  onWithdrawn,
}: {
  docs: ReadonlyArray<Doc>;
  download: (id: string) => Promise<void>;
  fail: (e: unknown) => void;
  error: string | null;
  onWithdrawn: () => void;
}) {
  const [asking, setAsking] = useState(false);
  const ready = docs.filter((d) => d.status === 'ready' && d.hasPdf);
  // The question replaces the button pressed, and Keep using it brings the button back (A2-45).
  const focusLater = useFocusLater();
  const bodyRef = useRef<Text>(null);
  const startRef = useRef<View>(null);
  return (
    <Card testID="cv-withdraw">
      <Heading pair="cardDanger">{t.withdraw.title}</Heading>
      {asking ? (
        <>
          <Body ref={bodyRef} pair="card">
            {t.withdraw.body}
          </Body>
          {ready.length > 0 ? <SectionTitle>{t.withdraw.downloadFirst}</SectionTitle> : null}
          {ready.map((d) => (
            <Button
              key={d.id}
              label={t.preview.download}
              accessibilityLabel={`${t.preview.download}: ${docName(d)}, ${formatDate(d.createdAt)}`}
              variant="secondary"
              onPress={() => void download(d.id)}
            />
          ))}
          <CardError error={error} />
          <Button
            label={t.withdraw.confirm}
            variant="danger"
            onPress={async () => {
              try {
                await api('/api/me/cv/opt-in', { method: 'DELETE' });
                onWithdrawn();
              } catch (e) {
                fail(e);
              }
            }}
          />
          <Button
            label={t.withdraw.keep}
            variant="secondary"
            onPress={() => {
              setAsking(false);
              focusLater(() => startRef.current);
            }}
          />
        </>
      ) : (
        <Button
          ref={startRef}
          label={t.withdraw.start}
          variant="secondary"
          onPress={() => {
            setAsking(true);
            focusLater(() => bodyRef.current);
          }}
        />
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  group: { gap: theme.space['2'] },
  row: {
    gap: theme.space['1'],
    paddingVertical: theme.space['2'],
    borderTopWidth: theme.border.thin,
    borderTopColor: theme.color.line,
  },
  cvText: {
    color: theme.color.ink,
    // A panel in its card: the sunk fill and the card edge (RT-04).
    ...theme.panel,
    padding: theme.space['3'],
    borderRadius: theme.radius.sm,
  },
  // The CV's text as structure (A2-47).
  ink: { color: theme.color.ink },
  em: { fontStyle: 'italic' },
  link: { textDecorationLine: 'underline' },
  bullet: { flexDirection: 'row', gap: theme.space['2'] },
  bulletText: { flex: 1 },
  // Report this CV (A10-58), as the chat's report.
  start: { alignItems: 'flex-start' },
  reportBox: {
    padding: theme.space['3'],
    borderRadius: theme.radius.md,
    borderWidth: theme.border.thin,
    borderColor: theme.color.line,
  },
});
