import { render } from '@testing-library/react-native';
import { EmptyState, PageHeader } from '../components/ui';
import { theme } from '../lib/theme';

/**
 * One rhythm in the app, as on the web (docs/design/README.md, "One rhythm"): every signed-in
 * screen's title comes with its lead through `PageHeader` (muted, close under the title), and a
 * screen with nothing to show says so one way, `EmptyState`, as the home's empty cards do. Before,
 * each screen set a title and a full-ink lead apart like any other line, and an empty list was a
 * bare sentence. Synthetic text throughout.
 */

// The app's tsconfig has no Node types (gotcha 28): just the little of fs and path read here.
declare const require: (id: string) => unknown;
declare const __dirname: string;
const fs = require('node:fs') as {
  readdirSync(
    dir: string,
    options: { withFileTypes: true },
  ): Array<{
    name: string;
    isDirectory(): boolean;
  }>;
  readFileSync(file: string, encoding: 'utf8'): string;
};
const path = require('node:path') as {
  join(...parts: string[]): string;
  relative(from: string, to: string): string;
};

const ROOT = path.join(__dirname, '..');
/**
 * Screens of their own kind, as on the web (sign-in, onboarding), and the home, whose empty cards
 * are where the pattern comes from (its Getting ready tiles show "No offers yet." as a value).
 */
const OWN_KIND = new Set([
  'app/sign-in.tsx',
  'app/index.tsx',
  'components/onboarding.tsx',
  'components/home.tsx',
  'components/ui.tsx',
]);

function files(dir: string): string[] {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) =>
      entry.isDirectory()
        ? files(path.join(dir, entry.name))
        : entry.name.endsWith('.tsx')
          ? [path.join(dir, entry.name)]
          : [],
    );
}

const sources = [...files(path.join(ROOT, 'app')), ...files(path.join(ROOT, 'components'))].map(
  (file) => ({
    name: path.relative(ROOT, file).replaceAll('\\', '/'),
    lines: fs.readFileSync(file, 'utf8').split('\n'),
  }),
);

const HANDMADE_TITLE = /<Title>/;
const EMPTY_COPY = /\.(empty|noReport|memoryEmpty|noGoal)\b/;
const EMPTY_LOOK = /<EmptyState\b|cardMuted/;
const isEmptyLook = (line: string) => EMPTY_LOOK.test(line);

function offending(test: (line: string, i: number, lines: string[]) => boolean): string[] {
  return sources
    .filter(({ name }) => !OWN_KIND.has(name))
    .flatMap(({ name, lines }) =>
      lines.flatMap((line, i) => (test(line, i, lines) ? [`${name}:${i + 1}`] : [])),
    );
}

describe('one rhythm for every signed-in screen', () => {
  it('finds the screens', () => {
    expect(sources.length).toBeGreaterThan(30);
    expect(offending((line) => /<PageHeader\b/.test(line)).length).toBeGreaterThanOrEqual(12);
  });

  it('every title comes through PageHeader', () => {
    expect(offending((line) => HANDMADE_TITLE.test(line))).toEqual([]);
  });

  it('every screen shows its title on the screen, not only in the navigation bar', () => {
    // The chat has a hero of its own (docs/design §2b); the rest are routing files.
    const notScreens = new Set(['app/chat.tsx', 'app/_layout.tsx', 'app/+native-intent.tsx']);
    const untitled = sources
      .filter(({ name }) => name.startsWith('app/') && !OWN_KIND.has(name) && !notScreens.has(name))
      .filter(({ lines }) => !lines.some((line) => /<PageHeader\b/.test(line)))
      .map(({ name }) => name);
    expect(untitled).toEqual([]);
  });

  it('"nothing yet" is said one way: the empty state, or a muted line in a card', () => {
    expect(
      offending(
        // The look may sit up to four lines above, once an `action` wraps the opening tag.
        (line, i, lines) =>
          EMPTY_COPY.test(line) && !lines.slice(Math.max(0, i - 4), i + 1).some(isEmptyLook),
      ),
    ).toEqual([]);
  });

  it('the checks are proven on broken examples', () => {
    expect(HANDMADE_TITLE.test('      <Title>{t.title}</Title>')).toBe(true);
    const bare = '      {data.offers.length === 0 ? <Body>{t.empty}</Body> : null}';
    expect(EMPTY_COPY.test(bare) && !EMPTY_LOOK.test(bare)).toBe(true);
    expect(EMPTY_LOOK.test('<EmptyState>{t.empty}</EmptyState>')).toBe(true);
  });
});

describe('the primitives', () => {
  it('PageHeader: a header title and its lead in the muted page colour', async () => {
    const screen = await render(<PageHeader title="A title" lead="A lead" />);
    expect(screen.getByRole('header', { name: 'A title' })).toBeTruthy();
    expect(screen.getByText('A lead')).toHaveStyle({ color: theme.on('pageMuted').color });
  });

  it('EmptyState: a card with one muted sentence and at most one outline button', async () => {
    const onPress = jest.fn();
    const screen = await render(
      <EmptyState action={{ label: 'Go somewhere', onPress }}>Nothing yet.</EmptyState>,
    );
    expect(screen.getByTestId('empty-state')).toBeTruthy();
    expect(screen.getByText('Nothing yet.')).toHaveStyle({ color: theme.on('cardMuted').color });
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Go somewhere' })).toBeTruthy();
  });

  it('an outline button is calm, as on the web: ink text in a lineStrong outline', async () => {
    const screen = await render(
      <EmptyState action={{ label: 'Go somewhere', onPress: jest.fn() }}>Nothing yet.</EmptyState>,
    );
    expect(screen.getByRole('button', { name: 'Go somewhere' })).toHaveStyle({
      borderColor: theme.color.lineStrong,
    });
    expect(screen.getByText('Go somewhere')).toHaveStyle({ color: theme.color.ink });
  });

  it('EmptyState without an action: the sentence alone', async () => {
    const screen = await render(<EmptyState>Nothing yet.</EmptyState>);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });
});
