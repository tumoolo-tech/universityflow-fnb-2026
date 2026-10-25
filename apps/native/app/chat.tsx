import { en } from '@universityflow/content/app';
import { tokens } from '@universityflow/tokens';
import type { Artifact, ChatWelcome } from '@universityflow/ui';
import { Stack, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArtifactCard } from '../components/artifact-card';
import { ReportReply } from '../components/report-reply';
import { Body, Button, Notice } from '../components/ui';
import { api, errorMessage, streamChat } from '../lib/api';
import { theme } from '../lib/theme';
import type { ChatHistory, ChatMessage, Me } from '../lib/types';

/**
 * The chat: the conversation so far, then each reply streamed in as it is written. A crisis
 * reply (the deterministic protocol in packages/agent answers before any model) is shown
 * prominently with its helplines. The composer sits below the list, never over it (WCAG 2.4.11).
 * Nothing animates: scrolling to the newest message jumps.
 *
 * Laid out as the web's (docs/design/README.md §2b): an empty conversation is a hero ("Hi
 * Lerato!", the name in the accent) with the four starters as cards; the companion's messages are
 * plain text beside a small mark, the learner's a mauve-tinted bubble; the send button sits
 * inside the field; the line under it says "no AI connected" in a preview, else the disclaimer.
 */

interface Message extends ChatMessage {
  readonly pending?: boolean;
}

let sequence = 0;
const localId = (prefix: string) => `${prefix}-${Date.now()}-${sequence++}`;

export default function ChatScreen() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [sample, setSample] = useState(false);
  const [welcome, setWelcome] = useState<ChatWelcome>('school');
  const [name, setName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const scroll = useRef<ScrollView>(null);

  const load = useCallback(async () => {
    setError(null);
    // The hero's name: nice to have, so a failure here only drops it.
    void api<Me>('/api/me')
      .then((me) => setName(me.profile?.displayName?.trim() || null))
      .catch(() => undefined);
    try {
      const history = await api<ChatHistory>('/api/chat');
      setSample(history.sample);
      // Where the learner is (A2-66); an older server says nothing: the school welcome.
      setWelcome(history.welcome ?? 'school');
      setMessages([...history.messages]);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function send(text: string) {
    const message = text.trim();
    if (!message || busy) return;
    setBusy(true);
    setDraft('');
    // A local id until the server names the stored reply (`done`), then that one.
    let replyId = localId('reply');
    const blank = { artifacts: [] as Artifact[], crisis: false };
    setMessages((list) => [
      ...(list ?? []),
      { id: localId('me'), role: 'student', content: message, ...blank },
      { id: replyId, role: 'assistant', content: '', ...blank, pending: true },
    ]);
    const update = (fn: (m: Message) => Message) =>
      setMessages((list) => (list ?? []).map((m) => (m.id === replyId ? fn(m) : m)));

    let finalText = '';
    let failed = false;
    try {
      await streamChat(message, (event) => {
        if (event.type === 'text') {
          finalText += event.delta;
          update((m) => ({ ...m, content: m.content + event.delta }));
        } else if (event.type === 'artifact') {
          update((m) => ({ ...m, artifacts: [...m.artifacts, event.artifact] }));
        } else if (event.type === 'done') {
          // The stored reply's id: from now on it can be reported (A10-35). The swap names the
          // local id it replaces, since React may run it after `replyId` has moved on.
          const from = replyId;
          const stored = event.messageId ?? from;
          setMessages((list) =>
            (list ?? []).map((m) =>
              m.id === from ? { ...m, id: stored, crisis: event.crisis, pending: false } : m,
            ),
          );
          replyId = stored;
        } else {
          failed = true;
        }
      });
    } catch (e) {
      failed = true;
      if (!finalText) {
        const sentence = errorMessage(e);
        finalText = sentence === en.errors.generic ? en.chat.error : sentence;
      }
    }
    if (failed && !finalText) finalText = en.chat.error;
    update((m) => ({ ...m, content: m.content || finalText, pending: false }));
    // The reply arrived in pieces; a screen reader hears it once, whole.
    AccessibilityInfo.announceForAccessibility(finalText);
    setBusy(false);
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom', 'left', 'right']}>
      <Stack.Screen options={{ headerShown: false, title: en.chat.title }} />
      <View style={styles.bar}>
        <Button label={en.common.back} variant="quiet" onPress={() => router.back()} />
        <Text accessibilityRole="header" style={[theme.text.heading, { color: theme.color.ink }]}>
          {en.chat.title}
        </Text>
      </View>
      <KeyboardAvoidingView behavior="padding" style={styles.flex}>
        <ScrollView
          ref={scroll}
          style={styles.flex}
          contentContainerStyle={styles.list}
          onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: false })}
          keyboardShouldPersistTaps="handled"
        >
          {error ? (
            <>
              <Notice tone="danger">{error}</Notice>
              <Button label={en.common.tryAgain} onPress={() => void load()} />
            </>
          ) : null}
          {messages === null && !error ? <Body>{en.common.loading}</Body> : null}
          {messages?.length === 0 ? (
            <Welcome name={name} welcome={welcome} busy={busy} onStarter={(s) => void send(s)} />
          ) : null}
          {messages?.map((m) => (
            <MessageView key={m.id} message={m} />
          ))}
        </ScrollView>
        <View style={styles.composerWrap}>
          {/* One rounded field with the send button inside it. */}
          <View style={styles.composer} testID="composer">
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder={en.chat.placeholder}
              placeholderTextColor={theme.on('cardMuted').color}
              accessibilityLabel={en.chat.placeholder}
              multiline
              maxLength={2000}
              editable={messages !== null}
              style={[theme.text.body, styles.input, { color: theme.color.ink }]}
              testID="chat-input"
            />
            <Button
              label={en.chat.send}
              busy={busy}
              busyLabel={en.chat.sending}
              disabled={!draft.trim() || messages === null}
              onPress={() => void send(draft)}
            />
          </View>
        </View>
        <View style={styles.disclaimer}>
          <Body small pair="pageMuted" testID="chat-line">
            {sample ? en.chat.sampleLine : en.chat.disclaimer}
          </Body>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/** The empty conversation: the hero, the companion's welcome, and the starters as cards. */
/** The welcome's words by where the learner is (A2-66), as on the web. */
const WELCOME_LEAD: Readonly<Record<ChatWelcome, string>> = {
  school: en.chat.welcomeLead,
  arriving: en.chat.welcomeLeadArriving,
  'later-years': en.chat.welcomeLeadLaterYears,
};

function Welcome(props: {
  name: string | null;
  welcome: ChatWelcome;
  busy: boolean;
  onStarter: (s: string) => void;
}) {
  // At university a school report means nothing: their own welcome and starters (A2-66).
  const school = props.welcome === 'school';
  const starters = school ? en.chat.starters : en.chat.startersUniversity;
  const notes = school ? en.chat.starterNotes : en.chat.starterNotesUniversity;
  return (
    <View style={styles.welcome}>
      <Text accessibilityRole="header" style={[theme.text.title, { color: theme.color.ink }]}>
        {props.name ? (
          <>
            {`${en.chat.heroHi} `}
            <Text style={{ color: theme.on('pageAccent').color }}>{props.name}</Text>!
          </>
        ) : (
          `${en.chat.heroHi}!`
        )}
      </Text>
      <Body strong>{en.chat.heroAsk}</Body>
      <Body pair="pageMuted">{WELCOME_LEAD[props.welcome]}</Body>
      <View style={styles.starters}>
        {starters.map((question, i) => (
          <Pressable
            key={question}
            accessibilityRole="button"
            accessibilityLabel={question}
            accessibilityHint={notes[i]}
            accessibilityState={{ disabled: props.busy }}
            disabled={props.busy}
            onPress={() => props.onStarter(question)}
            style={({ pressed }) => [styles.starter, pressed ? styles.pressed : null]}
          >
            <Text style={[theme.text.bodyStrong, { color: theme.color.ink }]}>{question}</Text>
            <Text style={[theme.text.small, { color: theme.on('cardMuted').color }]}>
              {notes[i]}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function MessageView({ message }: { message: Message }) {
  const mine = message.role === 'student';
  const label = `${mine ? en.chat.you : en.chat.assistant}: ${message.content}`;
  return (
    <View
      style={[styles.message, mine ? styles.mine : null]}
      testID={message.crisis ? 'crisis-reply' : undefined}
    >
      {message.content && message.crisis ? (
        // A crisis reply stays a bordered card with its heading: never easy to miss. Not grouped
        // (A3-28): a grouped label would hide the heading from screen readers and their heading
        // navigation, so the heading and the reply are read as two items.
        <View style={[styles.crisis, theme.on('card')]}>
          <Text accessibilityRole="header" style={[theme.text.heading, { color: theme.color.ink }]}>
            {en.crisis.cardTitle}
          </Text>
          <Text accessibilityLabel={label} style={[theme.text.body, { color: theme.color.ink }]}>
            {message.content}
          </Text>
        </View>
      ) : message.content && mine ? (
        <View accessible accessibilityLabel={label} style={styles.bubble}>
          <Text style={[theme.text.body, { color: theme.color.ink }]}>{message.content}</Text>
        </View>
      ) : message.content ? (
        <View accessible accessibilityLabel={label} style={styles.companion}>
          {/* The companion's mark: decoration. */}
          <View style={styles.mark} />
          <Text style={[theme.text.body, styles.grow, { color: theme.color.ink }]}>
            {message.content}
          </Text>
        </View>
      ) : message.pending ? (
        <Body pair="pageMuted">{en.chat.sending}</Body>
      ) : null}
      {message.artifacts.map((artifact, i) => (
        // Artifacts are append-only within a message, so the index is stable.
        // biome-ignore lint/suspicious/noArrayIndexKey: see above
        <ArtifactCard key={`${message.id}-${artifact.kind}-${i}`} artifact={artifact} />
      ))}
      {!mine && message.content && !message.pending && STORED.test(message.id) ? (
        <ReportReply messageId={message.id} reported={message.reported === true} />
      ) : null}
    </View>
  );
}

/** A message the server stored has its id; one still on its way has a local one. */
const STORED = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.color.canvas },
  flex: { flex: 1 },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space['2'],
    paddingHorizontal: theme.space['2'],
    borderBottomWidth: theme.border.thin,
    borderBottomColor: theme.color.line,
  },
  grow: { flex: 1 },
  pressed: { opacity: 0.8 },
  list: { padding: theme.space['4'], gap: theme.space['4'] },
  welcome: { gap: theme.space['2'] },
  starters: { gap: theme.space['2'], marginTop: theme.space['2'] },
  starter: {
    minHeight: theme.target,
    gap: theme.space['1'],
    padding: theme.space['3'],
    borderRadius: theme.radius.md,
    borderWidth: theme.border.thin,
    borderColor: theme.color.line,
    backgroundColor: theme.color.surface,
  },
  message: { gap: theme.space['2'], alignItems: 'stretch' },
  mine: { alignItems: 'flex-end' },
  /** The learner's message: ink on the mauve tint (GLASS_PAIRS: ink on pill over the canvas). */
  bubble: {
    maxWidth: '90%',
    borderRadius: theme.radius.lg,
    paddingHorizontal: theme.space['4'],
    paddingVertical: theme.space['2'],
    backgroundColor: tokens.glass.pill,
  },
  companion: { flexDirection: 'row', alignItems: 'flex-start', gap: theme.space['3'] },
  mark: {
    width: theme.space['3'],
    height: theme.space['3'],
    marginTop: theme.space['2'],
    borderRadius: theme.radius.full,
    backgroundColor: theme.color.brand,
  },
  crisis: {
    gap: theme.space['2'],
    borderRadius: theme.radius.lg,
    paddingHorizontal: theme.space['4'],
    paddingVertical: theme.space['3'],
    borderWidth: theme.border.thick,
    borderColor: theme.color.brand,
  },
  composerWrap: { paddingHorizontal: theme.space['4'], paddingTop: theme.space['2'] },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: theme.space['2'],
    padding: theme.space['2'],
    borderRadius: theme.radius.lg,
    borderWidth: theme.border.thick,
    borderColor: theme.color.lineStrong,
    backgroundColor: theme.color.surface,
  },
  disclaimer: { paddingHorizontal: theme.space['4'], paddingVertical: theme.space['2'] },
  input: {
    flex: 1,
    minHeight: theme.target,
    maxHeight: theme.space['8'] * 2,
    paddingHorizontal: theme.space['2'],
    paddingVertical: theme.space['2'],
  },
});
