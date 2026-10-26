import { common, reportKinds, subjects as t, whatINeed } from '@universityflow/content/app';
import {
  filterDoors,
  goalStatusText,
  higherBarText,
  needsText,
  type SubjectsCourse,
  type SubjectsDoors,
  type SubjectsResponse,
  type SubjectsWhatIf,
  universityGroups,
} from '@universityflow/ui';
import { Stack, useRouter } from 'expo-router';
import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  announce,
  Badge,
  Body,
  Button,
  Card,
  EmptyState,
  Heading,
  Notice,
  PageHeader,
  Radio,
  RadioGroup,
  Screen,
} from '../components/ui';
import { WithUniversityMark } from '../components/university-mark';
import { api, errorMessage } from '../lib/api';
import { nativeRoute } from '../lib/routes';
import { theme } from '../lib/theme';

/**
 * My subjects in the app (G10-4; redesigned in round 2, the owner's approved proposal): the web
 * page's order on a phone. The verdict first; by university; the closed courses grouped by what
 * they need, each group a button that opens its list; the university filter as radios (no picker
 * dependency, the university chooser's precedent, A3-16); the higher bar's reason; and "Try a
 * different subject", which asks the same API with `?drop=&take=` and announces its answer. Same
 * API and server code as the web page (`GET /api/me/subjects`); the verdicts are code's (hard
 * rule 2), and with no course to check against it says so, never "all open". Nothing animates.
 */
export default function SubjectsScreen() {
  const router = useRouter();
  const [data, setData] = useState<SubjectsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await api<SubjectsResponse>('/api/me/subjects'));
    } catch (e) {
      setError(errorMessage(e));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const go = (href: string) => {
    const route = nativeRoute(href);
    if (route) router.push(route as never);
  };

  const doors = data?.doors ?? null;
  return (
    <Screen belowHeader>
      <Stack.Screen options={{ title: t.title }} />
      <PageHeader title={t.title} lead={t.intro} />
      {error ? (
        <>
          <Notice tone="danger">{error}</Notice>
          {data ? null : <Button label={common.tryAgain} onPress={() => void load()} />}
        </>
      ) : null}
      {!data && !error ? <Body>{common.loading}</Body> : null}
      {data && (!data.report || !doors) ? (
        <EmptyState action={{ label: t.add, onPress: () => router.push('/upload') }}>
          {t.none}
        </EmptyState>
      ) : null}
      {data?.report && doors ? (
        <Subjects data={data} kind={data.report.kind} doors={doors} go={go} />
      ) : null}
    </Screen>
  );
}

type Go = (href: string) => void;
type ReportKind = NonNullable<SubjectsResponse['report']>['kind'];

function Subjects({
  data,
  kind,
  doors,
  go,
}: {
  data: SubjectsResponse;
  kind: ReportKind;
  doors: SubjectsDoors;
  go: Go;
}) {
  const [university, setUniversity] = useState<string | null>(null);
  const [whatIf, setWhatIf] = useState<SubjectsWhatIf | null>(null);
  const chips = (
    <>
      <View style={styles.badges}>
        {data.subjects.map((s) => (
          <Badge key={s.id}>{s.name}</Badge>
        ))}
      </View>
      <Body pair="cardMuted" small>
        {t.fromReport(reportKinds[kind])}
      </Body>
    </>
  );

  if (doors.status === 'unknown') {
    return (
      <>
        <Card testID="subjects-yours">
          <Heading>{t.yours}</Heading>
          {chips}
        </Card>
        <EmptyState>{t.unknown}</EmptyState>
      </>
    );
  }

  const shown = filterDoors(doors, university);
  const goalId = doors.goal?.course.id;
  const goalGroup = shown.groups.findIndex((g) => g.programmes.some((p) => p.id === goalId));
  const canTry = doors.swap.drop.length > 0 && doors.swap.take.length > 0;

  return (
    <>
      <Card testID="subjects-verdict">
        <Text
          accessibilityRole="header"
          style={[theme.text.heading, { color: theme.on('card').color }]}
          testID="subjects-summary"
        >
          {doors.status === 'open'
            ? t.allOpen(doors.checked)
            : t.someClosed(doors.closed, doors.checked)}
        </Text>
        <Meter open={doors.open} checked={doors.checked} />
        <Body pair="cardMuted" small>
          {t.meterLegend(doors.open, doors.closed)}
        </Body>
        {doors.goal ? <GoalRow goal={doors.goal} go={go} /> : null}
        <Text style={[theme.text.caps, { color: theme.on('cardMuted').color }]}>{t.yours}</Text>
        {chips}
      </Card>

      {doors.draft ? <Notice tone="warning">{t.draft}</Notice> : null}

      {doors.byUniversity.length > 0 ? (
        <Card testID="subjects-universities">
          <Heading>{t.byUniversityTitle}</Heading>
          {doors.byUniversity.map((u) => (
            <View key={u.id} style={styles.row}>
              <WithUniversityMark name={u.name} short={u.shortName}>
                <Body pair="card">{u.name}</Body>
              </WithUniversityMark>
              <Body pair="cardMuted" small>
                {t.universityClosed(u.closed, u.checked)}
              </Body>
            </View>
          ))}
        </Card>
      ) : null}

      {doors.groups.length > 0 ? (
        <Card testID="subjects-closes">
          <Heading>
            {shown.university ? t.closesTitleAt(shown.university.name) : t.closesTitle}
          </Heading>
          <Choice
            label={t.filterLabel}
            button={t.filterButton(shown.university?.name ?? t.allUniversities)}
            options={[
              { id: '', name: t.allUniversities },
              ...doors.byUniversity.map((u) => ({ id: u.id, name: u.name })),
            ]}
            value={shown.university?.id ?? ''}
            onChoose={(id) => setUniversity(id || null)}
          />
          {shown.groups.map((g, i) => (
            <Group
              key={`${university ?? ''}|${g.subjects.join('|')}`}
              group={g}
              filtered={shown.university !== null}
              startOpen={i === goalGroup}
              go={go}
            />
          ))}
          {shown.groups.length === 0 && shown.university ? (
            <Body pair="cardMuted">{t.noneAt(shown.university.name)}</Body>
          ) : null}
        </Card>
      ) : null}

      {shown.higherBar.length > 0 ? (
        <Card testID="subjects-higher">
          <Heading>{t.higherTitle}</Heading>
          <Body pair="cardMuted">{t.higherLead}</Body>
          {shown.higherBar.map((c) => (
            <View key={c.id} style={styles.row}>
              <CourseRow course={c} go={go}>
                <Body pair="cardMuted" small>
                  {c.universityName}
                </Body>
              </CourseRow>
              {c.reasons.map((r) => (
                <Body key={higherBarText(r)} pair="card" small>
                  {higherBarText(r)}
                </Body>
              ))}
            </View>
          ))}
        </Card>
      ) : null}

      {canTry ? <WhatIf doors={doors} answer={whatIf} onAnswer={setWhatIf} /> : null}

      {doors.status === 'some-closed' && !whatIf ? <Notice tone="info">{t.talk}</Notice> : null}
    </>
  );
}

/** Open against closed, as a bar: decoration only, the numbers are in the text beside it. */
function Meter({ open, checked }: { open: number; checked: number }) {
  return (
    <View
      style={styles.meter}
      testID="subjects-meter"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View style={[styles.meterFill, { width: `${Math.round((open / checked) * 100)}%` }]} />
    </View>
  );
}

function GoalRow({ goal, go }: { goal: NonNullable<SubjectsDoors['goal']>; go: Go }) {
  return (
    <View style={styles.goal} testID="subjects-goal">
      <Text style={[theme.text.caps, { color: theme.on('sunk').color }]}>{t.goalLabel}</Text>
      <Body pair="sunk" strong>
        {goal.course.name}
      </Body>
      <WithUniversityMark name={goal.course.universityName} short={goal.course.universityShortName}>
        <Body pair="sunk" small>
          {goal.course.universityName}
        </Body>
      </WithUniversityMark>
      <Body pair="sunk">{goalStatusText(goal)}</Body>
      {goal.course.linkable ? (
        <Button
          label={whatINeed.open}
          variant="secondary"
          onPress={() => go(`/results/what-i-need/${goal.course.id}`)}
        />
      ) : null}
    </View>
  );
}

/** A choice of one: a button naming what is chosen, opening its radios (A3-16: focus stays). */
function Choice({
  label,
  button,
  options,
  value,
  onChoose,
}: {
  label: string;
  button: string;
  options: ReadonlyArray<{ id: string; name: string }>;
  value: string;
  onChoose: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.choice}>
      <Button
        label={button}
        variant="secondary"
        expanded={open}
        onPress={() => setOpen((o) => !o)}
      />
      {open ? (
        <RadioGroup label={label} pair="card">
          {options.map((o) => (
            <Radio
              key={o.id || 'all'}
              label={o.name}
              selected={o.id === value}
              onPress={() => {
                if (o.id !== value) onChoose(o.id);
              }}
            />
          ))}
        </RadioGroup>
      ) : null}
    </View>
  );
}

/** A chevron that points down when open; decoration, hidden from screen readers. */
function Chevron({ open }: { open: boolean }) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.chevron, { transform: [{ rotate: open ? '45deg' : '-45deg' }] }]}
    />
  );
}

/** A group of closed courses: a button named by what they need and how many, opening a list. */
function Group({
  group,
  filtered,
  startOpen,
  go,
}: {
  group: ReturnType<typeof filterDoors>['groups'][number];
  filtered: boolean;
  startOpen: boolean;
  go: Go;
}) {
  const [open, setOpen] = useState(startOpen);
  const names = group.subjects.join(t.or);
  const count = filtered ? t.countAt(group.programmes.length, group.total) : t.count(group.total);
  return (
    <View style={styles.group}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t.groupLabel(names, group.programmes.length)}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((o) => !o)}
        style={styles.summary}
      >
        <Chevron open={open} />
        <Text style={[theme.text.bodyStrong, styles.grow, { color: theme.on('card').color }]}>
          {t.needs(names)}
        </Text>
        <Text style={[theme.text.small, { color: theme.on('cardMuted').color }]}>{count}</Text>
      </Pressable>
      {open ? (
        <View accessibilityRole="list" style={styles.list} testID="subjects-courses">
          {universityGroups(group.programmes).map((u) => (
            <View key={u.universityName} style={styles.university}>
              <WithUniversityMark name={u.universityName} short={u.courses[0]?.universityShortName}>
                <Heading level={3}>{u.universityName}</Heading>
              </WithUniversityMark>
              {u.courses.map((c) => (
                <CourseRow key={c.id} course={c} go={go}>
                  {c.alsoNeeds.length > 0 ? (
                    <Body pair="cardMuted" small>
                      {t.alsoNeeds(needsText(c.alsoNeeds))}
                    </Body>
                  ) : null}
                </CourseRow>
              ))}
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

/** A course: a link to What I need when it can show the course, else plain text. */
function CourseRow({
  course,
  go,
  children,
}: {
  course: SubjectsCourse;
  go: Go;
  children?: ReactNode;
}) {
  if (!course.linkable) {
    return (
      <View style={styles.course}>
        <Body pair="card">{course.name}</Body>
        {children}
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="link"
      onPress={() => go(`/results/what-i-need/${course.id}`)}
      style={({ pressed }) => [styles.course, pressed ? styles.pressed : null]}
    >
      <Text style={[theme.text.body, styles.link, { color: theme.on('cardBrand').color }]}>
        {course.name}
      </Text>
      {children}
    </Pressable>
  );
}

/**
 * "Try a different subject": two choices and Check, which asks the API (`?drop=&take=`). The
 * answer is a what-if, announced, with talk to your school under it: the catalogue doesn't know
 * which combinations a school allows. The real verdict above never changes.
 */
function WhatIf({
  doors,
  answer,
  onAnswer,
}: {
  doors: SubjectsDoors;
  answer: SubjectsWhatIf | null;
  onAnswer: (answer: SubjectsWhatIf | null) => void;
}) {
  const [drop, setDrop] = useState(doors.swap.drop[0]?.id ?? '');
  const [take, setTake] = useState(doors.swap.take[0]?.id ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nameOf = (list: SubjectsDoors['swap']['drop'], id: string) =>
    list.find((s) => s.id === id)?.name ?? '';

  async function check() {
    setBusy(true);
    setError(null);
    try {
      const query = `drop=${encodeURIComponent(drop)}&take=${encodeURIComponent(take)}`;
      const asked =
        (await api<SubjectsResponse>(`/api/me/subjects?${query}`)).doors?.whatIf ?? null;
      onAnswer(asked);
      if (asked) {
        announce(
          `${t.whatIfHeading(asked.take.name, asked.drop.name)}. ${t.whatIfVerdict(asked.closed, asked.checked)}`,
        );
      }
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card testID="subjects-what-if">
      <Heading>{t.whatIfTitle}</Heading>
      <Body pair="cardMuted">{t.whatIfLead}</Body>
      <Choice
        label={t.dropLabel}
        button={t.dropButton(nameOf(doors.swap.drop, drop))}
        options={doors.swap.drop}
        value={drop}
        onChoose={setDrop}
      />
      <Choice
        label={t.takeLabel}
        button={t.takeButton(nameOf(doors.swap.take, take))}
        options={doors.swap.take}
        value={take}
        onChoose={setTake}
      />
      <Button label={t.check} busy={busy} busyLabel={t.checking} onPress={() => void check()} />
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {answer ? (
        <View style={styles.goal} testID="subjects-what-if-answer">
          <Heading level={3} pair="sunk">
            {t.whatIfHeading(answer.take.name, answer.drop.name)}
          </Heading>
          <Body pair="sunk">{t.whatIfVerdict(answer.closed, answer.checked)}</Body>
          {answer.opened.length > 0 ? (
            <Body pair="sunk">{t.whatIfOpens(answer.opened.length)}</Body>
          ) : null}
          {answer.closes.length > 0 ? (
            <>
              <Body pair="sunk">{t.whatIfCloses(answer.closes.length)}</Body>
              {answer.closes.map((c) => (
                <Body key={c.id} pair="sunk" small>
                  {c.name}
                </Body>
              ))}
            </>
          ) : null}
          {answer.opened.length === 0 && answer.closes.length === 0 ? (
            <Body pair="sunk">{t.whatIfSame}</Body>
          ) : null}
          <Body pair="sunk" small>
            {t.reportUnchanged}
          </Body>
          <Notice tone="info">{t.talk}</Notice>
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.space['2'] },
  meter: {
    height: theme.space['3'],
    borderRadius: theme.radius.full,
    borderWidth: theme.border.thin,
    borderColor: theme.color.lineStrong,
    backgroundColor: theme.color.surfaceSunk,
    overflow: 'hidden',
  },
  meterFill: { height: '100%', backgroundColor: theme.color.brand },
  goal: {
    gap: theme.space['1'],
    padding: theme.space['3'],
    borderRadius: theme.radius.md,
    // A panel in its card: the sunk fill and the card edge (RT-04).
    ...theme.panel,
  },
  row: {
    gap: theme.space['1'],
    paddingVertical: theme.space['2'],
    borderTopWidth: theme.border.thin,
    borderTopColor: theme.color.line,
  },
  choice: { gap: theme.space['2'] },
  group: { borderTopWidth: theme.border.thin, borderTopColor: theme.color.line },
  summary: {
    minHeight: theme.target,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space['3'],
    paddingVertical: theme.space['2'],
  },
  chevron: {
    width: theme.space['2'],
    height: theme.space['2'],
    borderRightWidth: theme.border.thick,
    borderBottomWidth: theme.border.thick,
    borderColor: theme.color.ink,
  },
  grow: { flex: 1 },
  list: { gap: theme.space['3'], paddingBottom: theme.space['3'] },
  university: { gap: theme.space['1'] },
  course: { minHeight: theme.target, justifyContent: 'center' },
  link: { textDecorationLine: 'underline' },
  pressed: { opacity: 0.7 },
});
