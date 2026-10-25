import { onboarding, profileLook as t } from '@universityflow/content/app';
import { tokens } from '@universityflow/tokens';
import {
  AVATAR_IDS,
  type AvatarId,
  BADGE_IDS,
  type BadgeId,
  type IconId,
  initials,
  type ProfileLook as Look,
  MAX_BADGES,
  TAGLINE_IDS,
  THEME_IDS,
  type ThemeId,
} from '@universityflow/ui';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Animated, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { api, errorMessage } from '../lib/api';
import { useReduceMotion } from '../lib/motion';
import { profilePhotoUri } from '../lib/photo';
import { theme } from '../lib/theme';
import { HelloArc, LookIcon, PosterLine } from './look-drawing';
import { ProfilePhotoSection } from './profile-photo';
import { announce, Button, Checkbox, focusOn, Notice, Radio, RadioGroup } from './ui';

/**
 * The About me card and "Make it yours" in the app (docs/design/profile-look-proposal.md, step 7;
 * the owner's D5: the card and its picker only). The phone layout of the web's poster: "Hello" on
 * an arc, a large black-and-white figure in a soft spotlight of the theme, a round grade sticker,
 * the words as dark tags with an accent edge, the name huge in two tones and the tagline with an
 * arrow. Since the app rebuild (react-native-svg, D6) "Hello" is text on the web's arc, one thin
 * line runs from it round the figure to "I'm", and the icon avatars are the web's drawings
 * (components/look-drawing.tsx); patterns are still Views.
 *
 * Motion with the RN `Animated` API, once on entrance (the figure and the name rise, the line
 * draws itself) and a wiggle on Save; none under Reduce Motion (`useReduceMotion`, hard rule 9).
 */

const ms = (value: string) => Number.parseInt(value, 10);

/** The theme's two colours, from the tokens (PROFILE_THEME_PAIRS holds every pair to AA). */
export function lookColors(id: ThemeId) {
  const { accent, soft } = tokens.profileThemes[id];
  return { accent: tokens.color[accent], soft: tokens.color[soft] };
}

const PATTERN_PARTS = 6;
const GRID_LINE_PARTS = 5;

/** Two theme colours drawn with Views: the web's CSS patterns, simplified. */
function Pattern({
  id,
  size,
  accent,
  soft,
}: {
  id: string;
  size: number;
  accent: string;
  soft: string;
}) {
  const unit = size / PATTERN_PARTS;
  const parts = Array.from({ length: PATTERN_PARTS }, (_, i) => i);
  let inside: ReactNode = null;
  if (id === 'dots')
    inside = parts.flatMap((row) =>
      parts.map((col) => (
        <View
          key={`${row}-${col}`}
          style={{
            position: 'absolute',
            left: col * unit + unit / 4,
            top: row * unit + unit / 4,
            width: unit / 2,
            height: unit / 2,
            borderRadius: unit,
            backgroundColor: accent,
          }}
        />
      )),
    );
  else if (id === 'stripes' || id === 'grid') {
    // A stripe is half a part wide; a grid line a fifth (proportions of the avatar, not tokens).
    const bar = id === 'grid' ? unit / GRID_LINE_PARTS : unit / 2;
    inside = parts.flatMap((i) => [
      <View
        key={`v${i}`}
        style={{
          position: 'absolute',
          left: i * unit,
          top: -size,
          width: bar,
          height: size * 3,
          backgroundColor: accent,
          transform: [{ rotate: id === 'stripes' ? '45deg' : '0deg' }],
        }}
      />,
      ...(id === 'grid'
        ? [
            <View
              key={`h${i}`}
              style={{
                position: 'absolute',
                top: i * unit,
                left: 0,
                height: bar,
                width: size,
                backgroundColor: accent,
              }}
            />,
          ]
        : []),
    ]);
  } else if (id === 'rays')
    inside = parts.map((i) => (
      <View
        key={i}
        style={{
          position: 'absolute',
          left: 0,
          top: size / 2 - unit / 4,
          width: size,
          height: unit / 2,
          backgroundColor: accent,
          transform: [{ rotate: `${(180 / PATTERN_PARTS) * i}deg` }],
        }}
      />
    ));
  else if (id === 'rings' || id === 'waves')
    inside = [1, 2, 3].map((ring) => {
      const d = (size / 3) * ring;
      return (
        <View
          key={ring}
          style={{
            position: 'absolute',
            left: (size - d) / 2,
            top: id === 'waves' ? size / 2 - d / 4 : (size - d) / 2,
            width: d,
            height: id === 'waves' ? d / 2 : d,
            borderRadius: d,
            borderWidth: unit / 3,
            borderColor: accent,
            borderBottomWidth: id === 'waves' ? 0 : unit / 3,
          }}
        />
      );
    });
  return <View style={[StyleSheet.absoluteFill, { backgroundColor: soft }]}>{inside}</View>;
}

/** A head and shoulders, for initials with no name. */
function Person({ size, color }: { size: number; color: string }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <View
        style={{ width: size / 4, height: size / 4, borderRadius: size, backgroundColor: color }}
      />
      <View
        style={{
          marginTop: size / 24,
          width: size / 2.4,
          height: size / 6,
          borderTopLeftRadius: size,
          borderTopRightRadius: size,
          backgroundColor: color,
        }}
      />
    </View>
  );
}

/**
 * The avatar: initials, an icon or a pattern. `mono`: black and white, as the poster's figure;
 * otherwise on the theme's accent.
 */
export function Avatar({
  avatar,
  name,
  themeId,
  size,
  mono = false,
}: {
  avatar: AvatarId;
  name: string | null;
  themeId: ThemeId;
  size: number;
  mono?: boolean;
}) {
  const { accent, soft } = lookColors(themeId);
  const [kind, id] = avatar.split(':');
  const ink = mono ? theme.color.ink : theme.color.onAccent;
  const letters = initials(name);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: mono ? theme.color.surfaceSunk : accent,
      }}
    >
      {kind === 'pattern' ? (
        <Pattern id={id ?? ''} size={size} accent={accent} soft={soft} />
      ) : kind === 'icon' ? (
        <LookIcon id={id as IconId} size={size / 2} color={ink} />
      ) : letters ? (
        <Text
          style={{
            color: ink,
            fontSize: size * 0.36,
            lineHeight: size * 0.44,
            fontWeight: theme.fontWeight.bold,
          }}
        >
          {letters}
        </Text>
      ) : (
        <Person size={size} color={ink} />
      )}
    </View>
  );
}

/** A thin arrow, drawn with Views: the tagline's. */
function Arrow({ color }: { color: string }) {
  const s = theme.space['4'];
  return (
    <View style={{ width: s * 1.4, height: s, justifyContent: 'center' }}>
      <View style={{ height: theme.border.thick, backgroundColor: color }} />
      <View
        style={{
          position: 'absolute',
          right: theme.border.thick,
          width: s / 1.6,
          height: s / 1.6,
          borderTopWidth: theme.border.thick,
          borderRightWidth: theme.border.thick,
          borderColor: color,
          transform: [{ rotate: '45deg' }],
        }}
      />
    </View>
  );
}

const AVATAR_SIZE = theme.space['8'] * 2.25;

export function ProfileCard({
  look,
  name,
  grade,
  saves,
  photoUri = null,
}: {
  look: Look;
  name: string | null;
  /** Null past matric or before it is given: no sticker. */
  grade: number | null;
  /** Bumped on each save: the sticker's one wiggle. */
  saves: number;
  /** The profile photo, black and white from the server, in the avatar's place (§5.3). */
  photoUri?: string | null;
}) {
  const reduce = useReduceMotion();
  const { accent, soft } = lookColors(look.theme);
  const rise = useRef(new Animated.Value(0)).current;
  const wiggle = useRef(new Animated.Value(0)).current;
  const entered = useRef(false);
  // The poster's size and where "I'm" starts: the line is stretched between them.
  const [poster, setPoster] = useState({ width: 0, height: 0 });
  const [introY, setIntroY] = useState(0);

  // The entrance, once, the first time the phone says motion is fine. The card is already shown
  // at rest by then (the safe first guess is no motion), so nothing is taken away to be brought
  // back: the words stay put and the figure and the name only rise (A2-40).
  useEffect(() => {
    if (reduce || entered.current) return;
    entered.current = true;
    rise.setValue(theme.space['2']);
    Animated.timing(rise, {
      toValue: 0,
      duration: ms(tokens.duration.enter),
      useNativeDriver: true,
    }).start();
  }, [reduce, rise]);

  useEffect(() => {
    if (saves === 0 || reduce) return;
    const step = ms(tokens.duration.normal);
    Animated.sequence([
      Animated.timing(wiggle, { toValue: -1, duration: step, useNativeDriver: true }),
      Animated.timing(wiggle, { toValue: 0, duration: step, useNativeDriver: true }),
    ]).start();
  }, [saves, reduce, wiggle]);

  const words = look.badgeIds;
  // The sticker and the words are drawn above the name but said once, after it (A2-35, WCAG
  // 1.3.2 and 2.4.6): their Views are hidden from assistive tech and this is their one stop.
  const summary = t.posterSummary(
    grade ? onboarding.gradeOption(grade) : null,
    words.map((word) => t.badges[word]),
  );
  return (
    <View
      testID="look-poster"
      style={styles.poster}
      onLayout={(e) =>
        setPoster({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })
      }
    >
      {/* First, so the figure, the words and the name sit over it, as on the web. */}
      <PosterLine width={poster.width} height={poster.height} endY={introY} reduce={reduce} />
      <HelloArc />
      <View style={styles.figure}>
        <View
          style={[
            styles.spotlight,
            { backgroundColor: soft, width: AVATAR_SIZE * 1.7, height: AVATAR_SIZE * 1.7 },
          ]}
        />
        <Animated.View
          testID="avatar-card"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[styles.ring, { borderColor: accent, transform: [{ translateY: rise }] }]}
        >
          {photoUri ? (
            <Image
              testID="photo-card"
              source={{ uri: photoUri }}
              style={{ width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE }}
            />
          ) : (
            <Avatar avatar={look.avatar} name={name} themeId={look.theme} size={AVATAR_SIZE} mono />
          )}
        </Animated.View>
        {grade ? (
          <Animated.View
            testID="look-sticker"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={[
              styles.sticker,
              { backgroundColor: accent },
              {
                transform: [
                  {
                    rotate: wiggle.interpolate({
                      inputRange: [-1, 0],
                      outputRange: ['-26deg', '-12deg'],
                    }),
                  },
                ],
              },
            ]}
          >
            <Text style={[theme.text.small, styles.stickerText]}>
              {onboarding.gradeOption(grade)}
            </Text>
          </Animated.View>
        ) : null}
      </View>
      {words.length > 0 ? (
        <View
          testID="look-words"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={styles.chips}
        >
          {words.map((word) => (
            <View key={word} style={[styles.chip, { borderColor: accent }]}>
              <Text style={[theme.text.body, { color: theme.color.ink }]}>{t.badges[word]}</Text>
              <View
                style={[styles.flick, { borderLeftColor: accent }]}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
              />
            </View>
          ))}
        </View>
      ) : null}
      <Animated.View
        testID="look-intro"
        onLayout={(e) => setIntroY(e.nativeEvent.layout.y)}
        style={[styles.intro, { transform: [{ translateY: rise }] }]}
      >
        {name ? (
          <Text
            accessibilityElementsHidden
            importantForAccessibility="no"
            style={[styles.display, { color: theme.color.ink }]}
          >
            {t.im}
          </Text>
        ) : null}
        <Text accessibilityRole="header" style={[styles.display, { color: accent }]}>
          {name ?? t.noName}
        </Text>
      </Animated.View>
      {summary ? (
        // After the header in the tree, so a screen reader meets the name first; laid over the
        // sticker and the words it describes (everything above "I'm"), so the focus ring is there.
        <View
          testID="look-summary"
          accessible
          accessibilityLabel={summary}
          pointerEvents="none"
          style={[styles.summary, { height: introY }]}
        />
      ) : null}
      {look.taglineId ? (
        <View style={styles.tagline}>
          <Text style={[theme.text.body, { color: theme.color.ink, flexShrink: 1 }]}>
            {t.taglines[look.taglineId]}
          </Text>
          <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Arrow color={accent} />
          </View>
        </View>
      ) : null}
    </View>
  );
}

/** A swatch or a picture tile: a radio, 44 points, selected by an ink ring as well as colour. */
function Choice({
  label,
  selected,
  onPress,
  children,
  named = false,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  children: ReactNode;
  /** Show the label under the choice: a theme's name, so a colour is never the only clue (A2-31). */
  named?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={styles.choice}
    >
      <View style={[styles.choiceRing, selected ? styles.choiceRingOn : null]}>{children}</View>
      {named ? (
        <Text style={[theme.text.small, { color: theme.color.ink, textAlign: 'center' }]}>
          {label}
        </Text>
      ) : null}
    </Pressable>
  );
}

function pictureName(avatar: AvatarId): string {
  const [kind, key] = avatar.split(':');
  if (kind === 'icon') return t.icons[key as keyof typeof t.icons];
  if (kind === 'pattern') return t.patterns[key as keyof typeof t.patterns];
  return t.initialsLabel;
}

/**
 * The card and, under it, "Make it yours": every choice shows on the card at once and nothing is
 * stored until Save (one PATCH /api/me, as on the web); Cancel puts the saved look back.
 */
export function ProfileLookSection({
  initial,
  name,
  grade,
  photo = null,
}: {
  initial: Look;
  name: string | null;
  grade: number | null;
  /** Null when the server offers no photo (its switch is off); else its version, or null for none. */
  photo?: { readonly version: string | null } | null;
}) {
  const [saved, setSaved] = useState(initial);
  const [look, setLook] = useState(initial);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saves, setSaves] = useState(0);
  const [photoVersion, setPhotoVersion] = useState(photo?.version ?? null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const full = look.badgeIds.length >= MAX_BADGES;
  // Save and Cancel close the picker, taking the pressed button with it: the screen reader goes
  // back to "Make it yours" once the picker has gone (A2-36), never to wherever the phone picks.
  const toggle = useRef<View>(null);
  const [refocus, setRefocus] = useState(false);
  useEffect(() => {
    if (open || !refocus) return;
    setRefocus(false);
    focusOn(toggle.current);
  }, [open, refocus]);
  const close = () => {
    setOpen(false);
    setRefocus(true);
  };

  // The photo is fetched with the session and kept in memory; none, or a failure: the avatar.
  useEffect(() => {
    let live = true;
    if (!photo || !photoVersion) {
      setPhotoUri(null);
      return;
    }
    profilePhotoUri(photoVersion)
      .then((uri) => {
        if (live) setPhotoUri(uri);
      })
      .catch(() => {
        if (live) setPhotoUri(null);
      });
    return () => {
      live = false;
    };
  }, [photo, photoVersion]);

  const choose = (change: Partial<Look>) => setLook((current) => ({ ...current, ...change }));

  function toggleWord(word: BadgeId) {
    const has = look.badgeIds.includes(word);
    if (!has && full) return;
    const badgeIds = has ? look.badgeIds.filter((w) => w !== word) : [...look.badgeIds, word];
    choose({ badgeIds });
    // Said as well as shown, as the web's live count is (A2-34).
    announce(t.wordsChosen(badgeIds.length, MAX_BADGES));
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await api('/api/me', { method: 'PATCH', json: look });
      setSaved(look);
      setSaves((n) => n + 1);
      close();
      announce(t.saved);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  function cancel() {
    setLook(saved);
    close();
    setError(null);
  }

  // The pictures in the web's three groups: initials, icons, patterns.
  const pictureKinds = [
    { heading: t.avatarKinds.initials, ids: AVATAR_IDS.filter((a) => a === 'initials') },
    { heading: t.avatarKinds.icons, ids: AVATAR_IDS.filter((a) => a.startsWith('icon:')) },
    { heading: t.avatarKinds.patterns, ids: AVATAR_IDS.filter((a) => a.startsWith('pattern:')) },
  ];
  return (
    <View style={styles.section}>
      <ProfileCard look={look} name={name} grade={grade} saves={saves} photoUri={photoUri} />
      <Button
        ref={toggle}
        label={t.open}
        variant="secondary"
        expanded={open}
        onPress={() => (open ? cancel() : setOpen(true))}
      />
      {open ? (
        <View style={styles.picker}>
          <Text style={[theme.text.body, { color: theme.color.inkMuted }]}>{t.lead}</Text>
          {error ? <Notice tone="danger">{error}</Notice> : null}
          {photo ? <ProfilePhotoSection version={photoVersion} onChange={setPhotoVersion} /> : null}
          <View accessibilityRole="radiogroup" accessibilityLabel={t.theme} style={styles.group}>
            <Text style={[theme.text.label, { color: theme.color.ink }]}>{t.theme}</Text>
            <View style={styles.row}>
              {THEME_IDS.map((id) => (
                <Choice
                  key={id}
                  named
                  label={t.themes[id]}
                  selected={look.theme === id}
                  onPress={() => choose({ theme: id })}
                >
                  <View style={[styles.swatch, { backgroundColor: lookColors(id).accent }]} />
                </Choice>
              ))}
            </View>
          </View>
          <View accessibilityRole="radiogroup" accessibilityLabel={t.avatar} style={styles.group}>
            <Text style={[theme.text.label, { color: theme.color.ink }]}>{t.avatar}</Text>
            {pictureKinds.map((group) => (
              <View key={group.heading} style={styles.group}>
                <Text style={[theme.text.small, { color: theme.color.inkMuted }]}>
                  {group.heading}
                </Text>
                <View style={styles.row}>
                  {group.ids.map((avatar) => (
                    <Choice
                      key={avatar}
                      label={pictureName(avatar)}
                      selected={look.avatar === avatar}
                      onPress={() => choose({ avatar })}
                    >
                      <Avatar
                        avatar={avatar}
                        name={name}
                        themeId={look.theme}
                        size={theme.target}
                      />
                    </Choice>
                  ))}
                </View>
              </View>
            ))}
          </View>
          <RadioGroup label={t.tagline}>
            <Radio
              label={t.taglineNone}
              pair="page"
              selected={look.taglineId === null}
              onPress={() => choose({ taglineId: null })}
            />
            {TAGLINE_IDS.map((id) => (
              <Radio
                key={id}
                label={t.taglines[id]}
                pair="page"
                selected={look.taglineId === id}
                onPress={() => choose({ taglineId: id })}
              />
            ))}
          </RadioGroup>
          <View style={styles.group}>
            <Text accessibilityRole="header" style={[theme.text.label, { color: theme.color.ink }]}>
              {t.words}
            </Text>
            <Text style={[theme.text.small, { color: theme.color.inkMuted }]}>{t.wordsHint}</Text>
            <Text style={[theme.text.small, { color: theme.color.inkMuted }]}>
              {t.wordsChosen(look.badgeIds.length, MAX_BADGES)}
            </Text>
            {BADGE_IDS.map((word) => {
              const chosen = look.badgeIds.includes(word);
              const blocked = full && !chosen;
              return (
                <Checkbox
                  key={word}
                  label={t.badges[word]}
                  pair="page"
                  checked={chosen}
                  disabled={blocked}
                  hint={blocked ? t.wordsFull(MAX_BADGES) : undefined}
                  onPress={() => toggleWord(word)}
                />
              );
            })}
          </View>
          <Button label={t.save} busy={busy} busyLabel={t.save} onPress={() => void save()} />
          <Button label={t.cancel} variant="quiet" onPress={cancel} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: theme.space['4'] },
  poster: {
    alignItems: 'center',
    gap: theme.space['4'],
    padding: theme.space['5'],
    borderRadius: theme.radius.lg,
    borderWidth: theme.border.thin,
    borderColor: theme.color.line,
    backgroundColor: theme.color.canvas,
    overflow: 'hidden',
  },
  figure: { alignItems: 'center', justifyContent: 'center' },
  spotlight: { position: 'absolute', borderRadius: theme.radius.full },
  ring: {
    padding: theme.space['2'],
    borderRadius: theme.radius.full,
    borderWidth: theme.border.thin,
  },
  sticker: {
    position: 'absolute',
    top: 0,
    left: -theme.space['5'],
    // A circle at the usual text size that grows with the largest Dynamic Type and font scales,
    // instead of "Grade 10" spilling out of a fixed one (A2-38, WCAG 1.4.4).
    minWidth: theme.space['8'] * 1.25,
    minHeight: theme.space['8'] * 1.25,
    padding: theme.space['1'],
    borderRadius: theme.radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stickerText: {
    color: theme.color.onAccent,
    fontWeight: theme.fontWeight.bold,
    textAlign: 'center',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: theme.space['2'],
  },
  chip: {
    backgroundColor: theme.color.canvas,
    borderWidth: theme.border.thin,
    borderRadius: theme.radius.md,
    paddingVertical: theme.space['2'],
    paddingHorizontal: theme.space['4'],
  },
  flick: {
    position: 'absolute',
    left: -theme.border.thin,
    bottom: -theme.border.thin,
    width: 0,
    height: 0,
    borderTopWidth: theme.space['3'],
    borderTopColor: 'transparent',
    borderLeftWidth: theme.space['3'],
  },
  intro: { alignSelf: 'stretch' },
  summary: { position: 'absolute', top: 0, left: 0, right: 0 },
  display: {
    fontSize: theme.fontSize['3xl'] * 1.25,
    lineHeight: theme.fontSize['3xl'] * 1.25,
    fontWeight: theme.fontWeight.bold,
  },
  tagline: {
    alignSelf: 'flex-end',
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space['2'],
  },
  picker: { gap: theme.space['5'] },
  group: { gap: theme.space['2'] },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.space['2'] },
  choice: {
    minWidth: theme.target,
    minHeight: theme.target,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.space['1'],
  },
  choiceRing: {
    padding: theme.border.thick,
    borderRadius: theme.radius.full,
    borderWidth: theme.border.thin,
    borderColor: theme.color.lineStrong,
  },
  choiceRingOn: { borderWidth: theme.border.thick, borderColor: theme.color.ink },
  swatch: { width: theme.target, height: theme.target, borderRadius: theme.radius.full },
});
