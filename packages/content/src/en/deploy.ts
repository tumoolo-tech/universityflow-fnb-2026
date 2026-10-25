/** `en.deploy`: the staging site's banner (docs/deploy/README.md). */
export const deploy = {
  stagingLabel: 'Staging',
  stagingNotice:
    'This is a test copy of UniversityFlow, not the real one. Use made-up details only: never a real name, number or report.',
  /** The staging access gate's answer without the password (A5-10). Plain text. */
  stagingGateRequired:
    'This is a private test copy of UniversityFlow. Ask the team for the password.',
  /** A staging site with no password set: it stays shut (A5-10). Plain text. */
  stagingGateUnavailable: 'This test copy of UniversityFlow is not open yet.',
} as const;
