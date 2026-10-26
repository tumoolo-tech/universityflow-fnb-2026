import { dialable } from '@universityflow/catalogue/client';
import { en } from '@universityflow/content/app';
import type { MyModulesArtifact } from '@universityflow/ui';
import { useRouter } from 'expo-router';
import { type ReactNode, useState } from 'react';
import { Linking, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { theme } from '../lib/theme';
import { formatOfferDate } from './offer-card';
import { Badge, Body, Button, Card, Heading, Notice, SectionTitle, SourceLink } from './ui';
import { WithUniversityMark } from './university-mark';

/**
 * My modules in the app (Phase 5c), the same artifact as the web's (apps/web/components/
 * modules.tsx). Every difference and its wording, who to see, the message and the last day to
 * change were decided by code (packages/admissions, packages/agent's builder, packages/content);
 * this only lays them out. **No verdict without a curriculum record.** Nothing animates.
 *
 * The message is handed to the phone's share sheet (React Native's `Share`), which offers "Copy"
 * beside email and chat apps: the app has no clipboard module, and adding one isn't needed. The
 * message is also selectable text, so it can be copied by hand.
 */

const m = en.modules;

/** A date and time in South Africa, e.g. "16 Feb 2027, 18:00". */
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-ZA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Africa/Johannesburg',
  });
}

const NO_VERDICT = {
  'no-curriculum': m.noCurriculum,
  'no-programme': m.noProgramme,
  'not-first-year': m.notFirstYear,
} as const;

const term = (t: keyof typeof m.terms | null) => (t ? m.terms[t] : m.notSure);

/**
 * Items with their place in the list, which is fixed (the server's order) and is their identity:
 * a code can repeat (registered twice), and so can a difference's kind.
 */
const numbered = <T,>(items: ReadonlyArray<T>) => items.map((item, n) => ({ n, item }));

const open = (url: string) => void Linking.openURL(url).catch(() => undefined);

/** A tappable email, phone number or page, its kind in the accessible name (WCAG 2.4.4). */
function ContactLink({ label, text, url }: { label: string; text: string; url: string }) {
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${label}: ${text}`}
      onPress={() => open(url)}
      style={styles.link}
    >
      <Text style={[theme.text.body, styles.linkText, { color: theme.on('cardBrand').color }]}>
        {text}
      </Text>
    </Pressable>
  );
}

function CopyMessage({ message }: { message: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <View style={{ gap: theme.space['2'] }}>
      <View style={styles.sunk}>
        <Text selectable style={[theme.text.small, theme.on('sunk')]} testID="modules-message">
          {message}
        </Text>
      </View>
      <Button
        label={m.copy}
        variant="secondary"
        onPress={() => {
          setFailed(false);
          Share.share({ message }).catch(() => setFailed(true));
        }}
      />
      {failed ? <Notice tone="warning">{m.copyFailed}</Notice> : null}
    </View>
  );
}

function WhoToSee({ artifact }: { artifact: MyModulesArtifact }) {
  const { office } = artifact;
  return (
    <View style={styles.section}>
      <SectionTitle>{m.whoTitle}</SectionTitle>
      {office ? (
        <View style={styles.section} testID="modules-office">
          <Body pair="card">{m.whoLead(office.faculty)}</Body>
          {office.draft ? <Badge tone="warning">{en.common.draftBadge}</Badge> : null}
          <Body pair="card" small strong>
            {m.where}
          </Body>
          <Body pair="card">{office.where}</Body>
          {office.hours ? (
            <>
              <Body pair="card" small strong>
                {m.hours}
              </Body>
              <Body pair="card">{office.hours}</Body>
            </>
          ) : null}
          {office.email ? (
            <ContactLink label={m.email} text={office.email} url={`mailto:${office.email}`} />
          ) : null}
          {office.phone ? (
            <ContactLink
              label={m.phone}
              text={office.phone}
              url={`tel:${dialable(office.phone)}`}
            />
          ) : null}
          <SourceLink url={office.contactUrl} context={office.faculty}>
            {m.contactPage}
          </SourceLink>
        </View>
      ) : (
        <Body pair="card">{m.noOffice}</Body>
      )}
    </View>
  );
}

function Deadlines({
  artifact,
  remindersOn,
}: {
  artifact: MyModulesArtifact;
  remindersOn: boolean | undefined;
}) {
  const { deadlines } = artifact;
  const unpublished = deadlines.unpublishedTerms.map((t) => m.deadlineScopes[t]).join(', ');
  return (
    <View style={styles.section} testID="modules-deadline">
      <SectionTitle>{m.deadlineTitle}</SectionTitle>
      {deadlines.status === 'none' ? (
        <Body pair="card">{m.noDeadline(artifact.academicYear)}</Body>
      ) : (
        <>
          {deadlines.deadlines.map((d) => (
            <View key={d.appliesTo} style={styles.row}>
              <Body pair="card">{`${m.deadlineScopes[d.appliesTo]}: ${formatOfferDate(d.lastDay)}`}</Body>
              {d.daysLeft >= 0 ? (
                <Badge tone="accent">{m.daysLeft(d.daysLeft)}</Badge>
              ) : (
                // A badge, as on the web: a Notice would announce it every time the card mounts (A2-16).
                <Badge tone="warning" testID="modules-deadline-passed">
                  {m.deadlinePassed}
                </Badge>
              )}
              {deadlines.draft ? <Badge tone="warning">{en.common.draftBadge}</Badge> : null}
            </View>
          ))}
          {deadlines.sourceUrl ? (
            <SourceLink url={deadlines.sourceUrl}>{m.calendarSource}</SourceLink>
          ) : null}
        </>
      )}
      {unpublished ? (
        <Body pair="card" small>
          {m.unpublished(unpublished)}
        </Body>
      ) : null}
      {artifact.reminderAt ? (
        <Body pair="cardMuted" small>
          {m.reminderSet(formatDateTime(artifact.reminderAt))}
        </Body>
      ) : artifact.differences.length > 0 && deadlines.next && remindersOn === false ? (
        <Body pair="cardMuted" small>
          {m.reminderOff}
        </Body>
      ) : null}
    </View>
  );
}

function ModuleLists({ artifact }: { artifact: MyModulesArtifact }) {
  const router = useRouter();
  return (
    <>
      <View style={styles.section} testID="modules-registered">
        <SectionTitle>{m.registeredTitle}</SectionTitle>
        {numbered(artifact.registered).map(({ n, item: r }) => (
          <View key={n} style={styles.item}>
            <Body pair="card" strong>
              {r.name ? `${r.code}: ${r.name}` : r.code}
            </Body>
            <Body pair="cardMuted" small>
              {r.credits === null ? term(r.term) : `${term(r.term)} · ${m.credits(r.credits)}`}
            </Body>
            {r.inCurriculum === false ? <Badge tone="warning">{m.notInCurriculum}</Badge> : null}
            {/* Phase 6c: each confirmed module opens its card. */}
            <Button
              label={en.moduleCard.open}
              accessibilityLabel={en.moduleCard.openFor(r.code)}
              variant="quiet"
              testID={`open-card-${n}`}
              onPress={() =>
                router.push({
                  pathname: '/module/[code]',
                  params: { code: r.code, registrationId: artifact.registrationId },
                })
              }
            />
          </View>
        ))}
      </View>
      {artifact.expected.length > 0 ? (
        <View style={styles.section} testID="modules-expected">
          <SectionTitle>{m.expectedTitle}</SectionTitle>
          {artifact.expected.map((e) => (
            <View key={e.code} style={styles.item}>
              <Body pair="card" strong>
                {`${[e.code, ...(e.alternativeCodes ?? [])].join(' / ')}: ${e.name}`}
              </Body>
              <Body pair="cardMuted" small>
                {`${e.semester ? m.terms[e.semester] : m.termNotPrinted} · ${m.credits(e.credits)}`}
              </Body>
              <View style={styles.row}>
                <Badge>{e.compulsory ? m.compulsory : m.elective}</Badge>
                <Badge tone={e.registered ? 'success' : 'warning'}>
                  {e.registered ? m.registered : m.notRegistered}
                </Badge>
              </View>
            </View>
          ))}
        </View>
      ) : null}
    </>
  );
}

export function MyModulesCard({
  artifact,
  remindersOn,
  linkToPage,
  children,
}: {
  artifact: MyModulesArtifact;
  remindersOn?: boolean;
  /** In the chat: a way to the My modules screen. */
  linkToPage?: boolean;
  /** The screen's actions (remove). */
  children?: ReactNode;
}) {
  const router = useRouter();
  const { programme, curriculum, credits } = artifact;
  const n = artifact.differences.length;
  return (
    <Card testID="my-modules">
      <Heading>{programme ? programme.name : m.title}</Heading>
      <View style={styles.row}>
        {programme ? (
          <WithUniversityMark name={programme.universityName}>
            <Badge>{programme.universityName}</Badge>
          </WithUniversityMark>
        ) : null}
        <Badge>{m.registeredFor(artifact.academicYear)}</Badge>
        {artifact.includesDrafts ? <Badge tone="warning">{en.common.draftBadge}</Badge> : null}
      </View>

      {artifact.status === 'checked' && curriculum ? (
        <>
          <Body pair="card" small>
            {m.checkedAgainst(curriculum.academicYear)}
          </Body>
          <SourceLink
            url={curriculum.sourceUrl}
            {...(programme ? { context: programme.name } : {})}
          >
            {m.curriculumSource}
          </SourceLink>
          {n === 0 ? (
            <Notice tone="success" testID="modules-verdict">
              {m.matches}
            </Notice>
          ) : (
            <View style={styles.section} testID="modules-differences">
              <SectionTitle>{m.differencesTitle(n)}</SectionTitle>
              {numbered(artifact.differences).map(({ n: i, item: d }) => (
                <View
                  key={i}
                  testID={`modules-difference-${i}`}
                  style={[
                    styles.difference,
                    { backgroundColor: theme.on('warning').backgroundColor },
                  ]}
                >
                  <Body pair="warning">{d.text}</Body>
                </View>
              ))}
            </View>
          )}
          {credits ? (
            <Body pair="card" small>
              {credits.uncounted.length > 0
                ? `${m.totalCredits(credits.registered, credits.min, credits.max)} ${m.uncounted(credits.uncounted.join(', '))}`
                : m.totalCredits(credits.registered, credits.min, credits.max)}
            </Body>
          ) : null}
        </>
      ) : artifact.status !== 'checked' ? (
        <Notice tone="info" testID="modules-no-verdict">
          {NO_VERDICT[artifact.status]}
        </Notice>
      ) : null}

      <WhoToSee artifact={artifact} />
      {artifact.message ? (
        <View style={styles.section}>
          <SectionTitle>{m.messageTitle}</SectionTitle>
          <Body pair="card" small>
            {m.messageLead}
          </Body>
          <CopyMessage message={artifact.message} />
        </View>
      ) : null}
      <Deadlines artifact={artifact} remindersOn={remindersOn} />
      <ModuleLists artifact={artifact} />

      {linkToPage ? (
        <Button
          label={`${en.chat.artifactOpen}: ${m.title}`}
          variant="quiet"
          onPress={() => router.push('/modules')}
        />
      ) : null}
      {children}
    </Card>
  );
}

const styles = StyleSheet.create({
  section: { gap: theme.space['2'] },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: theme.space['2'] },
  item: {
    gap: theme.space['1'],
    paddingVertical: theme.space['2'],
    borderTopWidth: theme.border.thin,
    borderTopColor: theme.color.line,
  },
  difference: {
    padding: theme.space['3'],
    borderRadius: theme.radius.sm,
    // The heavy side rule, as on the web's `border-l-rule` (A2-16).
    borderLeftWidth: theme.border.rule,
    borderLeftColor: theme.color.warning,
  },
  sunk: {
    padding: theme.space['3'],
    borderRadius: theme.radius.sm,
    // A panel in its card: the sunk fill and the card edge (RT-04).
    ...theme.panel,
  },
  link: { minHeight: theme.target, justifyContent: 'center', alignSelf: 'flex-start' },
  linkText: { textDecorationLine: 'underline' },
});
