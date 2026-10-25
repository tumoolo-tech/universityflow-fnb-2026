import { dialable } from '@universityflow/catalogue/client';
import { en } from '@universityflow/content/app';
import { type ReactNode, type Ref, useEffect } from 'react';
import {
  AccessibilityInfo,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { type Pair, theme } from '../lib/theme';

/**
 * The app's building blocks. Every colour and size comes from the theme (hard rule 8), every
 * control has a role and a label and is at least the token's touch target (WCAG 2.2 AA, hard
 * rule 9). Nothing animates, so there is no motion to reduce.
 */

export function Screen(props: {
  children: ReactNode;
  scroll?: boolean;
  footer?: ReactNode;
  /** The navigation header already covers the top inset. */
  belowHeader?: boolean;
  testID?: string;
}) {
  const body = <View style={styles.content}>{props.children}</View>;
  return (
    <SafeAreaView
      style={styles.screen}
      edges={props.belowHeader ? ['bottom', 'left', 'right'] : ['top', 'bottom', 'left', 'right']}
      testID={props.testID}
    >
      {props.scroll === false ? (
        body
      ) : (
        // iOS insets the scroll view by the keyboard's overlap, so the lower fields of a form
        // (Confirm marks, the guardian's phone, the delete confirmation) scroll clear of it
        // (A7-06). Android resizes the window for the keyboard itself.
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
        >
          {body}
        </ScrollView>
      )}
      {props.footer}
    </SafeAreaView>
  );
}

export function Title({ children }: { children: ReactNode }) {
  return (
    <Text accessibilityRole="header" style={[theme.text.title, { color: theme.color.ink }]}>
      {children}
    </Text>
  );
}

/**
 * A screen's title and its lead, together: the lead muted and close under the title, then the
 * screen's usual gap, as on the web (docs/design/README.md, "One rhythm"). Every titled screen
 * uses it (__tests__/screen-rhythm.test.ts).
 */
export function PageHeader({ title, lead }: { title: string; lead?: string | undefined }) {
  return (
    <View style={styles.header}>
      <Title>{title}</Title>
      {lead ? <Body pair="pageMuted">{lead}</Body> : null}
    </View>
  );
}

/**
 * The one way a screen says it has nothing to show yet, as the home's empty cards do: a card with
 * one muted sentence and, when the next step isn't already on the screen, one outline button.
 */
export function EmptyState({
  children,
  action,
}: {
  children: string;
  action?: { label: string; onPress: () => void } | undefined;
}) {
  return (
    <Card testID="empty-state">
      <Body pair="cardMuted">{children}</Body>
      {action ? <Button label={action.label} variant="secondary" onPress={action.onPress} /> : null}
    </Card>
  );
}

/**
 * A heading inside the page. `level` 2 (the default) titles a card; level 3 is a step down for a
 * title under it (each campus under its university, the crisis card's campus lines), so a long
 * card shows where one part ends (A2-20). Both are headers to TalkBack and VoiceOver.
 */
export function Heading({
  children,
  pair = 'card',
  level = 2,
  ref,
}: {
  children: ReactNode;
  pair?: Pair;
  level?: 2 | 3;
  /** To put the screen reader on it when the part it titles opens (`focusOn`, audit CV-A2). */
  ref?: Ref<Text>;
}) {
  return (
    <Text
      ref={ref}
      accessibilityRole="header"
      style={[
        level === 3 ? theme.text.bodyStrong : theme.text.heading,
        { color: theme.on(pair).color },
      ]}
    >
      {children}
    </Text>
  );
}

/**
 * A section's title inside a card ("Conditions, as your letter puts them", "Health and safety"):
 * body-strong to look at, a header to TalkBack and VoiceOver, so they can move by heading (A3-15).
 */
export function SectionTitle({
  children,
  pair = 'card',
  ref,
}: {
  children: string;
  pair?: Pair;
  /** To put the screen reader on it (`focusOn`) when the control pressed under it goes. */
  ref?: Ref<Text>;
}) {
  return (
    <Text
      ref={ref}
      accessibilityRole="header"
      style={[theme.text.bodyStrong, { color: theme.on(pair).color }]}
    >
      {children}
    </Text>
  );
}

/** Body text. `pair` names the background it sits on, so its colour is a tested pair. */
export function Body(props: {
  children: ReactNode;
  pair?: Pair;
  small?: boolean;
  strong?: boolean;
  testID?: string;
  /** To put the screen reader on it (`focusOn`): a question that replaces the button pressed. */
  ref?: Ref<Text>;
}) {
  const variant = props.small
    ? theme.text.small
    : props.strong
      ? theme.text.bodyStrong
      : theme.text.body;
  return (
    <Text
      ref={props.ref}
      style={[variant, { color: theme.on(props.pair ?? 'page').color }]}
      testID={props.testID}
    >
      {props.children}
    </Text>
  );
}

/**
 * Says `text` to the screen reader now, on both platforms. A live region is Android-only and the
 * `alert` role announces nothing on iOS, so an outcome that appears on screen is announced
 * explicitly (A3-02, WCAG 4.1.3).
 */
export function announce(text: string) {
  AccessibilityInfo.announceForAccessibility(text);
}

/**
 * Puts the screen reader's focus on `target` (VoiceOver and TalkBack), for when the control just
 * pressed goes away (Save or Cancel closing a panel): without it the phone picks, often the top of
 * the screen (WCAG 2.4.3, A2-36). Call it after the panel has gone, from an effect.
 */
export function focusOn(target: View | Text | null) {
  if (target) AccessibilityInfo.sendAccessibilityEvent(target, 'focus');
}

/** Announces `text` whenever it appears or changes (nothing for null or empty). */
export function useAnnounce(text: string | null | undefined) {
  useEffect(() => {
    if (text) announce(text);
  }, [text]);
}

/** `danger` is for an irreversible action only (account deletion): white on danger red. */
type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'danger';

/**
 * `secondary` is calm, as on the web (docs/design §2): ink text in a neutral `lineStrong` outline
 * (3:1 on the page and on a card, NON_TEXT_PAIRS), the mauve only while pressed.
 */
const BUTTON_PAIR: Record<ButtonVariant, Pair> = {
  primary: 'primary',
  secondary: 'page',
  quiet: 'pageBrand',
  danger: 'destructive',
};

export function Button(props: {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  busy?: boolean;
  busyLabel?: string;
  hint?: string;
  /**
   * The name a screen reader hears when the visible label alone repeats down a list ("What I
   * need for this course: BCom Accounting"). It starts with the visible label (WCAG 2.5.3).
   */
  accessibilityLabel?: string;
  /** For a button that opens and closes something inline (A3-07). */
  expanded?: boolean;
  testID?: string;
  /** To move the screen reader's focus back to it (`focusOn`). */
  ref?: Ref<View>;
}) {
  const variant = props.variant ?? 'primary';
  const disabled = Boolean(props.disabled || props.busy);
  const colours = theme.on(BUTTON_PAIR[variant]);
  return (
    <Pressable
      ref={props.ref}
      accessibilityRole="button"
      accessibilityLabel={
        props.busy && props.busyLabel ? props.busyLabel : (props.accessibilityLabel ?? props.label)
      }
      accessibilityHint={props.hint}
      accessibilityState={{
        disabled,
        busy: Boolean(props.busy),
        ...(props.expanded === undefined ? null : { expanded: props.expanded }),
      }}
      disabled={disabled}
      onPress={props.onPress}
      testID={props.testID}
      style={({ pressed }) => [
        styles.button,
        variant === 'primary'
          ? { backgroundColor: pressed ? theme.color.brandHover : colours.backgroundColor }
          : variant === 'secondary'
            ? {
                backgroundColor: colours.backgroundColor,
                borderColor: pressed ? theme.color.brand : theme.color.lineStrong,
              }
            : variant === 'danger'
              ? { backgroundColor: colours.backgroundColor }
              : { backgroundColor: colours.backgroundColor, borderColor: 'transparent' },
        disabled ? styles.disabled : null,
      ]}
    >
      <Text style={[theme.text.label, styles.buttonText, { color: colours.color }]}>
        {props.busy && props.busyLabel ? props.busyLabel : props.label}
      </Text>
    </Pressable>
  );
}

export function Field(
  props: {
    label: string;
    /**
     * The name a screen reader hears, when the visible label alone is ambiguous (one "Mark (%)" per
     * row: "Mark (%), Mathematics"). It starts with the visible label (WCAG 2.5.3).
     */
    accessibilityLabel?: string;
    hint?: string;
    error?: string | null;
    testID?: string;
  } & Pick<
    TextInputProps,
    | 'value'
    | 'onChangeText'
    | 'keyboardType'
    | 'autoComplete'
    | 'textContentType'
    | 'maxLength'
    | 'placeholder'
    | 'multiline'
    | 'onSubmitEditing'
    | 'autoCapitalize'
    // Off for codes and searches: iOS can "correct" a module code on the space bar (A7-15).
    | 'autoCorrect'
    | 'spellCheck'
  >,
) {
  const { label, accessibilityLabel, hint, error, testID, ...input } = props;
  // RN 0.86 ignores aria-invalid on a TextInput, so the error is read with the field, in its
  // hint, after any standing hint (A3-03).
  const spoken = [hint, error].filter(Boolean).join(' ') || undefined;
  return (
    <View style={styles.field}>
      <Text
        style={[theme.text.label, { color: theme.color.ink }]}
        nativeID={testID ? `${testID}-label` : undefined}
      >
        {label}
      </Text>
      {hint ? <Body small>{hint}</Body> : null}
      <TextInput
        {...input}
        testID={testID}
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityHint={spoken}
        placeholderTextColor={theme.on('cardMuted').color}
        style={[
          theme.text.body,
          styles.input,
          theme.on('card'),
          error ? { borderColor: theme.color.danger } : null,
        ]}
      />
      {error ? <Notice tone="danger">{error}</Notice> : null}
    </View>
  );
}

export type Tone = 'warning' | 'danger' | 'info' | 'success';

/**
 * A message in a tinted box. Errors and warnings are announced when they appear or change, on
 * iOS and Android alike (A3-02). The announcement replaces the Android-only live region, so
 * TalkBack doesn't say it twice.
 */
export function Notice({
  tone,
  children,
  testID,
}: {
  tone: Tone;
  children: ReactNode;
  testID?: string;
}) {
  const colours = theme.on(tone);
  const urgent = tone === 'danger' || tone === 'warning';
  useAnnounce(urgent && typeof children === 'string' ? children : null);
  return (
    <View
      style={[styles.notice, { backgroundColor: colours.backgroundColor }]}
      accessibilityRole={tone === 'danger' ? 'alert' : undefined}
      testID={testID ?? `notice-${tone}`}
    >
      <Text style={[theme.text.body, { color: colours.color }]}>{children}</Text>
    </View>
  );
}

/**
 * A set of radios with its question: the group role and name tell a screen reader what the
 * choice is and how many options it has (A3-07).
 */
export function RadioGroup(props: {
  label: string;
  children: ReactNode;
  pair?: Pair;
  /** To put the screen reader on the question when its form opens (`focusOn`). */
  ref?: Ref<View>;
}) {
  return (
    <View
      ref={props.ref}
      accessibilityRole="radiogroup"
      accessibilityLabel={props.label}
      style={styles.group}
    >
      <Text style={[theme.text.label, { color: theme.on(props.pair ?? 'page').color }]}>
        {props.label}
      </Text>
      {props.children}
    </View>
  );
}

/**
 * One radio: a ring that turns into a thick brand ring when selected, so the choice shows by
 * shape as well as colour. The unselected ring is `lineStrong`, which NON_TEXT_PAIRS holds to
 * 3:1 on a card and on the page (A2-04).
 */
export function Radio(props: {
  label: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
  pair?: Pair;
  testID?: string;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={props.label}
      accessibilityState={{ checked: props.selected, disabled: Boolean(props.disabled) }}
      disabled={props.disabled}
      onPress={props.onPress}
      testID={props.testID}
      style={[styles.choice, props.disabled ? styles.disabled : null]}
    >
      <View style={[styles.dot, props.selected ? styles.dotOn : null]} />
      <Text
        style={[
          theme.text.body,
          styles.choiceText,
          { color: theme.on(props.pair ?? 'card').color },
        ]}
      >
        {props.label}
      </Text>
    </Pressable>
  );
}

/**
 * A checkbox: a `lineStrong` box that fills with brand when ticked. NON_TEXT_PAIRS holds both to
 * 3:1 on a card, on the page and in a sunk panel (the first-week steps, A3-21).
 */
export function Checkbox(props: {
  label: string;
  checked: boolean;
  onPress: () => void;
  disabled?: boolean;
  /** Why it is disabled, read after the label (a fourth word on the profile card). */
  hint?: string | undefined;
  pair?: Pair;
  testID?: string;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={props.label}
      accessibilityHint={props.hint}
      accessibilityState={{ checked: props.checked, disabled: Boolean(props.disabled) }}
      disabled={props.disabled}
      onPress={props.onPress}
      testID={props.testID}
      style={[styles.choice, props.disabled ? styles.disabled : null]}
    >
      <View style={[styles.box, props.checked ? styles.boxOn : null]} />
      <Text
        style={[
          theme.text.body,
          styles.choiceText,
          { color: theme.on(props.pair ?? 'card').color },
        ]}
      >
        {props.label}
      </Text>
    </Pressable>
  );
}

export function Badge({
  tone = 'sunk',
  children,
  testID,
}: {
  tone?: Pair;
  children: ReactNode;
  testID?: string;
}) {
  const colours = theme.on(tone);
  return (
    <View style={[styles.badge, { backgroundColor: colours.backgroundColor }]} testID={testID}>
      <Text
        style={[theme.text.small, { color: colours.color, fontWeight: theme.fontWeight.medium }]}
      >
        {children}
      </Text>
    </View>
  );
}

/**
 * A link to an official source, opened in the browser (A2-09): the provenance the web shows
 * beside every admission fact (hard rule 3). The visible text stays short; `context` (the course,
 * the timetable) goes into the accessible name, so a list of them can be told apart (WCAG 2.4.4).
 */
export function SourceLink(props: {
  url: string;
  children?: string;
  context?: string;
  pair?: Pair;
}) {
  const text = props.children ?? en.common.officialSource;
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={props.context ? `${text}: ${props.context}` : text}
      onPress={() => void Linking.openURL(props.url).catch(() => undefined)}
      style={styles.link}
    >
      <Text
        style={[
          theme.text.small,
          styles.linkText,
          { color: theme.on(props.pair ?? 'cardBrand').color },
        ]}
      >
        {text}
      </Text>
    </Pressable>
  );
}

/**
 * A big button that dials a number (`tel:`), or texts it (`sms:`), with the printed number made
 * dialable: campus security and clinics, faculty offices, the crisis card's helplines (A2-18).
 * The label defaults to "Call <number>"; `context` (whose number it is) goes into the accessible
 * name, so a list of them can be told apart (WCAG 2.4.4).
 */
export function CallButton(props: {
  phone: string;
  label?: string;
  sms?: boolean;
  context?: string;
}) {
  const label = props.label ?? en.campus.call(props.phone);
  const url = `${props.sms ? 'sms' : 'tel'}:${dialable(props.phone)}`;
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={props.context ? `${label}: ${props.context}` : label}
      onPress={() => void Linking.openURL(url).catch(() => undefined)}
      style={({ pressed }) => [
        styles.call,
        { backgroundColor: pressed ? theme.color.brandHover : theme.color.brand },
      ]}
    >
      <Text style={[theme.text.label, { color: theme.on('primary').color }]}>{label}</Text>
    </Pressable>
  );
}

export function Card(props: {
  children: ReactNode;
  emphasis?: boolean;
  style?: ViewStyle;
  accessibilityLabel?: string;
  testID?: string;
}) {
  return (
    <View
      style={[styles.card, props.emphasis ? styles.cardEmphasis : null, props.style]}
      accessibilityLabel={props.accessibilityLabel}
      testID={props.testID}
    >
      {props.children}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.color.canvas },
  scroll: { flexGrow: 1 },
  content: {
    width: '100%',
    maxWidth: theme.maxWidth,
    alignSelf: 'center',
    padding: theme.space['4'],
    gap: theme.space['4'],
  },
  button: {
    minHeight: theme.target,
    minWidth: theme.target,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.space['4'],
    paddingVertical: theme.space['2'],
    borderRadius: theme.radius.md,
    borderWidth: theme.border.thick,
    borderColor: 'transparent',
  },
  header: { gap: theme.space['2'] },
  buttonText: { textAlign: 'center' },
  disabled: { opacity: 0.6 },
  field: { gap: theme.space['1'] },
  input: {
    minHeight: theme.target,
    borderWidth: theme.border.thin,
    borderColor: theme.color.lineStrong,
    borderRadius: theme.radius.sm,
    paddingHorizontal: theme.space['3'],
    paddingVertical: theme.space['2'],
  },
  notice: { padding: theme.space['3'], borderRadius: theme.radius.sm },
  group: { gap: theme.space['1'] },
  choice: {
    minHeight: theme.target,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space['3'],
  },
  choiceText: { flexShrink: 1 },
  dot: {
    width: theme.space['5'],
    height: theme.space['5'],
    borderRadius: theme.radius.full,
    borderWidth: theme.border.thick,
    borderColor: theme.color.lineStrong,
    backgroundColor: theme.color.surface,
  },
  dotOn: { borderColor: theme.color.brand, borderWidth: theme.space['2'] },
  box: {
    width: theme.space['5'],
    height: theme.space['5'],
    borderRadius: theme.radius.sm,
    borderWidth: theme.border.thick,
    borderColor: theme.color.lineStrong,
    backgroundColor: theme.color.surface,
  },
  boxOn: { borderColor: theme.color.brand, backgroundColor: theme.color.brand },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: theme.space['2'],
    paddingVertical: theme.space['1'],
    borderRadius: theme.radius.sm,
  },
  card: {
    backgroundColor: theme.color.surface,
    borderColor: theme.color.line,
    borderWidth: theme.border.thin,
    borderRadius: theme.radius.md,
    padding: theme.space['4'],
    gap: theme.space['2'],
  },
  cardEmphasis: { borderColor: theme.color.brand, borderWidth: theme.border.thick },
  link: { minHeight: theme.target, justifyContent: 'center', alignSelf: 'flex-start' },
  linkText: { textDecorationLine: 'underline' },
  call: {
    minHeight: theme.target,
    justifyContent: 'center',
    paddingHorizontal: theme.space['4'],
    borderRadius: theme.radius.md,
    alignSelf: 'flex-start',
  },
});
