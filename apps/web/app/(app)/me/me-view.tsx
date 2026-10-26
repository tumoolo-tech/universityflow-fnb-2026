'use client';

import { SCHOOL_GRADES } from '@universityflow/catalogue/client';
import { auth, common, me, onboarding } from '@universityflow/content';
import type { Account } from '@universityflow/db';
import type { ProfileLook as Look } from '@universityflow/ui';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { type CourseOption, StudyChoice } from '@/components/study-choice';
import {
  Button,
  buttonLook,
  Card,
  cx,
  Field,
  Input,
  Notice,
  Page,
  panelLook,
  Select,
  StatusLine,
} from '@/components/ui';
import { type CareWords, type WrittenCare, WrittenCarePanel } from '@/components/written-care';
import { api, errorMessage } from '@/lib/client/api';
import { useStatus } from '@/lib/client/status';
import { MessagesCard, type MessagingView } from './messages-card';
import { ProfileLook } from './profile-look';

interface Profile {
  displayName: string | null;
  grade: number | null;
  schoolName: string | null;
  province: string | null;
  goal: string | null;
}

export function MeView(props: {
  account: Account;
  messaging: MessagingView;
  profile: Profile | null;
  /** The About me card's look, and the grade on its sticker (none past matric). */
  look: Look;
  lookGrade: number | null;
  /**
   * The profile photo, when the server's switch offers one (lib/server/profile-photo.ts); in a
   * judge demo with the SAMPLE pictures to choose from (and, under UF_DEMO_REAL_PHOTOS, the
   * visitor's own photo too).
   */
  photo?: {
    version: string | null;
    samples?: ReadonlyArray<string>;
    realUploads?: 'copy' | 'account';
  } | null;
  memory: Array<{ id: string; kind: string; body: string }>;
  /** For "What would you like to study?": the courses the learner may see. */
  courses: ReadonlyArray<CourseOption>;
  /** The words for the care a saved goal may ask for (D9), as props. */
  careWords?: CareWords;
}) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(props.profile?.displayName ?? '');
  // The card shows the name as saved, not as it is being typed.
  const [savedName, setSavedName] = useState(props.profile?.displayName ?? '');
  const [grade, setGrade] = useState(props.profile?.grade ? String(props.profile.grade) : '');
  // The grade as last saved: only a change is sent (A1-38).
  const [savedGrade, setSavedGrade] = useState(grade);
  const [goal, setGoal] = useState(props.profile?.goal ?? '');
  const [memory, setMemory] = useState(props.memory);
  const [confirmText, setConfirmText] = useState('');
  // Saved twice, said twice (A2-51).
  const [message, setMessage] = useStatus();
  const [error, setError] = useState<string | null>(null);
  // D9: the goal in their words is crisis-checked on the server; its care shows here at once.
  const [care, setCare] = useState<WrittenCare | null>(null);

  async function saveProfile() {
    setError(null);
    try {
      const saved = await api<{ care?: WrittenCare | null }>('/api/me', {
        method: 'PATCH',
        // Saving the grade records it afresh (G10-1): it then moves up from today. So it goes only
        // when the learner changed it, never with every save (A1-38): a name changed in January
        // must not answer the home's "Are you in Grade N now?" for them.
        json: {
          displayName: displayName || null,
          goal: goal || null,
          ...(grade && grade !== savedGrade ? { grade: Number(grade) } : {}),
        },
      });
      setSavedGrade(grade);
      setSavedName(displayName);
      setMessage(common.saved);
      setCare(saved.care ?? null);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  async function forget(id: string) {
    await api(`/api/me/memory/${id}`, { method: 'DELETE' });
    setMemory((list) => list.filter((m) => m.id !== id));
  }

  async function deleteAccount() {
    try {
      await api('/api/me', { method: 'DELETE' });
      router.push('/');
      router.refresh();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <Page title={me.title} lead={me.lead}>
      <ProfileLook
        name={savedName.trim() || null}
        grade={props.lookGrade}
        initial={props.look}
        photo={props.photo ?? null}
      />
      {error ? <Notice tone="danger">{error}</Notice> : null}
      <Card className="flex flex-col gap-4">
        <h2 className="text-lg">{me.profile}</h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
          <dt className="font-medium">{auth.phoneLabel}</dt>
          <dd>{props.account.phoneMasked}</dd>
          <dt className="font-medium">{onboarding.dobLabel}</dt>
          <dd>{props.account.dateOfBirth ?? common.unknown}</dd>
          <dt className="font-medium">{me.consentLabel}</dt>
          <dd>{me.consentStatus[props.account.consentStatus]}</dd>
        </dl>
        <div className="flex flex-col gap-4">
          <Field label={onboarding.displayName}>
            {({ id }) => (
              <Input
                id={id}
                value={displayName}
                maxLength={40}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            )}
          </Field>
          {/* The home's January check links here (#grade). */}
          <div id="grade">
            <Field label={onboarding.grade} hint={onboarding.gradeLead}>
              {({ id, describedBy }) => (
                <Select
                  id={id}
                  aria-describedby={describedBy}
                  value={grade}
                  onChange={(e) => setGrade(e.target.value)}
                >
                  {grade ? null : <option value="">{common.chooseOne}</option>}
                  {SCHOOL_GRADES.map((g) => (
                    <option key={g} value={g}>
                      {onboarding.gradeOption(g)}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>
          <Field label={onboarding.goal} hint={onboarding.goalHint}>
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
          <Button className="self-start" onClick={saveProfile}>
            {common.save}
          </Button>
          <StatusLine said={message} />
          {care && props.careWords ? (
            <WrittenCarePanel care={care} words={props.careWords} onSeen={() => setCare(null)} />
          ) : null}
        </div>
      </Card>
      <MessagesCard initial={props.messaging} />
      <Card className="flex flex-col gap-3">
        <h2 className="text-lg">{me.memory}</h2>
        {memory.length === 0 ? (
          <p className="text-muted">{me.memoryEmpty}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {memory.map((m) => (
              <li key={m.id} className={`${panelLook} flex items-center justify-between gap-3 p-3`}>
                <span>{m.body}</span>
                <Button variant="quiet" onClick={() => forget(m.id)}>
                  {me.forget}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card className="flex flex-col items-start gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg">{me.export}</h2>
          <p>{me.exportLead}</p>
        </div>
        {/* A plain link (an API route's download, never routed by Next) in the outline look (A2-22). */}
        <a href="/api/me/export" className={cx(buttonLook('secondary'), 'no-underline')}>
          {me.export}
        </a>
      </Card>
      <Card className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg text-danger">{me.deleteTitle}</h2>
          <p>{me.deleteLead}</p>
        </div>
        <Field label={me.deleteConfirm}>
          {({ id }) => (
            <Input
              id={id}
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              autoComplete="off"
            />
          )}
        </Field>
        <Button
          variant="danger"
          className="self-start"
          disabled={confirmText !== 'DELETE'}
          onClick={deleteAccount}
        >
          {me.deleteButton}
        </Button>
      </Card>
    </Page>
  );
}
