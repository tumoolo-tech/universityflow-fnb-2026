import { render, screen } from '@testing-library/react-native';
import { en } from '@universityflow/content/app';
import { Text } from 'react-native';
import { UniversityMark, WithUniversityMark } from '../components/university-mark';
import { theme } from '../lib/theme';

/**
 * The neutral university mark in the app (the owner's decision, option A, 2026-10-23), as on the
 * web: our letters in our greys beside every university's name, never its logo, which shows only
 * with the university's written permission (none today). Beside the name it is decoration,
 * hidden from the screen reader. Views and Text only (no react-native-svg).
 */

// The app's tsconfig has no Node types (gotcha 28): just the little of fs and path read here.
declare const require: (id: string) => unknown;
declare const __dirname: string;
const fs = require('node:fs') as { readFileSync(file: string, encoding: 'utf8'): string };
const path = require('node:path') as { join(...parts: string[]): string };

describe('UniversityMark', () => {
  it('draws our letters in the neutral greys, hidden from the screen reader', async () => {
    await render(<UniversityMark name="UKZN" />);
    expect(screen.queryByText('UKZN')).toBeNull();
    const letters = screen.getByText('UKZN', { includeHiddenElements: true });
    expect(letters).toHaveStyle({ color: theme.color.ink });
    expect(screen.getByTestId('university-mark', { includeHiddenElements: true })).toHaveStyle({
      backgroundColor: theme.color.surfaceSunk,
      borderColor: theme.color.lineStrong,
    });
    expect(screen.queryByTestId('university-logo', { includeHiddenElements: true })).toBeNull();
  });

  it('beside the name, the name is read once', async () => {
    await render(
      <WithUniversityMark name="UJ">
        <Text>UJ</Text>
      </WithUniversityMark>,
    );
    expect(screen.getAllByText('UJ')).toHaveLength(1);
  });

  it('takes the letters from the short name when the full name is shown', async () => {
    await render(
      <WithUniversityMark name="University of the Witwatersrand" short="Wits">
        <Text>University of the Witwatersrand</Text>
      </WithUniversityMark>,
    );
    expect(screen.getByText('Wits', { includeHiddenElements: true })).toBeTruthy();
  });

  it('shows a logo only from the permitted list', async () => {
    await render(<UniversityMark name="UCT" logos={{ UCT: '/logos/uct.png' }} />);
    expect(screen.getByTestId('university-logo', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.queryByText('UCT', { includeHiddenElements: true })).toBeNull();
  });

  it('is named by the university when it stands alone', async () => {
    await render(<UniversityMark name="TUT" alone />);
    expect(screen.getByLabelText('TUT')).toBeTruthy();
    await render(<UniversityMark name="UCT" alone logos={{ UCT: '/logos/uct.png' }} />);
    expect(screen.getByLabelText(en.universityMark.logoAlt('UCT'))).toBeTruthy();
  });
});

/** Every place the app names a university as a label (a badge, a row, a heading) shows the mark. */
const MARKED = [
  'components/home.tsx',
  'components/programme-card.tsx',
  'components/what-i-need.tsx',
  'components/goals.tsx',
  'components/offer-card.tsx',
  'components/my-modules-card.tsx',
  'components/campus.tsx',
  'app/subjects.tsx',
];

describe('where the app names a university', () => {
  it.each(MARKED)('%s shows the mark', (file) => {
    expect(fs.readFileSync(path.join(__dirname, '..', file), 'utf8')).toMatch(
      /<WithUniversityMark\b/,
    );
  });
});
