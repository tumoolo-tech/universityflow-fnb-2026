import { en } from '@universityflow/content/app';
import type { SafetyNoteView } from '@universityflow/ui';
import { StyleSheet, View } from 'react-native';
import { theme } from '../lib/theme';
import { formatOfferDate } from './offer-card';
import { Badge, Body, CallButton, SectionTitle, SourceLink } from './ui';

/**
 * A university's safety notes in the app (planning.md §11, Phase 5e-3), as on the web: its own
 * words with a heavy left rule (as offer conditions), its area and dates, what to do, and one-tap
 * calls to campus security, 10111 and 112, each named for VoiceOver and TalkBack. Text only: never
 * a zone on a map. A note with nobody to call is not shown. Nothing animates.
 */

const callable = (note: SafetyNoteView) => note.security.length > 0 && note.emergency.length > 0;

/** The standing line on every campus tour and checklist: no note is not a promise. */
export function NoWarningLine() {
  return (
    <Body pair="card" strong testID="no-warning">
      {en.safetyNotes.noWarning}
    </Body>
  );
}

export function SafetyNotesView({
  notes,
  universityName,
  title,
}: {
  notes: ReadonlyArray<SafetyNoteView> | undefined;
  universityName: string;
  title: string;
}) {
  const t = en.safetyNotes;
  const shown = (notes ?? []).filter(callable);
  if (shown.length === 0) return null;
  return (
    <View style={styles.section} testID="safety-notes">
      <SectionTitle>{title}</SectionTitle>
      {shown.map((note) => (
        <View key={note.id} style={styles.note} testID={`safety-note-${note.id}`}>
          <Body pair="card" small>
            {t.says(universityName)}
          </Body>
          {note.draft ? <Badge tone="warning">{en.common.draftBadge}</Badge> : null}
          <View style={styles.quote} testID={`safety-quote-${note.id}`}>
            <Body pair="sunk">{note.quote}</Body>
          </View>
          {note.area ? (
            <Body pair="card" small>
              {t.area(note.area)}
            </Body>
          ) : null}
          {note.days || note.hours ? (
            <Body pair="card" small>
              {t.when(note.days, note.hours)}
            </Body>
          ) : null}
          <Body pair="cardMuted" small>
            {note.checkedOn ? t.lastChecked(formatOfferDate(note.checkedOn)) : t.notCheckedYet}
          </Body>
          {note.publishedOn ? (
            <Body pair="cardMuted" small>
              {t.publishedOn(formatOfferDate(note.publishedOn))}
            </Body>
          ) : null}
          <SectionTitle>{t.whatToDoTitle}</SectionTitle>
          <Body pair="card" small>
            {t.whatToDo[note.kind]}
          </Body>
          <SectionTitle>{t.whoToCallTitle}</SectionTitle>
          {[...note.security, ...note.emergency].map((line) => (
            <CallButton
              key={line.id}
              phone={line.phone}
              label={t.call(line.phone)}
              context={line.campusName ? `${line.name}, ${line.campusName}` : line.name}
            />
          ))}
          <SourceLink url={note.sourceUrl} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: theme.space['2'] },
  note: { gap: theme.space['2'] },
  quote: {
    padding: theme.space['3'],
    backgroundColor: theme.color.surfaceSunk,
    borderLeftWidth: theme.border.rule,
    borderLeftColor: theme.color.lineStrong,
  },
});
