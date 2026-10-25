'use client';

import { PROVINCES, SCHOOL_GRADES } from '@universityflow/catalogue/client';
import { adultConsent, auth, common, onboarding, privacyPage } from '@universityflow/content';
import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';
import { PrivacyLink } from '@/components/privacy-link';
import { type CourseOption, StudyChoice } from '@/components/study-choice';
import {
  Button,
  ButtonLink,
  Card,
  Checkbox,
  Field,
  Input,
  Notice,
  Page,
  Select,
} from '@/components/ui';
import { type CareWords, type WrittenCare, WrittenCarePanel } from '@/components/written-care';
import { ApiError, api, errorMessage } from '@/lib/client/api';
import type { DemoPhoneWords } from '../demo/new-learner/words';

export type Step =
  | 'dob'
  | 'guardian'
  | 'waiting'
  | 'withdrawn'
  | 'adult'
  | 'adult-turned-18'
  | 'profile';

interface StepsProps {
  step: Step;
  /** For "What would you like to study?": the courses the learner may see. */
  courses: ReadonlyArray<CourseOption>;
  /** The words for the care a saved goal may ask for (D9), as props. */
  careWords?: CareWords;
  /**
   * The judge demo's real sign-up only (a hackathon exception, docs/deploy/demo.md): what to say
   * when a date of birth under 18 was refused and the account deleted. Absent everywhere else.
   */
  adultsOnly?: { readonly message: string; readonly action: string } | undefined;
  /**
   * The judge demo's on-screen phone sign-up only (a hackathon exception, 2026-10-24,
   * docs/deploy/demo.md): a line saying it is the demo, the guardian's made-up 080 number, and the
   * guardian's link shown on screen since nothing is sent. Absent everywhere else.
   */
  demoPhone?: DemoPhoneWords | undefined;
}

export function OnboardingSteps(props: StepsProps) {
  if (!props.demoPhone) return <Steps {...props} />;
  return (
    <>
      <Notice tone="info">{props.demoPhone.onboardingNotice}</Notice>
      <Steps {...props} />
    </>
  );
}

function Steps({ step: initial, courses, careWords, adultsOnly, demoPhone }: StepsProps) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(initial);
  // The server's step, from the last render. "Continue" on the waiting step refreshes the page,
  // so the server's step arrives as a new prop once the guardian has agreed; the shown step
  // follows it (held in state from the first render, it never moved on). While the request is
  // still open the server says 'guardian' again, and "Waiting" stays.
  const [serverStep, setServerStep] = useState<Step>(initial);
  if (initial !== serverStep) {
    setServerStep(initial);
    if (!(initial === 'guardian' && step === 'waiting')) setStep(initial);
  }
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /** The guardian SMS waits for 07:00 when asked for at night (A12-04). */
  const [queued, setQueued] = useState(false);
  // D9: a goal in their words that needs care shows the crisis card before the home does.
  const [care, setCare] = useState<WrittenCare | null>(null);
  /** The demo sign-up refused an under-18 and deleted the account: nothing more to do here. */
  const [refusedMinor, setRefusedMinor] = useState(false);
  /** The demo's on-screen sign-up: the guardian's link, shown since nothing is sent. */
  const [demoLink, setDemoLink] = useState<string | null>(null);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      if (adultsOnly && e instanceof ApiError && e.detail === 'adults-only') setRefusedMinor(true);
      else if (demoPhone && e instanceof ApiError && e.detail === 'demo-080-only') {
        setError(demoPhone.only080);
      } else setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  if (refusedMinor && adultsOnly)
    return (
      <section className="flex flex-col gap-4">
        <Notice tone="warning">{adultsOnly.message}</Notice>
        <ButtonLink href="/demo" className="self-start">
          {adultsOnly.action}
        </ButtonLink>
      </section>
    );

  if (step === 'dob')
    return (
      <DateOfBirth
        busy={busy}
        error={error}
        onSubmit={(dob) =>
          run(async () => {
            const { consentStatus } = await api<{ consentStatus: string }>(
              '/api/me/date-of-birth',
              {
                method: 'POST',
                json: { dateOfBirth: dob },
              },
            );
            // An adult agrees in their own name before anything else (A7-04).
            setStep(consentStatus === 'pending' ? 'guardian' : 'adult');
          })
        }
      />
    );

  if (step === 'guardian' || step === 'withdrawn') {
    return (
      <Guardian
        withdrawn={step === 'withdrawn'}
        busy={busy}
        error={error}
        phoneHint={demoPhone ? demoPhone.guardianPhoneHint : auth.phoneHint}
        onSubmit={(guardian) =>
          run(async () => {
            const sent = await api<{ queuedUntil?: string; demoConsentLink?: string }>(
              '/api/me/guardian',
              { method: 'POST', json: guardian },
            );
            setQueued(Boolean(sent.queuedUntil));
            setDemoLink(demoPhone && sent.demoConsentLink ? sent.demoConsentLink : null);
            setStep('waiting');
          })
        }
      />
    );
  }

  if (step === 'waiting') {
    return (
      <section aria-labelledby="waiting-title">
        <Page title={onboarding.waitingTitle} titleId="waiting-title" lead={onboarding.waitingLead}>
          {queued ? <Notice tone="info">{onboarding.guardianQueued}</Notice> : null}
          {demoPhone && demoLink ? (
            <Card
              tone="warning"
              aria-labelledby="demo-guardian-link"
              className="flex flex-col items-start gap-3"
            >
              <h2 id="demo-guardian-link" className="text-lg">
                {demoPhone.guardianLinkTitle}
              </h2>
              <p>{demoPhone.guardianLinkLead}</p>
              <ButtonLink href={demoLink} newTab>
                {demoPhone.guardianLinkAction}
              </ButtonLink>
            </Card>
          ) : null}
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => router.refresh()}>{common.continue}</Button>
            <Button variant="quiet" onClick={() => setStep('guardian')}>
              {onboarding.resendRequest}
            </Button>
          </div>
        </Page>
      </section>
    );
  }

  if (step === 'adult' || step === 'adult-turned-18') {
    const turned18 = step === 'adult-turned-18';
    return (
      <AdultConsent
        turned18={turned18}
        busy={busy}
        error={error}
        onAgree={() =>
          run(async () => {
            await api('/api/me/adult-consent', {
              method: 'POST',
              json: { version: adultConsent.version },
            });
            // A new adult tells us about themselves next; at 18 the profile is already there.
            if (turned18) router.push('/home');
            else setStep('profile');
          })
        }
      />
    );
  }

  const home = () => {
    router.push('/home');
    router.refresh();
  };
  if (care && careWords) return <WrittenCarePanel care={care} words={careWords} onSeen={home} />;

  return (
    <Profile
      busy={busy}
      error={error}
      courses={courses}
      onSubmit={(profile) =>
        run(async () => {
          const saved = await api<{ care?: WrittenCare | null }>('/api/me', {
            method: 'PATCH',
            json: profile,
          });
          if (saved.care && saved.care.level !== 'setback') setCare(saved.care);
          else home();
        })
      }
    />
  );
}

function DateOfBirth(props: {
  busy: boolean;
  error: string | null;
  onSubmit: (dob: string) => void;
}) {
  const [dob, setDob] = useState('');
  return (
    <form
      className="flex flex-col"
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        props.onSubmit(dob);
      }}
    >
      <Page title={onboarding.dobTitle} lead={onboarding.dobLead}>
        <Field label={onboarding.dobLabel} error={props.error}>
          {({ id, describedBy }) => (
            <Input
              id={id}
              aria-describedby={describedBy}
              type="date"
              autoComplete="bday"
              value={dob}
              onChange={(e) => setDob(e.target.value)}
              required
            />
          )}
        </Field>
        <Button type="submit" className="self-start" disabled={props.busy || !dob}>
          {common.continue}
        </Button>
      </Page>
    </form>
  );
}

/**
 * An adult's own consent (audit A7-04): what UniversityFlow does, who helps (the AI provider and
 * the messaging companies, and that they're outside South Africa), and an explicit yes. The same
 * wording as the mobile app's, from packages/content.
 */
function AdultConsent(props: {
  turned18: boolean;
  busy: boolean;
  error: string | null;
  onAgree: () => void;
}) {
  const c = adultConsent;
  // The launch standard: a required, unticked box beside the privacy policy's link. The button
  // stays focusable (aria-disabled, as A3-25) and says why when pressed too early.
  const [agreed, setAgreed] = useState(false);
  const [nudged, setNudged] = useState(false);
  return (
    <section aria-labelledby="adult-title">
      <Page
        title={props.turned18 ? onboarding.adultTitle : c.title}
        titleId="adult-title"
        lead={props.turned18 ? onboarding.adultLead : c.lead}
      >
        {(
          [
            ['adult-do', c.whatWeDoTitle, c.whatWeDo],
            ['adult-keep', c.whatWeKeepTitle, c.whatWeKeep],
            ['adult-rights', c.rightsTitle, c.rights],
          ] as const
        ).map(([id, title, points]) => (
          <section key={id} aria-labelledby={id} className="flex flex-col gap-2">
            <h2 id={id} className="text-lg">
              {title}
            </h2>
            <ul className="flex list-disc flex-col gap-1 pl-6">
              {points.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </section>
        ))}
        <PrivacyLink />
        <div className="flex flex-col gap-1">
          <label htmlFor="adult-confirm" className="flex min-h-11 items-start gap-3">
            <Checkbox
              id="adult-confirm"
              className="mt-1"
              required
              checked={agreed}
              aria-describedby={nudged && !agreed ? 'adult-confirm-needed' : undefined}
              onChange={(e) => {
                setAgreed(e.target.checked);
                if (e.target.checked) setNudged(false);
              }}
            />
            <span>{privacyPage.adultConfirm}</span>
          </label>
          {nudged && !agreed ? (
            <p id="adult-confirm-needed" role="alert" className="ml-8 text-sm">
              {privacyPage.adultConfirmNeeded}
            </p>
          ) : null}
        </div>
        {props.error ? <Notice tone="danger">{props.error}</Notice> : null}
        <Button
          className="self-start"
          disabled={props.busy}
          aria-disabled={!agreed}
          onClick={() => {
            if (!agreed) setNudged(true);
            else props.onAgree();
          }}
        >
          {c.agree}
        </Button>
      </Page>
    </section>
  );
}

function Guardian(props: {
  withdrawn: boolean;
  busy: boolean;
  error: string | null;
  phoneHint: string;
  onSubmit: (g: { name: string; phone: string; relationship: string }) => void;
}) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [relationship, setRelationship] = useState('parent');
  return (
    <form
      className="flex flex-col"
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        props.onSubmit({ name, phone, relationship });
      }}
    >
      <Page
        title={props.withdrawn ? onboarding.withdrawnTitle : onboarding.guardianTitle}
        lead={props.withdrawn ? onboarding.withdrawnLead : onboarding.guardianLead}
      >
        <Field label={onboarding.guardianName}>
          {({ id }) => (
            <Input
              id={id}
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="off"
              required
            />
          )}
        </Field>
        <Field label={onboarding.guardianPhone} hint={props.phoneHint} error={props.error}>
          {({ id, describedBy }) => (
            <Input
              id={id}
              aria-describedby={describedBy}
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
          )}
        </Field>
        <Field label={onboarding.relationship}>
          {({ id }) => (
            <Select id={id} value={relationship} onChange={(e) => setRelationship(e.target.value)}>
              {Object.entries(onboarding.relationships).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Button
          type="submit"
          className="self-start"
          disabled={props.busy || name.trim().length < 2 || phone.length < 9}
        >
          {onboarding.sendRequest}
        </Button>
      </Page>
    </form>
  );
}

function Profile(props: {
  busy: boolean;
  error: string | null;
  courses: ReadonlyArray<CourseOption>;
  onSubmit: (p: Record<string, string | number | null>) => void;
}) {
  const [displayName, setDisplayName] = useState('');
  const [grade, setGrade] = useState('11');
  const [schoolName, setSchoolName] = useState('');
  const [province, setProvince] = useState('');
  const [goal, setGoal] = useState('');
  return (
    <form
      className="flex flex-col"
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        props.onSubmit({
          displayName: displayName || null,
          grade: Number(grade),
          schoolName: schoolName || null,
          province: province || null,
          goal: goal || null,
        });
      }}
    >
      <Page title={onboarding.profileTitle}>
        <Field label={onboarding.displayName} hint={onboarding.displayNameHint}>
          {({ id, describedBy }) => (
            <Input
              id={id}
              aria-describedby={describedBy}
              value={displayName}
              maxLength={40}
              autoComplete="nickname"
              onChange={(e) => setDisplayName(e.target.value)}
            />
          )}
        </Field>
        <Field label={onboarding.grade}>
          {({ id }) => (
            <Select id={id} value={grade} onChange={(e) => setGrade(e.target.value)}>
              {SCHOOL_GRADES.map((g) => (
                <option key={g} value={g}>
                  {onboarding.gradeOption(g)}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label={onboarding.school}>
          {({ id }) => (
            <Input
              id={id}
              value={schoolName}
              maxLength={120}
              onChange={(e) => setSchoolName(e.target.value)}
            />
          )}
        </Field>
        <Field label={onboarding.province}>
          {({ id }) => (
            <Select id={id} value={province} onChange={(e) => setProvince(e.target.value)}>
              <option value="">{common.chooseOne}</option>
              {PROVINCES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label={onboarding.goal} hint={onboarding.goalHint} error={props.error}>
          {({ id, describedBy }) => (
            <StudyChoice
              id={id}
              describedBy={describedBy}
              value={goal}
              onChange={setGoal}
              options={props.courses}
            />
          )}
        </Field>
        <Button type="submit" className="self-start" disabled={props.busy}>
          {onboarding.finish}
        </Button>
      </Page>
    </form>
  );
}
