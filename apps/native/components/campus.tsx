import { en, type FirstWeekStep, SAFETY_TIPS } from '@universityflow/content/app';
import type {
  CampusPlaceView,
  CampusTourArtifact,
  CrisisCampusLines,
  FirstWeekArtifact,
} from '@universityflow/ui';
import { useRouter } from 'expo-router';
import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { type Pair, theme } from '../lib/theme';
import { formatInstantDay, formatOfferDate } from './offer-card';
import { NoWarningLine, SafetyNotesView } from './safety-notes';
import {
  Badge,
  Body,
  Button,
  CallButton,
  Card,
  Checkbox,
  Heading,
  Notice,
  SectionTitle,
  SourceLink,
} from './ui';
import { WithUniversityMark } from './university-mark';
import { CrisisWalk, MobilityNote, PlaceWayfinding } from './wayfinding';

/**
 * The campus tour, the first-week checklist, the safety guidance and the crisis card's campus
 * lines in the app (Phase 5b): the same artifacts as the web's. Text first, links out: the
 * university's own maps, and "open in maps" in the phone's maps app (owner's decisions 1 and 2),
 * so no map tiles and no media. Every number is dialable with one tap. Nothing animates.
 */

const open = (url: string) => void Linking.openURL(url).catch(() => undefined);

/** A link that opens outside the app (the phone's maps app, a browser, the dialler). */
function OutLink({
  url,
  label,
  accessibilityLabel,
  pair = 'cardBrand',
}: {
  url: string;
  label: string;
  accessibilityLabel?: string;
  pair?: Pair;
}) {
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={() => open(url)}
      style={styles.link}
    >
      <Text style={[theme.text.small, styles.linkText, { color: theme.on(pair).color }]}>
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * Where "Open in maps" goes: Apple Maps on an iPhone, which every iPhone has (A7-18), and the
 * Google link everywhere else. A card saved in a chat before the Apple link existed has only the
 * Google one, which still opens. Null when no location is published (A13-11): no link at all.
 */
export function mapsUrlFor(place: CampusPlaceView): string | null {
  return Platform.OS === 'ios' && place.appleMapsUrl ? place.appleMapsUrl : place.mapsUrl;
}

export function SafetyGuidanceView({ title, lead }: { title: string; lead?: string }) {
  return (
    <View style={styles.section} testID="safety-guidance">
      <Heading>{title}</Heading>
      {lead ? (
        <Body pair="cardMuted" small>
          {lead}
        </Body>
      ) : null}
      {SAFETY_TIPS.map((tip) => (
        <View key={tip} style={styles.tip}>
          <SectionTitle>{en.safety.tips[tip].title}</SectionTitle>
          <Body pair="card" small>
            {en.safety.tips[tip].body}
          </Body>
        </View>
      ))}
    </View>
  );
}

export function CampusTourView({ tour }: { tour: CampusTourArtifact }) {
  const t = en.campus;
  return (
    <Card testID="campus-tour">
      <WithUniversityMark name={tour.universityName}>
        <Heading>{tour.universityName}</Heading>
      </WithUniversityMark>
      <Body pair="cardMuted">
        {tour.basis === 'accepted-offer'
          ? t.fromOffer(tour.universityName)
          : t.exploring(tour.universityName)}
      </Body>
      <NoWarningLine />
      {tour.campuses.length === 0 ? <Notice tone="info">{t.notCheckedYet}</Notice> : null}
      {tour.campuses.length > 0 ? (
        <Body pair="cardMuted" small>
          {t.checkOnSite}
        </Body>
      ) : null}
      {tour.campuses.length > 0 ? <MobilityNote tour={tour} /> : null}
      <SafetyNotesView
        notes={tour.universitySafetyNotes}
        universityName={tour.universityName}
        title={en.safetyNotes.wholeUniversity}
      />
      {tour.campuses.map((campus) => (
        <View key={campus.id} style={styles.section} testID={`campus-${campus.id}`}>
          <Heading level={3}>{t.campusOf(campus.name, campus.city)}</Heading>
          {campus.draft ? <Badge tone="warning">{en.common.draftBadge}</Badge> : null}
          {campus.mapUrl ? <OutLink url={campus.mapUrl} label={t.officialMap} /> : null}
          {campus.virtualTourUrl ? (
            <OutLink url={campus.virtualTourUrl} label={t.virtualTour} />
          ) : null}
          {campus.needs.length === 0 ? <Body pair="card">{t.noPlaces}</Body> : null}
          {campus.needs.map(({ need, places }) => (
            <View key={need} style={styles.section}>
              {/* A header, so a screen reader can jump to "Health and safety" (A3-15). */}
              <SectionTitle>{t.needs[need].title}</SectionTitle>
              {places.map((p) => {
                const mapsUrl = mapsUrlFor(p);
                return (
                  <View key={p.id} style={styles.place} testID={`place-${p.id}`}>
                    <Body pair="sunk" strong>
                      {p.name}
                    </Body>
                    <Badge tone="card">{t.kinds[p.kind]}</Badge>
                    {p.draft ? <Badge tone="warning">{en.common.draftBadge}</Badge> : null}
                    {/* No building or location published (A13-11): no line, no link. */}
                    {p.where ? <Body pair="sunk" small>{`${t.where}: ${p.where}`}</Body> : null}
                    {p.hours ? <Body pair="sunk" small>{`${t.hours}: ${p.hours}`}</Body> : null}
                    {p.phone ? <CallButton phone={p.phone} context={p.name} /> : null}
                    <PlaceWayfinding place={p} />
                    {mapsUrl ? (
                      <OutLink
                        url={mapsUrl}
                        label={t.openInMaps}
                        accessibilityLabel={`${t.openInMaps}: ${p.name}`}
                        pair="sunkBrand"
                      />
                    ) : null}
                    <SourceLink url={p.sourceUrl} context={p.name} pair="sunkBrand" />
                  </View>
                );
              })}
            </View>
          ))}
          <SafetyNotesView
            notes={campus.safetyNotes}
            universityName={tour.universityName}
            title={en.safetyNotes.campusTitle(campus.name)}
          />
        </View>
      ))}
      {tour.campuses.length > 0 &&
      !tour.campuses.some((c) => c.needs.some((n) => n.need === 'health-and-safety')) ? (
        <Body pair="card" small>
          {t.safetyNotChecked}
        </Body>
      ) : null}
      {tour.beforeYouArrive ? (
        <SafetyGuidanceView title={t.beforeYouArriveTitle} lead={t.beforeYouArriveLead} />
      ) : null}
    </Card>
  );
}

/** Where a step leads in the app: My modules (5c) and the campus tour. */
const STEP_ROUTES: Partial<Record<FirstWeekStep, { route: string; label: string }>> = {
  'check-modules': { route: '/modules', label: en.firstWeek.modulesLink },
  'clinic-and-security': { route: '/campus', label: en.firstWeek.campusLink },
};

export function FirstWeekView({
  checklist,
  onToggle,
  busy,
}: {
  checklist: FirstWeekArtifact;
  /** On the screen: ticks or unticks a step. Without it the steps are read-only (the chat). */
  onToggle?: (step: FirstWeekStep, done: boolean) => void;
  busy?: boolean;
}) {
  const router = useRouter();
  const t = en.firstWeek;
  const { calendar, facultyOffice } = checklist;
  const done = checklist.steps.filter((s) => s.doneAt).length;
  return (
    <Card testID="first-week">
      <Heading>{`${t.title}: ${checklist.universityName}`}</Heading>
      <Body pair="card" strong testID="first-week-progress">
        {t.progress(done, checklist.steps.length)}
      </Body>
      <View style={styles.section}>
        <SectionTitle>{t.datesTitle}</SectionTitle>
        {calendar ? (
          <>
            <Body pair="cardMuted" small>
              {t.datesLead}
            </Body>
            {calendar.draft ? <Badge tone="warning">{en.common.draftBadge}</Badge> : null}
            <Body pair="card">
              {calendar.registration.from
                ? t.registration(
                    formatOfferDate(calendar.registration.from),
                    formatOfferDate(calendar.registration.to),
                  )
                : t.registrationCloses(formatOfferDate(calendar.registration.to))}
            </Body>
            {calendar.orientation ? (
              <Body pair="card">
                {t.orientation(
                  formatOfferDate(calendar.orientation.from),
                  formatOfferDate(calendar.orientation.to),
                )}
              </Body>
            ) : null}
            {calendar.changeDeadlines.length === 0 ? (
              <Body pair="card">{t.changeDeadlineUnpublished}</Body>
            ) : (
              calendar.changeDeadlines.map((d) => (
                <Body key={d.appliesTo} pair="card">
                  {t.changeDeadline(t.changeScopes[d.appliesTo], formatOfferDate(d.lastDay))}
                </Body>
              ))
            )}
            <SourceLink url={calendar.sourceUrl} />
          </>
        ) : (
          <Body pair="card">{t.noDates}</Body>
        )}
      </View>
      {checklist.steps.map((step) => {
        const words = t.steps[step.id];
        const link = STEP_ROUTES[step.id];
        return (
          <View key={step.id} style={styles.place} testID={`step-${step.id}`}>
            {onToggle ? (
              <Checkbox
                label={words.title}
                checked={step.doneAt !== null}
                disabled={busy === true}
                pair="sunk"
                onPress={() => onToggle(step.id, step.doneAt === null)}
                testID={`tick-${step.id}`}
              />
            ) : (
              <Body pair="sunk" strong>
                {words.title}
              </Body>
            )}
            {!onToggle && step.doneAt ? <Badge tone="success">{t.done}</Badge> : null}
            <Body pair="sunk" small>
              {words.detail}
            </Body>
            {step.doneAt ? (
              <Body pair="sunk" small>
                {t.doneOn(formatInstantDay(step.doneAt))}
              </Body>
            ) : null}
            {step.id === 'faculty-office' && facultyOffice ? (
              <View style={styles.section}>
                <SectionTitle pair="sunk">
                  {`${t.facultyOfficeTitle}: ${facultyOffice.faculty}`}
                </SectionTitle>
                {facultyOffice.draft ? <Badge tone="warning">{en.common.draftBadge}</Badge> : null}
                <Body pair="sunk" small>{`${en.campus.where}: ${facultyOffice.where}`}</Body>
                {facultyOffice.hours ? (
                  <Body pair="sunk" small>{`${en.campus.hours}: ${facultyOffice.hours}`}</Body>
                ) : null}
                {facultyOffice.phone ? <CallButton phone={facultyOffice.phone} /> : null}
                {facultyOffice.email ? (
                  <OutLink
                    url={`mailto:${facultyOffice.email}`}
                    label={t.email(facultyOffice.email)}
                    pair="sunkBrand"
                  />
                ) : null}
                <OutLink url={facultyOffice.contactUrl} label={t.contactPage} pair="sunkBrand" />
              </View>
            ) : null}
            {link ? (
              <Button
                label={link.label}
                variant="quiet"
                onPress={() => router.push(link.route as never)}
              />
            ) : null}
          </View>
        );
      })}
      <SafetyGuidanceView title={t.safetyTitle} />
      <SafetyNotesView
        notes={checklist.safetyNotes}
        universityName={checklist.universityName}
        title={en.safetyNotes.title(checklist.universityName)}
      />
      <NoWarningLine />
    </Card>
  );
}

/** The crisis card's campus lines: verified clinic, counselling and security, each dialable. */
export function CrisisCampusView({ campus }: { campus: CrisisCampusLines }) {
  return (
    <View style={styles.section} testID="crisis-campus">
      <Heading level={3}>{en.crisis.campusTitle(campus.universityName)}</Heading>
      <Body pair="cardMuted" small>
        {en.crisis.campusLead}
      </Body>
      {campus.lines.map((line) => (
        <View key={line.id} style={styles.place}>
          <Body pair="sunk" strong>
            {line.name}
          </Body>
          <Body pair="sunk" small>
            {`${line.campusName}${line.where ? `: ${line.where}` : ''}${line.hours ? `. ${line.hours}` : ''}`}
          </Body>
          {line.phone ? <CallButton phone={line.phone} context={line.name} /> : null}
          {line.walkUrl ? (
            <CrisisWalk walkUrl={line.walkUrl} appleWalkUrl={line.appleWalkUrl} place={line.name} />
          ) : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: theme.space['2'] },
  tip: { gap: theme.space['1'] },
  place: {
    gap: theme.space['2'],
    padding: theme.space['3'],
    borderRadius: theme.radius.sm,
    backgroundColor: theme.color.surfaceSunk,
  },
  link: { minHeight: theme.target, justifyContent: 'center', alignSelf: 'flex-start' },
  linkText: { textDecorationLine: 'underline' },
});
