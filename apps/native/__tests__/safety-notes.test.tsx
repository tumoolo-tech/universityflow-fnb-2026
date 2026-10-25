import { fireEvent, render, within } from '@testing-library/react-native';
import { en } from '@universityflow/content/app';
import type { CampusTourArtifact, FirstWeekArtifact, SafetyNoteView } from '@universityflow/ui';
import { Linking, StyleSheet } from 'react-native';
import { CampusTourView, FirstWeekView } from '../components/campus';
import { formatOfferDate } from '../components/offer-card';
import { SafetyNotesView } from '../components/safety-notes';
import { theme } from '../lib/theme';

/** Safety notes in the app (Phase 5e-3). Synthetic records only (hard rule 4). */

const t = en.safetyNotes;

const note = (overrides: Partial<SafetyNoteView> = {}): SafetyNoteView => ({
  id: 'wits-test-walk-in-groups',
  kind: 'walk-in-groups',
  quote: 'Test campus advice, quoted exactly.',
  area: 'Test Park / Test Hill',
  days: 'Monday to Friday',
  hours: '18:00 – 06:00',
  publishedOn: '2027-11-01',
  checkedOn: '2027-11-30',
  sourceUrl: 'https://www.wits.ac.za/test-safety/',
  draft: false,
  security: [
    {
      id: 'wits-test-security',
      name: 'Test Security',
      campusName: 'Test Campus',
      phone: '011 000 0000',
    },
  ],
  emergency: [
    { id: 'saps-emergency', name: 'Test Police', campusName: null, phone: '10111' },
    { id: 'mobile-emergency', name: 'Test Emergency', campusName: null, phone: '112' },
  ],
  ...overrides,
});

const tour = (overrides: Partial<CampusTourArtifact> = {}): CampusTourArtifact => ({
  kind: 'campus-tour',
  universityId: 'wits',
  universityName: 'Wits',
  basis: 'chosen',
  beforeYouArrive: false,
  includesDrafts: false,
  campuses: [
    {
      id: 'wits-test-campus',
      name: 'Test Campus',
      city: 'Testville',
      mapUrl: null,
      virtualTourUrl: null,
      sourceUrl: 'https://www.wits.ac.za/test-page/',
      draft: false,
      needs: [],
      safetyNotes: [note()],
    },
  ],
  universitySafetyNotes: [
    note({
      id: 'wits-test-advisory',
      kind: 'incident-advisory',
      quote: 'Test university-wide advice.',
      days: null,
      hours: null,
    }),
  ],
  ...overrides,
});

describe('SafetyNotesView', () => {
  it('quotes the university with a heavy left rule, and shows its area, days and dates', async () => {
    const screen = await render(
      <SafetyNotesView notes={[note()]} universityName="Wits" title="Test" />,
    );
    expect(screen.getByRole('header', { name: 'Test' })).toBeTruthy();
    expect(screen.getByText(t.says('Wits'))).toBeTruthy();
    const quote = screen.getByTestId('safety-quote-wits-test-walk-in-groups');
    const style = StyleSheet.flatten(quote.props.style);
    expect(style.borderLeftWidth).toBe(theme.border.rule);
    expect(within(quote).getByText('Test campus advice, quoted exactly.')).toBeTruthy();
    expect(screen.getByText(t.area('Test Park / Test Hill'))).toBeTruthy();
    expect(screen.getByText(t.when('Monday to Friday', '18:00 – 06:00'))).toBeTruthy();
    expect(screen.getByText(t.lastChecked(formatOfferDate('2027-11-30')))).toBeTruthy();
    expect(screen.getByText(t.publishedOn(formatOfferDate('2027-11-01')))).toBeTruthy();
    expect(screen.getByText(t.whatToDo['walk-in-groups'])).toBeTruthy();
    expect(screen.getByRole('header', { name: t.whatToDoTitle })).toBeTruthy();
    expect(screen.getByRole('header', { name: t.whoToCallTitle })).toBeTruthy();
  });

  it('gives three named one-tap calls for VoiceOver and TalkBack: security, 10111 and 112', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    const screen = await render(
      <SafetyNotesView notes={[note()]} universityName="Wits" title="Test" />,
    );
    const security = screen.getByRole('link', {
      name: 'Call 011 000 0000: Test Security, Test Campus',
    });
    expect(screen.getByRole('link', { name: 'Call 10111: Test Police' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Call 112: Test Emergency' })).toBeTruthy();
    await fireEvent.press(security);
    expect(open).toHaveBeenCalledWith('tel:0110000000');
    expect(screen.getByRole('link', { name: new RegExp(en.common.officialSource) })).toBeTruthy();
    open.mockRestore();
  });

  it('labels a preview draft as not checked', async () => {
    const screen = await render(
      <SafetyNotesView
        notes={[note({ draft: true, checkedOn: null })]}
        universityName="Wits"
        title="Test"
      />,
    );
    expect(screen.getByText(en.common.draftBadge)).toBeTruthy();
    expect(screen.getByText(t.notCheckedYet)).toBeTruthy();
    expect(screen.queryByText(/^Last checked/)).toBeNull();
  });

  it('never shows a note without campus security to call, or without the emergency lines', async () => {
    const screen = await render(
      <SafetyNotesView
        notes={[note({ security: [] }), note({ id: 'x', emergency: [] })]}
        universityName="Wits"
        title="Test"
      />,
    );
    expect(screen.toJSON()).toBeNull();
  });
});

describe('the app’s campus tour and first-week checklist', () => {
  it('say "No warning here doesn’t mean it’s safe." on every tour, with notes or none', async () => {
    const screen = await render(<CampusTourView tour={tour()} />);
    expect(screen.getByText(t.noWarning)).toBeTruthy();
    expect(screen.getAllByText('Test university-wide advice.')).toHaveLength(1);
    expect(screen.getByRole('header', { name: t.wholeUniversity })).toBeTruthy();
    const campus = within(screen.getByTestId('campus-wits-test-campus'));
    expect(campus.getByRole('header', { name: t.campusTitle('Test Campus') })).toBeTruthy();
    expect(campus.getByText('Test campus advice, quoted exactly.')).toBeTruthy();
    await screen.unmount();
    const empty = await render(
      <CampusTourView tour={tour({ campuses: [], universitySafetyNotes: [] })} />,
    );
    expect(empty.getByText(t.noWarning)).toBeTruthy();
  });

  it('show every note in the first-week checklist, beside the safety guidance', async () => {
    const checklist: FirstWeekArtifact = {
      kind: 'first-week',
      universityId: 'wits',
      universityName: 'Wits',
      basis: 'chosen',
      steps: [{ id: 'register', doneAt: null }],
      calendar: null,
      facultyOffice: null,
      includesDrafts: false,
      safetyNotes: [note()],
    };
    const screen = await render(<FirstWeekView checklist={checklist} />);
    expect(screen.getByRole('header', { name: t.title('Wits') })).toBeTruthy();
    expect(screen.getByText('Test campus advice, quoted exactly.')).toBeTruthy();
    expect(screen.getByText(t.noWarning)).toBeTruthy();
  });
});
