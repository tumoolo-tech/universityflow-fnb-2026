import { en } from '@universityflow/content/app';
import { tokens } from '@universityflow/tokens';
import {
  type CrisisCardArtifact,
  type IconId,
  PLAN_LIMITS,
  PLAN_TEMPLATE_IDS,
  type PlanMapsResponse,
  type PlanStatus,
  type PlanTemplateId,
} from '@universityflow/ui';
import { useRouter } from 'expo-router';
import { type ReactNode, type Ref, useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { api, errorMessage } from '../lib/api';
import { theme, toPx } from '../lib/theme';
import { CrisisCard } from './artifact-card';
import { LookIcon } from './look-drawing';
import {
  Body,
  Button,
  Card,
  Checkbox,
  Field,
  Heading,
  Notice,
  Radio,
  RadioGroup,
  useAnnounce,
} from './ui';

/**
 * My plan maps on the app's My goal screen (docs/design/plan-maps-proposal.md §4, §8.5; D10:
 * after the goal's buttons): the learner's maps and "Start a new map", with the same API as the
 * web. The map itself opens on its own screen (app/plan-map.tsx), as an outline (D6).
 *
 * RT-06 (the owner's run-through, 2026-10-25): a map carries the learner's own name; the template
 * is only its layout, shown as a small label. The name is their own words, so it is asked for
 * only while the server says words are allowed (D2), and then it is required; it is read by the
 * crisis check like every saved word (D3), and the card shows the care at once.
 */

const t = en.planMaps;
const ta = en.planMapsApp;

/** What a save of the learner's words asked for (D3): the crisis card, or one kind line. */
export type WrittenCare =
  | { readonly level: 'crisis' | 'concern'; readonly card: CrisisCardArtifact }
  | { readonly level: 'setback' };

export function PlanMapsSection({ hasGoal }: { hasGoal: boolean }) {
  const router = useRouter();
  const [data, setData] = useState<PlanMapsResponse | null>(null);
  const [picking, setPicking] = useState(false);
  const [templateId, setTemplateId] = useState<PlanTemplateId>('six-stops');
  const [linksGoal, setLinksGoal] = useState(hasGoal);
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [care, setCare] = useState<WrittenCare | null>(null);
  useAnnounce(status);

  // The goal screen works without its maps: if they can't load, the card isn't shown.
  const load = useCallback(
    () =>
      api<PlanMapsResponse>('/api/me/plan-maps')
        .then(setData)
        .catch(() => undefined),
    [],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => setLinksGoal(hasGoal), [hasGoal]);

  if (!data) return null;
  const full = data.maps.length >= data.max;
  const wordsAllowed = data.wordsAllowed;

  async function start() {
    const title = name.trim();
    // The learner names their own map (RT-06): refused here before any request, and again by
    // the server (400 title-required), never weakened.
    if (wordsAllowed && title === '') {
      setNameError(ta.naming.needed);
      return;
    }
    setNameError(null);
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      const { map, care: asked } = await api<{
        map: { id: string };
        care: WrittenCare | null;
      }>('/api/me/plan-maps', {
        method: 'POST',
        json: { templateId, linksGoal, ...(wordsAllowed ? { title } : {}) },
      });
      if (asked) {
        // The name needs care: the card is shown here, at once; the map waits in the list.
        setCare(asked);
        setPicking(false);
        setName('');
        setStatus(t.created);
        await load();
        return;
      }
      router.push({ pathname: '/plan-map', params: { id: map.id } } as never);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card testID="plan-maps">
      <Heading>{t.title}</Heading>
      <Body pair="cardMuted">{wordsAllowed ? t.lead : t.leadTickOnly}</Body>
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {status ? (
        <Body pair="card" strong>
          {status}
        </Body>
      ) : null}
      {care ? (
        <Care care={care} onSeen={() => setCare(null)} go={(r) => router.push(r as never)} />
      ) : null}
      {data.maps.length === 0 ? <Body pair="cardMuted">{t.empty}</Body> : null}
      {data.maps.map((m) => {
        const template = t.templates[m.templateId].name;
        const mapName = m.title ?? template;
        const layout = ta.naming.layout(template);
        const counts = t.counts(m.counts.achieved, m.counts.notAchieved, m.counts.planned);
        return (
          <View key={m.id} style={styles.row}>
            <Button
              variant="secondary"
              label={mapName}
              accessibilityLabel={`${mapName}, ${layout}, ${counts}`}
              onPress={() => router.push({ pathname: '/plan-map', params: { id: m.id } } as never)}
            />
            <Body pair="cardMuted" small>
              {layout}
            </Body>
            <Body pair="cardMuted" small>
              {counts}
            </Body>
          </View>
        );
      })}
      {full ? (
        <Body pair="cardMuted">{t.full}</Body>
      ) : picking ? (
        <View style={styles.picker}>
          {wordsAllowed ? (
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
          ) : null}
          <RadioGroup label={t.chooseTemplate} pair="card">
            {PLAN_TEMPLATE_IDS.map((id) => (
              <View key={id}>
                <Radio
                  label={t.templates[id].name}
                  selected={templateId === id}
                  onPress={() => setTemplateId(id)}
                />
                <Body pair="cardMuted" small>
                  {t.templates[id].line}
                </Body>
              </View>
            ))}
          </RadioGroup>
          <Checkbox label={t.useGoal} checked={linksGoal} onPress={() => setLinksGoal((v) => !v)} />
          <Body pair="cardMuted" small>
            {t.useGoalHint}
          </Body>
          <Button label={t.create} busy={busy} onPress={() => void start()} />
          <Button label={t.cancel} variant="quiet" onPress={() => setPicking(false)} />
        </View>
      ) : (
        <Button label={t.start} variant="secondary" onPress={() => setPicking(true)} />
      )}
      <Body pair="cardMuted" small>
        {t.exportNote}
      </Body>
    </Card>
  );
}

/** The care a save asked for (D3): the lead and the crisis card, or one kind line. */
export function Care({
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
    <View style={styles.care}>
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

/**
 * The glyph beside each stop's icon on the web (the canvas spec §4.2), drawn here from the
 * twelve icon shapes the app already has (`LOOK_ICONS`, react-native-svg): decoration, hidden
 * from the screen reader. A learner's worries ("What might get in the way", "What holds me
 * back") never get a warning sign: a mountain to climb, not an alert. A learner's own part has
 * no icon (the badge alone). If `packages/ui` gives each slot an icon, read it from there.
 */
export const SLOT_ICONS: Readonly<Record<string, IconId>> = {
  'where-i-am-now': 'baobab',
  'before-grade-10': 'protea',
  'grade-10': 'book',
  'finish-grade-10': 'book',
  'path-grade-10': 'book',
  'grade-11': 'telescope',
  'finish-grade-11': 'telescope',
  'path-grade-11': 'telescope',
  'grades-10-11': 'telescope',
  matric: 'star',
  'write-matric': 'star',
  'path-matric': 'star',
  'matric-done': 'star',
  applying: 'rocket',
  'get-in': 'rocket',
  'path-applying': 'rocket',
  accepted: 'rocket',
  'first-year': 'compass',
  'pass-first-year': 'compass',
  'path-first-year': 'compass',
  'first-year-passed': 'compass',
  'each-year-after': 'mountain',
  finishing: 'mountain',
  graduate: 'mountain',
  'path-graduate': 'mountain',
  graduated: 'mountain',
  why: 'protea',
  'good-at': 'star',
  learn: 'book',
  'who-can-help': 'headphones',
  'in-the-way': 'mountain',
  'first-step': 'rocket',
  'who-i-am': 'protea',
  'holds-me-back': 'mountain',
  'what-i-want': 'star',
  'my-path': 'compass',
  'turning-it-around': 'paintbrush',
  'my-people': 'ball',
  'my-week': 'headphones',
  habits: 'protea',
  focus: 'telescope',
  planning: 'book',
  action: 'rocket',
  'self-belief': 'star',
  motivation: 'protea',
  'keeping-at-it': 'mountain',
};

/** The icon's box: a little bigger than the type, as on the web's cards. */
export const STOP_ICON_SIZE = theme.space['5'];

/** The status as a glyph beside its word (never colour alone): hidden, the word is read. */
export function StatusGlyph({ status }: { status: PlanStatus }) {
  return (
    <Text
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[theme.text.bodyStrong, { color: statusColor(status) }]}
    >
      {status === 'achieved' ? '✓' : status === 'not-achieved' ? '↺' : '○'}
    </Text>
  );
}

/** Achieved in the success green; Not achieved in muted ink, never red (D7); Planned quiet. */
function statusColor(status: PlanStatus): string {
  return status === 'achieved'
    ? theme.color.success
    : status === 'not-achieved'
      ? theme.color.inkMuted
      : theme.color.lineStrong;
}

/**
 * A stop's status chip (the canvas spec §4.1): a pill with the glyph and the word, always a
 * word. Achieved takes the success edge; the other two the quiet `lineStrong` edge, both held
 * to 3:1 on every tone's soft fill (MAP_TONE_PAIRS). Decoration to a screen reader: the stop's
 * heading already says the status.
 */
export function StatusChip({ status }: { status: PlanStatus }) {
  const word = status === 'planned' ? theme.color.inkMuted : statusColor(status);
  return (
    <View
      testID="plan-card-chip"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.chip,
        { borderColor: status === 'achieved' ? theme.color.success : theme.color.lineStrong },
      ]}
    >
      <StatusGlyph status={status} />
      <Text style={[theme.text.small, styles.chipWord, { color: word }]}>{t.status[status]}</Text>
    </View>
  );
}

/** The number in a stop's tone: its place in reading order (the step number when ordered). */
export function StopBadge({ n, accent }: { n: number; accent: string }) {
  return (
    <View
      testID="plan-card-badge"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.badge, { backgroundColor: accent }]}
    >
      <Text style={[theme.text.small, styles.badgeText, { color: theme.color.onAccent }]}>
        {String(n)}
      </Text>
    </View>
  );
}

/** A slot's icon in the stop's tone, or nothing for a learner's own part. */
export function StopIcon({ slotKey, accent }: { slotKey: string | null; accent: string }) {
  const id = slotKey ? SLOT_ICONS[slotKey] : undefined;
  if (!id) return null;
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <LookIcon id={id} size={STOP_ICON_SIZE} color={accent} />
    </View>
  );
}

/** One of the stop's lines as a bullet in its tone: the learner's words, a step, a reflection. */
export function Bullet({
  accent,
  muted,
  children,
}: {
  accent: string;
  muted?: boolean;
  children: ReactNode;
}) {
  return (
    <View style={styles.bullet}>
      <View
        style={[styles.dot, { backgroundColor: accent }]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
      <Text
        style={[
          theme.text.body,
          styles.bulletText,
          { color: muted ? theme.color.inkMuted : theme.color.ink },
        ]}
      >
        {children}
      </Text>
    </View>
  );
}

/**
 * A button on a tone card: ink in a `lineStrong` outline (3:1 on every soft fill), or quiet in
 * the brand colour (4.5:1 there too, MAP_TONE_PAIRS), with no fill, so the card's tone shows
 * through. The app's `Button` paints the page colour behind its text, a dark box on a tinted
 * card; this one doesn't. A thumb's size (`theme.target`), a role and a name, like every control.
 */
export function CardButton(props: {
  label: string;
  onPress: () => void;
  quiet?: boolean;
  disabled?: boolean;
  busy?: boolean;
  accessibilityLabel?: string;
  expanded?: boolean;
  testID?: string;
  ref?: Ref<View>;
}) {
  const disabled = Boolean(props.disabled || props.busy);
  return (
    <Pressable
      ref={props.ref}
      accessibilityRole="button"
      accessibilityLabel={props.accessibilityLabel ?? props.label}
      accessibilityState={{
        disabled,
        busy: Boolean(props.busy),
        ...(props.expanded === undefined ? null : { expanded: props.expanded }),
      }}
      disabled={disabled}
      onPress={props.onPress}
      testID={props.testID}
      style={({ pressed }) => [
        styles.cardButton,
        props.quiet
          ? styles.cardButtonQuiet
          : { borderColor: pressed ? theme.color.brand : theme.color.lineStrong },
        disabled ? styles.disabled : null,
      ]}
    >
      <Text
        style={[
          theme.text.label,
          styles.cardButtonText,
          { color: props.quiet ? theme.color.brand : theme.color.ink },
        ]}
      >
        {props.label}
      </Text>
    </Pressable>
  );
}

/** The badge's and the chip's height: the tokens' dense row (28px), as the web's cards. */
const SMALL_ROW = toPx(tokens.targetDense);

const styles = StyleSheet.create({
  row: { gap: theme.space['1'] },
  picker: { gap: theme.space['3'] },
  care: { gap: theme.space['3'] },
  chip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: theme.space['2'],
    minHeight: SMALL_ROW,
    paddingHorizontal: theme.space['3'],
    borderWidth: theme.border.thin,
    borderRadius: theme.radius.full,
  },
  chipWord: { fontWeight: theme.fontWeight.medium },
  badge: {
    width: SMALL_ROW,
    height: SMALL_ROW,
    borderRadius: theme.radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontWeight: theme.fontWeight.bold },
  bullet: { flexDirection: 'row', alignItems: 'flex-start', gap: theme.space['2'] },
  dot: {
    width: theme.space['2'],
    height: theme.space['2'],
    borderRadius: theme.radius.full,
    // Sits on the first line's middle.
    marginTop: (theme.text.body.lineHeight - theme.space['2']) / 2,
  },
  bulletText: { flexShrink: 1 },
  cardButton: {
    minHeight: theme.target,
    minWidth: theme.target,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.space['4'],
    paddingVertical: theme.space['2'],
    borderRadius: theme.radius.md,
    borderWidth: theme.border.thick,
  },
  cardButtonQuiet: { borderColor: 'transparent' },
  cardButtonText: { textAlign: 'center' },
  disabled: { opacity: 0.6 },
});
