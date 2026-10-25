'use client';

import { applications, common } from '@universityflow/content';
import type { ApplicationStatus } from '@universityflow/db';
import { useState } from 'react';
import { ProgrammeCard } from '@/components/programme-card';
import {
  ButtonLink,
  Card,
  Checkbox,
  Field,
  Input,
  Notice,
  Page,
  Select,
  SourceLink,
} from '@/components/ui';
import { api, errorMessage, formatDate } from '@/lib/client/api';
import type { ApplicationSummary } from '@/lib/server/applications';

const STATUSES = Object.keys(applications.statuses) as ApplicationStatus[];

export function PackView({
  application,
  targetIntake,
}: {
  application: ApplicationSummary;
  targetIntake: number;
}) {
  const { university, window } = application;
  const [status, setStatus] = useState(application.status);
  const [reference, setReference] = useState(application.reference ?? '');
  const [checklist, setChecklist] = useState(application.checklist);
  const [error, setError] = useState<string | null>(null);

  async function save(patch: { status?: ApplicationStatus; reference?: string | null }) {
    setError(null);
    try {
      await api(`/api/applications/${university.id}`, { method: 'PATCH', json: patch });
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  async function tick(item: string, done: boolean) {
    setChecklist((list) => list.map((c) => (c.item === item ? { ...c, done } : c)));
    try {
      await api('/api/checklist', {
        method: 'POST',
        json: { scope: `application:${university.id}`, item, done },
      });
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  const needsNbt = application.programmes.some((p) => p.nbt === 'required');

  return (
    <Page title={`${applications.pack}: ${university.name}`}>
      <Notice tone="warning">{applications.scamWarning}</Notice>
      {error ? <Notice tone="danger">{error}</Notice> : null}

      <Card className="flex flex-col gap-3">
        <h2 className="text-lg">{applications.howToApply}</h2>
        {/* The pack's one action, in the outline look (A2-22): applying is on their site. */}
        <ButtonLink href={university.applyUrl} variant="secondary" newTab className="self-start">
          {university.applicationRoute === 'cao'
            ? applications.applyViaCao
            : applications.applyAt(university.shortName)}
          <span className="sr-only"> {common.opensInNewTab}</span>
        </ButtonLink>
        {window ? (
          <>
            <div className="flex flex-col gap-1">
              <h3 className="font-bold">{applications.window}</h3>
              {window.academicYear < targetIntake ? (
                <Notice tone="info">{applications.lastCycle(window.academicYear)}</Notice>
              ) : null}
              <p>
                {window.opensOn ? `${applications.opens(formatDate(window.opensOn))} · ` : ''}
                {applications.closes(formatDate(window.closesOn))}
              </p>
            </div>
            {window.earlierClosings.length > 0 ? (
              <div className="flex flex-col gap-1">
                <h3 className="font-bold">{applications.earlier}</h3>
                <ul className="list-disc pl-6">
                  {window.earlierClosings.map((e) => (
                    <li key={e.scope}>
                      {e.scope}: {formatDate(e.closesOn)}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <div className="flex flex-col gap-1">
              <p>
                <strong>{applications.fee}: </strong>
                {window.feeZar === null
                  ? common.unknown
                  : window.feeZar === 0
                    ? common.free
                    : common.rand(window.feeZar)}
              </p>
              {window.feeNote ? <p className="text-sm">{window.feeNote}</p> : null}
              {window.grade11ResultsAccepted ? <p>{applications.grade11}</p> : null}
            </div>
            <div>
              <SourceLink href={window.sourceUrl} row />
            </div>
          </>
        ) : null}
      </Card>

      <Card className="flex flex-col gap-3">
        <h2 className="text-lg">{applications.status}</h2>
        {/* Two equal columns from a tablet's width, so the status field isn't a sliver. */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={applications.status}>
            {({ id }) => (
              <Select
                id={id}
                value={status}
                onChange={(e) => {
                  const next = e.target.value as ApplicationStatus;
                  setStatus(next);
                  void save({ status: next });
                }}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {applications.statuses[s]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label={applications.reference}>
            {({ id }) => (
              <Input
                id={id}
                value={reference}
                maxLength={40}
                onChange={(e) => setReference(e.target.value)}
                onBlur={() => save({ reference: reference.trim() || null })}
              />
            )}
          </Field>
        </div>
      </Card>

      <Card className="flex flex-col gap-3">
        <h2 className="text-lg">{applications.checklist}</h2>
        <ul className="flex flex-col gap-1">
          {checklist.map((c) => (
            <li key={c.item}>
              <label htmlFor={`pack-${c.item}`} className="flex min-h-11 items-center gap-3">
                <Checkbox
                  id={`pack-${c.item}`}
                  checked={c.done}
                  onChange={(e) => tick(c.item, e.target.checked)}
                />
                <span>
                  {applications.checklistItems[c.item as keyof typeof applications.checklistItems]}
                </span>
              </label>
            </li>
          ))}
        </ul>
        <p className="text-sm text-muted">{applications.certifiedNote}</p>
      </Card>
      {needsNbt ? (
        <Notice tone="info" title={applications.nbt}>
          <p>{applications.nbtLead}</p>
          <p>
            <a href="https://www.nbt.ac.za/" target="_blank" rel="noopener noreferrer">
              {applications.nbtBook}
              <span className="sr-only"> {common.opensInNewTab}</span>
            </a>
          </p>
        </Notice>
      ) : null}

      <ul className="grid gap-6 md:grid-cols-2">
        {application.programmes.map((p) => (
          <ProgrammeCard key={p.programmeId} result={p} />
        ))}
      </ul>
    </Page>
  );
}
