// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { assessAll, type SubjectMark, whatINeedFor } from '@universityflow/admissions';
import { crisisCard } from '@universityflow/agent';
import { catalogueView } from '@universityflow/catalogue';
import { en, messageText } from '@universityflow/content';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConfirmMarks } from '../app/(app)/documents/confirm-marks';
import { MessagesCard, type MessagingView } from '../app/(app)/me/messages-card';
import { CrisisCard } from '../components/crisis-card';
import { ProgrammeCard } from '../components/programme-card';
import { RecheckCard } from '../components/recheck-card';
import { blockerText, WhatINeedCard } from '../components/what-i-need';

/** A confirmed final Grade 11 report with these marks. */
const g11 = (marks: ReadonlyArray<SubjectMark>) => ({ kind: 'grade-11-final' as const, marks });

afterEach(cleanup);

const VIEW = catalogueView(new Date('2026-10-13T00:00:00Z'), { includeDrafts: true });

describe('CrisisCard', () => {
  it('offers one-tap call links with dialable numbers', () => {
    render(<CrisisCard artifact={crisisCard(VIEW.helplines, ['suicide'])} />);
    expect(screen.getByRole('heading', { name: en.crisis.cardTitle })).toBeTruthy();
    const call = screen.getByRole('link', { name: en.crisis.call('0800 567 567') });
    expect(call.getAttribute('href')).toBe('tel:0800567567');
  });

  it('still tells the learner where to go when no number is verified yet', () => {
    render(<CrisisCard artifact={{ kind: 'crisis-card', helplines: [] }} />);
    expect(screen.getByText(en.crisis.noVerifiedNumbers)).toBeTruthy();
    // No line to call, so no promise about calling (A10-11).
    expect(screen.queryByText(en.crisis.cardLead)).toBeNull();
  });

  it('says "any time" only when every support line shown is open 24 hours (A10-11)', () => {
    render(<CrisisCard artifact={crisisCard(VIEW.helplines, ['suicide'])} />);
    expect(screen.getByText(en.crisis.cardLead)).toBeTruthy();
    cleanup();
    const someHours = VIEW.helplines.map((h) =>
      h.id === 'sadag-suicide-crisis' ? { ...h, hours: 'Weekdays, 8am to 8pm' } : h,
    );
    render(<CrisisCard artifact={crisisCard(someHours, ['suicide'])} />);
    expect(screen.queryByText(en.crisis.cardLead)).toBeNull();
    expect(screen.getByText(en.crisis.cardLeadSetHours)).toBeTruthy();
  });
});

describe('ProgrammeCard', () => {
  it('says exactly what to improve, and labels unverified data', () => {
    const results = assessAll(
      VIEW,
      g11([
        { subject: 'english-fal', percent: 62 },
        { subject: 'isizulu-hl', percent: 74 },
        { subject: 'mathematics', percent: 58 },
        { subject: 'physical-sciences', percent: 55 },
        { subject: 'life-sciences', percent: 66 },
        { subject: 'geography', percent: 61 },
        { subject: 'life-orientation', percent: 80 },
      ]),
    );
    const close = results.close.find((r) =>
      r.shortfalls.some((s) => s.kind === 'subject' && s.percent !== null),
    );
    if (!close) throw new Error('expected a close programme with a subject gap');
    render(
      <ul>
        <ProgrammeCard result={close} />
      </ul>,
    );
    expect(screen.getByText(en.common.draftBadge)).toBeTruthy();
    expect(screen.getAllByText(/now, needs/).length).toBeGreaterThan(0);
    const link = screen.getByRole('link', { name: `${en.whatINeed.open}: ${close.name}` });
    expect(link.getAttribute('href')).toBe(`/results/what-i-need/${close.programmeId}`);
  });
});

describe('WhatINeedCard (Phase 4c)', () => {
  const learner = [
    { subject: 'english-hl', percent: 58 },
    { subject: 'afrikaans-fal', percent: 62 },
    { subject: 'mathematics', percent: 55 },
    { subject: 'physical-sciences', percent: 48 },
    { subject: 'life-sciences', percent: 64 },
    { subject: 'geography', percent: 69 },
    { subject: 'life-orientation', percent: 85 },
  ] as const;

  it('shows each subject’s mark now, what to aim for, the gap and why, and labels a draft', () => {
    const result = whatINeedFor(VIEW, 'uj-bcom-accounting', g11([...learner]));
    if (!result) throw new Error('fixture programme missing');
    render(<WhatINeedCard result={result} />);
    expect(
      screen.getByRole('heading', { name: `${en.whatINeed.title}: ${result.name}` }),
    ).toBeTruthy();
    expect(screen.getByText(en.common.draftBadge)).toBeTruthy();
    expect(screen.getByText(en.common.draftNotice)).toBeTruthy();
    const table = screen.getByRole('table');
    for (const header of [en.whatINeed.now, en.whatINeed.target, en.whatINeed.gap]) {
      expect(screen.getByRole('columnheader', { name: header })).toBeTruthy();
    }
    expect(table.querySelectorAll('tbody tr')).toHaveLength(learner.length);
    const raised = result.plan.subjects.filter((s) => s.gap > 0);
    for (const s of raised) expect(screen.getAllByText(`+${s.gap}`).length).toBeGreaterThan(0);
    expect(screen.getByText(en.whatINeed.howChosen)).toBeTruthy();
    expect(screen.getByRole('link', { name: new RegExp(en.breakdown.method) })).toBeTruthy();
  });

  it('says plainly when no marks would do it, and why', () => {
    const result = whatINeedFor(
      VIEW,
      'wits-bsceng-civil',
      g11([
        { subject: 'english-hl', percent: 80 },
        { subject: 'mathematical-literacy', percent: 95 },
        { subject: 'geography', percent: 80 },
        { subject: 'history', percent: 80 },
        { subject: 'business-studies', percent: 80 },
        { subject: 'isizulu-fal', percent: 80 },
        { subject: 'life-orientation', percent: 80 },
      ]),
    );
    if (!result) throw new Error('fixture programme missing');
    expect(result.plan.status).toBe('unreachable');
    render(<WhatINeedCard result={result} />);
    expect(screen.getByText(en.whatINeed.statuses.unreachable)).toBeTruthy();
    expect(screen.getByText(en.whatINeed.blockers.talkToSomeone)).toBeTruthy();
    expect(screen.getAllByText(/you don’t take it/).length).toBeGreaterThan(0);
  });

  it('words every kind of blocker from packages/content', () => {
    expect(
      blockerText(
        { kind: 'subject-not-taken', subjects: ['mathematics', 'technical-mathematics'] },
        'APS',
      ),
    ).toBe(en.whatINeed.blockers.subjectNotTaken('Mathematics or Technical Mathematics'));
    expect(blockerText({ kind: 'not-enough-subjects', needed: 4, available: 3 }, 'APS')).toBe(
      en.whatINeed.blockers.notEnoughSubjects(4, 3),
    );
    expect(blockerText({ kind: 'no-home-language' }, 'APS')).toBe(
      en.whatINeed.blockers.noHomeLanguage,
    );
    expect(blockerText({ kind: 'no-english' }, 'APS')).toBe(en.whatINeed.blockers.noEnglish);
    expect(blockerText({ kind: 'score-out-of-reach', best: 35, required: 40 }, 'APS')).toBe(
      en.whatINeed.blockers.scoreOutOfReach('APS', 35, 40),
    );
  });
});

describe('RecheckCard (Phase 4c)', () => {
  it('says “Since your June report…” and lists what moved, up and down', () => {
    render(
      <RecheckCard
        recheck={{
          reportKind: 'grade-12-september',
          previousKind: 'grade-12-june',
          createdAt: '2027-09-20T08:00:00.000Z',
          includesDrafts: true,
          counts: {
            qualifyNow: { before: 1, after: 1 },
            onTrack: { before: 0, after: 0 },
            close: { before: 1, after: 1 },
            planB: { before: 0, after: 0 },
          },
          moves: [
            {
              programmeId: 'a',
              name: 'BCom Accounting',
              universityName: 'UJ',
              from: 'close',
              to: 'qualify-now',
              direction: 'up',
            },
            {
              programmeId: 'b',
              name: 'BSc Engineering',
              universityName: 'Wits',
              from: 'qualify-now',
              to: 'close',
              direction: 'down',
            },
          ],
        }}
      />,
    );
    expect(
      screen.getByRole('heading', { name: en.recheck.title(en.reportKinds['grade-12-june']) }),
    ).toBeTruthy();
    expect(screen.getByRole('heading', { name: `${en.recheck.up} (1)` })).toBeTruthy();
    expect(screen.getByRole('heading', { name: `${en.recheck.down} (1)` })).toBeTruthy();
    expect(
      screen.getByText(
        en.recheck.move(en.recheck.standings.close, en.recheck.standings['qualify-now']),
      ),
    ).toBeTruthy();
    expect(screen.getByText(en.common.draftBadge)).toBeTruthy();
  });

  it('says when nothing moved', () => {
    render(
      <RecheckCard
        recheck={{
          reportKind: 'grade-12-june',
          previousKind: 'grade-11-final',
          createdAt: '2027-07-01T08:00:00.000Z',
          includesDrafts: false,
          counts: {
            qualifyNow: { before: 1, after: 1 },
            onTrack: { before: 0, after: 0 },
            close: { before: 0, after: 0 },
            planB: { before: 0, after: 0 },
          },
          moves: [],
        }}
      />,
    );
    expect(screen.getByText(en.recheck.none)).toBeTruthy();
  });
});

describe('a crisis card and a re-check card, each shown twice in the chat (A3-10)', () => {
  it('gives every copy its own ids, and each region is named by its own heading', () => {
    const recheck = {
      reportKind: 'grade-12-september',
      previousKind: 'grade-12-june',
      createdAt: '2027-09-20T08:00:00.000Z',
      includesDrafts: false,
      counts: {
        qualifyNow: { before: 1, after: 1 },
        onTrack: { before: 0, after: 0 },
        close: { before: 1, after: 1 },
        planB: { before: 0, after: 0 },
      },
      moves: [
        {
          programmeId: 'a',
          name: 'Synthetic course A',
          universityName: 'UJ',
          from: 'close',
          to: 'qualify-now',
          direction: 'up',
        },
        {
          programmeId: 'b',
          name: 'Synthetic course B',
          universityName: 'Wits',
          from: 'qualify-now',
          to: 'close',
          direction: 'down',
        },
      ],
    } as const;
    const crisis = crisisCard(VIEW.helplines, ['suicide']);
    const { container } = render(
      <>
        <CrisisCard artifact={crisis} />
        <CrisisCard artifact={crisis} />
        <RecheckCard recheck={recheck} />
        <RecheckCard recheck={recheck} />
      </>,
    );
    const ids = [...container.querySelectorAll('[id]')].map((el) => el.id);
    expect(new Set(ids).size).toBe(ids.length);
    const regions = [...container.querySelectorAll('[aria-labelledby]')];
    // Two crisis cards, two re-check cards, each with an "up" and a "down" list.
    expect(regions).toHaveLength(8);
    for (const region of regions) {
      const heading = document.getElementById(region.getAttribute('aria-labelledby') ?? '');
      expect(heading).not.toBeNull();
      expect(region.contains(heading)).toBe(true);
    }
  });
});

describe('ConfirmMarks (hard rule 6)', () => {
  it('shows every value read for checking, and refuses to save a duplicate subject', async () => {
    const onSaved = vi.fn();
    render(
      <ConfirmMarks
        documentId={null}
        sample
        onSaved={onSaved}
        onCancel={() => undefined}
        draft={{
          warnings: ['partly-unreadable'],
          rows: [
            { nameAsPrinted: 'Maths', subject: 'mathematics', percent: 60, issue: null },
            { nameAsPrinted: 'Wiskunde', subject: 'mathematics', percent: 61, issue: 'duplicate' },
          ],
        }}
      />,
    );
    expect(screen.getByText(en.confirm.sampleLead)).toBeTruthy();
    expect(screen.getByText(en.confirm.warnings['partly-unreadable'])).toBeTruthy();
    expect(screen.getByText(en.confirm.asPrinted('Wiskunde'))).toBeTruthy();
    expect(screen.getByText(en.confirm.issues.duplicate)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: en.confirm.confirm }));
    expect(await screen.findByText(en.confirm.errors.duplicate)).toBeTruthy();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('starts on the report the document prints, else on the newest final one the learner holds (A1-35)', () => {
    const picked = (props: {
      printedKind?: 'grade-10-final' | 'grade-12-june' | null;
      today: Date;
    }) => {
      render(
        <ConfirmMarks
          documentId={null}
          sample={false}
          grade={11}
          today={props.today}
          onSaved={() => undefined}
          onCancel={() => undefined}
          draft={{
            warnings: [],
            printedKind: props.printedKind ?? null,
            rows: [{ nameAsPrinted: 'Maths', subject: 'mathematics', percent: 60, issue: null }],
          }}
        />,
      );
      const value = (screen.getByLabelText(en.documents.kind) as HTMLSelectElement).value;
      cleanup();
      return value;
    };
    const january = new Date('2027-01-08T08:00:00Z');
    const december = new Date('2026-12-02T08:00:00Z');
    // A Grade 10 report uploaded in January, by a learner now in Grade 11.
    expect(picked({ printedKind: 'grade-10-final', today: december })).toBe('grade-10-final');
    expect(picked({ printedKind: 'grade-12-june', today: january })).toBe('grade-12-june');
    expect(picked({ today: january })).toBe('grade-10-final');
    expect(picked({ today: december })).toBe('grade-11-final');
  });

  it('gives every field a label', () => {
    render(
      <ConfirmMarks
        documentId={null}
        draft={null}
        sample={false}
        onSaved={() => undefined}
        onCancel={() => undefined}
      />,
    );
    // Each mark field says which row it belongs to (A3-03), not "Mark (%)" seven times.
    for (let n = 1; n <= 7; n++) {
      expect(
        screen.getByLabelText(en.confirm.percentFor(en.confirm.subjectNumber(n))),
      ).toBeTruthy();
    }
    expect(screen.getByLabelText(en.documents.kind)).toBeTruthy();
  });

  it('names each mark field by its subject and ties each error to its field (A3-03)', () => {
    render(
      <ConfirmMarks
        documentId={null}
        sample={false}
        onSaved={() => undefined}
        onCancel={() => undefined}
        draft={{
          warnings: [],
          rows: [
            { nameAsPrinted: 'Maths', subject: 'mathematics', percent: 140, issue: 'out-of-range' },
            { nameAsPrinted: '???', subject: null, percent: 71, issue: 'unknown-subject' },
          ],
        }}
      />,
    );
    const maths = screen.getByLabelText(en.confirm.percentFor('Mathematics'));
    expect(maths.getAttribute('aria-invalid')).toBe('true');
    const describedBy = (maths.getAttribute('aria-describedby') ?? '').split(' ').filter(Boolean);
    expect(describedBy.map((id) => document.getElementById(id)?.textContent)).toContain(
      en.confirm.issues['out-of-range'],
    );
    // The subject error is tied to the subject picker, not to the mark.
    const second = screen.getByLabelText(en.confirm.subjectNumber(2));
    const ids = (second.getAttribute('aria-describedby') ?? '').split(' ').filter(Boolean);
    expect(ids.map((id) => document.getElementById(id)?.textContent)).toContain(
      en.confirm.issues['unknown-subject'],
    );
    expect(
      screen
        .getByLabelText(en.confirm.percentFor(en.confirm.subjectNumber(2)))
        .getAttribute('aria-describedby'),
    ).toBeNull();
  });
});

describe('MessagesCard: a failed save', () => {
  it('puts the choice back and says so', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ error: 'consent', detail: null }, { status: 403 })),
    );
    try {
      render(
        <MessagesCard
          initial={{
            channels: [{ channel: 'sms', optedIn: false, optedInAt: null, optOutSource: null }],
            maxPerWeek: 2,
            offeredChannels: ['sms'],
          }}
        />,
      );
      const sms = screen.getByLabelText(messageText.channelNames.sms) as HTMLInputElement;
      fireEvent.click(sms);
      expect(await screen.findByText(en.errors.consent)).toBeTruthy();
      expect(sms.checked).toBe(false);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('MessagesCard (planning.md §7.1)', () => {
  const view: MessagingView = {
    channels: [
      { channel: 'sms', optedIn: false, optedInAt: null, optOutSource: 'stop' },
      {
        channel: 'whatsapp',
        optedIn: true,
        optedInAt: '2026-10-14T08:00:00.000Z',
        optOutSource: null,
      },
      { channel: 'push', optedIn: false, optedInAt: null, optOutSource: null },
    ],
    maxPerWeek: 2,
    offeredChannels: ['sms', 'whatsapp'],
  };

  it('labels every choice, says how each came to be, and holds back push until the app', () => {
    render(<MessagesCard initial={view} />);
    const sms = screen.getByLabelText(messageText.channelNames.sms) as HTMLInputElement;
    const push = screen.getByLabelText(messageText.channelNames.push) as HTMLInputElement;
    expect(sms.checked).toBe(false);
    expect(push.disabled).toBe(true);
    expect(screen.getByText(en.me.messages.stoppedByStop)).toBeTruthy();
    expect(screen.getByText(en.me.messages.pushLater)).toBeTruthy();
    expect(screen.getByText(en.me.messages.onSince('14 Oct 2026'))).toBeTruthy();
    expect(screen.getByLabelText(en.me.messages.perWeek)).toBeTruthy();
  });

  it('with push offered, leaves turning it on to the app, and lets the web turn it off', () => {
    const { unmount } = render(
      <MessagesCard initial={{ ...view, offeredChannels: ['sms', 'whatsapp', 'push'] }} />,
    );
    const push = screen.getByLabelText(messageText.channelNames.push) as HTMLInputElement;
    expect(push.disabled).toBe(true);
    expect(screen.getByText(en.me.messages.pushInApp)).toBeTruthy();
    unmount();
    render(
      <MessagesCard
        initial={{
          ...view,
          offeredChannels: ['sms', 'whatsapp', 'push'],
          channels: view.channels.map((c) =>
            c.channel === 'push'
              ? { ...c, optedIn: true, optedInAt: '2026-10-14T08:00:00.000Z' }
              : c,
          ),
        }}
      />,
    );
    const on = screen.getByLabelText(messageText.channelNames.push) as HTMLInputElement;
    expect(on.checked).toBe(true);
    expect(on.disabled).toBe(false);
  });

  /** The text a control's aria-describedby points at. */
  const description = (control: HTMLElement) =>
    (control.getAttribute('aria-describedby') ?? '')
      .split(' ')
      .filter(Boolean)
      .map((id) => document.getElementById(id)?.textContent ?? '')
      .join(' ');

  it('says "not available yet" for an unoffered channel, and "comes with the app" only for push (A1-16)', () => {
    render(<MessagesCard initial={{ ...view, offeredChannels: ['sms'] }} />);
    expect(screen.getAllByText(en.me.messages.pushLater)).toHaveLength(1);
    const push = screen.getByLabelText(messageText.channelNames.push);
    expect(description(push)).toBe(en.me.messages.pushLater);
    const whatsapp = screen.getByLabelText(messageText.channelNames.whatsapp);
    expect(description(whatsapp)).toBe(
      en.me.messages.notOffered(messageText.channelNames.whatsapp),
    );
  });

  it('ties each hint to its checkbox, including why push is disabled (A3-04)', () => {
    render(<MessagesCard initial={view} />);
    const push = screen.getByLabelText(messageText.channelNames.push) as HTMLInputElement;
    expect(push.disabled).toBe(true);
    expect(description(push)).toBe(en.me.messages.pushLater);
    expect(description(screen.getByLabelText(messageText.channelNames.sms))).toBe(
      en.me.messages.stoppedByStop,
    );
    expect(description(screen.getByLabelText(messageText.channelNames.whatsapp))).toBe(
      en.me.messages.onSince('14 Oct 2026'),
    );
  });

  it('keeps one status region mounted and changes only its text (A3-04)', async () => {
    const fetch = vi.fn(async () => Response.json(view));
    vi.stubGlobal('fetch', fetch);
    try {
      render(<MessagesCard initial={view} />);
      const status = screen.getByRole('status');
      expect(status.textContent).toBe('');
      fireEvent.click(screen.getByLabelText(messageText.channelNames.sms));
      expect(await screen.findByText(en.common.saved)).toBe(status);
      expect(screen.getAllByRole('status')).toHaveLength(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('opts in through the API and shows what the server saved', async () => {
    const saved = {
      ...view,
      channels: view.channels.map((c) =>
        c.channel === 'sms' ? { ...c, optedIn: true, optedInAt: '2026-10-15T08:00:00.000Z' } : c,
      ),
    };
    const fetch = vi.fn(async () => Response.json(saved));
    vi.stubGlobal('fetch', fetch);
    try {
      render(<MessagesCard initial={view} />);
      fireEvent.click(screen.getByLabelText(messageText.channelNames.sms));
      expect(await screen.findByText(en.common.saved)).toBeTruthy();
      expect(fetch).toHaveBeenCalledWith(
        '/api/me/messaging',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ channel: 'sms', optedIn: true }),
        }),
      );
      expect(
        (screen.getByLabelText(messageText.channelNames.sms) as HTMLInputElement).checked,
      ).toBe(true);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
