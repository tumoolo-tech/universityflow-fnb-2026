import { SCHOOL_GRADES } from '@universityflow/catalogue/client';
import {
  chat,
  common,
  dashboard,
  nav,
  notifications,
  offers,
  onboarding,
  results,
  subjects as subjectsCopy,
} from '@universityflow/content/app';
import {
  type HomeData,
  homeJourney,
  type JourneyStep,
  journeyStepName,
  type NextAction,
  type Verdict,
} from '@universityflow/ui';
import { type ReactNode, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { errorMessage } from '../lib/api';
import { formatDate } from '../lib/format';
import { nativeRoute } from '../lib/routes';
import { type Pair, theme } from '../lib/theme';
import { Avatar } from './profile-look';
import { announce, Badge, Body, Button, Card, Heading, Notice, Radio, RadioGroup } from './ui';
import { WithUniversityMark } from './university-mark';

/**
 * The app's home (docs/design/README.md §2 and §4): the web's dashboard on a phone, from the same
 * `HomeData` (`GET /api/home`) and the same shared rules (`homeJourney`, `journeyStepName`). One
 * column: the welcome, the ask bar, the next step, the journey, the headline number, the cards,
 * the marks over time as a list, and every section grouped by stage. Every number is the
 * learner's own or a "not yet" line. A link the app has no screen for says to use the web.
 */

const VERDICT: Record<Verdict, { label: string; tone: Pair }> = {
  qualifyNow: { label: results.groups.qualifyNow, tone: 'success' },
  onTrack: { label: results.groups.onTrack, tone: 'success' },
  close: { label: results.groups.close, tone: 'warning' },
  planB: { label: results.groups.planB, tone: 'info' },
};

type Go = (route: string) => void;

/** A row that opens a screen: a link to TalkBack and VoiceOver, at least the touch target. */
function LinkRow(props: {
  label: string;
  onPress: () => void;
  accessibilityLabel?: string;
  pair?: Pair;
  children?: ReactNode;
  testID?: string;
}) {
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={props.accessibilityLabel ?? props.label}
      onPress={props.onPress}
      testID={props.testID}
      style={({ pressed }) => [styles.linkRow, pressed ? styles.pressed : null]}
    >
      {props.children ?? (
        <Text style={[theme.text.label, { color: theme.on(props.pair ?? 'cardBrand').color }]}>
          {props.label}
        </Text>
      )}
    </Pressable>
  );
}

function nextLabel(next: NextAction): string {
  const t = dashboard.next;
  return next.id === 'checklist' ? t.checklist(next.universityName) : t[next.id];
}

function NextStep({ next, go }: { next: NextAction; go: Go }) {
  const route = nativeRoute(next.href);
  const label = nextLabel(next);
  return (
    <Card testID="home-next">
      <Text style={[theme.text.caps, { color: theme.on('cardMuted').color }]}>
        {dashboard.next.label}
      </Text>
      {route ? (
        <LinkRow
          label={label}
          accessibilityLabel={`${dashboard.next.label}: ${label}`}
          onPress={() => go(route)}
        >
          <View style={styles.nextRow}>
            <Text style={[theme.text.bodyStrong, styles.grow, { color: theme.color.ink }]}>
              {label}
            </Text>
            <Text style={[theme.text.label, { color: theme.color.brand }]}>
              {dashboard.next.start}
            </Text>
          </View>
        </LinkRow>
      ) : (
        <>
          <Body pair="card" strong>
            {label}
          </Body>
          <Body pair="cardMuted" small>
            {chat.artifactOnWeb}
          </Body>
        </>
      )}
    </Card>
  );
}

/** The number's colours by state: tested pairs (success, primary, ink on the page). */
const STEP_NUMBER: Record<JourneyStep['status'], { color: string; backgroundColor?: string }> = {
  done: theme.on('success'),
  current: theme.on('primary'),
  todo: { color: theme.color.ink },
};

/**
 * One step, as on the web: the same bordered box for every step (the mauve edge only on the
 * current one), its number in a circle, its name in one style, and its state in words.
 */
function StepRow(props: { step: JourneyStep; number: number; name: string; status: string }) {
  const todo = props.step.status === 'todo';
  const colours = STEP_NUMBER[props.step.status];
  return (
    <View
      style={[styles.stepRow, props.step.status === 'current' ? styles.stepCurrent : null]}
      testID={`home-step-box-${props.step.id}`}
    >
      <View
        style={[
          styles.stepNumber,
          { backgroundColor: colours.backgroundColor },
          todo ? styles.stepTodo : null,
        ]}
      >
        <Text
          style={[theme.text.small, { fontWeight: theme.fontWeight.bold, color: colours.color }]}
        >
          {props.number}
        </Text>
      </View>
      <View style={styles.grow}>
        <Text style={[theme.text.label, { color: theme.color.ink }]}>{props.name}</Text>
        <Text style={[theme.text.small, { color: theme.on('cardMuted').color }]}>
          {props.status}
        </Text>
      </View>
    </View>
  );
}

function Journey({ steps, go }: { steps: JourneyStep[]; go: Go }) {
  const t = dashboard.journey;
  return (
    <View testID="home-journey" style={styles.gap2}>
      <Heading pair="page">{t.label}</Heading>
      {steps.map((step, index) => {
        const name = journeyStepName(step);
        const status = t.status[step.status];
        const route = step.status === 'current' ? nativeRoute(step.href) : null;
        return route ? (
          <LinkRow
            key={step.id}
            label={name}
            accessibilityLabel={`${index + 1}. ${name}, ${status}`}
            onPress={() => go(route)}
            testID={`home-step-${step.id}`}
          >
            <StepRow step={step} number={index + 1} name={name} status={status} />
          </LinkRow>
        ) : (
          <View
            key={step.id}
            accessible
            accessibilityLabel={`${index + 1}. ${name}, ${status}`}
            testID={`home-step-${step.id}`}
          >
            <StepRow step={step} number={index + 1} name={name} status={status} />
          </View>
        );
      })}
    </View>
  );
}

function Caps({ children }: { children: string }) {
  return (
    <Text
      accessibilityRole="header"
      style={[theme.text.caps, { color: theme.on('cardMuted').color }]}
    >
      {children}
    </Text>
  );
}

function BigNumber({ children, testID }: { children: ReactNode; testID?: string }) {
  return (
    <Text style={[theme.text.display, { color: theme.color.ink }]} testID={testID}>
      {children}
    </Text>
  );
}

function QualifyCard({ data, go }: { data: HomeData; go: Go }) {
  const t = dashboard.qualify;
  // Grade 10 marks: "on track", and no Plan B (G10-3); before a report, the stage says (G10-5).
  const grade10 = data.qualify ? data.qualify.basis === 'progress' : data.stage === 'grade-10';
  return (
    <Card emphasis>
      <Caps>{grade10 ? t.titleGrade10 : t.title}</Caps>
      {data.qualify?.checked === 0 ? (
        // No course to check the marks against: never a "0" that isn't true (A1-41).
        <Body pair="card">{subjectsCopy.card.unknown}</Body>
      ) : data.qualify ? (
        <>
          <BigNumber testID="home-number">
            {grade10 ? data.qualify.onTrack : data.qualify.now}
          </BigNumber>
          <Body pair="cardMuted">
            {grade10
              ? t.close(data.qualify.close)
              : `${t.close(data.qualify.close)} · ${t.planB(data.qualify.planB)}`}
          </Body>
          <LinkRow label={t.open} onPress={() => go('/results')} />
        </>
      ) : (
        <>
          <Body pair="card">{t.none}</Body>
          <Button label={t.add} variant="secondary" onPress={() => go('/upload')} />
        </>
      )}
      {data.nextPaperDays !== null ? (
        <Body pair="card" strong testID="home-next-paper">
          {dashboard.nextPaper(data.nextPaperDays)}
        </Body>
      ) : null}
    </Card>
  );
}

function RegistrationCard({ data }: { data: HomeData }) {
  const t = dashboard.registration;
  const r = data.registration;
  return (
    <Card emphasis>
      <Caps>{t.title}</Caps>
      {r && !(r.phase === 'closes' && r.days === 0) ? (
        <>
          <BigNumber testID="home-number">{r.days}</BigNumber>
          <Body pair="cardMuted">{r.phase === 'opens' ? t.opens(r.days) : t.closes(r.days)}</Body>
        </>
      ) : r ? (
        <Body pair="card" strong>
          {t.closes(0)}
        </Body>
      ) : (
        <Body pair="card">{t.none}</Body>
      )}
    </Card>
  );
}

/** A second or later year at university (A2-66): past the arrival's first weeks. */
function laterYear(data: HomeData): 'middle' | 'final' | null {
  const group = data.universityYear?.group;
  return group === 'middle' || group === 'final' ? group : null;
}

/** The promo card's words and screen for where the learner is (as the web's). */
function promo(data: HomeData): { title: string; lead: string; route: string; action: string } {
  const t = dashboard.promo;
  // A second or final year plans the rest of the degree: the campus tour is an arrival's (A2-66).
  if (laterYear(data)) {
    return { title: t.planTitle, lead: t.planLead, route: '/goals', action: t.planAction };
  }
  if (data.stage === 'university') {
    return { title: t.campusTitle, lead: t.campusLead, route: '/campus', action: t.campusAction };
  }
  return data.goalProgrammeId
    ? {
        title: t.goalTitle,
        lead: t.goalLead,
        route: `/what-i-need/${data.goalProgrammeId}`,
        action: t.goalAction,
      }
    : { title: t.goalTitle, lead: t.goalLead, route: '/goals', action: t.chooseGoalAction };
}

function PromoCard({ data, go }: { data: HomeData; go: Go }) {
  const { title, lead, route, action } = promo(data);
  return (
    <Card>
      <Heading>{title}</Heading>
      <Body pair="card">{lead}</Body>
      <Button label={action} onPress={() => go(route)} />
    </Card>
  );
}

/**
 * A second or final year's headline (A2-66): the year of study they confirmed, and "Your final
 * year" when the course's duration in the catalogue says so (labelled when not yet verified).
 */
function YearCard({ data }: { data: HomeData }) {
  const t = dashboard.year;
  const year = data.universityYear;
  return (
    <Card emphasis>
      <Caps>{t.title}</Caps>
      <BigNumber testID="home-number">{year?.yearOfStudy}</BigNumber>
      {year?.group === 'final' ? (
        <>
          <Body pair="card" strong>
            {t.final}
          </Body>
          {year.draft ? (
            <View style={styles.badges}>
              <Badge tone="warning">{common.draftBadge}</Badge>
            </View>
          ) : null}
        </>
      ) : null}
    </Card>
  );
}

/** A second or final year's modules (A2-66), in place of "Getting ready". */
function ThisYearCard({ data, go }: { data: HomeData; go: Go }) {
  const t = dashboard.gettingReady;
  return (
    <Card testID="home-this-year">
      <Heading>{dashboard.thisYear.title}</Heading>
      <View style={[styles.tile, styles.gap1]}>
        <Body pair="sunk" small>
          {t.modules}
        </Body>
        {data.modules ? (
          <>
            <LinkRow
              label={String(data.modules.confirmed)}
              accessibilityLabel={`${t.modules}: ${data.modules.confirmed}`}
              pair="sunkBrand"
              onPress={() => go('/modules')}
              testID="home-modules"
            />
            {data.modules.checked ? (
              <Body pair="sunk" small>
                {data.modules.toFix > 0 ? t.modulesToFix(data.modules.toFix) : t.modulesMatch}
              </Body>
            ) : null}
          </>
        ) : (
          <>
            <Body pair="sunk">{t.modulesNone}</Body>
            <LinkRow label={t.modulesAction} pair="sunkBrand" onPress={() => go('/modules')} />
          </>
        )}
      </View>
    </Card>
  );
}

function ShortlistCard({ data, go }: { data: HomeData; go: Go }) {
  const t = dashboard.shortlist;
  return (
    <Card testID="home-shortlist">
      <Heading>{t.title}</Heading>
      {data.shortlist.length === 0 ? (
        <>
          <Body pair="cardMuted">{t.empty}</Body>
          <Button label={t.browse} variant="secondary" onPress={() => go('/results')} />
        </>
      ) : (
        <>
          {data.shortlist.map((row) => (
            <View key={row.programmeId} style={styles.listRow}>
              <Body pair="card" strong>
                {row.name}
              </Body>
              <WithUniversityMark name={row.universityName}>
                <Body pair="cardMuted" small>
                  {row.universityName}
                </Body>
              </WithUniversityMark>
              <View style={styles.badges}>
                {row.verdict ? (
                  <Badge tone={VERDICT[row.verdict].tone}>{VERDICT[row.verdict].label}</Badge>
                ) : (
                  <Badge>{t.unchecked}</Badge>
                )}
                {row.draft ? <Badge tone="warning">{common.draftBadge}</Badge> : null}
              </View>
            </View>
          ))}
          <LinkRow label={t.open} onPress={() => go('/results')} />
        </>
      )}
    </Card>
  );
}

function ApplicationsCard({ data }: { data: HomeData }) {
  const t = dashboard.applications;
  return (
    <Card testID="home-applications">
      <Heading>{t.title}</Heading>
      {data.applications.length === 0 ? (
        <Body pair="cardMuted">{t.empty}</Body>
      ) : (
        data.applications.map((a) => (
          <View key={a.universityId} style={[styles.tile, styles.gap1]}>
            <WithUniversityMark name={a.universityName}>
              <Body pair="sunk" strong>
                {a.universityName}
              </Body>
            </WithUniversityMark>
            <Body pair="sunk" small>
              {t.checklist(a.done, a.total)}
            </Body>
            {a.closesOn ? (
              <Body pair="sunk" small>
                {formatDate(a.closesOn)}
              </Body>
            ) : null}
          </View>
        ))
      )}
      {/* The app has no applications screen yet: the checklists are on the web. */}
      <Body pair="cardMuted" small>
        {chat.artifactOnWeb}
      </Body>
    </Card>
  );
}

/**
 * Grade 10 (G10-4): what the confirmed report's subjects keep open, in place of the applications
 * (two years away). With no report the headline card offers to add one, so this says "not yet".
 */
function SubjectsCard({ data, go }: { data: HomeData; go: Go }) {
  const t = subjectsCopy.card;
  const s = data.subjects;
  return (
    <Card testID="home-subjects-card">
      <Heading>{t.title}</Heading>
      {!s ? (
        <Body pair="cardMuted">{t.none}</Body>
      ) : s.status === 'unknown' ? (
        <Body pair="cardMuted">{t.unknown}</Body>
      ) : (
        <>
          <Body pair="card" strong testID="home-subjects">
            {s.status === 'some-closed' ? t.closed(s.closed) : t.open}
          </Body>
          {s.draft ? (
            <View style={styles.badges}>
              <Badge tone="warning">{common.draftBadge}</Badge>
            </View>
          ) : null}
        </>
      )}
      {s ? <LinkRow label={t.action} onPress={() => go('/subjects')} /> : null}
    </Card>
  );
}

function OffersCard({ data, go }: { data: HomeData; go: Go }) {
  const t = dashboard.offers;
  return (
    <Card testID="home-offers">
      <Heading>{t.title}</Heading>
      {data.offers.length === 0 ? (
        <>
          <Body pair="cardMuted">{t.empty}</Body>
          <Button label={t.add} variant="secondary" onPress={() => go('/offers')} />
        </>
      ) : (
        <>
          {data.offers.map((o) => (
            <View key={o.id} style={styles.listRow}>
              <Body pair="card" strong>
                {o.programme?.name ?? o.universityName}
              </Body>
              <WithUniversityMark name={o.universityName}>
                <Body pair="cardMuted" small>
                  {o.universityName}
                </Body>
              </WithUniversityMark>
              <View style={styles.badges}>
                <Badge tone={o.status === 'accepted' ? 'success' : 'sunk'}>
                  {offers.statuses[o.status]}
                </Badge>
                <Badge>{offers.kinds[o.offerKind]}</Badge>
                {o.programme?.draft ? <Badge tone="warning">{common.draftBadge}</Badge> : null}
              </View>
            </View>
          ))}
          <LinkRow label={t.open} onPress={() => go('/offers')} />
        </>
      )}
    </Card>
  );
}

function GettingReadyCard({ data, go }: { data: HomeData; go: Go }) {
  const t = dashboard.gettingReady;
  const accepted = data.offers.find((o) => o.status === 'accepted');
  return (
    <Card testID="home-ready">
      <Heading>{t.title}</Heading>
      <View style={[styles.tile, styles.gap1]}>
        <Body pair="sunk" small>
          {t.offer}
        </Body>
        <Body pair="sunk" strong>
          {accepted
            ? `${accepted.programme?.name ?? accepted.universityName} · ${accepted.universityName}`
            : dashboard.offers.empty}
        </Body>
      </View>
      <View style={[styles.tile, styles.gap1]}>
        <Body pair="sunk" small>
          {t.firstWeek}
        </Body>
        {data.firstWeek ? (
          <LinkRow
            label={t.firstWeekValue(data.firstWeek.done, data.firstWeek.total)}
            accessibilityLabel={`${t.firstWeek}: ${t.firstWeekValue(data.firstWeek.done, data.firstWeek.total)}`}
            pair="sunkBrand"
            onPress={() => go('/first-week')}
            testID="home-first-week"
          />
        ) : (
          <Body pair="sunk">{t.firstWeekNone}</Body>
        )}
      </View>
      <View style={[styles.tile, styles.gap1]}>
        <Body pair="sunk" small>
          {t.modules}
        </Body>
        {data.modules ? (
          <>
            <LinkRow
              label={String(data.modules.confirmed)}
              accessibilityLabel={`${t.modules}: ${data.modules.confirmed}`}
              pair="sunkBrand"
              onPress={() => go('/modules')}
              testID="home-modules"
            />
            {data.modules.checked ? (
              <Body pair="sunk" small>
                {data.modules.toFix > 0 ? t.modulesToFix(data.modules.toFix) : t.modulesMatch}
              </Body>
            ) : null}
          </>
        ) : (
          <>
            <Body pair="sunk">{t.modulesNone}</Body>
            <LinkRow label={t.modulesAction} pair="sunkBrand" onPress={() => go('/modules')} />
          </>
        )}
      </View>
    </Card>
  );
}

/** The marks over time as a list: the web's chart has a table for the same reason. */
function MarksCard({ data }: { data: HomeData }) {
  const t = dashboard.chart;
  const [only] = data.marks;
  return (
    <Card testID="home-marks">
      <Heading>{t.title}</Heading>
      {data.marks.length === 0 ? (
        <Body pair="cardMuted">{t.none}</Body>
      ) : data.marks.length === 1 && only ? (
        <Body pair="card">{t.one(t.short[only.kind], only.average)}</Body>
      ) : (
        <>
          <Body pair="cardMuted" small>
            {t.lead}
          </Body>
          {data.marks.map((point) => (
            <View
              key={point.kind}
              style={styles.markRow}
              accessible
              accessibilityLabel={t.point(t.short[point.kind], point.average)}
            >
              <Text style={[theme.text.body, styles.markLabel, { color: theme.color.ink }]}>
                {t.short[point.kind]}
              </Text>
              {/* Decoration: the bar's length is the average; the number says it. */}
              <View style={styles.barTrack}>
                <View style={[styles.bar, { width: `${point.average}%` }]} />
              </View>
              <Text style={[theme.text.bodyStrong, { color: theme.color.ink }]}>
                {t.percent(point.average)}
              </Text>
            </View>
          ))}
        </>
      )}
    </Card>
  );
}

/** Every screen, grouped by stage as in the web's sidebar (A2-12). */
const SECTIONS: ReadonlyArray<{
  readonly label: string | null;
  readonly links: ReadonlyArray<readonly [string, string]>;
}> = [
  { label: null, links: [['/chat', nav.chat]] },
  {
    label: nav.groups.before,
    links: [
      ['/results', nav.results],
      ['/subjects', nav.subjects],
      ['/goals', nav.goals],
      ['/upload', nav.documents],
    ],
  },
  {
    label: nav.groups.university,
    links: [
      ['/offers', nav.offers],
      ['/campus', nav.campus],
      ['/first-week', nav.firstWeek],
      ['/modules', nav.modules],
    ],
  },
  {
    label: nav.groups.you,
    links: [
      ['/account', nav.me],
      ['/notifications', notifications.title],
    ],
  },
];

function Sections({ go }: { go: Go }) {
  return (
    <View testID="home-sections" style={styles.gap2}>
      <Heading pair="page">{dashboard.sectionsLabel}</Heading>
      {SECTIONS.map((group) => (
        <View key={group.label ?? 'main'} style={styles.gap1}>
          {group.label ? (
            <Text style={[theme.text.caps, { color: theme.color.inkMuted }]}>{group.label}</Text>
          ) : null}
          {group.links.map(([route, label]) => (
            <LinkRow key={route} label={label} pair="pageBrand" onPress={() => go(route)} />
          ))}
        </View>
      ))}
    </View>
  );
}

/**
 * "Are you in Grade N now?" each January, once a new school year moved the grade up (G10-1).
 * Yes records it afresh; No opens the grades right here (the app has no profile screen).
 */
function GradeCheckCard({
  grade,
  saveGrade,
}: {
  grade: number;
  saveGrade: (grade: number) => Promise<void>;
}) {
  const t = dashboard.gradeCheck;
  const [changing, setChanging] = useState(false);
  const [chosen, setChosen] = useState<number>(grade);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(value: number) {
    setBusy(true);
    setError(null);
    try {
      await saveGrade(value);
      // The reload drops the card under a screen reader's focus: say it worked (A3-30).
      announce(common.saved);
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  return (
    <Card testID="home-grade-check">
      <Heading>{t.title(grade)}</Heading>
      <Body pair="cardMuted">{t.lead}</Body>
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {changing ? (
        <>
          <RadioGroup label={onboarding.grade} pair="card">
            {SCHOOL_GRADES.map((g) => (
              <Radio
                key={g}
                label={onboarding.gradeOption(g)}
                selected={chosen === g}
                onPress={() => setChosen(g)}
              />
            ))}
          </RadioGroup>
          <Button
            label={common.save}
            busy={busy}
            busyLabel={common.saving}
            onPress={() => void save(chosen)}
          />
        </>
      ) : (
        <>
          <Button
            label={t.yes(grade)}
            busy={busy}
            busyLabel={common.saving}
            onPress={() => void save(grade)}
          />
          <Button
            label={t.change}
            variant="secondary"
            disabled={busy}
            onPress={() => {
              setChanging(true);
              // The pressed button gives way to the grade choices: say what is there now (A3-30).
              announce(onboarding.grade);
            }}
          />
        </>
      )}
    </Card>
  );
}

export function HomeDashboard({
  data,
  go,
  footer,
  saveGrade,
}: {
  data: HomeData;
  go: Go;
  /** Sign out, below everything. */
  footer?: ReactNode;
  /** Records the learner's grade (PATCH /api/me) and reloads the home: the January check. */
  saveGrade?: (grade: number) => Promise<void>;
}) {
  const university = data.stage === 'university';
  const later = laterYear(data);
  return (
    <>
      <View style={styles.welcome}>
        <View style={[styles.gap1, styles.grow]}>
          <Text accessibilityRole="header" style={[theme.text.title, { color: theme.color.ink }]}>
            {data.name ? (
              <>
                {dashboard.welcomeBefore}
                <Text style={{ color: theme.on('pageAccent').color }}>{data.name}</Text>
              </>
            ) : (
              dashboard.welcome('')
            )}
          </Text>
          <Body pair="pageMuted">
            {later ? dashboard.subtitleYears[later] : dashboard.subtitle[data.stage]}
          </Body>
        </View>
        {/* The learner's own avatar, in their theme (the About me card), as on the web's home. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={dashboard.aboutMe}
          onPress={() => go('/account')}
          style={styles.aboutMe}
        >
          <Avatar
            avatar={data.look.avatar}
            name={data.name}
            themeId={data.look.theme}
            size={theme.target}
          />
        </Pressable>
      </View>
      {data.gradeCheck && saveGrade ? (
        <GradeCheckCard grade={data.gradeCheck.grade} saveGrade={saveGrade} />
      ) : null}
      {data.turningEighteen ? (
        // The 30 days before the 18th birthday (A11-25): what changes, and when.
        <Card testID="home-turning-eighteen">
          <Heading>{dashboard.turningEighteen.title(formatDate(data.turningEighteen.on))}</Heading>
          <Body pair="cardMuted">{dashboard.turningEighteen.lead}</Body>
        </Card>
      ) : null}
      <LinkRow label={dashboard.ask} pair="pageMuted" onPress={() => go('/chat')}>
        <View style={styles.ask}>
          <Text style={[theme.text.body, { color: theme.on('cardMuted').color }]}>
            {dashboard.ask}
          </Text>
        </View>
      </LinkRow>
      <NextStep next={data.next} go={go} />
      <Journey steps={homeJourney(data)} go={go} />
      {later ? (
        // A second or final year (A2-66): their year and this year's modules, never the
        // arrival's registration countdown, campus tour, offer and first-week steps.
        <>
          <YearCard data={data} />
          <PromoCard data={data} go={go} />
          <ThisYearCard data={data} go={go} />
        </>
      ) : (
        <>
          {university ? <RegistrationCard data={data} /> : <QualifyCard data={data} go={go} />}
          <PromoCard data={data} go={go} />
          {university ? <OffersCard data={data} go={go} /> : <ShortlistCard data={data} go={go} />}
          {university ? (
            <GettingReadyCard data={data} go={go} />
          ) : data.stage === 'grade-10' ? (
            <SubjectsCard data={data} go={go} />
          ) : (
            <ApplicationsCard data={data} />
          )}
        </>
      )}
      {/* School marks: at university only with a school report to show (A2-66). */}
      {university && data.marks.length === 0 ? null : <MarksCard data={data} />}
      <Sections go={go} />
      {footer}
    </>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1 },
  welcome: { flexDirection: 'row', alignItems: 'flex-start', gap: theme.space['3'] },
  aboutMe: { minWidth: theme.target, minHeight: theme.target },
  gap1: { gap: theme.space['1'] },
  gap2: { gap: theme.space['2'] },
  pressed: { opacity: 0.8 },
  linkRow: { minHeight: theme.target, justifyContent: 'center' },
  nextRow: { flexDirection: 'row', alignItems: 'center', gap: theme.space['3'] },
  stepRow: {
    minHeight: theme.target,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space['3'],
    paddingHorizontal: theme.space['3'],
    paddingVertical: theme.space['2'],
    borderRadius: theme.radius.md,
    borderWidth: theme.border.thin,
    borderColor: theme.color.line,
    backgroundColor: theme.color.surface,
  },
  stepCurrent: { borderColor: theme.color.brand },
  stepNumber: {
    width: theme.space['6'],
    height: theme.space['6'],
    borderRadius: theme.radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepTodo: { borderWidth: theme.border.thin, borderColor: theme.color.lineStrong },
  ask: {
    minHeight: theme.target,
    justifyContent: 'center',
    paddingHorizontal: theme.space['4'],
    borderRadius: theme.radius.full,
    borderWidth: theme.border.thin,
    borderColor: theme.color.lineStrong,
    backgroundColor: theme.color.surface,
  },
  listRow: {
    gap: theme.space['1'],
    paddingVertical: theme.space['2'],
    borderTopWidth: theme.border.thin,
    borderTopColor: theme.color.line,
  },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.space['2'] },
  tile: {
    backgroundColor: theme.color.surfaceSunk,
    borderRadius: theme.radius.sm,
    padding: theme.space['3'],
  },
  markRow: {
    minHeight: theme.target,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space['3'],
  },
  markLabel: { width: theme.space['8'] + theme.space['6'] },
  barTrack: {
    flex: 1,
    height: theme.space['2'],
    borderRadius: theme.radius.full,
    backgroundColor: theme.color.surfaceSunk,
    overflow: 'hidden',
  },
  bar: { height: '100%', backgroundColor: theme.color.accent },
});
