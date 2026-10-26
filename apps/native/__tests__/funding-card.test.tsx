import { render } from '@testing-library/react-native';
import { en } from '@universityflow/content/app';
import type { FundingArtifact } from '@universityflow/ui';
import { ArtifactCard } from '../components/artifact-card';

/**
 * The funding card in the app's chat: NSFAS's checklist count, and how many other bursaries the
 * tool returned (feat/bursaries). The list itself is on the web's /funding.
 */

type Entry = NonNullable<FundingArtifact['bursaries']>[number];

const entry = (id: string): Entry => ({
  status: 'open',
  bursary: {
    sourceUrl: 'https://example.org/bursary',
    academicYear: 2027,
    id,
    name: 'Synthetic Bursary',
    funder: 'Synthetic Funder',
    funderKind: 'foundation',
    who: ['Synthetic learners'],
    fields: ['engineering'],
    fieldsAsPrinted: 'Engineering',
    covers: null,
    opensOn: '2026-06-01',
    closesOn: '2026-12-01',
    windowNote: null,
    howToApply: 'Online.',
    applyUrl: 'https://example.org/apply',
    workBack: { kind: 'not-stated', terms: null },
  },
});

describe('the funding card in the chat', () => {
  it('counts the other bursaries beside NSFAS', async () => {
    const artifact: FundingArtifact = {
      kind: 'funding',
      nsfas: null,
      checklist: [],
      bursaries: [entry('a'), entry('b')],
    };
    const screen = await render(<ArtifactCard artifact={artifact} />);
    expect(screen.getByText(new RegExp(en.funding.bursariesCount(2)))).toBeTruthy();
  });

  it('shows no count on a card saved before bursaries were added', async () => {
    const screen = await render(
      <ArtifactCard artifact={{ kind: 'funding', nsfas: null, checklist: [] }} />,
    );
    expect(screen.queryByText(/other bursar/)).toBeNull();
  });
});
