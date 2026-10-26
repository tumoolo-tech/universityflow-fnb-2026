'use client';

import type { Artifact, TurnEvent } from '@universityflow/agent';
import { chat, results } from '@universityflow/content';
import type { ChatWelcome } from '@universityflow/ui';
import Link from 'next/link';
import { type FormEvent, memo, type RefObject, useEffect, useRef, useState } from 'react';
import { ArtifactView } from '@/components/artifacts';
import { Icon, type IconName } from '@/components/icons';
import { Button, cx } from '@/components/ui';
import { ReplyText } from './reply-text';
import { ReportReply } from './report-reply';

export interface ChatMessage {
  readonly id: string;
  readonly role: 'student' | 'assistant';
  readonly content: string;
  readonly artifacts: ReadonlyArray<Artifact>;
  /** The learner reported this reply (A10-35). */
  readonly reported?: boolean;
}

type StreamEvent =
  | TurnEvent
  | { type: 'done'; crisis: boolean; messageId?: string }
  | { type: 'error' };

/** A message the server stored has its id; one still on its way has a local placeholder. */
const STORED = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Reads the newline-delimited JSON stream from /api/chat. */
async function* readEvents(response: Response): AsyncGenerator<StreamEvent> {
  if (!response.body) return;
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    let newline = buffer.indexOf('\n');
    while (newline >= 0) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (line) yield JSON.parse(line) as StreamEvent;
      newline = buffer.indexOf('\n');
    }
  }
}

/** One icon per starter, in the order content lists them. */
const STARTER_ICONS: ReadonlyArray<IconName> = ['results', 'first-week', 'funding', 'documents'];
/** The same for the university starters (A2-66). */
const UNIVERSITY_STARTER_ICONS: ReadonlyArray<IconName> = ['modules', 'campus', 'funding', 'chat'];

/** The welcome's words by where the learner is (A2-66). */
const WELCOME_LEAD: Readonly<Record<ChatWelcome, string>> = {
  school: chat.welcomeLead,
  arriving: chat.welcomeLeadArriving,
  'later-years': chat.welcomeLeadLaterYears,
};

/** The field grows with what is typed, up to this many lines, then scrolls. */
const MAX_LINES = 6;

/**
 * The chat (docs/design/README.md), laid out like an assistant: a full-height column whose
 * conversation scrolls on its own while the composer stays docked under it, so the composer never
 * covers a message or a focused control (WCAG 2.4.11). The empty conversation is a hero with the
 * learner's name and four starter cards. The API, the stream and the crisis flow are unchanged.
 */
export function Chat(props: {
  initial: ChatMessage[];
  /** What the learner asked to be called, or null. */
  name: string | null;
  hasReport: boolean;
  sample: boolean;
  /** The line under the composer in place of `chat.disclaimer`: Gemini's while it answers (AI-01). */
  disclaimer?: string;
  /** Where the learner is (packages/ui `chatWelcome`); school when not given. */
  welcome?: ChatWelcome;
}) {
  const welcome = props.welcome ?? 'school';
  const school = welcome === 'school';
  // At university a school report means nothing: their own welcome and starters (A2-66).
  const lead = WELCOME_LEAD[welcome];
  const starters = school ? chat.starters : chat.startersUniversity;
  const notes = school ? chat.starterNotes : chat.starterNotesUniversity;
  const icons = school ? STARTER_ICONS : UNIVERSITY_STARTER_ICONS;
  const [messages, setMessages] = useState<ChatMessage[]>(props.initial);
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<HTMLTextAreaElement>(null);

  // The newest message into view; an empty conversation stays at its top (the hero).
  useEffect(() => {
    if (messages.length > 0) endRef.current?.scrollIntoView?.({ block: 'end' });
  }, [messages]);

  /** Sends a question; false when there is nothing to send or a reply is still coming. */
  function send(text: string): boolean {
    const message = text.trim();
    if (!message || busy) return false;
    void ask(message);
    return true;
  }

  async function ask(message: string) {
    setBusy(true);
    // Focus goes to the field for the next question, never back to the top of the page: a
    // starter unmounts once the conversation starts, and Send is busy while the reply streams
    // (A3-25, WCAG 2.4.3).
    fieldRef.current?.focus();
    const replyId = `reply-${Date.now()}`;
    setMessages((m) => [
      ...m,
      { id: `me-${Date.now()}`, role: 'student', content: message, artifacts: [] },
      { id: replyId, role: 'assistant', content: '', artifacts: [] },
    ]);
    const update = (fn: (m: ChatMessage) => ChatMessage) =>
      setMessages((list) => list.map((m) => (m.id === replyId ? fn(m) : m)));
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message }),
      });
      if (!response.ok) throw new Error('chat');
      for await (const event of readEvents(response)) {
        if (event.type === 'text') update((m) => ({ ...m, content: m.content + event.delta }));
        else if (event.type === 'artifact') {
          update((m) => ({ ...m, artifacts: [...m.artifacts, event.artifact] }));
        } else if (event.type === 'done' && event.messageId) {
          // The stored reply's id: from now on it can be reported (A10-35).
          const stored = event.messageId;
          update((m) => ({ ...m, id: stored }));
        } else if (event.type === 'error') throw new Error('chat');
      }
    } catch {
      update((m) => ({ ...m, content: m.content || chat.error }));
    } finally {
      setBusy(false);
    }
  }

  const empty = messages.length === 0;

  return (
    <div className="uf-chat mx-auto flex w-full max-w-chat flex-1 flex-col">
      <h1 className="sr-only">{chat.title}</h1>
      {/* The conversation scrolls here; a keyboard can scroll it too (it is focusable). */}
      <section
        aria-label={chat.conversation}
        // biome-ignore lint/a11y/noNoninteractiveTabindex: a scrolling region must be reachable by keyboard (WCAG 2.1.1)
        tabIndex={0}
        className="uf-chat-scroll flex-1 overflow-y-auto rounded-md"
      >
        {empty ? (
          <div className="flex flex-col gap-6 py-6 sm:py-10">
            <div className="flex flex-col gap-2">
              <h2 className="text-3xl">
                {props.name ? (
                  <>
                    {chat.heroHi} <span className="text-accent">{props.name}</span>!
                  </>
                ) : (
                  `${chat.heroHi}!`
                )}
              </h2>
              <p className="text-xl text-muted">{chat.heroAsk}</p>
            </div>
            <div className="flex flex-col gap-1">
              <p>{lead}</p>
              {school && !props.hasReport ? (
                <Link href="/documents" className="inline-flex min-h-11 items-center self-start">
                  {results.addReport}
                </Link>
              ) : null}
            </div>
            <ul className="grid gap-3 sm:grid-cols-2" aria-label={chat.startersLabel}>
              {starters.map((question, i) => (
                <li key={question}>
                  <button
                    type="button"
                    onClick={() => send(question)}
                    aria-disabled={busy}
                    className="uf-starter flex h-full w-full cursor-pointer flex-col items-start gap-1 rounded-lg border border-line bg-surface p-4 text-left hover:border-line-strong aria-disabled:cursor-not-allowed aria-disabled:opacity-60"
                  >
                    <Icon name={icons[i] ?? 'chat'} className="mb-1 size-5 text-accent" />
                    <span className="font-medium">{question}</span>
                    <span className="text-sm text-muted">{notes[i]}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <MessageList messages={messages} busy={busy} />
        <div ref={endRef} />
      </section>

      <Composer
        busy={busy}
        line={props.sample ? chat.sampleLine : (props.disclaimer ?? chat.disclaimer)}
        fieldRef={fieldRef}
        onSend={send}
      />
    </div>
  );
}

/**
 * The conversation, apart from the composer (A4-16): typing changes only the composer's own state,
 * so a long conversation isn't drawn again on every key. Memoised, so a parent's render with the
 * same messages skips it too.
 */
const MessageList = memo(function MessageList({
  messages,
  busy,
}: {
  messages: ReadonlyArray<ChatMessage>;
  busy: boolean;
}) {
  return (
    <ol className="flex flex-col gap-6 py-4" aria-live="polite" aria-relevant="additions text">
      {messages.map((m) => (
        <li
          key={m.id}
          className={cx(
            'flex flex-col gap-3',
            m.role === 'student' ? 'items-end' : 'items-stretch',
          )}
        >
          <p className="sr-only">{m.role === 'student' ? chat.you : chat.assistant}</p>
          {m.role === 'student' ? (
            <div className="uf-bubble max-w-[85%] whitespace-pre-wrap rounded-lg px-4 py-2.5">
              {m.content}
            </div>
          ) : (
            <div className="flex gap-3">
              <span
                aria-hidden="true"
                className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-accent"
              >
                <Icon name="chat" className="size-4" />
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-3">
                {m.content ? (
                  <ReplyText text={m.content} />
                ) : busy ? (
                  <p className="flex items-center gap-2 text-muted" role="status">
                    <span aria-hidden="true" className="uf-typing">
                      <span />
                      <span />
                      <span />
                    </span>
                    {chat.sending}
                  </p>
                ) : null}
                {m.artifacts.map((artifact, i) => (
                  // Artifacts are append-only within a message, so the index is stable.
                  // biome-ignore lint/suspicious/noArrayIndexKey: see above
                  <ArtifactView key={`${m.id}-${artifact.kind}-${i}`} artifact={artifact} />
                ))}
                {m.content && STORED.test(m.id) ? (
                  <ReportReply messageId={m.id} reported={m.reported === true} />
                ) : null}
              </div>
            </div>
          )}
        </li>
      ))}
    </ol>
  );
});

/**
 * The composer, docked under the conversation (not over it): the list scrolls, this stays in view.
 * It holds the draft itself (A4-16), so a keystroke renders this alone. `onSend` answers whether
 * the question went; only then is the field emptied.
 */
function Composer({
  busy,
  line,
  fieldRef,
  onSend,
}: {
  busy: boolean;
  /** Under the field: the disclaimer, or the preview's "no AI is connected". */
  line: string;
  fieldRef: RefObject<HTMLTextAreaElement | null>;
  onSend: (text: string) => boolean;
}) {
  const [draft, setDraft] = useState('');

  // The field grows with its text, up to MAX_LINES (then it scrolls).
  useEffect(() => {
    const el = fieldRef.current;
    if (!el) return;
    el.style.height = 'auto';
    if (!draft) return;
    const line = Number.parseFloat(getComputedStyle(el).lineHeight) || 24;
    el.style.height = `${Math.min(el.scrollHeight, line * MAX_LINES)}px`;
  }, [draft, fieldRef]);

  function submit() {
    if (onSend(draft)) setDraft('');
  }

  return (
    <form
      onSubmit={(event: FormEvent) => {
        event.preventDefault();
        submit();
      }}
      className="shrink-0 pt-2 pb-1"
    >
      <label htmlFor="chat-input" className="sr-only">
        {chat.placeholder}
      </label>
      <div
        data-testid="composer"
        className="flex items-end gap-2 rounded-lg border-thick border-line-strong bg-surface p-2 focus-within:outline-3 focus-within:outline-focus focus-within:outline-offset-2"
      >
        <textarea
          id="chat-input"
          ref={fieldRef}
          rows={1}
          value={draft}
          maxLength={2000}
          placeholder={chat.placeholder}
          className="uf-composer-field min-h-11 flex-1 resize-none bg-transparent px-2 py-2.5 leading-normal outline-none placeholder:text-muted"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
        />
        <Button
          type="submit"
          aria-label={busy ? chat.sending : chat.send}
          title={chat.send}
          // Never `disabled`: that drops keyboard focus to the page (A3-25, as A3-01); `onSend`
          // ignores a press with nothing typed or while a reply streams.
          aria-disabled={busy || !draft.trim()}
          className="size-11 shrink-0 px-0!"
        >
          <Icon name="arrow" className="size-5" />
        </Button>
      </div>
      <p className="mt-1.5 text-center text-sm text-muted">{line}</p>
    </form>
  );
}
