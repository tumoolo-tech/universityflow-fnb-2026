/** `en.auth`. */
export const auth = {
  title: 'Sign in with your cellphone number',
  lead: 'We’ll send you a one-time PIN by SMS. No password to remember.',
  phoneLabel: 'Cellphone number',
  phoneHint: 'A South African number, like 082 123 4567',
  sendPin: 'Send my PIN',
  sending: 'Sending…',
  pinTitle: 'Enter your PIN',
  pinLead: (masked: string) => `We sent a 6-digit PIN to ${masked}. It works for 10 minutes.`,
  pinLabel: '6-digit PIN',
  verify: 'Sign in',
  verifying: 'Checking…',
  changeNumber: 'Use a different number',
  resend: 'Send a new PIN',
  smsBody: (code: string) =>
    `Your UniversityFlow PIN is ${code}. It expires in 10 minutes. Never share it with anyone, even someone who says they work for us.`,
  errors: {
    phone: 'That doesn’t look like a South African cellphone number.',
    pin: 'That PIN isn’t right. Check the SMS and try again.',
    expired: 'That PIN has expired or been used. Ask for a new one.',
    rateLimited: 'Too many tries. Wait a few minutes and try again.',
    /** A number locked by wrong PINs (A5-09). New wording (2026-10-22), owed review. */
    pinLocked:
      'Too many wrong PINs for this number. You can try again tomorrow. If that wasn’t you, nothing has been opened.',
    generic: 'Something went wrong. Please try again.',
  },
  devOutbox: 'Local stand-in: SMS messages appear here instead of being sent.',
  /** /sign-in's search and share description (A6-04, wave 10). Owed the owner's wording review. */
  description:
    'Sign in to UniversityFlow with your cellphone number and a one-time PIN we send by SMS. There’s no password to remember, and it’s free for learners.',
} as const;
