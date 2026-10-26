/**
 * `en.geminiNotice`: while Google's Gemini answers the chat (finding AI-01). Production refuses
 * Gemini, so only a demo or a local preview shows these. The owner put the judge demo's chat on
 * Gemini until 2026-11-08 (2026-10-24); the words go when the key does
 * (docs/deploy/hackathon-undo-pr.md, K). `first`: Gemini is asked first or alone; `fallback`:
 * only when Anthropic can't answer. Reading uploads stays with Anthropic either way.
 */
export const geminiNotice = {
  /** Under the composer, in place of `chat.disclaimer` (which it keeps: an AI, it can err). */
  chat: {
    first:
      'You’re chatting with an AI, not a person: on this demo, Google’s Gemini. It can make mistakes. Admission facts come from each university’s official documents.',
    fallback:
      'You’re chatting with an AI, not a person: on this demo, Anthropic’s Claude, or Google’s Gemini when Claude can’t answer. It can make mistakes. Admission facts come from each university’s official documents.',
  },
  /** One more operator on /privacy, after Anthropic. */
  operator: {
    id: 'gemini',
    name: 'Google (Gemini), on this demo only',
    does: {
      first: 'For now, the AI that chats with you on this demo. It does not read your uploads.',
      fallback:
        'For now, on this demo, answers your chat when Anthropic can’t. It does not read your uploads.',
    },
    gets: 'Your chat messages, under Google’s terms for the Gemini API.',
    where: 'Outside South Africa.',
  },
  /** Added to "Information sent outside South Africa". */
  crossBorder: {
    first:
      'On this demo, for now, your chat messages go to Google’s Gemini, outside South Africa, instead of Anthropic. Your uploads are not sent to Google.',
    fallback:
      'On this demo, for now, your chat messages go to Google’s Gemini, outside South Africa, when Anthropic can’t answer. Your uploads are not sent to Google.',
  },
} as const;
