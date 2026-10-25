/**
 * The crisis protocol's words (planning.md §4.3). Which reply a learner gets depends on the
 * lines the card shows (audit A10-11, `crisisWords` picks): "day and night" only when every
 * support line shown says 24 hours, and no mention of "these lines" when none is verified.
 * `replySetHours`, `replyNoLines`, `concernReplyNoLines` and `cardLeadSetHours` are draft
 * wording: **owed the owner's review, and first-language review before translation.**
 */
export const crisis = {
  /** Every support line shown is open 24 hours. */
  reply:
    'I’m really glad you told me. What you’re feeling matters, and you don’t have to deal with it alone. Please talk to someone right now: the people on these lines are trained to help, it’s free, and they’re there day and night. If you are in danger, call an emergency number. I’m still here, and we can talk about your studies whenever you’re ready.',
  /** Support lines shown, but not every one says it is open 24 hours. */
  replySetHours:
    'I’m really glad you told me. What you’re feeling matters, and you don’t have to deal with it alone. Please talk to someone right now: the people on these lines are trained to help, and it’s free. If you are in danger, call an emergency number. I’m still here, and we can talk about your studies whenever you’re ready.',
  /** No verified support line to show (at most emergency numbers). */
  replyNoLines:
    'I’m really glad you told me. What you’re feeling matters, and you don’t have to deal with it alone. Please talk to someone you trust right now, like a family member, a teacher or a nurse at your clinic. If you are in danger, call an emergency number. I’m still here, and we can talk about your studies whenever you’re ready.',
  concernReply:
    'That sounds really hard. Thank you for telling me. If it would help to talk to someone, these lines are free and confidential. I’m here too: how are you feeling right now?',
  concernReplyNoLines:
    'That sounds really hard. Thank you for telling me. If it would help to talk to someone, a person you trust, like a family member or a teacher, can listen. I’m here too: how are you feeling right now?',
  cardTitle: 'Talk to someone now',
  /** Every support line shown is open 24 hours. */
  cardLead: 'Free and confidential. You can call any time.',
  /** Support lines shown, not all of them open 24 hours: each line shows its own hours. */
  cardLeadSetHours: 'Free and confidential.',
  call: (number: string) => `Call ${number}`,
  sms: (number: string) => `SMS ${number}`,
  whatsapp: (number: string) => `WhatsApp ${number}`,
  noVerifiedNumbers:
    'If you are in danger right now, go to the nearest clinic or hospital, or ask a trusted adult to help you get there.',
  campus: 'Your school counsellor or your campus clinic can also help.',
  /**
   * The learner's own campus lines (Phase 5b): verified clinic, counselling and security places
   * at the university whose offer they accepted. **Draft wording: owed the owner's review.**
   */
  campusTitle: (university: string) => `On campus at ${university}`,
  campusLead: 'Your campus clinic, counselling and security. Each shows its own hours.',
} as const;
