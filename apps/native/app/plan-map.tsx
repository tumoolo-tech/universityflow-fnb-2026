import { en } from '@universityflow/content/app';
import {
  type CrisisCardArtifact,
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
  slotLink,
  slotWords,
  subtreeIds,
} from '@universityflow/ui';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CrisisCard } from '../components/artifact-card';
import { StatusGlyph } from '../components/plan-maps';
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
import { nativeRoute } from '../lib/routes';
import { theme } from '../lib/theme';

/**
 * One plan map in the app (docs/design/plan-maps-proposal.md §8.5, D6): the outline only, drawn
 * with Views: each stop with its tone as a side rule, its status as a word and a glyph, Edit in
 * place, More to move it or delete it after asking on the screen. The staircase climbs by a step
 * of indent; the road is a dashed line with a marker at each milestone. The Picture view waits for
 * react-native-svg in the planned new build. Nothing animates (the app's rule), so there is no
 * motion to reduce.
 *
 * Every save is read by the chat's crisis check on the server (D3): when the words need care, the
 * crisis card appears at once under the part and its lead is announced.
 */

const t = en.planMaps;

type WrittenCare =
  | { readonly level: 'crisis' | 'concern'; readonly card: CrisisCardArtifact }
  | { readonly level: 'setback' };

const MOVES: ReadonlyArray<readonly [PlanMoveKind, string]> = [
  ['up', t.moveUp],
  ['down', t.moveDown],
  ['out', t.moveOut],
  ['in', t.moveIn],
];

/** "Nov 2028", from `2028-11`. */
function monthName(month: string): string {
  return new Date(`${month}-15T12:00:00Z`).toLocaleDateString('en-ZA', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export default function PlanMapScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [map, setMap] = useState<PlanMapView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [menu, setMenu] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [care, setCare] = useState<{ at: string; care: WrittenCare } | null>(null);
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
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

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
  const words = t.templates[current.templateId];
  const outline = outlineOf(current.nodes);
  const slotOf = (n: PlanNode) => slotWords(current.templateId, n.slotId);
  const nameOf = (n: PlanNode) => slotOf(n)?.heading || n.text || t.newStep;

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

  const renderNode = (o: OutlineNode, index: number) => {
    const n = o.node;
    const slot = slotOf(n);
    const name = nameOf(n);
    const parent = current.nodes.find((p) => p.id === n.parentId);
    const hint = slot?.hint ?? (parent ? (slotOf(parent)?.childHint ?? null) : null);
    const tone = theme.color[`mapTone${(index % 6) + 1}` as 'mapTone1'];
    const link = slotLink(current.templateId, n.slotId);
    const route = link ? nativeRoute(PLAN_LINKS[link]) : null;
    const steps = subtreeIds(current.nodes, n.id).length - 1;
    const top = n.depth === 1;
    return (
      <View
        key={n.id}
        style={[
          top ? styles.branch : styles.step,
          top ? { borderLeftColor: tone } : null,
          // The staircase climbs: each step a little further in, within the width.
          top && tpl.layout === 'stairs'
            ? { marginLeft: Math.min(index, 4) * theme.space['2'] }
            : null,
        ]}
      >
        {top && tpl.layout === 'road' ? (
          <View
            style={[styles.marker, { backgroundColor: tone }]}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          />
        ) : null}
        <Text
          accessibilityRole="header"
          accessibilityLabel={`${tpl.ordered && top ? `${t.stepOf(index + 1, total)}: ` : ''}${name}, ${t.status[n.status]}`}
          testID={top ? `plan-node-${n.id}` : undefined}
          style={[theme.text.bodyStrong, { color: theme.color.ink }]}
        >
          {top ? `${index + 1}  ` : ''}
          {name}
        </Text>
        <View
          style={styles.status}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <StatusGlyph status={n.status} />
          <Body pair="card">{t.status[n.status]}</Body>
        </View>
        {slot && n.text ? <Body pair="card">{n.text}</Body> : null}
        {!n.text && hint ? (
          <Body pair="cardMuted" small>
            {hint}
          </Body>
        ) : null}
        {n.whyNot ? (
          <Body pair="card" small>
            {`${n.status === 'achieved' ? t.learnedLastTime : t.whyNotShown}: ${n.whyNot}`}
          </Body>
        ) : null}
        {n.differently ? (
          <Body pair="card" small>{`${t.differentlyShown}: ${n.differently}`}</Body>
        ) : null}
        {n.targetMonth ? (
          <Body pair="cardMuted" small>
            {t.targetShown(monthName(n.targetMonth))}
          </Body>
        ) : null}
        {link ? (
          route ? (
            <Button
              variant="quiet"
              label={t.links[link]}
              onPress={() => router.push(route as never)}
            />
          ) : (
            <Body pair="cardMuted" small>
              {`${t.links[link]}: ${en.chat.artifactOnWeb}`}
            </Body>
          )
        ) : null}

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
            <Button
              variant="secondary"
              label={t.edit}
              accessibilityLabel={t.editing(name)}
              onPress={() => {
                setEditing(n.id);
                setMenu(null);
              }}
            />
            <Button
              variant="secondary"
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
              <Button
                key={kind}
                variant="quiet"
                label={label}
                disabled={busy || planMove(current.nodes, n.id, kind) === null}
                onPress={() => void move(n, kind)}
              />
            ))}
            <Button variant="quiet" label={t.delete} onPress={() => setConfirming(n.id)} />
          </View>
        ) : null}

        {confirming === n.id ? (
          <View style={styles.confirm}>
            <Body pair="sunk" strong>
              {t.deleteAsk(name, steps)}
            </Body>
            <View style={styles.buttons}>
              <Button
                variant="danger"
                label={t.delete}
                busy={busy}
                onPress={() => void remove(n)}
              />
              <Button
                variant="secondary"
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

        {o.children.length > 0 ? (
          <View style={styles.children}>{o.children.map((c, i) => renderNode(c, i))}</View>
        ) : null}
      </View>
    );
  };

  const centre = outline?.node;
  const centreWords = centre ? slotOf(centre) : null;

  return (
    <Screen belowHeader>
      {header}
      <PageHeader title={current.title ?? words.name} lead={t.onlyYou} />
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {status ? <Body strong>{status}</Body> : null}
      {current.wordsAllowed ? null : <Notice tone="info">{t.wordsWait}</Notice>}
      {centre ? (
        <Card>
          <Heading>{centreWords?.heading ?? t.goalCentre}</Heading>
          {centre.text ? <Body pair="card">{centre.text}</Body> : null}
          {!centre.text && centreWords?.hint ? (
            <Body pair="cardMuted" small>
              {centreWords.hint}
            </Body>
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
        </Card>
      ) : null}
      <View style={[styles.outline, tpl.layout === 'road' ? styles.road : null]}>
        {outline?.children.map((c, i) => renderNode(c, i))}
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
        <Button label={t.cancel} variant="secondary" onPress={onCancel} />
      </View>
    </View>
  );
}

/** The care a save asked for (D3): the lead and the crisis card, or one kind line. */
function Care({
  care,
  onSeen,
  go,
}: {
  care: WrittenCare;
  onSeen: () => void;
  go: (route: string) => void;
}) {
  if (care.level === 'setback') {
    return (
      <Body pair="cardMuted" small>
        {t.care.setback}
      </Body>
    );
  }
  return (
    <View style={styles.editor}>
      <Body pair="card" strong>
        {care.level === 'crisis' ? t.care.crisisLead : t.care.concernLead}
      </Body>
      <CrisisCard artifact={care.card} />
      {care.level === 'concern' ? (
        <Button variant="secondary" label={t.care.companion} onPress={() => go('/chat')} />
      ) : null}
      <Button variant="secondary" label={t.care.seen} onPress={onSeen} />
    </View>
  );
}

const styles = StyleSheet.create({
  outline: { gap: theme.space['3'] },
  road: {
    borderLeftWidth: theme.border.rule,
    borderLeftColor: theme.color.lineStrong,
    borderStyle: 'dashed',
    paddingLeft: theme.space['4'],
  },
  branch: {
    backgroundColor: theme.color.surface,
    borderColor: theme.color.line,
    borderWidth: theme.border.thin,
    borderLeftWidth: theme.border.rule,
    borderRadius: theme.radius.md,
    padding: theme.space['3'],
    gap: theme.space['2'],
  },
  step: { gap: theme.space['2'], paddingTop: theme.space['2'] },
  children: {
    gap: theme.space['2'],
    paddingLeft: theme.space['3'],
    borderLeftWidth: theme.border.thin,
    borderLeftColor: theme.color.line,
  },
  marker: {
    position: 'absolute',
    left: -(theme.space['4'] + theme.border.rule / 2 + theme.space['2']),
    top: theme.space['3'],
    width: theme.space['4'],
    height: theme.space['4'],
    borderRadius: theme.radius.full,
  },
  // Wraps: on a 320 dp phone with large text, "Not achieved" beside its glyph ran past the card's
  // edge, since a row's children don't shrink in React Native (A7-20).
  status: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: theme.space['2'] },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.space['2'] },
  confirm: {
    gap: theme.space['2'],
    padding: theme.space['3'],
    borderRadius: theme.radius.md,
    backgroundColor: theme.color.surfaceSunk,
  },
  editor: { gap: theme.space['3'] },
});
