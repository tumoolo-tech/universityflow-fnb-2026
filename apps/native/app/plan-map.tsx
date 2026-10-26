import { en } from '@universityflow/content/app';
import { tokens } from '@universityflow/tokens';
import {
  type OutlineNode,
  outlineOf,
  PLAN_LIMITS,
  PLAN_LINKS,
  PLAN_STATUSES,
  type PlanMapView,
  type PlanMoveKind,
  type PlanNode,
  type PlanStatus,
  planMove,
  planTemplate,
  slotKey,
  slotLink,
  slotWords,
  subtreeIds,
} from '@universityflow/ui';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import {
  Bullet,
  CardButton,
  Care,
  StatusChip,
  StopBadge,
  StopIcon,
  type WrittenCare,
} from '../components/plan-maps';
import {
  Body,
  Button,
  Card,
  Field,
  Heading,
  Notice,
  PageHeader,
  Radio,
  RadioGroup,
  Screen,
  useAnnounce,
} from '../components/ui';
import { api, errorMessage } from '../lib/api';
import { useReduceMotion } from '../lib/motion';
import { nativeRoute } from '../lib/routes';
import { theme, toPx } from '../lib/theme';
import type { Me } from '../lib/types';

/**
 * One plan map in the app (docs/design/plan-maps-proposal.md §8.5, D6): the outline only, in the
 * spirit of the canvas's cards (the owner's reference pictures, 2026-10-25). At the top, the hub:
 * the middle's heading, the learner's About me words (read live, never kept in the map), their
 * goal when linked, and "N of M achieved" as a progress bar. Then each stop as a sticker card in
 * its tone: a band and a 2px edge in the tone, a number badge, an icon, the learner's words as
 * bullets, a status chip that is always a word, Edit in place, More to move it or delete it after
 * asking on the screen. The staircase climbs by a step of indent; the road is a dashed line with
 * a marker at each milestone. No dragging: the outline is the phone's view (D6); the Picture view
 * waits for the planned build.
 *
 * RT-06: the map's own name is the title, the template a small label under it; the learner
 * renames it here while words are allowed (D2). Every saved word, the name included, is read by
 * the crisis check on the server (D3): when it needs care, the crisis card appears at once under
 * the part and its lead is announced.
 *
 * Motion (M1, hard rule 9): the stops rise in once when the map opens, in reading order, unless
 * the phone asks for less motion, when they are simply there.
 */

const t = en.planMaps;
const ta = en.planMapsApp;

const MOVES: ReadonlyArray<readonly [PlanMoveKind, string]> = [
  ['up', t.moveUp],
  ['down', t.moveDown],
  ['out', t.moveOut],
  ['in', t.moveIn],
];

const ms = (value: string) => Number.parseInt(value, 10);
/** The rise's start, from the tokens: a stop's small lift (`motion.riseSmall`). */
const RISE = toPx(tokens.motion.riseSmall);

/** "Nov 2028", from `2028-11`. */
function monthName(month: string): string {
  return new Date(`${month}-15T12:00:00Z`).toLocaleDateString('en-ZA', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

type ToneKey = `mapTone${1 | 2 | 3 | 4 | 5 | 6}`;
/** Stop n takes tone ((n − 1) mod 6) + 1, as the web's cards (tokens `mapTones`). */
function toneOf(index: number): { accent: string; soft: string } {
  const n = ((index % 6) + 1) as 1 | 2 | 3 | 4 | 5 | 6;
  return {
    accent: theme.color[`mapTone${n}` as ToneKey],
    soft: theme.color[`mapTone${n}Soft` as `${ToneKey}Soft`],
  };
}

export default function PlanMapScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const reduce = useReduceMotion();
  const [map, setMap] = useState<PlanMapView | null>(null);
  const [words, setWords] = useState<ReadonlyArray<string> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [menu, setMenu] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [care, setCare] = useState<{ at: string; care: WrittenCare } | null>(null);
  const rises = useRef<Animated.Value[]>([]);
  const entered = useRef(false);
  useAnnounce(status);
  useAnnounce(
    care && care.care.level !== 'setback'
      ? care.care.level === 'crisis'
        ? t.care.crisisLead
        : t.care.concernLead
      : null,
  );

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      setMap((await api<{ map: PlanMapView }>(`/api/me/plan-maps/${id}`)).map);
    } catch (e) {
      setError(errorMessage(e));
    }
    // The learner's About me words for the hub, read live: the map keeps none of them, and the
    // map works without them.
    try {
      setWords((await api<Me>('/api/me')).profile?.badgeIds ?? []);
    } catch {
      setWords([]);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const stops = map ? (outlineOf(map.nodes)?.children.length ?? 0) : 0;
  // The entrance, once, when the map first shows: each stop rises in turn (M1). Under Reduce
  // Motion the stops are simply there (their values rest at 1).
  useEffect(() => {
    if (!map || entered.current) return;
    entered.current = true;
    if (reduce) return;
    const values = rises.current.slice(0, stops);
    for (const v of values) v.setValue(0);
    Animated.stagger(
      ms(tokens.duration.fast),
      values.map((v) =>
        Animated.timing(v, {
          toValue: 1,
          duration: ms(tokens.duration.enter),
          useNativeDriver: true,
        }),
      ),
    ).start();
  }, [map, reduce, stops]);

  const header = <Stack.Screen options={{ title: t.title }} />;
  if (!map) {
    return (
      <Screen belowHeader>
        {header}
        <PageHeader title={t.title} />
        {error ? <Notice tone="danger">{error}</Notice> : <Body>{en.common.loading}</Body>}
      </Screen>
    );
  }

  const current = map;
  const tpl = planTemplate(current.templateId);
  const templateWords = t.templates[current.templateId];
  const outline = outlineOf(current.nodes);
  const slotOf = (n: PlanNode) => slotWords(current.templateId, n.slotId);
  const nameOf = (n: PlanNode) => slotOf(n)?.heading || n.text || t.newStep;
  const title = current.title ?? templateWords.name;
  while (rises.current.length < stops) rises.current.push(new Animated.Value(1));

  async function run<T>(call: () => Promise<T>): Promise<T | null> {
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      return await call();
    } catch (e) {
      setError(errorMessage(e));
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function rename() {
    const next = name.trim();
    // The learner's own name for their map (RT-06): never empty, here and on the server.
    if (next === '') {
      setNameError(ta.naming.needed);
      return;
    }
    setNameError(null);
    const result = await run(() =>
      api<{ map: PlanMapView; care: WrittenCare | null }>(`/api/me/plan-maps/${current.id}`, {
        method: 'PATCH',
        json: { title: next },
      }),
    );
    if (!result) return;
    setMap(result.map);
    setNaming(false);
    setStatus(ta.naming.renamed);
    setCare(result.care ? { at: 'title', care: result.care } : null);
  }

  async function save(node: PlanNode, patch: Record<string, unknown>) {
    const result = await run(() =>
      api<{ node: PlanNode; care: WrittenCare | null }>(
        `/api/me/plan-maps/${current.id}/nodes/${node.id}`,
        { method: 'PUT', json: patch },
      ),
    );
    if (!result) return;
    setMap({ ...current, nodes: current.nodes.map((n) => (n.id === node.id ? result.node : n)) });
    setEditing(null);
    setStatus(t.savedStatus(nameOf(result.node), t.status[result.node.status]));
    setCare(result.care ? { at: node.id, care: result.care } : null);
  }

  async function move(node: PlanNode, kind: PlanMoveKind) {
    const to = planMove(current.nodes, node.id, kind);
    if (to === null) return;
    if (typeof to === 'string') {
      setError(t.limits[to]);
      return;
    }
    const result = await run(() =>
      api<{ map: PlanMapView }>(`/api/me/plan-maps/${current.id}/nodes/${node.id}/move`, {
        method: 'POST',
        json: to,
      }),
    );
    if (!result) return;
    setMap(result.map);
    setMenu(null);
    setStatus(t.moved);
  }

  async function remove(node: PlanNode) {
    const done = await run(() =>
      api(`/api/me/plan-maps/${current.id}/nodes/${node.id}`, { method: 'DELETE' }),
    );
    if (done === null) return;
    const gone = new Set(subtreeIds(current.nodes, node.id));
    setMap({ ...current, nodes: current.nodes.filter((n) => !gone.has(n.id)) });
    setConfirming(null);
    setMenu(null);
    setStatus(t.deleted);
  }

  const total = outline?.children.length ?? 0;
  const achieved = outline?.children.filter((c) => c.node.status === 'achieved').length ?? 0;
  const progress = ta.hub.progress(achieved, total);
  const badges = en.profileLook.badges as Record<string, string | undefined>;
  const wordNames = (words ?? []).flatMap((w) => badges[w] ?? []);

  /** A stop's controls and open panels: Edit and More, the menu, the delete question, care. */
  const renderControls = (n: PlanNode, name: string, hint: string | null, steps: number) => (
    <>
      {editing === n.id ? (
        <Editor
          node={n}
          hint={hint}
          wordsAllowed={current.wordsAllowed}
          busy={busy}
          onSave={(patch) => void save(n, patch)}
          onCancel={() => setEditing(null)}
        />
      ) : (
        <View style={styles.buttons}>
          <CardButton
            label={t.edit}
            accessibilityLabel={t.editing(name)}
            onPress={() => {
              setEditing(n.id);
              setMenu(null);
            }}
          />
          <CardButton
            label={t.more}
            accessibilityLabel={t.moreFor(name)}
            expanded={menu === n.id}
            onPress={() => setMenu(menu === n.id ? null : n.id)}
          />
        </View>
      )}

      {menu === n.id && confirming !== n.id ? (
        <View style={styles.buttons}>
          {MOVES.map(([kind, label]) => (
            <CardButton
              key={kind}
              quiet
              label={label}
              disabled={busy || planMove(current.nodes, n.id, kind) === null}
              onPress={() => void move(n, kind)}
            />
          ))}
          <CardButton quiet label={t.delete} onPress={() => setConfirming(n.id)} />
        </View>
      ) : null}

      {confirming === n.id ? (
        <View style={styles.confirm}>
          <Body pair="sunk" strong>
            {t.deleteAsk(name, steps)}
          </Body>
          <View style={styles.buttons}>
            <Button variant="danger" label={t.delete} busy={busy} onPress={() => void remove(n)} />
            <CardButton
              label={t.keep}
              onPress={() => {
                setConfirming(null);
                setMenu(null);
              }}
            />
          </View>
        </View>
      ) : null}

      {care?.at === n.id ? (
        <Care care={care.care} onSeen={() => setCare(null)} go={(r) => router.push(r as never)} />
      ) : null}
    </>
  );

  /** A part's lines: its words (or the hint), its reflections, its target and its link. */
  const renderLines = (n: PlanNode, hint: string | null, accent: string) => {
    const link = slotLink(current.templateId, n.slotId);
    const route = link ? nativeRoute(PLAN_LINKS[link]) : null;
    return (
      <>
        {n.text ? <Bullet accent={accent}>{n.text}</Bullet> : null}
        {!n.text && hint ? (
          <Bullet accent={accent} muted>
            {hint}
          </Bullet>
        ) : null}
        {n.whyNot ? (
          <Bullet accent={accent}>
            {`${n.status === 'achieved' ? t.learnedLastTime : t.whyNotShown}: ${n.whyNot}`}
          </Bullet>
        ) : null}
        {n.differently ? (
          <Bullet accent={accent}>{`${t.differentlyShown}: ${n.differently}`}</Bullet>
        ) : null}
        {n.targetMonth ? (
          <Bullet accent={accent} muted>
            {t.targetShown(monthName(n.targetMonth))}
          </Bullet>
        ) : null}
        {link ? (
          route ? (
            <CardButton quiet label={t.links[link]} onPress={() => router.push(route as never)} />
          ) : (
            <Text style={[theme.text.small, { color: theme.color.inkMuted }]}>
              {`${t.links[link]}: ${en.chat.artifactOnWeb}`}
            </Text>
          )
        ) : null}
      </>
    );
  };

  /** A stop of the map: a sticker card in its tone, with its steps nested inside it. */
  const renderStop = (o: OutlineNode, index: number) => {
    const n = o.node;
    const slot = slotOf(n);
    const name = nameOf(n);
    const hint = slot?.hint ?? null;
    const { accent, soft } = toneOf(index);
    const steps = subtreeIds(current.nodes, n.id).length - 1;
    const rise = rises.current[index] ?? new Animated.Value(1);
    return (
      <Animated.View
        key={n.id}
        style={{
          opacity: rise,
          transform: [
            { translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [RISE, 0] }) },
          ],
        }}
      >
        <View
          testID={`plan-card-${n.id}`}
          style={[
            styles.card,
            { backgroundColor: soft, borderColor: accent },
            // The staircase climbs: each step a little further in, within the width.
            tpl.layout === 'stairs' ? { marginLeft: Math.min(index, 4) * theme.space['2'] } : null,
          ]}
        >
          {tpl.layout === 'road' ? (
            <View
              style={[styles.marker, { backgroundColor: accent }]}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            />
          ) : null}
          <View
            testID="plan-card-band"
            style={[styles.band, { backgroundColor: accent }]}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          />
          <View style={styles.head}>
            <StopBadge n={index + 1} accent={accent} />
            <StopIcon slotKey={slotKey(n.slotId)} accent={accent} />
            <Text
              accessibilityRole="header"
              accessibilityLabel={`${tpl.ordered ? `${t.stepOf(index + 1, total)}: ` : ''}${name}, ${t.status[n.status]}`}
              testID={`plan-node-${n.id}`}
              style={[theme.text.heading, styles.headText, { color: theme.color.ink }]}
            >
              {name}
            </Text>
          </View>
          {slot?.subtitle ? (
            <Text style={[theme.text.small, { color: theme.color.inkMuted }]}>{slot.subtitle}</Text>
          ) : null}
          <StatusChip status={n.status} />
          {renderLines(n, hint, accent)}
          {renderControls(n, name, hint, steps)}
          {o.children.length > 0 ? (
            <View style={styles.children}>
              {o.children.map((c) => renderStep(c, accent, slot?.childHint ?? null))}
            </View>
          ) : null}
        </View>
      </Animated.View>
    );
  };

  /** A step under a stop (and a step under that): a row inside the stop's card. */
  const renderStep = (o: OutlineNode, accent: string, parentHint: string | null) => {
    const n = o.node;
    const slot = slotOf(n);
    const name = nameOf(n);
    const hint = slot?.hint ?? parentHint;
    const steps = subtreeIds(current.nodes, n.id).length - 1;
    return (
      <View key={n.id} style={styles.step}>
        <Text
          accessibilityRole="header"
          accessibilityLabel={`${name}, ${t.status[n.status]}`}
          style={[theme.text.bodyStrong, { color: theme.color.ink }]}
        >
          {name}
        </Text>
        <StatusChip status={n.status} />
        {renderLines(n, hint, accent)}
        {renderControls(n, name, hint, steps)}
        {o.children.length > 0 ? (
          <View style={styles.children}>
            {o.children.map((c) => renderStep(c, accent, slot?.childHint ?? null))}
          </View>
        ) : null}
      </View>
    );
  };

  const centre = outline?.node;
  const centreWords = centre ? slotOf(centre) : null;

  return (
    <Screen belowHeader>
      {header}
      <PageHeader title={title} lead={t.onlyYou} />
      <Body pair="pageMuted" small>
        {ta.naming.layout(templateWords.name)}
      </Body>
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {status ? <Body strong>{status}</Body> : null}
      {current.wordsAllowed ? null : <Notice tone="info">{t.wordsWait}</Notice>}

      {current.wordsAllowed ? (
        naming ? (
          <Card testID="plan-map-naming">
            <Field
              label={ta.naming.label}
              hint={ta.naming.hint}
              value={name}
              onChangeText={(v) => {
                setName(v);
                if (nameError) setNameError(null);
              }}
              maxLength={PLAN_LIMITS.title}
              error={nameError}
              testID="plan-map-name"
            />
            <View style={styles.buttons}>
              <Button label={ta.naming.saveName} busy={busy} onPress={() => void rename()} />
              <Button label={t.cancel} variant="secondary" onPress={() => setNaming(false)} />
            </View>
          </Card>
        ) : current.title === null ? (
          <View style={styles.naming}>
            <Body pair="pageMuted">{ta.naming.unnamed}</Body>
            <Button
              label={ta.naming.nameThis}
              variant="secondary"
              onPress={() => {
                setName('');
                setNameError(null);
                setNaming(true);
              }}
            />
          </View>
        ) : (
          <Button
            label={ta.naming.rename}
            accessibilityLabel={ta.naming.renameFor(title)}
            variant="secondary"
            onPress={() => {
              setName(current.title ?? '');
              setNameError(null);
              setNaming(true);
            }}
          />
        )
      ) : null}
      {care?.at === 'title' ? (
        <Care care={care.care} onSeen={() => setCare(null)} go={(r) => router.push(r as never)} />
      ) : null}

      {centre ? (
        <Card testID="plan-hub">
          <Heading>{centreWords?.heading ?? t.goalCentre}</Heading>
          {centre.text ? <Body pair="card">{centre.text}</Body> : null}
          {!centre.text && centreWords?.hint ? (
            <Body pair="cardMuted" small>
              {centreWords.hint}
            </Body>
          ) : null}
          {wordNames.length > 0 ? (
            <View
              testID="plan-hub-words"
              accessible
              accessibilityLabel={`${ta.hub.words}: ${wordNames.join(', ')}`}
              style={styles.pills}
            >
              {wordNames.map((w) => (
                <View key={w} style={styles.pill}>
                  <Text style={[theme.text.caps, { color: theme.color.ink }]}>{w}</Text>
                </View>
              ))}
            </View>
          ) : null}
          {current.goal ? (
            <>
              <Body pair="card" strong>
                {t.goalCentre}
              </Body>
              <Body pair="card">
                {current.goal.kind === 'goal'
                  ? t.goalAt(current.goal.course, current.goal.university)
                  : current.goal.kind === 'none'
                    ? t.goalNone
                    : t.goalUnavailable}
              </Body>
              {current.goal.kind === 'goal' ? (
                <Button
                  variant="quiet"
                  label={t.goalLink}
                  onPress={() => router.push('/goals' as never)}
                />
              ) : null}
            </>
          ) : null}
          <Body pair="card" strong>
            {progress}
          </Body>
          <View
            accessible
            accessibilityRole="progressbar"
            accessibilityLabel={progress}
            accessibilityValue={{ min: 0, max: total, now: achieved }}
            style={styles.track}
          >
            <View
              testID="plan-progress-fill"
              style={[
                styles.fill,
                { width: `${total === 0 ? 0 : Math.round((achieved / total) * 100)}%` },
              ]}
            />
          </View>
        </Card>
      ) : null}

      <View style={[styles.outline, tpl.layout === 'road' ? styles.road : null]}>
        {outline?.children.map((c, i) => renderStop(c, i))}
      </View>
      <Body pair="pageMuted" small>
        {t.exportNote}
      </Body>
    </Screen>
  );
}

function Editor({
  node,
  hint,
  wordsAllowed,
  busy,
  onSave,
  onCancel,
}: {
  node: PlanNode;
  hint: string | null;
  wordsAllowed: boolean;
  busy: boolean;
  onSave: (patch: Record<string, unknown>) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState(node.text ?? '');
  const [status, setStatus] = useState<PlanStatus>(node.status);
  const [whyNot, setWhyNot] = useState(node.whyNot ?? '');
  const [differently, setDifferently] = useState(node.differently ?? '');
  const orNull = (v: string) => (v.trim() === '' ? null : v);
  return (
    <View style={styles.editor}>
      {wordsAllowed ? (
        <Field
          label={t.myWords}
          {...(hint ? { hint } : {})}
          value={text}
          onChangeText={setText}
          maxLength={PLAN_LIMITS.text}
          multiline
        />
      ) : null}
      <RadioGroup label={t.statusLegend} pair="card">
        {PLAN_STATUSES.map((s) => (
          <Radio key={s} label={t.status[s]} selected={status === s} onPress={() => setStatus(s)} />
        ))}
      </RadioGroup>
      {status === 'not-achieved' && wordsAllowed ? (
        <>
          <Field
            label={t.whyNot}
            value={whyNot}
            onChangeText={setWhyNot}
            maxLength={PLAN_LIMITS.reflection}
            multiline
          />
          <Field
            label={t.differently}
            value={differently}
            onChangeText={setDifferently}
            maxLength={PLAN_LIMITS.reflection}
            multiline
          />
        </>
      ) : null}
      <View style={styles.buttons}>
        <Button
          label={t.save}
          busy={busy}
          onPress={() =>
            onSave({
              status,
              ...(wordsAllowed
                ? { text: orNull(text), whyNot: orNull(whyNot), differently: orNull(differently) }
                : {}),
            })
          }
        />
        <CardButton label={t.cancel} onPress={onCancel} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  naming: { gap: theme.space['2'] },
  outline: { gap: theme.space['4'] },
  road: {
    borderLeftWidth: theme.border.rule,
    borderLeftColor: theme.color.lineStrong,
    borderStyle: 'dashed',
    paddingLeft: theme.space['4'],
  },
  // The sticker (the canvas spec §4.1): the tone's soft fill, a 2px edge in the tone, the big
  // radius; the band along the top is the staircase's tread and the pictures' coloured tab.
  card: {
    borderWidth: theme.border.thick,
    borderRadius: theme.radius.lg,
    padding: theme.space['4'],
    gap: theme.space['3'],
    overflow: 'hidden',
  },
  band: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: theme.border.rule,
  },
  head: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: theme.space['3'] },
  headText: { flexShrink: 1 },
  step: {
    gap: theme.space['2'],
    paddingTop: theme.space['2'],
  },
  children: {
    gap: theme.space['2'],
    paddingLeft: theme.space['3'],
    borderLeftWidth: theme.border.thin,
    borderLeftColor: theme.color.lineStrong,
  },
  marker: {
    position: 'absolute',
    left: -(theme.space['4'] + theme.border.rule / 2 + theme.space['2'] + theme.border.thick),
    top: theme.space['4'],
    width: theme.space['4'],
    height: theme.space['4'],
    borderRadius: theme.radius.full,
  },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.space['2'] },
  pill: {
    paddingHorizontal: theme.space['3'],
    paddingVertical: theme.space['1'],
    borderWidth: theme.border.thin,
    borderColor: theme.color.lineStrong,
    borderRadius: theme.radius.full,
  },
  track: {
    height: theme.space['2'],
    borderRadius: theme.radius.full,
    backgroundColor: theme.color.line,
    overflow: 'hidden',
  },
  fill: { height: '100%', backgroundColor: theme.color.success },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.space['2'] },
  confirm: {
    gap: theme.space['2'],
    padding: theme.space['3'],
    borderRadius: theme.radius.md,
    // The sunk fill inside the tone card, with the quiet edge held to 3:1 on every soft fill.
    backgroundColor: theme.color.surfaceSunk,
    borderWidth: theme.border.thin,
    borderColor: theme.color.lineStrong,
  },
  editor: { gap: theme.space['3'] },
});
