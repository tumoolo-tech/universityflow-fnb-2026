import type { SchoolRecord } from '@universityflow/admissions';
import { type SubjectId, subject } from '@universityflow/catalogue/client';
import { en } from '@universityflow/content/app';
import { StyleSheet, View } from 'react-native';
import { formatDate } from '../lib/format';
import { theme } from '../lib/theme';
import { Badge, Body, Button, Card, Heading } from './ui';

/**
 * The school record on *My results* (planning.md §18.7 C2): every report the learner confirmed,
 * side by side, exactly as packages/admissions laid it out on the server (hard rule 2). On a
 * phone each subject's marks sit in a row that wraps, one box per report; each box is named in
 * full for a screen reader, with who entered the mark. Nothing before a report is confirmed.
 */

const t = en.schoolRecord;

const subjectName = (id: SubjectId) => {
  try {
    return subject(id).name;
  } catch {
    return id;
  }
};

export function SchoolRecordCard({
  record,
  onCorrect,
}: {
  record: SchoolRecord;
  onCorrect: () => void;
}) {
  if (record.reports.length === 0) return null;
  return (
    <Card testID="school-record" style={styles.card}>
      <Heading>{t.title}</Heading>
      <Body pair="cardMuted">{t.lead}</Body>

      <View style={styles.wrap}>
        {record.reports.map((r) => (
          <View key={r.kind} style={styles.report} testID={`record-report-${r.kind}`}>
            <Body pair="card" strong>
              {en.reportKinds[r.kind]}
            </Body>
            <Body pair="cardMuted" small>
              {formatDate(r.confirmedAt)}
            </Body>
            <Badge>{t.source[r.source]}</Badge>
            <Body pair="card" small>{`${t.pass}: ${en.passTypes[r.pass]}`}</Body>
          </View>
        ))}
      </View>
      <Body pair="cardMuted" small>
        {t.passNote}
      </Body>

      {record.rows.map((row) => {
        const name = subjectName(row.subject);
        return (
          <View key={row.subject} style={styles.row} testID={`record-row-${row.subject}`}>
            <Heading level={3}>{name}</Heading>
            <View style={styles.wrap}>
              {row.marks.map((m, i) => {
                const report = record.reports[i];
                if (!m || !report) return null;
                return (
                  <View
                    key={report.kind}
                    style={styles.mark}
                    accessible
                    accessibilityLabel={t.markLabel(
                      en.reportKinds[report.kind],
                      name,
                      m.percent,
                      m.level,
                      t.source[m.source],
                    )}
                  >
                    <Body pair="sunk" small>
                      {en.dashboard.chart.short[report.kind]}
                    </Body>
                    <Body pair="sunk" strong>
                      {t.percent(m.percent)}
                    </Body>
                    <Body pair="sunk" small>
                      {t.level(m.level)}
                    </Body>
                  </View>
                );
              })}
            </View>
            <Body pair="cardMuted" small>
              {`${t.changeHeading}: ${row.change === null ? t.noChange : t.change(row.change)}`}
            </Body>
          </View>
        );
      })}

      <View style={styles.row}>
        <Heading level={3}>{t.levelsTitle}</Heading>
        <View style={styles.wrap}>
          {record.levels.map((l) => (
            <Body key={l.level} pair="cardMuted" small>
              {t.levelRange(l.level, l.from, l.to)}
            </Body>
          ))}
        </View>
      </View>
      <Body pair="card" small>
        {t.correct}
      </Body>
      <Button label={t.correctLink} variant="secondary" onPress={onCorrect} />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: theme.space['3'] },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.space['2'] },
  report: { gap: theme.space['1'], flexShrink: 1 },
  row: { gap: theme.space['1'] },
  mark: {
    backgroundColor: theme.color.surfaceSunk,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.space['2'],
    paddingVertical: theme.space['1'],
  },
});
