/**
 * The messages UniversityFlow starts by SMS, WhatsApp or push (planning.md §7), as a typed
 * registry of templates. Every outbound message is one of these (hard rule 8): a channel is given
 * a template id and its variables, never free text of our own.
 *
 * Rules every template keeps, each tested in messages.test.ts:
 * - **No admission facts** (hard rule 2). No requirement, deadline, date, fee or score is ever
 *   written into a template: a template has no digits at all. A fact a message needs would be a
 *   variable filled by code from `packages/catalogue` or `packages/admissions`.
 * - **Nothing personal in any message** (hard rule 4; audits A11-02, A12-13). An SMS or a
 *   WhatsApp message shows on a lock screen just like a push notification, and it is handed to
 *   the SMS provider or to Meta on the way. So no channel's text carries the learner's name, a
 *   university, a subject or a mark: every text is fixed, and the detail waits inside the app,
 *   which the message points to. The learner's name is not even a variable any more.
 * - **The learner's own reminder, or a specific event on their account** (audit A12-09). Every
 *   WhatsApp body says which ("this is the study reminder you asked for", "the new report you
 *   added"), so Meta files it as **utility**, never marketing (§7.3, about 12× the cost). Meta
 *   can still recategorise a template; the category it bills is recorded per message
 *   (`WhatsAppCategory`, reminders.billed_category).
 * - **How to stop** (audit A12-10). Every SMS ends "Reply STOP to stop."; every WhatsApp template
 *   has a "Stop" quick-reply button, which arrives as the word STOP.
 * - Short enough for one push notification, and for an SMS in the segments it states (GSM-7).
 *
 * **Reviewed wording.** The SMS and WhatsApp bodies were rewritten for A11-02, A12-09 and A12-10
 * (2026-10-14): they need the owner's review, and each WhatsApp template's re-submission to Meta
 * (body and button) before a live WhatsApp adapter sends it.
 *
 * Plain strings and string functions only: this package runs under React Native (hard rule 11).
 */

export const MESSAGE_CHANNELS = ['sms', 'whatsapp', 'push'] as const;
export type MessageChannelName = (typeof MESSAGE_CHANNELS)[number];

/**
 * The variables a template may take: the catalogue entry a reminder is **about**, and nothing
 * else. They are checked on every channel (so a reminder about a university that is no longer
 * verified is dropped, hard rule 3), but **no channel's text shows them** (A11-02): the app does.
 * - `universityName`: a university's name, from the verified catalogue.
 * - `subjectName`: an NSC subject's name, from the catalogue's subject list.
 *
 * There is no `firstName`: a message that greets the learner by name puts it on the lock screen
 * and hands it to the provider, for no purpose a reminder needs.
 */
export const TEMPLATE_VARIABLES = ['universityName', 'subjectName'] as const;
export type TemplateVariable = (typeof TEMPLATE_VARIABLES)[number];

/** How long each variable may be once filled. */
export const TEMPLATE_VARIABLE_MAX_LENGTH: Readonly<Record<TemplateVariable, number>> = {
  universityName: 80,
  subjectName: 60,
};

/**
 * Meta's billing category for a WhatsApp template (§7.3, §7.4). We submit every template as
 * `utility`; Meta may recategorise one as `marketing` (A12-09), and its status reports say which
 * it billed, so both can be recorded.
 */
export const WHATSAPP_CATEGORIES = ['utility', 'marketing'] as const;
export type WhatsAppCategory = (typeof WHATSAPP_CATEGORIES)[number];

export function isWhatsAppCategory(value: unknown): value is WhatsAppCategory {
  return typeof value === 'string' && (WHATSAPP_CATEGORIES as readonly string[]).includes(value);
}

/**
 * The app screens a tapped notification may open (Phase 4d). The app maps each to a route of its
 * own and ignores anything else, so a notification can never carry a link of its own.
 */
export const APP_SCREENS = [
  'home',
  'results',
  'goals',
  'offers',
  'campus',
  'first-week',
  'modules',
] as const;
export type AppScreen = (typeof APP_SCREENS)[number];

export interface MessageTemplate {
  readonly id: string;
  /** The channels the template may go out on. */
  readonly channels: ReadonlyArray<MessageChannelName>;
  /** The category we submit the WhatsApp version as (§7.3, §7.4): always `utility`. */
  readonly whatsappCategory: 'utility';
  /** The catalogue entries the message is about: checked, never shown (A11-02). */
  readonly variables: ReadonlyArray<TemplateVariable>;
  /**
   * The SMS and WhatsApp text: fixed, with no placeholders, nothing personal (A11-02, A12-13).
   * On WhatsApp it names the learner's own reminder or the account event (A12-09). An SMS adds
   * `messageText.smsStop` after it (A12-10).
   */
  readonly body: string;
  /**
   * The quick-reply buttons of the WhatsApp template, as submitted to Meta (A12-10): "Stop",
   * which comes back as a message with that text and is heard as STOP.
   */
  readonly whatsappQuickReplies: ReadonlyArray<string>;
  /** The SMS segments the message is billed as, GSM-7, "Reply STOP to stop." included. */
  readonly smsSegments: 1 | 2 | 3;
  /**
   * What a push notification says instead (Phase 4d): **no variables at all**. A notification
   * shows on a lock screen that anyone holding the phone can read, and it passes through Expo
   * and Apple or Google on the way (docs/audits/A11-privacy-popia.md), so it carries no name, no
   * university, no subject and no mark (hard rule 4). The detail waits inside the app.
   */
  readonly pushBody: string;
  /** The app screen a tapped notification opens. */
  readonly opens: AppScreen;
  /** May a learner ask for this one themselves (a reminder they set)? */
  readonly learnerSchedulable: boolean;
}

const ALL: ReadonlyArray<MessageChannelName> = MESSAGE_CHANNELS;

/** The WhatsApp quick-reply button that opts out (A12-10). STOP matching hears it as STOP. */
const WHATSAPP_STOP_BUTTON = 'Stop';
const STOP_BUTTONS: ReadonlyArray<string> = [WHATSAPP_STOP_BUTTON];

export const MESSAGE_TEMPLATES = {
  /** A check-in the learner set for themselves. */
  'reminder.check-in': {
    id: 'reminder.check-in',
    channels: ALL,
    whatsappCategory: 'utility',
    variables: [],
    body: 'UniversityFlow: this is the check-in reminder you set. Open the app to see your next step.',
    whatsappQuickReplies: STOP_BUTTONS,
    smsSegments: 1,
    pushBody: 'Your plan has a next step waiting. Tap to see it.',
    opens: 'home',
    learnerSchedulable: true,
  },
  /** A study reminder the learner set, about one subject (named in the app, never here). */
  'reminder.study': {
    id: 'reminder.study',
    channels: ALL,
    whatsappCategory: 'utility',
    variables: ['subjectName'],
    body: 'UniversityFlow: this is the study reminder you asked for. Time for a little practice today. You’ve got this.',
    whatsappQuickReplies: STOP_BUTTONS,
    smsSegments: 1,
    pushBody: 'This is the study reminder you asked for: a little practice today. You’ve got this.',
    opens: 'goals',
    learnerSchedulable: true,
  },
  /** About an application the learner added to their list (the university is named in the app). */
  'reminder.application': {
    id: 'reminder.application',
    channels: ALL,
    whatsappCategory: 'utility',
    variables: ['universityName'],
    body: 'UniversityFlow: an application you added to your list still has something to do. Open the app to see what’s left.',
    whatsappQuickReplies: STOP_BUTTONS,
    smsSegments: 1,
    pushBody: 'An application on your list has something left to do. Tap to see it.',
    opens: 'home',
    learnerSchedulable: false,
  },
  /**
   * After a new Grade 12 report the learner added changes which courses they qualify for (Phase
   * 4c). It only says there is an update: the courses and the numbers stay in the app.
   */
  'recheck.changed': {
    id: 'recheck.changed',
    channels: ALL,
    whatsappCategory: 'utility',
    variables: [],
    body: 'UniversityFlow: we checked your courses again with the new report you added, and something changed. Open the app to see what’s new.',
    whatsappQuickReplies: STOP_BUTTONS,
    smsSegments: 1,
    pushBody: 'We checked your courses again with your new report. Tap to see what’s new.',
    opens: 'results',
    learnerSchedulable: false,
  },
  /**
   * Before the date to reply by on an offer the learner added (Phase 5a). It says only that a
   * place they added needs an answer soon: never the university, the programme, the kind of offer
   * or the date (A11-02); those wait in the app. Cancelled once the learner accepts, declines or
   * deletes the offer. **Draft wording: owed the owner's review, and Meta's approval as utility.**
   */
  'offer.reply-by': {
    id: 'offer.reply-by',
    channels: ALL,
    whatsappCategory: 'utility',
    variables: ['universityName'],
    body: 'UniversityFlow: a university place you added needs your answer soon. Open the app to see the date to reply by.',
    whatsappQuickReplies: STOP_BUTTONS,
    smsSegments: 1,
    pushBody: 'A university place on your list needs your answer soon. Tap to see the date.',
    opens: 'offers',
    learnerSchedulable: false,
  },
  /**
   * Before first-year registration at the university of the offer the learner accepted (Phase
   * 5d, A1-33): due a few days before registration opens, or before it closes when only the close
   * is published. It says only that it is nearly time to register: never the university, the
   * course, the kind of offer or the date (A11-02, hard rule 2); the dates wait in the first-week
   * checklist. On the learner's first opted-in channel, like `offer.reply-by` (owner's decision,
   * 2026-10-17). Dropped once the offer is declined or deleted. **Draft wording: owed the owner's
   * review, and Meta's approval as utility.**
   */
  'offer.registration-day': {
    id: 'offer.registration-day',
    channels: ALL,
    whatsappCategory: 'utility',
    variables: ['universityName'],
    body: 'UniversityFlow: it is nearly time to register for the university place you added. Open the app to see the dates.',
    whatsappQuickReplies: STOP_BUTTONS,
    smsSegments: 1,
    pushBody: 'It’s nearly time to register for your university place. Tap to see the dates.',
    opens: 'first-week',
    learnerSchedulable: false,
  },
  /**
   * Safety and scam guidance (planning.md §8.6, Phase 5b), sent once the learner accepts an offer:
   * **push only** (owner's decision 4: safety tips never go by SMS or WhatsApp, which cost money
   * and which Meta may class as marketing). It points to "Before you arrive" in the app; the tips
   * themselves are in `en.safety`. `body` exists because every template has one; no SMS or
   * WhatsApp ever sends it. **Draft wording: owed the owner's review.**
   */
  'safety.offer-accepted': {
    id: 'safety.offer-accepted',
    channels: ['push'],
    whatsappCategory: 'utility',
    variables: [],
    body: 'UniversityFlow: for the university place you added, a few ways to keep your money and accounts safe before you arrive. Open the app to read them.',
    whatsappQuickReplies: STOP_BUTTONS,
    smsSegments: 1,
    pushBody:
      'Before you arrive: a few ways to keep your money and accounts safe. Tap to read them.',
    opens: 'campus',
    learnerSchedulable: false,
  },
  /**
   * In the middle of January, when accommodation deposit scams peak (§8.6): push only, like
   * `safety.offer-accepted`. **Draft wording: owed the owner's review.**
   */
  'safety.move-in': {
    id: 'safety.move-in',
    channels: ['push'],
    whatsappCategory: 'utility',
    variables: [],
    body: 'UniversityFlow: for the university place you added, a reminder to check any room or flat before you pay a deposit. Open the app to read more.',
    whatsappQuickReplies: STOP_BUTTONS,
    smsSegments: 1,
    pushBody:
      'Looking for a room? Fake listings are common now. Never pay a deposit before you’ve checked. Tap to read more.',
    opens: 'first-week',
    learnerSchedulable: false,
  },
  /**
   * Before the last day to change a registration the learner checked, while the check still finds
   * something to fix (Phase 5c). It says only that the registration they checked needs a change:
   * never the university, the course, a module or the date (A11-02); those wait in the app.
   * Dropped once the learner confirms a registration again or removes it. **Draft wording: owed
   * the owner's review, and Meta's approval as utility.**
   */
  'registration.change-deadline': {
    id: 'registration.change-deadline',
    channels: ALL,
    whatsappCategory: 'utility',
    variables: ['universityName'],
    body: 'UniversityFlow: the registration you added still needs a change, and the last day to make it is close. Open the app to see what to fix.',
    whatsappQuickReplies: STOP_BUTTONS,
    smsSegments: 1,
    pushBody: 'Your registration still needs a change before the last day. Tap to see what to fix.',
    opens: 'modules',
    learnerSchedulable: false,
  },
} as const satisfies Record<string, MessageTemplate>;

export type MessageTemplateId = keyof typeof MESSAGE_TEMPLATES;

export const MESSAGE_TEMPLATE_IDS = Object.keys(MESSAGE_TEMPLATES) as MessageTemplateId[];

export type TemplateVariables = Partial<Readonly<Record<TemplateVariable, string>>>;

export function isMessageTemplateId(value: unknown): value is MessageTemplateId {
  return typeof value === 'string' && Object.hasOwn(MESSAGE_TEMPLATES, value);
}

export function messageTemplate(id: MessageTemplateId): MessageTemplate {
  return MESSAGE_TEMPLATES[id];
}

export class InvalidTemplateError extends Error {
  override readonly name = 'InvalidTemplateError';
}

/**
 * A template's text on `channel`. Refuses an unknown template, a variable the template doesn't
 * declare, a missing one, and a value that is too long or spans lines, on every channel alike.
 * Errors name the variable, never its value.
 *
 * The variables are checked, never shown (A11-02): every channel's text is fixed. SMS and
 * WhatsApp send `body` (an SMS with "Reply STOP to stop." after it, A12-10; WhatsApp's "Stop" is
 * a button on the template); push sends `pushBody`. With no channel, the plain `body`.
 */
export function renderMessage(
  id: MessageTemplateId,
  variables: TemplateVariables,
  channel?: MessageChannelName,
): string {
  const template = checkVariables(id, variables);
  if (channel === 'push') return template.pushBody;
  if (channel === 'sms') return `${template.body} ${messageText.smsStop}`;
  return template.body;
}

function checkVariables(id: MessageTemplateId, variables: TemplateVariables): MessageTemplate {
  if (!isMessageTemplateId(id)) throw new InvalidTemplateError('Unknown message template');
  const template = MESSAGE_TEMPLATES[id] as MessageTemplate;
  const declared = new Set<string>(template.variables);
  for (const key of Object.keys(variables)) {
    if (!declared.has(key)) {
      throw new InvalidTemplateError(`${id} has no variable ${key.slice(0, 40)}`);
    }
  }
  for (const name of template.variables) {
    const value = variables[name]?.trim() ?? '';
    if (value === '') throw new InvalidTemplateError(`${id} needs ${name}`);
    if (value.length > TEMPLATE_VARIABLE_MAX_LENGTH[name] || /[\r\n{}]/.test(value)) {
      throw new InvalidTemplateError(`${name} is too long or not one line`);
    }
  }
  return template;
}

/** The other words messaging needs: what a learner reads around the templates. */
export const messageText = {
  /**
   * The last words of every SMS we start (A12-10): plain GSM-7. **Needs the owner's review.**
   */
  smsStop: 'Reply STOP to stop.',
  /** The text of the WhatsApp templates' opt-out quick-reply button (A12-10). */
  whatsappStopButton: WHATSAPP_STOP_BUTTON,
  /** A push notification's title: the app's name and nothing about the learner. */
  pushTitle: 'UniversityFlow',
  /** The reply to STOP, on the channel it arrived on. */
  stopConfirmed:
    'You won’t get any more UniversityFlow messages here. You can turn them back on in the app, under About me.',
  /**
   * The SMS-short crisis reply (planning.md §4.3, audit A10-05): what a learner gets when a
   * WhatsApp or SMS reply shows signs of crisis or distress, followed by verified helplines, or
   * by `en.crisis.noVerifiedNumbers` when none are verified. Shortened from `en.crisis` so the
   * whole reply fits in three SMS. Needs the same review as `en.crisis`, and first-language
   * review before it is translated. The `NoLines` leads are for when no verified support line
   * can be listed (audit A10-11: draft wording, **owed the owner's review**).
   */
  crisis: {
    reply:
      'I’m really glad you told me. You don’t have to deal with this alone. Please talk to someone now. These lines are free and trained to help:',
    replyNoLines:
      'I’m really glad you told me. You don’t have to deal with this alone. Please talk to someone you trust now.',
    concernReply:
      'That sounds really hard. Thank you for telling me. If it would help to talk to someone, these lines are free and confidential:',
    concernReplyNoLines:
      'That sounds really hard. Thank you for telling me. If it would help, talk to someone you trust.',
    /** One helpline: its name, then how to reach it ("Call 0800 567 567"). */
    line: (name: string, how: string) => `${name}: ${how}`,
    /**
     * The one-segment reply (audit A10-15): what a sender gets once they have had the full reply
     * a few times in the hour, so help never stops but its SMS cost is bounded. One line, then the
     * single most relevant verified helpline, or `en.crisis.noVerifiedNumbers`. Plain GSM-7 (no
     * curly apostrophe, which would make it UCS-2) and short enough that either fits one SMS
     * segment. **Draft wording: needs the owner's review with the rest of the crisis text, and
     * first-language review before it is translated.**
     */
    short: {
      reply: 'You are not alone. Please talk to someone.',
      concernReply: 'Thank you for telling me. You are not alone.',
    },
  },
  channelNames: {
    sms: 'SMS',
    whatsapp: 'WhatsApp',
    push: 'App notifications',
  } satisfies Record<MessageChannelName, string>,
} as const;
