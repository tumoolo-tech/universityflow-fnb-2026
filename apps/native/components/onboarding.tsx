import { SCHOOL_GRADES, type SchoolGrade } from '@universityflow/catalogue/client';
import { en } from '@universityflow/content/app';
import { useRouter } from 'expo-router';
import { type ReactNode, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { api, errorMessage } from '../lib/api';
import { useAuth } from '../lib/auth';
import { apiUrl } from '../lib/config';
import { theme } from '../lib/theme';
import type { Me } from '../lib/types';
import {
  Body,
  Button,
  Card,
  Checkbox,
  Field,
  Heading,
  Notice,
  Radio,
  RadioGroup,
  Screen,
  SourceLink,
  Title,
} from './ui';

/** The web app's privacy policy; none when the build has no server address (a config error). */
function privacyPolicyUrl(): string | null {
  try {
    return `${apiUrl()}/privacy`;
  } catch {
    return null;
  }
}

/**
 * The judges' demo sends no SMS (a hackathon exception, docs/deploy/demo.md §4b): its server
 * returns the made-up guardian's consent page as a path (`demoConsentLink`), opened on the same
 * server in the browser, as the web shows it. Only a `/consent/<token>` path is offered: the app
 * never opens anywhere else a response names. Nothing is processed before that yes (hard rule 5:
 * the server holds it).
 */
const CONSENT_PATH = /^\/consent\/[A-Za-z0-9_-]{8,200}$/;

function demoConsentUrl(link: unknown): string | null {
  if (typeof link !== 'string' || !CONSENT_PATH.test(link)) return null;
  try {
    return `${apiUrl()}${link}`;
  } catch {
    return null;
  }
}

/**
 * Onboarding in the order POPIA needs (planning.md §8.1): date of birth first; for a minor, a
 * guardian's consent before anything else; for an adult, and at 18, the learner's own consent
 * (A7-04). The server decides
 * readiness (hard rule 5); this only asks and re-checks. Once ready, the grade, if the learner
 * hasn't given it (G10-1): the stage, the exam year and the report picker all follow it.
 */

type Step = 'dob' | 'guardian' | 'waiting' | 'adult' | 'grade';
type Relationship = keyof typeof en.onboarding.relationships;

export function stepFor(me: Me): Step | null {
  if (me.ready) return me.profile?.grade == null ? 'grade' : null;
  const { consentStatus, needsAdultConsent } = me.account;
  if (consentStatus === 'unknown') return 'dob';
  if (consentStatus === 'pending' || consentStatus === 'withdrawn') return 'guardian';
  if (needsAdultConsent) return 'adult';
  return null;
}

/** A real calendar date written as YYYY-MM-DD, not in the future. */
export function isDateOfBirth(value: string, today = new Date()): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value &&
    date.getTime() <= today.getTime()
  );
}

export function Onboarding({ me, onChanged }: { me: Me; onChanged: () => Promise<Me | null> }) {
  const router = useRouter();
  const derived = stepFor(me);
  const [waiting, setWaiting] = useState(false);
  /** The guardian SMS waits for 07:00 when asked for at night (A12-04). */
  const [queued, setQueued] = useState(false);
  /** The judges' demo: the made-up guardian's consent page, since nothing was sent. */
  const [demoLink, setDemoLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [declined, setDeclined] = useState(false);
  /** Deleting is always allowed, consent or not (POPIA; the stores require it in-app). */
  const toAccount = () => router.push('/account');

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await action();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const step: Step | null = derived === 'guardian' && waiting ? 'waiting' : derived;

  if (step === 'dob') {
    return (
      <DateOfBirth
        busy={busy}
        error={error}
        onDelete={toAccount}
        onSubmit={(dob) => {
          if (!isDateOfBirth(dob)) {
            setError(en.onboarding.dobInvalid);
            return;
          }
          void run(async () => {
            await api('/api/me/date-of-birth', { json: { dateOfBirth: dob } });
            await onChanged();
          });
        }}
      />
    );
  }

  if (step === 'guardian') {
    return (
      <Guardian
        withdrawn={me.account.consentStatus === 'withdrawn'}
        busy={busy}
        error={error}
        onDelete={toAccount}
        onSubmit={(guardian) =>
          run(async () => {
            const sent = await api<{ queuedUntil?: string; demoConsentLink?: unknown }>(
              '/api/me/guardian',
              { json: guardian },
            );
            setQueued(Boolean(sent?.queuedUntil));
            setDemoLink(demoConsentUrl(sent?.demoConsentLink));
            setWaiting(true);
          })
        }
      />
    );
  }

  if (step === 'waiting') {
    return (
      <Screen>
        <Title>{en.onboarding.waitingTitle}</Title>
        <Body>{en.onboarding.waitingLeadApp}</Body>
        {queued ? <Notice tone="info">{en.onboarding.guardianQueued}</Notice> : null}
        {demoLink ? (
          <Card emphasis testID="demo-guardian-link">
            <Heading level={3}>{en.demoPhoneSignup.guardianLinkTitle}</Heading>
            <Body pair="card">{en.demoPhoneSignup.guardianLinkLead}</Body>
            <SourceLink url={demoLink}>{en.demoPhoneSignup.guardianLinkAction}</SourceLink>
          </Card>
        ) : null}
        {notice ? <Notice tone="info">{notice}</Notice> : null}
        {error ? <Notice tone="danger">{error}</Notice> : null}
        <Button
          label={en.onboarding.checkAgain}
          busy={busy}
          busyLabel={en.common.loading}
          onPress={() =>
            run(async () => {
              const next = await onChanged();
              if (next && !next.ready) setNotice(en.onboarding.stillWaiting);
            })
          }
        />
        <Button
          label={en.onboarding.resendRequest}
          variant="quiet"
          disabled={busy}
          onPress={() => {
            setWaiting(false);
            setNotice(null);
          }}
        />
        <Leave disabled={busy} onDelete={toAccount} />
      </Screen>
    );
  }

  if (step === 'grade') {
    return (
      <GradeStep
        busy={busy}
        error={error}
        onSubmit={(grade) =>
          run(async () => {
            await api('/api/me', { method: 'PATCH', json: { grade } });
            await onChanged();
          })
        }
      />
    );
  }

  if (step === 'adult') {
    return (
      <AdultConsent
        turned18={me.account.consentStatus === 'granted'}
        busy={busy}
        error={error}
        onAgree={() =>
          run(async () => {
            await api('/api/me/adult-consent', { json: { version: en.adultConsent.version } });
            await onChanged();
          })
        }
      >
        {/* Declining records nothing: without consent the server keeps them out (hard rule 5). */}
        {declined ? (
          <Notice tone="info">{en.onboarding.adultDeclined}</Notice>
        ) : (
          <Button
            label={en.onboarding.adultDecline}
            variant="secondary"
            disabled={busy}
            onPress={() => setDeclined(true)}
          />
        )}
        <Leave disabled={busy} onDelete={toAccount} />
      </AdultConsent>
    );
  }

  return null;
}

/**
 * An adult's own consent (audit A7-04, App Store 5.1.2(i)): after the date of birth, or at 18
 * after a guardian's consent. What UniversityFlow does, who helps (the AI provider and the
 * messaging companies, outside South Africa), and an explicit yes, recorded by the server with
 * the version of this wording. The same wording as the web, from packages/content.
 */
function AdultConsent(props: {
  turned18: boolean;
  busy: boolean;
  error: string | null;
  onAgree: () => void;
  children?: ReactNode;
}) {
  const c = en.adultConsent;
  // The launch standard: a required, unticked box beside a link to the privacy policy (the web
  // page, opened in the browser). "I agree to this" waits for the box.
  const [agreed, setAgreed] = useState(false);
  const policy = privacyPolicyUrl();
  const sections = [
    [c.whatWeDoTitle, c.whatWeDo],
    [c.whatWeKeepTitle, c.whatWeKeep],
    [c.rightsTitle, c.rights],
  ] as const;
  return (
    <Screen>
      <Title>{props.turned18 ? en.onboarding.adultTitle : c.title}</Title>
      <Body>{props.turned18 ? en.onboarding.adultLead : c.lead}</Body>
      {sections.map(([title, points]) => (
        <View key={title} style={styles.section}>
          <Heading pair="page">{title}</Heading>
          {points.map((point) => (
            <View key={point} style={styles.point}>
              <View
                style={styles.bullet}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
              />
              <View style={styles.pointText}>
                <Body>{point}</Body>
              </View>
            </View>
          ))}
        </View>
      ))}
      {policy ? (
        <SourceLink url={policy} pair="pageBrand">
          {en.privacyPage.consentLink}
        </SourceLink>
      ) : null}
      <Checkbox
        label={en.privacyPage.adultConfirm}
        checked={agreed}
        pair="page"
        onPress={() => setAgreed((on) => !on)}
      />
      {props.error ? <Notice tone="danger">{props.error}</Notice> : null}
      <Button
        label={c.agree}
        busy={props.busy}
        busyLabel={en.common.saving}
        disabled={!agreed}
        onPress={props.onAgree}
      />
      {props.children}
    </Screen>
  );
}

/**
 * The way out of any onboarding step (A7-03): sign out (a shared phone) and, where given, delete
 * the account through the same flow as About me.
 */
function Leave(props: { disabled?: boolean; onDelete?: () => void }) {
  const { signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  return (
    <>
      {props.onDelete ? (
        <Button
          label={en.me.deleteTitle}
          variant="quiet"
          disabled={Boolean(props.disabled) || signingOut}
          onPress={props.onDelete}
        />
      ) : null}
      <Button
        label={en.nav.signOut}
        variant="quiet"
        disabled={Boolean(props.disabled)}
        busy={signingOut}
        busyLabel={en.common.loading}
        onPress={async () => {
          setSigningOut(true);
          await signOut();
        }}
      />
    </>
  );
}

function DateOfBirth(props: {
  busy: boolean;
  error: string | null;
  onSubmit: (dob: string) => void;
  onDelete: () => void;
}) {
  const [dob, setDob] = useState('');
  return (
    <Screen>
      <Title>{en.onboarding.dobTitle}</Title>
      <Body>{en.onboarding.dobLead}</Body>
      <Field
        label={en.onboarding.dobLabel}
        hint={en.onboarding.dobHint}
        error={props.error}
        value={dob}
        onChangeText={setDob}
        keyboardType="numbers-and-punctuation"
        autoComplete="birthdate-full"
        maxLength={10}
        testID="dob"
      />
      <Button
        label={en.common.continue}
        busy={props.busy}
        busyLabel={en.common.saving}
        disabled={dob.length < 10}
        onPress={() => props.onSubmit(dob.trim())}
      />
      <Leave disabled={props.busy} onDelete={props.onDelete} />
    </Screen>
  );
}

function GradeStep(props: {
  busy: boolean;
  error: string | null;
  onSubmit: (grade: SchoolGrade) => void;
}) {
  const [grade, setGrade] = useState<SchoolGrade | null>(null);
  return (
    <Screen>
      <Title>{en.onboarding.grade}</Title>
      <Body>{en.onboarding.gradeLead}</Body>
      <RadioGroup label={en.onboarding.grade}>
        {SCHOOL_GRADES.map((g) => (
          <Radio
            key={g}
            label={en.onboarding.gradeOption(g)}
            pair="page"
            selected={grade === g}
            onPress={() => setGrade(g)}
          />
        ))}
      </RadioGroup>
      {props.error ? <Notice tone="danger">{props.error}</Notice> : null}
      <Button
        label={en.common.continue}
        busy={props.busy}
        busyLabel={en.common.saving}
        disabled={grade === null}
        onPress={() => {
          if (grade !== null) props.onSubmit(grade);
        }}
      />
      <Leave disabled={props.busy} />
    </Screen>
  );
}

function Guardian(props: {
  withdrawn: boolean;
  busy: boolean;
  error: string | null;
  onSubmit: (g: { name: string; phone: string; relationship: Relationship }) => void;
  /** Deleting is always allowed, consent or not (and the stores require it in-app). */
  onDelete: () => void;
}) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [relationship, setRelationship] = useState<Relationship>('parent');
  const options = Object.entries(en.onboarding.relationships) as Array<[Relationship, string]>;
  return (
    <Screen>
      <Title>{props.withdrawn ? en.onboarding.withdrawnTitle : en.onboarding.guardianTitle}</Title>
      <Body>{props.withdrawn ? en.onboarding.withdrawnLead : en.onboarding.guardianLead}</Body>
      <Field
        label={en.onboarding.guardianName}
        value={name}
        onChangeText={setName}
        maxLength={80}
        autoComplete="off"
        testID="guardian-name"
      />
      <Field
        label={en.onboarding.guardianPhone}
        hint={en.auth.phoneHint}
        error={props.error}
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        maxLength={20}
        testID="guardian-phone"
      />
      <RadioGroup label={en.onboarding.relationship}>
        {options.map(([value, label]) => (
          <Radio
            key={value}
            label={label}
            pair="page"
            selected={value === relationship}
            onPress={() => setRelationship(value)}
          />
        ))}
      </RadioGroup>
      <Button
        label={en.onboarding.sendRequest}
        busy={props.busy}
        busyLabel={en.auth.sending}
        disabled={name.trim().length < 2 || phone.trim().length < 9}
        onPress={() => props.onSubmit({ name: name.trim(), phone, relationship })}
      />
      <Leave onDelete={props.onDelete} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { gap: theme.space['2'] },
  point: { flexDirection: 'row', alignItems: 'flex-start', gap: theme.space['3'] },
  bullet: {
    width: theme.space['2'],
    height: theme.space['2'],
    marginTop: theme.space['2'],
    borderRadius: theme.radius.full,
    backgroundColor: theme.color.ink,
  },
  pointText: { flex: 1 },
});
