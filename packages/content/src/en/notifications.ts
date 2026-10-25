/** App notifications (Phase 4d), in the mobile app. */
export const notifications = {
  title: 'Notifications',
  lead: 'Get your reminders as notifications on this phone. They never show your name or your marks, so nothing private appears on your lock screen. They reach your phone through Expo (in the United States) and then Apple or Google, outside South Africa.',
  when: 'Never at night, never during a paper, and never more than you choose under Reminders and messages.',
  on: 'Notifications are on for this phone.',
  off: 'Notifications are off.',
  turnOn: 'Turn on notifications',
  turnOff: 'Turn off notifications',
  askFirst:
    'Your phone will ask if UniversityFlow may send notifications. You can change this any time.',
  denied:
    'Notifications are turned off for UniversityFlow in your phone’s settings. Turn them on there, then try again.',
  unavailable: 'Notifications aren’t available yet. You can still get reminders by SMS.',
  noDevice: 'This phone can’t receive notifications (a simulator can’t).',
  /** The name Android shows for the app's notification channel, in its settings. */
  androidChannel: 'Reminders',
} as const;
