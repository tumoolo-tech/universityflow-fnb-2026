import { en } from '@universityflow/content/app';
import type { ModuleCardView, SourceView } from '@universityflow/ui';
import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from '../lib/theme';
import { Badge, Body, Button, Card, Heading, Notice, SectionTitle, SourceLink } from './ui';

/**
 * A module card in the app (Phase 6c): the same view model as the web's (packages/ui
 * `moduleCardView`): How marks work, Dates, Books and Who teaches it, every value with where it
 * came from, a draft labelled. The calculator is passed in (`calculator`). Nothing animates.
 *
 * `picture`: the slot for the picture behind the card. Integrator: the app's `<CardArtLayers>`
 * from branch `phase-5/more-card-pictures` goes here once the owner approves it.
 */

const t = en.moduleCard;

function Source({ source, context }: { source: SourceView; context: string }) {
  return (
    <View style={styles.source}>
      <Body pair="cardMuted" small>
        {source.checked ? `${source.text}. ${source.checked}` : source.text}
      </Body>
      {source.draft ? <Badge tone="warning">{en.common.draftBadge}</Badge> : null}
      {source.url ? <SourceLink url={source.url} context={context} /> : null}
    </View>
  );
}

function OpenLink({ label, url }: { label: string; url: string }) {
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={label}
      onPress={() => void Linking.openURL(url).catch(() => undefined)}
      style={styles.link}
    >
      <Text style={[theme.text.body, { color: theme.on('cardBrand').color }]}>{label}</Text>
    </Pressable>
  );
}

export function ModuleCard({
  view,
  calculator,
  picture,
}: {
  view: ModuleCardView;
  calculator: ReactNode;
  /** The picture behind the card: see the file comment. */
  picture?: ReactNode;
}) {
  const router = useRouter();
  const { how, dates, books, people } = view;
  return (
    <View style={styles.wrap}>
      {picture ?? null}
      {view.sampleNotice ? <Notice tone="warning">{view.sampleNotice}</Notice> : null}
      {view.previewNotice ? <Notice tone="warning">{view.previewNotice}</Notice> : null}

      <Card testID="card-how">
        <Heading>{how.title}</Heading>
        <Body pair="cardMuted" small>
          {how.lead}
        </Body>
        {how.outlineNotUsed ? <Notice tone="warning">{how.outlineNotUsed}</Notice> : null}
        {how.rows.map((row) => (
          <View key={row.id} style={styles.row} testID={`card-how-${row.id}`}>
            <Body pair="card" strong>
              {row.label}
            </Body>
            {row.lines.map((line) => (
              <Body key={line} pair="card">
                {line}
              </Body>
            ))}
            {row.source ? <Source source={row.source} context={row.label} /> : null}
            {row.conflict ? (
              <Notice tone="warning">{`${row.conflict.text} ${row.conflict.other}`}</Notice>
            ) : null}
          </View>
        ))}
        {how.otherRules.length > 0 ? (
          <View style={styles.row}>
            <SectionTitle>{t.how.otherRulesTitle}</SectionTitle>
            {how.otherRules.map((r) => (
              <View key={`${r.source.text}:${r.quote}`} style={styles.row}>
                <Body pair="card">{`“${r.quote}”`}</Body>
                <Source source={r.source} context={view.code} />
              </View>
            ))}
          </View>
        ) : null}
      </Card>

      <Card>{calculator}</Card>

      <Card testID="card-dates">
        <Heading>{dates.title}</Heading>
        {dates.outline ? (
          <View style={styles.row}>
            <Body pair="cardMuted" small>
              {dates.outline.source}
            </Body>
            {dates.outline.items.map((d) => (
              <Body key={`${d.label}:${d.date}`} pair="card">
                {d.past
                  ? `${d.label}: ${d.date} (${en.modules.deadlinePassed})`
                  : `${d.label}: ${d.date}`}
              </Body>
            ))}
          </View>
        ) : null}
        {dates.calendar ? (
          <View style={styles.row}>
            <Source source={dates.calendar.source} context={dates.title} />
            {dates.calendar.groups.map((g) => (
              <View key={g.label} style={styles.row}>
                <Body pair="card" strong>
                  {g.label}
                </Body>
                {g.items.map((item) => (
                  <Body key={item} pair="card" small>
                    {item}
                  </Body>
                ))}
              </View>
            ))}
          </View>
        ) : null}
        {dates.none ? <Body pair="card">{dates.none}</Body> : null}
      </Card>

      <Card testID="card-books">
        <Heading>{books.title}</Heading>
        {books.outline.map((b) => (
          <View key={`${b.role}:${b.title}`} style={styles.row}>
            <Body pair="card" strong>{`${b.role}: ${b.title}`}</Body>
            {b.details.length > 0 ? (
              <Body pair="cardMuted" small>
                {b.details.join(' · ')}
              </Body>
            ) : null}
          </View>
        ))}
        {books.outlineNote ? <Body pair="card">{books.outlineNote}</Body> : null}
        {books.addOutline ? (
          <Body pair="cardMuted" small>
            {books.addOutline}
          </Body>
        ) : null}
        <SectionTitle>{books.free.title}</SectionTitle>
        <Body pair="cardMuted" small>
          {books.free.lead}
        </Body>
        {books.free.books.map((b) => (
          <View key={b.url} style={styles.row} testID="card-free-book">
            <Badge tone="info">{b.label}</Badge>
            {b.draft ? <Badge tone="warning">{en.common.draftBadge}</Badge> : null}
            <OpenLink label={b.link} url={b.url} />
            <Body pair="cardMuted" small>
              {b.details.join(' · ')}
            </Body>
          </View>
        ))}
        {books.free.none ? <Body pair="card">{books.free.none}</Body> : null}
        <Body pair="cardMuted" small>
          {books.free.onlyLegal}
        </Body>
        {books.library ? (
          <View style={styles.row}>
            {books.library.links.map((l) => (
              <OpenLink key={l.url} label={l.label} url={l.url} />
            ))}
            <Body pair="cardMuted" small>
              {books.library.note}
            </Body>
          </View>
        ) : null}
        {books.noLibrary ? <Body pair="card">{books.noLibrary}</Body> : null}
      </Card>

      <Card testID="card-people">
        <Heading>{people.title}</Heading>
        {people.source ? (
          <Body pair="cardMuted" small>
            {people.source}
          </Body>
        ) : null}
        {people.people.map((p) => (
          <View key={p.name} style={styles.row}>
            <Body pair="card" strong>
              {p.role ? `${p.name}, ${p.role}` : p.name}
            </Body>
            {p.details.map((d) =>
              d.href ? (
                <OpenLink key={d.label} label={`${d.label}: ${d.value}`} url={d.href} />
              ) : (
                <Body key={d.label} pair="card" small>
                  {`${d.label}: ${d.value}`}
                </Body>
              ),
            )}
          </View>
        ))}
        {people.notPublished ? <Body pair="card">{people.notPublished}</Body> : null}
        {people.askOffice && people.office ? (
          <View style={styles.row} testID="card-office">
            <Body pair="card">{people.askOffice}</Body>
            <Body pair="card" small>{`${en.modules.where}: ${people.office.where}`}</Body>
            {people.office.email ? (
              <OpenLink
                label={`${en.modules.email}: ${people.office.email}`}
                url={`mailto:${people.office.email}`}
              />
            ) : null}
            <SourceLink url={people.office.contactUrl}>{en.modules.contactPage}</SourceLink>
          </View>
        ) : null}
        {people.noOffice ? <Body pair="card">{people.noOffice}</Body> : null}
      </Card>

      <Button label={t.back} variant="quiet" onPress={() => router.back()} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: theme.space['4'] },
  row: { gap: theme.space['1'] },
  source: { gap: theme.space['1'], alignItems: 'flex-start' },
  link: { minHeight: theme.target, justifyContent: 'center' },
});
