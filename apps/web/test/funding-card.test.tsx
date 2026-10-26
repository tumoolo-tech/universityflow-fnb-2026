// @vitest-environment jsdom

import { cleanup, render, screen, within } from '@testing-library/react';
import type { Nsfas } from '@universityflow/catalogue';
import { applications, common, en, funding } from '@universityflow/content';
import { afterEach, describe, expect, it } from 'vitest';
import { FundingView } from '../app/(app)/funding/funding-view';
import { FundingCard, type FundingCardProps } from '../components/funding-card';
import { formatDate } from '../lib/client/api';
import { fundingWindow } from '../lib/funding-window';

/**
 * RT-05 (the owner's run-through, 2026-10-25): the NSFAS card "feels like reading one thing".
 * The card for any bursary record: the deadline first, with the days left while it is open; the
 * key facts as a short list to scan; "Apply on …" as the one primary button; the longer rule
 * (NSFAS's N+) behind a disclosure. Every fact from the record, every word from en.funding.
 * A synthetic record throughout: the facts here are made up, so a component that typed any of
 * NSFAS's real numbers would fail.
 */

afterEach(cleanup);

const RECORD: Nsfas = {
  sourceUrl: 'https://funder.example.org/rules',
  academicYear: 2031,
  opensOn: '2030-09-01',
  closesOn: '2030-10-31',
  incomeThresholdZar: 123_000,
  incomeThresholdDisabilityZar: 456_000,
  sassaNote: 'Synthetic note about grant households.',
  documents: ['Synthetic document one', 'Synthetic document two'],
  nPlusRule: 'Synthetic rule about how long the funding lasts.',
  applyUrl: 'https://apply.funder.example.org/start',
};

describe('fundingWindow: where the window stands today, from the record’s dates only', () => {
  it('is open, with the days left, from the day it opens to the day it closes', () => {
    expect(fundingWindow(RECORD, '2030-10-25')).toEqual({
      state: 'open',
      opensOn: '2030-09-01',
      closesOn: '2030-10-31',
      daysLeft: 6,
    });
    expect(fundingWindow(RECORD, '2030-09-01')).toMatchObject({ state: 'open', daysLeft: 60 });
    expect(fundingWindow(RECORD, '2030-10-31')).toMatchObject({ state: 'open', daysLeft: 0 });
  });

  it('is coming, with the days until it opens, before its first day', () => {
    expect(fundingWindow(RECORD, '2030-08-29')).toEqual({
      state: 'upcoming',
      opensOn: '2030-09-01',
      closesOn: '2030-10-31',
      daysToOpen: 3,
    });
  });

  it('is closed after its last day', () => {
    expect(fundingWindow(RECORD, '2030-11-01')).toEqual({
      state: 'closed',
      closesOn: '2030-10-31',
    });
  });

  it('is open with no published opening day, and unknown with no closing day: never a guess', () => {
    expect(fundingWindow({ opensOn: null, closesOn: '2030-10-31' }, '2030-01-01')).toMatchObject({
      state: 'open',
      opensOn: null,
      daysLeft: 303,
    });
    expect(fundingWindow({ opensOn: '2030-09-01', closesOn: null }, '2030-10-01')).toEqual({
      state: 'unknown',
    });
  });
});

const props = (today: string, extra: Partial<FundingCardProps> = {}): FundingCardProps => ({
  title: 'Synthetic bursary',
  academicYear: RECORD.academicYear,
  draft: false,
  window: fundingWindow(RECORD, today),
  facts: [
    { text: funding.threshold(common.rand(RECORD.incomeThresholdZar)) },
    { lead: funding.sassa, text: RECORD.sassaNote },
  ],
  applyUrl: RECORD.applyUrl,
  sourceUrl: RECORD.sourceUrl,
  detail: { title: funding.nPlus, body: RECORD.nPlusRule },
  ...extra,
});

describe('FundingCard (RT-05)', () => {
  it('puts the deadline first and prominent, with the days left while it is open', () => {
    render(<FundingCard {...props('2030-10-25')} />);
    const card = screen.getByRole('region', { name: 'Synthetic bursary' });
    const deadline = within(card).getByRole('region', { name: funding.deadline });
    expect(within(deadline).getByText(applications.closes(formatDate('2030-10-31')))).toBeTruthy();
    expect(within(deadline).getByText(funding.daysLeft(6))).toBeTruthy();
    expect(within(deadline).getByText(funding.openedOn(formatDate('2030-09-01')))).toBeTruthy();
    // First after the card's head: before the facts, the action and the detail.
    const facts = within(card).getByRole('list', { name: funding.who });
    expect(deadline.compareDocumentPosition(facts) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // The closing date is the biggest words in the card after its title.
    expect(
      within(deadline).getByText(applications.closes(formatDate('2030-10-31'))).className,
    ).toMatch(/\btext-2xl\b/);
  });

  it('says how long until it opens, and that it has closed, never a count past the end', () => {
    render(<FundingCard {...props('2030-08-29')} />);
    expect(screen.getByText(funding.opensIn(3))).toBeTruthy();
    expect(screen.getByText(applications.closes(formatDate('2030-10-31')))).toBeTruthy();
    cleanup();
    render(<FundingCard {...props('2030-11-02')} />);
    expect(screen.getByText(funding.closedOn(formatDate('2030-10-31')))).toBeTruthy();
    expect(screen.getByText(funding.closedNext)).toBeTruthy();
    expect(screen.queryByText(/days? left/)).toBeNull();
  });

  it('says the dates are not published when the record has no closing day', () => {
    render(
      <FundingCard
        {...props('2030-10-25', {
          window: fundingWindow({ opensOn: null, closesOn: null }, '2030-10-25'),
        })}
      />,
    );
    expect(screen.getByText(funding.datesUnknown)).toBeTruthy();
  });

  it('lists the key facts from the record, one item each, to scan', () => {
    render(<FundingCard {...props('2030-10-25')} />);
    const facts = screen.getByRole('list', { name: funding.who });
    const items = within(facts).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]?.textContent).toBe(funding.threshold(common.rand(123_000)));
    expect(within(items[1] as HTMLElement).getByText(funding.sassa)).toBeTruthy();
    expect(within(items[1] as HTMLElement).getByText(RECORD.sassaNote)).toBeTruthy();
  });

  it('makes “Apply on <the record’s site>” the one primary button, opening in a new tab', () => {
    render(<FundingCard {...props('2030-10-25')} />);
    const apply = screen.getByRole('link', {
      name: new RegExp(`^${funding.applyOn('apply.funder.example.org')}`),
    });
    expect(apply.getAttribute('href')).toBe(RECORD.applyUrl);
    expect(apply.getAttribute('target')).toBe('_blank');
    expect(apply.className).toMatch(/\bbg-brand\b/);
    // The only filled button in the card.
    const card = screen.getByRole('region', { name: 'Synthetic bursary' });
    expect(card.querySelectorAll('.bg-brand')).toHaveLength(1);
    expect(
      within(card).getByRole('link', { name: new RegExp(common.officialSource) }),
    ).toBeTruthy();
  });

  it('keeps the longer rule secondary: behind a closed disclosure, after the action', () => {
    render(<FundingCard {...props('2030-10-25')} />);
    const summary = screen.getByText(funding.nPlus);
    const details = summary.closest('details');
    expect(details).toBeTruthy();
    expect(details?.open).toBe(false);
    expect(within(details as HTMLElement).getByText(RECORD.nPlusRule)).toBeTruthy();
    const apply = screen.getByRole('link', {
      name: new RegExp(`^${funding.applyOn('apply.funder.example.org')}`),
    });
    expect(
      apply.compareDocumentPosition(details as Node) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('labels a draft record and leaves a slot for the funder’s logo (decorative beside the name)', () => {
    const { container } = render(
      <FundingCard
        {...props('2030-10-25', {
          draft: true,
          logo: { src: '/demo-logos/funders/x.svg', backing: 'light', width: 120, height: 40 },
        })}
      />,
    );
    expect(screen.getByText(common.draftBadge)).toBeTruthy();
    const logo = container.querySelector('.uf-demo-logo img');
    expect(logo?.getAttribute('src')).toBe('/demo-logos/funders/x.svg');
    expect(logo?.getAttribute('alt')).toBe('');
    // A4-22: lazy, at low priority, sized before it arrives.
    expect(logo?.getAttribute('loading')).toBe('lazy');
    expect(logo?.getAttribute('decoding')).toBe('async');
    expect(logo?.getAttribute('fetchpriority')).toBe('low');
    expect(logo?.getAttribute('width')).toBe('120');
    expect(logo?.getAttribute('height')).toBe('40');
    cleanup();
    const { container: none } = render(<FundingCard {...props('2030-10-25')} />);
    expect(none.querySelector('.uf-demo-logo')).toBeNull();
  });
});

describe('the Funding page draws NSFAS on the funding card', () => {
  it('shows the record’s deadline, facts and rule in the new order, and keeps the checklist', () => {
    render(<FundingView nsfas={RECORD} draft={false} done={[]} today="2030-10-25" />);
    const card = screen.getByRole('region', { name: en.funding.nsfas });
    expect(within(card).getByText(funding.daysLeft(6))).toBeTruthy();
    const facts = within(card).getByRole('list', { name: funding.who });
    expect(facts.textContent).toContain(funding.threshold(common.rand(123_000)));
    expect(facts.textContent).toContain(funding.thresholdDisability(common.rand(456_000)));
    expect(facts.textContent).toContain(RECORD.sassaNote);
    expect(within(card).getByText(RECORD.nPlusRule).closest('details')).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: 'Synthetic document one' })).toBeTruthy();
  });
});
