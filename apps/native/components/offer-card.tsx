import { en } from '@universityflow/content/app';
import type { OfferCardArtifact } from '@universityflow/ui';
import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import type { Pair } from '../lib/theme';
import { theme } from '../lib/theme';
import { Badge, Body, Button, Card, Heading, Notice, SectionTitle, SourceLink } from './ui';
import { WithUniversityMark } from './university-mark';

/**
 * The offer card in the app (Phase 5a), the same artifact as the web's. What kind of offer it is
 * comes from packages/content in plain words: only a final offer is ever called one (§8.5). The
 * conditions are the university's words, shown as quoted; the re-check on final results was
 * decided on the server by packages/admissions (hard rule 2). Nothing animates.
 */

const KIND_TONE: Readonly<Record<OfferCardArtifact['offerKind'], Pair>> = {
  provisional: 'warning',
  conditional: 'warning',
  waitlist: 'info',
  final: 'success',
};

const DAY = {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'Africa/Johannesburg',
} as const;

/** A plain date (YYYY-MM-DD: a reply-by date, a last day) in South African form, e.g. "30 Oct 2026". */
export function formatOfferDate(iso: string): string {
  return new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString('en-ZA', DAY);
}

/**
 * The day of an instant (a tick, a reminder's time) in South Africa. Never the ISO string's own
 * date: that is UTC, so anything between midnight and 02:00 SAST would show the day before (A7-16).
 */
export function formatInstantDay(iso: string): string {
  return new Date(iso).toLocaleDateString('en-ZA', DAY);
}

/** The conditions with their place in the letter: a quoted list, never reordered, words may repeat. */
const numbered = (conditions: ReadonlyArray<string>) =>
  conditions.map((condition, n) => ({ n, condition }));

export function OfferCardView({
  offer,
  remindersOn,
  children,
}: {
  offer: OfferCardArtifact;
  remindersOn?: boolean;
  /** The screen's actions (accept, decline, remove). */
  children?: ReactNode;
}) {
  const t = en.offers;
  const router = useRouter();
  const { programme, finalCheck } = offer;
  const open = offer.status === 'held';
  return (
    <Card testID={`offer-${offer.id}`}>
      <Heading>{programme ? programme.name : t.notAvailable}</Heading>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space['2'] }}>
        <WithUniversityMark name={offer.universityName}>
          <Badge>{offer.universityName}</Badge>
        </WithUniversityMark>
        <Badge tone={KIND_TONE[offer.offerKind]} testID="offer-kind">
          {t.kinds[offer.offerKind]}
        </Badge>
        <Badge>{t.sources[offer.source]}</Badge>
        {programme?.draft ? <Badge tone="warning">{en.common.draftBadge}</Badge> : null}
      </View>
      <Body pair="card" testID="offer-explain">
        {t.explain[offer.offerKind]}
      </Body>
      <Body pair="card" strong testID="offer-status">
        {t.statuses[offer.status]}
      </Body>

      {open ? (
        offer.replyBy === null || offer.daysLeft === null ? (
          <Body pair="card">{t.noReplyBy}</Body>
        ) : offer.daysLeft < 0 ? (
          <Notice tone="warning">{t.replyByPassed}</Notice>
        ) : (
          <>
            <Body pair="card">{t.replyBy(formatOfferDate(offer.replyBy))}</Body>
            <Badge tone="accent">{t.daysLeft(offer.daysLeft)}</Badge>
          </>
        )
      ) : null}
      {open && offer.reminderAt ? (
        <Body pair="cardMuted" small>
          {t.reminderSet(formatInstantDay(offer.reminderAt))}
        </Body>
      ) : open && offer.replyBy !== null && remindersOn === false ? (
        <>
          <Body pair="cardMuted" small>
            {t.reminderOff}
          </Body>
          {/* The web links to About me; in the app, reminders are turned on under Notifications
              (About me here only deletes the account). */}
          <Button
            label={en.notifications.title}
            variant="quiet"
            onPress={() => router.push('/notifications')}
          />
        </>
      ) : null}

      <SectionTitle>{t.conditionsTitle}</SectionTitle>
      {offer.conditions.length === 0 ? (
        <Body pair="cardMuted" small>
          {t.noConditions}
        </Body>
      ) : (
        <>
          <Body pair="cardMuted" small>
            {t.conditionsLead}
          </Body>
          {numbered(offer.conditions).map(({ n, condition }) => (
            // Quoted, as on the web's blockquote: a `border.rule` left rule (A2-16).
            <View key={n} style={styles.quote} testID={`offer-condition-${n}`}>
              <Body pair="sunk">{condition}</Body>
            </View>
          ))}
        </>
      )}

      {offer.checksFinal ? (
        <>
          <SectionTitle>{t.finalTitle}</SectionTitle>
          {finalCheck === null ? (
            <>
              <Body pair="card">{t.finalWaiting}</Body>
              {/* The web's Documents page: in the app, final results go up as a report. */}
              <Button
                label={t.confirmFinal}
                variant="quiet"
                onPress={() => router.push('/upload')}
              />
            </>
          ) : finalCheck.status === 'met' ? (
            <Notice tone="success">{t.finalMet}</Notice>
          ) : finalCheck.status === 'unavailable' ? (
            <Body pair="card">{t.finalUnavailable}</Body>
          ) : (
            <>
              <Notice tone="warning">{t.finalNotMet}</Notice>
              <SectionTitle>{t.planBTitle}</SectionTitle>
              {finalCheck.planB.length === 0 ? (
                <Body pair="card">{t.noPlanB}</Body>
              ) : (
                <>
                  <Body pair="cardMuted" small>
                    {t.planBLead}
                  </Body>
                  {finalCheck.planB.map((p) => (
                    <View
                      key={p.programmeId}
                      style={styles.planB}
                      testID={`plan-b-${p.programmeId}`}
                    >
                      <Body pair="card">
                        {`${p.universityName}: ${p.name} (${en.qualifications[p.qualification]})`}
                      </Body>
                      {/* Unverified (preview only): labelled, as on the web (hard rule 3, A2-14). */}
                      {p.draft ? <Badge tone="warning">{en.common.draftBadge}</Badge> : null}
                    </View>
                  ))}
                </>
              )}
            </>
          )}
        </>
      ) : null}

      {programme ? <SourceLink url={programme.sourceUrl} context={programme.name} /> : null}
      {children}
    </Card>
  );
}

const styles = StyleSheet.create({
  planB: { gap: theme.space['1'] },
  quote: {
    padding: theme.space['3'],
    backgroundColor: theme.color.surfaceSunk,
    borderLeftWidth: theme.border.rule,
    borderLeftColor: theme.color.lineStrong,
  },
});
